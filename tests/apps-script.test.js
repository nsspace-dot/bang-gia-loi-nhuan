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
