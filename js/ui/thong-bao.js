// Thông báo nổi góc màn hình.
import { h } from './dom.js';

let vung;

/** kieu: 'ok' | 'loi' | 'tt' (thông tin). Lỗi hiển thị lâu hơn và có nút đóng. */
export function thongBao(noiDung, kieu = 'ok') {
  if (!vung) {
    vung = h('div', { class: 'vung-thong-bao', 'aria-live': 'polite' });
    document.body.append(vung);
  }
  const bieuTuong = { ok: '✓', loi: '!', tt: 'i' }[kieu] || 'i';
  const the = h('div', { class: ['thong-bao', `thong-bao-${kieu}`], role: kieu === 'loi' ? 'alert' : 'status' },
    h('span', { class: 'thong-bao-bt', 'aria-hidden': 'true' }, bieuTuong),
    h('span', { class: 'thong-bao-chu' }, noiDung),
    h('button', { class: 'thong-bao-dong', 'aria-label': 'Đóng', onclick: () => the.remove() }, '×'));
  vung.append(the);
  setTimeout(() => the.remove(), kieu === 'loi' ? 9000 : 3500);
}
