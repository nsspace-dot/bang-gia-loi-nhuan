// Kho dữ liệu dùng chung: cache localStorage + đồng bộ với Apps Script.

import { goiGet, goiPost, LoiApi } from './api.js';

const KHOA_CACHE = 'bggl.cache.v1';
const KHOA_CAI_DAT = 'bggl.caidat.v1';
const KHOA_MAT_KHAU = 'bggl.matkhau.v1';

const KHOA_SHEET = {
  DANH_MUC: ['loai', 'ten'],
  BANG_PHI: ['gian', 'nganh', 'thang'],
  GIA_VON: ['nhom', 'phan_loai'],
  NOI_SKU: ['sku_id'],
  CAMPAIGN: ['id'],
  NGUOI_DUNG: ['ten'],
};

// Bảng tính KHÔNG nằm trong dữ liệu chung: mỗi người chỉ tải bảng của mình khi bấm "Mở bảng tính".
const rong = () => ({ DANH_MUC: [], BANG_PHI: [], GIA_VON: [], NOI_SKU: [], CAMPAIGN: [], NGUOI_DUNG: [] });

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

export function layMatKhau() {
  try { return sessionStorage.getItem(KHOA_MAT_KHAU) || localStorage.getItem(KHOA_MAT_KHAU) || ''; } catch { return ''; }
}

export function coNhoMatKhau() {
  try { return !!localStorage.getItem(KHOA_MAT_KHAU); } catch { return false; }
}

export function luuMatKhau(mk, nho) {
  try {
    localStorage.removeItem(KHOA_MAT_KHAU);
    sessionStorage.removeItem(KHOA_MAT_KHAU);
    if (mk) (nho ? localStorage : sessionStorage).setItem(KHOA_MAT_KHAU, mk);
  } catch { /* trình duyệt chặn bộ nhớ */ }
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
  ghiJSON(localStorage, KHOA_CACHE, { duLieu: trangThai.duLieu, luc: trangThai.luc });
}

export function khoiDong() {
  const c = docJSON(localStorage, KHOA_CACHE);
  if (c && c.duLieu) {
    trangThai.duLieu = { ...rong(), ...c.duLieu };
    trangThai.luc = c.luc || null;
  }
  baoThayDoi({ duLieuDoi: true, nguon: 'cache' });
  if (layCaiDat().url) return dongBo();
  return Promise.resolve();
}

let dangDongBo = null;

/** Tải dữ liệu từ Google Sheets. Chỉ báo "dữ liệu đổi" khi dữ liệu THẬT SỰ khác bản đang có. */
export function dongBo() {
  if (dangDongBo) return dangDongBo; // không chạy chồng 2 lần
  dangDongBo = (async () => {
    const { url } = layCaiDat();
    if (!url) {
      trangThai.dongBo = 'chua';
      baoThayDoi();
      return;
    }
    trangThai.dongBo = 'dang';
    trangThai.loi = '';
    baoThayDoi();
    let doi = false;
    try {
      const r = await goiGet(url, { action: 'docTatCa' });
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

export async function kiemTraKetNoi(url, matKhau) {
  const ping = await goiGet(url, { action: 'ping' });
  let matKhauDung = null;
  if (matKhau) {
    try {
      await goiPost(url, { action: 'kiemTraMatKhau', matKhau });
      matKhauDung = true;
    } catch (e) {
      matKhauDung = e.message;
    }
  }
  return { ...ping, matKhauDung };
}

// ---------- Ghi ----------

function khoaCua(sheet, o) {
  return KHOA_SHEET[sheet].map((k) => String(o[k] ?? '').trim()).join('|');
}

async function goiGhi(body) {
  const { url } = layCaiDat();
  const matKhau = layMatKhau();
  if (!matKhau) throw new LoiApi('Chưa nhập mật khẩu (mở ⚙️ Cài đặt). Cần mật khẩu để lưu.');
  return goiPost(url, { ...body, matKhau });
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

// ---------- Người dùng (không mật khẩu) ----------

const KHOA_NGUOI = 'bggl.nguoi.v1';
export const SAN = { TIKTOK: 'TikTok', SHOPEE: 'Shopee' };

/** Tên người dùng đang chọn trên máy này ('' nếu chưa chọn). */
export function layNguoi() {
  try { return localStorage.getItem(KHOA_NGUOI) || ''; } catch { return ''; }
}

export function chonNguoi(ten) {
  try { localStorage.setItem(KHOA_NGUOI, ten); } catch { /* bỏ qua */ }
  baoThayDoi({ duLieuDoi: false, nguoiDoi: true });
}

/** Danh sách tên đang dùng (theo thứ tự). */
export function dsNguoi({ caAn = false } = {}) {
  return [...trangThai.duLieu.NGUOI_DUNG]
    .filter((n) => caAn || n.dang_dung !== 'khong')
    .sort((a, b) => (a.thu_tu ?? 0) - (b.thu_tu ?? 0) || String(a.ten).localeCompare(String(b.ten), 'vi'));
}

function capNhatNguoi(banGhi) {
  const ds = trangThai.duLieu.NGUOI_DUNG;
  const i = ds.findIndex((n) => n.ten === banGhi.ten);
  if (i >= 0) ds[i] = banGhi; else ds.push(banGhi);
  luuCache();
  baoThayDoi(DA_GHI);
}

/** Ai cũng tự thêm được tên mình. */
export async function themNguoi(ten) {
  const r = await goiPost(layCaiDat().url, { action: 'themNguoi', ten });
  capNhatNguoi(r.banGhi);
  return r.banGhi;
}

/** Cần mật khẩu: đổi tên (bảng tính đổi chủ theo). */
export async function doiTenNguoi(tenCu, tenMoi) {
  const r = await goiGhi({ action: 'doiTenNguoi', tenCu, tenMoi });
  trangThai.duLieu.NGUOI_DUNG = trangThai.duLieu.NGUOI_DUNG.filter((n) => n.ten !== tenCu);
  capNhatNguoi(r.banGhi);
  if (layNguoi() === tenCu) chonNguoi(r.banGhi.ten);
  return r.banGhi;
}

// ---------- Bảng tính riêng của người đang chọn, theo sàn (tab Tính lợi nhuận) ----------

function canNguoi() {
  const nguoi = layNguoi();
  if (!nguoi) throw new LoiApi('Chưa chọn tên người dùng (bấm 👤 ở góc trên).');
  return nguoi;
}

const chuanDong = (ds) => ds
  .sort((a, b) => (a.stt ?? 0) - (b.stt ?? 0))
  .map((d) => ({ ten: d.ten ?? '', phan_loai: d.phan_loai ?? '', nganh: d.nganh ?? '', gia_von: d.gia_von ?? null, gia_ban: d.gia_ban ?? null }));

/** Bảng tính CỦA TÔI trên sàn này (Apps Script chỉ trả bảng của đúng tên này). */
export async function dsBangTinhCuaToi(san, nguoi = canNguoi()) {
  const r = await goiGet(layCaiDat().url, { action: 'dsBangTinhCuaToi', nguoi, san });
  return r.duLieu;
}

export async function docBangTinhCuaToi(san, id, nguoi = canNguoi()) {
  const r = await goiGet(layCaiDat().url, { action: 'docBangTinhCuaToi', nguoi, san, id });
  return chuanDong(r.duLieu);
}

/** Lưu bảng của mình — KHÔNG cần mật khẩu. Chỉ trả về khi Apps Script xác nhận. */
export async function luuBangTinhCuaToi(san, bangTinh, dong, nguoi = canNguoi()) {
  const r = await goiPost(layCaiDat().url, {
    action: 'luuBangTinhCuaToi', nguoi, san,
    bangTinh,
    dong: dong.map((d, i) => ({ stt: i + 1, ten: d.ten, phan_loai: d.phan_loai, nganh: d.nganh, gia_von: d.gia_von, gia_ban: d.gia_ban })),
  });
  return r.banGhi;
}

export async function doiTenBangTinhCuaToi(san, id, ten) {
  const r = await goiPost(layCaiDat().url, { action: 'doiTenBangTinhCuaToi', nguoi: canNguoi(), san, id, ten });
  return r.banGhi;
}

export async function xoaBangTinhCuaToi(san, id) {
  const r = await goiPost(layCaiDat().url, { action: 'xoaBangTinhCuaToi', nguoi: canNguoi(), san, id });
  return r.daXoa;
}

/** Bảng cũ (trước khi có người dùng) chưa có chủ — mọi người đều thấy để nhận. */
export async function dsBangTinhCu() {
  const r = await goiGet(layCaiDat().url, { action: 'dsBangTinhCu' });
  return r.duLieu;
}

export async function nhanBangTinhCu(id, san) {
  const r = await goiPost(layCaiDat().url, { action: 'nhanBangTinhCu', nguoi: canNguoi(), san, id });
  return r.banGhi;
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
  const r = await goiGet(layCaiDat().url, { action: 'docCampaignKQ', id });
  return r.duLieu;
}
