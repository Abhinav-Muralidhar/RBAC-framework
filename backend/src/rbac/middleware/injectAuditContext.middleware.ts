/**
 * injectAuditContext Middleware
 * 
 * Populates req.auditContext with request-scoped metadata for audit logging.
 * MUST run AFTER the authenticate middleware so req.user is available.
 */

import { Request, Response, NextFunction } from 'express';

export function injectAuditContext() {
    return (req: Request, _res: Response, next: NextFunction): void => {
        req.auditContext = {
            request_id: req.requestId ?? 'unknown',
            user_id: req.user?.id ?? null,
            session_id: req.user?.sessionId ?? null,
            ip_address: req.ip ?? req.socket.remoteAddress ?? 'unknown',
            user_agent: req.get('user-agent') ?? 'unknown',
            timestamp: new Date(),
        };
        next();
    };
}
