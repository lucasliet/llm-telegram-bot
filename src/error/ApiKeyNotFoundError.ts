export class ApiKeyNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ApiKeyNotFoundError';
	}
}
