import { assertEquals } from "asserts";
import { spy } from "mock";
import { mockDenoEnv } from "../test_helpers.ts";
Deno.test(
  "GithubCopilotHandler forwards to service with chosen model",
  async () => {
    const originalOpenKv = Deno.openKv;
    mockDenoEnv({ OPENAI_API_KEY: "x", COPILOT_GITHUB_TOKEN: "z" });
    Deno.openKv = () =>
      Promise.resolve({
        get: () => Promise.resolve({ value: [] }),
        set: () => Promise.resolve({ ok: true }),
        delete: () => Promise.resolve({ ok: true }),
        close: () => Promise.resolve(),
      } as any);
    try {
      const ctx: any = {
        streamReply: spy(() => Promise.resolve()),
        extractContextKeys: spy(() =>
          Promise.resolve({
            userKey: "user:1",
            contextMessage: "gpt: hi",
            photos: undefined,
            caption: undefined,
            quote: undefined,
          }),
        ),
        message: { message_id: 3 },
      };
      await import("../../src/service/TelegramService.ts");
      const mod = await import("../../src/handlers/GithubCopilotHandler.ts");
      const svc =
        await import("../../src/service/openai/GithubCopilotService.ts");
      (svc.default as any).prototype.generateText = spy(() =>
        Promise.resolve({
          reader: new ReadableStream().getReader(),
          onComplete: () => Promise.resolve(),
          responseMap: (s: string) => s,
        }),
      );
      await mod.handleGithubCopilot(ctx as any);
      assertEquals(ctx.streamReply.calls.length, 1);
    } finally {
      Deno.openKv = originalOpenKv;
    }
  },
);
