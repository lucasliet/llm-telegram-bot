class OpenAI {}
namespace OpenAI {
        export interface ChatCompletionMessageParam {
                role: string;
                content: string;
        }
        export namespace Chat {
                export namespace Completions {
                        export interface ChatCompletionTool {
                                type?: string;
                                function?: { name: string; description?: string; parameters?: unknown };
                        }
                        export interface ChatCompletionToolChoiceOption {}
                }
        }
        export namespace ChatCompletionCreateParams {
                export interface Function {
                        name: string;
                        description?: string;
                        parameters?: unknown;
                }
        }
        export namespace Responses {
                export interface Tool {}
        }
}
export default OpenAI;
