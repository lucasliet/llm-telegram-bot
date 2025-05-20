import {
	assertEquals,
	assertExists,
	assertInstanceOf,
	assertNotEquals,
} from 'https://deno.land/std@0.210.0/assert/mod.ts';
import ToolService from '@/service/ToolService.ts';
import { z } from 'npm:zod';

Deno.test('ToolService.schemas should return valid OpenAI tool schemas', async (t) => {
	const schemas = ToolService.schemas;

	await t.step('should exist and be an array', () => {
		assertExists(schemas);
		assertEquals(Array.isArray(schemas), true);
		assertNotEquals(schemas.length, 0, 'Schemas array should not be empty');
	});

	await t.step('each schema should have correct basic structure', () => {
		schemas.forEach((schema) => {
			assertEquals(schema.type, 'function');
			assertExists(schema.function);
			assertEquals(typeof schema.function.name, 'string');
			assertExists(schema.function.description, `Description for ${schema.function.name} should exist`);
			assertEquals(typeof schema.function.description, 'string');
			assertExists(schema.function.parameters, `Parameters for ${schema.function.name} should exist`);
			assertEquals(typeof schema.function.parameters, 'object');
		});
	});

	await t.step('search_searx schema should be correctly defined', () => {
		const searchSearxSchema = schemas.find(s => s.function.name === 'search_searx');
		assertExists(searchSearxSchema, 'search_searx schema not found');
		assertEquals(searchSearxSchema.function.name, 'search_searx');
		assertEquals(searchSearxSchema.function.description, 'Search the web using SearxNG instances to get recent and relevant information');
		assertExists(searchSearxSchema.function.parameters);
		// deno-lint-ignore no-explicit-any
		const params = searchSearxSchema.function.parameters as any;
		assertEquals(params.type, 'object');
		assertExists(params.properties);
		assertExists(params.properties.query);
		assertEquals(params.properties.query.type, 'string');
		assertEquals(params.properties.query.description, 'Search query');
		assertExists(params.properties.num_results);
		assertEquals(params.properties.num_results.type, 'number');
		assertEquals(params.properties.num_results.description, 'Number of results to return');
		assertExists(params.required);
		assertEquals(params.required.includes('query'), true);
		assertEquals(params.required.includes('num_results'), true);
		assertEquals(params.additionalProperties, false, 'search_searx schema should not allow additional properties');
	});

	await t.step('fetch schema should be correctly defined', () => {
		const fetchSchema = schemas.find(s => s.function.name === 'fetch');
		assertExists(fetchSchema, 'fetch schema not found');
		assertEquals(fetchSchema.function.name, 'fetch');
		assertEquals(fetchSchema.function.description, 'Fetches a URL via HTTP GET and returns its content in response as text');
		assertExists(fetchSchema.function.parameters);
		// deno-lint-ignore no-explicit-any
		const params = fetchSchema.function.parameters as any;
		assertEquals(params.type, 'object');
		assertExists(params.properties);
		assertExists(params.properties.url);
		assertEquals(params.properties.url.type, 'string');
		assertEquals(params.properties.url.description, 'URL to fetch');
		assertExists(params.required);
		assertEquals(params.required.includes('url'), true);
		assertEquals(params.additionalProperties, false, 'fetch schema should not allow additional properties');
	});

	await t.step('transcript_yt schema should be correctly defined', () => {
		const transcriptYtSchema = schemas.find(s => s.function.name === 'transcript_yt');
		assertExists(transcriptYtSchema, 'transcript_yt schema not found');
		assertEquals(transcriptYtSchema.function.name, 'transcript_yt');
		assertEquals(transcriptYtSchema.function.description, 'Busca a transcrição de um vídeo do YouTube a partir de sua URL., pode ser utilizado para responder perguntas sobre qualquer vídeo com "youtube" na URL');
		assertExists(transcriptYtSchema.function.parameters);
		// deno-lint-ignore no-explicit-any
		const params = transcriptYtSchema.function.parameters as any;
		assertEquals(params.type, 'object');
		assertExists(params.properties);
		assertExists(params.properties.videoUrl);
		assertEquals(params.properties.videoUrl.type, 'string');
		assertEquals(params.properties.videoUrl.description, 'A URL completa do vídeo do YouTube.');
		assertExists(params.properties.preferredLanguages);
		assertEquals(params.properties.preferredLanguages.type, 'array');
		assertEquals(params.properties.preferredLanguages.description, "Uma lista opcional de códigos de idioma preferenciais (ex: ['pt-BR', 'en']).");
		assertExists(params.properties.preferredLanguages.items);
		assertEquals(params.properties.preferredLanguages.items.type, 'string');
		assertExists(params.required);
		assertEquals(params.required.includes('videoUrl'), true);
		assertEquals(params.additionalProperties, false, 'transcript_yt schema should not allow additional properties');
	});
});

Deno.test('ToolService.vercelSchemas should convert Zod schemas to Vercel AI SDK tools', async (t) => {
	const vercelTools = ToolService.vercelSchemas;

	await t.step('should return a non-empty object of tools', () => {
		assertExists(vercelTools);
		assertEquals(typeof vercelTools, 'object');
		assertNotEquals(Object.keys(vercelTools).length, 0, 'Vercel tools object should not be empty');
	});

	await t.step('search_searx tool should be correctly converted', async (t) => {
		const searchSearxTool = vercelTools['search_searx'];
		assertExists(searchSearxTool, 'search_searx tool not found in Vercel tools');

		const searchSearxToolEntry = ToolService.tools.get('search_searx');
		assertExists(searchSearxToolEntry, 'Tool entry for search_searx not found');
		assertEquals(searchSearxTool.description, searchSearxToolEntry.description);
		assertEquals(typeof searchSearxTool.execute, 'function');
		assertEquals(searchSearxTool.execute, searchSearxToolEntry.fn);

		const searchSearxZodSchema = searchSearxTool.parameters;
		assertInstanceOf(searchSearxZodSchema, z.ZodObject, 'search_searx parameters should be a ZodObject');

		// deno-lint-ignore no-explicit-any
		const searchSearxShape = (searchSearxZodSchema as any).shape;
		assertExists(searchSearxShape.query);
		assertInstanceOf(searchSearxShape.query, z.ZodString, 'search_searx query should be a ZodString');
		assertEquals(searchSearxShape.query.description, 'Search query');

		assertExists(searchSearxShape.num_results);
		assertInstanceOf(searchSearxShape.num_results, z.ZodNumber, 'search_searx num_results should be a ZodNumber');
		assertEquals(searchSearxShape.num_results.description, 'Number of results to return');

		await t.step('should check for strictness (additionalProperties: false)', () => {
			const parseResultStrict = searchSearxZodSchema.safeParse({ query: 'test', num_results: 1, extraParam: 'unexpected' });
			assertEquals(parseResultStrict.success, false, 'Parsing with extra param should fail for strict schema');
			if (!parseResultStrict.success) {
				assertExists(parseResultStrict.error.issues.find(issue => issue.code === 'unrecognized_keys'));
			}
			const parseResultValid = searchSearxZodSchema.safeParse({ query: 'test', num_results: 1 });
			assertEquals(parseResultValid.success, true, 'Parsing with correct params should succeed');
		});
	});


	await t.step('fetch tool should be correctly converted', () => {
		const fetchTool = vercelTools['fetch'];
		assertExists(fetchTool, 'fetch tool not found in Vercel tools');
		const fetchToolEntry = ToolService.tools.get('fetch');
		assertExists(fetchToolEntry);
		assertEquals(fetchTool.description, fetchToolEntry.description);
		assertEquals(typeof fetchTool.execute, 'function');
		assertEquals(fetchTool.execute, fetchToolEntry.fn);

		const fetchZodSchema = fetchTool.parameters;
		assertInstanceOf(fetchZodSchema, z.ZodObject, 'fetch parameters should be a ZodObject');
		// deno-lint-ignore no-explicit-any
		const fetchShape = (fetchZodSchema as any).shape;
		assertExists(fetchShape.url);
		assertInstanceOf(fetchShape.url, z.ZodString, 'fetch url should be a ZodString');
		assertEquals(fetchShape.url.description, 'URL to fetch');
		const fetchParseResultStrict = fetchZodSchema.safeParse({ url: 'test.com', another: 'unexpected' });
		assertEquals(fetchParseResultStrict.success, false, 'Parsing fetch with extra param should fail');
	});


	await t.step('transcript_yt tool should be correctly converted (array and optional parameters)', async (t) => {
		const transcriptYtTool = vercelTools['transcript_yt'];
		assertExists(transcriptYtTool, 'transcript_yt tool not found in Vercel tools');
		const transcriptYtToolEntry = ToolService.tools.get('transcript_yt');
		assertExists(transcriptYtToolEntry);
		assertEquals(transcriptYtTool.description, transcriptYtToolEntry.description);
		assertEquals(typeof transcriptYtTool.execute, 'function');
		assertEquals(transcriptYtTool.execute, transcriptYtToolEntry.fn);

		const transcriptYtZodSchema = transcriptYtTool.parameters;
		assertInstanceOf(transcriptYtZodSchema, z.ZodObject, 'transcript_yt parameters should be a ZodObject');
		// deno-lint-ignore no-explicit-any
		const transcriptYtShape = (transcriptYtZodSchema as any).shape;

		assertExists(transcriptYtShape.videoUrl);
		assertInstanceOf(transcriptYtShape.videoUrl, z.ZodString, 'transcript_yt videoUrl should be a ZodString');
		assertEquals(transcriptYtShape.videoUrl.description, 'A URL completa do vídeo do YouTube.');

		assertExists(transcriptYtShape.preferredLanguages);
		assertInstanceOf(transcriptYtShape.preferredLanguages, z.ZodOptional, 'transcript_yt preferredLanguages should be ZodOptional');
		// deno-lint-ignore no-explicit-any
		const innerArraySchema = (transcriptYtShape.preferredLanguages as any)._def.innerType;
		assertInstanceOf(innerArraySchema, z.ZodArray, 'transcript_yt preferredLanguages inner type should be ZodArray');
		assertInstanceOf(innerArraySchema.element, z.ZodString, 'transcript_yt preferredLanguages array element should be ZodString');
		assertEquals(transcriptYtShape.preferredLanguages.description, "Uma lista opcional de códigos de idioma preferenciais (ex: ['pt-BR', 'en']).");

		await t.step('parsing transcript_yt with only videoUrl', () => {
			const parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123' });
			assertEquals(parseResult.success, true, 'Parsing transcript_yt with only videoUrl should succeed');
			if (parseResult.success) {
				const data = parseResult.data as { preferredLanguages?: string[] };
				assertEquals(data.preferredLanguages, undefined);
			}
		});

		await t.step('parsing transcript_yt with preferredLanguages', () => {
			const parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', preferredLanguages: ['en', 'pt'] });
			assertEquals(parseResult.success, true, 'Parsing transcript_yt with preferredLanguages should succeed');
			if (parseResult.success) {
				const data = parseResult.data as { preferredLanguages?: string[] };
				assertEquals(data.preferredLanguages, ['en', 'pt']);
			}
		});

		await t.step('parsing transcript_yt with preferredLanguages as string should fail', () => {
			const parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', preferredLanguages: 'en' });
			assertEquals(parseResult.success, false, 'Parsing transcript_yt with preferredLanguages as string should fail');
		});
		
		await t.step('parsing transcript_yt with preferredLanguages as array of numbers should fail', () => {
			const parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', preferredLanguages: [123] });
			assertEquals(parseResult.success, false, 'Parsing transcript_yt with preferredLanguages as array of numbers should fail');
		});

		await t.step('parsing transcript_yt with extra param should fail', () => {
			const transcriptYtParseResultStrict = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', extra: 'param' });
			assertEquals(transcriptYtParseResultStrict.success, false, 'Parsing transcript_yt with extra param should fail');
		});
	});
});
