declare global {
  interface String {
    startsIn(...args: string[]): boolean;
    removeThinkingChatCompletion(): string;
    convertBlackBoxWebSearchSourcesToMarkdown(): string;
  }
}

String.prototype.startsIn = function (...args: string[]): boolean {
  for (const arg of args) {
    if (this.toLowerCase().startsWith(arg.toLowerCase())) {
      return true;
    }
  }
  return false;
}

String.prototype.removeThinkingChatCompletion = function(): string {
  return this.replace(/<think>[\s\S]*?<\/think>/g, '');
}

String.prototype.convertBlackBoxWebSearchSourcesToMarkdown = function(): string {
  return this.replace(/\$+\^\^\^\$(.*?)\$+\^\^\^\$/gs, (_: string, groupContent: string): string => 
    groupContent.replace(
      /\{"link":"([^"]+)","title":"([^"]+)"\}/g,
      '[$2]($1)'
    )
  );
}