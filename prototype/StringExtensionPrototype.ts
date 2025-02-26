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
String.prototype.removeThinkingChatCompletion = function(): string {
  return this.replace(/<think>[\s\S]*?<\/think>/g, '');
};

/**
 * Convert BlackBox web search sources to Markdown links
 * Takes the format $^^^${"link":"URL","title":"TITLE"}$^^^$ and converts to [TITLE](URL)
 */
String.prototype.convertBlackBoxWebSearchSourcesToMarkdown = function(): string {
  return this.replace(/\$+\^\^\^\$(.*?)\$+\^\^\^\$/gs, (_: string, groupContent: string): string => 
    groupContent.replace(
      /\{"link":"([^"]+)","title":"([^"]+)"\}/g,
      '[$2]($1)'
    )
  );
};