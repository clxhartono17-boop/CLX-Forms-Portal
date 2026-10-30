/**
 * Utility to convert numbers to Roman numerals
 * Supports 1 to 3999
 */
export function toRoman(num: number): string {
  if (isNaN(num) || num <= 0) return '';
  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let n = Math.floor(num);
  for (const [val, sym] of romanMap) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result;
}

import { FormType } from '../types/index.ts';

/**
 * Generates official document number:
 * Format: [JENIS_FORM]-[4_DIGIT_URUTAN]/CLX/[DD]/[BULAN_ROMAWI]/[TAHUN_ROMAWI]
 * Example: FPU-0001/CLX/29/X/MMXXVI (for 29 October 2026)
 */
export function generateDocNumber(
  formType: FormType,
  sequence: number,
  date: Date = new Date()
): string {
  const seqPadded = String(sequence).padStart(4, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const monthRoman = toRoman(date.getMonth() + 1); // 1-12
  const yearRoman = toRoman(date.getFullYear());

  return `${formType}-${seqPadded}/CLX/${day}/${monthRoman}/${yearRoman}`;
}
