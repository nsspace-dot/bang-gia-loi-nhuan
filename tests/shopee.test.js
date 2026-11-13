// Test công thức & mặc định Shopee — dữ liệu GIẢ. Shopee tách riêng, không dùng bộ phí / công thức TikTok.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KHOAN_PHI_SHOPEE, phiShopeeMacDinh, tyLePhiShopee, tinhLaiShopee, tinhLai } from '../js/core/cong-thuc.js';
import { GIAN_SHOPEE_MAC_DINH, NGANH_SHOPEE, layDanhSach } from '../js/core/danh-muc.js';

const gan = (a, b, sai = 1e-6) => assert.ok(Math.abs(a - b) < sai, `${a} ≠ ${b}`);

test('9 khoản phí Shopee: 8 khoản % + phí hạ tầng (đ)', () => {
  assert.deepEqual(KHOAN_PHI_SHOPEE.map((k) => k.khoa), [
    'phi_co_dinh', 'voucher_xtra', 'phi_ha_tang', 'phi_xu_ly', 'phi_dich_vu', 'quang_cao', 'voucher_shop', 'aff', 'phi_hoan_vcktc',
  ]);
  assert.deepEqual(KHOAN_PHI_SHOPEE.filter((k) => k.donVi === 'đ').map((k) => k.khoa), ['phi_ha_tang']);
});

test('mặc định: phí cố định 18,7% cho Lịch, 19,1% cho ngành khác; các khoản còn lại như nhau', () => {
  assert.deepEqual(phiShopeeMacDinh('Sách'), {
    phi_co_dinh: 19.1, voucher_xtra: 5.5, phi_ha_tang: 3000, phi_xu_ly: 6, phi_dich_vu: 7.5,
    quang_cao: 8.2, voucher_shop: 1.2, aff: 2, phi_hoan_vcktc: 0.5,
  });
  assert.equal(phiShopeeMacDinh('Lịch').phi_co_dinh, 18.7);
  for (const n of ['Tranh', 'Decal', 'Trà']) assert.equal(phiShopeeMacDinh(n).phi_co_dinh, 19.1);
});

test('tổng % = 8 khoản %, KHÔNG cộng phí hạ tầng', () => {
  gan(tyLePhiShopee(phiShopeeMacDinh('Sách')), 0.5); // 19,1+5,5+6+7,5+8,2+1,2+2+0,5 = 50%
  gan(tyLePhiShopee(phiShopeeMacDinh('Lịch')), 0.496);
  gan(tyLePhiShopee({ phi_ha_tang: 99999 }), 0);
});

test('lãi = giá bán − giá vốn − phí hạ tầng − giá bán × tổng %', () => {
  const r = tinhLaiShopee(40000, 100000, phiShopeeMacDinh('Sách'));
  gan(r.lai, 100000 - 40000 - 3000 - 50000); // 7.000
  gan(r.pt, 0.07);
  gan(tinhLaiShopee(40000, 100000, phiShopeeMacDinh('Lịch')).lai, 7400);
  // ô trống / chữ → coi như 0
  gan(tinhLaiShopee('', 50000, { phi_co_dinh: 10, phi_ha_tang: '' }).lai, 45000);
  assert.equal(tinhLaiShopee(1000, 0, phiShopeeMacDinh('Sách')).pt, null);
});

test('công thức TikTok không đổi, không đọc khoản phí Shopee', () => {
  const r = tinhLai(40000, 100000, { ...phiShopeeMacDinh('Sách'), phi_san: 20, phi_vc: 0, phi_xl: 0, phi_qc: 0, aff_qc: 0, aff_noqc: 0 });
  gan(r.laiQC, 40000);
  gan(r.laiKhongQC, 40000);
});

test('danh sách gian / ngành Shopee', () => {
  assert.deepEqual(GIAN_SHOPEE_MAC_DINH, ['Nhà Sách', 'CN1', 'CN2', 'Tường Vip', 'Tranh Vip', 'Tường Vip New']);
  assert.deepEqual(NGANH_SHOPEE, ['Sách', 'Tranh', 'Lịch', 'Decal', 'Trà']);
});

test('gian Shopee lấy từ DANH_MUC (loại GIAN_SHOPEE); chưa có thì dùng 6 gian mặc định; không lẫn gian TikTok', () => {
  assert.deepEqual(layDanhSach([], 'GIAN_SHOPEE'), GIAN_SHOPEE_MAC_DINH);
  const dm = [
    { loai: 'GIAN', ten: 'Gian TikTok', thu_tu: 1, dang_dung: 'co' },
    ...GIAN_SHOPEE_MAC_DINH.map((ten, i) => ({ loai: 'GIAN_SHOPEE', ten, thu_tu: i + 1, dang_dung: ten === 'CN2' ? 'khong' : 'co' })),
    { loai: 'GIAN_SHOPEE', ten: 'CN3', thu_tu: 7, dang_dung: 'co' },
  ];
  assert.deepEqual(layDanhSach(dm, 'GIAN_SHOPEE'), ['Nhà Sách', 'CN1', 'Tường Vip', 'Tranh Vip', 'Tường Vip New', 'CN3']);
  assert.deepEqual(layDanhSach(dm, 'GIAN'), ['Gian TikTok']);
});
