import winston from 'winston';
import { env } from './env.js';

// Custom format to mask sensitive tokens or passwords
const redactSensitive = winston.format((info) => {
  const sensitiveKeys = ['password', 'token', 'secret', 'notesEnc', 'reasonEnc', 'secretHash'];
  const redact = (obj: any, seen = new WeakSet()): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return obj;
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map((item) => redact(item, seen));
    }

    const copy: Record<string | symbol, any> = {};
    for (const sym of Object.getOwnPropertySymbols(obj)) {
      copy[sym] = (obj as any)[sym];
    }
    for (const [key, val] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        copy[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        copy[key] = redact(val, seen);
      } else {
        copy[key] = val;
      }
    }
    return copy;
  };

  return redact(info);
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactSensitive(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [
    new winston.transports.Console()
  ]
});
