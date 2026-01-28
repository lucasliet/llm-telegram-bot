import CodexService from '@/service/CodexService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';

/**
 * Handles requests for Codex models
 */
export const handleCodex = createTextOnlyHandler({
	createService: () => CodexService,
});
