// Kho dữ liệu dùng chung: phiên đăng nhập, cache localStorage + đồng bộ với Apps Script.
// Mọi lệnh đọc / ghi đều gửi token; quyền được kiểm tra ở Apps Script (Code.gs), không chỉ ở giao diện.

import { goiGet, goiPost, LoiApi } from './api.js';

const KHOA_CACHE = 'bggl.cache.v1';
const KHOA_CAI_DAT = 'bggl.caidat.v1';
const KHOA_PHIEN = 'bggl.phien.v1'; // sessionStorage: { token, ten, vaiTro } — mất khi đóng tab trình duyệt
const KHOA_MAT_KHAU_CU = 'bggl.matkhau.v1'; // mật khẩu ghi chung bản cũ — xóa nếu còn

const KHOA_SHEET = {
  DANH_MUC: ['loai', 'ten'],
  BANG_PHI: ['gian', 'nganh', 'thang'],
  BANG_PHI_SHOPEE: ['gian', 'nganh', 'thang'],
  GIA_VON: ['nhom', 'phan_loai'],
  NOI_SKU: ['sku_id'],
  CAMPAIGN: ['id'],
  BANG_TINH: ['id'],
};

const rong = () => ({ DANH_MUC: [], BANG_PHI: [], BANG_PHI_SHOPEE: [], GIA_VON: [], NOI_SKU: [], CAMPAIGN: [], BANG_TINH: [] });

const trangThai = {
  duLieu: rong(),
  dongBo: 'chua', // chua | dang | xong | loi
  loi: '',
  luc: null,
};
const nguoiNghe = new Set();

function docJSON(kho, khoa) {
  try { return JSON.parse(kho.getItem(khoa) || 'null'); } catch { return null; }
}
function ghiJSON(kho, khoa, giaTri) {
  try { kho.setItem(khoa, JSON.stringify(giaTri)); return true; } catch { return false; }
}

// ---------- Cài đặt ----------

export function layCaiDat() {
  return { url: '', ...(docJSON(localStorage, KHOA_CAI_DAT) || {}) };
}

export function luuCaiDat(cd) {
  ghiJSON(localStorage, KHOA_CAI_DAT, { url: (cd.url || '').trim() });
}

// ---------- Phiên đăng nhập ----------

const NEN_TANG_THEO_VAI_TRO = { admin: ['shopee', 'tiktok'], shopee: ['shopee'], tiktok: ['tiktok'] };
const khiHetPhien = new Set();

export function layPhien() {
  return docJSON(sessionStorage, KHOA_PHIEN);
}

export const vaiTro = () => layPhien()?.vaiTro || null;
/** Chỉ admin được sửa (Apps Script cũng chặn). Dùng để ẩn / khóa nút trên giao diện. */
export const coQuyenGhi = () => vaiTro() === 'admin';
/** Nền tảng vai trò được xem: ['shopee', 'tiktok'] | ['shopee'] | ['tiktok'] | [] */
export const nenTangDuocXem = () => NEN_TANG_THEO_VAI_TRO[vaiTro()] || [];

/** Đăng ký hàm chạy khi phiên hết hạn / bị thu hồi (Apps Script trả CAN_DANG_NHAP). fn(phienCu) */
export function dangKyHetPhien(fn) {
  khiHetPhien.add(fn);
}

export async function dangNhap(ten, matKhau) {
  const r = await goiPost(layCaiDat().url, { action: 'dangNhap', ten, matKhau });
  const phien = { token: r.token, ten: r.ten, vaiTro: r.vaiTro };
  // Dữ liệu tạm của người khác trên máy này → bỏ, không hiện cho người mới đăng nhập
  const c = docJSON(localStorage, KHOA_CACHE);
  if (c && c.nguoi !== phien.ten) xoaCacheMay();
  ghiJSON(sessionStorage, KHOA_PHIEN, phien);
  return phien;
}

/** Đăng xuất: thu hồi token ở Apps Script (nếu được), xóa phiên + dữ liệu tạm trên máy. */
export async function dangXuat() {
  const p = layPhien();
  try { if (p) await goiPost(layCaiDat().url, { action: 'dangXuat', token: p.token }); } catch { /* vẫn xóa phiên trên máy */ }
  try { sessionStorage.removeItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
  xoaCacheMay();
}

function hetPhien() {
  const cu = layPhien();
  if (!cu) return; // đã báo rồi (nhiều lệnh cùng thất bại)
  try { sessionStorage.removeItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
  for (const fn of khiHetPhien) { try { fn(cu); } catch (e) { console.error(e); } }
}

/** Gọi Apps Script kèm token. Token hết hạn → xóa phiên và báo cho app (hiện lại màn đăng nhập). */
async function goiCoToken(body) {
  const p = layPhien();
  if (!p) throw new LoiApi('Cần đăng nhập.', 'CAN_DANG_NHAP');
  try {
    return await goiPost(layCaiDat().url, { ...body, token: p.token });
  } catch (e) {
    if (e.ma === 'CAN_DANG_NHAP') hetPhien();
    throw e;
  }
}

// ---------- Trạng thái ----------

export function lay() { return trangThai; }
export function duLieu() { return trangThai.duLieu; }

export function dangKy(fn) {
  nguoiNghe.add(fn);
  return () => nguoiNghe.delete(fn);
}

/**
 * Báo cho các tab. chiTiet.duLieuDoi = true khi DỮ LIỆU thay đổi (cần vẽ lại);
 * false khi chỉ đổi trạng thái đồng bộ (thanh trạng thái) → các tab KHÔNG vẽ lại.
 * chiTiet.nguon: 'dong-bo' (tải từ Google Sheets) | 'ghi' (máy này vừa lưu) | 'cache'.
 */
function baoThayDoi(chiTiet = { duLieuDoi: false }) {
  for (const fn of nguoiNghe) {
    try { fn(trangThai, chiTiet); } catch (e) { console.error(e); }
  }
}
const DA_GHI = { duLieuDoi: true, nguon: 'ghi' };

function luuCache() {
  const p = layPhien();
  if (!p) return;
  ghiJSON(localStorage, KHOA_CACHE, { duLieu: trangThai.duLieu, luc: trangThai.luc, nguoi: p.ten });
}

export function khoiDong() {
  try { localStorage.removeItem(KHOA_MAT_KHAU_CU); sessionStorage.removeItem(KHOA_MAT_KHAU_CU); } catch { /* bỏ qua */ }
  const p = layPhien();
  const c = docJSON(localStorage, KHOA_CACHE);
  // Chỉ dùng dữ liệu tạm của CHÍNH người đang đăng nhập
  if (p && c && c.duLieu && c.nguoi === p.ten) {
    trangThai.duLieu = { ...rong(), ...c.duLieu };
    trangThai.luc = c.luc || null;
  }
  baoThayDoi({ duLieuDoi: true, nguon: 'cache' });
  if (layCaiDat().url && p) return dongBo();
  return Promise.resolve();
}

let dangDongBo = null;

/** Tải dữ liệu từ Google Sheets. Chỉ báo "dữ liệu đổi" khi dữ liệu THẬT SỰ khác bản đang có. */
export function dongBo() {
  if (dangDongBo) return dangDongBo; // không chạy chồng 2 lần
  dangDongBo = (async () => {
    const { url } = layCaiDat();
    if (!url || !layPhien()) {
      trangThai.dongBo = 'chua';
      baoThayDoi();
      return;
    }
    trangThai.dongBo = 'dang';
    trangThai.loi = '';
    baoThayDoi();
    let doi = false;
    try {
      const r = await goiCoToken({ action: 'docTatCa' });
      const moi = { ...rong(), ...r.duLieu };
      doi = JSON.stringify(moi) !== JSON.stringify(trangThai.duLieu);
      if (doi) trangThai.duLieu = moi;
      trangThai.dongBo = 'xong';
      trangThai.luc = new Date().toISOString();
      luuCache();
    } catch (e) {
      trangThai.dongBo = 'loi';
      trangThai.loi = e.message;
    }
    baoThayDoi({ duLieuDoi: doi, nguon: 'dong-bo' });
  })();
  return dangDongBo.finally(() => { dangDongBo = null; });
}

/** Kiểm tra URL: { phienBan, daCoAdmin }. Không cần đăng nhập. */
export function kiemTraKetNoi(url) {
  return goiGet(url, { action: 'ping' });
}

// ---------- Ghi ----------

function khoaCua(sheet, o) {
  return KHOA_SHEET[sheet].map((k) => String(o[k] ?? '').trim()).join('|');
}

function goiGhi(body) {
  if (layPhien() && !coQuyenGhi()) return Promise.reject(new LoiApi('Tài khoản này chỉ được xem, không được sửa.', 'KHONG_CO_QUYEN'));
  return goiCoToken(body);
}

/** Ghi các bản ghi (upsert). Chỉ cập nhật dữ liệu trên máy SAU KHI Apps Script xác nhận. */
export async function ghi(sheet, banGhi) {
  if (!banGhi.length) return [];
  const r = await goiGhi({ action: 'upsert', sheet, banGhi });
  const ds = trangThai.duLieu[sheet];
  const viTri = new Map(ds.map((o, i) => [khoaCua(sheet, o), i]));
  for (const b of r.banGhi) {
    const i = viTri.get(khoaCua(sheet, b));
    if (i === undefined) { viTri.set(khoaCua(sheet, b), ds.length); ds.push(b); } else ds[i] = b;
  }
  luuCache();
  baoThayDoi(DA_GHI);
  return r.banGhi;
}

export async function xoa(sheet, dsKhoa) {
  if (!dsKhoa.length) return 0;
  const r = await goiGhi({ action: 'xoa', sheet, khoa: dsKhoa });
  const bo = new Set(dsKhoa.map((k) => khoaCua(sheet, k)));
  trangThai.duLieu[sheet] = trangThai.duLieu[sheet].filter((o) => !bo.has(khoaCua(sheet, o)));
  luuCache();
  baoThayDoi(DA_GHI);
  return r.daXoa;
}

export function xoaCacheMay() {
  try { localStorage.removeItem(KHOA_CACHE); } catch { /* bỏ qua */ }
  trangThai.duLieu = rong();
  trangThai.luc = null;
  baoThayDoi({ duLieuDoi: true, nguon: 'cache' });
}

// ---------- Bảng tính đã lưu (tab Tính lợi nhuận) ----------

/** Lưu bảng tính + toàn bộ dòng. Chỉ cập nhật danh sách trên máy SAU KHI Apps Script xác nhận. */
export async function luuBangTinh(bangTinh, dong) {
  const r = await goiGhi({
    action: 'luuBangTinh',
    bangTinh: { ...bangTinh, so_dong: dong.length },
    dong: dong.map((d, i) => ({ stt: i + 1, ten: d.ten, phan_loai: d.phan_loai, nganh: d.nganh, gia_von: d.gia_von, gia_ban: d.gia_ban })),
  });
  const ds = trangThai.duLieu.BANG_TINH;
  const i = ds.findIndex((b) => b.id === r.banGhi.id);
  if (i >= 0) ds[i] = r.banGhi; else ds.push(r.banGhi);
  luuCache();
  baoThayDoi(DA_GHI);
  return r.banGhi;
}

export async function docBangTinh(id) {
  const r = await goiCoToken({ action: 'docBangTinh', id });
  return r.duLieu
    .sort((a, b) => (a.stt ?? 0) - (b.stt ?? 0))
    .map((d) => ({ ten: d.ten ?? '', phan_loai: d.phan_loai ?? '', nganh: d.nganh ?? '', gia_von: d.gia_von ?? null, gia_ban: d.gia_ban ?? null }));
}

export async function xoaBangTinh(id) {
  await goiGhi({ action: 'xoaBangTinh', id });
  trangThai.duLieu.BANG_TINH = trangThai.duLieu.BANG_TINH.filter((b) => b.id !== id);
  luuCache();
  baoThayDoi(DA_GHI);
}

// ---------- Campaign ----------

/** Lưu campaign + kết quả (thay toàn bộ kết quả cũ của campaign này). */
export async function luuCampaign(campaign, ketQua) {
  const r = await goiGhi({ action: 'luuCampaign', campaign, ketQua });
  const ds = trangThai.duLieu.CAMPAIGN;
  const i = ds.findIndex((c) => c.id === r.banGhi.id);
  if (i >= 0) ds[i] = r.banGhi; else ds.push(r.banGhi);
  luuCache();
  baoThayDoi(DA_GHI);
  return r.banGhi;
}

export async function docCampaignKQ(id) {
  const r = await goiCoToken({ action: 'docCampaignKQ', id });
  return r.duLieu;
}

// ---------- Tài khoản (chỉ admin — Apps Script kiểm tra) ----------

export async function dsTaiKhoan() {
  return (await goiGhi({ action: 'dsTaiKhoan' })).taiKhoan;
}
export async function themTaiKhoan(ten, matKhau, vaiTroMoi) {
  return (await goiGhi({ action: 'themTaiKhoan', ten, matKhau, vaiTro: vaiTroMoi })).taiKhoan;
}
export async function doiMatKhau(ten, matKhau) {
  return (await goiGhi({ action: 'doiMatKhau', ten, matKhau })).taiKhoan;
}
export async function doiVaiTro(ten, vaiTroMoi) {
  return (await goiGhi({ action: 'doiVaiTro', ten, vaiTro: vaiTroMoi })).taiKhoan;
}
export async function xoaTaiKhoan(ten) {
  return (await goiGhi({ action: 'xoaTaiKhoan', ten })).daXoa;
}
