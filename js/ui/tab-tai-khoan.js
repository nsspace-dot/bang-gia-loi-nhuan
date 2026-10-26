// Tab Tài khoản (chỉ admin): thêm, xóa, đổi mật khẩu, đổi vai trò. Apps Script kiểm tra quyền và lưu mật khẩu dạng hash.
import { h, thayNoiDung, xacNhan } from './dom.js';
import { thongBao } from './thong-bao.js';
import * as kho from '../data/kho.js';

const VAI_TRO = [
  ['admin', 'admin — xem + sửa tất cả, quản lý tài khoản'],
  ['shopee', 'shopee — chỉ xem phần Shopee'],
  ['tiktok', 'tiktok — chỉ xem phần TikTok'],
];

let goc;
let ds = [];

export function taoTabTaiKhoan(phanTu) {
  goc = phanTu;
  taiLai();
}

async function taiLai() {
  thayNoiDung(goc, h('div', { class: 'the' }, h('p', { class: 'chu-nhat' }, 'Đang tải danh sách tài khoản…')));
  try {
    ds = await kho.dsTaiKhoan();
    ve();
  } catch (e) {
    thayNoiDung(goc, h('div', { class: 'the' }, h('div', { class: 'ghi-chu ghi-chu-vang' }, `Không tải được tài khoản: ${e.message}`)));
  }
}

const chonVaiTro = (giaTri, thuocTinh) => h('select', { class: 'o-nhap', ...thuocTinh },
  VAI_TRO.map(([k, nhan]) => h('option', { value: k, selected: k === giaTri }, nhan)));

function ve() {
  const toi = kho.layPhien()?.ten;
  const oTen = h('input', { class: 'o-nhap', placeholder: 'vd: nv-shopee', 'aria-label': 'Tên đăng nhập mới', maxlength: 32, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  const oMk = h('input', { class: 'o-nhap', type: 'password', placeholder: 'ít nhất 8 ký tự', 'aria-label': 'Mật khẩu tài khoản mới', autocomplete: 'new-password' });
  const oVt = chonVaiTro('shopee', { 'aria-label': 'Vai trò tài khoản mới' });
  const them = async (e) => {
    e.preventDefault();
    try {
      const tk = await kho.themTaiKhoan(oTen.value, oMk.value, oVt.value);
      thongBao(`Đã tạo tài khoản "${tk.ten_dang_nhap}" (${tk.vai_tro}).`);
      taiLai();
    } catch (x) { thongBao(`Chưa tạo được: ${x.message}`, 'loi'); }
  };

  thayNoiDung(goc,
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null, h('h2', null, 'Tài khoản'),
          h('p', { class: 'mo-ta' }, 'admin: xem + sửa tất cả. shopee / tiktok: chỉ xem phần của nền tảng đó (Apps Script chỉ gửi dữ liệu của nền tảng được phép).'))),
      h('div', { class: 'khung-bang' }, h('table', { class: 'bang bang-tai-khoan' },
        h('thead', null, h('tr', null, h('th', null, 'Tên đăng nhập'), h('th', null, 'Vai trò'), h('th', null, 'Tạo lúc'), h('th', null, h('span', { class: 'an-chu' }, 'Thao tác')))),
        h('tbody', null, ds.map((tk) => {
          const ten = tk.ten_dang_nhap;
          const laToi = ten === toi;
          return h('tr', { 'data-tk': ten },
            h('td', null, h('b', null, ten), laToi ? h('span', { class: 'nhan-nho nhan-xanh' }, 'bạn') : null),
            h('td', null, chonVaiTro(tk.vai_tro, { 'aria-label': `Vai trò ${ten}`, disabled: laToi, onchange: (e) => doiVaiTro(ten, e.target) })),
            h('td', { class: 'chu-nhat' }, ngay(tk.tao_luc)),
            h('td', { class: 'o-thao-tac' },
              h('button', { class: 'nut nut-nho', onclick: () => datLaiMatKhau(ten) }, '🔑 Đổi mật khẩu'),
              laToi ? null : h('button', { class: 'nut-icon', title: `Xóa ${ten}`, 'aria-label': `Xóa ${ten}`, onclick: () => xoa(ten) }, '🗑')));
        })))),
      h('h3', null, 'Thêm tài khoản'),
      h('form', { class: 'hang hang-them-tk', onsubmit: them }, oTen, oMk, oVt, h('button', { class: 'nut nut-chinh', type: 'submit' }, '+ Thêm')),
      h('p', { class: 'goi-y' }, 'Tên đăng nhập 3–32 ký tự (chữ không dấu, số, . _ -). Mật khẩu lưu dạng mã hóa một chiều (hash + salt), admin cũng không xem lại được — quên thì đặt mật khẩu mới.')));
}

function ngay(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function doiVaiTro(ten, sel) {
  const cu = ds.find((t) => t.ten_dang_nhap === ten)?.vai_tro;
  if (!(await xacNhan(`Đổi vai trò "${ten}" thành ${sel.value}? Có hiệu lực ngay, kể cả khi người đó đang đăng nhập.`))) { sel.value = cu; return; }
  try {
    await kho.doiVaiTro(ten, sel.value);
    thongBao(`Đã đổi vai trò "${ten}" → ${sel.value}.`);
    taiLai();
  } catch (e) { sel.value = cu; thongBao(`Chưa đổi được: ${e.message}`, 'loi'); }
}

function datLaiMatKhau(ten) {
  const oMk = h('input', { type: 'password', class: 'o-nhap o-nhap-rong', id: 'tk-mk-moi', autocomplete: 'new-password', minlength: 8, required: true });
  const dlg = h('dialog', { class: 'hop-thoai', 'aria-labelledby': 'tk-mk-td' },
    h('form', { onsubmit: async (e) => {
      e.preventDefault();
      try {
        await kho.doiMatKhau(ten, oMk.value);
        dlg.close();
        thongBao(`Đã đổi mật khẩu "${ten}".`);
      } catch (x) { thongBao(`Chưa đổi được: ${x.message}`, 'loi'); }
    } },
      h('div', { class: 'hop-thoai-dau' }, h('h2', { id: 'tk-mk-td' }, `🔑 Mật khẩu mới cho "${ten}"`)),
      h('label', { class: 'nhan', for: 'tk-mk-moi' }, 'Mật khẩu mới (ít nhất 8 ký tự)'), oMk,
      h('div', { class: 'hang-nut' }, h('span', { class: 'gian-cach' }),
        h('button', { type: 'button', class: 'nut', onclick: () => dlg.close() }, 'Hủy'),
        h('button', { type: 'submit', class: 'nut nut-chinh' }, 'Lưu mật khẩu'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  oMk.focus();
}

async function xoa(ten) {
  if (!(await xacNhan(`Xóa tài khoản "${ten}"? Người này bị đăng xuất ngay.`, { nutDongY: 'Xóa', nguyHiem: true }))) return;
  try {
    await kho.xoaTaiKhoan(ten);
    thongBao(`Đã xóa "${ten}".`);
    taiLai();
  } catch (e) { thongBao(`Chưa xóa được: ${e.message}`, 'loi'); }
}
