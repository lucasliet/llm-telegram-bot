import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';
import { opencodeModels } from '@/config/models.ts';

const { freeModel } = opencodeModels;

/**
 * Service for OpenCode Zen free OpenAI-compatible endpoint.
 * The OpenCode Zen gateway does not require an API key: it accepts the
 * `Authorization: Bearer ` header with an empty token value, and rejects
 * any non-empty token. Since the OpenAI SDK always builds
 * `Authorization: Bearer ${apiKey}`, we pass an empty string to send the
 * only header the gateway accepts.
 */
export default class OpencodeService extends OpenAiService {
	public constructor(model: string = freeModel, supportTools = false) {
		super(
			new OpenAi({
				apiKey: '',
				baseURL: 'https://opencode.ai/zen/v1',
			}),
			model,
			supportTools,
		);
	}
}
