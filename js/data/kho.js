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
  BANG_TINH: ['id'],
};

const rong = () => ({ DANH_MUC: [], BANG_PHI: [], GIA_VON: [], NOI_SKU: [], CAMPAIGN: [], BANG_TINH: [] });

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
  const r = await goiGet(layCaiDat().url, { action: 'docBangTinh', id });
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
  const r = await goiGet(layCaiDat().url, { action: 'docCampaignKQ', id });
  return r.duLieu;
}
