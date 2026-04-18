// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'web',
      script: 'pnpm',
      args: '-F web start',
      cwd: __dirname,
      env: { NODE_ENV: 'production', DATABASE_URL: 'file:./data.db' },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'worker',
      script: 'pnpm',
      args: '-F worker start',
      cwd: __dirname,
      env: { NODE_ENV: 'production', DATABASE_URL: 'file:./data.db' },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
