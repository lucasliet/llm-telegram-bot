import GroqService from '@/service/openai/GroqService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';
import { groqModels } from '@/config/models.ts';

const modelMap = {
	'llama': groqModels.llama,
	'oss': groqModels.oss,
};

export const handleGroq = createTextOnlyHandler({
	modelMap,
	createService: (model) => new GroqService(model!),
});
