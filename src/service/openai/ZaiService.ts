import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

const getZhipuApiKey = () => Deno.env.get('ZHIPU_API_KEY') as string;

export default class ZaiService extends OpenAiService {
	public constructor(model = 'glm-5.3-flash') {
		super(
			new OpenAi({
				apiKey: getZhipuApiKey(),
				baseURL: 'https://api.z.ai/api/coding/paas/v4',
			}),
			model,
		);
	}

	/**
	 * Sends the image as base64 because the Z.ai API cannot download Telegram file URLs
	 */
	override generateTextFromImage(
		userKey: string,
		quote: string | undefined,
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse> {
		return super.generateTextFromImage(userKey, quote, photosUrl, prompt, true);
	}
}
