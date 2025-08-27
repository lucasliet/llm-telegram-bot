import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

const requestHeaders = {
	'Content-Type': 'application/json',
	'Accept': '*/*',
	'Accept-Language': 'en-US,en;q=0.5',
	'Referer': 'https://isou.chat/search',
	'Origin': 'https://isou.chat',
	'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
};

const defaultModel = 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B';

export default {
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
		model: string = defaultModel,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const payload = {
			stream: true,
			model,
			provider: 'siliconflow',
			mode: 'deep',
			language: 'all',
			categories: ['science'],
			engine: 'SEARXNG',
			locally: false,
			reload: false,
		};

		const query = encodeURIComponent(requestPrompt);
		const url = `https://isou.chat/api/search?q=${query}`;

		const response = await fetch(url, {
			method: 'POST',
			headers: requestHeaders,
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
	},
};

interface OuterData {
	data: string;
}
interface ContextInfo {
	name: string;
	url: string;
	id: number;
}
interface InnerData {
	content?: string;
	reasoningContent?: string;
	context?: ContextInfo;
}

function responseMap(responseBody: string): string {
	const lines = responseBody.split('\n');
	let result = '';

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('data:')) continue;

		const jsonPart = trimmed.replace(/^data:\s*/, '');

		let outer: OuterData;
		try {
			outer = JSON.parse(jsonPart);
		} catch {
			continue;
		}

		let inner: InnerData;
		try {
			inner = JSON.parse(outer.data);
		} catch {
			continue;
		}

		if (inner.context) {
			result += `${inner.context.id}. Name: ${inner.context.name}, Source: ${inner.context.url}\n`;
			continue;
		}

		if (inner.reasoningContent) {
			result += inner.reasoningContent;
			continue;
		}

		if (inner.content) {
			result += inner.content;
		}
	}

	return result;
}
