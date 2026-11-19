/**
 * Currency formatting helpers for Russian Rubles (₽).
 */

export interface FormatRubOptions {
  /** Prefix positive values with '+' and negative with '-' */
  signed?: boolean;
  /** Use compact notation (тыс / млн) for large numbers in tight HUD slots */
  compact?: boolean;
}

export function formatRub(amount: number, opts: FormatRubOptions = {}): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : opts.signed && rounded > 0 ? '+' : '';

  if (opts.compact) {
    if (abs >= 1_000_000) {
      const val = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',');
      return `${sign}${val} млн ₽`;
    }
    if (abs >= 100_000) {
      const val = (abs / 1_000).toFixed(0);
      return `${sign}${val} тыс ₽`;
    }
  }

  return `${sign}${abs.toLocaleString('ru-RU')} ₽`;
}

export function formatRubPerMin(amount: number, signed = false): string {
  return `${formatRub(amount, { signed, compact: Math.abs(amount) >= 100_000 })}/м`;
}
