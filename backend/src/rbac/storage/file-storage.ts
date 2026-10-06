import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config';

export interface StoredFile {
    filename: string;
    absolutePath: string;
    storedPath: string;
}

function ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function getUploadsRoot(): string {
    ensureDirectory(config.uploads.root);
    return config.uploads.root;
}

export function getUploadDir(dest: string): string {
    const dir = path.join(getUploadsRoot(), dest);
    ensureDirectory(dir);
    return dir;
}

export function getTempUploadDir(): string {
    return getUploadDir('_tmp');
}

export function buildStoredUploadPath(dest: string, filename: string): string {
    return path.posix.join('uploads', dest, filename);
}

/**
 * Resolve a stored upload reference to an absolute path under uploads/.
 * Accepts relative paths, absolute paths, public URLs, and bare filenames.
 */
export function resolveStoredUploadPath(storedPath: string, dest?: string): string | null {
    const rawValue = storedPath.trim();
    if (!rawValue) {
        return null;
    }

    const uploadsRoot = getUploadsRoot();
    let normalized = rawValue.replace(/\\/g, '/');

    try {
        if (/^https?:\/\//i.test(normalized)) {
            normalized = new URL(normalized).pathname;
        }
    } catch {
        return null;
    }

    const uploadsMarker = '/uploads/';
    const uploadsIndex = normalized.toLowerCase().indexOf(uploadsMarker);
    if (uploadsIndex >= 0) {
        normalized = normalized.slice(uploadsIndex + 1);
    } else if (normalized.startsWith('/uploads/')) {
        normalized = normalized.slice(1);
    } else if (path.isAbsolute(rawValue)) {
        const relativeFromUploads = path.relative(uploadsRoot, rawValue);
        if (relativeFromUploads.startsWith('..') || path.isAbsolute(relativeFromUploads)) {
            return null;
        }
        normalized = path.posix.join('uploads', relativeFromUploads.replace(/\\/g, '/'));
    } else if (!normalized.includes('/')) {
        if (!dest) {
            return null;
        }
        normalized = buildStoredUploadPath(dest, normalized);
    } else {
        normalized = normalized.replace(/^\/+/, '');
    }

    if (!normalized.toLowerCase().startsWith('uploads/')) {
        return null;
    }

    const absolute = path.resolve(path.dirname(uploadsRoot), normalized);
    const relativeFromUploads = path.relative(uploadsRoot, absolute);
    if (relativeFromUploads.startsWith('..') || path.isAbsolute(relativeFromUploads)) {
        return null;
    }

    if (dest) {
        const expectedDir = dest.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!relativeFromUploads.replace(/\\/g, '/').startsWith(`${expectedDir}/`)) {
            return null;
        }
    }

    return absolute;
}

export async function moveTempFileToStorage(tempFilePath: string, dest: string, originalName: string): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase();
    const filename = `${dest}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const absolutePath = path.join(getUploadDir(dest), filename);

    await fs.promises.rename(tempFilePath, absolutePath);

    return {
        filename,
        absolutePath,
        storedPath: buildStoredUploadPath(dest, filename)
    };
}

export async function deleteStoredUpload(storedPath: string, dest?: string): Promise<void> {
    const absolute = resolveStoredUploadPath(storedPath, dest);
    if (!absolute) {
        return;
    }

    try {
        await fs.promises.unlink(absolute);
    } catch (error: any) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
}
