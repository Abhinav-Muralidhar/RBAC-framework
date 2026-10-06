import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>): void {
    res.json({ data, error: null, meta: meta ?? {} });
}
