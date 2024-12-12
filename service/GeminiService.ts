import { GoogleGenerativeAI, GenerativeModel, Content, ChatSession, GenerationConfig, InlineDataPart, HarmCategory, SafetySetting } from 'npm:@google/generative-ai'
import { Base64 } from "https://deno.land/x/bb64@1.1.0/mod.ts";
import { getChatHistory, getUserGeminiApiKeys } from '../repository/ChatRepository.ts';
import { addContentToChatHistory } from '../repository/ChatRepository.ts';
import { ApiKeyNotFoundError } from '../error/ApiKeyNotFoundError.ts';
import { HarmBlockThreshold } from 'npm:@google/generative-ai';
import { geminiModel } from '../config/models.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') as string;

export default class GeminiService {
  private userKey: string;
  private genAi: GoogleGenerativeAI;
  private model: GenerativeModel;

  private constructor(userKey: string, genAi: GoogleGenerativeAI) {
    this.userKey = userKey;
    this.genAi = genAi;
    this.model = this.genAi.getGenerativeModel({
       model: geminiModel, 
       safetySettings: GeminiService.buildSafetySettings(),
       systemInstruction: GeminiService.tone(geminiModel)
    });
  }

  static async of(userKey: string): Promise<GeminiService> {
    try {
      const apiKey = await getUserGeminiApiKeys(userKey);
      return new GeminiService(userKey, new GoogleGenerativeAI(apiKey));
    } catch (err) {
      if (err instanceof ApiKeyNotFoundError) {
        return new GeminiService(userKey, new GoogleGenerativeAI(GEMINI_API_KEY));
      }
      throw err;
    }
  }

  static getModel(): string {
    return geminiModel;
  }

  static tone(model: string): string {
    return `
      Eu sou Gemini, um modelo de linguagem de IA muito prestativo. Estou usando o modelo ${model} 
      e estou hospedado em um bot do cliente de mensagens Telegram.
      Minha configuração de geração é: ${JSON.stringify(GeminiService.buildGenerationConfig())},
      então tentarei manter minhas respostas curtas e diretas para obter melhores resultados. 
      Com o máximo de ${GeminiService.buildGenerationConfig().maxOutputTokens} tokens de saída,
      caso eu pretenda responder mensagens maiores do que isso, terminarei a mensagem com '...' 
      indicando que a você pedir caso deseja que eu continue a mensagem.
      minhas configurações de sefetismo são: ${JSON.stringify(GeminiService.buildSafetySettings())}.` +

      // `Considerando que estou hospedado em um bot de mensagens, devo evitar estilizações markdown tradicionais
      // e usar as do telegram no lugar.
      // Por exemplo:
      // *bold* -> **bold**,
      // _italic_ -> __italic__,
      // ~strikethrough~ -> ~~strikethrough~~,
      // hidden message / spoiler -> ||hidden message / spoiler||,
      // monospace -> \`code\`,
      // \`\`\`python
      // code block
      // \`\`\` -> \`\`\`python
      // code block
      // \`\`\`
      // Se eu tiver dúvidas, consultarei a documentação do markdown do Telegram ou usarei tags HTML.` +

      `Usarei à vontade as estilizações de texto e emojis para tornar a conversa mais agradável e natural.
      Sempre tentarei terminar as mensagens com emojis.
    `;
  }

  async sendTextMessage(quote: string = '', prompt: string): Promise<string> {
    const history = await getChatHistory(this.userKey);
    const chat = GeminiService.buildChat(this.model, history);
    const message = quote ? [quote, prompt] : [prompt];
    const response = (await chat.sendMessage(message)).response.text();
    await addContentToChatHistory(await chat.getHistory(), this.userKey);
    return response;
  }
  ;
  async sendPhotoMessage(quote: string = '', photoUrls: Promise<string>[], prompt: string): Promise<string> {
    const history = await getChatHistory(this.userKey);
    const chat = GeminiService.buildChat(this.model, history);
    const urls = await Promise.all(photoUrls);
    const imageParts = await Promise.all(urls.map(this.fileToGenerativePart));

    const response = (await chat.sendMessage([quote, prompt, ...imageParts])).response.text();
    await addContentToChatHistory(await chat.getHistory(), this.userKey);
    return response;
  }

  private static buildChat(model: GenerativeModel, history: Content[]): ChatSession {
    return model.startChat({
      history,
      generationConfig: GeminiService.buildGenerationConfig()
    });
  }

  static buildGenerationConfig(): GenerationConfig {
    return {
      maxOutputTokens: 1000,
      topP: 0.9,
      temperature: 0.8
    };
  }

  private static buildSafetySettings(): SafetySetting[] {
    return [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      }
    ]
  }

  private async fileToGenerativePart(url: string): Promise<InlineDataPart> {
    const response = await fetch(url);
    const byteArray = (await response.body?.getReader().read())!.value!;
    return {
      inlineData: {
        data: Base64.fromUint8Array(byteArray).toString(),
        mimeType: 'image/jpeg'
      },
    };
  }
}
