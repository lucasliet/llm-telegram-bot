import { ToolExecutionResult } from '../agent/AgentLoopConfig.ts';

/**
 * Represents a tool call extracted from the stream.
 */
export interface ExtractedToolCall {
	/** Unique identifier for this tool call */
	id: string;

	/** Name of the function/tool to call */
	name: string;

	/** Stringified JSON arguments for the tool */
	arguments: string;
}

/**
 * Result of processing a stream chunk.
 */
export interface StreamProcessingResult {
	/** Array of tool calls found in the stream */
	toolCalls: ExtractedToolCall[];

	/** Whether the stream contained assistant content (text response) */
	hasAssistantContent: boolean;

	/** Raw text content from the assistant, if any */
	rawContent: string;
}

/**
 * Base interface for stream processors.
 * Implementations handle different OpenAI API formats (Chat Completions vs Responses API).
 */
export interface StreamProcessor {
	/**
	 * Process a stream of chunks, extracting tool calls and content.
	 * @param reader - The stream reader to process
	 * @param controller - Controller to enqueue processed chunks for the user
	 * @returns Processing result with extracted tool calls and content
	 */
	processStream(
		reader: ReadableStreamDefaultReader<Uint8Array>,
		controller: ReadableStreamDefaultController<Uint8Array>,
	): Promise<StreamProcessingResult>;

	/**
	 * Format tool execution results for the next API call.
	 * @param results - Array of tool execution results
	 * @returns Formatted messages/items to append to the conversation
	 */
	formatToolResultsForNextCall(results: ToolExecutionResult[]): unknown[];
}
