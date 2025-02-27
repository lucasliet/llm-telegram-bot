import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.214.0/assert/mod.ts";
import {
  afterEach,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.214.0/testing/bdd.ts";
import { assertSpyCalls, spy, Spy } from "https://deno.land/std@0.214.0/testing/mock.ts";
import BlackboxaiService from "../../src/service/BlackboxaiService.ts";

describe("BlackboxaiService", () => {
  let mockFetch: Spy;
  const originalFetch = globalThis.fetch;
  
  beforeEach(() => {
    // Setup mock fetch before each test
    mockFetch = spy(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        markdown: "![Generated Image](https://example.com/image.png)",
        choices: [{ message: { content: "Generated text response" } }]
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Generated text response"));
          controller.close();
        }
      })
    }));
    
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("generateText", () => {
    it("should generate text successfully", async () => {
      const response = await BlackboxaiService.generateText(
        "test-user-key",
        "test quote",
        "Hello",
        "gpt-3.5-turbo"
      );

      // Verify response has reader and onComplete
      assertEquals(typeof response.reader.read, "function");
      assertEquals(typeof response.onComplete, "function");
      
      // Verify API call
      assertSpyCalls(mockFetch, 1);
      const [url, options] = mockFetch.calls[0].args;
      assertEquals(url, "https://www.blackbox.ai/api/chat");
      assertEquals(options.method, "POST");
      
      const body = JSON.parse(options.body);
      assertEquals(body.messages[body.messages.length - 1].content, 'quote: "test quote"\n\nHello');
    });

    it("should handle API errors", async () => {
      globalThis.fetch = spy(() => Promise.resolve({
        ok: false,
        statusText: "Unauthorized"
      }));

      await assertRejects(
        () => BlackboxaiService.generateText("test-user-key", "", "Hello"),
        Error,
        "Failed to generate text: Unauthorized"
      );
    });
  });

  describe("generateImage", () => {
    it("should generate image successfully", async () => {
      const imageUrl = await BlackboxaiService.generateImage("A test prompt");
      
      assertEquals(imageUrl, "https://example.com/image.png");
      assertSpyCalls(mockFetch, 1);
      
      const [url, options] = mockFetch.calls[0].args;
      assertEquals(url, "https://api.blackbox.ai/api/image-generator");
      assertEquals(options.method, "POST");
      
      const body = JSON.parse(options.body);
      assertEquals(body.query, "A test prompt");
    });

    it("should handle API errors", async () => {
      globalThis.fetch = spy(() => Promise.resolve({
        ok: false,
        statusText: "Bad Request"
      }));

      await assertRejects(
        () => BlackboxaiService.generateImage("A test prompt"),
        Error,
        "Failed to generate image: Bad Request"
      );
    });
  });
});

