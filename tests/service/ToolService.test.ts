import {
	assertEquals,
	assertExists,
	assertInstanceOf,
	assertNotEquals,
	assertThrows,
} from 'https://deno.land/std@0.210.0/assert/mod.ts';
import ToolService from '@/service/ToolService.ts';
import { z } from 'zod';
// 'ai' package might not be directly used in tests but good to have if testing related structures.
// import { tool } from 'ai';

Deno.test('ToolService.schemas should return valid OpenAI tool schemas', () => {
	const schemas = ToolService.schemas;

	assertExists(schemas);
	assertEquals(Array.isArray(schemas), true);
	assertNotEquals(schemas.length, 0, 'Schemas array should not be empty');

	schemas.forEach((schema) => {
		assertEquals(schema.type, 'function');
		assertExists(schema.function);
		assertEquals(typeof schema.function.name, 'string');
		assertExists(schema.function.description, `Description for ${schema.function.name} should exist`);
		assertEquals(typeof schema.function.description, 'string');
		assertExists(schema.function.parameters, `Parameters for ${schema.function.name} should exist`);
		assertEquals(typeof schema.function.parameters, 'object');
	});

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
	assertEquals(params.additionalProperties, false);
});

Deno.test('ToolService.getVercelAITools() should convert OpenAI schemas to Vercel AI SDK tools with Zod schemas', () => {
	const vercelTools = ToolService.getVercelAITools();

	assertExists(vercelTools);
	assertEquals(typeof vercelTools, 'object');
	assertNotEquals(Object.keys(vercelTools).length, 0, 'Vercel tools object should not be empty');

	// Test 'search_searx' tool
	const searchSearxTool = vercelTools['search_searx'];
	assertExists(searchSearxTool, 'search_searx tool not found in Vercel tools');

	const searchSearxOpenAISchema = ToolService.tools.get('search_searx')?.schema.function;
	assertExists(searchSearxOpenAISchema, 'OpenAI schema for search_searx not found');
	assertEquals(searchSearxTool.description, searchSearxOpenAISchema.description);
	assertEquals(typeof searchSearxTool.execute, 'function');
	assertEquals(searchSearxTool.execute, ToolService.tools.get('search_searx')?.fn);

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

	// Check for strictness (additionalProperties: false)
	const parseResultStrict = searchSearxZodSchema.safeParse({ query: 'test', num_results: 1, extraParam: 'unexpected' });
	assertEquals(parseResultStrict.success, false, 'Parsing with extra param should fail for strict schema');
	if (!parseResultStrict.success) {
		assertExists(parseResultStrict.error.issues.find(issue => issue.code === 'unrecognized_keys'));
	}
	const parseResultValid = searchSearxZodSchema.safeParse({ query: 'test', num_results: 1 });
	assertEquals(parseResultValid.success, true, 'Parsing with correct params should succeed');


	// Test 'fetch' tool
	const fetchTool = vercelTools['fetch'];
	assertExists(fetchTool, 'fetch tool not found in Vercel tools');
	const fetchOpenAISchema = ToolService.tools.get('fetch')?.schema.function;
	assertExists(fetchOpenAISchema);
	assertEquals(fetchTool.description, fetchOpenAISchema.description);
	assertEquals(typeof fetchTool.execute, 'function');

	const fetchZodSchema = fetchTool.parameters;
	assertInstanceOf(fetchZodSchema, z.ZodObject, 'fetch parameters should be a ZodObject');
	// deno-lint-ignore no-explicit-any
	const fetchShape = (fetchZodSchema as any).shape;
	assertExists(fetchShape.url);
	assertInstanceOf(fetchShape.url, z.ZodString, 'fetch url should be a ZodString');
	assertEquals(fetchShape.url.description, 'URL to fetch');
	const fetchParseResultStrict = fetchZodSchema.safeParse({ url: 'test.com', another: 'unexpected' });
	assertEquals(fetchParseResultStrict.success, false, 'Parsing fetch with extra param should fail');


	// Test 'transcript_yt' tool (for array and optional parameters)
	const transcriptYtTool = vercelTools['transcript_yt'];
	assertExists(transcriptYtTool, 'transcript_yt tool not found in Vercel tools');
	const transcriptYtOpenAISchema = ToolService.tools.get('transcript_yt')?.schema.function;
	assertExists(transcriptYtOpenAISchema);
	assertEquals(transcriptYtTool.description, transcriptYtOpenAISchema.description);

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
	
	// Test parsing transcript_yt
	let parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123' });
	assertEquals(parseResult.success, true, 'Parsing transcript_yt with only videoUrl should succeed');
	if (parseResult.success) assertEquals(parseResult.data.preferredLanguages, undefined);

	parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', preferredLanguages: ['en', 'pt'] });
	assertEquals(parseResult.success, true, 'Parsing transcript_yt with preferredLanguages should succeed');
	if (parseResult.success) assertEquals(parseResult.data.preferredLanguages, ['en', 'pt']);

	parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', preferredLanguages: 'en' });
	assertEquals(parseResult.success, false, 'Parsing transcript_yt with preferredLanguages as string should fail');
	
	parseResult = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', preferredLanguages: [123] });
	assertEquals(parseResult.success, false, 'Parsing transcript_yt with preferredLanguages as array of numbers should fail');

	const transcriptYtParseResultStrict = transcriptYtZodSchema.safeParse({ videoUrl: 'youtube.com/watch?v=123', extra: 'param' });
	assertEquals(transcriptYtParseResultStrict.success, false, 'Parsing transcript_yt with extra param should fail');
});
