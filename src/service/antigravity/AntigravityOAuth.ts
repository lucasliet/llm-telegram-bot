import { ANTIGRAVITY_CLIENT_ID, ANTIGRAVITY_CLIENT_SECRET, ANTIGRAVITY_ENDPOINTS, type AntigravityConfig } from './AntigravityTypes.ts';

const ANTIGRAVITY_REFRESH_TOKEN = Deno.env.get('ANTIGRAVITY_REFRESH_TOKEN') as string;
const ANTIGRAVITY_PROJECT_ID = Deno.env.get('ANTIGRAVITY_PROJECT_ID') || '';

/**
 * Manages OAuth2 token lifecycle for Antigravity API access.
 * Caches access tokens in memory and auto-refreshes when expired.
 */
export class AntigravityTokenManager {
	private static instance: AntigravityTokenManager;
	private config: AntigravityConfig;

	private constructor() {
		this.config = {
			refreshToken: ANTIGRAVITY_REFRESH_TOKEN,
			accessToken: '',
			projectId: ANTIGRAVITY_PROJECT_ID,
			expiresAt: 0,
		};
	}

	static getInstance(): AntigravityTokenManager {
		if (!AntigravityTokenManager.instance) {
			AntigravityTokenManager.instance = new AntigravityTokenManager();
		}
		return AntigravityTokenManager.instance;
	}

	/**
	 * Returns a valid access token, refreshing if necessary.
	 */
	async getAccessToken(): Promise<string> {
		if (!this.config.refreshToken) {
			throw new Error('ANTIGRAVITY_REFRESH_TOKEN environment variable is not set.');
		}

		if (this.config.accessToken && this.config.expiresAt > Date.now()) {
			console.log('[Antigravity] Using cached access token');
			return this.config.accessToken;
		}

		console.log('[Antigravity] Refreshing access token...');
		const response = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: ANTIGRAVITY_CLIENT_ID,
				client_secret: ANTIGRAVITY_CLIENT_SECRET,
				refresh_token: this.config.refreshToken,
				grant_type: 'refresh_token',
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Antigravity token refresh failed: ${response.status} ${errorText}`);
		}

		const data = await response.json();
		this.config.accessToken = data.access_token;
		this.config.expiresAt = Date.now() + (data.expires_in * 1000) - 60000;

		return this.config.accessToken;
	}

	/**
	 * Returns the project ID, discovering it from the API if not configured.
	 */
	async getProjectId(): Promise<string> {
		if (this.config.projectId) {
			return this.config.projectId;
		}

		const accessToken = await this.getAccessToken();
		this.config.projectId = await this.discoverProjectId(accessToken);
		return this.config.projectId;
	}

	/**
	 * Discovers the Cloud AI Companion project ID by probing Antigravity endpoints.
	 */
	private async discoverProjectId(accessToken: string): Promise<string> {
		for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
			try {
				const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						metadata: {
							ideType: 'IDE_UNSPECIFIED',
							platform: 'PLATFORM_UNSPECIFIED',
							pluginType: 'GEMINI',
						},
					}),
				});

				if (response.ok) {
					const data = await response.json();
					if (data.cloudaicompanionProject) {
						const projectId = typeof data.cloudaicompanionProject === 'string' ? data.cloudaicompanionProject : data.cloudaicompanionProject.id;
						console.log(`[Antigravity] Discovered project ID: ${projectId}`);
						return projectId;
					}
				}
			} catch (error) {
				console.warn(`[Antigravity] Failed to load project from ${endpoint}:`, error);
			}
		}

		const fallback = 'rising-fact-p41fc';
		console.warn(`[Antigravity] Using fallback project ID: ${fallback}`);
		return fallback;
	}
}
