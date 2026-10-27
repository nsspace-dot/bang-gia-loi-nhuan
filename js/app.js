// Khởi động app: đăng nhập, chuyển tab theo vai trò, thanh trạng thái đồng bộ, cài đặt.
import { h, thayNoiDung } from './ui/dom.js';
import { linhVat, manTrong } from './ui/linh-vat.js';
import { moCaiDat } from './ui/cai-dat.js';
import { taoTabBangPhiSan } from './ui/tab-bang-phi-san.js';
import { taoTabGiaVon } from './ui/tab-gia-von.js';
import { taoTabLoiNhuan } from './ui/tab-loi-nhuan.js';
import { taoTabSetGia } from './ui/tab-set-gia.js';
import { taoTabCampaign } from './ui/tab-campaign.js';
import { taoTabTaiKhoan } from './ui/tab-tai-khoan.js';
import { moDangNhap } from './ui/dang-nhap.js';
import { ganNutTheme, apDungTheme, layTheme } from './ui/theme.js';
import * as kho from './data/kho.js';

const KHOA_TAB = 'bggl.tab.v1';
const daTao = new Set();

const TAO_TAB = {
  'bang-phi': taoTabBangPhiSan,
  'gia-von': taoTabGiaVon,
  'loi-nhuan': taoTabLoiNhuan,
  'set-gia': taoTabSetGia,
  campaign: taoTabCampaign,
  'tai-khoan': taoTabTaiKhoan,
};

// Tab mỗi vai trò được mở. Giao diện chỉ ẩn / chặn mở; dữ liệu đã được Apps Script lọc theo vai trò.
const TAB_THEO_VAI_TRO = {
  admin: Object.keys(TAO_TAB),
  tiktok: ['loi-nhuan', 'bang-phi', 'set-gia', 'campaign', 'gia-von'],
  shopee: ['loi-nhuan', 'bang-phi'],
};
const duocMo = (ten) => (TAB_THEO_VAI_TRO[kho.vaiTro()] || ['loi-nhuan', 'bang-phi']).includes(ten);

function moTab(ten) {
  if (!TAO_TAB[ten] || !duocMo(ten)) ten = 'bang-phi';
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

/** Hiện tên + vai trò, nút Đăng xuất; hiện tab Tài khoản cho admin. */
function apDungPhien(phien) {
  const nd = document.getElementById('nguoi-dung');
  const nut = document.getElementById('nut-dang-xuat');
  nd.hidden = nut.hidden = !phien;
  if (phien) thayNoiDung(nd, '👤 ', phien.ten, ' ', h('small', null, `(${phien.vaiTro})`));
  document.querySelector('[data-tab="tai-khoan"]').hidden = phien?.vaiTro !== 'admin';
}

function khoiDong() {
  apDungTheme(layTheme()); // <head> đã áp sớm; gọi lại cho chắc (vd trang mở từ bộ nhớ đệm)
  ganNutTheme(document.getElementById('nut-theme'));
  document.getElementById('logo-meo').append(linhVat('nho'));
  const phien = kho.layPhien();
  apDungPhien(phien);
  document.getElementById('nut-dang-xuat').addEventListener('click', () => kho.dangXuat().finally(() => location.reload()));
  kho.dangKyHetPhien((phienCu) => moDangNhap({ lyDo: 'Phiên đăng nhập đã hết hạn hoặc tài khoản đã đổi — đăng nhập lại.', phienCu }));
  // Có URL nhưng chưa đăng nhập: chỉ hiện màn đăng nhập, không dựng tab nào
  if (kho.layCaiDat().url && !phien) {
    document.getElementById('nut-cai-dat').addEventListener('click', moCaiDat);
    moDangNhap();
    return;
  }
  document.querySelectorAll('.thanh-tab [role=tab]').forEach((b) => b.addEventListener('click', () => moTab(b.dataset.tab)));
  document.querySelector('.thanh-tab').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const ds = [...document.querySelectorAll('.thanh-tab [role=tab]:not([hidden])')];
    const i = ds.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const moi = ds[(i + (e.key === 'ArrowRight' ? 1 : -1) + ds.length) % ds.length];
    moi.focus();
    moTab(moi.dataset.tab);
  });
  document.getElementById('nut-cai-dat').addEventListener('click', moCaiDat);
  document.getElementById('trang-thai-dong-bo').addEventListener('click', () => (kho.layCaiDat().url ? kho.dongBo() : moCaiDat()));
  kho.dangKy(veTrangThai);

  let tab = location.hash.slice(1);
  if (!TAO_TAB[tab]) {
    try { tab = localStorage.getItem(KHOA_TAB) || 'loi-nhuan'; } catch { tab = 'loi-nhuan'; }
    // tab nhớ lần trước đang bị ẩn nút → về tab mặc định (vẫn mở được bằng #ten-tab)
    if (document.querySelector(`.thanh-tab [data-tab="${tab}"]`)?.hidden || !duocMo(tab)) tab = 'loi-nhuan';
  }
  moTab(tab);
  kho.khoiDong();
  if (!kho.layCaiDat().url) moCaiDat();

  // Đồng bộ nền định kỳ (5 phút) và khi quay lại tab trình duyệt sau ≥ 2 phút.
  // Các tab tự quyết: đang sửa dở thì KHÔNG vẽ lại, chỉ hiện "Có dữ liệu mới, tải lại?".
  const DINH_KY = 5 * 60 * 1000;
  const canDongBo = (toiThieu) => {
    const ts = kho.lay();
    if (!kho.layCaiDat().url || !kho.layPhien() || document.visibilityState !== 'visible' || ts.dongBo === 'dang') return;
    if (ts.luc && Date.now() - new Date(ts.luc).getTime() < toiThieu) return;
    kho.dongBo();
  };
  setInterval(() => canDongBo(DINH_KY - 5000), 60 * 1000);
  document.addEventListener('visibilitychange', () => canDongBo(2 * 60 * 1000));
}

// Chờ thư viện Excel (script defer) rồi mới chạy
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoiDong);
else khoiDong();
