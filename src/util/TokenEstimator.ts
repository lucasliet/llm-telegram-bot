const CHARS_PER_TOKEN = 4;
const COMPRESSION_THRESHOLD = 0.8;

/**
 * Estimate token count for an array of data.
 * Uses approximation: 1 token ≈ 4 characters.
 */
export function estimateTokens<T>(data: T[]): number {
	return Math.ceil(JSON.stringify(data).length / CHARS_PER_TOKEN);
}

/**
 * Estimate token count for a string.
 * Uses approximation: 1 token ≈ 4 characters.
 */
export function estimateTokensFromString(str: string): number {
	return Math.ceil(str.length / CHARS_PER_TOKEN);
}

/**
 * Check if compression should be triggered based on token count.
 * Returns true when tokens exceed 80% of max tokens.
 */
export function shouldCompress(tokens: number, maxTokens: number): boolean {
	return tokens > (maxTokens * COMPRESSION_THRESHOLD);
}
