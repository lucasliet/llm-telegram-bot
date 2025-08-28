import OpenAi, { toFile } from 'npm:openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, mapChatToolsToResponsesTools, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import ToolService from '@/service/ToolService.ts';
import * as path from 'jsr:@std/path';
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { openAIModels } from '@/config/models.ts';

export default class ResponsesService {
  protected openai: OpenAi;
  protected model: string;
  protected maxTokens: number;
  protected supportTools: boolean;
  protected chatName: string;

  /**
   * Creates a new Responses-based service.
   * @param openai - Preconfigured OpenAI client instance.
   * @param model - Default model identifier.
   * @param supportTools - Whether to enable tool/function calling.
   * @param maxTokens - Maximum output tokens.
   * @param chatName - Name used in system prompt.
   */
  public constructor(
    openai: OpenAi = new OpenAi(),
    model: string,
    supportTools: boolean = true,
    maxTokens: number = 8000,
    chatName: string = 'OpenAI',
  ) {
    this.openai = openai;
    this.model = model;
    this.supportTools = supportTools;
    this.maxTokens = maxTokens;
    this.chatName = chatName;
  }

  /**
   * Generates a text response using the Responses API with SSE streaming.
   * @param userKey - User identifier for chat history persistence.
   * @param quote - Optional quoted message to prepend to the prompt.
   * @param prompt - User prompt text.
   * @returns StreamReplyResponse object with the stream reader and completion callback.
   */
  async generateText(
    userKey: string,
    quote: string = '',
    prompt: string,
  ): Promise<StreamReplyResponse> {
    const history = await getChatHistory(userKey);
    const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

    const system = getSystemPrompt(this.chatName, this.model, this.maxTokens);
    const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...convertGeminiHistoryToGPT(history),
      { role: 'user', content: requestPrompt },
    ];

    const responsesTools = this.supportTools
      ? mapChatToolsToResponsesTools(ToolService.schemas)
      : [];

    const req: any = {
      model: this.model,
      instructions: await this.getInstructions(),
      input: messages,
      store: false,
    };

    if (responsesTools.length > 0) {
      req.tools = responsesTools;
      req.tool_choice = 'auto';
      req.parallel_tool_calls = false;
    }

    const initialStream = this.openai.responses.stream(req);
    const initialReader = toReader(initialStream) as ReadableStreamDefaultReader<Uint8Array>;

    const reader = executeToolCalls(
      generateFollowupResponse,
      initialReader,
      messages,
      this.openai,
      this.model,
      await this.getInstructions(),
      responsesTools,
    );

    const onComplete = (completedAnswer: string) =>
      addContentToChatHistory(
        history,
        quote,
        requestPrompt,
        completedAnswer,
        userKey,
      );

    return { reader, onComplete, responseMap };
  }

  /**
   * Generates a text response using image inputs with the Responses API.
   * @param userKey - User identifier for chat history persistence.
   * @param quote - Optional quoted message to prepend to the prompt.
   * @param photosUrl - Array of image URLs or base64 promises.
   * @param prompt - User prompt text.
   * @param usePhotoBase64 - When true, fetches images and converts to data URLs.
   * @returns StreamReplyResponse with stream reader and completion callback.
   */
  async generateTextFromImage(
    userKey: string,
    quote: string = '',
    photosUrl: Promise<string>[],
    prompt: string,
    usePhotoBase64: boolean = false,
  ): Promise<StreamReplyResponse> {
    const history = await getChatHistory(userKey);
    const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;
    const urls = usePhotoBase64 ? await getImageBase64String(photosUrl) : await Promise.all(photosUrl);

    const system = getSystemPrompt(this.chatName, this.model, this.maxTokens);
    const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...convertGeminiHistoryToGPT(history),
      {
        role: 'user',
        content: [
          { type: 'text', text: requestPrompt },
          ...urls.map((photoUrl) => ({ type: 'image_url', image_url: { url: photoUrl } } as const)),
        ],
      },
    ];

    const responsesTools = this.supportTools ? mapChatToolsToResponsesTools(ToolService.schemas) : [];

    const req: any = {
      model: this.model,
      instructions: await this.getInstructions(),
      input: messages,
      store: false,
    };
    if (responsesTools.length > 0) {
      req.tools = responsesTools;
      req.tool_choice = 'auto';
      req.parallel_tool_calls = false;
    }

    const initialStream = this.openai.responses.stream(req);
    const initialReader = toReader(initialStream) as ReadableStreamDefaultReader<Uint8Array>;

    const reader = executeToolCalls(
      generateFollowupResponse,
      initialReader,
      messages,
      this.openai,
      this.model,
      await this.getInstructions(),
      responsesTools,
    );

    const onComplete = (completedAnswer: string) =>
      addContentToChatHistory(history, quote, requestPrompt, completedAnswer, userKey);

    return { reader, onComplete, responseMap };
  }

  /**
   * Generates images using the Images API, returning their URLs.
   * @param userKey - User identifier.
   * @param prompt - Text prompt for image generation.
   * @param style - Visual style preference.
   * @returns Array of image URLs.
   */
  async generateImage(
    userKey: string,
    prompt: string,
    style: 'vivid' | 'natural' = 'vivid',
  ): Promise<string[]> {
    const { imageModel } = openAIModels;
    const response = await this.openai.images.generate({
      model: imageModel,
      prompt,
      quality: 'standard',
      size: '1024x1024',
      n: 1,
      response_format: 'url',
      user: userKey,
      style,
    });
    const imageUrls = response.data?.map((image: OpenAi.Images.Image) => image.url!);
    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('No images generated.');
    }
    return imageUrls;
  }

  /**
   * Transcribes audio to text using the Audio Transcriptions API.
   * @param audioFile - Audio bytes as a promise.
   * @param audioFileUrl - Original audio file URL to infer extension.
   * @returns Transcribed text.
   */
  async transcribeAudio(
    audioFile: Promise<Uint8Array>,
    audioFileUrl: string,
  ): Promise<string> {
    const { sttModel } = openAIModels;
    const response = await this.openai.audio.transcriptions.create({
      file: await toFile(audioFile, path.extname(audioFileUrl)),
      model: sttModel,
    });
    return response.text;
  }

  /**
   * Returns optional instructions for the Responses API system prompt.
   * Subclasses can override to provide domain-specific instructions.
   * @returns Instructions text.
   */
  // deno-lint-ignore require-await
  protected async getInstructions(): Promise<string> {
    return '';
  }
}

/**
 * Maps a streamed JSON chunk to plain text, handling both Chat and Responses shapes.
 * @param responseBody - Raw JSON line.
 * @returns Extracted delta text content.
 *
 */
export function responseMap(responseBody: string): string {
  try {
    const obj = JSON.parse(responseBody);
    if (obj?.choices?.[0]?.delta?.content) return obj.choices[0].delta.content;
    if (obj?.type === 'response.output_text.delta' && typeof obj?.delta === 'string') return obj.delta;
    if (typeof obj?.output_text === 'string') return obj.output_text;
    return '';
  } catch {
    return '';
  }
}

/**
 * Combines the initial stream with optional follow-up after tool calls.
 * @param generateText - Function that generates a follow-up reader from messages.
 * @param initialReader - Reader for the initial stream.
 * @param messages - Original conversation messages.
 * @param generateTextArgs - Extra args forwarded to generateText.
 * @returns A reader that yields all chunks.
 */
export function executeToolCalls(
  generateText: (
    messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[],
    ...args: any[]
  ) => ReadableStreamDefaultReader<Uint8Array>,
  initialReader: ReadableStreamDefaultReader<Uint8Array>,
  messages: OpenAi.Chat.ChatCompletionMessageParam[],
  ...generateTextArgs: any[]
) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const tool_calls = await readInitialStreamAndExtract(initialReader, controller);
        if (tool_calls.length > 0) {
          await handleFunctionCallFollowUp(generateText, messages, tool_calls, controller, ...generateTextArgs);
        }
      } catch (e) {
        const errorMessage = `Eita, algo deu errado: ${e instanceof Error ? e.message : e}`;
        const openAiContent = JSON.stringify({
          choices: [
            {
              delta: {
                content: errorMessage,
              },
            },
          ],
        });
        controller.enqueue(new TextEncoder().encode(openAiContent));
      } finally {
        controller.close();
      }
    },
  }).getReader();
}

/**
 * Reads initial stream, forwards chunks, and extracts tool calls when present.
 * @param initialReader - Reader for the initial stream.
 * @param controller - Output stream controller.
 * @returns Detected tool calls.
 */
async function readInitialStreamAndExtract(
  initialReader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<OpenAi.Chat.Completions.ChatCompletionMessageToolCall[]> {
  const tool_calls: OpenAi.Chat.Completions.ChatCompletionMessageToolCall[] = [];
  while (true) {
    const { done, value } = await initialReader.read();
    if (done) break;
    controller.enqueue(value);
    try {
      const text = new TextDecoder().decode(value);
      const parsed = JSON.parse(text);

      const fromChoices = parsed?.choices?.[0]?.delta?.tool_calls;
      if (Array.isArray(fromChoices) && fromChoices.length > 0) {
        for (const call of fromChoices) {
          const index = call?.index || 0;
          if (!tool_calls[index]) tool_calls[index] = call;
          try {
            if (!tool_calls[index].function.arguments || JSON.parse(tool_calls[index].function.arguments)) {
              JSON.parse(call.function.arguments);
            }
            tool_calls[index].function.arguments = call.function.arguments;
          } catch {
            tool_calls[index].function.arguments += call.function.arguments;
          }
        }
        continue;
      }

      const t = parsed?.type as string | undefined;
      if (t && typeof t === 'string' && t.includes('function') && parsed?.delta) {
        const id = parsed?.id || parsed?.call_id || 0;
        const index = Number(parsed?.index || 0);
        if (!tool_calls[index]) {
          tool_calls[index] = {
            id,
            type: 'function',
            index,
            function: {
              name: parsed?.name || '',
              arguments: '',
            },
          } as unknown as OpenAi.Chat.Completions.ChatCompletionMessageToolCall;
        }
        if (typeof parsed?.delta === 'string') {
          tool_calls[index].function.arguments = (tool_calls[index].function.arguments || '') + parsed.delta;
        }
        if (typeof parsed?.name === 'string' && parsed.name) {
          tool_calls[index].function.name = parsed.name;
        }
      }
    } catch (e) {
      console.error('Error decoding initial chunk:', e);
      throw e;
    }
  }
  return tool_calls;
}

/**
 * Executes tool calls, appends results to messages, and streams follow-up.
 * @param generateText - Function to generate the follow-up reader.
 * @param messages - Mutable messages array to append tool results.
 * @param tool_calls - Detected tool calls.
 * @param controller - Output controller to forward follow-up chunks.
 * @param generateTextArgs - Extra args forwarded to generateText.
 */
async function handleFunctionCallFollowUp(
  generateText: (
    messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[],
    ...args: any[]
  ) => ReadableStreamDefaultReader<Uint8Array>,
  messages: OpenAi.Chat.ChatCompletionMessageParam[],
  tool_calls: OpenAi.Chat.Completions.ChatCompletionMessageToolCall[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  ...generateTextArgs: any[]
) {
  for (const tool_call of tool_calls) {
    const fnName = tool_call.function.name;
    let args = null;
    try {
      args = JSON.parse(tool_call.function.arguments);
    } catch {
      console.error('Error parsing function arguments:', tool_call);
      continue;
    }

    const fn = ToolService.tools.get(fnName)?.fn;
    if (!fn) {
      console.error(`Function ${fnName} not found.`);
      continue;
    }
    const result = await fn(args);
    messages.push({
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: tool_call.id ?? null,
          function: {
            name: fnName,
            arguments: tool_call.function.arguments,
          },
        },
      ],
    } as unknown as OpenAi.Chat.ChatCompletionMessageParam);
    messages.push({
      tool_call_id: tool_call.id ?? null,
      role: 'tool',
      type: 'function_tool_output',
      name: fnName,
      content: JSON.stringify(result),
    } as unknown as OpenAi.Chat.ChatCompletionMessageParam);
  }

  const followupReader = await generateText(messages, ...generateTextArgs);
  while (true) {
    const { done, value } = await followupReader.read();
    if (done) break;
    controller.enqueue(value);
  }
}

/**
 * Converts a Responses stream to a web ReadableStream reader.
 * @param stream - The SDK ResponseStream instance or async iterable.
 * @returns A reader producing Uint8Array chunks.
 */
function toReader(stream: any) {
  if (stream && typeof stream.toReadableStream === 'function') {
    return stream.toReadableStream().getReader();
  }
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          const encoded = new TextEncoder().encode(JSON.stringify(event));
          controller.enqueue(encoded);
        }
      } finally {
        controller.close();
      }
    },
  }).getReader();
}

function generateFollowupResponse(
  messages: OpenAi.Chat.ChatCompletionMessageParam[],
  openai: OpenAi,
  model: string,
  instructions: string,
  responsesTools: OpenAi.Responses.Tool[],
): ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> {
  const req: any = {
    model,
    instructions,
    input: messages,
    store: false,
  };
  if (responsesTools.length > 0) {
    req.tools = responsesTools;
    req.tool_choice = 'auto';
    req.parallel_tool_calls = false;
  }
  return toReader(openai.responses.stream(req)) as ReadableStreamDefaultReader<Uint8Array>;
}

/**
 * Converts an array of image URLs to base64 data URLs.
 * @param photoUrls - Promises of image URLs.
 * @returns Array of data URLs or original URLs on failure.
 */
function getImageBase64String(
  photoUrls: Promise<string>[],
): Promise<string[]> {
  const promises = photoUrls.map(async (photoUrl) => {
    try {
      const response = await fetch(await photoUrl);
      if (!response.ok) {
        return photoUrl;
      }
      const arrayBuffer = await response.arrayBuffer();
      const base64String = encodeBase64(arrayBuffer);
      const extension = path.extname(await photoUrl).toLowerCase();
      const ext = extension.slice(1).toLowerCase();
      const mimeType = ext && ext !== 'jpg' ? `image/${ext}` : 'image/jpeg';
      return `data:${mimeType};base64,${base64String}`;
    } catch {
      return photoUrl;
    }
  });
  return Promise.all(promises);
}
