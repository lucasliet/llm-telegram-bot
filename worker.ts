import type { Bot } from 'grammy';
import type { Update } from 'grammy-types';
import { createBot, createWebhookApp, type MyContext } from '@/app.ts';
import { CloudflareKeyValueStore, KVNamespaceBinding, setKeyValueStore } from '@/repository/KeyValueStore.ts';

/**
 * Producer side of the Cloudflare Queue that buffers Telegram updates.
 */
export interface UpdateQueueBinding {
	send(body: Update): Promise<void>;
}

/**
 * Message delivered to the queue consumer.
 */
export interface UpdateQueueMessage {
	readonly body: Update;
	readonly attempts: number;
	ack(): void;
}

/**
 * Batch delivered to the queue consumer.
 */
export interface UpdateQueueBatch {
	readonly messages: readonly UpdateQueueMessage[];
}

/**
 * Bindings declared in `wrangler.jsonc`.
 */
export interface WorkerEnv {
	KV: KVNamespaceBinding;
	UPDATES_QUEUE: UpdateQueueBinding;
}

/**
 * Subset of the Workers `ExecutionContext` forwarded to Hono.
 */
export interface WorkerExecutionContext {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

let bot: Promise<Bot<MyContext>> | null = null;

/**
 * Create the bot once per isolate. A failed initialization (e.g. Telegram unreachable)
 * is not cached, so the next batch retries it.
 * @returns The initialized bot
 */
export function loadBot(): Promise<Bot<MyContext>> {
	bot ??= createBot().catch((error) => {
		bot = null;
		throw error;
	});
	return bot;
}

/**
 * Handle one queued update and acknowledge it even on failure: a retry could send a duplicated (partial) reply,
 * and handlers already report model errors to the user.
 * @param initializedBot - Bot that processes the update
 * @param message - Queue message carrying the Telegram update
 */
async function processQueuedUpdate(initializedBot: Bot<MyContext>, message: UpdateQueueMessage): Promise<void> {
	try {
		await initializedBot.handleUpdate(message.body);
	} catch (error) {
		console.error(`[QUEUE] Failed to handle update ${message.body.update_id} (attempt ${message.attempts}):`, error);
	}
	message.ack();
}

/**
 * Cloudflare Workers entrypoint: the webhook enqueues updates and the queue consumer runs the bot,
 * since queue consumers can run for minutes while work left after an HTTP response is cancelled.
 */
export default {
	fetch(request: Request, env: WorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
		const app = createWebhookApp((update) => env.UPDATES_QUEUE.send(update));
		return Promise.resolve(app.fetch(request, env, ctx));
	},

	async queue(batch: UpdateQueueBatch, env: WorkerEnv): Promise<void> {
		setKeyValueStore(new CloudflareKeyValueStore(env.KV));
		const initializedBot = await loadBot();
		for (const message of batch.messages) {
			await processQueuedUpdate(initializedBot, message);
		}
	},
};
