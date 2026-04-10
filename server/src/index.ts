import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { setupWebSocket } from './websocket/index.js';
import { prisma } from './config/database.js';

const app = createApp();
const server = createServer(app);

setupWebSocket(server);

server.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close();
});
