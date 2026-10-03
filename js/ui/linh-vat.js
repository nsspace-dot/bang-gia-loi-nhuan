// Linh vật: chú mèo ôm máy tính. SVG tự vẽ.

import { h, svg, giamChuyenDong } from './dom.js';

const MEO = `
<svg class="meo" viewBox="0 0 140 140" role="img" aria-label="Mèo con ôm máy tính">
  <ellipse cx="70" cy="128" rx="40" ry="6" class="meo-bong"/>
  <path class="meo-duoi-vien" d="M100 114 C128 112 130 86 116 80 C108 77 104 86 112 90" fill="none" stroke-width="13" stroke-linecap="round"/>
  <path class="meo-duoi" d="M100 114 C128 112 130 86 116 80 C108 77 104 86 112 90" fill="none" stroke-width="8" stroke-linecap="round"/>
  <path class="meo-than" d="M36 124 C30 96 40 74 70 74 C100 74 110 96 104 124 Z"/>
  <path class="meo-bung" d="M52 124 C50 104 58 92 70 92 C82 92 90 104 88 124 Z"/>
  <g class="meo-dau">
    <path class="meo-tai" d="M34 46 L36 14 L60 32 Z"/>
    <path class="meo-tai" d="M106 46 L104 14 L80 32 Z"/>
    <path class="meo-tai-trong" d="M39 38 L40 22 L52 32 Z"/>
    <path class="meo-tai-trong" d="M101 38 L100 22 L88 32 Z"/>
    <ellipse class="meo-mat-day" cx="70" cy="50" rx="40" ry="32"/>
    <ellipse class="meo-mat" cx="55" cy="50" rx="5" ry="6.5"/>
    <ellipse class="meo-mat" cx="85" cy="50" rx="5" ry="6.5"/>
    <circle class="meo-sang" cx="57" cy="47.5" r="1.8"/>
    <circle class="meo-sang" cx="87" cy="47.5" r="1.8"/>
    <ellipse class="meo-ma" cx="45" cy="61" rx="7" ry="4"/>
    <ellipse class="meo-ma" cx="95" cy="61" rx="7" ry="4"/>
    <path class="meo-mui" d="M66.5 58 L73.5 58 L70 62 Z"/>
    <path class="meo-mieng" d="M63 64 Q66.5 68 70 64 Q73.5 68 77 64" fill="none" stroke-width="2" stroke-linecap="round"/>
    <path class="meo-ria" d="M30 56 L18 53 M30 61 L18 63 M110 56 L122 53 M110 61 L122 63" stroke-width="1.6" stroke-linecap="round"/>
  </g>
  <g class="meo-may-tinh">
    <rect x="50" y="88" width="40" height="34" rx="6" class="mt-vo"/>
    <rect x="55" y="92" width="30" height="9" rx="2.5" class="mt-man"/>
    <text x="82" y="99.5" text-anchor="end" class="mt-so">+15%</text>
    <g class="mt-phim">
      <rect x="55" y="104" width="8" height="5" rx="1.5"/><rect x="66" y="104" width="8" height="5" rx="1.5"/><rect x="77" y="104" width="8" height="5" rx="1.5" class="mt-phim-cam"/>
      <rect x="55" y="112" width="8" height="5" rx="1.5"/><rect x="66" y="112" width="8" height="5" rx="1.5"/><rect x="77" y="112" width="8" height="5" rx="1.5" class="mt-phim-cam"/>
    </g>
  </g>
  <ellipse class="meo-chan meo-chan-trai" cx="50" cy="104" rx="8" ry="7"/>
  <g class="meo-tay-phai"><ellipse class="meo-chan" cx="91" cy="104" rx="8" ry="7"/></g>
</svg>`;

/** kieu: '' | 'vay' (vẫy tay) | 'nho' (cỡ nhỏ, ở header) */
export function linhVat(kieu = '') {
  const el = svg(MEO);
  if (kieu) el.classList.add(...kieu.split(' ').map((k) => `meo-${k}`));
  return el;
}

/** Màn trống thân thiện: mèo + tiêu đề + mô tả + nút (tùy chọn). */
export function manTrong(tieuDe, moTa, ...nut) {
  return h('div', { class: 'man-trong' },
    linhVat(),
    h('h3', null, tieuDe),
    moTa ? h('p', null, moTa) : null,
    nut.length ? h('div', { class: 'hang-nut hang-nut-giua' }, nut) : null);
}

/** Mèo vẫy tay + hoa giấy nhẹ khi xử lý xong. Tôn trọng prefers-reduced-motion. */
export function chucMung(noiDung) {
  const lop = h('div', { class: 'chuc-mung', role: 'status' },
    h('div', { class: 'chuc-mung-the' }, linhVat('vay'), h('p', null, noiDung)));
  if (!giamChuyenDong()) {
    const mau = ['#f9a8c0', '#a8dcc8', '#c7b6f2', '#ffd59e', '#9fd3f5'];
    for (let i = 0; i < 28; i++) {
      lop.append(h('i', {
        class: 'hoa-giay',
        style: {
          left: `${10 + Math.random() * 80}%`,
          background: mau[i % mau.length],
          animationDelay: `${Math.random() * 0.25}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
        },
      }));
    }
  }
  document.body.append(lop);
  setTimeout(() => lop.classList.add('an-di'), 1700);
  setTimeout(() => lop.remove(), 2200);
}
