export const CURRENCY_OPTIONS = [
  { symbol: '$', label: 'USD ($)', code: 'USD' },
  { symbol: '€', label: 'EUR (€)', code: 'EUR' },
  { symbol: '£', label: 'GBP (£)', code: 'GBP' },
  { symbol: '¥', label: 'JPY (¥)', code: 'JPY' },
  { symbol: 'A$', label: 'AUD (A$)', code: 'AUD' },
  { symbol: 'C$', label: 'CAD (C$)', code: 'CAD' },
  { symbol: '₹', label: 'INR (₹)', code: 'INR' },
  { symbol: 'R$', label: 'BRL (R$)', code: 'BRL' },
] as const;

const CURRENCY_KEY = 'vertex-currency-symbol';

export function getCurrencySymbol(): string {
  try {
    return localStorage.getItem(CURRENCY_KEY) || '$';
  } catch {
    return '$';
  }
}

export function setCurrencySymbol(symbol: string) {
  localStorage.setItem(CURRENCY_KEY, symbol);
}

/**
 * Format currency with abbreviations (k, M, B)
 */
export function formatCurrency(value: number): string {
  const sym = getCurrencySymbol();

  if (value === null || value === undefined || isNaN(value)) {
    return `${sym}0`;
  }

  if (value === 0) return `${sym}0`;
  if (value < 0) return `-${formatCurrency(Math.abs(value))}`;

  // Billions
  if (value >= 1000000000) {
    return `${sym}${(value / 1000000000).toFixed(1)}B`;
  }
  // Millions
  if (value >= 1000000) {
    return `${sym}${(value / 1000000).toFixed(1)}M`;
  }
  // Tens of thousands and up
  if (value >= 10000) {
    return `${sym}${Math.round(value / 1000)}k`;
  }
  // Thousands
  if (value >= 1000) {
    return `${sym}${(value / 1000).toFixed(1)}k`;
  }
  // Under 1000
  return `${sym}${Math.round(value)}`;
}
