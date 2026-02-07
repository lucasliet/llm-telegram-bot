export interface AntigravityConfig {
	accessToken: string;
	refreshToken: string;
	projectId: string;
	expiresAt: number;
}

export interface GeminiContentPart {
	text?: string;
	thoughtSignature?: string;
	inlineData?: {
		mimeType: string;
		data: string;
	};
	functionCall?: {
		id?: string;
		name: string;
		args: Record<string, unknown>;
	};
	functionResponse?: {
		id?: string;
		name: string;
		response: { result: unknown };
	};
}

export interface GeminiContent {
	role: 'user' | 'model';
	parts: GeminiContentPart[];
}

export interface AntigravityRequestPayload {
	project: string;
	model: string;
	userAgent: string;
	requestId: string;
	requestType?: string;
	request: {
		contents: GeminiContent[];
		tools?: Array<{
			functionDeclarations: Array<{
				name: string;
				description: string;
				parameters: Record<string, unknown>;
			}>;
		}>;
		generationConfig?: {
			temperature?: number;
			maxOutputTokens?: number;
		};
		systemInstruction?: {
			role: 'user';
			parts: Array<{ text: string }>;
		};
		sessionId?: string;
	};
}

export const ANTIGRAVITY_ENDPOINTS = [
	'https://daily-cloudcode-pa.sandbox.googleapis.com',
	'https://autopush-cloudcode-pa.sandbox.googleapis.com',
	'https://cloudcode-pa.googleapis.com',
] as const;

export const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
export const ANTIGRAVITY_CLIENT_SECRET = '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';

export const ANTIGRAVITY_SCOPES = [
	'https://www.googleapis.com/auth/cloud-platform',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/userinfo.profile',
	'https://www.googleapis.com/auth/cclog',
	'https://www.googleapis.com/auth/experimentsandconfigs',
];

export const SKIP_THOUGHT_SIGNATURE = 'skip_thought_signature_validator';

export const MIN_SIGNATURE_LENGTH = 50;

export interface ThinkingConfig {
	thinkingBudget?: number;
	includeThoughts?: boolean;
}

export const DEFAULT_THINKING_BUDGET = 16000;
