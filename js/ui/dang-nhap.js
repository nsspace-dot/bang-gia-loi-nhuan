// Màn đăng nhập: tên đăng nhập + mật khẩu → token (Apps Script kiểm tra). Token giữ trong sessionStorage.
import { h, thayNoiDung } from './dom.js';
import { moCaiDat } from './cai-dat.js';
import { thongBao } from './thong-bao.js';
import * as kho from '../data/kho.js';

let dangMo = null;

/**
 * Hộp đăng nhập không đóng được. Đăng nhập xong: tải lại trang để dựng app theo vai trò mới —
 * TRỪ KHI đây là đăng nhập lại sau khi hết phiên với cùng tài khoản, cùng vai trò (phienCu):
 * khi đó chỉ đóng hộp và đồng bộ, giữ nguyên phần đang sửa dở chưa lưu.
 */
export function moDangNhap({ lyDo = '', phienCu = null } = {}) {
  if (dangMo) return;
  const oTen = h('input', { id: 'dn-ten', class: 'o-nhap o-nhap-rong', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true, maxlength: 64, value: phienCu?.ten });
  const oMk = h('input', { id: 'dn-mk', type: 'password', class: 'o-nhap o-nhap-rong', autocomplete: 'current-password', required: true, maxlength: 200 });
  const loi = h('div', { class: 'dn-loi', role: 'alert' }, lyDo ? dongLoi(lyDo) : null);
  const nut = h('button', { type: 'submit', class: 'nut nut-chinh' }, 'Đăng nhập');

  const gui = async (e) => {
    e.preventDefault();
    nut.disabled = true;
    nut.textContent = 'Đang đăng nhập…';
    thayNoiDung(loi);
    try {
      const moi = await kho.dangNhap(oTen.value, oMk.value);
      if (phienCu && moi.ten === phienCu.ten && moi.vaiTro === phienCu.vaiTro) {
        dlg.close();
        dlg.remove();
        dangMo = null;
        thongBao('Đã đăng nhập lại — phần đang sửa vẫn còn, bấm Lưu để lưu.');
        kho.dongBo();
        return;
      }
      location.reload(); // người khác / vai trò khác → dựng lại app theo vai trò
    } catch (x) {
      oMk.value = '';
      thayNoiDung(loi, dongLoi(x.message));
      nut.disabled = false;
      nut.textContent = 'Đăng nhập';
      oMk.focus();
    }
  };

  const dlg = h('dialog', { class: 'hop-thoai hop-dang-nhap', 'aria-labelledby': 'dn-tieu-de' },
    h('form', { onsubmit: gui },
      h('div', { class: 'hop-thoai-dau' }, h('h2', { id: 'dn-tieu-de' }, '🔐 Đăng nhập')),
      h('label', { class: 'nhan', for: 'dn-ten' }, 'Tên đăng nhập'), oTen,
      h('label', { class: 'nhan', for: 'dn-mk' }, 'Mật khẩu'), oMk,
      loi,
      h('div', { class: 'hang-nut' },
        h('button', { type: 'button', class: 'nut nut-nho', onclick: moCaiDat }, '⚙️ Cài đặt URL'),
        h('span', { class: 'gian-cach' }),
        nut),
      h('p', { class: 'goi-y' }, 'Chưa có tài khoản? Nhờ admin tạo. Phiên đăng nhập tự hết sau 6 giờ hoặc khi đóng tab.')));
  dlg.addEventListener('cancel', (e) => e.preventDefault()); // Esc không đóng
  document.body.append(dlg);
  dangMo = dlg;
  dlg.showModal();
  (phienCu ? oMk : oTen).focus();
}

function dongLoi(chu) {
  return h('div', { class: 'dong-kq dong-kq-loi' }, h('b', null, '✗'), ' ', chu);
}
