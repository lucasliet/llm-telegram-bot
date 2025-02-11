import { getChatHistory, addChatToHistory } from "../repository/ChatRepository.ts";
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT, StreamReplyResponse } from "../util/ChatConfigUtil.ts";

import { blackboxModels } from "../config/models.ts";

const blackboxMaxTokens = 8000;

const requestOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

export default {
  async generateText(userKey: string, quote: string = '', prompt: string, model = blackboxModels.textModel): Promise<StreamReplyResponse> {
      const geminiHistory = await getChatHistory(userKey);
  
      const requestPrompt = quote ? `"${quote}" ${prompt}`: prompt;
  
      const apiResponse = await fetch(`https://api.blackbox.ai/api/chat`, {
        ...requestOptions,
        body: JSON.stringify({
          messages: [
            { role: "system", content: replaceGeminiConfigFromTone('BlackboxAI', model, blackboxMaxTokens) },
            ...convertGeminiHistoryToGPT(geminiHistory),
            { role: "user", content: requestPrompt }
          ], 
          model,
          max_tokens: blackboxMaxTokens
        })
      });
  
      if (!apiResponse.ok) {
        throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
      }
  
      const reader = apiResponse.body!.getReader();

      const onComplete = (completedAnswer: string) => addChatToHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

      return { reader, onComplete };
  },

  async generateReasoningText(userKey: string, quote: string = '', prompt: string ): Promise<StreamReplyResponse>  {
    return await this.generateText(userKey, quote, prompt, blackboxModels.reasoningModel);
  },

  async generateImage(prompt: string): Promise<string> {
    const apiResponse = await fetch(`https://api.blackbox.ai/api/image-generator`, {
      ...requestOptions,
      body: JSON.stringify({
        query: prompt
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`Failed to generate image: ${apiResponse.statusText}`);
    }

    const { markdown } = await apiResponse.json();

    const imageUrl = markdown.match(/\!\[.*\]\((.*)\)/)[1];

    if (!imageUrl) {
      throw new Error('Failed to extract image URL from response', markdown);
    }

    console.log('blackbox generated image: ', imageUrl);

    return imageUrl;
  }
}