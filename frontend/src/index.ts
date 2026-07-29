import { serve } from "bun";
import index from "./index.html";

const server = serve({
  routes: {
    "/api/config": () =>
      Response.json({
        apiUrl: Bun.env.API_URL ?? "http://localhost:8000",
      }),

    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);