// Test đăng nhập + phân quyền trong Code.gs (môi trường giả lập). Tài khoản / mật khẩu GIẢ, chỉ dùng trong test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoMoiTruong } from './gia-lap-gas.js';

const MK = 'mat-khau-thu';

/** Môi trường có admin + 1 tài khoản shopee + 1 tiktok, và dữ liệu giả của cả 2 nền tảng. */
function moiTruongDayDu() {
  const g = taoMoiTruong();
  const ad = g.dangNhap('admin', MK);
  const ghi = (body) => { const r = g.post({ ...body, token: ad }); assert.equal(r.ok, true, r.loi); return r; };
  ghi({ action: 'themTaiKhoan', ten: 'nv-shopee', matKhau: 'shopee-123', vaiTro: 'shopee' });
  ghi({ action: 'themTaiKhoan', ten: 'nv-tiktok', matKhau: 'tiktok-123', vaiTro: 'tiktok' });
  ghi({ action: 'upsert', sheet: 'DANH_MUC', banGhi: [
    { loai: 'GIAN', ten: 'Gian TT', thu_tu: 1, dang_dung: 'co' }, { loai: 'NGANH', ten: 'Tranh', thu_tu: 1, dang_dung: 'co' },
    { loai: 'GIAN_SHOPEE', ten: 'CN1', thu_tu: 1, dang_dung: 'co' }] });
  ghi({ action: 'upsert', sheet: 'BANG_PHI', banGhi: [{ gian: 'Gian TT', nganh: 'Tranh', thang: '2026-10', phi_san: 20 }] });
  ghi({ action: 'upsert', sheet: 'BANG_PHI_SHOPEE', banGhi: [{ gian: 'CN1', nganh: 'Tranh', thang: '2026-10', phi_co_dinh: 19.1 }] });
  ghi({ action: 'upsert', sheet: 'GIA_VON', banGhi: [{ nhom: 'N', phan_loai: '30x40', gia_von: 1000 }] });
  ghi({ action: 'luuCampaign', campaign: { id: 'c1', ten: 'CP' }, ketQua: [{ sku_id: '1' }] });
  ghi({ action: 'luuBangTinh', bangTinh: { id: 'b1', ten: 'BT' }, dong: [{ stt: 1, ten: 'SP' }] });
  return { g, ad, sp: g.dangNhap('nv-shopee', 'shopee-123'), tt: g.dangNhap('nv-tiktok', 'tiktok-123') };
}

test('đăng nhập đúng → token + vai trò; tên không phân biệt hoa thường; sai → thông báo chung', () => {
  const g = taoMoiTruong();
  const r = g.post({ action: 'dangNhap', ten: ' Admin ', matKhau: MK });
  assert.equal(r.ok, true);
  assert.equal(r.vaiTro, 'admin');
  assert.equal(r.ten, 'admin');
  assert.match(r.token, /^[0-9a-f]{64}$/);
  assert.equal(g.post({ action: 'phien', token: r.token }).vaiTro, 'admin');
  for (const [ten, mk] of [['admin', 'sai-mat-khau'], ['khong-co', MK]]) {
    const x = g.post({ action: 'dangNhap', ten, matKhau: mk });
    assert.equal(x.ok, false);
    assert.equal(x.loi, 'Sai tên đăng nhập hoặc mật khẩu.');
    assert.equal(x.token, undefined);
  }
});

test('sai 5 lần → tạm khóa tài khoản đó (kể cả mật khẩu đúng); tài khoản khác không bị ảnh hưởng', () => {
  const { g } = moiTruongDayDu();
  for (let i = 0; i < 5; i++) assert.equal(g.post({ action: 'dangNhap', ten: 'nv-shopee', matKhau: 'sai' }).ok, false);
  const r = g.post({ action: 'dangNhap', ten: 'nv-shopee', matKhau: 'shopee-123' });
  assert.equal(r.ok, false);
  assert.match(r.loi, /quá 5 lần.*khóa 10 phút/);
  assert.equal(g.post({ action: 'dangNhap', ten: 'nv-tiktok', matKhau: 'tiktok-123' }).ok, true);
  // hết 10 phút (cache hết hạn) → đăng nhập lại được
  g.cache.delete('sai_dn_nv-shopee');
  assert.equal(g.post({ action: 'dangNhap', ten: 'nv-shopee', matKhau: 'shopee-123' }).ok, true);
});

test('mật khẩu lưu dạng hash SHA-256 + salt riêng, không có mật khẩu thô trong sheet / lịch sử / dữ liệu trả về', () => {
  const { g, ad } = moiTruongDayDu();
  g.post({ action: 'themTaiKhoan', token: ad, ten: 'nv-2', matKhau: 'shopee-123', vaiTro: 'shopee' }); // cùng mật khẩu với nv-shopee
  const sh = g.duLieuSheet('TAI_KHOAN');
  assert.deepEqual(sh[0], ['ten_dang_nhap', 'vai_tro', 'salt', 'hash', 'tao_luc', 'cap_nhat_luc']);
  const tatCa = JSON.stringify([...g.sheets.keys()].map((t) => g.duLieuSheet(t)));
  for (const mk of [MK, 'shopee-123', 'tiktok-123']) assert.ok(!tatCa.includes(mk), `lộ mật khẩu ${mk}`);
  const a = sh.find((d) => d[0] === 'nv-shopee'), b = sh.find((d) => d[0] === 'nv-2');
  assert.notEqual(a[2], b[2], 'salt khác nhau');
  assert.notEqual(a[3], b[3], 'cùng mật khẩu nhưng hash khác nhau');
  assert.match(a[3], /^sha256\$\d+\$[0-9a-f]{64}$/);
  const ds = g.post({ action: 'dsTaiKhoan', token: ad }).taiKhoan;
  assert.deepEqual(Object.keys(ds[0]).sort(), ['cap_nhat_luc', 'tao_luc', 'ten_dang_nhap', 'vai_tro']);
  assert.ok(!JSON.stringify(g.post({ action: 'docTatCa', token: ad })).includes(a[3]));
});

test('mọi lệnh đọc đều cần token hợp lệ; GET cũ không còn đọc được dữ liệu', () => {
  const { g } = moiTruongDayDu();
  for (const action of ['docTatCa', 'docBangTinh', 'docCampaignKQ', 'phien', 'dsTaiKhoan']) {
    const r = g.post({ action, id: 'b1' });
    assert.equal(r.ok, false, action);
    assert.equal(r.ma, 'CAN_DANG_NHAP', action);
    assert.equal(g.post({ action, id: 'b1', token: 'x'.repeat(64) }).ma, 'CAN_DANG_NHAP', action);
  }
  for (const action of ['docTatCa', 'docBangTinh', 'docCampaignKQ']) {
    const r = g.get({ action, id: 'b1' });
    assert.equal(r.ok, false);
    assert.equal(r.duLieu, undefined);
  }
});

test('shopee chỉ nhận dữ liệu Shopee; tiktok chỉ nhận dữ liệu TikTok; admin nhận tất cả', () => {
  const { g, ad, sp, tt } = moiTruongDayDu();
  const doc = (token) => g.post({ action: 'docTatCa', token }).duLieu;
  const s = doc(sp);
  assert.deepEqual(s.DANH_MUC.map((d) => d.loai), ['GIAN_SHOPEE']);
  assert.equal(s.BANG_PHI_SHOPEE.length, 1);
  for (const k of ['BANG_PHI', 'GIA_VON', 'NOI_SKU', 'CAMPAIGN']) assert.deepEqual(s[k], [], k);
  assert.equal(s.BANG_TINH.length, 1);
  const t = doc(tt);
  assert.deepEqual(t.DANH_MUC.map((d) => d.loai).sort(), ['GIAN', 'NGANH']);
  assert.deepEqual(t.BANG_PHI_SHOPEE, []);
  for (const k of ['BANG_PHI', 'GIA_VON', 'CAMPAIGN', 'BANG_TINH']) assert.equal(t[k].length, 1, k);
  const a = doc(ad);
  assert.equal(a.DANH_MUC.length, 3);
  assert.equal(a.BANG_PHI.length + a.BANG_PHI_SHOPEE.length, 2);
  // đọc chi tiết campaign: chỉ tiktok / admin
  assert.equal(g.post({ action: 'docCampaignKQ', token: sp, id: 'c1' }).ma, 'KHONG_CO_QUYEN');
  assert.equal(g.post({ action: 'docCampaignKQ', token: tt, id: 'c1' }).duLieu.length, 1);
  assert.equal(g.post({ action: 'docBangTinh', token: sp, id: 'b1' }).duLieu.length, 1);
});

// Lệnh ghi theo nền tảng. Bảng phí: Lưu (upsert), Nhập Excel (upsert nhiều dòng), Xóa bộ phí tháng (xoa).
// Danh mục: thêm gian (upsert), bớt gian (upsert dang_dung = 'khong'), xóa thẳng (xoa).
// "Hoàn tác" chỉ bỏ phần đang sửa trên máy, không gửi lệnh nào lên Apps Script.
const GHI_SHOPEE = [
  { ten: 'Lưu bảng phí Shopee', body: { action: 'upsert', sheet: 'BANG_PHI_SHOPEE', banGhi: [{ gian: 'CN1', nganh: 'Sách', thang: '2026-10', phi_co_dinh: 18 }] } },
  { ten: 'Nhập Excel bảng phí Shopee', body: { action: 'upsert', sheet: 'BANG_PHI_SHOPEE', banGhi: [
    { gian: 'CN1', nganh: 'Lịch', thang: '2026-11', phi_co_dinh: 18.7 }, { gian: 'CN1', nganh: 'Trà', thang: '2026-11', phi_co_dinh: 19.1 }] } },
  { ten: 'Thêm gian Shopee', body: { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'GIAN_SHOPEE', ten: 'CN9', thu_tu: 9, dang_dung: 'co' }] } },
  { ten: 'Bớt gian Shopee', body: { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'GIAN_SHOPEE', ten: 'CN9', dang_dung: 'khong' }] } },
  { ten: 'Xóa bộ phí tháng Shopee', body: { action: 'xoa', sheet: 'BANG_PHI_SHOPEE', khoa: [{ gian: 'CN1', nganh: 'Tranh', thang: '2026-10' }] } },
];
const GHI_TIKTOK = [
  { ten: 'Lưu bảng phí TikTok', body: { action: 'upsert', sheet: 'BANG_PHI', banGhi: [{ gian: 'Gian TT', nganh: 'Sách', thang: '2026-10', phi_san: 21 }] } },
  { ten: 'Nhập Excel bảng phí TikTok', body: { action: 'upsert', sheet: 'BANG_PHI', banGhi: [
    { gian: 'Gian TT', nganh: 'Lịch', thang: '2026-11', phi_san: 19 }, { gian: 'Gian TT', nganh: 'Trà', thang: '2026-11', phi_san: 18 }] } },
  { ten: 'Thêm gian TikTok', body: { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'GIAN', ten: 'Gian 2', thu_tu: 2, dang_dung: 'co' }] } },
  { ten: 'Thêm ngành TikTok', body: { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'NGANH', ten: 'Gốm', thu_tu: 6, dang_dung: 'co' }] } },
  { ten: 'Bớt gian TikTok', body: { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'GIAN', ten: 'Gian 2', dang_dung: 'khong' }] } },
  { ten: 'Xóa bộ phí tháng TikTok', body: { action: 'xoa', sheet: 'BANG_PHI', khoa: [{ gian: 'Gian TT', nganh: 'Tranh', thang: '2026-10' }] } },
];
// Chỉ admin, với mọi vai trò khác
const CHI_ADMIN = [
  { action: 'upsert', sheet: 'GIA_VON', banGhi: [{ nhom: 'N', phan_loai: '30x40', gia_von: 1 }] },
  { action: 'upsert', sheet: 'NOI_SKU', banGhi: [{ sku_id: '9' }] },
  { action: 'upsert', sheet: 'CAMPAIGN', banGhi: [{ id: 'c9' }] },
  { action: 'xoa', sheet: 'GIA_VON', khoa: [{ nhom: 'N', phan_loai: '30x40' }] },
  { action: 'luuBangTinh', bangTinh: { id: 'b2', ten: 'X' }, dong: [] },
  { action: 'xoaBangTinh', id: 'b1' },
  { action: 'luuCampaign', campaign: { id: 'c2' }, ketQua: [] },
  { action: 'dsTaiKhoan' },
  { action: 'themTaiKhoan', ten: 'hacker', matKhau: '12345678', vaiTro: 'admin' },
  { action: 'doiVaiTro', ten: 'nv-shopee', vaiTro: 'admin' },
  { action: 'doiMatKhau', ten: 'admin', matKhau: '12345678' },
  { action: 'xoaTaiKhoan', ten: 'admin' },
];

function tuChoi(g, token, body, nhan) {
  const r = g.post({ ...body, token });
  assert.equal(r.ok, false, `${nhan} phải bị từ chối`);
  assert.equal(r.ma, 'KHONG_CO_QUYEN', nhan);
}

test('shopee sửa được bảng phí + gian Shopee; lịch sử ghi tên người sửa', () => {
  const { g, ad, sp } = moiTruongDayDu();
  for (const { ten, body } of GHI_SHOPEE) {
    const r = g.post({ ...body, token: sp });
    assert.equal(r.ok, true, `${ten}: ${r.loi}`);
  }
  const du = g.post({ action: 'docTatCa', token: ad }).duLieu;
  assert.equal(du.BANG_PHI_SHOPEE.find((x) => x.nganh === 'Sách').phi_co_dinh, 18);
  assert.equal(du.BANG_PHI_SHOPEE.filter((x) => x.thang === '2026-11').length, 2);
  assert.equal(du.BANG_PHI_SHOPEE.some((x) => x.nganh === 'Tranh' && x.thang === '2026-10'), false, 'đã xóa bộ phí tháng');
  assert.equal(du.DANH_MUC.find((d) => d.ten === 'CN9').dang_dung, 'khong');
  const ls = g.duLieuSheet('LICH_SU_BANG_PHI_SHOPEE').slice(1).filter((d) => d[8] !== 'admin'); // bỏ dòng dữ liệu giả admin tạo sẵn
  assert.ok(ls.length >= 4 && ls.every((d) => d[8] === 'nv-shopee'), 'lịch sử bảng phí ghi người sửa');
  const lsGian = g.duLieuSheet('LICH_SU').filter((d) => d[2] === 'DANH_MUC' && d[3] === 'GIAN_SHOPEE|CN9');
  assert.deepEqual(lsGian.map((d) => [d[1], d[6]]), [['THEM', 'nv-shopee'], ['SUA', 'nv-shopee']]);
});

test('tiktok sửa được bảng phí + gian / ngành TikTok; lịch sử ghi tên người sửa', () => {
  const { g, ad, tt } = moiTruongDayDu();
  for (const { ten, body } of GHI_TIKTOK) {
    const r = g.post({ ...body, token: tt });
    assert.equal(r.ok, true, `${ten}: ${r.loi}`);
  }
  const du = g.post({ action: 'docTatCa', token: ad }).duLieu;
  assert.equal(du.BANG_PHI.find((x) => x.nganh === 'Sách').phi_san, 21);
  assert.ok(du.DANH_MUC.some((d) => d.loai === 'NGANH' && d.ten === 'Gốm'));
  assert.equal(du.BANG_PHI.some((x) => x.nganh === 'Tranh' && x.thang === '2026-10'), false);
  const ls = g.duLieuSheet('LICH_SU_BANG_PHI').slice(1).filter((d) => d[8] !== 'admin');
  assert.ok(ls.length >= 4 && ls.every((d) => d[8] === 'nv-tiktok'));
});

test('gọi thẳng Apps Script bằng token shopee để ghi TikTok (và ngược lại) → từ chối, không ghi gì', () => {
  const { g, ad, sp, tt } = moiTruongDayDu();
  const truoc = JSON.stringify(g.post({ action: 'docTatCa', token: ad }).duLieu);
  const lsTruoc = JSON.stringify([g.duLieuSheet('LICH_SU'), g.duLieuSheet('LICH_SU_BANG_PHI'), g.duLieuSheet('LICH_SU_BANG_PHI_SHOPEE')]);
  for (const { ten, body } of GHI_TIKTOK) tuChoi(g, sp, body, `shopee → ${ten}`);
  for (const { ten, body } of GHI_SHOPEE) tuChoi(g, tt, body, `tiktok → ${ten}`);
  // trộn: 1 bản ghi đúng nền tảng + 1 bản ghi nền tảng kia trong cùng lệnh → từ chối CẢ lệnh
  tuChoi(g, sp, { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'GIAN_SHOPEE', ten: 'CN8' }, { loai: 'GIAN', ten: 'Gian TT', dang_dung: 'khong' }] }, 'trộn danh mục');
  tuChoi(g, tt, { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'NGANH', ten: 'X' }, { loai: 'GIAN_SHOPEE', ten: 'CN1', dang_dung: 'khong' }] }, 'trộn danh mục 2');
  // xóa danh mục bằng khóa chuỗi "loai|ten", khóa thiếu loại, danh mục rỗng
  tuChoi(g, sp, { action: 'xoa', sheet: 'DANH_MUC', khoa: ['GIAN|Gian TT'] }, 'xóa gian TikTok bằng khóa chuỗi');
  tuChoi(g, tt, { action: 'xoa', sheet: 'DANH_MUC', khoa: [{ loai: 'GIAN_SHOPEE', ten: 'CN1' }] }, 'xóa gian Shopee');
  tuChoi(g, sp, { action: 'xoa', sheet: 'DANH_MUC', khoa: [{ ten: 'CN1' }] }, 'khóa thiếu loại');
  tuChoi(g, sp, { action: 'upsert', sheet: 'DANH_MUC', banGhi: [] }, 'danh mục rỗng');
  // sheet lạ / sheet hệ thống
  for (const sheet of ['LICH_SU', 'TAI_KHOAN', 'BANG_TINH', 'XYZ']) tuChoi(g, sp, { action: 'upsert', sheet, banGhi: [{ id: 'x' }] }, `shopee → ${sheet}`);
  assert.equal(JSON.stringify(g.post({ action: 'docTatCa', token: ad }).duLieu), truoc, 'dữ liệu không đổi');
  assert.equal(JSON.stringify([g.duLieuSheet('LICH_SU'), g.duLieuSheet('LICH_SU_BANG_PHI'), g.duLieuSheet('LICH_SU_BANG_PHI_SHOPEE')]), lsTruoc, 'lịch sử không đổi');
});

test('shopee / tiktok vẫn KHÔNG được: bảng tính đã lưu, campaign, giá vốn, quản lý tài khoản', () => {
  const { g, ad, sp, tt } = moiTruongDayDu();
  const truoc = JSON.stringify(g.post({ action: 'docTatCa', token: ad }).duLieu);
  for (const token of [sp, tt]) for (const body of CHI_ADMIN) tuChoi(g, token, body, body.action + (body.sheet ? ` ${body.sheet}` : ''));
  assert.equal(JSON.stringify(g.post({ action: 'docTatCa', token: ad }).duLieu), truoc);
  assert.equal(g.post({ action: 'dsTaiKhoan', token: ad }).taiKhoan.length, 3);
});

test('admin vẫn ghi được cả 2 nền tảng', () => {
  const { g, ad } = moiTruongDayDu();
  for (const { ten, body } of [...GHI_SHOPEE, ...GHI_TIKTOK]) assert.equal(g.post({ ...body, token: ad }).ok, true, ten);
});

test('admin quản lý tài khoản: thêm, đổi vai trò, đổi mật khẩu, xóa — có hiệu lực ngay với token đang dùng', () => {
  const { g, ad, sp } = moiTruongDayDu();
  const ql = (body) => g.post({ ...body, token: ad });
  assert.match(ql({ action: 'themTaiKhoan', ten: 'nv-shopee', matKhau: '12345678', vaiTro: 'shopee' }).loi, /đã có/);
  assert.match(ql({ action: 'themTaiKhoan', ten: 'a b', matKhau: '12345678', vaiTro: 'shopee' }).loi, /Tên đăng nhập/);
  assert.match(ql({ action: 'themTaiKhoan', ten: 'nv-3', matKhau: 'ngan', vaiTro: 'shopee' }).loi, /ít nhất 8/);
  assert.match(ql({ action: 'themTaiKhoan', ten: 'nv-3', matKhau: '12345678', vaiTro: 'sep' }).loi, /Vai trò/);
  // đổi vai trò shopee → tiktok: token cũ thấy ngay dữ liệu TikTok
  assert.equal(ql({ action: 'doiVaiTro', ten: 'nv-shopee', vaiTro: 'tiktok' }).taiKhoan.vai_tro, 'tiktok');
  assert.equal(g.post({ action: 'docTatCa', token: sp }).duLieu.BANG_PHI.length, 1);
  // đổi mật khẩu: mật khẩu cũ hết dùng được
  ql({ action: 'doiMatKhau', ten: 'nv-shopee', matKhau: 'mat-khau-moi' });
  assert.equal(g.post({ action: 'dangNhap', ten: 'nv-shopee', matKhau: 'shopee-123' }).ok, false);
  assert.equal(g.post({ action: 'dangNhap', ten: 'nv-shopee', matKhau: 'mat-khau-moi' }).ok, true);
  // xóa: token đang dùng hết hiệu lực ngay
  assert.equal(ql({ action: 'xoaTaiKhoan', ten: 'nv-shopee' }).daXoa, 1);
  assert.equal(g.post({ action: 'docTatCa', token: sp }).ma, 'CAN_DANG_NHAP');
  // lịch sử tài khoản ghi người làm, không ghi mật khẩu / hash
  const ls = g.duLieuSheet('LICH_SU').filter((d) => d[2] === 'TAI_KHOAN');
  assert.deepEqual(ls.map((d) => d[1]), ['THEM', 'THEM', 'THEM', 'DOI_VAI_TRO', 'DOI_MAT_KHAU', 'XOA']);
  assert.ok(ls.slice(1).every((d) => d[6] === 'admin'));
  assert.ok(!JSON.stringify(ls).includes('sha256$'));
});

test('không tự xóa / tự bỏ quyền admin; luôn còn ít nhất 1 admin', () => {
  const { g, ad } = moiTruongDayDu();
  assert.match(g.post({ action: 'xoaTaiKhoan', token: ad, ten: 'admin' }).loi, /Không tự xóa/);
  assert.match(g.post({ action: 'doiVaiTro', token: ad, ten: 'admin', vaiTro: 'shopee' }).loi, /Không tự bỏ quyền admin/);
  g.post({ action: 'themTaiKhoan', token: ad, ten: 'admin2', matKhau: '12345678', vaiTro: 'admin' });
  const ad2 = g.dangNhap('admin2', '12345678');
  assert.equal(g.post({ action: 'doiVaiTro', token: ad2, ten: 'admin', vaiTro: 'tiktok' }).ok, true);
  assert.match(g.post({ action: 'xoaTaiKhoan', token: ad2, ten: 'admin2' }).loi, /Không tự xóa/);
});

test('đăng xuất → token hết hiệu lực', () => {
  const { g, sp } = moiTruongDayDu();
  assert.equal(g.post({ action: 'dangXuat', token: sp }).ok, true);
  assert.equal(g.post({ action: 'docTatCa', token: sp }).ma, 'CAN_DANG_NHAP');
});

test('taoAdminDauTien: tạo admin từ Script properties rồi xóa chúng; đã có admin thì từ chối', () => {
  const g = taoMoiTruong({ admin: null });
  assert.equal(g.get({ action: 'ping' }).daCoAdmin, false);
  assert.throws(() => g.chay('taoAdminDauTien'), /Thiếu Script properties/);
  g.thuocTinh.set('SETUP_ADMIN_TEN', 'Chu-Shop');
  g.thuocTinh.set('SETUP_ADMIN_MAT_KHAU', 'mat-khau-dau-tien');
  assert.equal(g.chay('taoAdminDauTien').vai_tro, 'admin');
  assert.equal(g.thuocTinh.has('SETUP_ADMIN_MAT_KHAU'), false, 'mật khẩu không nằm lại trong Script properties');
  assert.equal(g.thuocTinh.has('SETUP_ADMIN_TEN'), false);
  assert.equal(g.get({ action: 'ping' }).daCoAdmin, true);
  assert.equal(g.post({ action: 'dangNhap', ten: 'chu-shop', matKhau: 'mat-khau-dau-tien' }).vaiTro, 'admin');
  g.thuocTinh.set('SETUP_ADMIN_TEN', 'ke-gian');
  g.thuocTinh.set('SETUP_ADMIN_MAT_KHAU', 'mat-khau-ke-gian');
  assert.throws(() => g.chay('taoAdminDauTien'), /Đã có admin/);
  assert.equal(g.thuocTinh.has('SETUP_ADMIN_MAT_KHAU'), false);
  assert.equal(g.post({ action: 'dangNhap', ten: 'ke-gian', matKhau: 'mat-khau-ke-gian' }).ok, false);
});

test('chưa có admin: không đăng nhập được, không đọc / ghi được gì', () => {
  const g = taoMoiTruong({ admin: null });
  assert.equal(g.post({ action: 'dangNhap', ten: 'admin', matKhau: MK }).ok, false);
  assert.equal(g.post({ action: 'docTatCa' }).ma, 'CAN_DANG_NHAP');
});
