import ZaiService from '@/service/openai/ZaiService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';
import { zaiModels } from '@/config/models.ts';

const modelMap = {
  'zai': zaiModels.flash,
  'glm': zaiModels.standard,
  'glmflash': zaiModels.flash,
};

/**
 * Handles requests for Zai model (GLM-4.7 Flash)
 */
export const handleZai = createTextOnlyHandler({
  modelMap,
  defaultCommand: 'zai',
  createService: (model) => new ZaiService(model),
});
