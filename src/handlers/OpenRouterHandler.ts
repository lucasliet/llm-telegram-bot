import OpenrouterService from '@/service/openai/OpenrouterService.ts';
import { createVisionHandler } from './HandlerUtils.ts';

/**
 * Handles requests for OpenRouter models
 */
export const handleOpenRouter = createVisionHandler({
	createService: () => new OpenrouterService(),
});
