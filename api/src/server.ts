import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = await buildApp(config);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

await app.listen({ host: config.HOST, port: config.API_PORT });
