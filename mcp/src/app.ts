import { createDb, pingDb } from '@ft/shared/db';
import { loggerOptions, metrics, verifyInternalToken } from '@ft/shared/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { Counter } from 'prom-client';
import type { Config } from './config';
import { createMcpServer } from './tools';

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions('mcp', config.LOG_LEVEL, config.NODE_ENV === 'development'),
  });

  const { db, pool, close } = createDb(config.DATABASE_URL);
  app.addHook('onClose', close);

  await app.register(metrics, { service: 'mcp' });
  const toolCalls = new Counter({
    name: 'mcp_tool_calls_total',
    help: 'MCP tool invocations by tool and outcome',
    labelNames: ['tool', 'outcome'] as const,
    registers: [app.metrics],
  });

  app.get('/health', { logLevel: 'warn' }, async (_request, reply) =>
    (await pingDb(pool))
      ? reply.send({ status: 'ok', db: 'up' })
      : reply.status(503).send({ status: 'degraded', db: 'down' }),
  );

  // Stateless Streamable HTTP: one MCP server + transport per request, bound to the token's user.
  app.post('/mcp', async (request, reply) => {
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    let userId: string;
    try {
      userId = await verifyInternalToken(config.MCP_INTERNAL_SECRET, token);
    } catch {
      request.log.warn('rejected MCP request with invalid internal token');
      return reply.status(401).send({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: null,
      });
    }

    const server = createMcpServer({
      db,
      userId,
      onToolCall: (tool, outcome) => {
        toolCalls.inc({ tool, outcome });
        request.log.info({ tool, outcome, userId }, 'mcp tool call');
      },
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    reply.hijack();
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // Sessions and server-initiated streams are not used in stateless mode.
  const methodNotAllowed = async (_request: unknown, reply: FastifyReply) =>
    reply
      .status(405)
      .send({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  return app;
}
