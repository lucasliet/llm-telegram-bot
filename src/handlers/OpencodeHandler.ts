import OpencodeService from '@/service/openai/OpencodeService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';
import { opencodeModels } from '@/config/models.ts';

const modelMap = {
	'opencode': opencodeModels.freeModel,
};

/**
 * Handles requests for OpenCode Zen free models
 */
export const handleOpencode = createTextOnlyHandler({
	modelMap,
	defaultCommand: 'opencode',
	createService: (model) => new OpencodeService(model),
});
