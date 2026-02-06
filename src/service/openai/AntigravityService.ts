import OpenAi from 'npm:openai';
import OpenAiService, { responseMap } from './OpenAIService.ts';
import { AntigravityTokenManager } from '../antigravity/AntigravityOAuth.ts';
import { AntigravityTransformer } from '../antigravity/AntigravityTransformer.ts';
import { ANTIGRAVITY_ENDPOINTS, type AntigravityRequestPayload } from '../antigravity/AntigravityTypes.ts';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, type StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import ToolService from '@/service/ToolService.ts';
import { AgentLoopExecutor } from './agent/index.ts';
import { ChatCompletionsStreamProcessor } from './stream/index.ts';

export default class AntigravityService extends OpenAiService {
	private tokenManager: AntigravityTokenManager;
	private currentEndpointIndex = 0;
	private sessionId: string;

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
			'User-Agent': 'antigravity/windows/amd64 v2.163.0',
			'Client-Metadata': 'AntigravityClient::v2.163.0::TelegramBot',
			'X-Goog-Api-Client': 'gl-node/22 gdcl/8.5.0 gccl/8.5.0',
		};
	}

	/**
	 * Makes a streaming request to the Antigravity API with endpoint fallback.
	 */
	private async makeRequest(payload: AntigravityRequestPayload): Promise<Response> {
		const headers = await this.getHeaders();
		const endpoint = ANTIGRAVITY_ENDPOINTS[this.currentEndpointIndex];
		const url = `${endpoint}/v1internal:streamGenerateContent`;

		console.log(`[Antigravity] Calling ${url} with model ${payload.model}`);
		console.log(`[Antigravity] Payload:`, JSON.stringify(payload, null, 2));

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
		const parts = data.candidates?.[0]?.content?.parts;
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
				const chunk = JSON.stringify({
					choices: [{
						delta: {
							tool_calls: [{
								index: toolCallIndex,
								id: `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
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
		const { systemInstruction, contents } = AntigravityTransformer.toGeminiFormat(messages);
		const tools = (includeTools && this.supportTools) ? AntigravityTransformer.toGeminiTools(ToolService.schemas) : undefined;

		return {
			project: projectId,
			model: this.model,
			userAgent: 'antigravity',
			requestId: `req-${crypto.randomUUID()}`,
			request: {
				contents,
				tools,
				generationConfig: {
					temperature: 0.7,
					maxOutputTokens: this.maxTokens,
				},
				...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
				sessionId: this.sessionId,
			},
		};
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
}
