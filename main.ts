import { createBot } from '@/app.ts';
import { CopilotAuth } from '@/scripts/CopilotAuth.ts';

/**
 * Local entrypoint: runs the Copilot login flow or starts the bot in long-polling mode.
 * Production runs on Cloudflare Workers through `worker.ts`.
 */
async function initializeApp() {
	if (Deno.args.includes('copilot-login')) {
		await new CopilotAuth().run();
		return;
	}

	const bot = await createBot();
	bot.start();
}

await initializeApp();
