import duckDuckGoService from '@/service/DuckDuckGoService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';

/**
 * Handles requests for DuckDuckGo models
 */
export const handleDuckDuckGo = createTextOnlyHandler({
	createService: () => duckDuckGoService,
});
