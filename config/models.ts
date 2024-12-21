export const geminiModel = 'gemini-2.0-flash-exp';

export const perplexityModel = 'llama-3.1-sonar-small-128k-online';

export const openAIModels = {
  gptModel: 'gpt-4o-mini',
  imageModel: 'dall-e-2',
  sttModel: 'whisper-1'
}

export const cloudflareModels =  {
  imageModel: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  textModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  visionTextModel: '@cf/llava-hf/llava-1.5-7b-hf',
  sqlModel: '@cf/defog/sqlcoder-7b-2',
  codeModel: '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
  sttModel: '@cf/openai/whisper'
}
