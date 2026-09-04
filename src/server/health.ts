import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { childLogger } from '../utils/logger';

const log = childLogger('http');

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/** Minimal HTTP server: health check for Railway plus the optional webhook route. */
export function startHealthServer(webhookHandler?: RequestHandler): Server {
  const server = createServer(async (req, res) => {
    if (webhookHandler && req.method === 'POST' && req.url === '/telegram') {
      webhookHandler(req, res);
      return;
    }

    if (req.url === '/health' || req.url === '/') {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      } catch {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'degraded' }));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(env.PORT, () => log.info({ port: env.PORT }, 'http server listening'));
  return server;
}
