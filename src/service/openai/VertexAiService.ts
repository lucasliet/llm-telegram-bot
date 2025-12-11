import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { decodeBase64 } from 'base64';

const VERTEX_CREDENTIALS_BASE64 = Deno.env.get('VERTEX_CREDENTIALS_BASE64') as string;
const VERTEX_PROJECT_ID = Deno.env.get('VERTEX_PROJECT_ID') as string;
const VERTEX_LOCATION = Deno.env.get('VERTEX_LOCATION') || 'us-central1';

/**
 * Gets access token using refresh token (ADC credentials from gcloud CLI)
 */
async function getAccessTokenFromRefreshToken(credentials: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}): Promise<string> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Gets access token using service account credentials (JWT Bearer)
 */
async function getAccessTokenFromServiceAccount(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyPem = credentials.private_key;
  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Decodes base64 credentials and generates an OAuth2 access token.
 * Supports both ADC (refresh token) and service account (private key) formats.
 */
async function getAccessToken(): Promise<string> {
  const credentials = JSON.parse(new TextDecoder().decode(decodeBase64(VERTEX_CREDENTIALS_BASE64)));

  if (credentials.refresh_token) {
    return getAccessTokenFromRefreshToken(credentials);
  }

  if (credentials.private_key) {
    return getAccessTokenFromServiceAccount(credentials);
  }

  throw new Error('Invalid credentials format: must contain either refresh_token or private_key');
}

function getBaseUrl(): string {
  return `https://aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_LOCATION}/endpoints/openapi`;
}

export default class VertexAiService extends OpenAiService {
  public constructor(model: string = 'gemini-2.5-flash-lite') {
    super(
      new OpenAi({
        apiKey: 'placeholder',
        baseURL: getBaseUrl(),
      }),
      `google/${model}`,
    );

    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    const accessToken = await getAccessToken();
    this.openai = new OpenAi({
      apiKey: accessToken,
      baseURL: getBaseUrl(),
    });
  }

  override async generateText(
    userKey: string,
    quote: string = '',
    prompt: string,
  ): Promise<StreamReplyResponse> {
    await this.initializeAuth();
    return super.generateText(userKey, quote, prompt);
  }

  override async generateTextFromImage(
    userKey: string,
    quote: string | undefined,
    photosUrl: Promise<string>[],
    prompt: string,
  ): Promise<StreamReplyResponse> {
    await this.initializeAuth();
    return super.generateTextFromImage(userKey, quote, photosUrl, prompt, true);
  }
}
