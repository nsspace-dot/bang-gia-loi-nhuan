// Đọc size dạng số×số từ chữ, và so sánh size.

import { boDau } from './van-ban.js';

// "30x40", "30 X 40 CM", "20x30x3cm", "60X150DECAL", "50x70 x 1 TẤM", "30x40cm x 3 tấm"
const MAU_SIZE = /(?<![\d.,])(\d{2,3})\s*(?:cm)?\s*[x×*]\s*(\d{2,3})(?![\d.,]\d)(?:\s*(?:cm)?\s*[x×*]\s*(\d{1,2})(?!\d))?/;

/**
 * @returns {{rong:number, cao:number, nhan:number|null}|null}
 *   nhan = số đứng sau size thứ ba (vd 20x30x3 → 3; "50x70 x 1 tấm" → 1), null nếu không có.
 */
export function docSize(vanBan) {
  const m = boDau(vanBan).match(MAU_SIZE);
  if (!m) return null;
  return { rong: +m[1], cao: +m[2], nhan: m[3] ? +m[3] : null };
}

/** Phân loại chuẩn trong bảng giá vốn: "30x40" hoặc "20x30x3". */
export function chuoiSize(rong, cao, nhan) {
  return nhan ? `${rong}x${cao}x${nhan}` : `${rong}x${cao}`;
}

/** Đọc lại phân loại trong bảng giá vốn (vd "20x30x3", "80x40"). */
export function docPhanLoai(phanLoai) {
  const m = boDau(phanLoai).replace(/\s+/g, '').replace(/cm/g, '').match(/^(\d+)[x×*](\d+)(?:[x×*](\d+))?$/);
  return m ? { rong: +m[1], cao: +m[2], nhan: m[3] ? +m[3] : null } : null;
}

/** a lớn hơn b khi cả rộng và cao đều ≥, và ít nhất một chiều lớn hơn hẳn. */
export function lonHon(a, b) {
  return a.rong >= b.rong && a.cao >= b.cao && (a.rong > b.rong || a.cao > b.cao);
}
