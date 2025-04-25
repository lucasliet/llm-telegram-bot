import OpenAi from 'npm:openai';

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

export default class ToolService {
	/**
	 * Maps function schemas to their corresponding functions.
	 */
	// deno-lint-ignore ban-types
	static tools = new Map<string, { schema: OpenAi.Chat.Completions.ChatCompletionTool; fn: Function }>([
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
			 * @returns A promise that resolves to an array of SearxResult.
			 * @throws An error if all SearxNG instances fail.
			 */
			fn: async (args: { query: string; num_results: number }): Promise<SearxResult[]> => {
				const { query, num_results } = args;

				const instances = [
					'http://172.233.16.115:5387',
				];

				const headers = {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
					'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
					'Referer': 'https://www.google.com/',
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache',
				};

				let lastError = null;

				for (const baseUrl of instances) {
					try {
						const params = new URLSearchParams({
							q: query,
							format: 'json',
							language: 'pt-BR',
						});

						const url = `${baseUrl}/search?${params.toString()}`;
						console.log(`Tentando busca em: ${baseUrl}`);

						const response = await fetch(url, { headers });

						if (!response.ok) {
							throw new Error(`SearxNG search failed: ${response.statusText}`);
						}

						const data = await response.json();

						console.log(`Busca bem-sucedida em: ${baseUrl}`);

						const results: SearxResult[] = (data.results || [])
							.slice(0, num_results)
							.map((result: SearxResult) => ({
								title: result.title,
								url: result.url,
								category: result.category,
								content: result.content,
								time: result.time,
							}));

						return results;
					} catch (error) {
						console.error(`Erro na instância ${baseUrl}:`, error);
						lastError = error;
					}
				}

				throw lastError || new Error('Todas as instâncias SearxNG falharam');
			},
		}],
	]);

	static schemas: OpenAi.Chat.Completions.ChatCompletionTool[] = Array.from(ToolService.tools.values()).map((tool) => tool.schema);
}
