import { Context } from 'grammy';
import { Audio, Message, ParseMode, PhotoSize, Voice } from 'grammy-types';
import { transcribeAudio } from '@/service/TelegramService.ts';

const MARKDOWN_ERROR_MESSAGE = 'Error on markdown parse_mode, message:';

declare module 'grammy' {
	interface Context {
		replyWithQuote(
			output: string,
			config?: { parse_mode: ParseMode },
		): Promise<Message.TextMessage>;

		replyWithVisionNotSupportedByModel(): Promise<Message.TextMessage>;

		replyOnLongAnswer(): number;

		replyInChunks(output: string): void;

		streamReply(
			reader: ReadableStreamDefaultReader<Uint8Array>,
			onComplete: (completedAnswer: string) => Promise<void>,
			responseMap?: (responseBody: string) => string,
			lastResult?: string,
		): Promise<void>;

		extractContextKeys(): Promise<{
			userId: number;
			userKey: string;
			contextMessage?: string;
			audio?: Voice | Audio;
			photos?: PhotoSize[];
			caption?: string;
			quote?: string;
		}>;
	}
}

/**
 * Reply to a message with quoting the original message
 */
Context.prototype.replyWithQuote = function (
	this: Context,
	output: string,
	config?: { parse_mode: ParseMode },
) {
	return this.reply(output, {
		reply_to_message_id: this.message?.message_id,
		...config,
	});
};

/**
 * Reply that the model doesn't support vision capabilities
 */
Context.prototype.replyWithVisionNotSupportedByModel = function (
	this: Context,
) {
	return this.replyWithQuote('esse modelo não suporta leitura de foto');
};

/**
 * Set a timeout to reply if the answer takes too long
 */
Context.prototype.replyOnLongAnswer = function (this: Context): number {
	return setTimeout(() => {
		console.info('Request is taking too long, sending processing message...');
		this.replyWithQuote(
			'Estou processando sua solicitação, aguarde um momento...',
		);
	}, 12000);
};

/**
 * Split a large response into multiple message chunks
 */
Context.prototype.replyInChunks = function (
	this: Context,
	output: string,
): void {
	if (output.length > 4096) {
		const outputChunks = output.match(/[\s\S]{1,4093}/g)!;

		outputChunks.forEach((chunk, index) => {
			const isLastChunk = index === outputChunks.length - 1;
			const chunkOutput = `${chunk}${isLastChunk ? '' : '...'}`;

			this.replyWithQuote(chunkOutput, { parse_mode: 'Markdown' })
				.catch(() => {
					console.warn(MARKDOWN_ERROR_MESSAGE, chunkOutput);
					this.replyWithQuote(chunkOutput);
				});
		});
		return;
	}

	this.replyWithQuote(output, { parse_mode: 'Markdown' })
		.catch(() => {
			console.warn(MARKDOWN_ERROR_MESSAGE, output);
			this.replyWithQuote(output);
		});
};

/**
 * Stream a response to the user with periodic updates
 */
Context.prototype.streamReply = async function (
	this: Context,
	reader: ReadableStreamDefaultReader<Uint8Array>,
	onComplete: (completedAnswer: string) => Promise<void>,
	responseMap?: (responseBody: string) => string,
	lastResult?: string,
): Promise<void> {
	const { message_id } = await this.replyWithQuote('processando...');
	let result = lastResult || '';
	let lastUpdate = Date.now();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		const chunk = decodeStreamResponseText(value, responseMap);
		result += chunk;

		if (result.length > 4093) {
			result = result.removeThinkingChatCompletion()
				.convertBlackBoxWebSearchSourcesToMarkdown();

			if (result.length > 4093) {
				const remainingChunk = result.substring(4093) + chunk;
				result = result.substring(0, 4093);

				lastUpdate = await editMessageWithCompletionEvery3Seconds(
					this,
					message_id,
					result,
					lastUpdate,
					true,
				);
				onComplete(result);
				return this.streamReply(
					reader,
					onComplete,
					responseMap,
					remainingChunk,
				);
			}
		}

		lastUpdate = await editMessageWithCompletionEvery3Seconds(
			this,
			message_id,
			result,
			lastUpdate,
		);
	}

	let sanitizedResult = result.removeThinkingChatCompletion()
		.convertBlackBoxWebSearchSourcesToMarkdown();

	if (sanitizedResult.length > 4093) {
		const remainingChunk = sanitizedResult.substring(4093);
		sanitizedResult = sanitizedResult.substring(0, 4093) + '...';
		this.replyInChunks(remainingChunk);
	}

	this.api.editMessageText(this.chat!.id, message_id, sanitizedResult, {
		parse_mode: 'Markdown',
	})
		.catch(() => {
			console.warn(MARKDOWN_ERROR_MESSAGE, sanitizedResult);
			this.api.editMessageText(this.chat!.id, message_id, sanitizedResult);
		});

	onComplete(result);
};

/**
 * Extract common context keys from the message
 */
Context.prototype.extractContextKeys = async function (this: Context) {
	const userId = this.from?.id!;
	const userKey = `user:${userId}`;
	const audio = this.message?.voice || this.message?.audio;
	const contextMessage = await getTextMessage(userId, userKey, this, audio);
	const photos = this.message?.photo;
	const caption = this.message?.caption;
	const quote = this.message?.reply_to_message?.text;

	return { userId, userKey, contextMessage, audio, photos, caption, quote };
};

/**
 * Helper function to get text from a message, transcribing audio if needed
 */
function getTextMessage(
	userId: number,
	userKey: string,
	ctx: Context,
	audio?: Voice,
): Promise<string | undefined> {
	if (audio) {
		return transcribeAudio(userId, userKey, ctx, audio);
	}
	return Promise.resolve(ctx.message?.text);
}

/**
 * Decode text from the response stream
 */
function decodeStreamResponseText(
	responseMessage: Uint8Array,
	responseMap?: (responseBody: string) => string,
): string {
	const decoder = new TextDecoder();
	const decodedText = decoder.decode(responseMessage);
	return responseMap ? responseMap(decodedText) : decodedText;
}

/**
 * Edit a message with updated content, respecting rate limits
 * Avoid hitting Telegram API rate limit https://core.telegram.org/bots/faq#broadcasting-to-users
 */
async function editMessageWithCompletionEvery3Seconds(
	ctx: Context,
	messageId: number,
	message: string,
	lastUpdate: number,
	isLastMessage = false,
): Promise<number> {
	const now = Date.now();
	const has2SecondsPassed = now - lastUpdate >= 2000;

	if (isLastMessage || has2SecondsPassed) {
		const displayMessage = message + (isLastMessage ? '' : '...');

		try {
			await ctx.api.editMessageText(ctx.chat!.id, messageId, displayMessage, {
				parse_mode: 'Markdown',
			});
		} catch {
			console.warn(MARKDOWN_ERROR_MESSAGE, displayMessage);
			await ctx.api.editMessageText(ctx.chat!.id, messageId, displayMessage);
		}

		return now;
	}

	return lastUpdate;
}
