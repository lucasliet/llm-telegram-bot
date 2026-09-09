import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';
import { opencodeModels } from '@/config/models.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

const { freeModel } = opencodeModels;

/**
 * Identifica as requisições ao OpenCode Zen/Go com `User-Agent` próprio e
 * `x-opencode-session` estável por operação lógica.
 * Port do PR akitaonrails/ai-memory#610: um ID por chamada LLM, reutilizado
 * em retries e fallbacks em vez de parecerem requests não relacionadas.
 */
export const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1';

export const OPENCODE_SESSION_HEADER = 'x-opencode-session';

export const OPENCODE_USER_AGENT = 'llm-telegram-bot/1.0.0';

/**
 * Gera um ID de operação lógica para correlacionar retries e fallbacks.
 * @returns UUID v4 como string.
 */
export function newOpencodeOperationId(): string {
	return crypto.randomUUID();
}

/**
 * Monta os headers de identificação exigidos pelo OpenCode Go/Zen.
 * @param operationId - ID estável da operação lógica atual.
 * @returns Headers a enviar em toda request OpenCode.
 */
export function buildOpencodeHeaders(operationId: string): Record<string, string> {
	return {
		'User-Agent': OPENCODE_USER_AGENT,
		[OPENCODE_SESSION_HEADER]: operationId,
	};
}

/**
 * Sessão estável em memória durante a vida curta da instância serverless.
 * Reutilizada em toda request para o vendor correlacionar a conversa.
 */
const OPENCODE_SESSION_ID = newOpencodeOperationId();

/**
 * Service for OpenCode Zen free OpenAI-compatible endpoint.
 * The OpenCode Zen gateway accepts the `Authorization: Bearer ` header with
 * an empty token value, but an API key can be set via `OPENCODE_API_KEY`
 * for authenticated usage; when unset, the empty token keeps the free
 * behavior. Every request identifies this client via `User-Agent` and sends
 * o `x-opencode-session` estável em memória (reutilizado em compressão,
 * retries e tool follow-ups).
 */
export default class OpencodeService extends OpenAiService {
	private operationId: string;

	public constructor(model: string = freeModel, operationId: string = OPENCODE_SESSION_ID) {
		super(
			new OpenAi({
				apiKey: Deno.env.get('OPENCODE_API_KEY') ?? '',
				baseURL: Deno.env.get('OPENCODE_BASE_URL') ?? OPENCODE_BASE_URL,
				defaultHeaders: buildOpencodeHeaders(operationId),
			}),
			model,
		);
		this.operationId = operationId;
	}

	/**
	 * Expõe o ID da operação lógica atual para correlação e testes.
	 * @returns ID enviado em `x-opencode-session`.
	 */
	public getOperationId(): string {
		return this.operationId;
	}

	/**
	 * Troca o ID da operação e reaplica os headers no client.
	 * @param operationId - Novo ID estável da operação lógica.
	 */
	public setOperationId(operationId: string): void {
		this.operationId = operationId;
		this.openai = this.openai.withOptions({
			defaultHeaders: buildOpencodeHeaders(operationId),
		});
	}

	/**
	 * Reaplica a sessão estável em memória: o mesmo ID é reutilizado em
	 * compressão, retries e follow-ups de tools dentro e entre chamadas.
	 * @returns ID da sessão estável.
	 */
	private beginOperation(): string {
		this.setOperationId(OPENCODE_SESSION_ID);
		return OPENCODE_SESSION_ID;
	}

	override generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		this.beginOperation();
		return super.generateText(userKey, quote, prompt);
	}

	override generateTextFromImage(
		userKey: string,
		quote: string | undefined,
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse> {
		this.beginOperation();
		return super.generateTextFromImage(
			userKey,
			quote,
			photosUrl,
			prompt,
			true,
		);
	}
}
