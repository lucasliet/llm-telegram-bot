import { assertEquals, assertStringIncludes } from "asserts";
import { ContextCompressorService } from "@/service/ContextCompressorService.ts";
import { ExpirableContent } from "@/repository/ChatRepository.ts";
import OpenAi from "openai";

Deno.test("ContextCompressorService.compressHistory should use the correct prompt and return summary", async () => {
  const history: ExpirableContent[] = [
    { role: 'user', parts: [{ text: "Oi, meu nome é Lucas." }], createdAt: 123 },
    { role: 'model', parts: [{ text: "Olá Lucas!" }], createdAt: 124 },
    { role: 'user', parts: [{ text: "Gosto de TypeScript." }], createdAt: 125 },
  ];
  const model = "gpt-4o";
  const mockResponseContent = "- Lucas gosta de TypeScript.";

  // Mock OpenAI instance
  const mockOpenAi = {
    chat: {
      completions: {
        create: (params: any) => {
          // Check model
          assertEquals(params.model, model);
          // Check prompt content contains key instructions
          const content = params.messages[0].content;
          assertStringIncludes(content, "You are an expert context compressor");
          assertStringIncludes(content, "Output the summary in Portuguese (pt-BR)");
          assertStringIncludes(content, "Oi, meu nome é Lucas."); // History inclusion

          return Promise.resolve({
            choices: [{ message: { content: mockResponseContent } }]
          });
        }
      }
    }
  } as unknown as OpenAi;

  const result = await ContextCompressorService.compressHistory(history, model, mockOpenAi);

  assertEquals(result.role, 'model');
  assertEquals(result.parts[0].text, `[Resumo do contexto anterior]\n${mockResponseContent}`);
});

Deno.test("ContextCompressorService.compressIfNeeded should return false if tokens are below threshold", async () => {
  const history: ExpirableContent[] = [{ role: 'user', parts: [{ text: "Short message" }], createdAt: Date.now() }];
  const maxTokens = 10000; // High limit
  const model = "gpt-4o";
  const mockOpenAi = {} as unknown as OpenAi;

  const result = await ContextCompressorService.compressIfNeeded(history, maxTokens, model, mockOpenAi);

  assertEquals(result.didCompress, false);
  assertEquals(result.history, history);
});

Deno.test("ContextCompressorService.compressIfNeeded should return true and compressed history if tokens exceed threshold", async () => {
  const longText = "A".repeat(1000); // 1000 chars -> approx 250 tokens (JSON overhead makes it more)
  const history: ExpirableContent[] = [{ role: 'user', parts: [{ text: longText }], createdAt: Date.now() }];
  const maxTokens = 100; // Low limit -> 80 tokens threshold. >80 tokens should trigger compression.
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
  assertEquals(result.history[0].parts[0].text, `[Resumo do contexto anterior]\n${mockResponseContent}`);
});
