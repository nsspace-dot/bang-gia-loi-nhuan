// Test giá cần đạt (tab Tính lợi nhuận) — mỗi sàn dùng bảng phí + công thức của sàn đó. Dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { giaCanDatShopee, tinhLaiShopee, tinhLai, phiShopeeMacDinh } from '../js/core/cong-thuc.js';
import { giaCanDatTikTok, giaCanDatShopeeTaiGian, chuanMucTieu, loiMucLai, demDuoiGiaCanDat, MUC_TIEU_MAC_DINH } from '../js/core/gia-can-dat.js';

const gan = (a, b, sai = 1e-6) => assert.ok(Math.abs(a - b) < sai, `${a} ≠ ${b}`);
const PHI_TT = [{ gian: 'G1', nganh: 'Tranh', thang: '2026-10', phi_san: 20, phi_vc: 2000, phi_xl: 3000, phi_qc: 8, aff_qc: 5, aff_noqc: 10 }];
const PHI_SP = [{ gian: 'CN1', nganh: 'Tranh', thang: '2026-10', ...phiShopeeMacDinh('Tranh') }]; // tổng 50%, hạ tầng 3.000
const SP = { ten: 'A', phan_loai: '', nganh: 'Tranh', gia_von: 20000, gia_ban: 79000 };
const mt = (x = {}) => ({ ...MUC_TIEU_MAC_DINH, bat: true, ...x });

test('Shopee: giá cần đạt = (vốn + hạ tầng + lãi đ) / (1 − tổng % − lãi %); đúng bằng giá có lãi đúng mức đó', () => {
  const phi = PHI_SP[0];
  gan(giaCanDatShopee(20000, phi, { laiPhanTram: 0.15 }), 23000 / 0.35);
  gan(giaCanDatShopee(20000, phi, { laiDong: 10000 }), 33000 / 0.5);
  const g = giaCanDatShopee(20000, phi, { laiPhanTram: 0.15 });
  gan(tinhLaiShopee(20000, g, phi).pt, 0.15);
  assert.equal(giaCanDatShopee(20000, phi, { laiPhanTram: 0.5 }), null, 'tổng % + lãi % ≥ 100% → không đạt được');
});

test('TikTok: theo kịch bản QC; "cả 2" lấy kịch bản phí cao hơn; giá tìm được cho đúng mức lãi', () => {
  const r = giaCanDatTikTok(SP, 'G1', PHI_TT, '2026-10', mt({ giaTri: 15, lamTron: 'khong', kichBan: 'qc' }));
  gan(r.gia, 25000 / (1 - 0.33 - 0.15));
  gan(tinhLai(20000, r.gia, PHI_TT[0]).ptQC, 0.15);
  const ca2 = giaCanDatTikTok(SP, 'G1', PHI_TT, '2026-10', mt({ giaTri: 15, lamTron: 'khong', kichBan: 'ca2' }));
  gan(ca2.gia, r.gia); // QC 33% > không QC 30%
  const kqc = giaCanDatTikTok(SP, 'G1', PHI_TT, '2026-10', mt({ giaTri: 15, lamTron: 'khong', kichBan: 'khongqc' }));
  gan(kqc.gia, 25000 / (1 - 0.30 - 0.15));
});

test('làm tròn lên 1.000 / đuôi 9.000; báo thiếu bao nhiêu khi giá bán đang thấp hơn', () => {
  // Shopee 15%: 23.000 / 0,35 = 65.714 → lên 1.000 = 66.000; đuôi 9.000 = 69.000
  assert.equal(giaCanDatShopeeTaiGian(SP, 'CN1', PHI_SP, '2026-10', mt()).gia, 66000);
  assert.equal(giaCanDatShopeeTaiGian(SP, 'CN1', PHI_SP, '2026-10', mt({ lamTron: 'duoi9000' })).gia, 69000);
  assert.equal(giaCanDatShopeeTaiGian(SP, 'CN1', PHI_SP, '2026-10', mt()).thieu, null, 'giá bán 79.000 ≥ 66.000 → đạt');
  const re = giaCanDatShopeeTaiGian({ ...SP, gia_ban: 59000 }, 'CN1', PHI_SP, '2026-10', mt());
  assert.equal(re.thieu, 7000);
  assert.equal(giaCanDatShopeeTaiGian({ ...SP, gia_ban: null }, 'CN1', PHI_SP, '2026-10', mt()).thieu, null, 'chưa có giá bán vẫn tính giá cần đạt');
  assert.equal(giaCanDatShopeeTaiGian({ ...SP, gia_ban: null }, 'CN1', PHI_SP, '2026-10', mt()).gia, 66000);
});

test('trạng thái: thiếu giá vốn, chưa có phí, không đạt được', () => {
  assert.equal(giaCanDatShopeeTaiGian({ ...SP, gia_von: null }, 'CN1', PHI_SP, '2026-10', mt()).trangThai, 'thieu-von');
  assert.equal(giaCanDatShopeeTaiGian(SP, 'CN2', PHI_SP, '2026-10', mt()).trangThai, 'thieu-phi');
  assert.equal(giaCanDatTikTok(SP, 'G1', PHI_TT, '2026-09', mt()).trangThai, 'thieu-phi', 'trước tháng có phí');
  assert.equal(giaCanDatShopeeTaiGian(SP, 'CN1', PHI_SP, '2026-10', mt({ giaTri: 60 })).trangThai, 'khong-dat');
});

test('đếm số dòng dưới giá cần đạt theo gian', () => {
  const ds = [SP, { ...SP, gia_ban: 50000 }, { ...SP, gia_ban: null }];
  assert.deepEqual(demDuoiGiaCanDat(ds, ['CN1', 'CN2'], (d, g) => giaCanDatShopeeTaiGian(d, g, PHI_SP, '2026-10', mt())), { CN1: 1, CN2: 0 });
});

test('thiết lập đọc từ máy: giá trị lạ → mặc định; kiểm tra mức lãi nhập', () => {
  assert.deepEqual(chuanMucTieu(null), MUC_TIEU_MAC_DINH);
  assert.deepEqual(chuanMucTieu({ bat: 'co', giaTri: 'abc', donVi: 'x', kichBan: 'y', lamTron: 'z' }), MUC_TIEU_MAC_DINH);
  assert.deepEqual(chuanMucTieu({ bat: true, giaTri: 20000, donVi: 'dong', kichBan: 'qc', lamTron: 'khong' }),
    { bat: true, giaTri: 20000, donVi: 'dong', kichBan: 'qc', lamTron: 'khong' });
  assert.equal(chuanMucTieu({ giaTri: 150, donVi: 'pt' }).giaTri, 15, '% ≥ 100 → mặc định');
  assert.equal(chuanMucTieu({ giaTri: -5, donVi: 'dong' }).giaTri, 10000, 'đ âm → mặc định 10.000');
  assert.equal(chuanMucTieu({ giaTri: '20', donVi: 'pt' }).giaTri, 15, 'chuỗi → mặc định');
  assert.equal(loiMucLai(15, 'pt'), null);
  assert.equal(loiMucLai(100, 'pt'), 'Phải nhỏ hơn 100%');
  assert.equal(loiMucLai(-1, 'dong'), 'Không được âm');
  assert.equal(loiMucLai(null, 'dong'), 'Không phải số');
  assert.equal(loiMucLai(250000, 'dong'), null);
});
