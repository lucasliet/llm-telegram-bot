import { getChatHistory } from "../repository/ChatRepository.ts";
import { convertGeminiHistoryToGPT, replaceGeminiConfigFromTone } from "../util/ChatConfigUtil.ts";

const CLOUDFLARE_ACCOUNT_ID: string = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') as string;
const CLOUDFLARE_API_KEY: string = Deno.env.get('CLOUDFLARE_API_KEY') as string;

const imageModel = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
const textModel = '@cf/meta/llama-3.2-3b-instruct';
const sqlModel = '@cf/defog/sqlcoder-7b-2'
const codeModel = '@hf/thebloke/deepseek-coder-6.7b-instruct-awq';

const cloudFlareMaxTokens = 140;

const requestOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`
  }
};

export default {
  async generateImage(prompt: string): Promise<ArrayBuffer> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`, {
      ...requestOptions,
      body: `{"prompt": "${this.escapeMessageQuotes(prompt)}"}`
    });

    if (!response.ok) {
      console.error(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`,
        { ...requestOptions, body: `{"prompt": "${this.escapeMessageQuotes(prompt)}"}` },
        response.statusText
      )
      throw new Error(`Failed to generate image: ${response.statusText}}`);
    }
    return await response.arrayBuffer();
  },
  async generateText(userKey: string, quote: string = '', prompt: string, model: string = textModel): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const apiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
      ...requestOptions,
      body: JSON.stringify({
        messages: [
          { role: "system", content: replaceGeminiConfigFromTone('Llama', textModel, cloudFlareMaxTokens) },
          ...convertGeminiHistoryToGPT(geminiHistory),
          { role: "user", content: `"${this.escapeMessageQuotes(quote)}" ${this.escapeMessageQuotes(prompt)}` }
        ], max_tokens: cloudFlareMaxTokens
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
    }

    const { result: { response } } = await apiResponse.json();
    return response;
  },
  async generateSQL(userKey: string, quote: string = '', prompt: string): Promise<string> {
    return await this.generateText(userKey, quote, prompt, sqlModel);
  },
  async generateCode(userKey: string, quote: string = '', prompt: string): Promise<string> {
    return await this.generateText(userKey, quote, prompt, codeModel);
  },
  escapeMessageQuotes(message: string): string {
    return message.replace(/"/g, '\\"');
  }
}
