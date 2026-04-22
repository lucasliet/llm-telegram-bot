import { assertEquals, assertStringIncludes } from "asserts";
import { ContextCompressorService } from "@/service/ContextCompressorService.ts";
import OpenAi from "openai";

Deno.test("ContextCompressorService.compressHistory should use the correct prompt and return summary", async () => {
  const history: OpenAi.ChatCompletionMessageParam[] = [
    { role: 'user', content: "Oi, meu nome é Lucas." },
    { role: 'assistant', content: "Olá Lucas!" },
    { role: 'user', content: "Gosto de TypeScript." },
  ];
  const mockResponseContent = "- Lucas gosta de TypeScript.";

  const mockService = {
    generateText: async (_userKey: string, _quote: string, prompt: string) => {
      assertStringIncludes(prompt, "You are an expert context compressor");
      assertStringIncludes(prompt, "Output the summary in Portuguese (pt-BR)");
      assertStringIncludes(prompt, "Oi, meu nome é Lucas.");

      const encoder = new TextEncoder();
      const chunk = JSON.stringify({ choices: [{ delta: { content: mockResponseContent } }] });
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(chunk + "\n"));
          controller.close();
        },
      });

      return {
        reader: stream.getReader(),
        responseMap: (body: string) => {
          try {
            return JSON.parse(body).choices[0]?.delta?.content || "";
          } catch {
            return "";
          }
        },
      };
    },
  };

  const result = await ContextCompressorService.compressHistory(history, mockService as any, 'test-user-key');

  assertEquals(result.role, 'assistant');
  assertEquals((result as any).content, `[Resumo do contexto anterior]\n${mockResponseContent}`);
});

Deno.test("ContextCompressorService.compressIfNeeded should return false if tokens are below threshold", async () => {
  const history: OpenAi.ChatCompletionMessageParam[] = [{ role: 'user', content: "Short message" }];
  const maxTokens = 10000;
  const model = "gpt-4o";
  const mockOpenAi = {} as unknown as OpenAi;

  const result = await ContextCompressorService.compressIfNeeded(history, maxTokens, model, mockOpenAi);

  assertEquals(result.didCompress, false);
  assertEquals(result.history, history);
});

Deno.test("ContextCompressorService.compressIfNeeded should return true and compressed history if tokens exceed threshold", async () => {
  const longText = "A".repeat(1000);
  const history: OpenAi.ChatCompletionMessageParam[] = [{ role: 'user', content: longText }];
  const maxTokens = 100;
  const model = "gpt-4o";
  const mockResponseContent = "Compressed summary";

  const mockOpenAi = {
    chat: {
      completions: {
        create: () => Promise.resolve({
          choices: [{ message: { content: mockResponseContent } }]
        })
      }
    }
  } as unknown as OpenAi;

  const result = await ContextCompressorService.compressIfNeeded(history, maxTokens, model, mockOpenAi);

  assertEquals(result.didCompress, true);
  assertEquals(result.history.length, 1);
  assertEquals((result.history[0] as any).content, `[Resumo do contexto anterior]\n${mockResponseContent}`);
});
