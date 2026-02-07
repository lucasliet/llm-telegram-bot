import AntigravityService from '@/service/openai/AntigravityService.ts';
import { createVisionHandler } from './HandlerUtils.ts';
import { antigravityModels } from '@/config/models.ts';

const modelMap = {
	'antigravity': antigravityModels.geminiFlash,
	'antigemini': antigravityModels.geminiFlash,
	'anticlaude': antigravityModels.claudeSonnet,
};

/**
 * Handles requests for Antigravity models (Gemini 3 Flash, Claude 4.5 Sonnet)
 */
export const handleAntigravity = createVisionHandler({
	modelMap,
	defaultCommand: 'antigravity',
	createService: (model) => new AntigravityService(model),
});
