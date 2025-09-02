import { assertEquals } from 'asserts';
import { spy } from 'mock';
import '../../src/prototype/ReadableStreamDefaultReaderPrototype.ts';
import '../../src/prototype/StringExtensionPrototype.ts';
import { setupKvStub } from '../stubs/kv.ts';

// Set environment variables required by FileUtils
Deno.env.set('ADMIN_USER_IDS', '12345');
Deno.env.set('BOT_TOKEN', 'test_token');

// Setup KV stub to prevent database leaks
setupKvStub();

Deno.test('ElevenlabsHandler does nothing for non-fala command', async () => {
  const ctx: any = {
    replyWithVoice: spy(() => Promise.resolve()),
    extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'other: test', quote: '' })),
    message: { message_id: 100 },
  };
  const textModelService = {
    generateText: spy((_userKey: string, _quote: string, _prompt: string) => Promise.resolve({ reader: {} as any, onComplete: () => Promise.resolve() })),
  };

  const mod = await import('../../src/handlers/ElevenlabsHandler.ts');
  await mod.handleFala(ctx, textModelService as any);

  // generateText should not be called for non-fala commands
  assertEquals(textModelService.generateText.calls.length, 0);
  // replyWithVoice should not be called
  assertEquals(ctx.replyWithVoice.calls.length, 0);
});

Deno.test('ElevenlabsHandler extracts context correctly for fala command', async () => {
  const ctx: any = {
    replyWithVoice: spy(() => Promise.resolve()),
    extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:123', contextMessage: 'fala: Test message', quote: 'test quote' })),
    message: { message_id: 999 },
  };

  const reader = new ReadableStream({
    start(controller) {
      controller.close();
    },
  }).getReader();

  const textModelService = {
    generateText: spy((_userKey: string, _quote: string, _prompt: string) => Promise.resolve({ reader, onComplete: undefined })),
  };

  const mod = await import('../../src/handlers/ElevenlabsHandler.ts');
  await mod.handleFala(ctx, textModelService as any);

  // Verify extractContextKeys was called
  assertEquals(ctx.extractContextKeys.calls.length, 1);
  
  // Verify generateText was called with correct parameters
  assertEquals(textModelService.generateText.calls.length, 1);
  const generateTextCall = textModelService.generateText.calls[0];
  assertEquals(generateTextCall.args[0], 'user:123'); // userKey
  assertEquals(generateTextCall.args[1], 'test quote'); // quote
  assertEquals(typeof generateTextCall.args[2], 'string'); // prompt is a string
});

Deno.test('ElevenlabsHandler handles command message override', async () => {
  const ctx: any = {
    replyWithVoice: spy(() => Promise.resolve()),
    extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:789', contextMessage: 'original message', quote: '' })),
    message: { message_id: 555 },
  };

  const reader = new ReadableStream({
    start(controller) {
      controller.close();
    },
  }).getReader();

  const textModelService = {
    generateText: spy((_userKey: string, _quote: string, _prompt: string) => Promise.resolve({ reader, onComplete: undefined })),
  };

  const mod = await import('../../src/handlers/ElevenlabsHandler.ts');
  await mod.handleFala(ctx, textModelService as any, 'fala: override command message');

  // generateText should be called with override parameters
  assertEquals(textModelService.generateText.calls.length, 1);
  const generateTextCall = textModelService.generateText.calls[0];
  assertEquals((generateTextCall.args[2] as string).includes('override command message'), true);
});
