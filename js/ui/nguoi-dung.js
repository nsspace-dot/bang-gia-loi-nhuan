// Người dùng (không mật khẩu): chọn tên mình trên máy này; "👤 Tên · Đổi" ở góc trên.
// Người đã nhập mật khẩu (⚙️ Cài đặt) thì thêm / đổi tên / ẩn tên trong danh sách.
import { h, thayNoiDung, nhapChu } from './dom.js';
import { thongBao } from './thong-bao.js';
import * as kho from '../data/kho.js';

let nut;

/** Gắn nút "👤 Tên · Đổi" vào đầu trang. */
export function ganNutNguoi(vung) {
  nut = h('button', { id: 'nut-nguoi', class: 'nut-nguoi', type: 'button', title: 'Người đang dùng máy này', onclick: () => moChonNguoi() });
  vung.prepend(nut);
  kho.dangKy(veNut);
  veNut();
}

function veNut() {
  if (!nut) return;
  const ten = kho.layNguoi();
  thayNoiDung(nut, '👤 ', h('b', null, ten || 'Chọn tên'), ten ? h('span', { class: 'chu-nhat' }, ' · Đổi') : null);
}

/** Lần đầu mở app (đã có URL, đã tải danh sách) mà máy chưa chọn tên → hỏi tên. */
export function hoiTenLanDau() {
  if (kho.layNguoi() || !kho.layCaiDat().url || document.querySelector('dialog[open]')) return;
  moChonNguoi({ lanDau: true });
}

export function moChonNguoi({ lanDau = false } = {}) {
  document.querySelector('dialog.hop-thoai-nguoi')?.remove();
  const dlg = h('dialog', { class: 'hop-thoai hop-thoai-nguoi', 'aria-labelledby': 'nd-tieu-de' });
  const ve = () => thayNoiDung(dlg, ...noiDung());

  const chon = (ten) => {
    kho.chonNguoi(ten);
    dlg.close();
    thongBao(`Xin chào ${ten}! Bảng tính và bản nháp của bạn được tách riêng.`, 'tt');
  };

  function noiDung() {
    const ds = kho.dsNguoi();
    const dangChon = kho.layNguoi();
    const oMoi = h('input', { class: 'o-nhap', placeholder: 'Tên của bạn (vd: Lan)', maxlength: 40, 'aria-label': 'Tên mới' });
    const coMatKhau = !!kho.layMatKhau();
    return [
      h('div', { class: 'hop-thoai-dau' },
        h('h2', { id: 'nd-tieu-de' }, '👤 Bạn là ai?'),
        h('button', { class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
      h('p', { class: 'mo-ta' }, lanDau
        ? 'Chọn tên của bạn. Mỗi người có bảng tính và bản nháp riêng (không cần mật khẩu). Máy này sẽ nhớ lựa chọn.'
        : 'Đổi người đang dùng máy này. Bảng tính và bản nháp sẽ chuyển theo người.'),
      ds.length
        ? h('div', { class: 'ds-ten' }, ds.map((n) => h('button', { class: ['chip-ten', n.ten === dangChon && 'dang-chon'], onclick: () => chon(n.ten) }, n.ten === dangChon ? '✓ ' : '', n.ten)))
        : h('p', { class: 'goi-y' }, 'Chưa có tên nào — thêm tên của bạn bên dưới.'),
      h('form', { class: 'hang hang-ten-moi', onsubmit: async (e) => {
        e.preventDefault();
        const t = oMoi.value.trim();
        if (!t) { oMoi.focus(); return; }
        try { const n = await kho.themNguoi(t); chon(n.ten); } catch (x) { thongBao(`Chưa thêm được tên: ${x.message}`, 'loi'); }
      } }, h('span', { class: 'nhan-ngang' }, '➕ Tên mới'), oMoi, h('button', { class: 'nut nut-chinh', type: 'submit' }, 'Thêm & chọn')),
      coMatKhau ? veQuanLy(ve) : h('p', { class: 'goi-y' }, 'Đổi tên / ẩn tên trong danh sách: cần mật khẩu (nhập ở ⚙️ Cài đặt).'),
    ];
  }

  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  ve();
  dlg.showModal();
}

/** Quản lý danh sách tên — chỉ hiện khi máy đã nhập mật khẩu (Apps Script kiểm tra lại). */
function veQuanLy(veLai) {
  const ds = kho.dsNguoi({ caAn: true });
  const doiTen = async (n) => {
    const moi = await nhapChu(`Đổi tên "${n.ten}" thành:`, n.ten, { nutDongY: 'Đổi tên' });
    if (!moi || moi === n.ten) return;
    try { await kho.doiTenNguoi(n.ten, moi); thongBao(`Đã đổi "${n.ten}" → "${moi}" (bảng tính đổi chủ theo).`); veLai(); }
    catch (x) { thongBao(`Chưa đổi được: ${x.message}`, 'loi'); }
  };
  const anHien = async (n) => {
    const an = n.dang_dung !== 'khong';
    try { await kho.ghi('NGUOI_DUNG', [{ ten: n.ten, dang_dung: an ? 'khong' : 'co' }]); thongBao(an ? `Đã ẩn "${n.ten}".` : `Đã hiện lại "${n.ten}".`); veLai(); }
    catch (x) { thongBao(`Chưa lưu được: ${x.message}`, 'loi'); }
  };
  return h('details', { class: 'mo-rong' },
    h('summary', null, '🔓 Quản lý danh sách tên (đã có mật khẩu)'),
    ds.length ? h('table', { class: 'bang bang-ten' }, h('tbody', null, ds.map((n) => h('tr', null,
      h('td', null, h('b', { class: n.dang_dung === 'khong' ? 'chu-nhat' : '' }, n.ten), n.dang_dung === 'khong' ? h('span', { class: 'nhan-nho' }, 'đã ẩn') : null),
      h('td', { class: 'o-thao-tac' },
        h('button', { class: 'nut nut-nho', onclick: () => doiTen(n) }, '✏️ Đổi tên'),
        h('button', { class: 'nut nut-nho', onclick: () => anHien(n) }, n.dang_dung === 'khong' ? 'Hiện lại' : 'Ẩn')))))) : h('p', { class: 'goi-y' }, 'Chưa có tên nào.'),
    h('p', { class: 'goi-y' }, 'Ẩn tên: người đó không chọn được nữa, bảng tính vẫn giữ nguyên. Đổi tên: bảng tính chuyển theo tên mới.'));
}
