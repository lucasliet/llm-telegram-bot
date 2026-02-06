import { Context } from 'grammy';
import { FileUtils } from '@/util/FileUtils.ts';
import { StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

export interface HandlerContext {
	ctx: Context;
	userKey: string;
	message: string;
	command: string;
	prompt: string;
	photos?: unknown[];
	caption?: string;
	quote?: string;
}

interface TextService {
	generateText(userKey: string, quote: string, prompt: string): Promise<StreamReplyResponse>;
}

interface VisionService extends TextService {
	generateTextFromImage(
		userKey: string,
		quote: string | undefined,
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse>;
}

type ModelMap<T> = Record<string, T | undefined>;

interface VisionHandlerOptions<T extends string> {
	modelMap?: ModelMap<T>;
	defaultCommand?: string;
	createService: (model?: T) => VisionService;
}

interface TextOnlyHandlerOptions<T extends string> {
	modelMap?: ModelMap<T>;
	defaultCommand?: string;
	createService: (model?: T) => TextService;
}

/**
 * Creates a handler function for services that support both text and image input
 */
export function createVisionHandler<T extends string>(options: VisionHandlerOptions<T>) {
	const { modelMap = {}, defaultCommand = 'none', createService } = options;

	return async function handler(ctx: Context, commandMessage?: string): Promise<void> {
		const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

		const message = commandMessage || contextMessage;
		const command = message?.split(':')[0]?.toLowerCase() || defaultCommand;
		const model = modelMap[command as keyof typeof modelMap] as T | undefined;
		const prompt = (message || caption)?.replace(`${command}:`, '');

		const service = createService(model);

		if (photos && caption) {
			const photosUrl = FileUtils.getTelegramFilesUrl(ctx, photos);
			const { reader, onComplete, responseMap } = await service.generateTextFromImage(
				userKey,
				quote,
				photosUrl,
				prompt!,
			);
			return ctx.streamReply(reader, onComplete, responseMap);
		}

		const { reader, onComplete, responseMap } = await service.generateText(userKey, quote ?? '', prompt!);
		return ctx.streamReply(reader, onComplete, responseMap);
	};
}

/**
 * Creates a handler function for services that only support text input (no vision)
 */
export function createTextOnlyHandler<T extends string>(options: TextOnlyHandlerOptions<T>) {
	const { modelMap = {}, defaultCommand = 'none', createService } = options;

	return async function handler(ctx: Context, commandMessage?: string): Promise<void> {
		const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

		const message = commandMessage || contextMessage;

		if (photos && caption) {
			ctx.replyWithVisionNotSupportedByModel();
			return;
		}

		const command = message?.split(':')[0]?.toLowerCase() || defaultCommand;
		const model = modelMap[command as keyof typeof modelMap] as T | undefined;
		const prompt = message!.replace(`${command}:`, '');

		const service = createService(model);

		const { reader, onComplete, responseMap } = await service.generateText(userKey, quote ?? '', prompt);
		ctx.streamReply(reader, onComplete, responseMap);
	};
}

interface HybridService extends TextService {
	generateImage(prompt: string): Promise<string>;
}

interface HybridHandlerOptions {
	imageCommands: string[];
	createService: () => HybridService;
}

/**
 * Creates a handler function for services that support text + image generation via commands
 */
export function createHybridHandler(options: HybridHandlerOptions) {
	const { imageCommands, createService } = options;

	return async function handler(ctx: Context, commandMessage?: string): Promise<void> {
		const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

		const message = commandMessage || contextMessage;

		if (photos && caption) {
			ctx.replyWithVisionNotSupportedByModel();
			return;
		}

		const command = message?.split(':')[0]?.toLowerCase() || 'none';
		const prompt = message!.replace(`${command}:`, '');

		const service = createService();

		if (imageCommands.includes(command)) {
			const imageUrl = await service.generateImage(prompt);
			await ctx.replyWithPhoto(imageUrl);
			return;
		}

		const { reader, onComplete, responseMap } = await service.generateText(userKey, quote ?? '', prompt);
		ctx.streamReply(reader, onComplete, responseMap);
	};
}
