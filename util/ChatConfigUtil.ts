import { Content } from "npm:@google/generative-ai";
import OpenAi from 'npm:openai';
import GeminiService from "../service/GeminiService.ts";
import { ExpirableContent } from "../repository/ChatRepository.ts";

export function convertGeminiHistoryToGPT(history: ExpirableContent[]): OpenAi.Chat.Completions.ChatCompletionMessageParam[]{
  return history.map(content => {
    return {
      role: content.role === 'user' ? 'user' : 'assistant',
      content: content.parts.map(part => part.text).join(' ')
    };
  });
}

export function removeExpirationFromHistory(history: ExpirableContent[]): Content[] {
  // deno-lint-ignore no-unused-vars
  return history.map(({ createdAt, ...content }) => content);
}

export function replaceGeminiConfigFromTone(chatName: string, model: string, maxTokens: number): string {
  return GeminiService.tone(model)
    .replace(/Gemini/gi, chatName)
    .replace(`${GeminiService.buildGenerationConfig().maxOutputTokens}`, `${maxTokens}`);
}

export interface StreamReplyResponse {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  onComplete: (completedAnswer: string) => Promise<void>;
  responseMap?: (responseBody: string) => string
}