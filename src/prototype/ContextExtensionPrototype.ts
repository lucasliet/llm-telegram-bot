import { type Api, Context } from 'grammy';
import { Audio, Document, Message, ParseMode, PhotoSize, Voice } from 'grammy-types';
import { transcribeAudio } from '@/service/TelegramService.ts';
import { toTelegramMarkdown } from '@/util/MarkdownUtils.ts';
import { COMPRESSION_WARNING_MSG } from '@/service/ContextCompressorService.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

const MARKDOWN_ERROR_MESSAGE = 'Error on markdown parse_mode, message:';

type Action = Parameters<Api['sendChatAction']>[1];

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
			response: StreamReplyResponse,
			lastResult?: string,
		): Promise<void>;

		extractContextKeys(): Promise<{
			userId: number;
			userKey: string;
			contextMessage?: string;
			audio?: Voice | Audio;
			photos?: PhotoSize[] | Document[];
			caption?: string;
			quote?: string;
		}>;

		chatAction: Action | undefined;
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
			const sanitizedOutput = toTelegramMarkdown(chunkOutput);

			this.replyWithQuote(sanitizedOutput, { parse_mode: 'Markdown' })
				.catch(() => {
					console.warn(MARKDOWN_ERROR_MESSAGE, chunkOutput);
					this.replyWithQuote(chunkOutput);
				});
		});
		return;
	}

	const sanitizedOutput = toTelegramMarkdown(output);
	this.replyWithQuote(sanitizedOutput, { parse_mode: 'Markdown' })
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
	response: StreamReplyResponse,
	lastResult?: string,
): Promise<void> {
	const { reader, onComplete, responseMap, isCompressed } = response;

	if (isCompressed) {
		await this.replyWithQuote(COMPRESSION_WARNING_MSG);
	}

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
					{ reader, onComplete, responseMap, isCompressed: false },
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

	this.api.editMessageText(this.chat!.id, message_id, toTelegramMarkdown(sanitizedResult), {
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
	const richContent = extractRichMessageContent(this.message?.rich_message);
	const contextMessage = (await getTextMessage(userId, userKey, this, audio)) ?? richContent.text;
	const photos = getReadablePhotos(this.message) ?? richContent.photos;
	const caption = this.message?.caption;
	const quote = this.message?.reply_to_message?.text;

	return { userId, userKey, contextMessage, audio, photos, caption, quote };
};

/**
 * Picks the largest size of the message photo, or the document itself when it is an image file
 * @param message - Telegram message carrying optional photo sizes or an image document
 * @returns Photo-like entries ready for the vision path
 */
function getReadablePhotos(
	message?: { photo?: PhotoSize[]; document?: Document },
): PhotoSize[] | Document[] | undefined {
	if (message?.photo?.length) {
		return [message.photo[message.photo.length - 1]];
	}
	if (message?.document?.mime_type?.startsWith('image/')) {
		return [message.document];
	}
	return undefined;
}

/**
 * Extract plain text and readable photos from a Bot API 10.1 rich message (rich_message),
 * which arrives with no text, caption, photo or document fields set
 * @param richMessage - The rich message payload from the Telegram message
 * @returns Extracted text (joined paragraphs) and individual photos when present
 */
function extractRichMessageContent(richMessage?: {
	blocks?: Record<string, unknown>[];
}): { text?: string; photos?: PhotoSize[] } {
	if (!richMessage?.blocks?.length) return {};

	const texts: string[] = [];
	const photos: PhotoSize[] = [];

	for (const block of richMessage.blocks) {
		collectRichBlockContent(block, texts, photos);
	}

	return {
		text: texts.length ? texts.join('\n') : undefined,
		photos: photos.length ? photos : undefined,
	};
}

/**
 * Collect text and photos from a rich block and its nested blocks
 * @param block - A single rich block (paragraph, list, photo, collage, table, etc.)
 * @param texts - Accumulator for extracted plain text
 * @param photos - Accumulator for extracted photos (largest size of each)
 */
function collectRichBlockContent(
	block: Record<string, unknown>,
	texts: string[],
	photos: PhotoSize[],
): void {
	const blockType = block.type as string;

	if (blockType === 'photo' && Array.isArray(block.photo) && block.photo.length) {
		photos.push(block.photo[block.photo.length - 1] as PhotoSize);
	}

	const richText = flattenRichText(block.text);
	if (richText) texts.push(richText);

	const captionText = flattenRichText((block.caption as Record<string, unknown> | undefined)?.text);
	if (captionText) texts.push(captionText);
	for (const field of ['blocks', 'items', 'rows']) {
		const nested = block[field];
		if (Array.isArray(nested)) {
			for (const item of nested) {
				if (Array.isArray(item)) {
					for (const cell of item) collectRichValue(cell, texts);
				} else {
					collectRichValue(item, texts, photos);
				}
			}
		}
	}
}

/**
 * Collect content from any nested rich value (block, table cell, list item or raw rich text)
 * @param value - Nested rich value to inspect
 * @param texts - Accumulator for extracted plain text
 * @param photos - Accumulator for extracted photos
 */
function collectRichValue(
	value: unknown,
	texts: string[],
	photos?: PhotoSize[],
): void {
	if (typeof value !== 'object' || value === null) {
		if (typeof value === 'string' && value) texts.push(value);
		return;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.type === 'string' && photos) {
		collectRichBlockContent(record, texts, photos);
		return;
	}
	const richText = flattenRichText(value);
	if (richText) texts.push(richText);
}

/**
 * Flatten a RichText value (plain string, nested array or annotated object) into plain text
 * @param richText - RichText value from any block field
 * @returns Plain concatenated text or empty string
 */
function flattenRichText(richText: unknown): string {
	if (typeof richText === 'string') return richText;
	if (Array.isArray(richText)) return richText.map(flattenRichText).join('');
	if (typeof richText === 'object' && richText !== null) {
		return flattenRichText((richText as Record<string, unknown>).text);
	}
	return '';
}

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
			await ctx.api.editMessageText(ctx.chat!.id, messageId, toTelegramMarkdown(displayMessage), {
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
