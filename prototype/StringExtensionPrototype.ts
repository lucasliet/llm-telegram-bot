declare global {
  interface String {
    startsIn(...args: string[]): boolean;
  }
}

String.prototype.startsIn = function (...args: string[]): boolean {
  for (const arg of args) {
    if (this.startsWith(arg)) {
      return true;
    }
  }
  return false;
}