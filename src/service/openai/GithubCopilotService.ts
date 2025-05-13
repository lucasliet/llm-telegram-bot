import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

const COPILOT_TOKEN: string = Deno.env.get('COPILOT_TOKEN') as string;

export default class GithubCopilotService extends OpenAiService {
	public constructor(model: string = 'o4-mini') {
		super(
			new OpenAi({
				apiKey: COPILOT_TOKEN,
				baseURL: 'https://api.githubcopilot.com',
				defaultHeaders: {
					'Copilot-Vision-Request': 'true',
				},
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