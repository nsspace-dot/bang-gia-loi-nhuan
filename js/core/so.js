// Đọc và định dạng số kiểu Việt Nam.
// docSo("45.000") = 45000, docSo("45,000") = 45000, docSo("12,5") = 12.5, docSo("") = null

const NHOM_CHAM = /^-?\d{1,3}(\.\d{3})+$/;   // 1.234.567
const NHOM_PHAY = /^-?\d{1,3}(,\d{3})+$/;    // 1,234,567

/** Trả về số, hoặc null nếu ô trống / không phải số. */
export function docSo(giaTri) {
  if (giaTri === null || giaTri === undefined) return null;
  if (typeof giaTri === 'number') return Number.isFinite(giaTri) ? giaTri : null;
  let s = String(giaTri).trim();
  if (!s) return null;
  // bỏ đơn vị, khoảng trắng (kể cả khoảng trắng không ngắt), ký hiệu tiền
  s = s.replace(/[\s ]/g, '').replace(/(vnđ|vnd|đồng|đ|d|%)$/i, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const coCham = s.includes('.'), coPhay = s.includes(',');
  if (coCham && coPhay) {
    // dấu nào đứng sau cùng là dấu thập phân: "1.234,5" hoặc "1,234.5"
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (coCham) {
    if (NHOM_CHAM.test(s)) s = s.replace(/\./g, '');
    else if ((s.match(/\./g) || []).length > 1) return null;
  } else if (coPhay) {
    if (NHOM_PHAY.test(s)) s = s.replace(/,/g, '');
    else if ((s.match(/,/g) || []).length > 1) return null;
    else s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const DINH_DANG_NGUYEN = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const DINH_DANG_PT = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DINH_DANG_LE = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** 45000 → "45.000" ; null → "—" */
export function dinhDangTien(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return DINH_DANG_NGUYEN.format(Math.round(n));
}

/** 0.2153 → "21,5%" */
export function dinhDangPhanTram(tyLe) {
  if (tyLe === null || tyLe === undefined || !Number.isFinite(tyLe)) return '—';
  return DINH_DANG_PT.format(tyLe * 100) + '%';
}

/** Số có thể lẻ (vd phí 23,4) → "23,4" */
export function dinhDangSo(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return DINH_DANG_LE.format(n);
}
