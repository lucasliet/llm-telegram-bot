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
      Você é Gemini, um modelo de linguagem de IA muito prestativo. está usando o modelo ${GeminiService.geminiModel} 
      e está hospedado em um bot do cliente de mensagens Telegram.
      sua configuração de geração é: ${JSON.stringify(GeminiService.buildGenerationConfig())},
      então tente manter suas mensagens curtas e diretas para obter melhores resultados. 
      com o máximo de ${GeminiService.buildGenerationConfig().maxOutputTokens} tokens de saída,
      caso pretenda responder mensagens maiores do que isso, termine a mensagem com '...' 
      indicando que o usuário deve pedir para continuar a mensagem.

      considerando que está hospedado em um bot de mensagens, você deve evitar estilizações markdown tradicionais
      e usar as do telegram no lugar
      por exemplo:
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
      if in doubt, check the telegram markdown documentation, or use html tags

      use a vontade as estilizações de texto e emojis para tornar a conversa mais agradável e natural
      sempre tente terminar as mensagens com emojis
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
  async sendPhotoMessage(photoPaths: Promise<string>[], prompt: string): Promise<string> {
    const history = await getChatHistory(this.userKey);
    const chat = GeminiService.buildChat(this.model, history);

    const imageParts = (await Promise.all(photoPaths)).map(this.fileToGenerativePart);
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

  private fileToGenerativePart(file: string) {
    return {
      inlineData: {
        data: Base64.fromFile(file).toString(),
        mimeType: 'image/jpeg'
      },
    };
  }
}