/**
 * Format currency with abbreviations (k, M, B)
 */
export function formatCurrency(value: number): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }

  if (value === 0) return '$0';
  if (value < 0) return `-${formatCurrency(Math.abs(value))}`;

  // Billions
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(1)}B`;
  }
  // Millions
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  // Tens of thousands and up
  if (value >= 10000) {
    return `$${Math.round(value / 1000)}k`;
  }
  // Thousands
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  // Under 1000
  return `$${Math.round(value)}`;
}
