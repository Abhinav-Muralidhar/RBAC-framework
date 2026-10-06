import fs from 'node:fs';
import path from 'node:path';

export interface DetectedFileType {
    ext: string;
    mime: string;
}

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const MAX_ZIP_ENTRY_COUNT = 4096;

function isSvgContent(content: string): boolean {
    const trimmed = content.trimStart();
    return trimmed.startsWith('<svg') || (trimmed.startsWith('<?xml') && trimmed.includes('<svg'));
}

async function listZipEntryNames(filePath: string): Promise<string[] | null> {
    const fileBuffer = await fs.promises.readFile(filePath);
    const entries: string[] = [];
    let offset = 0;

    while (offset + 4 <= fileBuffer.length) {
        const signature = fileBuffer.readUInt32LE(offset);

        if (signature === ZIP_CENTRAL_DIRECTORY_SIGNATURE || signature === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
            break;
        }

        if (signature !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
            return null;
        }

        if (offset + 30 > fileBuffer.length) {
            return null;
        }

        const compressionMethod = fileBuffer.readUInt16LE(offset + 8);
        const fileNameLength = fileBuffer.readUInt16LE(offset + 26);
        const extraFieldLength = fileBuffer.readUInt16LE(offset + 28);
        const compressedSize = fileBuffer.readUInt32LE(offset + 18);
        const fileNameStart = offset + 30;
        const fileNameEnd = fileNameStart + fileNameLength;
        const dataStart = fileNameEnd + extraFieldLength;
        const nextOffset = dataStart + compressedSize;

        if (compressionMethod !== 0 && compressionMethod !== 8) {
            return null;
        }
        if (fileNameEnd > fileBuffer.length || dataStart > fileBuffer.length || nextOffset > fileBuffer.length) {
            return null;
        }

        const fileName = fileBuffer.subarray(fileNameStart, fileNameEnd).toString('utf8');
        entries.push(fileName);
        if (entries.length > MAX_ZIP_ENTRY_COUNT) {
            return null;
        }

        offset = nextOffset;
    }

    return entries;
}

async function detectOfficeSpreadsheetType(filePath: string): Promise<DetectedFileType | null> {
    const entries = await listZipEntryNames(filePath);
    if (!entries) {
        return null;
    }

    const normalizedEntries = new Set(entries.map((entry) => entry.replace(/\\/g, '/')));
    const requiredEntries = [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
    ];

    const hasWorkbookStructure = requiredEntries.every((entry) => normalizedEntries.has(entry));
    if (!hasWorkbookStructure) {
        return null;
    }

    return {
        ext: '.xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
}

export async function detectFileType(filePath: string): Promise<DetectedFileType | null> {
    const handle = await fs.promises.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(8192);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        const data = buffer.subarray(0, bytesRead);

        if (data.length >= 8 &&
            data[0] === 0x89 &&
            data[1] === 0x50 &&
            data[2] === 0x4e &&
            data[3] === 0x47 &&
            data[4] === 0x0d &&
            data[5] === 0x0a &&
            data[6] === 0x1a &&
            data[7] === 0x0a) {
            return { ext: '.png', mime: 'image/png' };
        }

        if (data.length >= 3 &&
            data[0] === 0xff &&
            data[1] === 0xd8 &&
            data[2] === 0xff) {
            return { ext: '.jpg', mime: 'image/jpeg' };
        }

        if (data.length >= 12 &&
            data.subarray(0, 4).toString('ascii') === 'RIFF' &&
            data.subarray(8, 12).toString('ascii') === 'WEBP') {
            return { ext: '.webp', mime: 'image/webp' };
        }

        if (data.length >= 5 && data.subarray(0, 5).toString('ascii') === '%PDF-') {
            return { ext: '.pdf', mime: 'application/pdf' };
        }

        if (data.length >= 8 &&
            data[0] === 0xd0 &&
            data[1] === 0xcf &&
            data[2] === 0x11 &&
            data[3] === 0xe0 &&
            data[4] === 0xa1 &&
            data[5] === 0xb1 &&
            data[6] === 0x1a &&
            data[7] === 0xe1) {
            return { ext: '.xls', mime: 'application/vnd.ms-excel' };
        }

        if (data.length >= 4 &&
            data[0] === 0x50 &&
            data[1] === 0x4b &&
            data[2] === 0x03 &&
            data[3] === 0x04) {
            return detectOfficeSpreadsheetType(filePath);
        }

        const text = data.toString('utf8');
        if (isSvgContent(text)) {
            return { ext: '.svg', mime: 'image/svg+xml' };
        }

        if (!text.includes('\u0000') && (text.includes(',') || text.includes('\n'))) {
            return { ext: '.csv', mime: 'text/csv' };
        }

        return null;
    } finally {
        await handle.close();
    }
}

function mimeMatches(mime: string, pattern: string): boolean {
    if (pattern === '*/*') return true;
    if (pattern.endsWith('/*')) {
        const category = pattern.split('/')[0];
        return mime.startsWith(`${category}/`);
    }
    return mime === pattern;
}

export async function assertDetectedFileAllowed(filePath: string, originalName: string, allowedTypes: string[]): Promise<DetectedFileType> {
    const detected = await detectFileType(filePath);
    if (!detected) {
        throw new Error('Uploaded file type could not be verified');
    }

    const ext = path.extname(originalName).toLowerCase();
    const extensionMatches = !ext || ext === detected.ext || (ext === '.jpeg' && detected.ext === '.jpg');
    if (!extensionMatches) {
        throw new Error(`Uploaded file extension '${ext}' does not match detected type '${detected.ext}'`);
    }

    const allowed = allowedTypes.some((pattern) => mimeMatches(detected.mime, pattern));
    if (!allowed) {
        throw new Error(`Detected file type '${detected.mime}' is not allowed`);
    }

    return detected;
}
