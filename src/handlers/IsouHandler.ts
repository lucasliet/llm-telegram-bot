import isouService from '@/service/IsouService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';

/**
 * Handles requests for Isou models
 */
export const handleIsou = createTextOnlyHandler({
	createService: () => isouService,
});
