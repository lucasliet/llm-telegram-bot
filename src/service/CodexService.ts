import OpenAi from 'npm:openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { codexModels } from '@/config/models.ts';

const CODEX_ACCESS_TOKEN: string | undefined = Deno.env.get('CODEX_ACCESS_TOKEN');
const CODEX_ACCOUNT_ID: string | undefined = Deno.env.get('CODEX_ACCOUNT_ID');

const { textModel } = codexModels;

const CODEX_MAX_TOKENS = 8000;
const sessionId = crypto.randomUUID().toLowerCase();

/**
 * Service for interacting with Codex Responses API via SSE
 */
export default {
	/**
	 * Generate text using Codex API with SSE streaming
	 * @param userKey - User identifier for chat history
	 * @param quote - Optional quoted message to include in the prompt
	 * @param prompt - Text prompt to send to the model
	 * @param model - Model to use, defaults to gpt-5
	 * @returns StreamReplyResponse with reader and completion handler
	 */
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
		model: string = textModel,
	): Promise<StreamReplyResponse> {
		if (!CODEX_ACCESS_TOKEN || !CODEX_ACCOUNT_ID) {
			throw new Error('Codex credentials are missing. Set CODEX_ACCESS_TOKEN and CODEX_ACCOUNT_ID.');
		}

		const history = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const system = getSystemPrompt('Codex', model, CODEX_MAX_TOKENS);

		const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: system },
			...convertGeminiHistoryToGPT(history),
			{ role: 'user', content: requestPrompt },
		];

		const client = new OpenAi({
			apiKey: CODEX_ACCESS_TOKEN,
			baseURL: 'https://chatgpt.com/backend-api/codex',
			defaultHeaders: {
				'chatgpt-account-id': CODEX_ACCOUNT_ID,
				'OpenAI-Beta': 'responses=experimental',
				'originator': 'codex_cli_rs',
				'User-Agent': 'codex_cli_rs',
				'session_id': sessionId,
			},
		});

		const stream = client.responses.stream({
			model,
			instructions: await getCodexInstructions(),
			input: messages as OpenAi.Responses.ResponseInput,
			tools: [],
			tool_choice: 'auto',
			parallel_tool_calls: false,
			reasoning: { effort: 'minimal', summary: 'auto' },
			verbosity: { text: 'low' },
			store: false,
			include: ['reasoning.encrypted_content'],
		});

		const reader = toReader(stream);

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				history,
				quote,
				requestPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete, responseMap };
	},
};

/**
 * Maps a streamed JSON chunk to plain text, matching OpenAI chat format
 * @param responseBody - Raw JSON line chunk
 * @returns Delta text content from the chunk
 */
function responseMap(responseBody: string): string {
	try {
		const obj = JSON.parse(responseBody);
		if (obj?.choices?.[0]?.delta?.content) return obj.choices[0].delta.content;
		if (obj?.type === 'response.output_text.delta' && typeof obj?.delta === 'string') return obj.delta;
		if (typeof obj?.output_text === 'string') return obj.output_text;
		return '';
	} catch {
		return '';
	}
}

/**
 * Converts an OpenAI ResponseStream into a web ReadableStream reader.
 * Falls back to async iteration when toReadableStream is unavailable.
 * @param stream - The ResponseStream instance returned by the SDK.
 * @returns A reader that yields Uint8Array chunks representing JSON lines.
 */
function toReader(stream: any) {
	if (stream && typeof stream.toReadableStream === 'function') {
		return stream.toReadableStream().getReader();
	}
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const event of stream) {
					const encoded = new TextEncoder().encode(JSON.stringify(event));
					controller.enqueue(encoded);
				}
			} finally {
				controller.close();
			}
		},
	}).getReader();
}

let cachedCodexInstructions: string | null = null;

/**
 * Loads Codex instructions from local resources files
 * @returns Concatenated instructions content
 */
async function getCodexInstructions(): Promise<string> {
	if (cachedCodexInstructions !== null) return cachedCodexInstructions;
	try {
		const base = new URL('.', import.meta.url);
		const promptUrl = new URL('../../resources/prompt.md', base);
		const toolUrl = new URL('../../resources/apply_patch_tool_instructions.md', base);
		const [prompt, tool] = await Promise.all([
			Deno.readTextFile(promptUrl.pathname),
			Deno.readTextFile(toolUrl.pathname),
		]);
		cachedCodexInstructions = `${prompt}\n${tool}`;
		return cachedCodexInstructions;
	} catch {
		cachedCodexInstructions = '';
		return cachedCodexInstructions;
	}
}
