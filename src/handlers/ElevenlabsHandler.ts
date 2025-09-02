import { Context } from 'grammy';
import { textToSpeech } from '../service/TelegramService.ts';
import { StreamReplyResponse } from '../util/ChatConfigUtil.ts';

/**
 * Handles the 'fala' command by generating text using the provided text model service,
 * converting the generated text to speech, and sending it as a voice message.
 *
 * @template T - A type that extends an object with a `generateText` method.
 * @param ctx - The context object containing user and message information.
 * @param textModelService - The service used to generate text responses.
 * @param commandMessage - An optional command message to override the extracted context message.
 * @returns A promise that resolves when the operation is complete.
 */
export async function handleFala<
  T extends { generateText: (userKey: string, quote: string, prompt: string) => Promise<StreamReplyResponse> }
>(
  ctx: Context,
  textModelService: T,
  commandMessage?: string,
): Promise<void> { 
  const { userKey, contextMessage, quote = '' } = await ctx.extractContextKeys();
  const message = commandMessage || contextMessage;
  const command = message?.split(':')[0]?.toLowerCase() || 'none';
  const prompt = message!.replace(`${command}:`, '');

  if (command === 'fala') {
    const { reader, onComplete } = await textModelService.generateText(
      userKey,
      quote,
      'max_token limit this answer to 500 characters, it will be converted to limited voice message: ' +
      prompt,
    );

    const fullText = (await reader.text()).removeThinkingChatCompletion();
    if (onComplete) await onComplete(fullText);
    textToSpeech(ctx, fullText);
    return;
  }
}