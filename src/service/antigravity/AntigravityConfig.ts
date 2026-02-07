export interface AntigravityRuntimeConfig {
	keepThinking?: boolean;
	signatureCacheTtl?: number;
}

export function getAntigravityConfig(): AntigravityRuntimeConfig {
	return {
		keepThinking: Deno.env.get('ANTIGRAVITY_KEEP_THINKING') === 'true',
		signatureCacheTtl: parseInt(Deno.env.get('ANTIGRAVITY_CACHE_TTL') || '3600000'),
	};
}
