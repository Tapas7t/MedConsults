import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { isDbConnected } from './config/db.js';
import { mongoSanitizeMiddleware } from './middleware/mongoSanitize.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes.js';

export const app = express();

// Trust proxy if running behind reverse proxy (Render, Heroku, Nginx)
app.set('trust proxy', 1);

// ── Health & Readiness Probes (Unthrottled, Mounted Before Rate Limits) ──
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Medconsults API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      api: '/api/v1',
      doctors: '/api/v1/doctors',
    },
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/ready', (_req, res) => {
  if (isDbConnected()) {
    res.status(200).json({ status: 'ready', database: 'connected' });
  } else {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

// 1. Security Headers
app.use(helmet());

// 2. CORS - Explicit origin list only, never wildcard '*' with credentials per Blueprint
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman) or matched allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not permitted by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Body & Cookie Parsing with strict size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// 4. NoSQL Injection Prevention (Express 5 compatible)
app.use(mongoSanitizeMiddleware);

// 5. Request Logging (dev only)
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 6. Global API Rate Limiter
app.use('/api', globalLimiter);

// 7. API Routes
app.use('/api/v1', apiRouter);

// 8. 404 Route Handler for undefined paths
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested API endpoint was not found',
    },
  });
});

// 9. Central Error Handler (always last)
app.use(errorHandler);
