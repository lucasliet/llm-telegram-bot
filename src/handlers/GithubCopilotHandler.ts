import GithubCopilotService from '@/service/openai/GithubCopilotService.ts';
import { createVisionHandler } from './HandlerUtils.ts';
import { copilotModels } from '@/config/models.ts';

const modelMap = {
	'geminipro': copilotModels.gemini,
	'gpt': copilotModels.gpt5mini,
	'o4mini': copilotModels.o4mini,
	'claude': copilotModels.claude,
};

/**
 * Handles requests for GitHub Copilot models
 */
export const handleGithubCopilot = createVisionHandler({
	modelMap,
	createService: (model) => new GithubCopilotService(model),
});
