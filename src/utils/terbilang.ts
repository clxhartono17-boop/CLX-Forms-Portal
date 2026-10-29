/**
 * Utility to convert numerical currency inputs into Indonesian words (Terbilang).
 * Example: 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 */
const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

export function terbilangRaw(n: number): string {
  const num = Math.floor(Math.abs(n));

  if (num === 0) return 'Nol';
  if (num < 12) return SATUAN[num];
  if (num < 20) return `${terbilangRaw(num - 10)} Belas`;
  if (num < 100) {
    const sisa = num % 10;
    return `${terbilangRaw(Math.floor(num / 10))} Puluh${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }
  if (num < 200) {
    const sisa = num - 100;
    return `Seratus${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }
  if (num < 1000) {
    const sisa = num % 100;
    return `${terbilangRaw(Math.floor(num / 100))} Ratus${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }
  if (num < 2000) {
    const sisa = num - 1000;
    return `Seribu${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }
  if (num < 1000000) {
    const sisa = num % 1000;
    return `${terbilangRaw(Math.floor(num / 1000))} Ribu${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }
  if (num < 1000000000) {
    const sisa = num % 1000000;
    return `${terbilangRaw(Math.floor(num / 1000000))} Juta${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }
  if (num < 1000000000000) {
    const sisa = num % 1000000000;
    return `${terbilangRaw(Math.floor(num / 1000000000))} Miliar${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }
  if (num < 1000000000000000) {
    const sisa = num % 1000000000000;
    return `${terbilangRaw(Math.floor(num / 1000000000000))} Triliun${sisa > 0 ? ' ' + terbilangRaw(sisa) : ''}`;
  }

  return num.toString();
}

/**
 * Returns formatted terbilang with "Rupiah" suffix
 * E.g., 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 */
export function terbilangRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Nol Rupiah';
  }
  const cleanAmount = Math.max(0, Math.floor(amount));
  if (cleanAmount === 0) return 'Nol Rupiah';
  const words = terbilangRaw(cleanAmount).trim();
  return `${words} Rupiah`;
}
