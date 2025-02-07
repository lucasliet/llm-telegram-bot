import { getChatHistory, addChatToHistory } from "../repository/ChatRepository.ts";
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT } from "../util/ChatConfigUtil.ts";

import { blackboxModels } from "../config/models.ts";

const blackboxMaxTokens = 1000;

const requestOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

export default {
  async generateText(userKey: string, quote: string = '', prompt: string, model = blackboxModels.textModel): Promise<string> {
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
  
      const response = await apiResponse.text();
  
      addChatToHistory(geminiHistory, quote, requestPrompt, response, userKey);
  
      return response;
  },

  async generateReasoningText(userKey: string, quote: string = '', prompt: string ): Promise<string> {
    return await this.generateText(userKey, quote, prompt, blackboxModels.reasoningModel);
  }
}