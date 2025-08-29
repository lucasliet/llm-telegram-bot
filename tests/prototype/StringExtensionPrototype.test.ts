import { assertEquals } from 'asserts';
import '../../src/prototype/StringExtensionPrototype.ts';

Deno.test('String.prototype.startsIn works case-insensitively', () => {
	const value = 'Hello World';
	const result = (value as any).startsIn('he', 'x');
	assertEquals(result, true);
});

Deno.test('String.prototype.removeThinkingChatCompletion removes <think> blocks', () => {
	const input = 'Answer <think>secret reasoning</think> done';
	const output = (input as any).removeThinkingChatCompletion();
	assertEquals(output.includes('<think>'), false);
});

Deno.test('String.prototype.convertBlackBoxWebSearchSourcesToMarkdown converts arrays', () => {
	const payload = '$~~~$' + JSON.stringify([{ title: 'A', link: 'https://a' }, { title: 'B', link: 'https://b' }]) + '$~~~$';
	const output = (payload as any).convertBlackBoxWebSearchSourcesToMarkdown();
	const ok = output.includes('[A](https://a)') && output.includes('[B](https://b)');
	assertEquals(ok, true);
});

Deno.test('String.prototype.convertBlackBoxWebSearchSourcesToMarkdown converts object', () => {
	const payload = '$~~~$' + JSON.stringify({ title: 'Z', link: 'https://z' }) + '$~~~$';
	const output = (payload as any).convertBlackBoxWebSearchSourcesToMarkdown();
	assertEquals(output.includes('[Z](https://z)'), true);
});

Deno.test('String.prototype.convertBlackBoxWebSearchSourcesToMarkdown leaves invalid JSON as-is', () => {
	const inner = '{ invalid json }';
	const payload = '$~~~$' + inner + '$~~~$';
	const output = (payload as any).convertBlackBoxWebSearchSourcesToMarkdown();
	assertEquals(output.includes(inner), true);
});
