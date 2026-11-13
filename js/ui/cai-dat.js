// Màn Cài đặt: URL Apps Script, kiểm tra kết nối, tài khoản đang đăng nhập.
import { h, thayNoiDung, xacNhan } from './dom.js';
import { thongBao } from './thong-bao.js';
import * as kho from '../data/kho.js';

export function laUrlHopLe(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(u.hostname);
  } catch { return false; }
}

export function moCaiDat() {
  const cd = kho.layCaiDat();
  const oUrl = h('input', { type: 'url', id: 'cd-url', class: 'o-nhap o-nhap-rong', value: cd.url, placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', spellcheck: 'false' });
  const phien = kho.layPhien();
  const ketQua = h('div', { class: 'ket-qua-kiem-tra', 'aria-live': 'polite' });

  const kiemTra = async () => {
    const url = oUrl.value.trim();
    if (!laUrlHopLe(url)) { thayNoiDung(ketQua, dongKQ(false, 'URL chưa đúng. URL Web App có dạng https://script.google.com/macros/s/…/exec')); return; }
    thayNoiDung(ketQua, dongKQ(null, 'Đang kiểm tra…'));
    nutKT.disabled = true;
    try {
      const r = await kho.kiemTraKetNoi(url);
      const dong = [dongKQ(true, `Kết nối được Apps Script (phiên bản ${r.phienBan}).`)];
      if (r.daCoAdmin === false) dong.push(dongKQ(false, 'Apps Script chưa có tài khoản admin — làm theo HUONG-DAN.md, mục "Tạo admin đầu tiên".'));
      else if (r.daCoAdmin === undefined) dong.push(dongKQ(false, 'Code.gs trên Apps Script là bản cũ (chưa có đăng nhập). Dán Code.gs mới và triển khai lại.'));
      thayNoiDung(ketQua, ...dong);
    } catch (e) {
      thayNoiDung(ketQua, dongKQ(false, e.message));
    } finally {
      nutKT.disabled = false;
    }
  };
  const nutKT = h('button', { type: 'button', class: 'nut', onclick: kiemTra }, 'Kiểm tra kết nối');

  const luu = () => {
    const url = oUrl.value.trim();
    if (url && !laUrlHopLe(url)) { thayNoiDung(ketQua, dongKQ(false, 'URL chưa đúng.')); return; }
    const doiUrl = url !== kho.layCaiDat().url;
    if (!doiUrl) { dlg.close(); return; }
    // Đổi URL = đổi máy chủ: bỏ phiên + dữ liệu tạm cũ, tải lại trang để đăng nhập ở máy chủ mới
    kho.dangXuat().finally(() => {
      kho.luuCaiDat({ url });
      location.reload();
    });
  };

  const dlg = h('dialog', { class: 'hop-thoai', 'aria-labelledby': 'cd-tieu-de' },
    h('form', { method: 'dialog', onsubmit: (e) => { e.preventDefault(); luu(); } },
      h('div', { class: 'hop-thoai-dau' },
        h('h2', { id: 'cd-tieu-de' }, '⚙️ Cài đặt'),
        h('button', { type: 'button', class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
      h('label', { class: 'nhan', for: 'cd-url' }, 'URL Apps Script (Web App)'),
      oUrl,
      h('p', { class: 'goi-y' }, 'Chỉ lưu trên máy này, không nằm trong code. Xem HUONG-DAN.md để lấy URL.'),
      phien ? h('p', { class: 'goi-y' }, 'Đang đăng nhập: ', h('b', null, phien.ten), ` (${phien.vaiTro}). `,
        h('button', { type: 'button', class: 'nut nut-nho', onclick: () => kho.dangXuat().finally(() => location.reload()) }, 'Đăng xuất'))
        : h('p', { class: 'goi-y' }, 'Chưa đăng nhập. Lưu URL xong, app sẽ hỏi tên đăng nhập và mật khẩu.'),
      ketQua,
      h('div', { class: 'hang-nut' },
        nutKT,
        h('span', { class: 'gian-cach' }),
        h('button', { type: 'button', class: 'nut', onclick: () => dlg.close() }, 'Hủy'),
        h('button', { type: 'submit', class: 'nut nut-chinh' }, 'Lưu cài đặt')),
      h('details', { class: 'mo-rong' },
        h('summary', null, 'Dữ liệu tạm trên máy này'),
        h('p', { class: 'goi-y' }, 'App lưu tạm dữ liệu đã đồng bộ để mở nhanh. Xóa đi thì lần mở sau sẽ tải lại từ Google Sheets.'),
        h('button', { type: 'button', class: 'nut nut-nho', onclick: async () => {
          if (await xacNhan('Xóa dữ liệu tạm trên máy này? (Dữ liệu trên Google Sheets không bị ảnh hưởng.)')) {
            kho.xoaCacheMay();
            kho.dongBo();
            thongBao('Đã xóa dữ liệu tạm, đang tải lại.', 'tt');
          }
        } }, 'Xóa dữ liệu tạm'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  if (!cd.url) oUrl.focus();
}

function dongKQ(ok, chu) {
  const bt = ok === true ? '✓' : ok === false ? '✗' : '…';
  return h('div', { class: ['dong-kq', ok === true ? 'dong-kq-ok' : ok === false ? 'dong-kq-loi' : ''] }, h('b', null, bt), ' ', chu);
}
