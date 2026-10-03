// Khởi động app: chuyển tab, thanh trạng thái đồng bộ, cài đặt.
import { h, thayNoiDung } from './ui/dom.js';
import { linhVat, manTrong } from './ui/linh-vat.js';
import { moCaiDat } from './ui/cai-dat.js';
import { taoTabBangPhi } from './ui/tab-bang-phi.js';
import { taoTabGiaVon } from './ui/tab-gia-von.js';
import { taoTabLoiNhuan } from './ui/tab-loi-nhuan.js';
import { taoTabSetGia } from './ui/tab-set-gia.js';
import { taoTabCampaign } from './ui/tab-campaign.js';
import * as kho from './data/kho.js';

const KHOA_TAB = 'bggl.tab.v1';
const daTao = new Set();

const TAO_TAB = {
  'bang-phi': taoTabBangPhi,
  'gia-von': taoTabGiaVon,
  'loi-nhuan': taoTabLoiNhuan,
  'set-gia': taoTabSetGia,
  campaign: taoTabCampaign,
};

function moTab(ten) {
  if (!TAO_TAB[ten]) ten = 'bang-phi';
  document.querySelectorAll('.thanh-tab [role=tab]').forEach((b) => {
    const chon = b.dataset.tab === ten;
    b.setAttribute('aria-selected', String(chon));
    b.classList.toggle('dang-chon', chon);
    b.tabIndex = chon ? 0 : -1;
  });
  document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${ten}`; });
  const el = document.getElementById(`tab-${ten}`);
  if (!daTao.has(ten)) { daTao.add(ten); TAO_TAB[ten](el); }
  try { localStorage.setItem(KHOA_TAB, ten); } catch { /* bỏ qua */ }
  if (location.hash !== `#${ten}`) history.replaceState(null, '', `#${ten}`);
}

function veTrangThai(ts) {
  const nut = document.getElementById('trang-thai-dong-bo');
  const chu = nut.querySelector('span');
  nut.className = `dong-bo dong-bo-${ts.dongBo}`;
  const gio = ts.luc ? new Date(ts.luc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
  if (!kho.layCaiDat().url) { chu.textContent = 'Chưa kết nối'; nut.title = 'Mở Cài đặt để nhập URL Apps Script'; return; }
  if (ts.dongBo === 'dang') { chu.textContent = 'Đang đồng bộ…'; nut.title = ''; }
  else if (ts.dongBo === 'xong') { chu.textContent = `Đã đồng bộ ${gio}`; nut.title = 'Bấm để đồng bộ lại'; }
  else if (ts.dongBo === 'loi') { chu.textContent = 'Lỗi đồng bộ'; nut.title = `${ts.loi}\n(Đang dùng dữ liệu tạm${gio ? ` lúc ${gio}` : ''}. Bấm để thử lại.)`; }
  else { chu.textContent = gio ? `Dữ liệu tạm ${gio}` : 'Chưa đồng bộ'; }
}

function khoiDong() {
  document.getElementById('logo-meo').append(linhVat('nho'));
  document.querySelectorAll('.thanh-tab [role=tab]').forEach((b) => b.addEventListener('click', () => moTab(b.dataset.tab)));
  document.querySelector('.thanh-tab').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const ds = [...document.querySelectorAll('.thanh-tab [role=tab]')];
    const i = ds.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const moi = ds[(i + (e.key === 'ArrowRight' ? 1 : -1) + ds.length) % ds.length];
    moi.focus();
    moTab(moi.dataset.tab);
  });
  document.getElementById('nut-cai-dat').addEventListener('click', moCaiDat);
  document.getElementById('trang-thai-dong-bo').addEventListener('click', () => (kho.layCaiDat().url ? kho.dongBo() : moCaiDat()));
  kho.dangKy(veTrangThai);

  let tab = location.hash.slice(1);
  if (!TAO_TAB[tab]) { try { tab = localStorage.getItem(KHOA_TAB) || 'loi-nhuan'; } catch { tab = 'loi-nhuan'; } }
  moTab(tab);
  kho.khoiDong();
  if (!kho.layCaiDat().url) moCaiDat();
}

// Chờ thư viện Excel (script defer) rồi mới chạy
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoiDong);
else khoiDong();
