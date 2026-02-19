interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	interval: number;
}

interface TokenResponse {
	access_token?: string;
	error?: string;
	error_description?: string;
	interval?: number;
}

interface CopilotTokenResponse {
	token: string;
}

/**
 * Handles the GitHub Copilot Device Flow to obtain an access token.
 */
export class CopilotAuth {
	private readonly clientId = 'Iv23ctfURkiMfJ4xr5mv';
	private readonly scope = 'read:user';
	private readonly deviceCodeUrl = 'https://github.com/login/device/code';
	private readonly accessTokenUrl = 'https://github.com/login/oauth/access_token';
	private readonly copilotTokenUrl = 'https://api.github.com/copilot_internal/v2/token';

	private readonly commonHeaders = {
		'Accept': 'application/json',
		'Content-Type': 'application/json',
	};

	/**
	 * Starts the Copilot Device Flow authentication.
	 */
	public async run(): Promise<void> {
		const deviceCode = await this.requestDeviceCode();

		console.log(`\nPor favor, acesse ${deviceCode.verification_uri} e insira o código: ${deviceCode.user_code}`);
		console.log('\nAguardando autenticação...');

		try {
			const accessToken = await this.pollForAccessToken(deviceCode.device_code, deviceCode.interval);

			console.log('\n✅ Autenticação bem-sucedida!');
			console.log('\nTestando acesso ao Copilot...');

			await this.testCopilotAccess(accessToken);

			console.log('\nSeu GitHub Access Token é:');
			console.log(accessToken);
			console.log('\nAdicione-o ao seu arquivo .env como COPILOT_GITHUB_TOKEN');
		} catch (error) {
			console.error('\n❌ Erro durante a autenticação:', error instanceof Error ? error.message : error);
		}
	}

	/**
	 * Requests a device code from GitHub.
	 */
	private async requestDeviceCode(): Promise<DeviceCodeResponse> {
		const response = await fetch(this.deviceCodeUrl, {
			method: 'POST',
			headers: this.commonHeaders,
			body: JSON.stringify({ client_id: this.clientId, scope: this.scope }),
		});

		if (!response.ok) {
			throw new Error(`Failed to request device code: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Polls GitHub until the user authorizes the device or an error occurs.
	 */
	private async pollForAccessToken(deviceCode: string, interval: number): Promise<string> {
		let pollInterval = interval ?? 5;

		while (true) {
			await this.sleep(pollInterval);

			const data = await this.requestAccessToken(deviceCode);

			if (data.access_token) {
				return data.access_token;
			}

			if (data.error === 'authorization_pending') {
				continue;
			}

			if (data.error === 'slow_down') {
				pollInterval = data.interval ?? pollInterval + 5;
				continue;
			}

			throw new Error(data.error_description ?? data.error ?? 'Unknown error from token endpoint');
		}
	}

	/**
	 * Makes a single poll request to the access token endpoint.
	 */
	private async requestAccessToken(deviceCode: string): Promise<TokenResponse> {
		const response = await fetch(this.accessTokenUrl, {
			method: 'POST',
			headers: this.commonHeaders,
			body: JSON.stringify({
				client_id: this.clientId,
				device_code: deviceCode,
				grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			}),
		});

		if (!response.ok) {
			throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Fetches the internal Copilot token to verify the access token works.
	 */
	private async testCopilotAccess(accessToken: string): Promise<void> {
		const response = await fetch(this.copilotTokenUrl, {
			method: 'GET',
			headers: {
				'Authorization': `token ${accessToken}`,
				'Editor-Version': 'vscode/1.95.0',
				'User-Agent': 'GitHubCopilotChat/0.22.4',
				'Accept': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch Copilot token: ${response.status} ${response.statusText}`);
		}

		const data: CopilotTokenResponse = await response.json();

		console.log('\nToken interno do Copilot obtido com sucesso:');
		console.log(data.token);
	}

	/**
	 * Sleeps for a given number of seconds.
	 */
	private sleep(seconds: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
	}
}
