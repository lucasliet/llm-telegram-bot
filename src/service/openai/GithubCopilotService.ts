import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

const COPILOT_GITHUB_TOKEN = Deno.env.get('COPILOT_GITHUB_TOKEN') as string;

interface CopilotTokenCache {
	token: string;
	expiresAt: number;
}

class TokenManager {
	private static instance: TokenManager;
	private cache: CopilotTokenCache | null = null;

	private constructor() {}

	static getInstance(): TokenManager {
		if (!TokenManager.instance) {
			TokenManager.instance = new TokenManager();
		}
		return TokenManager.instance;
	}

	async getToken(githubToken: string): Promise<string> {
		if (!githubToken) {
			throw new Error('GitHub token is required');
		}
		if (this.isTokenValid()) {
			console.log('Using cached Copilot token');
			return this.cache!.token;
		}

		return await this.fetchNewToken(githubToken);
	}

	private isTokenValid(): boolean {
		if (this.cache === null) {
			return false;
		}
		return Date.now() < this.cache.expiresAt;
	}

	private async fetchNewToken(githubToken: string): Promise<string> {
		console.log('Fetching new Copilot token');
		const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
			method: 'GET',
			headers: this.buildAuthHeaders(githubToken),
		});

		if (!response.ok) {
			this.cache = null;
			throw new Error(`Failed to get Copilot token: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (!data?.token) {
			this.cache = null;
			throw new Error('Copilot API response does not contain a valid token');
		}

		if (data.expires_at) {
			const expiresAt = data.expires_at * 1000;
			const now = Date.now();
			const expiresInSeconds = Math.floor((expiresAt - now) / 1000);
			console.log(`Token expires in ${expiresInSeconds} seconds`);
			this.cache = {
				token: data.token,
				expiresAt: expiresAt,
			};
		} else {
			console.log('No expiration info, token will not be cached');
			this.cache = null;
		}

		return data.token;
	}

	private buildAuthHeaders(githubToken: string): Record<string, string> {
		return {
			'Authorization': `token ${githubToken}`,
			'Editor-Version': 'vscode/1.95.0',
			'User-Agent': 'GitHubCopilotChat/0.22.4',
			'Accept': 'application/json',
		};
	}
}

export default class GithubCopilotService extends OpenAiService {
	public constructor(model: string = 'gpt-5-mini') {
		super(
			new OpenAi({
				apiKey: COPILOT_GITHUB_TOKEN,
				baseURL: 'https://api.githubcopilot.com',
				defaultHeaders: {
					'Copilot-Vision-Request': 'true',
					'Editor-Version': 'vscode/1.95.0',
				},
			}),
			model,
		);
	}

	private async ensureAuthenticated(): Promise<void> {
		try {
			const tokenManager = TokenManager.getInstance();
			const copilotToken = await tokenManager.getToken(COPILOT_GITHUB_TOKEN);
			this.openai = new OpenAi({
				apiKey: copilotToken,
				baseURL: 'https://api.individual.githubcopilot.com',
				defaultHeaders: {
					'Copilot-Vision-Request': 'true',
					'Editor-Version': 'vscode/1.95.0',
				},
			});
		} catch (error) {
			console.warn('Failed to authenticate with GitHub Copilot, using fallback token:', error);
		}
	}

	override async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		await this.ensureAuthenticated();
		return super.generateText(userKey, quote, prompt);
	}

	override async generateTextFromImage(
		userKey: string,
		quote: string | undefined,
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse> {
		await this.ensureAuthenticated();
		return super.generateTextFromImage(
			userKey,
			quote,
			photosUrl,
			prompt,
			true,
		);
	}
}
