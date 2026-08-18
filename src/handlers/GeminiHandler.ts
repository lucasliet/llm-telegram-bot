import GeminiService from '@/service/openai/GeminiService.ts';
import { createVisionHandler } from './HandlerUtils.ts';
import { geminiModels } from '@/config/models.ts';

const modelMap = {
	'gemini': geminiModels.geminiFlash,
};

/**
 * Handles requests for Google Gemini models
 */
export const handleGemini = createVisionHandler({
	modelMap,
	createService: (model) => new GeminiService(model),
});
