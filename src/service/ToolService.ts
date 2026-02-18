import OpenAi from 'npm:openai';
import { XMLParser } from 'npm:fast-xml-parser';
import { parse } from 'npm:node-html-parser';
import { mapChatToolsToResponsesTools } from '@/util/ChatConfigUtil.ts';
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
 * Represents a search result from Tavily.
 */
export interface TavilyResult {
	title: string;
	url: string;
	content: string;
	score: number;
	published_date?: string;
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
	static tools = new Map<
		string,
		{ schema: OpenAi.ChatCompletionTool; fn: Function }
	>([
		[
			'search_searx',
			{
				schema: {
					type: 'function',
					function: {
						name: 'search_searx',
						description: 'Search the web using SearxNG instances to get recent and relevant information',
						parameters: {
							type: 'object',
							properties: {
								query: { type: 'string', description: 'Search query' },
								num_results: {
									type: 'number',
									description: 'Number of results to return',
								},
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
				fn: async (args: {
					query: string;
					num_results: number;
				}): Promise<SearxResult[]> => {
					const { query, num_results } = args;

					const instances = [
						'https://search.lucasliet.com.br',
						'http://172.233.16.115:5387',
					];

					const headers = {
						'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
						'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
						Referer: 'https://www.google.com/',
						'Cache-Control': 'no-cache',
						Pragma: 'no-cache',
					};

					const buildUrl = (baseUrl: string) => `${baseUrl}/search?${new URLSearchParams({ q: query, format: 'json', language: 'pt-BR' }).toString()}`;

					const fetchJson = async (url: string) => {
						const res = await fetch(url, { headers });
						if (!res.ok) {
							throw new Error(`SearxNG search failed: ${res.statusText}`);
						}
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
			},
		],
		[
			'search_tavily',
			{
				schema: {
					type: 'function',
					function: {
						name: 'search_tavily',
						description:
							'Search the web using Tavily API to get recent and relevant information',
						parameters: {
							type: 'object',
							properties: {
								query: { type: 'string', description: 'Search query' },
								max_results: {
									type: 'number',
									description: 'Number of results to return (default 5)',
								},
							},
							required: ['query'],
							additionalProperties: false,
						},
						strict: true,
					},
				},
				/**
				 * Searches the web using Tavily API.
				 *
				 * @param args - The search parameters.
				 * @param args.query - The search query string.
				 * @param args.max_results - The number of results to return.
				 * @returns A promise that resolves to an array of {@link TavilyResult}.
				 */
				fn: async (args: {
					query: string;
					max_results?: number;
				}): Promise<TavilyResult[]> => {
					const apiKey = Deno.env.get('TAVILY_API_KEY');
					if (!apiKey) {
						throw new Error('TAVILY_API_KEY environment variable is not set');
					}
					const { query, max_results = 5 } = args;
					const response = await fetch('https://api.tavily.com/search', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							api_key: apiKey,
							query,
							max_results,
						}),
					});

					if (!response.ok) {
						throw new Error(`Tavily search failed: ${response.statusText}`);
					}

					const data = await response.json();
					return data.results;
				},
			},
		],
		[
			'fetch',
			{
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
						try {
							const body = root.getElementsByTagName('body')[0];
							return body.children
								.filter((child) => child.tagName !== 'script')
								.map((child) => child.text.trim().replace(/\s+/g, ' '))
								.join(' ');
						} catch {
							// Fallback to raw text if parsing fails
						}
					}
					return await response.text();
				},
			},
		],
		[
			'copilot_usage',
			{
				schema: {
					type: 'function',
					function: {
						name: 'copilot_usage',
						description: 'Checks GitHub Copilot usage associated with COPILOT_GITHUB_TOKEN environment variable and returns account usage info as JSON',
						parameters: {
							type: 'object',
							properties: {},
							additionalProperties: false,
						},
						strict: true,
					},
				},
				/**
				 * Checks GitHub Copilot usage associated with the COPILOT_GITHUB_TOKEN environment variable.
				 *
				 * @param _args - No arguments are expected for this function.
				 * @returns A promise that resolves to the Copilot usage information as a JSON object.
				 * @throws An error if the COPILOT_GITHUB_TOKEN environment variable is not set or if the API request fails.
				 */
				fn: async (_args: Record<PropertyKey, never>): Promise<any> => {
					const token = Deno.env.get('COPILOT_GITHUB_TOKEN');
					if (!token) {
						throw new Error(
							'COPILOT_GITHUB_TOKEN environment variable is not set',
						);
					}

					const url = 'https://api.github.com/copilot_internal/user';
					const headers: Record<string, string> = {
						Accept: 'application/json',
						Authorization: `token ${token}`,
						'Editor-Version': 'vscode/1.98.1',
						'Editor-Plugin-Version': 'copilot-chat/0.26.7',
						'User-Agent': 'GitHubCopilotChat/0.26.7',
						'X-Github-Api-Version': '2025-04-01',
					};

					const res = await fetch(url, { headers });
					const text = await res.text();
					if (!res.ok) {
						let body: any;
						try {
							body = JSON.parse(text);
						} catch {
							body = text;
						}
						throw new Error(
							`Copilot API error ${res.status}: ${JSON.stringify(body)}`,
						);
					}

					try {
						return JSON.parse(text);
					} catch {
						return text;
					}
				},
			},
		],
		[
			'transcript_yt',
			{
				schema: {
					type: 'function',
					function: {
						name: 'transcript_yt',
						description:
							'Busca a transcrição de um vídeo do YouTube a partir de sua URL., pode ser utilizado para responder perguntas sobre qualquer vídeo com "youtube" na URL',
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
				fn: async (args: {
					videoUrl: string;
					preferredLanguages?: string[];
				}): Promise<YouTubeTranscriptSegment[] | null> => {
					/**
					 * Extrai o ID do vídeo a partir de uma URL do YouTube.
					 * @param url URL do vídeo.
					 * @returns ID do vídeo ou null se não encontrado.
					 */
					const extractVideoId = (url: string): string | null => {
						const match = url.match(
							/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|live\/)|youtu\.be\/)([\w-]{11})/,
						);
						return match ? match[1] : null;
					};
					/**
					 * Faz GET e retorna o corpo como texto.
					 * @param url URL a buscar.
					 * @param headers Cabeçalhos opcionais.
					 * @returns Resposta em texto.
					 */
					const fetchText = async (
						url: string,
						headers: Record<string, string> = {},
					): Promise<string> => {
						const res = await fetch(url, { headers });
						if (!res.ok) throw new Error(res.statusText);
						return res.text();
					};
					/**
					 * Busca o HTML da página de watch e lida com consentimento quando necessário.
					 * @param videoId ID do vídeo.
					 * @returns HTML da página do vídeo.
					 */
					const fetchWatchHtml = async (videoId: string): Promise<string> => {
						const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
						let html = await fetchText(watchUrl, {
							'Accept-Language': 'en-US',
						});
						if (html.includes('action="https://consent.youtube.com/s"')) {
							const v = html.match(/name="v" value="(.*?)"/);
							if (!v) throw new Error('Consent cookie creation failed');
							html = await fetchText(watchUrl, {
								'Accept-Language': 'en-US',
								Cookie: `CONSENT=YES+${v[1]}`,
							});
							if (html.includes('action="https://consent.youtube.com/s"')) {
								throw new Error('Consent cookie invalid');
							}
						}
						return html;
					};
					/**
					 * Extrai a INNERTUBE_API_KEY do HTML.
					 * @param html HTML da página do vídeo.
					 * @returns Chave Innertube.
					 */
					const extractInnertubeApiKey = (html: string): string | null => {
						const m = html.match(
							/\"INNERTUBE_API_KEY\":\s*\"([a-zA-Z0-9_-]+)\"/,
						);
						return m ? m[1] : null;
					};
					/**
					 * Faz POST para o endpoint Innertube player e retorna o JSON.
					 * @param apiKey Chave Innertube extraída do HTML.
					 * @param videoId ID do vídeo.
					 * @returns JSON de resposta do player.
					 */
					const fetchInnertubePlayer = async (
						apiKey: string,
						videoId: string,
					): Promise<any> => {
						const url = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
						const res = await fetch(url, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'Accept-Language': 'en-US',
							},
							body: JSON.stringify({
								context: {
									client: { clientName: 'ANDROID', clientVersion: '20.10.38' },
								},
								videoId,
							}),
						});
						if (res.status === 429) throw new Error('IP blocked');
						if (!res.ok) {
							throw new Error(`YouTube request failed: ${res.status}`);
						}
						return res.json();
					};
					/**
					 * Valida o status de reproduzibilidade e lança erros descritivos.
					 * @param data Objeto playabilityStatus.
					 */
					const assertPlayability = (data: any): void => {
						const status = data?.status;
						if (!status || status === 'OK') return;
						const reason = data?.reason || '';
						if (status === 'LOGIN_REQUIRED') {
							if (reason.includes('not a bot')) {
								throw new Error('Request blocked');
							}
							if (reason.includes('inappropriate')) {
								throw new Error('Age restricted');
							}
						}
						if (status === 'ERROR' && reason.includes('unavailable')) {
							throw new Error('Video unavailable');
						}
						throw new Error(`Video unplayable: ${reason}`);
					};
					/**
					 * Seleciona a melhor faixa de legenda, priorizando manual sobre ASR e idiomas preferidos.
					 * @param tracks Lista de faixas.
					 * @param langs Idiomas preferidos.
					 * @returns URL da faixa e idioma selecionado.
					 */
					const chooseTrack = (
						tracks: any[],
						langs: string[] | undefined,
						defaultCaptionTrackIndex: number | undefined,
						defaultTranslationSourceTrackIndices: number[] | undefined,
					): { url: string; lang: string } | null => {
						const manual = tracks.filter((t) => t.kind !== 'asr' && t.baseUrl);
						const asr = tracks.filter((t) => t.kind === 'asr' && t.baseUrl);
						const scan = (list: any[]) => {
							for (const lang of langs || []) {
								const t = list.find(
									(x) =>
										x.languageCode === lang ||
										x.languageCode
											?.toLowerCase()
											.startsWith(lang.toLowerCase()),
								);
								if (t) return t;
							}
							return undefined;
						};
						const direct = scan(manual) || scan(asr);
						if (direct) {
							const baseUrl: string = String(direct.baseUrl).replace(
								'&fmt=srv3',
								'',
							);
							return { url: baseUrl, lang: direct.languageCode };
						}
						if (
							typeof defaultCaptionTrackIndex === 'number' &&
							tracks[defaultCaptionTrackIndex]?.baseUrl
						) {
							const t = tracks[defaultCaptionTrackIndex];
							return {
								url: String(t.baseUrl).replace('&fmt=srv3', ''),
								lang: t.languageCode,
							};
						}
						if (Array.isArray(defaultTranslationSourceTrackIndices)) {
							for (const idx of defaultTranslationSourceTrackIndices) {
								if (tracks[idx]?.baseUrl) {
									const t = tracks[idx];
									return {
										url: String(t.baseUrl).replace('&fmt=srv3', ''),
										lang: t.languageCode,
									};
								}
							}
						}
						if (manual[0]) {
							return {
								url: String(manual[0].baseUrl).replace('&fmt=srv3', ''),
								lang: manual[0].languageCode,
							};
						}
						if (asr[0]) {
							return {
								url: String(asr[0].baseUrl).replace('&fmt=srv3', ''),
								lang: asr[0].languageCode,
							};
						}
						return null;
					};
					/**
					 * Converte XML de legendas em segmentos. Suporta <transcript><text> e <timedtext><body><p>.
					 * @param xml Conteúdo XML.
					 * @returns Lista de segmentos normalizados em milissegundos.
					 */
					const parseSegments = (xml: string): YouTubeTranscriptSegment[] => {
						const parser = new XMLParser({
							ignoreAttributes: false,
							attributeNamePrefix: '@_',
							textNodeName: '#text',
							trimValues: false,
						});
						const doc = parser.parse(xml) || {};
						const transcriptTexts = doc?.transcript?.text || [];
						if (
							transcriptTexts &&
							(Array.isArray(transcriptTexts) ||
								transcriptTexts['@_start'] !== undefined)
						) {
							const items = Array.isArray(transcriptTexts) ? transcriptTexts : [transcriptTexts];
							return items.flatMap((n: any) => {
								const text = String(n['#text'] || '').trim();
								if (!text) return [];
								const startMs = Math.round(Number(n['@_start'] || 0) * 1000);
								const durMs = Math.round(Number(n['@_dur'] || 0) * 1000);
								return [{ text, startInMs: startMs, duration: durMs }];
							});
						}
						const body = doc?.timedtext?.body?.p || [];
						const items = Array.isArray(body) ? body : [body];
						return items.flatMap((p) => {
							const start = Number(p['@_t'] || 0);
							const duration = Number(p['@_d'] || 0);
							const texts = p.s ? (Array.isArray(p.s) ? p.s : [p.s]).map((s: any) => typeof s === 'string' ? s : s['#text'] || '') : [p['#text'] || ''];
							const text = texts.join('').trim();
							return text ? [{ text, startInMs: start, duration }] : [];
						});
					};
					try {
						const id = extractVideoId(args.videoUrl);
						if (!id) {
							console.error('Invalid YouTube URL');
							return null;
						}
						console.log(`Checking yt subtitles for video ID: ${id}`);
						const html = await fetchWatchHtml(id);
						const apiKey = extractInnertubeApiKey(html);
						if (!apiKey) {
							console.error('Failed to extract Innertube API key');
							return null;
						}
						const data = await fetchInnertubePlayer(apiKey, id);
						assertPlayability(data?.playabilityStatus);
						const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
							[];
						const audioTracks = data?.captions?.playerCaptionsTracklistRenderer?.audioTracks ||
							[];
						const defaultCaptionTrackIndex = typeof audioTracks?.[0]?.defaultCaptionTrackIndex === 'number'
							? audioTracks[0].defaultCaptionTrackIndex
							: undefined;
						const defaultTranslationSourceTrackIndices = data?.captions
							?.playerCaptionsTracklistRenderer
							?.defaultTranslationSourceTrackIndices as number[] | undefined;
						if (!Array.isArray(tracks) || tracks.length === 0) {
							console.error('No captions found');
							return null;
						}
						const picked = chooseTrack(
							tracks,
							args.preferredLanguages,
							defaultCaptionTrackIndex,
							defaultTranslationSourceTrackIndices,
						);
						if (!picked) {
							console.error('No suitable track found');
							return null;
						}
						const xml = await fetchText(picked.url, {
							'Accept-Language': 'en-US',
						});
						const segments = parseSegments(xml);
						if (!segments.length) {
							console.error('No segments found');
							return null;
						}
						return segments;
					} catch {
						return null;
					}
				},
			},
		],
		[
			'antigravity_quota',
			{
				schema: {
					type: 'function',
					function: {
						name: 'antigravity_quota',
						description: 'Fetch Antigravity available models and quota info',
						parameters: {
							type: 'object',
							properties: {
								project: {
									type: 'string',
									description: 'Optional project id',
								},
							},
							additionalProperties: false,
						},
					},
				},
				/**
				 * Fetches available Antigravity models and their quota information.
				 *
				 * @param args - Arguments for the tool.
				 * @param args.project - Optional project ID to fetch quota for.
				 * @returns A promise that resolves to an array of model quota information.
				 */
				fn: async (args: { project?: string }) => {
					const { AntigravityTokenManager } = await import(
						'./antigravity/AntigravityOAuth.ts'
					);
					const { ANTIGRAVITY_ENDPOINTS } = await import(
						'./antigravity/AntigravityTypes.ts'
					);

					const tm = AntigravityTokenManager.getInstance();
					const token = await tm.getAccessToken();
					const projectId = args?.project || (await tm.getProjectId());
					const endpoint = ANTIGRAVITY_ENDPOINTS[0];

					const res = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json',
							'User-Agent': 'antigravity',
						},
						body: JSON.stringify({ project: projectId }),
					});

					const json = await res.json();

					return Object.entries(json.models || {}).flatMap(
						([id, val]: any) => {
							if (!val?.displayName) return [];

							const raw = val?.quotaInfo?.remainingFraction;
							let remaining: number | null = null;

							if (typeof raw === 'number') {
								remaining = raw;
							} else if (typeof raw === 'string' && /^[0-9.]+$/.test(raw)) {
								remaining = Number(raw);
							}

							const resetTime = val?.quotaInfo?.resetTime ?? null;
							const resetsInSeconds = resetTime
								? Math.max(
									0,
									Math.floor((Date.parse(resetTime) - Date.now()) / 1000),
								)
								: null;

							return [{
								id,
								displayName: val.displayName,
								remainingFraction: remaining,
								resetTime,
								resetsInSeconds,
							}];
						},
					);
				},
			},
		],
	]);

	static schemas: OpenAi.ChatCompletionTool[] = Array.from(
		ToolService.tools.values(),
	).map((tool) => tool.schema);

	static responsesSchemas: OpenAi.Responses.Tool[] = mapChatToolsToResponsesTools(ToolService.schemas);
}
