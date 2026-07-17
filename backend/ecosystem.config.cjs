/**
 * PM2 process manager config for EC2.
 * Install: npm i -g pm2
 *
 * Start (ts-node, no build):  cd backend && PORT=3001 pm2 start ecosystem.config.cjs
 * Or use compiled JS (recommended):  npm run build && PORT=3001 pm2 start ecosystem.config.cjs
 *   Then change script below to "dist/server.js", interpreter to "node", remove interpreter_args.
 *
 * Logs:    pm2 logs
 * Restart: pm2 restart backend
 * Stop:    pm2 stop backend
 */
module.exports = {
  apps: [
    {
      name: "backend",
      script: "server.ts",
      interpreter: "npx",
      // transpile-only: do not crash the API on TS type errors (e.g. broken AWS SDK types)
      interpreter_args: "ts-node --transpile-only",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env: {
        PORT: 3001,
        TS_NODE_TRANSPILE_ONLY: "1",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        TS_NODE_TRANSPILE_ONLY: "1",
      },
    },
  ],
};
