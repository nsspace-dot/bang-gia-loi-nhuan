// Test nhập / xuất Excel bảng phí Shopee (logic thuần). Dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COT_EXCEL_SHOPEE, bangXuatPhiShopee, bangMauPhiShopee, docNhapPhiShopee } from '../js/core/phi-shopee-excel.js';
import { phiShopeeMacDinh } from '../js/core/cong-thuc.js';

const GIANS = ['CN1', 'CN2'];
const bo = (gian, nganh, thang, sua = {}) => ({ gian, nganh, thang, ...phiShopeeMacDinh(nganh), ...sua });
const HIEN_CO = [bo('CN1', 'Tranh', '2026-10'), bo('CN1', 'Lịch', '2026-10')];

test('cột file: gian, ngành, tháng áp dụng + 9 khoản phí', () => {
  assert.deepEqual(COT_EXCEL_SHOPEE, ['Gian hàng', 'Ngành', 'Tháng áp dụng', 'Phí cố định (%)', 'Voucher Xtra (%)', 'Phí hạ tầng (đ)',
    'Phí xử lý (%)', 'Phí dịch vụ (%)', 'Quảng cáo (%)', 'Voucher shop (%)', 'AFF (%)', 'Phí hoàn V/C KTC (%)']);
});

test('xuất: sắp theo gian, tháng, ngành; tháng dạng 10/2026', () => {
  const b = bangXuatPhiShopee([bo('CN2', 'Sách', '2026-09'), ...HIEN_CO]);
  assert.deepEqual(b[0], COT_EXCEL_SHOPEE);
  assert.deepEqual(b.slice(1).map((d) => d.slice(0, 3)), [['CN1', 'Tranh', '10/2026'], ['CN1', 'Lịch', '10/2026'], ['CN2', 'Sách', '09/2026']]);
  assert.deepEqual(b[2].slice(3), [18.7, 5.5, 3000, 6, 7.5, 8.2, 1.2, 2, 0.5]);
});

test('file mẫu: 5 ngành của 1 gian với giá trị mặc định; nhập lại file mẫu đọc được, không lỗi', () => {
  const m = bangMauPhiShopee('CN2', '2026-11');
  assert.equal(m.length, 6);
  assert.deepEqual(m.slice(1).map((d) => d[1]), ['Sách', 'Tranh', 'Lịch', 'Decal', 'Trà']);
  const kq = docNhapPhiShopee(m, { dsHienCo: HIEN_CO, gians: GIANS });
  assert.equal(kq.loi.length, 0);
  assert.equal(kq.moi.length, 5);
});

test('nhập: phân loại dòng mới / thay đổi / giống cũ, chỉ liệt kê ô đổi', () => {
  const m = bangXuatPhiShopee(HIEN_CO); // 2 dòng giống cũ
  m[1][COT_EXCEL_SHOPEE.indexOf('AFF (%)')] = '3,5';           // CN1 Tranh: đổi AFF
  m[1][COT_EXCEL_SHOPEE.indexOf('Phí hạ tầng (đ)')] = '3.500'; // và phí hạ tầng
  m.push(['CN2', 'Trà', '2026-10', ...Object.values(phiShopeeMacDinh('Trà'))]); // mới
  const kq = docNhapPhiShopee(m, { dsHienCo: HIEN_CO, gians: GIANS });
  assert.deepEqual(kq.loi, []);
  assert.equal(kq.giongCu, 1);
  assert.equal(kq.moi.length, 1);
  assert.deepEqual(kq.moi[0].banGhi, bo('CN2', 'Trà', '2026-10'));
  assert.equal(kq.moi[0].soDong, 4);
  assert.equal(kq.doi.length, 1);
  assert.deepEqual(kq.doi[0].oDoi, ['phi_ha_tang', 'aff']);
  assert.equal(kq.doi[0].banGhi.aff, 3.5);
  assert.equal(kq.doi[0].banGhi.phi_ha_tang, 3500);
  assert.equal(kq.doi[0].cu.aff, 2);
});

test('nhập: kiểm tra số liệu — gian lạ, ngành lạ, tháng sai, ô trống, chữ, âm, % ≥ 100, trùng dòng', () => {
  const ok = (gian, nganh, thang) => [gian, nganh, thang, ...Object.values(phiShopeeMacDinh(nganh))];
  const m = [COT_EXCEL_SHOPEE,
    ok('CN9', 'Tranh', '10/2026'),
    ok('CN1', 'Gỗ', '10/2026'),
    ok('CN1', 'Tranh', '13/2026'),
    (() => { const d = ok('CN1', 'Sách', '10/2026'); d[3] = ''; d[4] = 'abc'; d[5] = -1; d[6] = 100; return d; })(),
    ok('CN2', 'Decal', '10/2026'),
    ok('CN2', 'Decal', '2026-10'),
    ['', '', '', ...Array(9).fill('')], // dòng trống: bỏ qua
  ];
  const kq = docNhapPhiShopee(m, { dsHienCo: HIEN_CO, gians: GIANS });
  assert.deepEqual(kq.loi.map((l) => l.soDong), [2, 3, 4, 5, 7]);
  assert.match(kq.loi[0].loi[0], /gian "CN9" chưa có/);
  assert.match(kq.loi[1].loi[0], /ngành "Gỗ" không hợp lệ/);
  assert.match(kq.loi[2].loi[0], /tháng "13\/2026" không hợp lệ/);
  assert.deepEqual(kq.loi[3].loi, ['Phí cố định: trống', 'Voucher Xtra: không phải số', 'Phí hạ tầng: không được âm', 'Phí xử lý: phải nhỏ hơn 100%']);
  assert.match(kq.loi[4].loi[0], /trùng .* dòng 6/);
  assert.equal(kq.moi.length, 1);
});

test('nhập: ô tháng bị Excel đổi thành ngày (số serial) vẫn đọc đúng tháng', () => {
  const serial = Math.round(Date.UTC(2026, 9, 1) / 86400000) + 25569; // 01/10/2026
  const kq = docNhapPhiShopee([COT_EXCEL_SHOPEE, ['CN1', 'Sách', serial, ...Object.values(phiShopeeMacDinh('Sách'))]], { gians: GIANS });
  assert.equal(kq.moi[0].banGhi.thang, '2026-10');
});

test('nhập: thiếu cột → báo lỗi file, không đọc dòng nào', () => {
  const kq = docNhapPhiShopee([['Gian hàng', 'Ngành']], { gians: GIANS });
  assert.match(kq.loiFile, /thiếu cột: Tháng áp dụng/);
});
