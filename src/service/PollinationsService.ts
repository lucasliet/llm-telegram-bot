import { addContentToChatHistory, ExpirableContent, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { OpenAI } from 'npm:openai';
import { pollinationsModels } from '@/config/models.ts';

const { openai } = pollinationsModels;

const maxTokens = 8000;

const requestHeaders = {
	'Content-Type': 'application/json',
};

export default {
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
		model: string = openai,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const messages: OpenAI.ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: getSystemPrompt('Pollinations', model, maxTokens),
			},
			..._convertChatHistoryToPollinations(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const apiResponse = await fetchResponse(messages, model);

		if (!apiResponse.ok) {
			const errorBody = await apiResponse.text().catch(() => '');
			throw new Error(`Failed to generate text: ${apiResponse.statusText} ${errorBody}`);
		}

		const reader = apiResponse.body!.getReader();

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				geminiHistory,
				quote,
				requestPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete, responseMap };
	},

	async generateImage(prompt: string): Promise<string> {
		const encodedPrompt = encodeURIComponent(prompt);
		const url =
			`https://image.pollinations.ai/prompt/${encodedPrompt}?width=720&height=1280&seed=${ 
				Math.floor(Math.random() * 1000000)
			}
&enhance=true&nologo=true&model=flux`;

		return url;
	},
};

function fetchResponse(messages: OpenAI.ChatCompletionMessageParam[], model: string) {
	return fetch('https://text.pollinations.ai/openai', {
		method: 'POST',
		headers: {
			...requestHeaders,
		},
		body: JSON.stringify({
			messages,
			model: model,
			stream: true,
		}),
	});
}

function _convertChatHistoryToPollinations(
	geminiHistory: ExpirableContent[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
	return convertGeminiHistoryToGPT(geminiHistory);
}

function responseMap(responseBody: string): string {
	const lines = responseBody.split('\n');
	let result = '';

	for (const line of lines) {
		if (line.startsWith('data: ')) {
			try {
				const content = JSON.parse(line.substring(6)).choices[0].delta.content;
				if (content) {
					result += content;
				}
			} catch {
				continue;
			}
		}
	}

	return result;
}
