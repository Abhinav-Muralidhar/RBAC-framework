function escapePdfText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function wrapLine(line: string, maxChars: number): string[] {
    if (line.length <= maxChars) {
        return [line];
    }

    const words = line.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars) {
            current = next;
            continue;
        }

        if (current) {
            lines.push(current);
        }

        if (word.length > maxChars) {
            for (let i = 0; i < word.length; i += maxChars) {
                lines.push(word.slice(i, i + maxChars));
            }
            current = '';
            continue;
        }

        current = word;
    }

    if (current) {
        lines.push(current);
    }

    return lines;
}

function normalizeLines(lines: string[], maxChars: number): string[] {
    return lines.flatMap((line) => {
        if (line === '\f') {
            return ['\f'];
        }
        if (!line) {
            return [''];
        }
        return wrapLine(line, maxChars);
    });
}

export function createPdfFromLines(lines: string[], title = 'Document'): Buffer {
    const wrappedLines = normalizeLines(lines, 95);
    const linesPerPage = 42;
    const pages: string[][] = [];
    let currentPage: string[] = [];

    for (const line of wrappedLines) {
        if (line === '\f') {
            if (currentPage.length > 0) {
                pages.push(currentPage);
                currentPage = [];
            }
            continue;
        }

        currentPage.push(line);
        if (currentPage.length >= linesPerPage) {
            pages.push(currentPage);
            currentPage = [];
        }
    }

    if (currentPage.length > 0) {
        pages.push(currentPage);
    }

    if (pages.length === 0) {
        pages.push(['No data']);
    }

    const objectCount = 3 + (pages.length * 2);
    const fontObjectId = objectCount;
    const objects: string[] = [];

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';

    const pageObjectIds: number[] = [];
    const contentObjectIds: number[] = [];
    for (let i = 0; i < pages.length; i++) {
        pageObjectIds.push(3 + i);
        contentObjectIds.push(3 + pages.length + i);
    }

    objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`;

    for (let i = 0; i < pages.length; i++) {
        const pageId = pageObjectIds[i]!;
        const contentId = contentObjectIds[i]!;
        const pageLines = pages[i]!;
        const pageNumber = i + 1;
        const pageCount = pages.length;

        const contentLines = [
            'BT',
            '/F1 18 Tf',
            '1 0 0 1 40 770 Tm',
            `(${escapePdfText(title)}) Tj`,
            '/F1 11 Tf',
            '14 TL',
            '1 0 0 1 40 740 Tm',
        ];

        for (const line of pageLines) {
            contentLines.push(`(${escapePdfText(line)}) Tj`);
            contentLines.push('T*');
        }

        contentLines.push('/F1 9 Tf');
        contentLines.push('1 0 0 1 40 20 Tm');
        contentLines.push(`(Page ${pageNumber} of ${pageCount}) Tj`);
        contentLines.push('ET');
        const stream = contentLines.join('\n');

        objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`;
        objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`;
    }

    objects[fontObjectId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];

    for (let i = 1; i < objects.length; i++) {
        offsets[i] = Buffer.byteLength(pdf, 'utf8');
        pdf += `${i} 0 obj\n${objects[i]!}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += '0000000000 65535 f \n';

    for (let i = 1; i < objects.length; i++) {
        pdf += `${offsets[i]!.toString().padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
}
