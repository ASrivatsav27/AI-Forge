import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({
    apiKey: "sk-cs4-7c60de46e3c6bf2c3153eb0946d1c0907f5dc68c8e5ea6cd",
    baseURL: "https://api.llmsrelay.com",
});
async function main() {
    console.log("Requesting...\n");
    const message = await anthropic.messages.create({
        model: "claude-fable-5",
        max_tokens: 1024,
        messages: [
            {
                role: "user",
                content: "Say hello and tell me which model you are.",
            },
        ],
    });
    console.log("MODEL:");
    console.log(message.model);
    console.log("\nFULL RESPONSE:");
    console.dir(message, { depth: null });
    console.log("\nCONTENT:");
    for (const block of message.content) {
        if (block.type === "text") {
            console.log(block.text);
        }
    }
}
main().catch((error) => {
    console.error("\nERROR:");
    console.error(error);
});
//# sourceMappingURL=test.js.map