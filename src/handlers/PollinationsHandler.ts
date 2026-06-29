import PollinationsService from '@/service/openai/PollinationsService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';
import { pollinationsModels } from '@/config/models.ts';

const modelMap = {
	'polli': pollinationsModels.default,
};

/**
 * Handles requests for Pollinations models
 */
export const handlePollinations = createTextOnlyHandler({
	modelMap,
	defaultCommand: 'polli',
	createService: (model) => new PollinationsService(model),
});
