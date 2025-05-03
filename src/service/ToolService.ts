import OpenAi from 'npm:openai';
import { XMLParser } from "npm:fast-xml-parser";
import { parse } from "npm:node-html-parser";
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

export default class ToolService {
	/**
	 * Maps function schemas to their corresponding functions.
	 */
	// deno-lint-ignore ban-types
	static tools = new Map<string, { schema: OpenAi.ChatCompletionTool; fn: Function }>([
		['search_searx', {
			schema: {
				type: 'function',
				function: {
					name: 'search_searx',
					description: 'Search the web using SearxNG instances to get recent and relevant information',
					parameters: {
						type: 'object',
						properties: {
							query: { type: 'string', description: 'Search query' },
							num_results: { type: 'number', description: 'Number of results to return' },
						},
						required: ['query', 'num_results'],
						additionalProperties: false,
					},
					strict: true,
				},
			},
			/**
			 * Searches SearxNG instances for the given query and number of results.
			 *
			 * @param args - The search parameters.
			 * @param args.query - The search query string.
			 * @param args.num_results - The number of results to return.
			 * @returns A promise that resolves to an array of {@link SearxResult}.
			 * @throws An error if all SearxNG instances fail.
			 */
			fn: async (args: { query: string; num_results: number }): Promise<SearxResult[]> => {
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
		}],
		['fetch', {
			schema: {
				type: 'function',
				function: {
					name: 'fetch',
					description: 'Fetches a URL via HTTP GET and returns its content in response as text',
					parameters: {
						type: 'object',
						properties: {
							url: { type: 'string', description: 'URL to fetch' },
						},
						required: ['url'],
						additionalProperties: false,
					},
					strict: true,
				},
			},
			/**
			 * Fetches the given URL and returns the text response.
			 *
			 * @param args - The fetch parameters.
			 * @param args.url - The URL to fetch.
			 * @returns A promise that resolves to the response.
			 * @throws An error if the fetch fails or response is not ok.
			 */
			fn: async (args: { url: string }): Promise<string> => {
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
					const body = root.getElementsByTagName("body")[0];
					body.removeChild(body.getElementsByTagName("script")[0]);
					return body.children.map((child) => child.text.trim().replace(/\s+/g, ' ')).join(' ');;
				}
				return await response.text();
			},
		}],
		['transcript_yt', {
			schema: {
				type: 'function',
				function: {
					name: 'transcript_yt',
					description: 'Busca a transcrição de um vídeo do YouTube a partir de sua URL., pode ser utilizado para responder perguntas sobre qualquer vídeo com "youtube" na URL',
					parameters: {
						type: 'object',
						properties: {
							videoUrl: {
								type: 'string',
								description: 'A URL completa do vídeo do YouTube.',
							},
							preferredLanguages: {
								type: 'array',
								items: { type: 'string' },
								description: "Uma lista opcional de códigos de idioma preferenciais (ex: ['pt-BR', 'en']).",
							},
						},
						required: ['videoUrl'],
						additionalProperties: false,
					},
					strict: true,
				},
			},
			/**
			* Busca a transcrição de um vídeo do YouTube a partir de sua URL.
			* pode ser utilizado para responder perguntas sobre qualquer vídeo com "youtube" na URL'
			* @param args - Objeto contendo os parâmetros.
			* @param args.videoUrl - A URL completa do vídeo do YouTube.
			* @param args.preferredLanguages - (Opcional) Uma lista de códigos de idioma preferenciais (ex: ['pt-BR', 'en']).
			* @returns Uma promessa que resolve para um array de objetos de transcrição ou null se a transcrição não for encontrada ou ocorrer um erro.
			*/
			fn: async (args: { videoUrl: string; preferredLanguages?: string[] }): Promise<YouTubeTranscriptSegment[] | null> => {
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
				} catch {
					return null;
				}
			},
		}],
	]);

	static schemas: OpenAi.ChatCompletionTool[] = Array.from(ToolService.tools.values()).map((tool) => tool.schema);
}


