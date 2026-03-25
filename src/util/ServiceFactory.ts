import { ModelCommand } from '@/config/models.ts';
import OpenAiService from '@/service/openai/OpenAIService.ts';
import PollinationsService from '@/service/PollinationsService.ts';
import VertexAiService from '@/service/openai/VertexAiService.ts';
import AntigravityService from '@/service/openai/AntigravityService.ts';
import GithubCopilotService from '@/service/openai/GithubCopilotService.ts';
import GroqService from '@/service/openai/GroqService.ts';
import ZaiService from '@/service/openai/ZaiService.ts';
import { geminiModels, antigravityModels, copilotModels, groqModels, zaiModels, pollinationsModels } from '@/config/models.ts';

type AnyService =
	| OpenAiService
	| PollinationsService
	| VertexAiService
	| AntigravityService
	| GithubCopilotService
	| GroqService
	| ZaiService;

export interface ServiceInfo {
	service: AnyService;
	model: string;
	maxTokens: number;
}

export function getServiceForCommand(command: ModelCommand): ServiceInfo {
	switch (command) {
		case '/polli':
			return {
				service: new PollinationsService(pollinationsModels.openai),
				model: pollinationsModels.openai,
				maxTokens: 8000,
			};

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

		case '/antigravity':
		case '/antigeminipro': {
			const model = command === '/antigeminipro' ? antigravityModels.geminiPro : antigravityModels.geminiFlash;
			return {
				service: new AntigravityService(model),
				model,
				maxTokens: 8192,
			};
		}

		case '/gpt':
			return {
				service: new GithubCopilotService(copilotModels.gpt5mini),
				model: copilotModels.gpt5mini,
				maxTokens: 128000,
			};

		case '/llama':
			return {
				service: new GroqService(groqModels.llama),
				model: groqModels.llama,
				maxTokens: 131072,
			};

		case '/oss':
			return {
				service: new GroqService(groqModels.oss),
				model: groqModels.oss,
				maxTokens: 131072,
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
				service: new GroqService(groqModels.llama),
				model: groqModels.llama,
				maxTokens: 131072,
			};
	}
}
