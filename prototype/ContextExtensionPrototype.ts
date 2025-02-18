import { Context } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import { Audio, Message, ParseMode, PhotoSize, Voice }  from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';
import { transcribeAudio } from '../service/TelegramService.ts';

declare module 'https://deno.land/x/grammy@v1.17.2/mod.ts' {
  interface Context {
    replyWithQuote(output: string, config?: { parse_mode: ParseMode }): Promise<Message.TextMessage>;
    replyWithVisionNotSupportedByModel(): Promise<Message.TextMessage>;
    replyOnLongAnswer(): number;
    replyInChunks(output: string): void;
    streamReply(
      reader: ReadableStreamDefaultReader<Uint8Array>,
      onComplete: (completedAnswer: string) => Promise<void>,
      responseMap?: (responseBody: string) => string,
      lastResult?: string
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

Context.prototype.replyWithQuote = function (this: Context, output: string, config?: { parse_mode: ParseMode }) {
  return this.reply(output, { reply_to_message_id: this.message?.message_id, ...config  });
}

Context.prototype.replyWithVisionNotSupportedByModel = function (this: Context) {
  return this.replyWithQuote('esse modelo não suporta leitura de foto');
}

Context.prototype.replyOnLongAnswer = function(this: Context): number {
  return setTimeout(() => {
    console.info('Request is longing too much, replying processing message...');
    this.replyWithQuote('Estou processando sua solicitação, aguarde um momento...');
  }, 6000);
}

Context.prototype.replyInChunks= function (this: Context, output: string): void {
  if(output.length > 4096) {
    const outputChunks = output.match(/[\s\S]{1,4093}/g)!;
    outputChunks.forEach((chunk, index) => {
      const chunkOutput = `${chunk}${index === outputChunks.length - 1 ? '' : '...'}`;
      this.replyWithQuote(chunkOutput, { parse_mode: 'Markdown'  })
        .catch(() => {
          console.warn(warnMarkdownErrorMessage, chunkOutput);
          this.replyWithQuote(chunkOutput);
        });
    });
    return;
  }

  this.replyWithQuote(output, { parse_mode: 'Markdown' })
    .catch(() => {
      console.warn(warnMarkdownErrorMessage, output);
      this.replyWithQuote(output);
    });
}

Context.prototype.streamReply = async function (
  this: Context,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onComplete: (completedAnswer: string) => Promise<void>,
  responseMap?: (responseBody: string) => string,
  lastResult?: string
): Promise<void> {
  const { message_id } = await this.replyWithQuote('processando...');
  let result = lastResult || '';
  let lastUpdate = Date.now();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    let chunk = _decodeStreamResponseText(value, responseMap);
    result += chunk;
    
    if(result.length > 4093) {
      result = result.removeThinkingChatCompletion().convertBlackBoxWebSearchSourcesToMarkdown();
      if(result.length > 4093) {
        chunk = result.substring(4093, result.length) + chunk;
        result = result.substring(0, 4093);
        _editMessageWithCompletionEvery3Seconds(this, message_id, result, lastUpdate, true);
        onComplete(result);
        return this.streamReply(reader, onComplete, responseMap, chunk);
      }
    }
    
    lastUpdate = await _editMessageWithCompletionEvery3Seconds(this, message_id, result, lastUpdate);
  }
  const sanitizedResult = result.removeThinkingChatCompletion().convertBlackBoxWebSearchSourcesToMarkdown();
  this.api.editMessageText(this.chat!.id, message_id, sanitizedResult, { parse_mode: 'Markdown' })
    .catch(() => {
      console.warn(warnMarkdownErrorMessage, sanitizedResult)
      this.api.editMessageText(this.chat!.id, message_id, sanitizedResult)
    });
  onComplete(result);
}

Context.prototype.extractContextKeys = async function(this: Context) {
  const userId = this.from?.id!;
  const userKey = `user:${userId}`;
  const audio = this.message?.voice || this.message?.audio;
  const contextMessage = await _getTextMessage(userId, userKey, this, audio);
  const photos = this.message?.photo;
  const caption = this.message?.caption;
  const quote = this.message?.reply_to_message?.text;
  return { userId, userKey, contextMessage, audio, photos, caption, quote };
};

function _getTextMessage(userId:number, userKey: string, ctx: Context, audio?: Voice): Promise<string | undefined> {
  return audio ? transcribeAudio(userId, userKey, ctx, audio) : Promise.resolve(ctx.message?.text);
}

function _decodeStreamResponseText(responseMessage: Uint8Array, responseMap?: (responseBody: string) => string): string {
  const decoder = new TextDecoder();
  return responseMap ? responseMap(decoder.decode(responseMessage)) : decoder.decode(responseMessage);
}

/**
 * avoid hit telegram api rate limit https://core.telegram.org/bots/faq#broadcasting-to-users
 */
async function _editMessageWithCompletionEvery3Seconds(ctx: Context, messageId: number, message: string, lastUpdate: number, isLastMessage = false): Promise<number> {
  const now = Date.now();
  const has2SecondsPassed = now - lastUpdate >= 2000;
  if (isLastMessage || has2SecondsPassed) {
    message += isLastMessage ? '' : '...'
    await ctx.api.editMessageText(ctx.chat!.id, messageId, message, { parse_mode: 'Markdown' })
      .catch(() => {
        console.warn(warnMarkdownErrorMessage, message);
        ctx.api.editMessageText(ctx.chat!.id, messageId, message);
      });
    return now;
  } return lastUpdate;
}

const warnMarkdownErrorMessage = 'Error on markdown parse_mode, message:';