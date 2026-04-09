import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const { httpServer } = createServer();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Listening on http://0.0.0.0:${PORT}`);
});
