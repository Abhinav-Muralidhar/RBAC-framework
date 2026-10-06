import 'express-serve-static-core';

/**
 * AuditContext
 * 
 * Request-scoped context injected by the injectAuditContext middleware.
 * Provides IP, user-agent, and identity metadata for audit logging.
 */
declare global {
    interface AuditContext {
        request_id: string;
        user_id: string | null;
        session_id: string | null;
        ip_address: string;
        user_agent: string;
        timestamp: Date;
    }
}

declare module 'express-serve-static-core' {
    interface Request {
        requestId?: string;
        user?: {
            id: string;
            //organizationId: string;
            sessionId?: string;
        };
        auditContext?: AuditContext;
    }
}