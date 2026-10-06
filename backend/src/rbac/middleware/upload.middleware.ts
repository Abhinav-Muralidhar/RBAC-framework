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
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { getTempUploadDir, moveTempFileToStorage } from '../storage/file-storage';
import { assertDetectedFileAllowed } from '../../utils/file-validation';
import { badRequest, payloadTooLarge } from '../errors/api.errors';

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
    const uploadDir = getTempUploadDir();
    const fieldName = config.fieldName ?? 'file';

    const storage: StorageEngine = multer.diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
            cb(null, uploadDir);
        },
        filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
            const uniqueName = `tmp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            cb(null, uniqueName);
        },
    });

    const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        const isAllowed = config.allowedTypes.some(pattern => mimeMatches(file.mimetype, pattern));
        if (isAllowed) {
            cb(null, true);
        } else {
            cb(badRequest(
                `Invalid file type '${file.mimetype}'. Accepted: ${config.allowedTypes.join(', ')}`,
                'INVALID_FILE_TYPE'
            ));
        }
    };

    const upload = multer({
        storage,
        fileFilter,
        limits: {
            fileSize: config.maxSizeMB * 1024 * 1024,
        },
    });

    const singleUpload = upload.single(fieldName);

    return (req: Request, res: Response, next: NextFunction) => {
        singleUpload(req, res, async (error?: any) => {
            if (error) {
                if (error instanceof multer.MulterError) {
                    if (error.code === 'LIMIT_FILE_SIZE') {
                        next(payloadTooLarge(
                            `File too large. Maximum allowed size is ${config.maxSizeMB} MB for '${fieldName}'.`,
                            'FILE_TOO_LARGE',
                            { field: fieldName, maxSizeMB: config.maxSizeMB }
                        ));
                        return;
                    }

                    next(badRequest(error.message, error.code, { field: error.field ?? fieldName }));
                    return;
                }

                next(error);
                return;
            }

            if (!req.file) {
                next();
                return;
            }

            try {
                const detected = await assertDetectedFileAllowed(req.file.path, req.file.originalname, config.allowedTypes);
                const stored = await moveTempFileToStorage(req.file.path, config.dest, req.file.originalname);

                req.file.filename = stored.filename;
                req.file.path = stored.absolutePath;
                req.file.destination = path.dirname(stored.absolutePath);
                req.file.mimetype = detected.mime;

                next();
            } catch (validationError) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch (cleanupError: any) {
                    if (cleanupError?.code !== 'ENOENT') {
                        next(cleanupError);
                        return;
                    }
                }
                next(validationError);
            }
        });
    };
}
