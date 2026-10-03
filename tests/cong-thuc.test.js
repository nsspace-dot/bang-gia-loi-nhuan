// Test công thức — dữ liệu GIẢ, không phải số liệu shop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tinhLai, giaCanDat, giaHoaVon, phiCoDinh, tyLePhi } from '../js/core/cong-thuc.js';

const gan = (a, b, sai = 1e-6) => assert.ok(Math.abs(a - b) < sai, `${a} ≠ ${b}`);

const PHI = { phi_san: 20, phi_vc: 2000, phi_xl: 3000, phi_qc: 8, aff_qc: 5, aff_noqc: 10 };

test('phí cố định = bồi hoàn V/C + xử lý đơn', () => {
  assert.equal(phiCoDinh(PHI), 5000);
});

test('lãi có QC và không QC', () => {
  const r = tinhLai(20000, 60000, PHI);
  gan(r.laiQC, 60000 - 20000 - 5000 - 60000 * 0.33); // 15.200
  gan(r.laiKhongQC, 60000 - 20000 - 5000 - 60000 * 0.30); // 17.000
  gan(r.ptQC, 15200 / 60000);
});

test('phí có số lẻ (vd 21,3%)', () => {
  const phi = { phi_san: 21.3, phi_vc: 2000, phi_xl: 3000, phi_qc: 7.45, aff_qc: 4, aff_noqc: 9 };
  const r = tinhLai(12345, 50000, phi);
  gan(r.laiQC, 16280);
  gan(r.laiKhongQC, 17505);
});

test('giá bán 0 → % lãi là null, không chia cho 0', () => {
  const r = tinhLai(10000, 0, PHI);
  assert.equal(r.ptQC, null);
  assert.equal(r.ptKhongQC, null);
});

test('giá cần đạt lãi m% — kiểm tra ngược bằng tinhLai', () => {
  for (const kichBan of ['qc', 'khongqc']) {
    const gia = giaCanDat(20000, PHI, { kichBan, laiPhanTram: 0.1 });
    const r = tinhLai(20000, gia, PHI);
    gan(kichBan === 'qc' ? r.ptQC : r.ptKhongQC, 0.1);
  }
});

test('"cả 2 kịch bản" dùng tổng phí % lớn hơn → cả hai lãi đều ≥ mức yêu cầu', () => {
  assert.equal(tyLePhi(PHI, 'ca2'), 0.33);
  const gia = giaCanDat(20000, PHI, { kichBan: 'ca2', laiPhanTram: 0.1 });
  gan(gia, 25000 / 0.57);
  const r = tinhLai(20000, gia, PHI);
  assert.ok(r.ptQC >= 0.1 - 1e-9 && r.ptKhongQC >= 0.1 - 1e-9);
});

test('giá cần đạt lãi theo số đồng/đơn', () => {
  const gia = giaCanDat(20000, PHI, { kichBan: 'qc', laiDong: 10000 });
  gan(tinhLai(20000, gia, PHI).laiQC, 10000);
});

test('giá hòa vốn → lãi = 0', () => {
  const gia = giaHoaVon(20000, PHI, 'khongqc');
  gan(tinhLai(20000, gia, PHI).laiKhongQC, 0, 1e-6);
});

test('phí + lãi ≥ 100% → không thể đạt (null)', () => {
  assert.equal(giaCanDat(20000, PHI, { kichBan: 'qc', laiPhanTram: 0.7 }), null);
});
