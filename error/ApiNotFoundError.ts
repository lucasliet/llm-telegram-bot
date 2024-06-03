export class ApiNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiNotFoundError';
  }
}