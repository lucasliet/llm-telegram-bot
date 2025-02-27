import {
	addContentToChatHistory,
	getChatHistory,
} from '../repository/ChatRepository.ts';
import {
	convertGeminiHistoryToGPT,
	replaceGeminiConfigFromTone,
	StreamReplyResponse,
} from '../util/ChatConfigUtil.ts';

const PUTER_TOKEN = Deno.env.get('PUTER_TOKEN') as string;

const requestHeaders = {
	'User-Agent':
		'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
	'Accept': '*/*',
	'Accept-Language': 'pt-BR',
	'Accept-Encoding': 'gzip, deflate, br, zstd',
	'Content-Type': 'application/json;charset=UTF-8',
	'Origin': 'https://docs.puter.com',
	'Authorization': `Bearer ${PUTER_TOKEN} `,
};

export default {
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
		model: string = 'claude-3-5-sonnet-latest',
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const apiResponse = await fetch('https://api.puter.com/drivers/call', {
			method: 'POST',
			headers: {
				...requestHeaders,
			},
			body: JSON.stringify({
				interface: 'puter-chat-completion',
				driver: 'claude',
				test_mode: false,
				method: 'complete',
				args: {
					messages: [
						{
							role: 'system',
							content: replaceGeminiConfigFromTone('Claude', model, 8000),
						},
						...convertGeminiHistoryToGPT(geminiHistory),
						{ role: 'user', content: requestPrompt },
					],
					model,
					stream: true,
				},
			}),
		});

		if (!apiResponse.ok) {
			throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
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
};

function responseMap(responseBody: string): string {
	const cleanJson = responseBody.substring(responseBody.indexOf('{'));
	return JSON.parse(cleanJson).text || '';
}
