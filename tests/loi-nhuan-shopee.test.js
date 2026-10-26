// Test tab Tính lợi nhuận — phần Shopee (bang-tinh-shopee.js). Dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laiTaiGianShopee, laDongLoShopee, locVaSapXepShopee, tongKetShopee, bangXuatShopee } from '../js/core/bang-tinh-shopee.js';
import { phiShopeeMacDinh } from '../js/core/cong-thuc.js';

const gan = (a, b, sai = 1e-6) => assert.ok(Math.abs(a - b) < sai, `${a} ≠ ${b}`);

// G1 × Tranh: tổng % = 30, phí hạ tầng 1.000 (tháng 09); tháng 11 tăng lên 40%.
const bo = (thang, aff) => ({ gian: 'G1', nganh: 'Tranh', thang, ...phiShopeeMacDinh('Tranh'),
  phi_co_dinh: 10, voucher_xtra: 5, phi_ha_tang: 1000, phi_xu_ly: 5, phi_dich_vu: 5, quang_cao: 0, voucher_shop: 0, aff, phi_hoan_vcktc: 0 });
const PHI = [bo('2026-09', 5), bo('2026-11', 15)];

const DS = [
  { ten: 'Lãi', phan_loai: '30x40', nganh: 'Tranh', gia_von: 20000, gia_ban: 100000 },
  { ten: 'Lỗ', phan_loai: '40x60', nganh: 'Tranh', gia_von: 80000, gia_ban: 100000 },
  { ten: 'Chưa giá', phan_loai: '', nganh: 'Tranh', gia_von: 1000, gia_ban: null },
  { ten: 'Lịch', phan_loai: '', nganh: 'Lịch', gia_von: 10000, gia_ban: 50000 },
];

test('lãi = giá bán − vốn − phí hạ tầng − giá × tổng %, theo bộ phí mới nhất ≤ tháng', () => {
  const r = laiTaiGianShopee(DS[0], 'G1', PHI, '2026-10');
  assert.equal(r.trangThai, 'ok');
  assert.equal(r.macDinh, false);
  gan(r.lai, 100000 - 20000 - 1000 - 30000); // 49.000
  gan(r.pt, 0.49);
  gan(laiTaiGianShopee(DS[0], 'G1', PHI, '2026-11').lai, 100000 - 20000 - 1000 - 40000);
});

test('chưa lưu bộ phí (gian / ngành / tháng) → dùng phí mặc định Shopee, đánh dấu macDinh', () => {
  const a = laiTaiGianShopee(DS[0], 'G2', PHI, '2026-10');
  assert.equal(a.macDinh, true);
  gan(a.lai, 100000 - 20000 - 3000 - 50000); // mặc định Tranh: 50%, hạ tầng 3.000
  const b = laiTaiGianShopee(DS[0], 'G1', PHI, '2026-08'); // trước tháng có phí
  assert.equal(b.macDinh, true);
  const c = laiTaiGianShopee(DS[3], 'G1', PHI, '2026-10'); // ngành Lịch chưa có → 18,7% phí cố định
  gan(c.lai, 50000 - 10000 - 3000 - 50000 * 0.496);
});

test('chưa có giá bán → thiếu giá, không tính lãi', () => {
  assert.deepEqual(laiTaiGianShopee(DS[2], 'G1', PHI, '2026-10'), { trangThai: 'thieu-gia' });
  assert.deepEqual(laiTaiGianShopee({ ...DS[0], gia_ban: 0 }, 'G1', PHI, '2026-10'), { trangThai: 'thieu-gia' });
});

test('dòng lỗ, lọc chỉ dòng lỗ, tìm kiếm', () => {
  assert.equal(laDongLoShopee(DS[1], ['G1'], PHI, '2026-10'), true);
  assert.equal(laDongLoShopee(DS[0], ['G1'], PHI, '2026-10'), false);
  assert.equal(laDongLoShopee(DS[2], ['G1'], PHI, '2026-10'), false);
  assert.deepEqual(locVaSapXepShopee(DS, { gians: ['G1'], dsPhi: PHI, thang: '2026-10', chiLo: true }), [1]);
  assert.deepEqual(locVaSapXepShopee(DS, { gians: ['G1'], dsPhi: PHI, thang: '2026-10', tim: 'chua gia' }), [2]);
});

test('sắp xếp theo lãi của 1 gian; dòng chưa tính được luôn cuối', () => {
  const tg = { gians: ['G1'], dsPhi: PHI, thang: '2026-10' };
  assert.deepEqual(locVaSapXepShopee(DS, { ...tg, sapXep: { gian: 'G1', kichBan: 'lai', chieu: -1 } }), [0, 3, 1, 2]);
  assert.deepEqual(locVaSapXepShopee(DS, { ...tg, sapXep: { gian: 'G1', kichBan: 'lai', chieu: 1 } }), [1, 3, 0, 2]);
  assert.deepEqual(locVaSapXepShopee(DS, tg), [0, 1, 2, 3]);
});

test('tổng kết theo gian: lãi TB, số dòng lỗ, số dòng dùng phí mặc định', () => {
  const t = tongKetShopee(DS, ['G1', 'G2'], PHI, '2026-10');
  assert.equal(t.soDong, 4);
  assert.equal(t.tongVon, 111000);
  assert.equal(t.thieuGiaBan, 1);
  const g1 = t.theoGian.G1;
  assert.equal(g1.soDongTinh, 3);
  assert.equal(g1.soDongLo, 1);
  assert.equal(g1.macDinh, 1); // dòng Lịch
  const lai = [0, 1, 3].map((i) => laiTaiGianShopee(DS[i], 'G1', PHI, '2026-10').lai);
  gan(g1.tb, lai.reduce((a, b) => a + b) / 3);
  assert.equal(t.theoGian.G2.macDinh, 3);
});

test('xuất Excel: 5 cột như file mẫu + Lãi, % lãi từng gian', () => {
  const b = bangXuatShopee(DS, ['G1', 'G2'], PHI, '2026-10');
  assert.deepEqual(b[0], ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán', 'G1 - Lãi', 'G1 - % lãi', 'G2 - Lãi', 'G2 - % lãi']);
  assert.deepEqual(b[1], ['Lãi', '30x40', 'Tranh', 20000, 100000, 49000, 49, 27000, 27]);
  assert.deepEqual(b[3].slice(4), ['', 'thiếu giá bán', '', 'thiếu giá bán', '']);
});
