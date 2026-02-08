
/**
 * Handles the Antigravity OAuth2 flow to obtain a refresh token.
 */
export class AntigravityAuth {
  private readonly clientId = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
  private readonly clientSecret = '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';
  private readonly redirectUri = 'http://localhost:9004';
  private readonly scopes = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs',
  ];

  /**
   * Starts the OAuth flow.
   */
  public async run(): Promise<void> {
    const authUrl = this.generateAuthUrl();
    console.log('Por favor, abra o link abaixo no seu navegador para autorizar o acesso:');
    console.log(authUrl);

    const code = await this.startLocalServerAndListenForCode();
    if (code) {
      console.log('\nCódigo recebido. Trocando por refresh token...');
      try {
        const refreshToken = await this.exchangeCodeForToken(code);
        console.log('\n✅ Sucesso! Seu Refresh Token é:');
        console.log(refreshToken);
        console.log('\nAdicione-o ao seu arquivo .env ou variáveis de ambiente como ANTIGRAVITY_REFRESH_TOKEN');
      } catch (error) {
        console.error('\n❌ Erro ao trocar código por token:', error);
      }
    } else {
      console.log('\n❌ Falha ao obter o código de autorização.');
    }
  }

  /**
   * Generates the OAuth2 authorization URL.
   */
  private generateAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
  }

  /**
   * Starts a local server to listen for the redirect callback and extract the authorization code.
   */
  private async startLocalServerAndListenForCode(): Promise<string | null> {
    const ac = new AbortController();
    let code: string | null = null;

    console.log(`\nAguardando callback em ${this.redirectUri}...`);

    // @ts-ignore: Deno.serve is stable but might not be in the types depending on the environment
    await Deno.serve({ port: 9004, signal: ac.signal, onListen: () => { } }, async (req: Request) => {
      const url = new URL(req.url);
      if (url.searchParams.has('code')) {
        code = url.searchParams.get('code');
        ac.abort();
        return new Response('Sucesso! Voce pode fechar esta janela e voltar para o terminal.', { status: 200 });
      }
      return new Response('Aguardando codigo...', { status: 200 });
    }).finished;

    return code;
  }

  /**
   * Exchanges the authorization code for a refresh token.
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.refresh_token;
  }
}
