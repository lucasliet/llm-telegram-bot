import { ModelCommand, openRouterModels } from '@/config/models.ts';
import OpenAiService from '@/service/openai/OpenAIService.ts';
import VertexAiService from '@/service/openai/VertexAiService.ts';
import GithubCopilotService from '@/service/openai/GithubCopilotService.ts';
import ZaiService from '@/service/openai/ZaiService.ts';
import CloudFlareService from '@/service/openai/CloudFlareService.ts';
import { copilotModels, geminiModels, zaiModels } from '@/config/models.ts';
import OpenrouterService from '@/service/openai/OpenrouterService.ts';

type AnyService =
	| OpenAiService
	| VertexAiService
	| GithubCopilotService
	| CloudFlareService
	| ZaiService
	| OpenrouterService;

export interface ServiceInfo {
	service: AnyService;
	model: string;
	maxTokens: number;
}

export function getServiceForCommand(command: ModelCommand): ServiceInfo {
	switch (command) {
		case '/gemini':
			return {
				service: new VertexAiService(geminiModels.geminiFlash),
				model: geminiModels.geminiFlash,
				maxTokens: 1048576,
			};

		case '/geminiPro':
			return {
				service: new VertexAiService(geminiModels.geminiPro),
				model: geminiModels.geminiPro,
				maxTokens: 2097152,
			};

		case '/gpt':
			return {
				service: new GithubCopilotService(copilotModels.gpt5mini),
				model: copilotModels.gpt5mini,
				maxTokens: 128000,
			};

		case '/zai':
		case '/glmflash':
			return {
				service: new ZaiService(zaiModels.flash),
				model: zaiModels.flash,
				maxTokens: 128000,
			};

		case '/glm':
			return {
				service: new ZaiService(zaiModels.standard),
				model: zaiModels.standard,
				maxTokens: 128000,
			};

		default:
			return {
				service: new OpenrouterService(openRouterModels.freeModel),
				model: openRouterModels.freeModel,
				maxTokens: 128000,
			};
	}
}
