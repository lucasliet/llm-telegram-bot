import OpenAi from 'npm:openai';
import ToolService from '@/service/ToolService.ts';

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();

export type ToolCall = {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

/**
 * Maps OpenAi.Chat.Completions.ChatCompletionTool[] to Responses API Tool[]
 * Flattens the inner `function` object to the root level (name, description, parameters)
 */
export function mapChatToolsToResponsesTools(
  tools?: OpenAi.Chat.Completions.ChatCompletionTool[],
): OpenAi.Responses.Tool[] {
  if (!tools || tools.length === 0) return [];

  return tools.map((t) => {
    if (t.type === 'function' && t.function) {
      return {
        type: 'function',
        name: t.function.name,
        description: t.function.description ?? '',
        parameters: t.function.parameters,
        strict: (t as any).strict ?? true,
      } as OpenAi.Responses.Tool;
    }

    // fallback minimal mapping (preserve type and strict if available)
    return {
      type: (t as any).type ?? 'function',
      name: (t as any).name ?? 'unknown_tool',
      description: (t as any).description ?? '',
      parameters: (t as any).parameters ?? undefined,
      strict: (t as any).strict ?? false,
    } as OpenAi.Responses.Tool;
  });
}

/**
 * Executes tool calls discovered in an initial responses-style stream.
 * Behavior mirrors the function-calling flow in OpenAiService.executeToolCalls
 * but adapted to the Responses API streaming JSON payloads where tool_calls
 * are present inside chunked JSON `choices[*].delta.tool_calls` entries.
 *
 * generateFollowup should be a function that, given the updated `messages`/`input`
 * will return a ReadableStreamDefaultReader<Uint8Array> for the follow-up stream.
 */
export function executeResponsesToolCalls(
  generateFollowup: (
    messages: OpenAi.Chat.ChatCompletionMessageParam[],
    ...args: any[]
  ) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
  initialReader: ReadableStreamDefaultReader<Uint8Array>,
  messages: OpenAi.Chat.ChatCompletionMessageParam[],
  ...generateArgs: any[]
): ReadableStreamDefaultReader<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const tool_calls = await readInitialStreamAndExtract(initialReader, controller);
        if (tool_calls.length > 0) {
          await handleFunctionCallFollowUp(generateFollowup, messages, tool_calls, controller, ...generateArgs);
        }
      } catch (e) {
        const errorMessage = `Eita, algo deu errado: ${e instanceof Error ? e.message : e}`;
        const openAiContent = JSON.stringify({
          choices: [
            {
              delta: {
                content: errorMessage,
              },
            },
          ],
        });
        controller.enqueue(TEXT_ENCODER.encode(openAiContent));
      } finally {
        controller.close();
      }
    },
  }).getReader();
}

/**
 * Reads the initial stream from the OpenAI response, enqueues chunks in the controller,
 * and extracts the name of the called function and its arguments.
 * @param initialReader Reader for the initial stream of Uint8Array
 * @param controller Controller to enqueue chunks in the output stream
 * @returns Promise that resolves with an array of tool calls containing the function name and arguments
 */
async function readInitialStreamAndExtract(
  initialReader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<ToolCall[]> {
  const tool_calls: ToolCall[] = [];
  let jsonBuffer = '';

  while (true) {
    const { done, value } = await initialReader.read();
    if (done) break;

    controller.enqueue(value);

    try {
      const text = TEXT_DECODER.decode(value);
      // attempt to parse JSON in chunk; if it's not JSON, try to accumulate
      let parsed: any;
      try {
        parsed = JSON.parse(text);
        // reset buffer when a clean parse succeeds
        jsonBuffer = '';
      } catch (_firstErr) {
        // try combining with existing buffer
        jsonBuffer += text;
        try {
          parsed = JSON.parse(jsonBuffer);
          jsonBuffer = '';
        } catch (_secondErr) {
          // as a last resort, try line-by-line (many streams send one JSON per line)
          const lines = jsonBuffer.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          let anyParsed = false;
          for (const line of lines) {
            try {
              parsed = JSON.parse(line);
              anyParsed = true;
              // remove everything up to and including this line from buffer
              const idx = jsonBuffer.indexOf(line);
              jsonBuffer = jsonBuffer.slice(idx + line.length);
              break;
            } catch {
              // continue trying other lines
            }
          }
          if (!anyParsed) {
            // prevent unbounded buffer growth
            if (jsonBuffer.length > 1_000_000) {
              const lastBrace = jsonBuffer.lastIndexOf('{');
              if (lastBrace > 0) jsonBuffer = jsonBuffer.slice(lastBrace);
            }
            // no parsable JSON yet
            continue;
          }
        }
      }

      // First try the ChatCompletions-like tool_calls
      const possibleToolCalls = parsed?.choices?.[0]?.delta?.tool_calls || parsed?.tool_calls || null;
      if (Array.isArray(possibleToolCalls) && possibleToolCalls.length > 0) {
        for (const call of possibleToolCalls) {
          const idx = call?.index ?? tool_calls.length;
          tool_calls[idx] = tool_calls[idx] || { index: idx };
          tool_calls[idx].id = call.id ?? tool_calls[idx].id;
          tool_calls[idx].type = call.type ?? tool_calls[idx].type;
          tool_calls[idx].function = tool_calls[idx].function || { name: undefined, arguments: '' };
          try {
            const incomingArgs = typeof call.function?.arguments === 'object'
              ? JSON.stringify(call.function.arguments)
              : (call.function?.arguments ?? '');
            tool_calls[idx].function!.arguments = (tool_calls[idx].function!.arguments || '') + incomingArgs;
            tool_calls[idx].function!.name = call.function?.name ?? tool_calls[idx].function!.name;
          } catch (e) {
            console.warn('Error assembling tool call arguments', e);
          }
        }
      }

      // If not found, handle Cloudflare/Responses API 'output' format
      const outputItems = parsed?.output;
      if (Array.isArray(outputItems) && outputItems.length > 0) {
        for (const item of outputItems) {
          try {
            if (item?.type === 'function_call' || item?.type === 'tool_call') {
              const name = item.name || item?.function_name || null;
              const argsRaw = item.arguments || item.arguments_raw || item.arguments_json || item.arguments_text ||
                item.arguments_string || null;
              const callId = item.call_id ?? item.id ?? null;
              const idx = tool_calls.length;
              tool_calls[idx] = tool_calls[idx] || { index: idx };
              tool_calls[idx].id = callId ?? tool_calls[idx].id;
              tool_calls[idx].type = item.type ?? tool_calls[idx].type;
              tool_calls[idx].function = tool_calls[idx].function || { name: undefined, arguments: '' };

              if (typeof argsRaw === 'string') {
                tool_calls[idx].function!.arguments = (tool_calls[idx].function!.arguments || '') + argsRaw;
              } else if (typeof argsRaw === 'object' && argsRaw !== null) {
                tool_calls[idx].function!.arguments = (tool_calls[idx].function!.arguments || '') +
                  JSON.stringify(argsRaw);
              } else if (typeof item.arguments === 'string') {
                tool_calls[idx].function!.arguments = (tool_calls[idx].function!.arguments || '') +
                  item.arguments;
              }

              tool_calls[idx].function!.name = name ?? tool_calls[idx].function!.name;
            }
          } catch (e) {
            console.warn('Error parsing output item for tool call', e, item);
          }
        }
      }
    } catch (e) {
      console.error('Error decoding initial chunk in responses flow:', e);
    }
  }
  return tool_calls;
}

/**
 * Processes the follow-up of the detected function call, executes the function via ToolService,
 * and enqueues the result in the output stream.
 * @param openai Instance of the OpenAI client
 * @param messages Original conversation messages
 * @param model Name of the model to be used for the follow-up response
 * @param maxTokens Token limit for the response
 * @param tool_calls Array of detected tool calls containing function names and arguments
 * @param controller Controller to enqueue chunks in the output stream
 */
async function handleFunctionCallFollowUp(
  generateFollowup: (
    messages: OpenAi.Chat.ChatCompletionMessageParam[],
    ...args: any[]
  ) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
  messages: OpenAi.Chat.ChatCompletionMessageParam[],
  tool_calls: ToolCall[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  ...generateArgs: any[]
) {
  for (const [idx, tool_call] of tool_calls.entries()) {
    const fnName = tool_call.function?.name;
    if (!fnName) {
      console.error('Tool call without function name', tool_call);
      continue;
    }

    let args: any = null;
    try {
      args = JSON.parse(tool_call.function!.arguments || '{}');
    } catch (e) {
      console.error('Failed to parse tool call arguments:', e, tool_call.function?.arguments);
      continue;
    }

    const fn = ToolService.tools.get(fnName)?.fn;
    if (!fn) {
      console.error(`Tool function ${fnName} not found in ToolService`);
      continue;
    }

    let result: any;
    try {
      result = await fn(args);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : String(e) };
    }

    const callId = tool_call.id ?? (crypto.randomUUID ? crypto.randomUUID() : `call_${idx}`);

    messages.push({
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: callId,
          type: 'function',
          function: {
            name: fnName,
            arguments: tool_call.function!.arguments!,
          },
        },
      ],
    } as unknown as OpenAi.Chat.ChatCompletionMessageParam);
    messages.push({
      tool_call_id: callId,
      role: 'tool',
      name: fnName,
      content: JSON.stringify(result),
    } as unknown as OpenAi.Chat.ChatCompletionMessageParam);
  }

  const followupReader = await generateFollowup(messages, ...generateArgs);
  while (true) {
    const { done, value } = await followupReader.read();
    if (done) break;
    controller.enqueue(value);
  }
}

const ResponsesToolAdapter = {
  mapChatToolsToResponsesTools,
  executeResponsesToolCalls,
};

export default ResponsesToolAdapter;
