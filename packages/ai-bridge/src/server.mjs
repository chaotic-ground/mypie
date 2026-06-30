// Minimal dependency-free HTTP server exposing the proofreading bridge.
// POST /feedback  { "text": "..." }  -> { "feedback": [ {start,end,category,feedback}, ... ] }
// GET  /health                       -> { "ok": true }

import { createServer } from 'node:http';
import { analyze } from './feedback.mjs';

const readBody = (req, limit = 1_000_000) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const send = (res, status, obj) => {
  const json = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(json);
};

export const createBridgeServer = (opts = {}) =>
  createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      send(res, 204, {});
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === 'POST' && req.url === '/feedback') {
      try {
        const { text } = JSON.parse(await readBody(req));
        const feedback = await analyze(text, opts);
        send(res, 200, { feedback });
      } catch (err) {
        send(res, 400, { error: err.message });
      }
      return;
    }
    send(res, 404, { error: 'not found' });
  });

export const start = (port = Number(process.env.PORT) || 4319, host = '127.0.0.1') => {
  const server = createBridgeServer();
  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`mypie ai-bridge listening on http://${host}:${port}`);
  });
  return server;
};
