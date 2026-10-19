import process from 'node:process';
import * as path from '@std/path';
import { encodeBase64 } from 'base64';
import OpenAI from 'openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { luaModels } from '@/config/models.ts';

export const LUA_API_BASE = 'https://chat.8th.vision';

const SESSION_COOKIE_NAMES = ['lua-chat-session', '8th-session'];
const COOKIE_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_CHAT_CONTEXT = 'profissional';
const DEFAULT_MODEL_TIER = 'supreme';
const DEFAULT_TTS_LANG = 'pt-BR';
const DEFAULT_TTS_VOICE = 'pt-BR-FranciscaNeural';
const DEFAULT_MAX_TOKENS = 128000;

export interface LuaChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface LuaChatOptions {
	imageAttachments?: string[];
	suppressToolBlocks?: boolean;
}

export interface LuaTtsOptions {
	lang?: string;
	voiceName?: string;
}

interface LuaSession {
	cookie: string;
	expiresAt: number;
}

let session: LuaSession | null = null;

/**
 * Discards the in-memory session, forcing a fresh login on the next call.
 */
export function resetLuaSession() {
	session = null;
}

/**
 * Reads LUA Chat credentials from the environment.
 * @returns Email and password configured in `LUA_CHAT_EMAIL` and `LUA_CHAT_PASSWORD`.
 */
function readCredentialsFromEnv() {
	const email = process.env.LUA_CHAT_EMAIL?.trim();
	const password = process.env.LUA_CHAT_PASSWORD;
	if (!email || !password) {
		throw new Error('LUA credentials missing: set LUA_CHAT_EMAIL and LUA_CHAT_PASSWORD');
	}
	return { email, password };
}

/**
 * Builds the `Cookie` header keeping only LUA session cookies.
 * @param setCookies - `Set-Cookie` entries from the login response.
 * @returns `Cookie` header value or null when no session cookie was present.
 */
function buildCookieHeader(setCookies: string[]) {
	const pairs = setCookies
		.map((entry) => entry.split(';')[0].trim())
		.filter((pair) => SESSION_COOKIE_NAMES.includes(pair.split('=')[0]));
	return pairs.length > 0 ? pairs.join('; ') : null;
}

/**
 * Extracts the expiration timestamp (ms) from the `lua-chat-session` JWT.
 * @param cookie - `Cookie` header value.
 * @returns Timestamp in ms, or null if the JWT cannot be parsed.
 */
function extractJwtExpiry(cookie: string) {
	const pair = cookie.split('; ').find((entry) => entry.startsWith(`${SESSION_COOKIE_NAMES[0]}=`));
	const payload = pair?.split('=')[1]?.split('.')[1];
	if (!payload) return null;
	try {
		const json = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
		const { exp } = JSON.parse(json) as { exp?: unknown };
		return typeof exp === 'number' ? exp * 1000 : null;
	} catch {
		return null;
	}
}

/**
 * Calls `POST /api/login` and returns the session `Cookie` header value.
 * @param email - Account email.
 * @param password - Account password.
 * @returns `Cookie` header value.
 */
async function loginToLua(email: string, password: string) {
	const response = await fetch(`${LUA_API_BASE}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	if (response.status === 401) {
		throw new Error('LUA login rejected (401): check LUA_CHAT_EMAIL and LUA_CHAT_PASSWORD');
	}
	if (!response.ok) {
		throw new Error(`LUA login failed with status ${response.status}`);
	}
	const cookie = buildCookieHeader(response.headers.getSetCookie());
	if (!cookie) {
		throw new Error('LUA login returned no session cookie');
	}
	return cookie;
}

/**
 * Returns a valid session cookie, logging in when missing or near expiry.
 * @returns `Cookie` header value.
 */
async function getSessionCookie() {
	if (session && Date.now() < session.expiresAt) {
		return session.cookie;
	}
	const { email, password } = readCredentialsFromEnv();
	const cookie = await loginToLua(email, password);
	const expiry = extractJwtExpiry(cookie) ?? Date.now() + DEFAULT_COOKIE_TTL_MS;
	session = { cookie, expiresAt: expiry - COOKIE_EXPIRY_BUFFER_MS };
	return cookie;
}

/**
 * Performs an authenticated POST against a LUA endpoint, re-logging in once on 401.
 * @param path - API path, e.g. `/api/chat`.
 * @param body - JSON request body.
 * @returns HTTP response.
 */
async function postAuthenticated(path: string, body: unknown) {
	const send = async () =>
		fetch(`${LUA_API_BASE}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: await getSessionCookie() },
			body: JSON.stringify(body),
		});
	const response = await send();
	if (response.status !== 401) return response;
	resetLuaSession();
	return send();
}

/**
 * Throws a descriptive error when an HTTP response is not OK.
 * @param response - Response to validate.
 * @param operation - Operation name for the error message.
 */
async function assertOk(response: Response, operation: string) {
	if (response.ok) return;
	if (response.status === 429) throw new Error(`LUA ${operation} rate limited (429)`);
	const detail = await response.text().catch(() => '');
	throw new Error(`LUA ${operation} failed with status ${response.status}: ${detail.slice(0, 300)}`);
}

/**
 * Extracts text content from a single `/api/chat` SSE line.
 * @param line - Raw line from the stream.
 * @returns Content delta, or empty string for non-content events.
 */
function parseSseContent(line: string) {
	if (!line.startsWith('data: ')) return '';
	const payload = line.slice(6).trim();
	if (payload === '[DONE]') return '';
	try {
		const { content } = JSON.parse(payload) as { content?: unknown };
		return typeof content === 'string' ? content : '';
	} catch {
		return '';
	}
}

/**
 * Consumes an SSE stream and accumulates text deltas into a single string.
 * @param body - Response body from `/api/chat`.
 * @returns Full assistant response text.
 */
async function readSseText(body: ReadableStream<Uint8Array>) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffered = '';
	let text = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffered += decoder.decode(value, { stream: true });
		const lines = buffered.split(/\r?\n/);
		buffered = lines.pop() ?? '';
		text += lines.map(parseSseContent).join('');
	}
	buffered += decoder.decode();
	return text + buffered.split(/\r?\n/).map(parseSseContent).join('');
}

/**
 * Transforms an SSE byte stream into a plain UTF-8 text stream of content deltas.
 * @param body - Raw SSE response body from `/api/chat`.
 * @returns Reader yielding decoded content delta chunks.
 */
function createSseTextReader(body: ReadableStream<Uint8Array>) {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffered = '';

	const enqueueLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
		const delta = parseSseContent(line);
		if (delta) controller.enqueue(encoder.encode(delta));
	};

	const transform = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			buffered += decoder.decode(chunk, { stream: true });
			const lines = buffered.split(/\r?\n/);
			buffered = lines.pop() ?? '';
			for (const line of lines) enqueueLine(line, controller);
		},
		flush(controller) {
			buffered += decoder.decode();
			for (const line of buffered.split(/\r?\n/)) enqueueLine(line, controller);
		},
	});

	return body.pipeThrough(transform).getReader();
}

/**
 * Maps stored OpenAI chat history entries to LUA chat message format.
 * @param history - Stored conversation history.
 * @returns Array of LUA chat messages.
 */
function toLuaMessages(history: OpenAI.ChatCompletionMessageParam[]): LuaChatMessage[] {
	return history.map((msg) => ({
		role: msg.role === 'assistant' ? 'assistant' : 'user',
		content: typeof msg.content === 'string' ? msg.content : '',
	}));
}

/**
 * Downloads image URLs and encodes them as base64 data URLs.
 * @param photoUrls - Promises resolving to image URLs.
 * @returns Array of `data:image/...;base64,...` strings.
 */
function fetchImageDataUrls(photoUrls: Promise<string>[]): Promise<string[]> {
	return Promise.all(
		photoUrls.map(async (photoUrlPromise) => {
			const url = await photoUrlPromise;
			const response = await fetch(url);
			if (!response.ok) return url;
			const base64String = encodeBase64(await response.arrayBuffer());
			const ext = path.extname(url).slice(1).toLowerCase();
			const mimeType = ext && ext !== 'jpg' ? `image/${ext}` : 'image/jpeg';
			return `data:${mimeType};base64,${base64String}`;
		}),
	);
}

/**
 * Service for interacting with LUA Chat (chat.8th.vision) for chat, vision, and TTS.
 */
export default class LuaVisionService {
	private model: string;

	/**
	 * Creates a new LuaVisionService instance.
	 * @param model - LUA model tier identifier (defaults to `supreme`).
	 */
	public constructor(model: string = luaModels.supreme) {
		this.model = model;
	}

	/**
	 * Sends a conversation to LUA Chat and accumulates the streaming response.
	 * @param messages - Conversation message history.
	 * @param options - Optional image data URLs and tool block suppression flag.
	 * @param model - Model tier identifier.
	 * @returns Accumulated assistant response text.
	 */
	public static async chat(
		messages: LuaChatMessage[],
		options: LuaChatOptions = {},
		model: string = DEFAULT_MODEL_TIER,
	): Promise<string> {
		const response = await LuaVisionService.postChat(messages, options, model);
		return readSseText(response.body!);
	}

	/**
	 * Converts text to MP3 audio via `/api/tts`.
	 * @param text - Text to synthesize.
	 * @param options - Language and voice name options.
	 * @returns MP3 audio bytes as Uint8Array.
	 */
	public static async textToSpeech(text: string, options: LuaTtsOptions = {}): Promise<Uint8Array> {
		const response = await postAuthenticated('/api/tts', {
			text,
			lang: options.lang ?? DEFAULT_TTS_LANG,
			voiceName: options.voiceName ?? DEFAULT_TTS_VOICE,
		});
		await assertOk(response, 'tts');
		return new Uint8Array(await response.arrayBuffer());
	}

	/**
	 * Posts a chat request and validates the streaming response.
	 * @param messages - Conversation messages.
	 * @param options - Chat options including optional image attachments.
	 * @param model - Model tier identifier.
	 * @returns Validated HTTP response with a readable body.
	 */
	private static async postChat(
		messages: LuaChatMessage[],
		options: LuaChatOptions,
		model: string,
	): Promise<Response> {
		const body: Record<string, unknown> = {
			messages,
			chatContext: DEFAULT_CHAT_CONTEXT,
			model,
			autoAdjust: true,
			suppressToolBlocks: options.suppressToolBlocks ?? true,
		};
		if (options.imageAttachments?.length) {
			body.imageAttachments = options.imageAttachments;
		}
		const response = await postAuthenticated('/api/chat', body);
		await assertOk(response, 'chat');
		if (!response.body) throw new Error('LUA chat returned a response without body');
		return response;
	}

	/**
	 * Generates a streaming text response from LUA Chat using stored user history.
	 * @param userKey - User identifier for chat history.
	 * @param quote - Optional quoted message text.
	 * @param prompt - User prompt text.
	 * @returns StreamReplyResponse for incremental Telegram delivery.
	 */
	public async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		const history = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;
		const messages: LuaChatMessage[] = [
			{ role: 'system', content: getSystemPrompt('LUA', this.model, DEFAULT_MAX_TOKENS) },
			...toLuaMessages(history),
			{ role: 'user', content: requestPrompt },
		];
		const response = await LuaVisionService.postChat(messages, {}, this.model);
		const reader = createSseTextReader(response.body!);
		const onComplete = (completedAnswer: string) => addContentToChatHistory(history, requestPrompt, completedAnswer, userKey);
		return { reader, onComplete };
	}

	/**
	 * Generates a streaming text response from LUA Chat with image attachments.
	 * @param userKey - User identifier for chat history.
	 * @param quote - Optional quoted message text.
	 * @param photosUrl - Promises resolving to Telegram file URLs.
	 * @param prompt - User prompt accompanying the images.
	 * @returns StreamReplyResponse for incremental Telegram delivery.
	 */
	public async generateTextFromImage(
		userKey: string,
		quote: string = '',
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse> {
		const history = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;
		const imageAttachments = await fetchImageDataUrls(photosUrl);
		const messages: LuaChatMessage[] = [
			{ role: 'system', content: getSystemPrompt('LUA', this.model, DEFAULT_MAX_TOKENS) },
			...toLuaMessages(history),
			{ role: 'user', content: requestPrompt },
		];
		const response = await LuaVisionService.postChat(
			messages,
			{ imageAttachments },
			this.model,
		);
		const reader = createSseTextReader(response.body!);
		const onComplete = (completedAnswer: string) => addContentToChatHistory(history, requestPrompt, completedAnswer, userKey);
		return { reader, onComplete };
	}
}
