import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { blackboxModels } from '@/config/models.ts';
import { createSession, getSession } from '@/repository/SessionRepository.ts';
import ToolUsageAdapter from '../adapter/ToolUsageAdapter.ts';
import OpenAI from 'npm:openai';

/**
 * Constants and configuration
 */
const { reasoningModelOnline, reasoningModel, gptOnline } = blackboxModels;
const BLACKBOX_MAX_TOKENS = 8000;

/**
 * Base request options for BlackboxAI API
 */
const REQUEST_OPTIONS = {
	method: 'POST',
	headers: {
		'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
		'Content-Type': 'application/json',
		'Origin': 'https://www.blackbox.ai',
	},
};

/**
 * BlackboxaiService - Provides text and image generation using BlackboxAI models
 */
export default {
	/**
	 * Generate text using a Blackbox AI model
	 *
	 * @param userKey - Key identifying the user in the repository
	 * @param quote - Optional quote text to include in the prompt
	 * @param prompt - The user's prompt text
	 * @param model - Model to use (defaults to textModel)
	 * @returns Stream reply response with reader and completion handler
	 */
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
		model = blackboxModels.reasoningModel,
		tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;
		const [modelId, modelName] = model.split('|');

		const messages: OpenAI.ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: getSystemPrompt(
					'BlackboxAI',
					modelName,
					BLACKBOX_MAX_TOKENS,
				),
			},
			...convertGeminiHistoryToGPT(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const messagesWithToolOptions = ToolUsageAdapter.modifyMessagesWithToolInfo(messages, { tools });

		const apiResponse = await fetchResponse(messagesWithToolOptions, model, modelId, modelName);

		if (!apiResponse.ok) {
			throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
		}

		const originalReader = apiResponse.body!.getReader();

		const reader = ToolUsageAdapter.processModelResponse(
			generateFollowupResponse,
			originalReader,
			messages,
			undefined,
			model,
			modelId,
			modelName
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

	/**
	 * Generate an image using Blackbox AI
	 *
	 * @param prompt - Text prompt describing the image to generate
	 * @returns URL of the generated image
	 */
	async generateImage(prompt: string): Promise<string> {
		const apiResponse = await fetch(`https://www.blackbox.ai/api/chat`, {
			...REQUEST_OPTIONS,
			body: JSON.stringify({
				messages: [
					{ role: 'user', content: prompt },
				],
				agentMode: {},
				imageGenerationMode: true,
				isPremium: true,
				validated: '00f37b34-a166-4efb-bce5-1312d87f2f94',
				session: await getOrCreateSession(),
			}),
		});

		if (!apiResponse.ok) {
			throw new Error(`Failed to generate image: ${apiResponse.statusText}`);
		}

		const markdown = await apiResponse.text();
		const imageUrlMatch = markdown.match(/\!\[.*\]\((.*)\)/);

		if (!imageUrlMatch || !imageUrlMatch[1]) {
			throw new Error('Failed to extract image URL from response: ' + markdown);
		}

		const imageUrl = imageUrlMatch[1];
		console.log('blackbox generated image: ', imageUrl);

		return imageUrl;
	},
};

async function fetchResponse(messages: OpenAI.ChatCompletionMessageParam[], model: string, modelId: string, modelName: string) {
	return fetch(`https://www.blackbox.ai/api/chat`, {
		...REQUEST_OPTIONS,
		body: JSON.stringify({
			messages,
			agentMode: gptOnline === model ? {} : {
				mode: true,
				id: modelId,
				name: modelName,
			},
			maxTokens: BLACKBOX_MAX_TOKENS,
			deepSearchMode: model === reasoningModelOnline,
			beastMode: model === reasoningModel || model === reasoningModelOnline,
			isPremium: true,
			webSearchModePrompt: model !== reasoningModel,
			trendingAgentMode: {},
			userSelectedModel: gptOnline === model ? null : modelName,
			validated: '00f37b34-a166-4efb-bce5-1312d87f2f94',
			session: await getOrCreateSession(),
		}),
	});
}

function generateFollowupResponse(
	messages: OpenAI.ChatCompletionMessageParam[],
	model: string,
	modelId: string,
	modelName: string,
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	return fetchResponse(messages, model, modelId, modelName)
		.then(r => r.body!.getReader())
		.then(reader => ToolUsageAdapter.mapResponse(reader, true))
}

const firstNames = [
	'Alice',
	'Bob',
	'Carol',
	'David',
	'Emma',
	'Frank',
	'Grace',
	'Henry',
	'Isabel',
	'John',
	'Kate',
	'Lucas',
	'Maria',
	'Nathan',
	'Olivia',
	'Paul',
	'Quinn',
	'Rachel',
	'Samuel',
	'Taylor',
	'Uma',
	'Victor',
	'Wendy',
	'Xavier',
	'Yara',
	'Zack',
];

const lastNames = [
	'Smith',
	'Johnson',
	'Williams',
	'Brown',
	'Jones',
	'Garcia',
	'Miller',
	'Davis',
	'Rodriguez',
	'Martinez',
	'Anderson',
	'Taylor',
	'Thomas',
	'Moore',
	'Jackson',
	'Martin',
	'Lee',
	'Thompson',
	'White',
	'Lopez',
	'Hill',
	'Scott',
	'Green',
	'Adams',
	'Baker',
	'Silva',
];

async function getOrCreateSession(): Promise<Session> {
	const cachedSession = await getSession();

	if (cachedSession) {
		return cachedSession;
	}

	const newSession = generateRandomSession();
	createSession(newSession);
	return newSession;
}

function generateRandomSession(): Session {
	const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
	const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
	const randomNum = Math.floor(Math.random() * 1000000);

	const randomValidExpireDate = new Date(Date.now() + Math.floor(Math.random() * (30 - 1 + 1) + 1) * 24 * 60 * 60 * 1000).toISOString();

	return {
		user: {
			name: `${firstName} ${lastName}`,
			email: `${firstName}-${lastName}${randomNum}@gmail.com`,
			image: generateRandomAvatarUrl(),
		},
		expires: randomValidExpireDate,
	};
}

function generateRandomAvatarUrl(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
	const length = 40;
	let result = '';

	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');

	return `https://lh3.googleusercontent.com/a/ACg8ocJ${result}=s${randomNumber}-c`;
}

export interface Session {
	user: {
		name: string;
		email: string;
		image: string;
	};
	expires: string;
}
