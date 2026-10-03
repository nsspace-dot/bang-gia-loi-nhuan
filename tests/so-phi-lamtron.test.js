import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docSo, dinhDangTien, dinhDangPhanTram } from '../js/core/so.js';
import { chonBoPhi, chuanHoaThang, cacThangCoPhi } from '../js/core/phi.js';
import { lamTronLen, lamTronXuong, lamTronDuoi9000, satDuoiTran, lamTronTheoKieu } from '../js/core/lam-tron.js';

test('đọc số dạng chữ kiểu Việt Nam và kiểu Anh', () => {
  assert.equal(docSo('45.000'), 45000);
  assert.equal(docSo('45,000'), 45000);
  assert.equal(docSo('1.234.567'), 1234567);
  assert.equal(docSo('1,234,567'), 1234567);
  assert.equal(docSo('45.000 đ'), 45000);
  assert.equal(docSo('45000'), 45000);
  assert.equal(docSo(45000), 45000);
  assert.equal(docSo('23,4'), 23.4);
  assert.equal(docSo('23.4'), 23.4);
  assert.equal(docSo('23,4%'), 23.4);
  assert.equal(docSo('1.234,5'), 1234.5);
  assert.equal(docSo('1,234.5'), 1234.5);
});

test('ô trống / không phải số → null (không đoán bừa)', () => {
  assert.equal(docSo(''), null);
  assert.equal(docSo('   '), null);
  assert.equal(docSo(null), null);
  assert.equal(docSo(undefined), null);
  assert.equal(docSo('abc'), null);
  assert.equal(docSo('12a'), null);
  assert.equal(docSo('1.2.3'), null);
});

test('định dạng tiền kiểu Việt Nam', () => {
  assert.equal(dinhDangTien(1234567), '1.234.567');
  assert.equal(dinhDangTien(12345.6), '12.346');
  assert.equal(dinhDangTien(-5000), '-5.000');
  assert.equal(dinhDangTien(null), '—');
  assert.equal(dinhDangPhanTram(0.2153), '21,5%');
});

test('chuẩn hóa tháng', () => {
  assert.equal(chuanHoaThang('10/2026'), '2026-10');
  assert.equal(chuanHoaThang('2026-1'), '2026-01');
  assert.equal(chuanHoaThang('2026/10/15'), '2026-10');
  assert.equal(chuanHoaThang('13/2026'), null);
  assert.equal(chuanHoaThang(new Date(2026, 0, 5)), '2026-01');
});

test('chọn bộ phí mới nhất có tháng áp dụng ≤ tháng cần tính', () => {
  const ds = [
    { gian: 'A', nganh: 'Tranh', thang: '2026-01', phi_san: 10 },
    { gian: 'A', nganh: 'Tranh', thang: '2026-06', phi_san: 12 },
    { gian: 'A', nganh: 'Tranh', thang: '2026-10', phi_san: 15 },
    { gian: 'A', nganh: 'Decal', thang: '2026-08', phi_san: 99 },
    { gian: 'B', nganh: 'Tranh', thang: '2026-03', phi_san: 50 },
  ];
  assert.equal(chonBoPhi(ds, 'A', 'Tranh', '2026-05').phi_san, 10);
  assert.equal(chonBoPhi(ds, 'A', 'Tranh', '2026-06').phi_san, 12);
  assert.equal(chonBoPhi(ds, 'A', 'Tranh', '2026-09').phi_san, 12);
  assert.equal(chonBoPhi(ds, 'A', 'Tranh', '2027-02').phi_san, 15);
  assert.equal(chonBoPhi(ds, 'A', 'Tranh', '2025-12'), null);
  assert.equal(chonBoPhi(ds, 'A', 'Decal', '2026-07'), null);
  // sửa phí tháng mới không làm mất phí tháng cũ
  assert.deepEqual(cacThangCoPhi(ds, 'A'), ['2026-10', '2026-08', '2026-06', '2026-01']);
});

test('làm tròn', () => {
  assert.equal(lamTronLen(71200), 72000);
  assert.equal(lamTronLen(72000), 72000);
  assert.equal(lamTronXuong(63999), 63000);
  assert.equal(lamTronLen(71210, 500), 71500);
  assert.equal(lamTronLen(71210, 100), 71300);
  assert.equal(lamTronDuoi9000(71200), 79000);
  assert.equal(lamTronDuoi9000(79000), 79000);
  assert.equal(lamTronDuoi9000(79001), 89000);
  assert.equal(lamTronDuoi9000(5000), 9000);
  assert.equal(lamTronTheoKieu(71200, 'khong'), 71200);
  // 0,1 + 0,2 kiểu sai số dấu phẩy động không làm nhảy bậc
  assert.equal(lamTronLen(0.1 * 3 * 10000, 1000), 3000);
});

test('sát dưới trần: số làm tròn lớn nhất NHỎ HƠN HẲN trần', () => {
  assert.equal(satDuoiTran(107800, 1000), 107000);
  assert.equal(satDuoiTran(108000, 1000), 107000);
  assert.equal(satDuoiTran(107800, 500), 107500);
  assert.equal(satDuoiTran(107800, 100), 107700);
});
