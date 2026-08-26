import Anthropic from "@anthropic-ai/sdk";
export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: "https://api.llmsrelay.com",
});
//# sourceMappingURL=ai.service.js.map