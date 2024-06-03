import { GoogleGenerativeAI, GenerativeModel, Content, ChatSession, GenerationConfig } from 'npm:@google/generative-ai'
import { Base64 } from 'https://deno.land/x/bb64/mod.ts';
import { getChatHistory, getUserGeminiApiKeys } from '../repository/ChatRepository.ts';
import { addChatToHistory } from '../repository/ChatRepository.ts';


export default class GeminiService {
  private userKey: string;
  private genAi: GoogleGenerativeAI;
  private model: GenerativeModel;
  private static geminiModel = 'gemini-1.5-flash';

  private constructor(userKey: string, genAi: GoogleGenerativeAI) {
    this.userKey = userKey;
    this.genAi = genAi;
    this.model = this.genAi.getGenerativeModel({ model: GeminiService.geminiModel });
  }

  static async of(userKey: string): Promise<GeminiService> {
    const apiKey = await getUserGeminiApiKeys(userKey);
    return new GeminiService(userKey, new GoogleGenerativeAI(apiKey));
  }

  static tone(): string {
    return `
      Eu sou Gemini, um modelo de linguagem de IA muito prestativo. Estou usando o modelo ${GeminiService.geminiModel} 
      e estou hospedado em um bot do cliente de mensagens Telegram.
      Minha configuração de geração é: ${JSON.stringify(GeminiService.buildGenerationConfig())},
      então tentarei manter minhas respostas curtas e diretas para obter melhores resultados. 
      Com o máximo de ${GeminiService.buildGenerationConfig().maxOutputTokens} tokens de saída,
      caso eu pretenda responder mensagens maiores do que isso, terminarei a mensagem com '...' 
      indicando que a você pedir caso deseja que eu continue a mensagem.

      Considerando que estou hospedado em um bot de mensagens, devo evitar estilizações markdown tradicionais
      e usar as do telegram no lugar.
      Por exemplo:
      *bold* -> **bold**,
      _italic_ -> __italic__,
      ~strikethrough~ -> ~~strikethrough~~,
      hidden message / spoiler -> ||hidden message / spoiler||,
      monospace -> \`code\`,
      \`\`\`python
      code block
      \`\`\` -> \`\`\`python
      code block
      \`\`\`
      Se eu tiver dúvidas, consultarei a documentação do markdown do Telegram ou usarei tags HTML.

      Usarei à vontade as estilizações de texto e emojis para tornar a conversa mais agradável e natural.
      Sempre tentarei terminar as mensagens com emojis.
    `;
  }

  async sendTextMessage(prompt: string): Promise<string> {
    const history = await getChatHistory(this.userKey);
    const chat = GeminiService.buildChat(this.model, history);
    
    const response = (await chat.sendMessage(prompt)).response.text();
    await addChatToHistory(await chat.getHistory(), this.userKey);
    return response;
  }
; 
  async sendPhotoMessage(photoUrls: Promise<string>[], prompt: string): Promise<string> {
    const history = await getChatHistory(this.userKey);
    const chat = GeminiService.buildChat(this.model, history);
    const urls = await Promise.all(photoUrls);
    const imageParts = await Promise.all(urls.map(this.fileToGenerativePart));

    const response = (await chat.sendMessage([prompt, ...imageParts])).response.text();
    await addChatToHistory(await chat.getHistory(), this.userKey);
    return response;
  }

  private static buildChat(model: GenerativeModel, history: Content[]): ChatSession {
    return model.startChat({
      history,
      generationConfig: GeminiService.buildGenerationConfig()
    });
  }

  private static buildGenerationConfig(): GenerationConfig {
    return {
      maxOutputTokens: 500,
      topP: 0.9,
      temperature: 0.8
    };
  }

  private async fileToGenerativePart(url: string) {
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