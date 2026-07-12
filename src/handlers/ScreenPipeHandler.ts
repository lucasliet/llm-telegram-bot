import ScreenPipeService from '@/service/openai/ScreenPipeService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';
import { screenpipeModels } from '@/config/models.ts';

const modelMap = {
	'screenpipe': screenpipeModels.auto,
	'auto': screenpipeModels.auto,
	'claude-haiku': screenpipeModels.claudeHaiku,
	'gemini-flash': screenpipeModels.geminiFlash,
	'gemini3-flash': screenpipeModels.gemini3Flash,
	'gemini31-flash-lite': screenpipeModels.gemini31FlashLite,
	'gemini35-flash': screenpipeModels.gemini35Flash,
	'glm47': screenpipeModels.glm47,
	'glm5': screenpipeModels.glm5,
	'kimi-k25': screenpipeModels.kimiK25,
	'qwen-flash': screenpipeModels.qwenFlash,
	'llama-scout': screenpipeModels.llamaScout,
};

/**
 * Handles requests for ScreenPipe free models
 */
export const handleScreenPipe = createTextOnlyHandler({
	modelMap,
	defaultCommand: 'screenpipe',
	createService: (model) => new ScreenPipeService(model),
});
