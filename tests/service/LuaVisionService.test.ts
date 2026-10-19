import { assertEquals, assertRejects } from 'asserts';
import LuaVisionService, { LUA_API_BASE, resetLuaSession } from '../../src/service/LuaVisionService.ts';
import { getChatHistory } from '../../src/repository/ChatRepository.ts';
import { InMemoryKeyValueStore, setKeyValueStore } from '../../src/repository/KeyValueStore.ts';
import { FileUtils } from '../../src/util/FileUtils.ts';
import ElevenLabsService from '../../src/service/ElevenLabsService.ts';

interface RecordedCall {
	url: string;
	init: RequestInit;
}

const SESSION_COOKIES = ['lua-chat-session=jwt-a; Path=/; HttpOnly', '8th-session=jwt-b; Path=/; HttpOnly', 'lua-passkey-challenge=ignored; Path=/'];

/**
 * Creates a simulated login response with session cookies.
 * @param cookies - Set-Cookie header entries.
 * @returns Simulated 200 Response.
 */
function loginResponse(cookies: string[] = SESSION_COOKIES): Response {
	const headers = new Headers();
	cookies.forEach((cookie) => headers.append('set-cookie', cookie));
	return new Response('{"success":true}', { status: 200, headers });
}

/**
 * Creates a simulated SSE response from event payload strings.
 * @param events - Payload strings for each `data:` event.
 * @returns Simulated SSE Response.
 */
function sseResponse(events: string[]): Response {
	return new Response(events.map((event) => `data: ${event}\n\n`).join(''), { status: 200 });
}

/**
 * Runs a block with `globalThis.fetch` replaced by a fake responder.
 * @param respond - Decides the response for each call.
 * @param run - Test block to execute.
 * @returns Recorded fetch calls.
 */
async function withFakeFetch(respond: (call: RecordedCall, index: number) => Response, run: () => Promise<void>): Promise<RecordedCall[]> {
	const calls: RecordedCall[] = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = ((input: string | URL | Request, init: RequestInit = {}) => {
		const call = { url: String(input), init };
		calls.push(call);
		return Promise.resolve(respond(call, calls.length - 1));
	}) as typeof fetch;
	try {
		await run();
	} finally {
		globalThis.fetch = originalFetch;
	}
	return calls;
}

/**
 * Sets up test environment with fake credentials and fresh session/storage.
 */
function setupEnv(): void {
	Deno.env.set('LUA_CHAT_EMAIL', 'user@example.com');
	Deno.env.set('LUA_CHAT_PASSWORD', 'secret');
	resetLuaSession();
	setKeyValueStore(new InMemoryKeyValueStore());
}

/**
 * Reads all chunks from a stream reader as a UTF-8 string.
 * @param reader - Stream reader to consume.
 * @returns Concatenated decoded string.
 */
async function collectReaderText(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
	const decoder = new TextDecoder();
	let out = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		out += decoder.decode(value, { stream: true });
	}
	return out + decoder.decode();
}

Deno.test('chat logs in with env credentials and accumulates SSE content', async () => {
	setupEnv();
	let text = '';
	const calls = await withFakeFetch((call) => {
		if (call.url.endsWith('/api/login')) return loginResponse();
		return sseResponse(['{"content":"Ol"}', '{"tool":{"name":"x"}}', '{"content":"á!"}', '[DONE]']);
	}, async () => {
		text = await LuaVisionService.chat([{ role: 'user', content: 'oi' }]);
	});

	assertEquals(text, 'Olá!');
	assertEquals(calls[0].url, `${LUA_API_BASE}/api/login`);
	assertEquals(JSON.parse(calls[0].init.body as string), { email: 'user@example.com', password: 'secret' });
	assertEquals((calls[1].init.headers as Record<string, string>).Cookie, 'lua-chat-session=jwt-a; 8th-session=jwt-b');
});

Deno.test('chat sends image attachments only when provided', async () => {
	setupEnv();
	const bodies: Record<string, unknown>[] = [];
	await withFakeFetch((call) => {
		if (call.url.endsWith('/api/login')) return loginResponse();
		bodies.push(JSON.parse(call.init.body as string));
		return sseResponse(['[DONE]']);
	}, async () => {
		await LuaVisionService.chat([{ role: 'user', content: 'x' }], { imageAttachments: ['data:image/png;base64,AAA'] });
		await LuaVisionService.chat([{ role: 'user', content: 'x' }]);
	});

	assertEquals(bodies[0].imageAttachments, ['data:image/png;base64,AAA']);
	assertEquals('imageAttachments' in bodies[1], false);
	assertEquals(bodies[0].suppressToolBlocks, true);
});

Deno.test('session is reused across calls without logging in again', async () => {
	setupEnv();
	const calls = await withFakeFetch((call) => call.url.endsWith('/api/login') ? loginResponse() : sseResponse(['[DONE]']), async () => {
		await LuaVisionService.chat([{ role: 'user', content: 'a' }]);
		await LuaVisionService.chat([{ role: 'user', content: 'b' }]);
	});

	assertEquals(calls.filter((call) => call.url.endsWith('/api/login')).length, 1);
});

Deno.test('chat logs in again once when the API answers 401', async () => {
	setupEnv();
	let chatCalls = 0;
	let text = '';
	const calls = await withFakeFetch((call) => {
		if (call.url.endsWith('/api/login')) return loginResponse();
		chatCalls++;
		return chatCalls === 1 ? new Response('expired', { status: 401 }) : sseResponse(['{"content":"ok"}']);
	}, async () => {
		text = await LuaVisionService.chat([{ role: 'user', content: 'a' }]);
	});

	assertEquals(text, 'ok');
	assertEquals(calls.filter((call) => call.url.endsWith('/api/login')).length, 2);
});

Deno.test('textToSpeech posts text with default voice and returns audio bytes', async () => {
	setupEnv();
	let audio: Uint8Array = new Uint8Array();
	const calls = await withFakeFetch((call) => {
		if (call.url.endsWith('/api/login')) return loginResponse();
		return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
	}, async () => {
		audio = await LuaVisionService.textToSpeech('Olá!');
	});

	assertEquals(Array.from(audio), [1, 2, 3]);
	assertEquals(calls[1].url, `${LUA_API_BASE}/api/tts`);
	assertEquals(JSON.parse(calls[1].init.body as string), { text: 'Olá!', lang: 'pt-BR', voiceName: 'pt-BR-FranciscaNeural' });
});

Deno.test('generateText streams deltas and persists conversation history', async () => {
	setupEnv();
	const service = new LuaVisionService();
	let streamed = '';
	await withFakeFetch((call) => {
		if (call.url.endsWith('/api/login')) return loginResponse();
		return sseResponse(['{"content":"Oi "}', '{"content":"mundo"}', '[DONE]']);
	}, async () => {
		const { reader, onComplete } = await service.generateText('user:1', 'citado', 'pergunta');
		streamed = await collectReaderText(reader);
		await onComplete(streamed);
	});

	assertEquals(streamed, 'Oi mundo');
	const history = await getChatHistory('user:1');
	assertEquals(history.length, 2);
	assertEquals(history[0], { role: 'user', content: 'quote: "citado"\n\npergunta' });
	assertEquals(history[1], { role: 'assistant', content: 'Oi mundo' });
});

Deno.test('generateTextFromImage converts photo URL to base64 data URL attachment', async () => {
	setupEnv();
	const service = new LuaVisionService();
	let chatBody: Record<string, unknown> = {};
	await withFakeFetch((call) => {
		if (call.url.endsWith('/api/login')) return loginResponse();
		if (call.url.endsWith('/photo.png')) return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
		chatBody = JSON.parse(call.init.body as string);
		return sseResponse(['{"content":"imagem vista"}', '[DONE]']);
	}, async () => {
		const { reader, onComplete } = await service.generateTextFromImage(
			'user:2',
			'',
			[Promise.resolve('https://api.telegram.org/file/botTOKEN/photo.png')],
			'o que tem aqui?',
		);
		const text = await collectReaderText(reader);
		await onComplete(text);
	});

	assertEquals(chatBody.imageAttachments, ['data:image/png;base64,iVBORw==']);
});

Deno.test('FileUtils.textToSpeech uses LuaVision first and falls back to ElevenLabs on failure', async () => {
	setupEnv();
	const originalElevenLabs = ElevenLabsService.textToSpeech;
	let fallbackCalls = 0;
	ElevenLabsService.textToSpeech = () => {
		fallbackCalls++;
		return Promise.resolve(new Uint8Array([9, 9]));
	};

	try {
		await withFakeFetch((call) => {
			if (call.url.endsWith('/api/login')) return loginResponse();
			return new Response(new Uint8Array([4, 5, 6]), { status: 200 });
		}, async () => {
			const file = await FileUtils.textToSpeech('teste');
			assertEquals(Array.from(file.fileData as Uint8Array), [4, 5, 6]);
			assertEquals(fallbackCalls, 0);
		});

		await withFakeFetch(() => new Response('down', { status: 500 }), async () => {
			const file = await FileUtils.textToSpeech('teste');
			assertEquals(Array.from(file.fileData as Uint8Array), [9, 9]);
			assertEquals(fallbackCalls, 1);
		});
	} finally {
		ElevenLabsService.textToSpeech = originalElevenLabs;
	}
});

Deno.test('chat fails with actionable message when credentials are missing', async () => {
	Deno.env.delete('LUA_CHAT_EMAIL');
	Deno.env.delete('LUA_CHAT_PASSWORD');
	resetLuaSession();

	await assertRejects(() => LuaVisionService.chat([{ role: 'user', content: 'a' }]), Error, 'LUA_CHAT_EMAIL and LUA_CHAT_PASSWORD');
});

Deno.test('chat fails when login is rejected', async () => {
	setupEnv();
	await withFakeFetch(() => new Response('', { status: 401 }), async () => {
		await assertRejects(() => LuaVisionService.chat([{ role: 'user', content: 'a' }]), Error, 'login rejected');
	});
});

Deno.test('chat surfaces rate limiting', async () => {
	setupEnv();
	await withFakeFetch((call) => call.url.endsWith('/api/login') ? loginResponse() : new Response('', { status: 429 }), async () => {
		await assertRejects(() => LuaVisionService.chat([{ role: 'user', content: 'a' }]), Error, 'rate limited');
	});
});
