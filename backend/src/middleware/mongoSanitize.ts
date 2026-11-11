import { Request, Response, NextFunction } from 'express';

function sanitizeObject(target: any): any {
  if (typeof target !== 'object' || target === null) {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map(sanitizeObject);
  }

  const clean: Record<string, any> = {};
  for (const key of Object.keys(target)) {
    // Strip keys starting with $ or containing . (NoSQL operator injection)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeObject(target[key]);
  }
  return clean;
}

export function mongoSanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
}
