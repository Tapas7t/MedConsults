import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';
import { logger } from './logger.js';

// Resolve DNS SRV issues on Windows where Node's c-ares defaults to 127.0.0.1
try {
  const currentServers = dns.getServers();
  if (currentServers.length === 0 || currentServers.every((s) => s.startsWith('127.'))) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
} catch {
  // Ignore fallback if platform restricts setting DNS servers
}

export async function connectDB(): Promise<typeof mongoose> {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true, // Build indexes on startup
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error: any) {
    // If SRV lookup failed due to local resolver, retry with Google / Cloudflare DNS
    if (error?.code === 'ECONNREFUSED' && env.MONGODB_URI.startsWith('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        const conn = await mongoose.connect(env.MONGODB_URI, { autoIndex: true });
        logger.info(`✅ MongoDB Connected (fallback DNS): ${conn.connection.host}`);
        return conn;
      } catch (retryErr) {
        logger.error('❌ MongoDB connection error after DNS fallback:', retryErr);
        process.exit(1);
      }
    }

    logger.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
