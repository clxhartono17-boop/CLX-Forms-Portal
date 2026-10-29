import test from 'node:test';
import assert from 'node:assert/strict';
import { toRoman, generateDocNumber } from './romanNumerals.ts';
import { terbilangRaw, terbilangRupiah } from './terbilang.ts';

test('Roman numerals conversion works correctly', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(10), 'X');
  assert.equal(toRoman(29), 'XXIX');
  assert.equal(toRoman(100), 'C');
  assert.equal(toRoman(2026), 'MMXXVI');
});

test('Document number generation matches official CLX format', () => {
  // Test case from prompt: FPU created on October 29, 2026 -> FPU-0001/CLX/29/X/MMXXVI
  const testDate = new Date(2026, 9, 29); // Month is 0-indexed: 9 = October
  const docNum = generateDocNumber('FPU', 1, testDate);
  assert.equal(docNum, 'FPU-0001/CLX/29/X/MMXXVI');

  const pfbNum = generateDocNumber('PFB', 42, new Date(2026, 0, 15));
  assert.equal(pfbNum, 'PFB-0042/CLX/15/I/MMXXVI');
});

test('Terbilang converts numbers to Indonesian words accurately', () => {
  assert.equal(terbilangRaw(0), 'Nol');
  assert.equal(terbilangRaw(1), 'Satu');
  assert.equal(terbilangRaw(11), 'Sebelas');
  assert.equal(terbilangRaw(100), 'Seratus');
  assert.equal(terbilangRaw(1000), 'Seribu');
  assert.equal(terbilangRaw(1500), 'Seribu Lima Ratus');
  assert.equal(terbilangRaw(1000000), 'Satu Juta');
  assert.equal(terbilangRaw(1500000), 'Satu Juta Lima Ratus Ribu');

  // Currency with Rupiah
  assert.equal(terbilangRupiah(1500000), 'Satu Juta Lima Ratus Ribu Rupiah');
  assert.equal(terbilangRupiah(25750000), 'Dua Puluh Lima Juta Tujuh Ratus Lima Puluh Ribu Rupiah');
  assert.equal(terbilangRupiah(0), 'Nol Rupiah');
});
