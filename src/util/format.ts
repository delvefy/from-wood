export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs >= 1e9) return scaled(n / 1e9) + 'B';
  if (abs >= 1e6) return scaled(n / 1e6) + 'M';
  if (abs >= 1e3) return scaled(n / 1e3) + 'k';
  if (Number.isInteger(n)) return String(n);
  return (Math.floor(n * 10) / 10).toFixed(1);
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
