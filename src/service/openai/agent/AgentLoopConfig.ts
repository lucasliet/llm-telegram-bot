/**
 * Configuration for the Agent Loop execution.
 * Controls iteration limits, context size, timeouts, and observability callbacks.
 */
export interface AgentLoopConfig {
	/** Maximum number of iterations the agent can perform before stopping */
	maxIterations: number;

	/** Timeout in milliseconds for individual tool executions */
	toolExecutionTimeout: number;

	/** Whether to use LLM to extract only relevant information from tool results */
	enableToolResultSummarization: boolean;

	/** Callback fired when an iteration starts */
	onIterationStart?: (iteration: number) => void;

	/** Callback fired when a tool is about to be executed */
	onToolExecution?: (toolName: string, args: unknown) => void;

	/** Callback fired when an iteration completes */
	onIterationComplete?: (iteration: number, hasMoreTools: boolean) => void;
}

/**
 * Default configuration for the Agent Loop.
 */
export const DEFAULT_AGENT_CONFIG: AgentLoopConfig = {
	maxIterations: 10,
	toolExecutionTimeout: 30000,
	enableToolResultSummarization: true,
};

/**
 * State of the Agent Loop during execution.
 */
export interface AgentLoopState {
	/** Current iteration number (1-based) */
	iteration: number;

	/** Estimated total tokens used in the context */
	totalTokensEstimate: number;

	/** Whether the agent has completed its task */
	isComplete: boolean;

	/** Last error encountered during execution, if any */
	lastError?: Error;
}

/**
 * Result of executing a tool call.
 */
export interface ToolExecutionResult {
	/** Unique identifier of the tool call */
	toolCallId: string;

	/** Name of the tool that was executed */
	toolName: string;

	/** Stringified JSON arguments passed to the tool */
	arguments: string;

	/** Result returned by the tool execution */
	result: unknown;

	/** Time taken to execute the tool in milliseconds */
	executionTimeMs: number;
}
