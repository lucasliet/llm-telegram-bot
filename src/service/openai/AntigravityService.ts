import OpenAi from 'npm:openai';
import OpenAiService, { responseMap } from './OpenAIService.ts';
import { AntigravityTokenManager } from '../antigravity/AntigravityOAuth.ts';
import { AntigravityTransformer } from '../antigravity/AntigravityTransformer.ts';
import { ANTIGRAVITY_ENDPOINTS, type AntigravityRequestPayload, MIN_SIGNATURE_LENGTH, SKIP_THOUGHT_SIGNATURE } from '../antigravity/AntigravityTypes.ts';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, type StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import ToolService from '@/service/ToolService.ts';
import { AgentLoopExecutor } from './agent/index.ts';
import { ChatCompletionsStreamProcessor } from './stream/index.ts';
import { cacheSignature, getCachedSignature } from '../antigravity/AntigravityCache.ts';
import crypto from 'node:crypto';

export default class AntigravityService extends OpenAiService {
	private tokenManager: AntigravityTokenManager;
	private currentEndpointIndex = 0;
	private sessionId: string;
	private toolCallSignatures = new Map<string, string>();

	public constructor(model: string = 'gemini-3-flash') {
		super(
			new OpenAi({ apiKey: 'antigravity-placeholder', baseURL: 'https://cloudcode-pa.googleapis.com' }),
			model,
			true,
			8192,
		);
		this.tokenManager = AntigravityTokenManager.getInstance();
		this.sessionId = `telegram-${crypto.randomUUID().slice(0, 8)}`;
	}

	/**
	 * Builds Antigravity-specific request headers with a valid access token.
	 */
	private async getHeaders(): Promise<Record<string, string>> {
		const accessToken = await this.tokenManager.getAccessToken();
		return {
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/1.16.5 Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36',
			'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
			'Client-Metadata': JSON.stringify({ ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' }),
			'Accept': 'text/event-stream',
			'anthropic-beta': 'interleaved-thinking-2025-05-14',
		};
	}

	/**
	 * Makes a streaming request to the Antigravity API with endpoint fallback.
	 */
	private async makeRequest(payload: AntigravityRequestPayload): Promise<Response> {
		const headers = await this.getHeaders();
		const endpoint = ANTIGRAVITY_ENDPOINTS[this.currentEndpointIndex];
		const url = `${endpoint}/v1internal:streamGenerateContent?alt=sse`;

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
		});

		if ((response.status === 429 || response.status >= 500) && this.currentEndpointIndex < ANTIGRAVITY_ENDPOINTS.length - 1) {
			console.warn(`[Antigravity] Endpoint ${endpoint} returned ${response.status}, trying next...`);
			this.currentEndpointIndex++;
			return this.makeRequest(payload);
		}

		this.currentEndpointIndex = 0;

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Antigravity API error (${response.status}): ${errorText}`);
		}

		return response;
	}

	/**
	 * Transforms Antigravity SSE stream into OpenAI Chat Completions format.
	 * This allows reuse of the existing ChatCompletionsStreamProcessor and agent loop.
	 */
	private transformStream(body: ReadableStream<Uint8Array>): ReadableStreamDefaultReader<Uint8Array> {
		const decoder = new TextDecoder();
		const encoder = new TextEncoder();
		let buffer = '';

		const transformedStream = new ReadableStream<Uint8Array>({
			start: async (controller) => {
				const reader = body.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed || !trimmed.startsWith('data:')) continue;

							const jsonText = trimmed.substring(5).trim();
							if (!jsonText || jsonText === '[DONE]') continue;

							try {
								const data = JSON.parse(jsonText);
								this.processGeminiChunk(data, controller, encoder);
							} catch {
								// Skip unparseable lines
							}
						}
					}

					// Process remaining buffer
					if (buffer.trim()) {
						const trimmed = buffer.trim();
						if (trimmed.startsWith('data:')) {
							const jsonText = trimmed.substring(5).trim();
							if (jsonText && jsonText !== '[DONE]') {
								try {
									const data = JSON.parse(jsonText);
									this.processGeminiChunk(data, controller, encoder);
								} catch {
									// Skip
								}
							}
						} else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
							// Non-SSE JSON array response (some endpoints return raw JSON)
							try {
								const dataArray = JSON.parse(trimmed);
								const items = Array.isArray(dataArray) ? dataArray : [dataArray];
								for (const data of items) {
									this.processGeminiChunk(data, controller, encoder);
								}
							} catch {
								// Skip
							}
						}
					}

					// Emit final stop chunk
					const stopChunk = JSON.stringify({
						choices: [{ delta: {}, finish_reason: 'stop' }],
					});
					controller.enqueue(encoder.encode(stopChunk + '\n'));
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					const errorChunk = JSON.stringify({
						choices: [{ delta: { content: `\n\nErro no stream: ${errorMsg}` }, finish_reason: 'stop' }],
					});
					controller.enqueue(encoder.encode(errorChunk + '\n'));
				} finally {
					controller.close();
				}
			},
		});

		return transformedStream.getReader();
	}

	/**
	 * Processes a single Gemini-format chunk and emits OpenAI-format chunks.
	 */
	private processGeminiChunk(
		data: any,
		controller: ReadableStreamDefaultController<Uint8Array>,
		encoder: TextEncoder,
	): void {
		const parts = data.response?.candidates?.[0]?.content?.parts || data.candidates?.[0]?.content?.parts;
		if (!parts) return;

		let toolCallIndex = 0;

		for (const part of parts) {
			if (part.text) {
				const chunk = JSON.stringify({
					choices: [{ delta: { content: part.text }, finish_reason: null }],
				});
				controller.enqueue(encoder.encode(chunk + '\n'));
			}

			if (part.functionCall) {
				const thoughtSig = part.thoughtSignature;

				if (thoughtSig && this.sessionId) {
					const thinkingText = this.extractThinkingTextFromPart({ thought: true, text: part.functionCall.args?.__thinking_text || '' });
					if (thinkingText) {
						cacheSignature(this.sessionId, thinkingText, thoughtSig);
					}
				}

				const callId = `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

				if (thoughtSig) {
					this.toolCallSignatures.set(callId, thoughtSig);
				}

				const chunk = JSON.stringify({
					choices: [{
						delta: {
							tool_calls: [{
								index: toolCallIndex,
								id: callId,
								type: 'function',
								function: {
									name: part.functionCall.name,
									arguments: JSON.stringify(part.functionCall.args || {}),
								},
							}],
						},
						finish_reason: null,
					}],
				});
				controller.enqueue(encoder.encode(chunk + '\n'));
				toolCallIndex++;
			}
		}
	}

	/**
	 * Builds the Antigravity API payload from OpenAI-format messages.
	 */
	private async buildPayload(
		messages: OpenAi.Chat.ChatCompletionMessageParam[],
		includeTools: boolean,
	): Promise<AntigravityRequestPayload> {
		const projectId = await this.tokenManager.getProjectId();
		const { systemInstruction, contents } = AntigravityTransformer.toGeminiFormat(messages, this.toolCallSignatures);
		const filteredSchemas = ToolService.schemas.filter(
			(tool) => tool.type === 'function',
		);
		const tools = (includeTools && this.supportTools) ? AntigravityTransformer.toGeminiTools(filteredSchemas) : undefined;

		const payload: any = {
			project: projectId,
			model: this.model,
			userAgent: 'antigravity',
			requestId: `req-${crypto.randomUUID()}`,
			requestType: 'agent',
			request: {
				contents,
				tools,
				generationConfig: {
					maxOutputTokens: this.maxTokens,
				},
				...(systemInstruction ? { systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] } } : {}),
				sessionId: this.sessionId,
			},
		};

		const signatureSessionKey = this.buildSignatureSessionKey(
			this.sessionId,
			this.model,
			this.extractConversationKey(payload.request),
			projectId,
		);

		if (payload.request.contents) {
			payload.request.contents = this.filterUnsignedThinkingBlocks(
				payload.request.contents,
				signatureSessionKey,
				getCachedSignature,
			);
		}

		return payload as AntigravityRequestPayload;
	}

	/**
	 * Makes an Antigravity API call and returns an OpenAI-format stream reader.
	 */
	private async callAntigravity(
		messages: OpenAi.Chat.ChatCompletionMessageParam[],
	): Promise<ReadableStreamDefaultReader<Uint8Array>> {
		const payload = await this.buildPayload(messages, true);
		const response = await this.makeRequest(payload);

		if (!response.body) {
			throw new Error('No response body from Antigravity');
		}

		return this.transformStream(response.body);
	}

	override async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);
		const openAIMessages = convertGeminiHistoryToGPT(geminiHistory);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: getSystemPrompt('Antigravity', this.model, this.maxTokens) },
			...openAIMessages,
			{ role: 'user', content: requestPrompt },
		];

		const generateFn = (msgs: OpenAi.Chat.ChatCompletionMessageParam[]) => this.callAntigravity(msgs);

		const streamProcessor = new ChatCompletionsStreamProcessor();
		const executor = new AgentLoopExecutor(
			streamProcessor,
			generateFn,
			this.openai,
			this.model,
			this.maxTokens,
			requestPrompt,
			this.agentConfig,
			true,
		);

		const initialReader = await generateFn(messages);
		const reader = executor.execute(initialReader, messages);

		const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

		return { reader, onComplete, responseMap };
	}

	override async generateTextFromImage(
		userKey: string,
		quote: string = '',
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);
		const openAIMessages = convertGeminiHistoryToGPT(geminiHistory);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const urls = await Promise.all(photosUrl);
		const imageDescription = urls.map((url) => `[imagem: ${url}]`).join('\n');
		const fullPrompt = `${requestPrompt}\n\n${imageDescription}`;

		const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: getSystemPrompt('Antigravity', this.model, this.maxTokens) },
			...openAIMessages,
			{ role: 'user', content: fullPrompt },
		];

		const generateFn = (msgs: OpenAi.Chat.ChatCompletionMessageParam[]) => this.callAntigravity(msgs);

		const streamProcessor = new ChatCompletionsStreamProcessor();
		const executor = new AgentLoopExecutor(
			streamProcessor,
			generateFn,
			this.openai,
			this.model,
			this.maxTokens,
			requestPrompt,
			this.agentConfig,
			true,
		);

		const initialReader = await generateFn(messages);
		const reader = executor.execute(initialReader, messages);

		const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

		return { reader, onComplete, responseMap };
	}

	private extractThinkingTextFromPart(part: any): string | undefined {
		if (typeof part.text === 'string') return part.text;
		if (typeof part.thinking === 'string') return part.thinking;
		if (part.text && typeof part.text === 'object') {
			const maybeText = (part.text as any).text;
			if (typeof maybeText === 'string') return maybeText;
		}
		if (part.thinking && typeof part.thinking === 'object') {
			const maybeText = (part.thinking as any).text ?? (part.thinking as any).thinking;
			if (typeof maybeText === 'string') return maybeText;
		}
		return '';
	}

	private isOurCachedSignature(
		part: any,
		sessionId: string,
		getCachedSignatureFn: (sessionId: string, text: string) => string | undefined,
	): boolean {
		if (!sessionId || !getCachedSignatureFn) return false;

		const text = this.extractThinkingTextFromPart(part);
		if (!text) return false;

		const partSignature = this.getSignatureFromPart(part);
		if (!partSignature) return false;

		const cachedSignature = getCachedSignatureFn(sessionId, text);
		return cachedSignature === partSignature;
	}

	private getSignatureFromPart(part: any): string | undefined {
		const signature = part.thought === true ? part.thoughtSignature : part.signature;
		return typeof signature === 'string' ? signature : undefined;
	}

	private hasValidSignature(part: any): boolean {
		const signature = this.getSignatureFromPart(part);
		return typeof signature === 'string' && signature.length >= MIN_SIGNATURE_LENGTH;
	}

	private filterUnsignedThinkingBlocks(
		contents: any[],
		sessionId: string,
		getCachedSignatureFn: (sessionId: string, text: string) => string | undefined,
	): any[] {
		const lastAssistantIdx = this.findLastAssistantIndex(contents, 'model');

		return contents.map((content: any, idx: number) => {
			if (!content || typeof content !== 'object') return content;

			const isLastAssistant = idx === lastAssistantIdx;

			if (Array.isArray(content.parts)) {
				const filteredParts = this.filterContentArray(
					content.parts,
					sessionId,
					getCachedSignatureFn,
					isLastAssistant,
				);

				const trimmedParts = content.role === 'model' ? this.removeTrailingThinkingBlocks(filteredParts, sessionId, getCachedSignatureFn) : filteredParts;

				return { ...content, parts: trimmedParts };
			}

			if (Array.isArray(content.content)) {
				const isAssistantRole = content.role === 'assistant';
				const isLastAssistant = isAssistantRole && idx === lastAssistantIdx;

				const filteredContent = this.filterContentArray(
					content.content,
					sessionId,
					getCachedSignatureFn,
					isLastAssistant,
				);

				const trimmedContent = isAssistantRole ? this.removeTrailingThinkingBlocks(filteredContent, sessionId, getCachedSignatureFn) : filteredContent;

				return { ...content, content: trimmedContent };
			}

			return content;
		});
	}

	private filterContentArray(
		contentArray: any[],
		sessionId: string,
		getCachedSignatureFn: (sessionId: string, text: string) => string | undefined,
		isLastAssistantMessage: boolean = false,
	): any[] {
		const filtered: any[] = [];

		for (const item of contentArray) {
			if (!item || typeof item !== 'object') {
				filtered.push(item);
				continue;
			}

			if (this.isToolBlock(item)) {
				filtered.push(item);
				continue;
			}

			const isThinking = this.isThinkingPart(item);
			const hasSignature = this.hasSignatureField(item);

			if (!isThinking && !hasSignature) {
				filtered.push(item);
				continue;
			}

			if (isLastAssistantMessage && (isThinking || hasSignature)) {
				if (this.isOurCachedSignature(item, sessionId, getCachedSignatureFn)) {
					const sanitized = this.sanitizeThinkingPart(item);
					if (sanitized) filtered.push(sanitized);
					continue;
				}

				const thinkingText = this.extractThinkingTextFromPart(item) || '';
				const sentinelPart = {
					type: item.type || 'thinking',
					thinking: thinkingText,
					signature: SKIP_THOUGHT_SIGNATURE,
				};
				filtered.push(sentinelPart);
				continue;
			}

			if (this.isOurCachedSignature(item, sessionId, getCachedSignatureFn)) {
				const sanitized = this.sanitizeThinkingPart(item);
				if (sanitized) filtered.push(sanitized);
				continue;
			}

			if (sessionId && getCachedSignatureFn) {
				const text = this.extractThinkingTextFromPart(item);
				if (text) {
					const cachedSignature = getCachedSignatureFn(sessionId, text);
					if (cachedSignature && cachedSignature.length >= MIN_SIGNATURE_LENGTH) {
						const restoredPart = { ...item };
						if (item.thought === true) {
							restoredPart.thoughtSignature = cachedSignature;
						} else {
							restoredPart.signature = cachedSignature;
						}
						const sanitized = this.sanitizeThinkingPart(restoredPart);
						if (sanitized) filtered.push(sanitized);
						continue;
					}
				}
			}
		}

		return filtered;
	}

	private isToolBlock(part: any): boolean {
		return part.type === 'tool_use' ||
			part.type === 'tool_result' ||
			part.tool_use_id !== undefined ||
			part.tool_call_id !== undefined ||
			part.tool_result !== undefined ||
			part.tool_use !== undefined ||
			part.toolUse !== undefined ||
			part.functionCall !== undefined ||
			part.functionResponse !== undefined;
	}

	private isThinkingPart(part: any): boolean {
		return part.type === 'thinking' ||
			part.type === 'redacted_thinking' ||
			part.type === 'reasoning' ||
			part.thought !== undefined ||
			part.thought === true;
	}

	private hasSignatureField(part: any): boolean {
		return part.signature !== undefined || part.thoughtSignature !== undefined;
	}

	private removeTrailingThinkingBlocks(
		contentArray: any[],
		sessionId?: string,
		getCachedSignatureFn?: (sessionId: string, text: string) => string | undefined,
	): any[] {
		const result = [...contentArray];

		while (result.length > 0 && this.isThinkingPart(result[result.length - 1])) {
			const part = result[result.length - 1];
			const isValid = sessionId && getCachedSignatureFn ? this.isOurCachedSignature(part, sessionId, getCachedSignatureFn) : this.hasValidSignature(part);
			if (isValid) break;
			result.pop();
		}

		return result;
	}

	private sanitizeThinkingPart(part: any): any | null {
		if (part.thought === true) {
			let textContent: unknown = part.text;
			if (typeof textContent === 'object' && textContent !== null) {
				const maybeText = (textContent as any).text;
				textContent = typeof maybeText === 'string' ? maybeText : undefined;
			}

			const hasContent = typeof textContent === 'string' && textContent.trim().length > 0;
			if (!hasContent && !part.thoughtSignature) return null;

			const sanitized: any = { thought: true };
			if (textContent !== undefined) sanitized.text = textContent;
			if (part.thoughtSignature !== undefined) sanitized.thoughtSignature = part.thoughtSignature;
			return sanitized;
		}

		if (part.type === 'thinking' || part.type === 'redacted_thinking' || part.thinking !== undefined) {
			let thinkingContent: unknown = part.thinking ?? part.text;
			if (thinkingContent !== undefined && typeof thinkingContent === 'object' && thinkingContent !== null) {
				const maybeText = (thinkingContent as any).text ?? (thinkingContent as any).thinking;
				thinkingContent = typeof maybeText === 'string' ? maybeText : undefined;
			}

			const hasContent = typeof thinkingContent === 'string' && thinkingContent.trim().length > 0;
			if (!hasContent && !part.signature) return null;

			const sanitized: any = { type: part.type === 'redacted_thinking' ? 'redacted_thinking' : 'thinking' };
			if (thinkingContent !== undefined) sanitized.thinking = thinkingContent;
			if (part.signature !== undefined) sanitized.signature = part.signature;
			return sanitized;
		}

		return part;
	}

	private findLastAssistantIndex(contents: any[], roleValue: 'model' | 'assistant'): number {
		for (let i = contents.length - 1; i >= 0; i--) {
			const content = contents[i];
			if (content && typeof content === 'object' && content.role === roleValue) {
				return i;
			}
		}
		return -1;
	}

	private buildSignatureSessionKey(
		sessionId: string,
		model?: string,
		conversationKey?: string,
		projectKey?: string,
	): string {
		const modelKey = typeof model === 'string' && model.trim() ? model.toLowerCase() : 'unknown';
		const projectPart = typeof projectKey === 'string' && projectKey.trim() ? projectKey.trim() : 'default';
		const conversationPart = typeof conversationKey === 'string' && conversationKey.trim() ? conversationKey.trim() : 'default';
		return `${sessionId}:${modelKey}:${projectPart}:${conversationPart}`;
	}

	private extractConversationKey(payload: any): string | undefined {
		const anyPayload = payload as any;
		const candidates = [
			anyPayload.conversationId,
			anyPayload.conversation_id,
			anyPayload.thread_id,
			anyPayload.threadId,
			anyPayload.chat_id,
			anyPayload.chatId,
			anyPayload.sessionId,
			anyPayload.session_id,
		];

		for (const candidate of candidates) {
			if (typeof candidate === 'string' && candidate.trim()) {
				return candidate.trim();
			}
		}

		const systemText = typeof anyPayload.systemInstruction === 'string'
			? anyPayload.systemInstruction
			: typeof anyPayload.systemInstruction?.parts?.[0]?.text === 'string'
			? anyPayload.systemInstruction.parts[0].text
			: '';

		const messageSeed = Array.isArray(anyPayload.contents) ? this.extractTextFromContents(anyPayload.contents) : '';

		const seed = [systemText, messageSeed].filter(Boolean).join('|');
		if (!seed) return undefined;

		const hash = crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
		return `seed-${hash.slice(0, 16)}`;
	}

	private extractTextFromContents(contents: any[]): string {
		const users = contents.filter((content) => content?.role === 'user');
		const firstUser = users[0];
		const lastUser = users.length > 0 ? users[users.length - 1] : undefined;

		const extractText = (content: any): string => {
			if (typeof content === 'string') return content;
			if (!Array.isArray(content)) return '';
			for (const part of content) {
				if (!part || typeof part !== 'object') continue;
				if (typeof part.text === 'string') return part.text;
				if (part.text && typeof part.text === 'object' && typeof part.text.text === 'string') {
					return part.text.text;
				}
			}
			return '';
		};

		const primaryUser = firstUser && Array.isArray(firstUser.parts) ? extractText(firstUser.parts) : '';
		if (primaryUser) return primaryUser;

		if (lastUser && Array.isArray(lastUser.parts)) {
			return extractText(lastUser.parts);
		}

		return '';
	}

	private hasToolsInPayload(payload: any): boolean {
		return Array.isArray(payload.tools) && payload.tools.length > 0;
	}
}
