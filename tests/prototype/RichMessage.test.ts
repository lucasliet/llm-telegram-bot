import { assertEquals } from 'asserts';

const makePhoto = (id: string, width: number) => ({ file_id: id, file_unique_id: id, width, height: width });

Deno.test('extractContextKeys reads text and photos from a rich_message', async () => {
	await import('../../src/service/TelegramService.ts');
	const { Context } = await import('grammy');
	await import('../../src/prototype/ContextExtensionPrototype.ts');

	const ctx: any = {
		from: { id: 42 },
		message: {
			message_id: 7,
			rich_message: {
				blocks: [
					{
						type: 'photo',
						photo: [makePhoto('small1', 90), makePhoto('big1', 800)],
					},
					{
						type: 'heading',
						text: { type: 'bold', text: 'No Sleep For Kaname Date' },
					},
					{
						type: 'paragraph',
						text: ['Dump (Akia - Viki - Data - FileK - FileD): ', { type: 'code', text: 'aHR0cHM6Ly9w' }],
					},
					{
						type: 'blockquote',
						blocks: [
							{ type: 'paragraph', text: 'Tested with:' },
							{ type: 'paragraph', text: '1. kstuff-fpkg-1.13-dr-test3' },
						],
					},
					{
						type: 'collage',
						blocks: [{ type: 'photo', photo: [makePhoto('big2', 1280)] }],
						caption: { text: 'capa do jogo' },
					},
				],
			},
		},
	};

	const keys = await (Context.prototype as any).extractContextKeys.call(ctx);

	assertEquals(
		keys.contextMessage,
		'No Sleep For Kaname Date\nDump (Akia - Viki - Data - FileK - FileD): aHR0cHM6Ly9w\nTested with:\n1. kstuff-fpkg-1.13-dr-test3\ncapa do jogo',
	);
	assertEquals((keys.photos as any[]).map((p: any) => p.file_id), ['big1', 'big2']);
	assertEquals(keys.caption, undefined);
});

Deno.test('extractContextKeys ignores rich_message without extractable content', async () => {
	await import('../../src/service/TelegramService.ts');
	const { Context } = await import('grammy');
	await import('../../src/prototype/ContextExtensionPrototype.ts');

	const ctx: any = {
		from: { id: 42 },
		message: { message_id: 8, rich_message: { blocks: [{ type: 'divider' }] } },
	};

	const keys = await (Context.prototype as any).extractContextKeys.call(ctx);

	assertEquals(keys.contextMessage, undefined);
	assertEquals(keys.photos, undefined);
});
