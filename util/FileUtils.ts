import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { Audio, PhotoSize, Voice } from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';
import { getCurrentModel } from '../repository/ChatRepository.ts';
import OpenAiService from '../service/OpenAIService.ts';
import CloudFlareService from '../service/CloudFlareService.ts';

const TOKEN = Deno.env.get('BOT_TOKEN') as string;
const ADMIN_USER_IDS: number[] = (Deno.env.get('ADMIN_USER_IDS') as string).split('|').map(id => parseInt(id));

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
  getTelegramFilesUrl(ctx: Context, files: PhotoSize[] | Audio[]): Promise<string>[] {
    return files.map(async file => {
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
  async transcribeAudio(userId: number, userKey: string, ctx: Context, audio: Voice): Promise<string> {
    const audioUrl: string = await this.getTelegramFilesUrl(ctx, [audio])[0];
    const isGptModelCommand = '/gpt' === await getCurrentModel(userKey);

    const audioFile: Promise<Uint8Array> = this.downloadTelegramFile(audioUrl);

    if (isGptModelCommand || ADMIN_USER_IDS.includes(userId)) {
      return await new OpenAiService('/openai').transcribeAudio(audioFile, audioUrl);
    } else {
      return await CloudFlareService.transcribeAudio(audioFile);
    }
  }
};

export const downloadTelegramFile = FileUtils.downloadTelegramFile;
export const transcribeAudio = (userId: number, userKey: string, ctx: Context, audio: Voice): Promise<string> => {
  return FileUtils.transcribeAudio(userId, userKey, ctx, audio);
};