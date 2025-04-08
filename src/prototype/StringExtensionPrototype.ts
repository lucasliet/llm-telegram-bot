/**
 * String prototype extensions to add useful functionality for text processing
 */
declare global {
	interface String {
		/**
		 * Check if the string starts with any of the provided prefixes (case-insensitive)
		 */
		startsIn(...args: string[]): boolean;

		/**
		 * Remove thinking sections from chat completion output (<think>...</think>)
		 */
		removeThinkingChatCompletion(): string;

		/**
		 * Convert BlackBox web search sources to Markdown format
		 */
		convertBlackBoxWebSearchSourcesToMarkdown(): string;
	}
}

/**
 * Check if string starts with any of the provided prefixes (case-insensitive)
 */
String.prototype.startsIn = function (...args: string[]): boolean {
	for (const arg of args) {
		if (this.toLowerCase().startsWith(arg.toLowerCase())) {
			return true;
		}
	}
	return false;
};

/**
 * Remove thinking sections from chat completion output (<think>...</think>)
 * This allows removing internal thinking or reasoning processes that shouldn't be shown to the user
 */
String.prototype.removeThinkingChatCompletion = function (): string {
	return this.replace(/<think>[\s\S]*?<\/think>/g, '');
};

/**
 * Convert BlackBox web search sources to Markdown links
 * Takes the format $~~~$[{"title":"TITLE","link":"URL","snippet":"TEXT",...},...]$~~~$ 
 * or $~~~${"title":"TITLE","link":"URL","snippet":"TEXT",...}$~~~$
 * and converts to Markdown links [TITLE](URL)
 */
String.prototype.convertBlackBoxWebSearchSourcesToMarkdown =
	function (): string {
		return this.replace(
			/\$+~~~?\$(.*?)\$+~~~?\$/gs,
			(_: string, groupContent: string): string => {
				try {
					const data = JSON.parse(groupContent);
					if (Array.isArray(data)) {
						return data.map(item => `[${item.title}](${item.link})`).join('\n');
					} else {
						return `[${data.title}](${data.link})`;
					}
				} catch (_e) {
					return groupContent; // or handle the error as needed
				}
			},
		);
	};
