import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';
import { opencodeModels } from '@/config/models.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

const { freeModel } = opencodeModels;

/**
 * Service for OpenCode Zen free OpenAI-compatible endpoint.
 * The OpenCode Zen gateway accepts the `Authorization: Bearer ` header with
 * an empty token value, but an API key can be set via `OPENCODE_API_KEY`
 * for authenticated usage; when unset, the empty token keeps the free
 * behavior.
 */
export default class OpencodeService extends OpenAiService {
	public constructor(model: string = freeModel) {
		super(
			new OpenAi({
				apiKey: Deno.env.get('OPENCODE_API_KEY') ?? '',
				baseURL: 'https://opencode.ai/zen/v1',
			}),
			model,
		);
	}

	override generateTextFromImage(
		userKey: string,
		quote: string | undefined,
		photosUrl: Promise<string>[],
		prompt: string,
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
