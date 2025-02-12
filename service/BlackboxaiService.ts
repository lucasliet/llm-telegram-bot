import { getChatHistory, addContentToChatHistory } from "../repository/ChatRepository.ts";
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT, StreamReplyResponse } from "../util/ChatConfigUtil.ts";

import { blackboxModels } from "../config/models.ts";

const blackboxMaxTokens = 8000;

const requestOptions = {
  method: 'POST',
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
    'Content-Type': 'application/json',
    'Origin': 'https://www.blackbox.ai'
  }
};

export default {
  async generateText(userKey: string, quote: string = '', prompt: string, model = blackboxModels.textModel): Promise<StreamReplyResponse> {
      const geminiHistory = await getChatHistory(userKey);

      const [ id, modelName ] = model.split('/');
  
      const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;  

      const apiResponse = await fetch(`https://www.blackbox.ai/api/chat`, {
        ...requestOptions,
        body: JSON.stringify({
          messages: [
            { role: "system", content: replaceGeminiConfigFromTone('BlackboxAI', model, blackboxMaxTokens) },
            ...convertGeminiHistoryToGPT(geminiHistory),
            { role: "user", content: requestPrompt }
          ], 
          agentMode: {
            mode: true,
            id,
            name: modelName
          },  
          maxTokens: blackboxMaxTokens,
          deepSearchMode: true,
          isPremium: true,
          webSearchModePrompt: true,
          trendingAgentMode: {},
          validated: '00f37b34-a166-4efb-bce5-1312d87f2f94'
        })
      });
  
      if (!apiResponse.ok) {
        throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
      }
  
      const reader = apiResponse.body!.getReader();

      const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

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
