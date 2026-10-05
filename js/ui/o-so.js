// Ô nhập số dùng chung cho mọi tab.
// - type="text" + inputmode="decimal" (KHÔNG dùng type="number": lăn chuột / phím ↑↓ không đổi giá trị).
// - Chấp nhận "8,14" và "8.14" (%), "2.008" và "2008" (đ).
// - Trong lúc gõ: chỉ kiểm tra hợp lệ (tô đỏ nếu sai), KHÔNG định dạng lại → con trỏ không nhảy.
// - Rời ô / Enter: chuẩn hóa + định dạng lại, gọi khiLuu(so). Enter chuyển sang ô kế tiếp.
// - Esc: hủy phần đang gõ, trả về giá trị trước khi sửa.

import { h } from './dom.js';
import { docSo, dinhDangTien, dinhDangSo } from '../core/so.js';

export function dinhDangTheoKieu(so, kieu) {
  if (so === null || so === undefined || !Number.isFinite(so)) return '';
  return kieu === 'tien' ? dinhDangTien(so) : dinhDangSo(so);
}

/**
 * @param {object} p
 *   giaTri: số hoặc null (giá trị đã lưu)
 *   kieu: 'tien' (đ, số nguyên) | 'phantram' | 'so'
 *   kiemTra(so): chuỗi lỗi hoặc null — kiểm tra thêm (vd < 100%)
 *   choPhepTrong: ô trống hợp lệ (giá trị null)
 *   khiGo(so|null, hopLe, chuoi): gọi mỗi lần gõ (không vẽ lại!) — dùng để đánh dấu "đã sửa", cập nhật tổng
 *   khiLuu(so|null): gọi khi rời ô / Enter mà giá trị đã đổi và hợp lệ
 *   giaTriGo: chuỗi đang gõ dở (khi vẽ lại mà người dùng chưa xong)
 *   ...thuộc tính khác của <input> (class, aria-label, data-o, placeholder, disabled)
 */
export function oSo({ giaTri, kieu = 'tien', kiemTra, choPhepTrong = true, khiGo, khiLuu, giaTriGo, class: lop, ...thuocTinh }) {
  const hienThi = dinhDangTheoKieu(giaTri, kieu);
  const el = h('input', {
    ...thuocTinh,
    class: ['o-so', ...[].concat(lop)],
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    spellcheck: 'false',
    value: giaTriGo ?? hienThi,
  });
  el.dataset.goc = hienThi; // giá trị đã chốt (để biết có đang sửa dở không, và để Esc khôi phục)
  el.dataset.oSo = kieu;

  const phanTich = () => {
    const tho = el.value.trim();
    if (tho === '') return choPhepTrong ? { so: null, loi: null } : { so: null, loi: 'Không được để trống' };
    const so = docSo(tho);
    if (so === null) return { so: null, loi: `"${tho}" không phải số` };
    if (so < 0) return { so, loi: 'Không được âm' };
    return { so, loi: kiemTra ? kiemTra(so) : null };
  };
  const danhDau = () => {
    const { so, loi } = phanTich();
    el.classList.toggle('o-loi', !!loi);
    el.title = loi || '';
    return { so, loi };
  };
  if (giaTriGo !== undefined && giaTriGo !== hienThi) danhDau();

  const chot = () => {
    if (el.value === el.dataset.goc) { el.classList.remove('o-loi'); el.title = ''; return true; }
    const { so, loi } = danhDau();
    if (loi) return false;
    const chuan = dinhDangTheoKieu(so, kieu);
    const cu = docSo(el.dataset.goc);
    el.value = chuan;
    el.dataset.goc = chuan;
    if (so !== cu && khiLuu) khiLuu(so);
    return true;
  };

  el.addEventListener('input', () => {
    const { so, loi } = danhDau();
    if (khiGo) khiGo(so, !loi, el.value);
  });
  el.addEventListener('blur', chot);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (chot()) diToiOKe(el, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // không đóng hộp thoại
      el.value = el.dataset.goc;
      const { so, loi } = danhDau();
      if (khiGo) khiGo(so, !loi, el.value);
      el.select();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); // không tăng/giảm số, không nhảy con trỏ
    }
  });
  // Lăn chuột trên ô chỉ cuộn trang như bình thường (ô text không đổi giá trị).
  return el;
}

/** Chuyển con trỏ sang ô nhập kế tiếp (Enter) trong cùng bảng / khung. */
export function diToiOKe(el, huong = 1) {
  // Ô có thể vừa được thay bằng ô mới (dòng được vẽ lại sau khi chốt) → tìm ô mới theo data-o
  if (!el.isConnected && el.dataset.o) {
    const moi = document.querySelector(`[data-o="${CSS.escape(el.dataset.o)}"]`);
    if (!moi) return;
    el = moi;
  }
  const khung = el.closest('[data-dieu-huong]') || el.closest('table') || document.body;
  const ds = [...khung.querySelectorAll('input:not([type=checkbox]):not([type=search]):not([disabled]), select:not([disabled])')]
    .filter((x) => x.offsetParent !== null);
  const i = ds.indexOf(el);
  const ke = ds[i + huong];
  if (ke) {
    // Chỉ cuộn khi ô kế tiếp đang khuất (trình duyệt tự cuộn tối thiểu)
    ke.focus();
    if (ke.select) ke.select();
  } else {
    el.blur();
  }
}

/** Ô chữ (tên, phân loại…) cùng hành vi: chốt khi rời ô / Enter, Esc hủy, Enter sang ô kế. */
export function oChu({ giaTri, khiLuu, class: lop, ...thuocTinh }) {
  const el = h('input', { ...thuocTinh, class: lop, type: 'text', value: giaTri ?? '', autocomplete: 'off' });
  el.dataset.goc = giaTri ?? '';
  const chot = () => {
    const moi = el.value.trim();
    if (moi === el.dataset.goc) return;
    el.dataset.goc = moi;
    el.value = moi;
    if (khiLuu) khiLuu(moi);
  };
  el.addEventListener('blur', chot);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); chot(); diToiOKe(el, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); el.value = el.dataset.goc; el.select(); }
  });
  return el;
}

/** Có ô nào trong vùng đang được gõ dở (khác giá trị đã chốt) không. */
export function dangGoDo(vung) {
  const a = document.activeElement;
  return !!(a && vung.contains(a) && a.dataset && a.dataset.goc !== undefined && a.value !== a.dataset.goc);
}
