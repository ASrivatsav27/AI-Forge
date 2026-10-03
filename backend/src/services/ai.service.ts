import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export const nemotron = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL:"https://api.justwoker.icu",
  // Explicit per-attempt deadline. The SDK default is 10 minutes with 2 silent
  // internal retries, so one stalled request could block a step for 10-30 min
  // with nothing in the logs. Retries are handled (and logged) in coding.agent.ts.
  timeout: Number(process.env.CLAUDE_REQUEST_TIMEOUT_MS ?? 240_000),
  maxRetries: 0,
})
export const qwen3 = new OpenAI({
  apiKey: process.env.UNOROUTER_API_KEY,
  baseURL: "https://api.unorouter.com/v1",
});
