import OpenAi from 'openai';
import type { GeminiContent, GeminiContentPart } from './AntigravityTypes.ts';
import { SKIP_THOUGHT_SIGNATURE } from './AntigravityTypes.ts';
import { cleanJSONSchemaForAntigravity } from './AntigravitySchemaCleanup.ts';

/**
 * Transforms between OpenAI Chat Completions and Gemini/Antigravity formats.
 */
export class AntigravityTransformer {
	/**
	 * Converts OpenAI-format messages to Gemini content format.
	 * System messages are extracted separately (used as systemInstruction).
	 * @returns Object with systemInstruction text and converted contents array.
	 */
	static toGeminiFormat(
		messages: OpenAi.Chat.ChatCompletionMessageParam[],
		signatureMap?: Map<string, string>,
	): { systemInstruction?: string; contents: GeminiContent[] } {
		let systemInstruction: string | undefined;
		const contents: GeminiContent[] = [];
		const pendingCallIdsByName = new Map<string, string[]>();

		for (const msg of messages) {
			if (msg.role === 'system') {
				systemInstruction = typeof msg.content === 'string' ? msg.content : '';
				continue;
			}

			if (msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls) {
				const parts: GeminiContentPart[] = [];
				if (msg.content) {
					parts.push({ text: typeof msg.content === 'string' ? msg.content : '' });
				}
				for (const call of msg.tool_calls) {
					const toolCall = call as any;
					const callId = toolCall.id || `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
					const callName = toolCall.function?.name || String(call);
					const callArgs = toolCall.function?.arguments || '{}';

					const queue = pendingCallIdsByName.get(callName) || [];
					queue.push(callId);
					pendingCallIdsByName.set(callName, queue);

					const signature = signatureMap?.get(callId);
					parts.push({
						functionCall: {
							id: callId,
							name: callName,
							args: typeof callArgs === 'string' ? JSON.parse(callArgs) : callArgs,
						},
						thoughtSignature: signature || SKIP_THOUGHT_SIGNATURE,
					});
				}
				contents.push({ role: 'model', parts });
				continue;
			}

			if (msg.role === 'tool') {
				const toolName = (msg as any).name || 'unknown';
				const queue = pendingCallIdsByName.get(toolName);
				const matchedId = queue && queue.length > 0 ? queue.shift() : undefined;

				if (matchedId && queue) {
					pendingCallIdsByName.set(toolName, queue);
				}

				contents.push({
					role: 'user',
					parts: [{
						functionResponse: {
							id: matchedId || (msg as any).tool_call_id || 'unknown',
							name: toolName,
							response: { result: msg.content },
						},
					}],
				});
				continue;
			}

			const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
			const parts: GeminiContentPart[] = [];

			if (typeof msg.content === 'string') {
				parts.push({ text: msg.content });
			} else if (Array.isArray(msg.content)) {
				for (const item of msg.content) {
					if (item.type === 'text') {
						parts.push({ text: item.text });
					} else if (item.type === 'image_url') {
						const imageUrl = typeof item.image_url === 'string' ? item.image_url : item.image_url?.url || '';

						const match = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
						if (match) {
							parts.push({
								inlineData: {
									mimeType: match[1],
									data: match[2],
								},
							});
						}
					}
				}
			}

			contents.push({ role, parts });
		}

		return { systemInstruction, contents };
	}

	/**
	 * Converts OpenAI-format tool schemas to Gemini functionDeclarations format.
	 */
	static toGeminiTools(
		tools: OpenAi.Chat.Completions.ChatCompletionTool[],
		isClaudeModel: boolean = false,
	): Array<{ functionDeclarations: Array<{ name: string; description: string; parameters: Record<string, unknown> }> }> {
		const toolsArray = tools as any[];
		return [{
			functionDeclarations: toolsArray.map((tool) => {
				const toolName = tool.function?.name || String(tool);
				const toolDescription = tool.function?.description || '';
				const toolParams = tool.function?.parameters || {};
				const cleanedParams = isClaudeModel
					? cleanJSONSchemaForAntigravity(typeof toolParams === 'object' ? toolParams : {})
					: cleanJsonSchema(typeof toolParams === 'object' ? toolParams : {});
				return {
					name: toolName,
					description: toolDescription,
					parameters: cleanedParams,
				};
			}),
		}];
	}
}

/**
 * Removes JSON Schema properties not supported by Gemini API.
 */
function cleanJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
	const cleaned = { ...schema };
	const unsupportedKeys = [
		'minLength',
		'maxLength',
		'pattern',
		'format',
		'examples',
		'default',
		'strict',
		'$schema',
		'additionalProperties',
	];

	for (const key of unsupportedKeys) {
		delete cleaned[key];
	}

	if (cleaned.properties && typeof cleaned.properties === 'object') {
		const props = cleaned.properties as Record<string, Record<string, unknown>>;
		for (const propKey in props) {
			props[propKey] = cleanJsonSchema(props[propKey]);
		}
	}

	if (cleaned.items && typeof cleaned.items === 'object') {
		cleaned.items = cleanJsonSchema(cleaned.items as Record<string, unknown>);
	}

	return cleaned;
}
