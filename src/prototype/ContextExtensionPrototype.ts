import { Context } from 'grammy';
import { Action } from 'grammy-auto-chat-action-types';
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

		startTypingIndicator(): number;

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

		chatAction: Action | null;
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
 * Start typing indicator that persists by re-sending every 4 seconds
 */
Context.prototype.startTypingIndicator = function (this: Context): number {
	this.chatAction = 'typing';
	return setInterval(() => {
		this.chatAction = 'typing';
	}, 4000);
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
	let lastSentMessage = '';

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

				const updateResult = await editMessageWithCompletionEvery3Seconds(
					this,
					message_id,
					result,
					lastUpdate,
					lastSentMessage,
					true,
				);
				lastUpdate = updateResult.timestamp;
				lastSentMessage = updateResult.lastMessage;
				onComplete(result);
				return this.streamReply(
					reader,
					onComplete,
					responseMap,
					remainingChunk,
				);
			}
		}

		const updateResult = await editMessageWithCompletionEvery3Seconds(
			this,
			message_id,
			result,
			lastUpdate,
			lastSentMessage,
		);
		lastUpdate = updateResult.timestamp;
		lastSentMessage = updateResult.lastMessage;
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
	lastSentMessage: string,
	isLastMessage = false,
): Promise<{ timestamp: number; lastMessage: string }> {
	const now = Date.now();
	const has2SecondsPassed = now - lastUpdate >= 2000;
	const displayMessage = message + (isLastMessage ? '' : '...');

	if ((isLastMessage || has2SecondsPassed) && displayMessage !== lastSentMessage) {
		try {
			await ctx.api.editMessageText(ctx.chat!.id, messageId, displayMessage, {
				parse_mode: 'Markdown',
			});
			return { timestamp: now, lastMessage: displayMessage };
		} catch (error) {
			if (error instanceof Error && error.message.includes('message is not modified')) {
				return { timestamp: lastUpdate, lastMessage: lastSentMessage };
			}
			console.warn(MARKDOWN_ERROR_MESSAGE, displayMessage);
			try {
				await ctx.api.editMessageText(ctx.chat!.id, messageId, displayMessage);
				return { timestamp: now, lastMessage: displayMessage };
			} catch (fallbackError) {
				console.error(`Failed to edit message ${messageId} in chat ${ctx.chat!.id}:`, fallbackError);
				return { timestamp: lastUpdate, lastMessage: lastSentMessage };
			}
		}
	}

	return { timestamp: lastUpdate, lastMessage: lastSentMessage };
}
