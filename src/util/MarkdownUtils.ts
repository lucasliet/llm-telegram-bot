/**
 * Utility functions for Markdown handling in Telegram
 */

/**
 * Converts CommonMark/GFM (used by LLMs) to Telegram Markdown (V1)
 *
 * Mappings:
 * - **bold** -> *bold*
 * - * list -> • list (to avoid conflict with bold)
 * - *italic* -> *bold* (Telegram V1 uses * for bold, _ for italic. GFM *italic* becomes bold, which is acceptable)
 * - _italic_ -> _italic_ (preserved)
 * - `code` -> `code` (preserved)
 * - ```pre``` -> ```pre``` (preserved)
 */
export function toTelegramMarkdown(text: string): string {
	let result = text;

	// 1. Convert list items '* ' to '• ' to avoid conflict with bold syntax
	// Match start of string or start of line
	result = result.replace(/^[\s]*\*[\s]+/gm, '• ');

	// 2. Convert bold '**text**' to '*text*'
	result = result.replace(/\*\*(.*?)\*\*/g, '*$1*');

	// 3. Handle `__underline__` if LLM generates it (map to italic)
	result = result.replace(/__(.*?)__/g, '_$1_');

	return result;
}

/**
 * Escapes special characters for Telegram Markdown (V1)
 * Used when inserting raw text into a Markdown template
 */
export function escapeMarkdownV1(text: string): string {
	if (!text) return '';
	// Escape: _ * ` [
	return text.replace(/[_*`\[]/g, '\\$&');
}
