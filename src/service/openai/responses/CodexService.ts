import OpenAi from 'npm:openai';
import ResponsesService from '@/service/openai/responses/ResponsesService.ts';
import { codexModels } from '@/config/models.ts';

const CODEX_ACCESS_TOKEN: string | undefined = Deno.env.get('CODEX_ACCESS_TOKEN');
const CODEX_ACCOUNT_ID: string | undefined = Deno.env.get('CODEX_ACCOUNT_ID');

const { textModel } = codexModels;

const CODEX_MAX_TOKENS = 8000;
const sessionId = crypto.randomUUID().toLowerCase();

export default class CodexService extends ResponsesService {
  /**
   * Initializes Codex service with preconfigured client and defaults.
   * @param model - Codex text model to use.
   */
  public constructor(model: string = textModel) {
    super(
      new OpenAi({
        apiKey: CODEX_ACCESS_TOKEN,
        baseURL: 'https://chatgpt.com/backend-api/codex',
        defaultHeaders: {
          'chatgpt-account-id': CODEX_ACCOUNT_ID,
          'OpenAI-Beta': 'responses=experimental',
          originator: 'codex_cli_rs',
          'User-Agent': 'codex_cli_rs',
          session_id: sessionId,
        },
      }),
      model,
      true,
      CODEX_MAX_TOKENS,
      'Codex',
    );
  }

  /**
   * Provides Codex-specific instructions loaded from resources files.
   * @returns Concatenated instructions for Responses API.
   */
  protected override async getInstructions(): Promise<string> {
    if (cachedCodexInstructions !== null) return cachedCodexInstructions;
    try {
      const base = new URL('.', import.meta.url);
      const promptUrl = new URL('../../../../resources/prompt.md', base);
      const toolUrl = new URL('../../../../resources/apply_patch_tool_instructions.md', base);
      const [prompt, tool] = await Promise.all([
        Deno.readTextFile(promptUrl.pathname),
        Deno.readTextFile(toolUrl.pathname),
      ]);
      cachedCodexInstructions = `${prompt}\n${tool}`;
      return cachedCodexInstructions;
    } catch {
      cachedCodexInstructions = '';
      return cachedCodexInstructions;
    }
  }
}

let cachedCodexInstructions: string | null = null;
