import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';
import { StreamReplyResponse } from '../../util/ChatConfigUtil.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') as string;

export default class GeminiService extends OpenAiService {
	public constructor(model: string = 'gemini-2.5-flash') {
		super(
			new OpenAi({
				apiKey: GEMINI_API_KEY,
				baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
			}),
			model,
		);
	}

	override generateTextFromImage(userKey: string,
		quote: string | undefined,
		photosUrl: Promise<string>[],
		prompt: string
	): Promise<StreamReplyResponse> {
		return super.generateTextFromImage(
			userKey,
			quote,
			photosUrl,
			prompt,
			true,
		);
	}
}