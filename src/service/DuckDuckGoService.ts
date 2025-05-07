import { addContentToChatHistory, ExpirableContent, getChatHistory, getVqdHeader, setVqdHeader } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import OpenAi, { OpenAI } from 'npm:openai';

import { duckduckgoModels } from '@/config/models.ts';
import ToolUsageAdapter from '../adapter/ToolUsageAdapter.ts';
import ToolService from './ToolService.ts';

const { o3mini } = duckduckgoModels;

const maxTokens = 8000;

const requestHeaders = {
	'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
	Accept: 'text/event-stream',
	'Accept-Language': 'pt-BR',
	'Accept-Encoding': 'gzip, deflate, br, zstd',
	'Content-Type': 'application/json',
	Origin: 'https://duckduckgo.com',
};

export default {
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
		model: string = o3mini,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const vqdHeader = await getVqdHeader() || await _fetchVqdHeader();

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const messages: OpenAI.ChatCompletionMessageParam[] = [
			{
				role: 'user',
				content: `your system prompt: ${getSystemPrompt('DuckDuckGo', model, maxTokens)}`,
			},
			..._convertChatHistoryToDuckDuckGo(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const messagesWithToolOptions = ToolUsageAdapter.modifyMessagesWithToolInfo(messages, { tools: ToolService.schemas });

		const apiResponse = await fetchResponse(messagesWithToolOptions, model, vqdHeader);

		if (!apiResponse.ok) {
			throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
		}

		const originalReader = apiResponse.body!.getReader();

		const reader = ToolUsageAdapter.processModelResponse(
			generateFollowupResponse,
			originalReader,
			messages,
			responseMap,
			model,
			vqdHeader,
		);

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				geminiHistory,
				quote,
				requestPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete };
	},
};

function fetchResponse(messages: OpenAI.ChatCompletionMessageParam[], model: string, vqdHeader: string) {
	return fetch('https://duckduckgo.com/duckchat/v1/chat', {
		method: 'POST',
		headers: {
			...requestHeaders,
			'x-vqd-4': vqdHeader,
		},
		body: JSON.stringify({
			messages,
			model,
		}),
	});
}

function generateFollowupResponse(
	messages: OpenAI.ChatCompletionMessageParam[],
	model: string,
	vqdHeader: string,
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	const cleanMessages = cleanNonUserRoles(messages);
	return fetchResponse(cleanMessages, model, vqdHeader)
		.then((r) => r.body!.getReader())
		.then((reader) => ToolUsageAdapter.mapResponse(reader, true, responseMap));
}

async function _fetchVqdHeader(): Promise<string> {
	const statusResponse = await fetch(
		'https://duckduckgo.com/duckchat/v1/status',
		{
			method: 'GET',
			headers: {
				...requestHeaders,
				'x-vqd-accept': '1',
			},
		},
	);

	if (!statusResponse.ok) {
		throw new Error(`Failed to check status: ${statusResponse.statusText}`);
	}

	const header = statusResponse.headers.get('x-vqd-4');

	if (!header) {
		throw new Error('Failed to fetch duckduckgo x-vqd-4 header');
	}

	setVqdHeader(header);

	return header;
}

function _convertChatHistoryToDuckDuckGo(
	geminiHistory: ExpirableContent[],
): OpenAi.Chat.Completions.ChatCompletionMessageParam[] {
	return convertGeminiHistoryToGPT(geminiHistory).map((history) => (
		{
			content: `${history.role === 'assistant' ? 'your last answer, assistant:' + history.content : history.content}`,
			role: 'user',
		}
	));
}

function responseMap(responseBody: string): string {
	const lines = responseBody.split('\n');
	let result = '';

	for (const line of lines) {
		if (line.startsWith('data: ')) {
			try {
				result += JSON.parse(line.split('data: ')[1])?.message || '';
			} catch {
				continue;
			}
		}
	}

	return result;
}

function cleanNonUserRoles(messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[]): OpenAi.Chat.Completions.ChatCompletionMessageParam[] {
	return messages.map((msg) => {
		const originalRole = msg.role;
		const originalContent = msg.content;
		let newContent = originalContent;

		if (originalRole !== 'user' && typeof originalContent === 'string') {
			newContent = `${originalRole}: ${originalContent}`;
		}

		return {
			role: 'user',
			content: newContent,
		} as OpenAi.Chat.Completions.ChatCompletionMessageParam;
	});
}
