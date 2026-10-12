import type { Hono } from 'hono';
import { createBot, createWebhookApp } from '@/app.ts';
import { CloudflareKeyValueStore, KVNamespaceBinding, setKeyValueStore } from '@/repository/KeyValueStore.ts';

/**
 * Bindings declared in `wrangler.jsonc`.
 */
export interface WorkerEnv {
	KV: KVNamespaceBinding;
}

/**
 * Subset of the Workers `ExecutionContext` forwarded to Hono.
 */
export interface WorkerExecutionContext {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

let webhookApp: Promise<Hono> | null = null;

/**
 * Create the bot and its webhook app once per isolate. A failed initialization
 * (e.g. Telegram unreachable) is not cached, so the next request retries it.
 * @returns The webhook app bound to the initialized bot
 */
export function loadWebhookApp(): Promise<Hono> {
	webhookApp ??= createBot().then(createWebhookApp).catch((error) => {
		webhookApp = null;
		throw error;
	});
	return webhookApp;
}

/**
 * Cloudflare Workers entrypoint: binds the KV namespace and delegates to the Hono webhook app.
 */
export default {
	async fetch(request: Request, env: WorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
		setKeyValueStore(new CloudflareKeyValueStore(env.KV));
		const app = await loadWebhookApp();
		return await app.fetch(request, env, ctx);
	},
};
