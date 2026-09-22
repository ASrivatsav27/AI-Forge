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
})