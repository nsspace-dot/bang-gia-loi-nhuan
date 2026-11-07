// Test so sánh lãi 2 sàn (TikTok vs Shopee) — dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soSanhDong, tongHopSoSanh, sapXepSoSanh, bangXuatSoSanh, NGUONG_NGANG } from '../js/core/so-sanh.js';
import { tinhLai, tinhLaiShopee, phiShopeeMacDinh } from '../js/core/cong-thuc.js';

const gan = (a, b, sai = 1e-6) => assert.ok(Math.abs(a - b) < sai, `${a} ≠ ${b}`);
const PHI_TT = { gian: 'G1', nganh: 'Tranh', thang: '2026-10', phi_san: 20, phi_vc: 2000, phi_xl: 3000, phi_qc: 8, aff_qc: 5, aff_noqc: 10 };
const PHI_SP = { gian: 'CN1', nganh: 'Tranh', thang: '2026-10', ...phiShopeeMacDinh('Tranh') };
const CD = { gianTT: 'G1', kichBanTT: 'qc', dsPhiTT: [PHI_TT], gianSP: 'CN1', dsPhiSP: [PHI_SP], thang: '2026-10' };
const SP = (gia_von, gia_ban, x = {}) => ({ ten: 'A', phan_loai: '', nganh: 'Tranh', gia_von, gia_ban, ...x });

test('lãi mỗi bên theo bảng phí + công thức của sàn đó; chênh lệch = Shopee − TikTok', () => {
  const r = soSanhDong(SP(20000, 100000), CD);
  gan(r.tiktok.lai, tinhLai(20000, 100000, PHI_TT).laiQC);   // 100k − 20k − 5k − 33k = 42.000
  gan(r.shopee.lai, tinhLaiShopee(20000, 100000, PHI_SP).lai); // 100k − 20k − 3k − 50k = 27.000
  gan(r.chenh, 27000 - 42000);
  assert.equal(r.nen, 'tiktok');
  const kqc = soSanhDong(SP(20000, 100000), { ...CD, kichBanTT: 'khongqc' });
  gan(kqc.tiktok.lai, 45000);
  gan(kqc.tiktok.pt, 0.45);
});

test('nên bán: sàn lời hơn; chênh < NGUONG_NGANG → ngang', () => {
  // Shopee chỉ còn 5% phí cố định + 3.000 hạ tầng → lời hơn TikTok (33% + 5.000)
  const spRe = { ...PHI_SP, phi_co_dinh: 5, voucher_xtra: 0, phi_xu_ly: 0, phi_dich_vu: 0, quang_cao: 0, voucher_shop: 0, aff: 0, phi_hoan_vcktc: 0 };
  assert.equal(soSanhDong(SP(20000, 100000), { ...CD, dsPhiSP: [spRe] }).nen, 'shopee');
  // ngang: chỉnh để lãi 2 bên lệch < 1.000
  const ngang = { ...PHI_SP, phi_co_dinh: 0, voucher_xtra: 0, phi_xu_ly: 0, phi_dich_vu: 0, quang_cao: 0, voucher_shop: 0, aff: 33, phi_hoan_vcktc: 0, phi_ha_tang: 5000 + NGUONG_NGANG - 1 };
  assert.equal(soSanhDong(SP(20000, 100000), { ...CD, dsPhiSP: [ngang] }).nen, 'ngang');
});

test('1 bên chưa tính được (thiếu giá bán / chưa có phí) → không so, không đoán', () => {
  const a = soSanhDong(SP(20000, null), CD);
  assert.deepEqual([a.tiktok.trangThai, a.shopee.trangThai, a.chenh, a.nen], ['thieu-gia', 'thieu-gia', null, null]);
  const b = soSanhDong(SP(20000, 100000), { ...CD, gianSP: 'CN9' });
  assert.equal(b.tiktok.trangThai, 'ok');
  assert.equal(b.shopee.trangThai, 'thieu-phi');
  assert.equal(b.nen, null);
});

test('tổng hợp, sắp xếp theo chênh lệch (dòng chưa so được luôn cuối), xuất Excel', () => {
  const ds = [SP(20000, 100000), SP(20000, null), SP(20000, 300000), SP(80000, 100000)];
  const t = tongHopSoSanh(ds, CD);
  assert.equal(t.soDong, 4);
  assert.equal(t.soSanhDuoc, 3);
  assert.equal(t.tiktok, 3);
  assert.equal(t.shopee + t.ngang, 0);
  const ch = [0, 2, 3].map((i) => soSanhDong(ds[i], CD).chenh);
  gan(t.tbChenh, ch.reduce((a, b) => a + b) / 3);
  // chênh lệch: dòng 0 = −15.000, dòng 2 = −51.000, dòng 3 = −15.000 → tăng dần: 2, 0, 3, (1 chưa so)
  assert.deepEqual(sapXepSoSanh(ds, CD, 1), [2, 0, 3, 1]);
  assert.deepEqual(sapXepSoSanh(ds, CD, -1), [0, 3, 2, 1]);
  assert.deepEqual(sapXepSoSanh(ds, CD, null), [0, 1, 2, 3]);
  const x = bangXuatSoSanh(ds, CD);
  assert.deepEqual(x[0].slice(0, 5), ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán']);
  assert.equal(x[0][5], 'TikTok G1 (có QC) - Lãi');
  assert.deepEqual(x[1].slice(5), [42000, 42, 27000, 27, -15000, 'TikTok']);
  assert.deepEqual(x[2].slice(5), ['thiếu giá bán', '', 'thiếu giá bán', '', '', '']);
});
