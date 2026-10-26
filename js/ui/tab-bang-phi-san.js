// Tab Bảng phí: 2 tab con Shopee | TikTok. Mỗi tab con là một module riêng, chỉ tạo khi mở lần đầu.
import { h } from './dom.js';
import { taoTabBangPhi } from './tab-bang-phi.js';
import { taoTabBangPhiShopee } from './tab-bang-phi-shopee.js';

const KHOA_TAB_CON = 'bggl.bangphi.san.v1';
const SAN = [
  { ten: 'shopee', nhan: 'Shopee', tao: taoTabBangPhiShopee },
  { ten: 'tiktok', nhan: 'TikTok', tao: taoTabBangPhi },
];

export function taoTabBangPhiSan(phanTu) {
  const daTao = new Set();
  const nut = {}, vung = {};
  for (const s of SAN) {
    nut[s.ten] = h('button', { role: 'tab', type: 'button', 'data-san': s.ten, onclick: () => mo(s.ten) }, s.nhan);
    vung[s.ten] = h('div', { id: `bang-phi-${s.ten}`, role: 'tabpanel', hidden: true });
  }
  phanTu.append(
    h('div', { class: 'tab-con-san', role: 'tablist', 'aria-label': 'Sàn' }, SAN.map((s) => nut[s.ten])),
    ...SAN.map((s) => vung[s.ten]));

  function mo(ten) {
    for (const s of SAN) {
      const chon = s.ten === ten;
      nut[s.ten].setAttribute('aria-selected', String(chon));
      nut[s.ten].classList.toggle('dang-chon', chon);
      vung[s.ten].hidden = !chon;
    }
    if (!daTao.has(ten)) { daTao.add(ten); SAN.find((s) => s.ten === ten).tao(vung[ten]); }
    try { localStorage.setItem(KHOA_TAB_CON, ten); } catch { /* bỏ qua */ }
  }

  let dau = 'tiktok';
  try { if (SAN.some((s) => s.ten === localStorage.getItem(KHOA_TAB_CON))) dau = localStorage.getItem(KHOA_TAB_CON); } catch { /* bỏ qua */ }
  mo(dau);
}
