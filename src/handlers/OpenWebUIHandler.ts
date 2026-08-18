import OpenWebUIService from '@/service/openai/OpenWebUIService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';

/**
 * Handles requests for OpenWebUI models
 */
export const handleOpenWebUI = createTextOnlyHandler({
	createService: () => new OpenWebUIService(),
});
