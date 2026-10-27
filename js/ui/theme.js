// Theme giao diện: người dùng tự chọn, lưu riêng trong localStorage (không lẫn dữ liệu phí, không bị xóa khi đăng xuất).
// Mỗi theme là một bộ biến màu trong css/app.css (Kẹo hồng = mặc định) và css/theme.css, áp bằng <html data-theme>.
// index.html áp theme đã lưu ngay trong <head> (trước khi vẽ) — danh sách id ở đó phải khớp DS_THEME.
import { h } from './dom.js';

export const KHOA_THEME = 'bggl.theme.v1';
export const THEME_MAC_DINH = 'keo-hong';

// mau: ô xem trước [nền trang, điểm nhấn (nút chính), chữ] — khớp biến --nen, --chinh, --chu của theme (có test)
export const DS_THEME = [
  { id: 'keo-hong', ten: 'Kẹo hồng', mau: ['#fff8f3', '#e2709a', '#3d3346'] },
  { id: 'toi-gian', ten: 'Sáng tối giản', mau: ['#f6f7f9', '#2f3b4a', '#1c2128'] },
  { id: 'toi', ten: 'Tối', mau: ['#0e1626', '#6cb2ff', '#e7edf6'] },
  { id: 'cam-shopee', ten: 'Cam Shopee', mau: ['#fff7f4', '#d0391a', '#2a211f'] },
  { id: 'den-cyan', ten: 'Đen Cyan TikTok', mau: ['#08080a', '#fe2c55', '#25f4ee'] },
  { id: 'xanh-bien', ten: 'Xanh biển', mau: ['#f2f6fa', '#1f66a6', '#1a2a3c'] },
  { id: 'mint', ten: 'Mint pastel', mau: ['#f1faf6', '#1b7d5f', '#1d3730'] },
  { id: 'giay', ten: 'Giấy cổ điển', mau: ['#f4eedf', '#7a4a20', '#3a2817'] },
];

/** id hợp lệ → giữ nguyên; giá trị lạ / trống → mặc định. */
export function chuanTheme(id) {
  return DS_THEME.some((t) => t.id === id) ? id : THEME_MAC_DINH;
}

export function layTheme() {
  try { return chuanTheme(localStorage.getItem(KHOA_THEME)); } catch { return THEME_MAC_DINH; }
}

/** Áp theme ngay (không tải lại trang). */
export function apDungTheme(id) {
  const t = chuanTheme(id);
  document.documentElement.setAttribute('data-theme', t);
  return t;
}

/** Áp + lưu lựa chọn. */
export function chonTheme(id) {
  const t = apDungTheme(id);
  try { localStorage.setItem(KHOA_THEME, t); } catch { /* trình duyệt chặn bộ nhớ: vẫn áp cho lần mở này */ }
  return t;
}

/** Nút 🎨: bấm mở danh sách theme (mỗi dòng có ô màu xem trước). Chọn là áp ngay; menu vẫn mở để thử tiếp. */
export function ganNutTheme(nut) {
  let menu = null;
  const dong = (traFocus) => {
    if (!menu) return;
    menu.remove();
    menu = null;
    nut.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', ngoai, true);
    if (traFocus) nut.focus();
  };
  const ngoai = (e) => { if (menu && !menu.contains(e.target) && e.target !== nut) dong(false); };

  const veMuc = () => {
    const dangDung = layTheme();
    return DS_THEME.map((t) => h('button', {
      type: 'button', role: 'menuitemradio', class: ['muc-theme', t.id === dangDung && 'dang-chon'],
      'aria-checked': String(t.id === dangDung), 'data-theme-id': t.id,
      onclick: () => { chonTheme(t.id); menu.querySelectorAll('.muc-theme').forEach((b) => {
        const chon = b.dataset.themeId === t.id;
        b.classList.toggle('dang-chon', chon);
        b.setAttribute('aria-checked', String(chon));
      }); },
    },
    h('span', { class: 'o-mau', 'aria-hidden': 'true' }, t.mau.map((m) => h('i', { style: { background: m } }))),
    h('span', { class: 'ten-theme' }, t.ten),
    h('span', { class: 'dau-chon', 'aria-hidden': 'true' }, '✓')));
  };

  const mo = () => {
    menu = h('div', { class: 'menu-theme', role: 'menu', 'aria-label': 'Giao diện' },
      h('div', { class: 'menu-theme-dau' }, '🎨 Giao diện'), veMuc());
    menu.addEventListener('keydown', (e) => {
      const ds = [...menu.querySelectorAll('.muc-theme')];
      const i = ds.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); dong(true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        ds[(i + (e.key === 'ArrowDown' ? 1 : -1) + ds.length) % ds.length].focus();
      }
    });
    document.body.append(menu);
    const r = nut.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 8)}px`;
    menu.style.right = `${Math.max(8, Math.round(document.documentElement.clientWidth - r.right))}px`;
    nut.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', ngoai, true);
    (menu.querySelector('.muc-theme.dang-chon') || menu.querySelector('.muc-theme')).focus();
  };

  nut.addEventListener('click', () => (menu ? dong(true) : mo()));
}
