// Thêm / bớt gian hàng, ngành trong sheet DANH_MUC. Dùng chung cho Bảng phí TikTok (GIAN, NGANH) và Shopee (GIAN_SHOPEE).
import { h, xacNhan } from './dom.js';
import { thongBao } from './thong-bao.js';
import * as kho from '../data/kho.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';

const LA_GIAN = (loai) => loai === 'GIAN' || loai === 'GIAN_SHOPEE';

/** Khối chip + ô "Tên gian mới" / "Tên ngành mới" của 1 loại danh mục. */
export function khoiDanhMuc(loai, tieuDe) {
  const ds = layDanhSach(kho.duLieu().DANH_MUC, loai);
  const oThem = h('input', { class: 'o-nhap', placeholder: LA_GIAN(loai) ? 'Tên gian mới' : 'Tên ngành mới', maxlength: 40, 'aria-label': `Thêm — ${tieuDe}` });
  return h('div', { class: 'khoi-danh-muc' },
    h('h4', null, tieuDe),
    h('div', { class: 'ds-chip' }, ds.map((t) => h('span', { class: ['chip', LA_GIAN(loai) && `gian-${mauGian(t, ds)}`] }, t,
      h('button', { class: 'chip-xoa', title: `Bỏ ${t}`, 'aria-label': `Bỏ ${t}`, onclick: () => doiDanhMuc(loai, t, 'bo') }, '×')))),
    h('form', { class: 'hang', onsubmit: (e) => { e.preventDefault(); const t = oThem.value.trim(); if (t) doiDanhMuc(loai, t, 'them'); } },
      oThem, h('button', { class: 'nut nut-nho', type: 'submit' }, '+ Thêm')));
}

export async function doiDanhMuc(loai, ten, hanhDong) {
  const dm = kho.duLieu().DANH_MUC;
  const hienCo = layDanhSach(dm, loai);
  const banGhi = [];
  // Lần đầu: lưu luôn danh sách mặc định để giữ thứ tự
  if (!dm.some((d) => d.loai === loai)) hienCo.forEach((t, i) => banGhi.push({ loai, ten: t, thu_tu: i + 1, dang_dung: 'co' }));
  if (hanhDong === 'them') {
    if (hienCo.some((t) => t.toLowerCase() === ten.toLowerCase())) { thongBao(`"${ten}" đã có rồi.`, 'tt'); return; }
    const maxTT = Math.max(0, ...dm.filter((d) => d.loai === loai).map((d) => d.thu_tu || 0), hienCo.length);
    banGhi.push({ loai, ten, thu_tu: maxTT + 1, dang_dung: 'co' });
  } else {
    if (hienCo.length <= 1) { thongBao('Phải còn ít nhất 1 mục.', 'tt'); return; }
    if (!(await xacNhan(`Bỏ "${ten}" khỏi danh sách?`))) return;
    const i = banGhi.findIndex((b) => b.ten === ten);
    if (i >= 0) banGhi[i].dang_dung = 'khong';
    else banGhi.push({ loai, ten, dang_dung: 'khong' });
  }
  try {
    await kho.ghi('DANH_MUC', banGhi);
    thongBao(hanhDong === 'them' ? `Đã thêm "${ten}".` : `Đã bỏ "${ten}".`);
  } catch (e) {
    thongBao(`Chưa lưu được: ${e.message}`, 'loi');
  }
}
