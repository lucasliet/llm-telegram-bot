import PerplexityService from '@/service/openai/PerplexityService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';

const modelMap = {
	'search': '/perplexity' as const,
	'perplexity': '/perplexity' as const,
	'reasonsearch': '/perplexityreasoning' as const,
	'perplexityreasoning': '/perplexityreasoning' as const,
};

/**
 * Handles requests for Perplexity models
 */
export const handlePerplexity = createTextOnlyHandler({
	modelMap,
	createService: (model) => new PerplexityService(model as '/perplexity' | '/perplexityreasoning'),
});
