import { addContentToChatHistory, ExpirableContent, getChatHistory, getVqdHeader, setVqdHeader } from "../repository/ChatRepository.ts";
import { convertGeminiHistoryToGPT, replaceGeminiConfigFromTone, StreamReplyResponse } from "../util/ChatConfigUtil.ts";
import OpenAi from 'npm:openai';

import { duckduckgoModels } from '../config/models.ts';

const { o3mini, haiku } = duckduckgoModels;

const maxTokens = 8000;

const requestHeaders = {
  'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
  'Accept': 'text/event-stream',
  'Accept-Language': 'pt-BR',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Content-Type': 'application/json',
};

export default {
  async generateText(userKey: string, quote: string = '', prompt: string, model: string = o3mini): Promise<StreamReplyResponse> {
    const geminiHistory = await getChatHistory(userKey);    

    const vqdHeader = await getVqdHeader() || await _fetchVqdHeader();

    const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

    const apiResponse = await fetch('https://duckduckgo.com/duckchat/v1/chat', {
      method: 'POST',
      headers: {
        ...requestHeaders,
        'x-vqd-4': vqdHeader
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: `your system prompt: ${replaceGeminiConfigFromTone('DuckDuckGo', model, maxTokens)}` },
          ..._convertChatHistoryToDuckDuckGo(geminiHistory),
          { role: 'user', content: requestPrompt }
        ],
        model
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
    }

    const reader = apiResponse.body!.getReader();

    const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

    return { reader, onComplete, responseMap };
  },
  generateTextClaude(userKey: string, quote: string = '', prompt: string): Promise<StreamReplyResponse> {
    return this.generateText(userKey, quote, prompt, haiku);
  }
}

async function _fetchVqdHeader(): Promise<string> {
  const statusResponse = await fetch('https://duckduckgo.com/duckchat/v1/status', {
    method: 'GET',
    headers: {
      ...requestHeaders,
      'x-vqd-accept': 1
    }
  });

  if (!statusResponse.ok) {
    throw new Error(`Failed to check status: ${statusResponse.statusText}`);
  }

  const header = statusResponse.headers.get('x-vqd-4')

  if(!header) {
    throw new Error('Failed to fetch duckduckgo x-vqd-4 header')
  }

  setVqdHeader(header);

  return header;
}

function _convertChatHistoryToDuckDuckGo(geminiHistory: ExpirableContent[]): OpenAi.Chat.Completions.ChatCompletionMessageParam[] {
  return convertGeminiHistoryToGPT(geminiHistory).map(history => (
    { content: `${history.role === 'assistant' ? 'your last answer, assistant:' + history.content : history.content}`, role: 'user' }
  ))
}

function responseMap(responseBody: string): string {
  const lines = responseBody.split('\n');
  let result = '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        result += JSON.parse(line.split('data: ')[1])?.message || '';
      } catch {
        continue;
      }
    }
  }
  
  return result;
}