// Chọn bộ phí theo gian hàng × ngành × tháng áp dụng.
// Tháng dạng "YYYY-MM". Bộ phí dùng cho tháng T = bộ mới nhất có tháng áp dụng ≤ T.

import { KHOAN_PHI } from './cong-thuc.js';

const THANG = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function laThangHopLe(t) {
  return typeof t === 'string' && THANG.test(t);
}

/** Chuẩn hóa "10/2026", "2026-10", "2026/10", Date → "2026-10". */
export function chuanHoaThang(x) {
  if (x instanceof Date && !isNaN(x)) return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  const s = String(x ?? '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (m) return ghep(m[1], m[2]);
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return ghep(m[2], m[1]);
  return null;
  function ghep(nam, thang) {
    const t = +thang;
    return t >= 1 && t <= 12 ? `${nam}-${String(t).padStart(2, '0')}` : null;
  }
}

/** "2026-10" → "10/2026" */
export function hienThiThang(t) {
  return laThangHopLe(t) ? `${t.slice(5)}/${t.slice(0, 4)}` : '—';
}

export function thangHienTai(ngay = new Date()) {
  return chuanHoaThang(ngay);
}

/**
 * @param {Array} dsPhi các bản ghi {gian, nganh, thang, phi_san, ...}
 * @returns bản ghi phù hợp hoặc null
 */
export function chonBoPhi(dsPhi, gian, nganh, thang) {
  let tot = null;
  for (const p of dsPhi || []) {
    if (p.gian !== gian || p.nganh !== nganh || !laThangHopLe(p.thang)) continue;
    if (p.thang > thang) continue;
    if (!tot || p.thang > tot.thang) tot = p;
  }
  return tot;
}

/** Danh sách tháng đã có bộ phí của một gian (mới nhất trước). */
export function cacThangCoPhi(dsPhi, gian) {
  const s = new Set((dsPhi || []).filter((p) => p.gian === gian).map((p) => p.thang));
  return [...s].filter(laThangHopLe).sort().reverse();
}

export function boPhiRong(gian, nganh, thang) {
  const r = { gian, nganh, thang };
  for (const k of KHOAN_PHI) r[k.khoa] = 0;
  return r;
}

export function khoaPhi(p) {
  return `${p.gian}|${p.nganh}|${p.thang}`;
}
