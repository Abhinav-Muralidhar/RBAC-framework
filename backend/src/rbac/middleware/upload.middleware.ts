/**
 * Generic File Upload Middleware
 * 
 * Reusable multer factory for any file type.
 * Each route configures its own destination, allowed types, and size limit.
 * 
 * Usage:
 *   createUpload({ dest: 'logos', allowedTypes: ['image/*'], maxSizeMB: 2 })
 *   createUpload({ dest: 'docs', allowedTypes: ['application/pdf'], maxSizeMB: 10 })
 *   createUpload({ dest: 'imports', allowedTypes: ['application/vnd.ms-excel', 'text/csv'], maxSizeMB: 50 })
 */

import multer, { StorageEngine, FileFilterCallback } from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Request } from 'express';

export interface UploadConfig {
    /** Sub-folder inside uploads/ (e.g. 'logos', 'docs', 'imports') */
    dest: string;
    /** Allowed MIME types. Supports wildcards like 'image/*' */
    allowedTypes: string[];
    /** Maximum file size in MB */
    maxSizeMB: number;
    /** Multer field name (default: 'file') */
    fieldName?: string;
}

/** Resolve the absolute upload directory for a given sub-folder */
function getUploadDir(dest: string): string {
    const dir = path.join(__dirname, '..', '..', '..', 'uploads', dest);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/** Check if a MIME type matches an allowed pattern (supports wildcards like 'image/*') */
function mimeMatches(mime: string, pattern: string): boolean {
    if (pattern === '*/*') return true;
    if (pattern.endsWith('/*')) {
        const category = pattern.split('/')[0];
        return mime.startsWith(category + '/');
    }
    return mime === pattern;
}

/**
 * Create a configured multer upload middleware.
 * Returns multer.single(fieldName) middleware.
 */
export function createUpload(config: UploadConfig) {
    const uploadDir = getUploadDir(config.dest);
    const fieldName = config.fieldName ?? 'file';

    const storage: StorageEngine = multer.diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
            cb(null, uploadDir);
        },
        filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const uniqueName = `${config.dest}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
            cb(null, uniqueName);
        },
    });

    const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        const isAllowed = config.allowedTypes.some(pattern => mimeMatches(file.mimetype, pattern));
        if (isAllowed) {
            cb(null, true);
        } else {
            cb(new Error(`File type '${file.mimetype}' is not allowed. Accepted: ${config.allowedTypes.join(', ')}`));
        }
    };

    const upload = multer({
        storage,
        fileFilter,
        limits: {
            fileSize: config.maxSizeMB * 1024 * 1024,
        },
    });

    return upload.single(fieldName);
}
