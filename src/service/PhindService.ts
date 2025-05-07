import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

export class PhindService {
	private readonly headers = {
		'Content-Type': 'application/json',
		'Accept': '*/*',
		'Accept-Encoding': 'Identity',
		'User-Agent': '',
	};

	private readonly maxTokens = 8000;

	private readonly model: string;

	constructor(model: string = 'Phind-70B') {
		this.model = model;
	}

	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const payload = {
			additional_extension_context: '',
			allow_magic_buttons: true,
			is_vscode_extension: true,
			message_history: [
				{
					role: 'system',
					content: getSystemPrompt(
						'Phind',
						this.model,
						this.maxTokens,
					) + ' use @web_search sempre que precisar de informações atualizadas',
				},
				...convertGeminiHistoryToGPT(geminiHistory),
				{ role: 'user', content: requestPrompt },
			],
			requested_model: this.model,
			user_input: requestPrompt,
		};

		const response = await fetch('https://https.extension.phind.com/agent/', {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`Failed to generate text: ${response.statusText}`);
		}

		const reader = response.body!.getReader();

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				geminiHistory,
				quote,
				requestPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete, responseMap };
	}
}

function responseMap(responseBody: string): string {
	const lines = responseBody.split('\n');
	let result = '';

	for (const line of lines) {
		if (line.startsWith('data: ')) {
			try {
				result += JSON.parse(line.split('data: ')[1])?.choices?.[0]?.delta?.content ||
					'';
			} catch {
				continue;
			}
		}
	}

	return result.replace(/\\n/g, '\n');
}
