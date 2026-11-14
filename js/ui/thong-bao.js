// Thông báo nổi góc màn hình.
import { h } from './dom.js';

let vung;

/**
 * kieu: 'ok' | 'loi' | 'tt' (thông tin). Lỗi hiển thị lâu hơn. Trả về { dong() } để tắt sớm.
 * tuyChon: { nut: { chu, khiBam }, thoiGian (ms) } — nút hành động (vd "↩ Hoàn tác"), bấm xong thì tắt.
 */
export function thongBao(noiDung, kieu = 'ok', tuyChon = {}) {
  if (!vung) {
    vung = h('div', { class: 'vung-thong-bao', 'aria-live': 'polite' });
    document.body.append(vung);
  }
  const bieuTuong = { ok: '✓', loi: '!', tt: 'i' }[kieu] || 'i';
  const the = h('div', { class: ['thong-bao', `thong-bao-${kieu}`], role: kieu === 'loi' ? 'alert' : 'status' },
    h('span', { class: 'thong-bao-bt', 'aria-hidden': 'true' }, bieuTuong),
    h('span', { class: 'thong-bao-chu' }, noiDung),
    tuyChon.nut ? h('button', { class: 'thong-bao-nut', onclick: () => { the.remove(); tuyChon.nut.khiBam(); } }, tuyChon.nut.chu) : null,
    h('button', { class: 'thong-bao-dong', 'aria-label': 'Đóng', onclick: () => the.remove() }, '×'));
  vung.append(the);
  setTimeout(() => the.remove(), tuyChon.thoiGian || (kieu === 'loi' ? 9000 : 3500));
  return { dong: () => the.remove() };
}
