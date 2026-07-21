export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs >= 1e9) return scaled(n / 1e9) + 'B';
  if (abs >= 1e6) return scaled(n / 1e6) + 'M';
  if (abs >= 1e3) return scaled(n / 1e3) + 'k';
  if (Number.isInteger(n)) return String(n);
  // Stocks accrue continuously (0.05 wood/s), so small fractions carry real
  // signal: two decimals below 100, one up to 1k, suffix-scaled above. The
  // epsilon keeps binary float error (1.15 stored as 1.1499…) from flooring
  // a displayed cent away.
  if (abs < 100) return (Math.floor(n * 100 + 1e-6) / 100).toFixed(2);
  return (Math.floor(n * 10 + 1e-6) / 10).toFixed(1);
}

// Credits carry real decimals (fractional hire costs, price factors), so they
// format like stocks: two decimals below 100 instead of flooring to integers.
export function formatCredits(n: number): string {
  return '$' + formatNumber(n);
}

function scaled(v: number): string {
  return String(Math.abs(v) >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
