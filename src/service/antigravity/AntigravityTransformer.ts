import OpenAi from 'npm:openai';
import type { GeminiContent, GeminiContentPart } from './AntigravityTypes.ts';

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
	): { systemInstruction?: string; contents: GeminiContent[] } {
		let systemInstruction: string | undefined;
		const contents: GeminiContent[] = [];

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
					parts.push({
						functionCall: {
							name: call.function.name,
							args: JSON.parse(call.function.arguments || '{}'),
						},
					});
				}
				contents.push({ role: 'model', parts });
				continue;
			}

			if (msg.role === 'tool') {
				contents.push({
					role: 'user',
					parts: [{
						functionResponse: {
							name: (msg as any).name || (msg as any).tool_call_id || 'unknown',
							response: { result: msg.content },
						},
					}],
				});
				continue;
			}

			const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
			const text = typeof msg.content === 'string' ? msg.content : '';
			contents.push({ role, parts: [{ text }] });
		}

		return { systemInstruction, contents };
	}

	/**
	 * Converts OpenAI-format tool schemas to Gemini functionDeclarations format.
	 */
	static toGeminiTools(
		tools: OpenAi.Chat.Completions.ChatCompletionTool[],
	): Array<{ functionDeclarations: Array<{ name: string; description: string; parameters: Record<string, unknown> }> }> {
		return [{
			functionDeclarations: tools.map((tool) => ({
				name: tool.function.name,
				description: tool.function.description || '',
				parameters: cleanJsonSchema(tool.function.parameters || {}),
			})),
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
