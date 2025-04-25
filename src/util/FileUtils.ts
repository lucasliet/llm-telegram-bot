import { Context } from 'grammy-context';
import { Audio, InputFile, PhotoSize, Voice } from 'grammy-types';
import { getCurrentModel } from '@/repository/ChatRepository.ts';
import OpenAiService from '@/service/openai/OpenAIService.ts';
import CloudFlareService from '@/service/CloudFlareService.ts';
import ElevenLabsService from '@/service/ElevenLabsService.ts';
const TOKEN = Deno.env.get('BOT_TOKEN') as string;
const ADMIN_USER_IDS: number[] = (Deno.env.get('ADMIN_USER_IDS') as string)
	.split('|').map((id) => parseInt(id));

/**
 * Utilities for file handling
 */
export const FileUtils = {
	/**
	 * Gets Telegram file URLs
	 * @param ctx - Telegram context
	 * @param files - Array of Telegram file objects
	 * @returns Array of promises resolving to file URLs
	 */
	getTelegramFilesUrl(
		ctx: Context,
		files: PhotoSize[] | Audio[],
	): Promise<string>[] {
		return files.map(async (file) => {
			const fileData = await ctx.api.getFile(file.file_id);
			return `https://api.telegram.org/file/bot${TOKEN}/${fileData.file_path}`;
		});
	},

	/**
	 * Downloads a file from Telegram
	 * @param url - URL to the file
	 * @returns Downloaded file as Uint8Array
	 */
	async downloadTelegramFile(url: string): Promise<Uint8Array> {
		const response = await fetch(url);
		return new Uint8Array(await response.arrayBuffer());
	},

	/**
	 * Transcribes audio from a voice message
	 * @param userId - User ID for authorization check
	 * @param userKey - User key for storage
	 * @param ctx - Telegram context
	 * @param audio - Voice message to transcribe
	 * @returns Transcribed text
	 */
	async transcribeAudio(
		userId: number,
		userKey: string,
		ctx: Context,
		audio: Voice,
	): Promise<string> {
		const audioUrl: string = await this.getTelegramFilesUrl(ctx, [audio])[0];
		const isGptModelCommand = '/gpt' === await getCurrentModel(userKey);

		const audioFile: Promise<Uint8Array> = this.downloadTelegramFile(audioUrl);

		try {
			return await ElevenLabsService.transcribeAudio(audioFile);
		} catch (error) {
			console.error('Erro ao transcrever áudio do ElevenLabs:', error);
			if (isGptModelCommand || ADMIN_USER_IDS.includes(userId)) {
				return await new OpenAiService().transcribeAudio(
					audioFile,
					audioUrl,
				);
			} else {
				return await CloudFlareService.transcribeAudio(audioFile);
			}
		}
	},

	/**
	 * Converte texto em áudio e envia como mensagem de voz no Telegram
	 * @param ctx - Contexto do Telegram
	 * @param text - Texto para converter em áudio
	 * @param replyToMessageId - ID da mensagem para responder (opcional)
	 * @returns Promise resolvendo para undefined quando completo
	 */
	async textToSpeech(
		text: string,
	): Promise<InputFile> {
		try {
			const audioData = await ElevenLabsService.textToSpeech(text);

			const audioInput = new InputFile(audioData, 'audio.mp3');

			return audioInput;
		} catch (error: unknown) {
			console.error('Erro ao converter texto para áudio:', error);
			throw new Error(`Falha ao gerar áudio: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
		}
	},
};

export const downloadTelegramFile = FileUtils.downloadTelegramFile;
export const transcribeAudio = (
	userId: number,
	userKey: string,
	ctx: Context,
	audio: Voice,
): Promise<string> => {
	return FileUtils.transcribeAudio(userId, userKey, ctx, audio);
};
