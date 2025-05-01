import { encode } from 'gpt-tokenizer';

// Current OpenAI pricing per 1K tokens (as of March 2024)
const GPT4_PRICING = {
  input: 0.03,   // $0.03 per 1K input tokens
  output: 0.06   // $0.06 per 1K output tokens
};

const AVERAGE_TOKENS_PER_WORD = 1.3;
const STREAMING_RESPONSE_MULTIPLIER = 1.2; // Add 20% buffer for safety

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export function calculateTokenUsage(input: string, output: string): TokenUsage {
  const inputTokens = encode(input).length;
  const outputTokens = encode(output).length;
  const totalTokens = inputTokens + outputTokens;
  const estimatedCost = calculateCost(input, output);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost
  };
}

export function calculateStreamingResponseTokenUsage(
    responsePrompt: string
): TokenUsage {
  
    const responseInputTokens = encode(responsePrompt).length;
     // Estimate streaming response output tokens
    const estimatedOutputTokens = Math.ceil(
      responseInputTokens * STREAMING_RESPONSE_MULTIPLIER
    );
  
    return {
      inputTokens: responseInputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens: responseInputTokens + estimatedOutputTokens,
      estimatedCost: calculateCost(responsePrompt, ' '.repeat(estimatedOutputTokens / AVERAGE_TOKENS_PER_WORD))
    };
  }

function calculateCost(input: string, output: string): number {
    return (
      (encode(input).length / 1000) * GPT4_PRICING.input +
      (encode(output).length / 1000) * GPT4_PRICING.output
    );
}