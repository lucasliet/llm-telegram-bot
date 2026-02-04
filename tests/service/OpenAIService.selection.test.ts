import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { assertSpyCalls } from '../test_helpers.ts';
import OpenAiService from '../../src/service/openai/OpenAIService.ts';
import { MODELS_USING_RESPONSES_API } from '../../src/config/models.ts';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('OpenAIService selects Responses API for configured models', async (t) => {
	setupKvStub();
	const modelUsingResponses = MODELS_USING_RESPONSES_API[0];
	const userKey = 'test-user';
	const prompt = 'hello';

	// Mock for Responses API
	const mockResponsesCreate = spy(() =>
		Promise.resolve({
			toReadableStream: () =>
				new ReadableStream({
					start(controller) {
						controller.close();
					},
				}),
		})
	);

	// Mock for Chat Completions API
	const mockChatCreate = spy(() =>
		Promise.resolve({
			toReadableStream: () =>
				new ReadableStream({
					start(controller) {
						controller.close();
					},
				}),
		})
	);

	const mockOpenAi = {
		responses: {
			create: mockResponsesCreate,
		},
		chat: {
			completions: {
				create: mockChatCreate,
			},
		},
	} as any;

	await t.step('calls generateTextWithResponses (responses.create) when model is in list', async () => {
		const service = new OpenAiService(mockOpenAi, modelUsingResponses, false);

		await service.generateText(userKey, '', prompt);

		assertSpyCalls(mockResponsesCreate, 1);
		assertSpyCalls(mockChatCreate, 0);
	});

	await t.step('calls standard chat completions when model is NOT in list', async () => {
		const standardModel = 'gpt-5-mini'; // A model not in the responses list
		const service = new OpenAiService(mockOpenAi, standardModel, false);

		await service.generateText(userKey, '', prompt);

		assertSpyCalls(mockResponsesCreate, 1); // Previous call count
		assertSpyCalls(mockChatCreate, 1);
	});
});
