import { PhindService } from '@/service/PhindService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';

/**
 * Handles requests for Phind models
 */
export const handlePhind = createTextOnlyHandler({
	createService: () => new PhindService(),
});
