/**
 * Reporting interface utility functions.
 */

/**
 * Format a number with thousand separators.
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('vi-VN');
}

/**
 * Format a date string to Vietnamese locale.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date-time string to Vietnamese locale.
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate percentage change between two values.
 */
export function calculateGrowthRate(current: number, previous: number): string {
  if (previous === 0) return 'N/A';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Export data to CSV format.
 */
export function exportToCsv(data: any[], filename: string): void {
  const headers = Object.keys(data[0] || {});
  const csvContent =
    [headers.join(','), ...data.map((row) => headers.map((h) => row[h] || '').join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get color class for a stat trend.
 */
export function getTrendColorClass(value: string): string {
  if (value.startsWith('+')) return 'text-green-500';
  if (value.startsWith('-')) return 'text-red-500';
  return 'text-muted-foreground';
}
