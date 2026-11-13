// Test Code.gs trên môi trường giả lập. Dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoMoiTruong } from './gia-lap-gas.js';

const MK = 'mat-khau-thu';
const phi = (thang, phi_san) => ({ gian: 'Gian A', nganh: 'Tranh', thang, phi_san, phi_vc: 1000, phi_xl: 2000, phi_qc: 5, aff_qc: 3, aff_noqc: 7 });

test('ping và đọc không cần mật khẩu', () => {
  const g = taoMoiTruong();
  assert.equal(g.get({ action: 'ping' }).ok, true);
  const r = g.get({ action: 'docTatCa' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.duLieu.BANG_PHI, []);
});

test('ghi không có / sai mật khẩu → bị từ chối, không ghi gì', () => {
  const g = taoMoiTruong();
  const a = g.post({ action: 'upsert', sheet: 'BANG_PHI', banGhi: [phi('2026-10', 20)] });
  assert.equal(a.ok, false);
  assert.match(a.loi, /Sai mật khẩu/);
  const b = g.post({ action: 'upsert', matKhau: 'sai', sheet: 'BANG_PHI', banGhi: [phi('2026-10', 20)] });
  assert.equal(b.ok, false);
  assert.deepEqual(g.get({ action: 'docTatCa' }).duLieu.BANG_PHI, []);
});

test('chưa đặt mật khẩu trong Script Properties → báo rõ', () => {
  const g = taoMoiTruong({ matKhau: '' });
  const r = g.post({ action: 'kiemTraMatKhau', matKhau: 'gi-cung-duoc' });
  assert.equal(r.ok, false);
  assert.match(r.loi, /Chưa đặt mật khẩu/);
});

test('sai mật khẩu quá 10 lần → tạm khóa', () => {
  const g = taoMoiTruong();
  for (let i = 0; i < 10; i++) g.post({ action: 'kiemTraMatKhau', matKhau: 'sai' });
  const r = g.post({ action: 'kiemTraMatKhau', matKhau: MK });
  assert.equal(r.ok, false);
  assert.match(r.loi, /quá nhiều lần/);
});

test('upsert theo khóa: tháng mới không ghi đè tháng cũ; sửa cùng khóa thì cập nhật đúng dòng', () => {
  const g = taoMoiTruong();
  assert.equal(g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-09', 20)] }).ok, true);
  assert.equal(g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-10', 21)] }).ok, true);
  assert.equal(g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-10', 22.5)] }).ok, true);
  const ds = g.get({ action: 'docTatCa' }).duLieu.BANG_PHI;
  assert.equal(ds.length, 2);
  assert.equal(ds.find((p) => p.thang === '2026-09').phi_san, 20);
  assert.equal(ds.find((p) => p.thang === '2026-10').phi_san, 22.5);
  assert.equal(typeof ds[0].phi_vc, 'number');
});

test('LICH_SU ghi thời gian, hành động, khóa, dữ liệu cũ, dữ liệu mới', () => {
  const g = taoMoiTruong();
  g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-10', 21)] });
  g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-10', 23)] });
  const ls = g.duLieuSheet('LICH_SU');
  assert.deepEqual(ls[0], ['thoi_gian', 'hanh_dong', 'sheet', 'khoa', 'du_lieu_cu', 'du_lieu_moi']);
  assert.equal(ls.length, 3);
  assert.equal(ls[1][1], 'THEM');
  assert.equal(ls[2][1], 'SUA');
  assert.equal(ls[2][3], 'Gian A|Tranh|2026-10');
  assert.equal(JSON.parse(ls[2][4]).phi_san, 21);
  assert.equal(JSON.parse(ls[2][5]).phi_san, 23);
});

test('ghi lại y hệt dữ liệu cũ → không ghi thêm lịch sử', () => {
  const g = taoMoiTruong();
  g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-10', 21)] });
  g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-10', 21)] });
  assert.equal(g.duLieuSheet('LICH_SU').length, 2);
});

test('SKU ID 19 chữ số giữ nguyên (không bị đổi thành số)', () => {
  const g = taoMoiTruong();
  const id = '1234567890123456789';
  g.post({ action: 'upsert', matKhau: MK, sheet: 'NOI_SKU', banGhi: [{ sku_id: id, nhom: 'Bộ 1 tấm', phan_loai: '30x40', so_luong: 2 }] });
  const ds = g.get({ action: 'docTatCa' }).duLieu.NOI_SKU;
  assert.equal(ds[0].sku_id, id);
  assert.equal(ds[0].so_luong, 2);
});

test('trùng khóa trong cùng 1 lần gửi → chỉ 1 dòng, giữ giá trị sau', () => {
  const g = taoMoiTruong();
  const r = g.post({ action: 'upsert', matKhau: MK, sheet: 'GIA_VON', banGhi: [
    { nhom: 'N', phan_loai: '30x40', gia_von: 1 }, { nhom: 'N', phan_loai: '30x40', gia_von: 2 },
  ] });
  assert.equal(r.ok, true);
  const ds = g.get({ action: 'docTatCa' }).duLieu.GIA_VON;
  assert.equal(ds.length, 1);
  assert.equal(ds[0].gia_von, 2);
});

test('xóa bản ghi + lịch sử XOA', () => {
  const g = taoMoiTruong();
  g.post({ action: 'upsert', matKhau: MK, sheet: 'GIA_VON', banGhi: [{ nhom: 'N', phan_loai: '30x40', gia_von: 1 }, { nhom: 'N', phan_loai: '40x60', gia_von: 2 }] });
  const r = g.post({ action: 'xoa', matKhau: MK, sheet: 'GIA_VON', khoa: [{ nhom: 'N', phan_loai: '30x40' }] });
  assert.equal(r.daXoa, 1);
  const ds = g.get({ action: 'docTatCa' }).duLieu.GIA_VON;
  assert.deepEqual(ds.map((x) => x.phan_loai), ['40x60']);
  assert.equal(g.duLieuSheet('LICH_SU').at(-1)[1], 'XOA');
});

test('bản ghi thiếu khóa → lỗi rõ ràng', () => {
  const g = taoMoiTruong();
  const r = g.post({ action: 'upsert', matKhau: MK, sheet: 'GIA_VON', banGhi: [{ nhom: 'N', gia_von: 1 }] });
  assert.equal(r.ok, false);
  assert.match(r.loi, /thiếu khóa/);
});

test('không cho ghi trực tiếp vào LICH_SU / sheet lạ', () => {
  const g = taoMoiTruong();
  assert.equal(g.post({ action: 'upsert', matKhau: MK, sheet: 'LICH_SU', banGhi: [{}] }).ok, false);
  assert.equal(g.post({ action: 'upsert', matKhau: MK, sheet: 'XYZ', banGhi: [{}] }).ok, false);
});

test('lưu campaign + kết quả; lưu lại thì thay kết quả cũ; LICH_SU chỉ 1 dòng tóm tắt', () => {
  const g = taoMoiTruong();
  const kq = Array.from({ length: 50 }, (_, i) => ({ sku_id: String(1000 + i), ket_qua: 'VAO', gia_campaign: 50000 + i }));
  let r = g.post({ action: 'luuCampaign', matKhau: MK, campaign: { id: 'c1', ten: 'Thử', gian: 'Gian A' }, ketQua: kq });
  assert.equal(r.ok, true);
  assert.equal(g.get({ action: 'docCampaignKQ', id: 'c1' }).duLieu.length, 50);
  r = g.post({ action: 'luuCampaign', matKhau: MK, campaign: { id: 'c1', ten: 'Thử 2' }, ketQua: kq.slice(0, 10) });
  assert.equal(g.get({ action: 'docCampaignKQ', id: 'c1' }).duLieu.length, 10);
  const cps = g.get({ action: 'docTatCa' }).duLieu.CAMPAIGN;
  assert.equal(cps.length, 1);
  assert.equal(cps[0].ten, 'Thử 2');
  assert.equal(cps[0].gian, 'Gian A');
  assert.equal(g.duLieuSheet('LICH_SU').length, 3);
});

test('bảng tính: lưu, đọc lại, xóa', () => {
  const g = taoMoiTruong();
  g.post({ action: 'luuBangTinh', matKhau: MK, bangTinh: { id: 'b1', ten: 'Bảng thử', so_dong: 2 }, dong: [
    { stt: 1, ten: 'Tranh "Có ngoặc kép"', gia_von: 1000, gia_ban: '' }, { stt: 2, ten: 'B', gia_von: 2000, gia_ban: 5000 },
  ] });
  g.post({ action: 'luuBangTinh', matKhau: MK, bangTinh: { id: 'b2', ten: 'Khác' }, dong: [{ stt: 1, ten: 'X' }] });
  const d = g.get({ action: 'docBangTinh', id: 'b1' }).duLieu;
  assert.equal(d.length, 2);
  assert.equal(d[0].ten, 'Tranh "Có ngoặc kép"');
  assert.equal(d[0].gia_ban, null);
  assert.equal(g.post({ action: 'xoaBangTinh', matKhau: MK, id: 'b1' }).daXoa, 1);
  assert.equal(g.get({ action: 'docBangTinh', id: 'b1' }).duLieu.length, 0);
  assert.equal(g.get({ action: 'docBangTinh', id: 'b2' }).duLieu.length, 1);
});

test('body không phải JSON → lỗi rõ ràng', () => {
  const g = taoMoiTruong();
  const r = g.post('khong phai json');
  assert.equal(r.ok, false);
  assert.match(r.loi, /JSON/);
});

test('LICH_SU_BANG_PHI: mỗi ô đổi 1 dòng (thời gian, tháng, gian, ngành, ô, cũ → mới); xóa tháng cũng ghi', () => {
  const g = taoMoiTruong();
  g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [phi('2026-10', 21)] });
  g.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: [{ ...phi('2026-10', 23), phi_qc: 0 }] });
  const ls = g.duLieuSheet('LICH_SU_BANG_PHI');
  assert.deepEqual(ls[0], ['thoi_gian', 'hanh_dong', 'thang', 'gian', 'nganh', 'o', 'gia_tri_cu', 'gia_tri_moi']);
  assert.equal(ls.filter((d) => d[1] === 'THEM').length, 6);
  const sua = ls.filter((d) => d[1] === 'SUA');
  assert.deepEqual(sua.map((d) => d.slice(2)), [
    ['2026-10', 'Gian A', 'Tranh', 'Phí sàn (%)', '21', '23'],
    ['2026-10', 'Gian A', 'Tranh', 'Chi phí QC (%)', '5', '0'],
  ]);
  assert.ok(sua[0][0]);
  g.post({ action: 'xoa', matKhau: MK, sheet: 'BANG_PHI', khoa: [{ gian: 'Gian A', nganh: 'Tranh', thang: '2026-10' }] });
  const xoa = g.duLieuSheet('LICH_SU_BANG_PHI').filter((d) => d[1] === 'XOA');
  assert.equal(xoa.length, 6);
  assert.equal(xoa[0][7], '');
});

// ---------- v1.2: người dùng + bảng tính riêng theo người & sàn (dữ liệu GIẢ) ----------

const DONG_GIA = [{ stt: 1, ten: 'SP A', phan_loai: '30x40', nganh: 'Tranh', gia_von: 1000, gia_ban: 5000 }];

test('người dùng tự thêm tên (không mật khẩu); không trùng tên; docTatCa trả NGUOI_DUNG, KHÔNG trả bảng tính', () => {
  const g = taoMoiTruong();
  assert.equal(g.post({ action: 'themNguoi', ten: '  Lan  ' }).ok, true);
  assert.match(g.post({ action: 'themNguoi', ten: 'lan' }).loi, /đã có/);
  const d = g.get({ action: 'docTatCa' }).duLieu;
  assert.deepEqual(d.NGUOI_DUNG.map((n) => n.ten), ['Lan']);
  assert.equal(d.BANG_TINH, undefined);
});

test('bảng tính tách theo người + sàn: không xem / sửa / xóa được bảng của người khác', () => {
  const g = taoMoiTruong();
  g.post({ action: 'themNguoi', ten: 'Lan' });
  g.post({ action: 'themNguoi', ten: 'Minh' });
  // lưu KHÔNG cần mật khẩu
  let r = g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', bangTinh: { id: 'b1', ten: 'Bảng Lan' }, dong: DONG_GIA });
  assert.equal(r.ok, true);
  assert.equal(r.banGhi.nguoi_tao, 'Lan');
  assert.equal(r.banGhi.san, 'TIKTOK');
  assert.ok(r.banGhi.tao_luc && r.banGhi.cap_nhat_luc);
  g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Minh', san: 'TIKTOK', bangTinh: { id: 'b2', ten: 'Bảng Minh' }, dong: DONG_GIA });
  g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Lan', san: 'SHOPEE', bangTinh: { id: 'b3', ten: 'Lan Shopee' }, dong: DONG_GIA });
  // danh sách: chỉ bảng của mình, đúng sàn
  assert.deepEqual(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK' }).duLieu.map((b) => b.id), ['b1']);
  assert.deepEqual(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan', san: 'SHOPEE' }).duLieu.map((b) => b.id), ['b3']);
  assert.deepEqual(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Minh', san: 'TIKTOK' }).duLieu.map((b) => b.id), ['b2']);
  // sheet riêng theo sàn
  assert.equal(g.duLieuSheet('BANG_TINH_TIKTOK').length, 3);
  assert.equal(g.duLieuSheet('BANG_TINH_SHOPEE').length, 2);
  // Minh không đọc / ghi đè / đổi tên / xóa được bảng của Lan
  assert.match(g.get({ action: 'docBangTinhCuaToi', nguoi: 'Minh', san: 'TIKTOK', id: 'b1' }).loi, /Không phải bảng tính của bạn/);
  assert.match(g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Minh', san: 'TIKTOK', bangTinh: { id: 'b1', ten: 'cướp' }, dong: [] }).loi, /Không phải bảng/);
  assert.match(g.post({ action: 'doiTenBangTinhCuaToi', nguoi: 'Minh', san: 'TIKTOK', id: 'b1', ten: 'x' }).loi, /Không phải bảng/);
  assert.match(g.post({ action: 'xoaBangTinhCuaToi', nguoi: 'Minh', san: 'TIKTOK', id: 'b1' }).loi, /Không phải bảng/);
  assert.equal(g.get({ action: 'docBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', id: 'b1' }).duLieu.length, 1);
  // tên không có trong danh sách → từ chối
  assert.match(g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Người lạ', san: 'TIKTOK', bangTinh: { id: 'b9', ten: 'x' }, dong: [] }).loi, /không có trong danh sách/);
  assert.match(g.get({ action: 'dsBangTinhCuaToi', nguoi: '', san: 'TIKTOK' }).loi, /Chưa chọn tên/);
  // của mình: đổi tên, lưu lại (giữ ngày tạo), xóa
  const taoLuc = g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK' }).duLieu[0].tao_luc;
  assert.equal(g.post({ action: 'doiTenBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', id: 'b1', ten: 'Tên mới' }).banGhi.ten, 'Tên mới');
  r = g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', bangTinh: { id: 'b1', ten: 'Tên mới' }, dong: [...DONG_GIA, { ...DONG_GIA[0], stt: 2 }] });
  assert.equal(r.banGhi.tao_luc, taoLuc);
  assert.equal(g.get({ action: 'docBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', id: 'b1' }).duLieu.length, 2);
  assert.equal(g.post({ action: 'xoaBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', id: 'b1' }).daXoa, 1);
  assert.equal(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK' }).duLieu.length, 0);
  assert.match(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan', san: 'LAZADA' }).loi, /Sàn không hợp lệ/);
});

test('bảng cũ chưa có chủ: ai cũng thấy; "Nhận" → thành bảng của người nhận (chọn sàn), biến khỏi danh sách cũ, KHÔNG mất dữ liệu', () => {
  const g = taoMoiTruong();
  g.post({ action: 'luuBangTinh', matKhau: MK, bangTinh: { id: 'cu1', ten: 'Bảng cũ 1', so_dong: 1 }, dong: DONG_GIA });
  g.post({ action: 'luuBangTinh', matKhau: MK, bangTinh: { id: 'cu2', ten: 'Bảng cũ 2', so_dong: 1 }, dong: DONG_GIA });
  g.post({ action: 'themNguoi', ten: 'Lan' });
  g.post({ action: 'themNguoi', ten: 'Minh' });
  assert.deepEqual(g.get({ action: 'dsBangTinhCu' }).duLieu.map((b) => b.id), ['cu1', 'cu2']);
  assert.equal(g.get({ action: 'docBangTinh', id: 'cu1' }).duLieu.length, 1);
  const r = g.post({ action: 'nhanBangTinhCu', nguoi: 'Lan', san: 'SHOPEE', id: 'cu1' });
  assert.equal(r.ok, true);
  assert.equal(r.banGhi.nguoi_tao, 'Lan');
  assert.equal(r.banGhi.nguon_cu, 'cu1');
  assert.deepEqual(g.get({ action: 'dsBangTinhCu' }).duLieu.map((b) => b.id), ['cu2']);
  assert.deepEqual(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan', san: 'SHOPEE' }).duLieu.map((b) => b.ten), ['Bảng cũ 1']);
  assert.equal(g.get({ action: 'docBangTinhCuaToi', nguoi: 'Lan', san: 'SHOPEE', id: r.banGhi.id }).duLieu[0].ten, 'SP A');
  assert.equal(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Minh', san: 'SHOPEE' }).duLieu.length, 0);
  // không ai nhận lại / đọc lén được nữa; dữ liệu cũ vẫn còn trong sheet cũ
  assert.match(g.post({ action: 'nhanBangTinhCu', nguoi: 'Minh', san: 'TIKTOK', id: 'cu1' }).loi, /đã có người nhận/);
  assert.deepEqual(g.get({ action: 'docBangTinh', id: 'cu1' }).duLieu, []);
  assert.equal(g.duLieuSheet('BANG_TINH').length, 3);
  assert.equal(g.duLieuSheet('BANG_TINH_DONG').length, 3);
});

test('quản lý tên (cần mật khẩu): ẩn tên, đổi tên → bảng tính đổi chủ theo', () => {
  const g = taoMoiTruong();
  g.post({ action: 'themNguoi', ten: 'Lan' });
  g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', bangTinh: { id: 'b1', ten: 'B' }, dong: [] });
  assert.match(g.post({ action: 'doiTenNguoi', tenCu: 'Lan', tenMoi: 'Lan Anh' }).loi, /Sai mật khẩu/);
  assert.equal(g.post({ action: 'doiTenNguoi', matKhau: MK, tenCu: 'Lan', tenMoi: 'Lan Anh' }).ok, true);
  assert.deepEqual(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan Anh', san: 'TIKTOK' }).duLieu.map((b) => b.id), ['b1']);
  assert.equal(g.post({ action: 'upsert', sheet: 'NGUOI_DUNG', banGhi: [{ ten: 'Lan Anh', dang_dung: 'khong' }] }).ok, false);
  assert.equal(g.post({ action: 'upsert', matKhau: MK, sheet: 'NGUOI_DUNG', banGhi: [{ ten: 'Lan Anh', dang_dung: 'khong' }] }).ok, true);
  assert.match(g.get({ action: 'dsBangTinhCuaToi', nguoi: 'Lan Anh', san: 'TIKTOK' }).loi, /đã bị ẩn|không có trong danh sách/);
  assert.match(g.post({ action: 'themNguoi', ten: 'lan anh' }).loi, /đã bị ẩn/);
});
