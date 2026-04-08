import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const { httpServer } = createServer();

httpServer.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});
