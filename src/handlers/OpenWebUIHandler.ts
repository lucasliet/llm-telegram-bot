import OpenWebUIService from '@/service/openai/OpenWebUIService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';
import { openWebUiModels } from '@/config/models.ts';

const modelMap = {
	'pgrok': openWebUiModels.grok,
	'pgpt': openWebUiModels.gpt5,
	'po3': openWebUiModels.o3,
	'pclaude': openWebUiModels.sonnetThinking,
};

/**
 * Handles requests for OpenWebUI models
 */
export const handleOpenWebUI = createTextOnlyHandler({
	modelMap,
	createService: (model) => new OpenWebUIService(model),
});
