module.exports = {
  apps: [
    {
      name: "ai-forge-backend",
      script: "./dist/index.js",

      env: {
        NODE_ENV: "production",
        PORT: 8000,
      },

      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,

      watch: false,
      time: true,

      error_file: "./logs/backend-error.log",
      out_file: "./logs/backend-out.log",
      merge_logs: true,
    },

    {
      name: "inngest",
      script: "cmd.exe",
      args: '/c npx inngest-cli@latest dev -u http://127.0.0.1:8000/api/inngest',

      interpreter: "none",

      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,

      watch: false,
      time: true,

      error_file: "./logs/inngest-error.log",
      out_file: "./logs/inngest-out.log",
      merge_logs: true,
    },
  ],
};