declare global {
  interface String {
    startsIn(...args: string[]): boolean;
    removeThinkingChatCompletion(): string;
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