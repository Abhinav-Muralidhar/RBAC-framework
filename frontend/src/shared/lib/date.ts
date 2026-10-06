export function toDateInputValue(value?: string | Date | null) {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return typeof value === 'string' ? value.slice(0, 10) : '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
