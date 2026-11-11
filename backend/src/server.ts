import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './config/logger.js';
import { startWorkerLoop } from './worker.js';

let server: any;

async function bootstrap() {
  try {
    // 1. Connect to MongoDB Atlas / local instance
    await connectDB();

    // 2. Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(`🏥 Medconsults API running at http://localhost:${env.PORT}`);
      logger.info(`🔍 Environment: ${env.NODE_ENV}`);
      logger.info(`🩺 Health check: http://localhost:${env.PORT}/health`);
      logger.info(`🩺 Readiness check: http://localhost:${env.PORT}/ready`);
    });

    // 3. Start integrated notification worker loop in development mode
    if (env.NODE_ENV === 'development') {
      startWorkerLoop(5000);
    }
  } catch (err) {
    logger.error('Failed to start Medconsults server:', err);
    process.exit(1);
  }
}

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

bootstrap();
