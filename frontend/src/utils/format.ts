export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat().format(num);
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString();
}