import OpencodeService from '@/service/openai/OpencodeService.ts';
import { createVisionHandler } from './HandlerUtils.ts';
import { opencodeModels } from '@/config/models.ts';

const modelMap = {
	'opencode': opencodeModels.mimo,
	'spark': opencodeModels.museSpark,
};

/**
 * Handles requests for OpenCode Go paid models
 */
export const handleOpencode = createVisionHandler({
	modelMap,
	defaultCommand: 'opencode',
	createService: (model) => new OpencodeService(model),
});
