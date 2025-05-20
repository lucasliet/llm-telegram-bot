import OpenAi from 'npm:openai';
import { XMLParser } from "npm:fast-xml-parser";
import { z, ZodFirstPartyTypeKind, type ZodTypeAny, type ZodObject } from 'npm:zod';
import { tool, type Tool as VercelSdkTool } from 'npm:ai';
import { parse } from 'npm:node-html-parser';
/**
 * Represents a search result from SearxNG.
 */
export interface SearxResult {
	title: string;
	url: string;
	category: string;
	content: string;
	time: string;
}

/**
	* Represents a segment of a YouTube transcript.
	*/
interface YouTubeTranscriptSegment {
	text: string;
	startInMs: number;
	duration: number;
}

const searchSearxParams = z.object({
	query: z.string().describe('Search query'),
	num_results: z.number().describe('Number of results to return'),
}).strict();

const fetchParams = z.object({
	url: z.string().describe('URL to fetch'),
}).strict();

const transcriptYtParams = z.object({
	videoUrl: z.string().describe('A URL completa do vídeo do YouTube.'),
	preferredLanguages: z.array(z.string()).optional().describe("Uma lista opcional de códigos de idioma preferenciais (ex: ['pt-BR', 'en'])."),
}).strict();

export default class ToolService {
	/**
	 * Defines the Zod schema, description, and function for the 'search_searx' tool.
	 * This tool searches the web using SearxNG.
	 */
	static readonly searchSearxTool = {
		description: 'Search the web using SearxNG instances to get recent and relevant information',
		zodSchema: searchSearxParams,
		/**
		 * Searches SearxNG instances for the given query and number of results.
		 *
		 * @param args - The search parameters, matching the Zod schema.
		 * @returns A promise that resolves to an array of {@link SearxResult}.
		 * @throws An error if all SearxNG instances fail.
		 */
		fn: async (args: z.infer<typeof searchSearxParams>): Promise<SearxResult[]> => {
			const { query, num_results } = args;

			const instances = [
				'https://search.lucasliet.com.br',
				'http://172.233.16.115:5387',
			];

			const headers = {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
				'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
				'Referer': 'https://www.google.com/',
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache',
			};

			const buildUrl = (baseUrl: string) =>
				`${baseUrl}/search?${new URLSearchParams({ q: query, format: 'json', language: 'pt-BR' }).toString()}`;

			const fetchJson = async (url: string) => {
				const res = await fetch(url, { headers });
				if (!res.ok) throw new Error(`SearxNG search failed: ${res.statusText}`);
				return res.json();
			};

			let lastError = null;

			for (const baseUrl of instances) {
				try {
					console.log(`Fetching from SearxNG instance: ${baseUrl}`);
					const data = await fetchJson(buildUrl(baseUrl));

					const results: SearxResult[] = (data.results || [])
						.slice(0, num_results)
						.map((result: SearxResult) => ({
							title: result.title,
							url: result.url,
							category: result.category,
							content: result.content,
							time: result.time,
						}));

					console.log(`Fetched ${results.length} results from ${baseUrl}`);

					return results;
				} catch (error) {
					console.error(`Erro na instância ${baseUrl}:`, error);
					lastError = error;
				}
			}

			throw lastError || new Error('Todas as instâncias SearxNG falharam');
		},
	};

	/**
	 * Defines the Zod schema, description, and function for the 'fetch' tool.
	 * This tool fetches content from a URL.
	 */
	static readonly fetchTool = {
		description: 'Fetches a URL via HTTP GET and returns its content in response as text',
		zodSchema: fetchParams,
		/**
		 * Fetches the given URL and returns the text response.
		 *
		 * @param args - The fetch parameters, matching the Zod schema.
		 * @returns A promise that resolves to the response text.
		 * @throws An error if the fetch fails or response is not ok.
		 */
		fn: async (args: z.infer<typeof fetchParams>): Promise<string> => {
			const { url } = args;
			console.log(`Fetching URL: ${url}`);
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Fetch failed: ${response.statusText}`);
			}
			console.log('Fetch successful');
			const contentType = response.headers.get('content-type') || '';
			if (contentType.includes('text/html')) {
				const html = await response.text();
				const root = parse(html);
				try {
					const body = root.getElementsByTagName("body")[0];
					return body.childNodes.filter((child) => child.nodeType === 1 && (child as any).tagName !== 'SCRIPT')
						.map((child) => child.text.trim().replace(/\s+/g, ' ')).join(' ');
				} catch {
					// Fallback to raw text if parsing fails
				}
			}
			return await response.text();
		},
	};

	/**
	 * Defines the Zod schema, description, and function for the 'transcript_yt' tool.
	 * This tool fetches the transcript of a YouTube video.
	 */
	static readonly transcriptYtTool = {
		description: 'Busca a transcrição de um vídeo do YouTube a partir de sua URL., pode ser utilizado para responder perguntas sobre qualquer vídeo com "youtube" na URL',
		zodSchema: transcriptYtParams,
		/**
		* Busca a transcrição de um vídeo do YouTube a partir de sua URL.
		*
		* @param args - Objeto contendo os parâmetros, matching the Zod schema.
		* @returns Uma promessa que resolve para um array de objetos de transcrição ou null se a transcrição não for encontrada ou ocorrer um erro.
		*/
		fn: async (args: z.infer<typeof transcriptYtParams>): Promise<YouTubeTranscriptSegment[] | null> => {
			const extractVideoId = (url: string): string | null => {
				const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
				return match ? match[1] : null;
			};
			const fetchText = async (url: string, headers: Record<string, string> = {}): Promise<string> => {
				const res = await fetch(url, { headers });
				if (!res.ok) throw new Error(res.statusText);
				return res.text();
			};
			const parsePlayerResponse = (html: string): any => {
				const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
				return jsonMatch ? JSON.parse(jsonMatch[1]) : null;
			};
			const chooseTrack = (tracks: any[], langs?: string[]): { url: string; lang: string } | null => {
				for (const lang of langs || []) {
					const t = tracks.find(t => t.languageCode.startsWith(lang) && t.baseUrl);
					if (t) return { url: `${t.baseUrl}&fmt=srv3`, lang: t.languageCode };
				}
				const first = tracks[0];
				return first?.baseUrl ? { url: `${first.baseUrl}&fmt=srv3`, lang: first.languageCode } : null;
			};
			const parseSegments = (xml: string): YouTubeTranscriptSegment[] => {
				const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false });
				const body = parser.parse(xml)?.timedtext?.body?.p || [];
				const items = Array.isArray(body) ? body : [body];
				return items.flatMap(p => {
					const start = Number(p['@_t'] || 0);
					const duration = Number(p['@_d'] || 0);
					const texts = p.s ? (Array.isArray(p.s) ? p.s : [p.s]).map((s: any) => typeof s === 'string' ? s : s['#text'] || '') : [p['#text'] || ''];
					return texts.join('').trim() ? [{ text: texts.join('').trim(), startInMs: start, duration }] : [];
				});
			};
			try {
				const id = extractVideoId(args.videoUrl);
				if (!id) {
					console.error('Invalid YouTube URL');
					return null;
				};
				console.log(`Fetching video ID: ${id}`);
				const html = await fetchText(args.videoUrl, { 'Accept-Language': 'en-US,en;q=0.9' });
				const player = parsePlayerResponse(html);
				const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
				if (!tracks.length) {
					console.error('No captions found');
					return null;
				};
				const track = chooseTrack(tracks, args.preferredLanguages);
				if (!track) {
					console.error('No suitable track found');
					return null;
				};
				const xml = await fetchText(track.url);
				const segments = parseSegments(xml);
				if (!segments.length) {
					console.error('No segments found');
					return null;
				};
				return segments;
			} catch (error) {
        console.error('Error fetching YouTube transcript:', error);
				return null;
			}
		},
	};
	
	/**
	 * Maps tool names to their definitions, including Zod schema, description, and function.
	 */
	// deno-lint-ignore ban-types
	static tools = new Map<string, { description: string; zodSchema: ZodObject<any, any, any>; fn: Function }>([
		['search_searx', ToolService.searchSearxTool],
		['fetch', ToolService.fetchTool],
		['transcript_yt', ToolService.transcriptYtTool],
	]);

	/**
	 * Converts a Zod type to its JSON schema representation.
	 * @param zodType - The Zod type to convert.
	 * @returns The JSON schema representation.
	 */
	private static zodTypeToJsonSchema(zodType: ZodTypeAny): any {
		const def = zodType._def;
		const description = def.description;
		let schema: any = {};

		switch (def.typeName) {
			case ZodFirstPartyTypeKind.ZodString:
				schema.type = 'string';
				if (def.checks) {
					for (const check of def.checks) {
						if (check.kind === 'min') schema.minLength = check.value;
						if (check.kind === 'max') schema.maxLength = check.value;
						if (check.kind === 'regex') schema.pattern = check.regex.source;
					}
				}
				break;
			case ZodFirstPartyTypeKind.ZodNumber:
				schema.type = def.checks?.some((check: { kind: string; }) => check.kind === 'int') ? 'integer' : 'number';
				if (def.checks) {
					for (const check of def.checks) {
						if (check.kind === 'min') schema.minimum = check.value;
						if (check.kind === 'max') schema.maximum = check.value;
					}
				}
				break;
			case ZodFirstPartyTypeKind.ZodBoolean:
				schema.type = 'boolean';
				break;
			case ZodFirstPartyTypeKind.ZodArray:
				schema.type = 'array';
				schema.items = this.zodTypeToJsonSchema(def.type);
				if (def.minLength) schema.minItems = def.minLength.value;
				if (def.maxLength) schema.maxItems = def.maxLength.value;
				break;
			case ZodFirstPartyTypeKind.ZodObject: {
				schema.type = 'object';
				schema.properties = {};
				const requiredProps: string[] = [];
				const shape = def.shape();
				for (const key in shape) {
					const propType = shape[key];
					schema.properties[key] = this.zodTypeToJsonSchema(propType);
					if (!propType.isOptional()) {
						requiredProps.push(key);
					}
				}
				if (requiredProps.length > 0) {
					schema.required = requiredProps;
				}
				if (def.unknownKeys === 'strict') {
					schema.additionalProperties = false;
				} else if (def.unknownKeys === 'passthrough') {
					schema.additionalProperties = true; 
				}
				break;
			}
			case ZodFirstPartyTypeKind.ZodEnum:
				schema.type = 'string';
				schema.enum = def.values;
				break;
			case ZodFirstPartyTypeKind.ZodOptional:
			case ZodFirstPartyTypeKind.ZodNullable: {
				const innerSchema = this.zodTypeToJsonSchema(def.innerType);
				// Preserve the description from the Optional/Nullable type itself if the inner type doesn't have one.
				if (description && !innerSchema.description) {
					innerSchema.description = description;
				}
				return innerSchema;
			}
			case ZodFirstPartyTypeKind.ZodEffects: {
				const innerSchema = this.zodTypeToJsonSchema(def.schema); 
				// Preserve the description from the Effects type itself if the inner type doesn't have one.
				if (description && !innerSchema.description) {
					innerSchema.description = description;
				}
				return innerSchema;
			}
			case ZodFirstPartyTypeKind.ZodDefault: {
				schema = this.zodTypeToJsonSchema(def.innerType);
				schema.default = def.defaultValue();
				if (description && !schema.description) {
					schema.description = description;
				}
				break;
			}
			case ZodFirstPartyTypeKind.ZodAny:
			case ZodFirstPartyTypeKind.ZodUnknown:
				schema = {};
				break;
			default:
				console.warn(`Unsupported Zod type for JSON schema conversion: ${def.typeName}`);
				schema = {}; 
		}

		if (description) {
			schema.description = description;
		}
		return schema;
	}

	/**
	 * Converts a tool definition (Zod schema, description) to an OpenAI ChatCompletionTool.
	 * @param toolName - The name of the tool.
	 * @param toolDef - The tool definition object containing the Zod schema and description.
	 * @returns An OpenAI ChatCompletionTool.
	 */
	public static zodSchemaToOpenAI(
		toolName: string,
		toolDef: { description: string; zodSchema: ZodObject<any, any, any> }
	): OpenAi.ChatCompletionTool {
		const jsonSchemaParams = this.zodTypeToJsonSchema(toolDef.zodSchema);
		return {
			type: 'function',
			function: {
				name: toolName,
				description: toolDef.description,
				parameters: jsonSchemaParams,
			},
		};
	}
	
	/**
	 * Provides an array of OpenAI ChatCompletionTool schemas derived from the tools map.
	 */
	static get schemas(): OpenAi.ChatCompletionTool[] {
		const resultSchemas: OpenAi.ChatCompletionTool[] = [];
		for (const [name, toolDef] of this.tools) {
			resultSchemas.push(this.zodSchemaToOpenAI(name, toolDef));
		}
		return resultSchemas;
	}

	/**
	 * Converts internal tool definitions to Vercel AI compatible tool formats.
	 * 
	 * This method takes the tools stored in the internal tools Map and transforms them
	 * into the format expected by Vercel AI SDK.
	 * 
	 * @returns An object mapping tool names to
	 * their corresponding Vercel AI tool implementations.
	 */
	static get vercelSchemas(): Record<string, VercelSdkTool> {
		const vercelTools: Record<string, VercelSdkTool> = {};
		for (const [toolName, entry] of this.tools) {
			if (!entry.zodSchema || !entry.fn) {
				console.warn(`Skipping tool ${toolName} due to missing Zod schema or function.`);
				continue;
			}
			
			vercelTools[toolName] = tool({
				description: entry.description,
				parameters: entry.zodSchema,
				execute: entry.fn as any,
			});
		}
		return vercelTools;
	}
}


