import ZaiService from '@/service/openai/ZaiService.ts';
import { createVisionHandler } from './HandlerUtils.ts';
import { zaiModels } from '@/config/models.ts';

const modelMap = {
	'zai': zaiModels.flash,
	'glm': zaiModels.standard,
	'glmflash': zaiModels.flash,
};

/**
 * Handles requests for Zai models; image input is only accepted by the flash model
 */
export const handleZai = createVisionHandler({
	modelMap,
	defaultCommand: 'zai',
	visionModels: [zaiModels.flash],
	createService: (model) => new ZaiService(model),
});
