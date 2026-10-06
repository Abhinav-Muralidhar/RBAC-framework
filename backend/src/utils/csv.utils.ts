import { once } from 'node:events';
import type { WriteStream } from 'node:fs';

export function formatDateYmd(value: Date | null | undefined): string {
  if (!value) return '';
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toCsvScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDateYmd(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value);
}

export function csvEscape(value: unknown): string {
  const raw = toCsvScalar(value);
  const mustQuote = raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r');
  if (!mustQuote) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function writeCsvLine(stream: WriteStream, values: unknown[]): Promise<void> {
  const line = values.map(csvEscape).join(',') + '\n';
  if (!stream.write(line)) {
    await once(stream, 'drain');
  }
}

