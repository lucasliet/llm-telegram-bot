import { assertEquals, assertStringIncludes } from "asserts";
import { ContextCompressorService } from "@/service/ContextCompressorService.ts";
import OpenAi from "openai";

Deno.test("ContextCompressorService.compressHistory should use the correct prompt and return summary", async () => {
  const history: OpenAi.ChatCompletionMessageParam[] = [
    { role: 'user', content: "Oi, meu nome é Lucas." },
    { role: 'assistant', content: "Olá Lucas!" },
    { role: 'user', content: "Gosto de TypeScript." },
  ];
  const model = "gpt-4o";
  const mockResponseContent = "- Lucas gosta de TypeScript.";

  const mockOpenAi = {
    chat: {
      completions: {
        create: (params: any) => {
          assertEquals(params.model, model);
          const content = params.messages[0].content;
          assertStringIncludes(content, "You are an expert context compressor");
          assertStringIncludes(content, "Output the summary in Portuguese (pt-BR)");
          assertStringIncludes(content, "Oi, meu nome é Lucas.");

          return Promise.resolve({
            choices: [{ message: { content: mockResponseContent } }]
          });
        }
      }
    }
  } as unknown as OpenAi;

  const result = await ContextCompressorService.compressHistory(history, model, mockOpenAi);

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
