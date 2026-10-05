// Thông báo nhỏ, vị trí cố định (không đẩy nội dung): "Có dữ liệu mới từ Google Sheets — Tải lại".
// Dùng khi đồng bộ nền mang dữ liệu mới về nhưng người dùng đang sửa dở → KHÔNG vẽ lại ngay.
import { h } from './dom.js';

let the = null;
const choTaiLai = new Map(); // tên tab → hàm tải lại

function ve() {
  if (!choTaiLai.size) { the?.remove(); the = null; return; }
  if (!the) {
    the = h('div', { class: 'du-lieu-moi', role: 'status' });
    document.body.append(the);
  }
  the.replaceChildren(
    h('span', null, '🔄 Có dữ liệu mới từ Google Sheets'),
    h('button', { class: 'nut nut-nho nut-chinh', onclick: () => { const ds = [...choTaiLai.values()]; choTaiLai.clear(); ve(); ds.forEach((f) => f()); } }, 'Tải lại'),
    h('button', { class: 'nut-dong', 'aria-label': 'Để sau', title: 'Để sau (tự tải lại khi bạn sửa xong)', onclick: () => { the?.remove(); the = null; } }, '×'));
}

/** Tab báo có dữ liệu mới đang chờ (vì đang sửa dở). taiLai() sẽ được gọi khi bấm "Tải lại". */
export function baoDuLieuMoi(tab, taiLai) {
  choTaiLai.set(tab, taiLai);
  ve();
}

/** Tab đã tự vẽ lại (vd sau khi lưu) → bỏ khỏi danh sách chờ. */
export function boChoTaiLai(tab) {
  if (choTaiLai.delete(tab)) ve();
}

export function dangChoTaiLai(tab) {
  return choTaiLai.has(tab);
}
