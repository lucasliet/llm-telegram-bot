import {
	addContentToChatHistory,
	getChatHistory,
} from '../repository/ChatRepository.ts';
import {
	convertGeminiHistoryToGPT,
	replaceGeminiConfigFromTone,
	StreamReplyResponse,
} from '../util/ChatConfigUtil.ts';
import { blackboxModels } from '../config/models.ts';

/**
 * Constants and configuration
 */
const { reasoningModel } = blackboxModels;
const BLACKBOX_MAX_TOKENS = 8000;

/**
 * Base request options for BlackboxAI API
 */
const REQUEST_OPTIONS = {
	method: 'POST',
	headers: {
		'User-Agent':
			'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
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
		model = blackboxModels.textModel,
	): Promise<StreamReplyResponse> {
		// Get chat history
		const geminiHistory = await getChatHistory(userKey);

		// Parse model information
		const [modelId, modelName] = model.split('|');

		// Format the request prompt with quote if available
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		// Call the BlackboxAI API
		const apiResponse = await fetch(`https://www.blackbox.ai/api/chat`, {
			...REQUEST_OPTIONS,
			body: JSON.stringify({
				messages: [
					// Add system prompt with appropriate tone
					{
						role: 'system',
						content: replaceGeminiConfigFromTone(
							'BlackboxAI',
							modelName,
							BLACKBOX_MAX_TOKENS,
						),
					},
					// Add chat history
					...convertGeminiHistoryToGPT(geminiHistory),
					// Add current user message
					{ role: 'user', content: requestPrompt },
				],
				// Model configuration
				agentMode: {
					mode: true,
					id: modelId,
					name: modelName,
				},
				maxTokens: BLACKBOX_MAX_TOKENS,
				deepSearchMode: model === reasoningModel,
				isPremium: true,
				webSearchModePrompt: true,
				trendingAgentMode: {},
				validated: '00f37b34-a166-4efb-bce5-1312d87f2f94',
			}),
		});

		// Handle error response
		if (!apiResponse.ok) {
			throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
		}

		// Get the reader for streaming response
		const reader = apiResponse.body!.getReader();

		// Define completion handler to save chat history
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
		// Call the image generation API
		const apiResponse = await fetch(
			`https://api.blackbox.ai/api/image-generator`,
			{
				...REQUEST_OPTIONS,
				body: JSON.stringify({
					query: prompt,
				}),
			},
		);

		// Handle error response
		if (!apiResponse.ok) {
			throw new Error(`Failed to generate image: ${apiResponse.statusText}`);
		}

		// Parse the response and extract the image URL
		const { markdown } = await apiResponse.json();
		const imageUrlMatch = markdown.match(/\!\[.*\]\((.*)\)/);

		if (!imageUrlMatch || !imageUrlMatch[1]) {
			throw new Error('Failed to extract image URL from response');
		}

		const imageUrl = imageUrlMatch[1];
		console.log('blackbox generated image: ', imageUrl);

		return imageUrl;
	},
};
