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

		const payload = {
			model,
			instructions: await getCodexInstructions(),
			input: messages,
			tools: [],
			tool_choice: 'auto',
			parallel_tool_calls: false,
			reasoning: { effort: 'minimal', summary: 'auto' },
			store: false,
			stream: true,
			include: ['reasoning.encrypted_content'],
		} as const;

		const response = await fetch('https://chatgpt.com/backend-api/codex/responses', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${CODEX_ACCESS_TOKEN}`,
				'chatgpt-account-id': CODEX_ACCOUNT_ID,
				'OpenAI-Beta': 'responses=experimental',
				'Content-Type': 'application/json',
				'Accept': 'text/event-stream',
				'originator': 'llm_telegram_bot',
				'User-Agent': 'llm_telegram_bot',
				'session_id': sessionId,
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok || !response.body) {
			const errorBody = await response.text().catch(() => '');
			throw new Error(`Failed to call Codex API: ${response.status} ${response.statusText} ${errorBody}`);
		}

		const reader = response.body.getReader();

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
 * Maps raw SSE chunk from Codex to plain text by extracting delta lines.
 * @param chunk - Raw SSE text chunk
 * @returns Concatenated delta text extracted from the chunk
 */
function responseMap(chunk: string): string {
	let output = '';
	try {
		const lines = chunk.split(/\r?\n/);
		let lastEvent = '';
		for (const raw of lines) {
			const line = raw.trimEnd();
			if (!line) {
				lastEvent = '';
				continue;
			}
			if (line.startsWith('event: ')) {
				lastEvent = line.slice(7).trim();
				continue;
			}
			if (line.startsWith('data: ')) {
				if (lastEvent === 'response.output_text.delta') {
					const data = line.slice(6).trim();
					try {
						const obj = JSON.parse(data);
						const delta = typeof obj?.delta === 'string' ? obj.delta : '';
						if (delta) output += delta;
					} catch {
						if (data && data !== 'null') output += data;
					}
				}
			}
		}
	} catch {
		return '';
	}
	return output;
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
