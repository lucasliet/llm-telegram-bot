import VertexAiService from '@/service/openai/VertexAiService.ts';
import { createVisionHandler } from './HandlerUtils.ts';
import { geminiModels } from '@/config/models.ts';

const modelMap = {
	'geminipro': geminiModels.geminiPro,
	'gemini': geminiModels.geminiFlash,
};

/**
 * Handles requests for Vertex AI models
 */
export const handleVertex = createVisionHandler({
	modelMap,
	createService: (model) => new VertexAiService(model),
});
