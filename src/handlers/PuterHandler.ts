import PuterService from '@/service/PuterService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';

/**
 * Handles requests for Puter's Claude models
 */
export const handlePuter = createTextOnlyHandler({
	createService: () => PuterService,
});
