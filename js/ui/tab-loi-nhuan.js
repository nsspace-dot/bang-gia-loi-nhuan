// Tab Tính lợi nhuận: chọn nền tảng (Shopee | TikTok), bảng sản phẩm, lãi theo từng gian, tổng kết,
// nhập/xuất Excel, lưu "bảng tính" lên Google Sheets.
// TikTok: 2 cột lãi / gian (có QC, không QC) — bang-tinh.js. Shopee: 1 cột lãi / gian — bang-tinh-shopee.js.
import { h, thayNoiDung, xacNhan, chonFile, ganKeoTha, taiXuong, nhapChu, veGiu, treLai } from './dom.js';
import { oSo, oChu, dangGoDo } from './o-so.js';
import { baoDuLieuMoi, boChoTaiLai } from './du-lieu-moi.js';
import { thongBao } from './thong-bao.js';
import { manTrong, linhVat, chucMung } from './linh-vat.js';
import * as kho from '../data/kho.js';
import { docBangSanPham, laiTaiGian, laDongLo, locVaSapXep, tongKet, bangXuat, TIEU_DE_MAU } from '../core/bang-tinh.js';
import { laiTaiGianShopee, laDongLoShopee, locVaSapXepShopee, tongKetShopee, bangXuatShopee } from '../core/bang-tinh-shopee.js';
import { thangHienTai, hienThiThang, chuanHoaThang, thieuPhiQC, CANH_BAO_QC } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangPhanTram } from '../core/so.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';
import { docBang } from '../excel/doc.js';
import { giaCanDatTikTok, giaCanDatShopeeTaiGian, chuanMucTieu, loiMucLai, demDuoiGiaCanDat, MUC_LAI_MAC_DINH } from '../core/gia-can-dat.js';

const KHOA_NHAP_CU = 'bggl.loinhuan.v1'; // bản nháp chung cả máy (trước khi có bảng riêng từng người)
const khoaNhap = (nguoi, nenTang) => `bggl.loinhuan.v2:${nguoi || '_'}:${nenTang}`; // nháp riêng theo người + sàn
const TU_LUU_MS = 3000; // tự lưu lên Sheets sau 3 giây kể từ lần sửa cuối
const KHOA_NEN_TANG = 'bggl.loinhuan.nentang.v1';
const KHOA_GIA_CAN_DAT = 'bggl.loinhuan.giacandat.v1'; // { tiktok: {...}, shopee: {...} } — mỗi sàn thiết lập riêng
const MOI_TRANG = 100;

let soId = 0;
const moiId = () => ++soId;

const st = {
  ds: [],              // { _id, ten, phan_loai, nganh, gia_von, gia_ban }
  bangTinh: null,      // { id, ten } bảng đang mở (của người + sàn hiện tại)
  nguoi: '',           // tài khoản của bản nháp đang mở
  khoaNhap: null,      // khóa bản nháp đang dùng (người + sàn)
  dsBang: [],          // bảng của người + sàn này (mới sửa trước)
  luu: { tt: '', luc: null, loi: '' }, // trạng thái lưu Sheets: '' | 'dang' | 'xong' | 'loi'
  phienSua: 0,         // tăng mỗi lần sửa — biết có sửa thêm trong lúc đang lưu / đang tải
  thayDoi: false,      // có thay đổi chưa lưu lên Sheets
  nenTang: 'tiktok',   // 'tiktok' | 'shopee' — nhớ riêng (KHOA_NEN_TANG)
  gianXem: null,       // gian TikTok đang xem, null = tất cả gian
  gianXemShopee: null, // gian Shopee đang xem, null = tất cả gian
  nganhMacDinh: '',
  tim: '',
  chiLo: false,
  sapXep: null,        // { gian, kichBan, chieu } — Shopee: kichBan = 'lai'
  trang: 0,
  mucTieu: { tiktok: chuanMucTieu(), shopee: chuanMucTieu() }, // giá cần đạt: thiết lập RIÊNG từng sàn
};
let goc;
let henLuu = null;   // hẹn giờ tự lưu
let dangLuuP = null; // lần lưu đang chạy
let phien = 0;       // tăng khi đổi sàn / bảng → bỏ kết quả tải cũ

export function taoTabLoiNhuan(phanTu) {
  goc = phanTu;
  docNenTang();
  nenTangDuocXem();
  docNhap();
  docMucTieu();
  kho.dangKy((ts, ct) => {
    // đăng nhập lại sau khi hết phiên → lưu nốt phần chưa lưu được
    if (ts.dongBo === 'xong' && st.luu.tt === 'loi' && st.thayDoi && st.bangTinh) luuNgay();
    if (!ct.duLieuDoi) return;
    if (dangGoDo(goc) && ct.nguon !== 'cache') { baoDuLieuMoi('loi-nhuan', veLai); return; }
    veLai();
  });
  veLai();
  batDauPhien();
}

// ---------- tự mở bảng gần nhất / tự lưu ----------

const coSheets = () => !!(st.nguoi && kho.layCaiDat().url && kho.layPhien());
const tenMacDinh = () => `Bảng của ${st.nguoi} – ${nt().ten}`;
const idMoi = () => `bt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const gioPhut = (iso) => { const d = new Date(iso); return iso && !isNaN(d) ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''; };
const sapXepBang = (ds) => ds.sort((a, b) => String(b.cap_nhat_luc).localeCompare(String(a.cap_nhat_luc)));
function tenKhongTrung(ten) {
  const co = new Set(st.dsBang.map((b) => b.ten));
  if (!co.has(ten)) return ten;
  for (let i = 2; ; i++) if (!co.has(`${ten} (${i})`)) return `${ten} (${i})`;
}

/** Rời bảng hiện tại (đổi sàn): cất nháp, có thay đổi thì lưu ngay lên Sheets. */
function roiBang() {
  luuNhap();
  if (st.thayDoi && st.bangTinh && coSheets()) luuNgay();
  else clearTimeout(henLuu);
}

/**
 * Mở app / đổi sàn: mở bảng dùng gần nhất của tài khoản + sàn đó (bản nháp trên máy nhớ bảng gần nhất;
 * máy mới thì lấy bảng sửa gần nhất trên Sheets). Chưa có bảng nào → tạo "Bảng của <Tên> – <Sàn>" trống.
 */
async function batDauPhien() {
  const ma = ++phien;
  const khoa = st.khoaNhap;
  if (!coSheets()) { capNhatDau(); return; }
  let ds;
  try { ds = sapXepBang(await kho.dsBangTinhCuaToi(st.nenTang)); } catch (e) {
    if (ma === phien) { st.luu = { tt: 'loi', luc: null, loi: e.message }; capNhatDau(); }
    return;
  }
  if (ma !== phien || st.khoaNhap !== khoa) return;
  st.dsBang = ds;
  const daCo = st.bangTinh && ds.find((b) => b.id === st.bangTinh.id);
  if (st.bangTinh && st.thayDoi) { capNhatDau(); henTuLuu(); return; } // còn sửa dở → tự lưu tiếp
  if (daCo) { await taiBang(daCo, ma); return; }                        // bảng gần nhất → bản mới nhất trên Sheets
  if (st.ds.length && !st.bangTinh) {                                   // nháp chưa thuộc bảng nào → thành bảng mới, không mất
    st.bangTinh = { id: idMoi(), ten: tenKhongTrung(tenMacDinh()) };
    st.thayDoi = true; luuNhap(); veLai(); henTuLuu(); return;
  }
  if (ds.length) { await taiBang(ds[0], ma); return; }
  Object.assign(st, { ds: [], bangTinh: { id: idMoi(), ten: tenMacDinh() }, thayDoi: true, trang: 0 });
  luuNhap(); veLai(); luuNgay();
}

/** Tải 1 bảng của mình vào tab. Bỏ qua nếu đã đổi bảng / đang sửa trong lúc chờ. */
async function taiBang(b, ma) {
  const khoa = st.khoaNhap;
  const v = st.phienSua;
  try {
    const dong = await kho.docBangTinhCuaToi(st.nenTang, b.id);
    if (ma !== phien || st.khoaNhap !== khoa || st.phienSua !== v) return false;
    const tat = tatCaGian();
    const gianLuu = String(b.gian_hien_thi || '').split(',').filter((g) => tat.includes(g));
    Object.assign(st, {
      ds: dong.map((r) => ({ ...r, _id: moiId() })), bangTinh: { id: b.id, ten: b.ten }, thayDoi: false,
      tim: '', chiLo: false, sapXep: null, trang: 0, luu: { tt: 'xong', luc: b.cap_nhat_luc, loi: '' },
    });
    datGianXem(gianLuu.length && gianLuu.length < tat.length ? gianLuu : null);
    luuNhap();
    veLai();
    return true;
  } catch (e) {
    if (ma === phien) thongBao(`Không mở được "${b.ten}": ${e.message}`, 'loi');
    return false;
  }
}

/** Mỗi lần sửa: hẹn tự lưu sau 3 giây (sửa tiếp thì hẹn lại). */
function henTuLuu() {
  clearTimeout(henLuu);
  henLuu = null;
  if (!st.bangTinh || !coSheets()) return;
  henLuu = setTimeout(() => luuNgay(), TU_LUU_MS);
}

/** Lưu bảng đang mở lên Sheets ngay. Chụp dữ liệu trước rồi mới gửi (đổi sàn giữa chừng vẫn lưu đúng bảng). */
async function luuNgay({ thuCong = false } = {}) {
  clearTimeout(henLuu);
  henLuu = null;
  if (!st.bangTinh || !coSheets()) return false;
  const chup = {
    san: st.nenTang, khoa: st.khoaNhap, v: st.phienSua,
    bang: { id: st.bangTinh.id, ten: st.bangTinh.ten, gian_hien_thi: gianDangXem().join(','), thang_phi: thangNay() },
    dong: st.ds.map(({ _id, ...r }) => r),
  };
  st.luu = { ...st.luu, tt: 'dang' };
  capNhatDau();
  const truoc = dangLuuP;
  const lan = (async () => {
    if (truoc) await truoc.catch(() => {});
    return kho.luuBangTinhCuaToi(chup.san, chup.bang, chup.dong);
  })();
  dangLuuP = lan;
  const conLaBangNay = () => st.khoaNhap === chup.khoa && st.bangTinh?.id === chup.bang.id;
  try {
    const kq = await lan;
    if (conLaBangNay()) {
      st.bangTinh.ten = kq.ten;
      if (st.phienSua === chup.v) st.thayDoi = false;
      st.luu = { tt: 'xong', luc: kq.cap_nhat_luc || new Date().toISOString(), loi: '' };
      st.dsBang = sapXepBang([kq, ...st.dsBang.filter((b) => b.id !== kq.id)]);
      luuNhap();
      capNhatDau();
      if (st.thayDoi) henTuLuu(); // có sửa thêm trong lúc lưu
    } else {
      // đã rời bảng này: đánh dấu bản nháp của nó là đã lưu
      try {
        const d = JSON.parse(localStorage.getItem(chup.khoa) || 'null');
        if (d && d.bangTinh?.id === chup.bang.id && JSON.stringify(d.ds) === JSON.stringify(chup.dong)) { d.thayDoi = false; localStorage.setItem(chup.khoa, JSON.stringify(d)); }
      } catch { /* bỏ qua */ }
    }
    return true;
  } catch (e) {
    if (conLaBangNay()) { st.luu = { ...st.luu, tt: 'loi', loi: e.message }; capNhatDau(); }
    if (thuCong) thongBao(`CHƯA lưu được: ${e.message}`, 'loi');
    return false;
  } finally {
    if (dangLuuP === lan) dangLuuP = null;
  }
}

/** Trước khi rời bảng (mở bảng khác / tạo mới): lưu xong, hoặc người dùng đồng ý bỏ thay đổi. */
async function xongLuuHoacBo(viec) {
  if (!st.thayDoi || (!st.ds.length && !st.bangTinh)) return true;
  if (st.bangTinh && coSheets() && await luuNgay()) return true;
  return xacNhan(`Bảng hiện tại chưa lưu được lên Sheets. Bỏ thay đổi và ${viec}?`, { nutDongY: 'Bỏ thay đổi', nguyHiem: true });
}

async function taiDsBang() {
  if (!coSheets()) return;
  try { st.dsBang = sapXepBang(await kho.dsBangTinhCuaToi(st.nenTang)); capNhatDau(); } catch { /* giữ danh sách cũ */ }
}

// ---------- lưu tạm trên máy (bản nháp) ----------

function docNhap() {
  Object.assign(st, { ds: [], bangTinh: null, thayDoi: false, tim: '', chiLo: false, sapXep: null, trang: 0, dsBang: [], luu: { tt: '', luc: null, loi: '' } });
  st.nguoi = kho.layPhien()?.ten || '';
  st.khoaNhap = khoaNhap(st.nguoi, st.nenTang);
  try {
    let tho = localStorage.getItem(st.khoaNhap);
    // Bản nháp cũ (chung cả máy) → chuyển 1 lần vào nháp của tài khoản + sàn đang chọn, không mất
    if (!tho && st.nguoi) {
      const cu = JSON.parse(localStorage.getItem(KHOA_NHAP_CU) || 'null');
      if (cu) {
        cu.bangTinh = null; // bảng cũ đã lưu giờ phải "Nhận" trong danh sách
        tho = JSON.stringify(cu);
        localStorage.setItem(st.khoaNhap, tho);
        localStorage.removeItem(KHOA_NHAP_CU);
      }
    }
    const d = JSON.parse(tho || 'null');
    if (!d) return;
    st.ds = (d.ds || []).map((r) => ({ ...r, _id: moiId() }));
    Object.assign(st, { bangTinh: d.bangTinh || null, thayDoi: !!d.thayDoi, gianXem: d.gianXem || null, gianXemShopee: d.gianXemShopee || null, nganhMacDinh: d.nganhMacDinh || '' });
  } catch { /* bản nháp hỏng thì bỏ qua */ }
}

function docMucTieu() {
  try {
    const d = JSON.parse(localStorage.getItem(KHOA_GIA_CAN_DAT) || 'null') || {};
    st.mucTieu = { tiktok: chuanMucTieu(d.tiktok), shopee: chuanMucTieu(d.shopee) };
  } catch { /* hỏng thì dùng mặc định */ }
}

function luuMucTieu() {
  try { localStorage.setItem(KHOA_GIA_CAN_DAT, JSON.stringify(st.mucTieu)); } catch { /* bỏ qua */ }
}

function docNenTang() {
  try { if (NEN_TANG[localStorage.getItem(KHOA_NEN_TANG)]) st.nenTang = localStorage.getItem(KHOA_NEN_TANG); } catch { /* bỏ qua */ }
}

/** Nền tảng tài khoản được xem (chưa đăng nhập: cả 2). Nền tảng đang chọn không được phép → chuyển sang nền tảng được phép. */
function nenTangDuocXem() {
  const ds = kho.layPhien() ? kho.nenTangDuocXem() : ['shopee', 'tiktok'];
  if (!ds.includes(st.nenTang) && ds.length) st.nenTang = ds.includes('tiktok') ? 'tiktok' : ds[0];
  return ds;
}

function luuNhap() {
  if (!st.khoaNhap) return;
  try {
    localStorage.setItem(st.khoaNhap, JSON.stringify({
      ds: st.ds.map(({ _id, ...r }) => r), bangTinh: st.bangTinh, thayDoi: st.thayDoi, gianXem: st.gianXem, gianXemShopee: st.gianXemShopee, nganhMacDinh: st.nganhMacDinh,
    }));
  } catch { /* hết bộ nhớ trình duyệt: vẫn dùng được, chỉ không giữ nháp */ }
}

function daSua() {
  st.thayDoi = true;
  st.phienSua++;
  luuNhap();
  henTuLuu();
  capNhatDau();
}

/** Vẽ lại tab, giữ vị trí cuộn, ô đang focus và con trỏ. */
function veLai() {
  boChoTaiLai('loi-nhuan');
  veGiu(goc, ve);
}

// ---------- dữ liệu dẫn xuất ----------

/** Luôn tính theo bộ phí đang áp dụng ở thời điểm hiện tại. */
const thangNay = () => thangHienTai();

// Mỗi nền tảng: danh sách gian, bảng phí, các cột lãi của 1 gian ([kịch bản, tiêu đề, chữ trên chip sắp xếp]) và bộ hàm tính riêng.
const NEN_TANG = {
  tiktok: {
    ten: 'TikTok', gians: () => layDanhSach(kho.duLieu().DANH_MUC, 'GIAN'), dsPhi: () => kho.duLieu().BANG_PHI,
    cot: [['qc', 'Có QC', 'có QC'], ['khongqc', 'Không QC', 'không QC']], khoaGianXem: 'gianXem',
    laiTaiGian, laDongLo, locVaSapXep, tongKet, bangXuat, giaCanDat: giaCanDatTikTok, coKichBan: true,
    congThuc: 'Lãi = Giá − Vốn − Phí cố định − Giá × tổng phí %.',
  },
  shopee: {
    ten: 'Shopee', gians: () => layDanhSach(kho.duLieu().DANH_MUC, 'GIAN_SHOPEE'), dsPhi: () => kho.duLieu().BANG_PHI_SHOPEE || [],
    cot: [['lai', 'Lãi', 'lãi']], khoaGianXem: 'gianXemShopee',
    laiTaiGian: laiTaiGianShopee, laDongLo: laDongLoShopee, locVaSapXep: locVaSapXepShopee, tongKet: tongKetShopee, bangXuat: bangXuatShopee,
    giaCanDat: giaCanDatShopeeTaiGian, coKichBan: false,
    congThuc: 'Lãi Shopee = Giá bán − Giá vốn − Phí hạ tầng − Giá bán × tổng 8 khoản phí %.',
  },
};
const nt = () => NEN_TANG[st.nenTang];
/** Thiết lập giá cần đạt của sàn đang xem. */
const mtNay = () => st.mucTieu[st.nenTang];
const giaCanDatDong = (d, g, dsPhi) => nt().giaCanDat(d, g, dsPhi, thangNay(), mtNay());

const tatCaGian = () => nt().gians();
const dsNganh = () => layDanhSach(kho.duLieu().DANH_MUC, 'NGANH');
function gianDangXem() {
  const tat = tatCaGian();
  const xem = st[nt().khoaGianXem];
  const ds = xem ? tat.filter((g) => xem.includes(g)) : tat;
  return ds.length ? ds : tat;
}
function datGianXem(ds) {
  st[nt().khoaGianXem] = ds;
}

/** Lãi + % của 1 cột (kịch bản) từ kết quả laiTaiGian. */
function laiCot(r, kichBan) {
  if (kichBan === 'qc') return [r.laiQC, r.ptQC];
  if (kichBan === 'khongqc') return [r.laiKhongQC, r.ptKhongQC];
  return [r.lai, r.pt];
}
function nganhMacDinh() {
  const ds = dsNganh();
  return ds.includes(st.nganhMacDinh) ? st.nganhMacDinh : ds.includes('Tranh') ? 'Tranh' : ds[0];
}

// ---------- vẽ ----------

function ve() {
  nenTangDuocXem();
  const gians = gianDangXem();
  const dsPhi = nt().dsPhi();

  const the = h('div', { class: 'the' }, veDau(), veDieuKhien(gians));
  ganKeoTha(the, napFile);
  thayNoiDung(goc, veChonNenTang(), the, st.ds.length ? [veTongKet(gians, dsPhi), veBang(gians, dsPhi)] : veTrong());
}

function veChonNenTang() {
  return h('div', { class: 'tab-con-san', role: 'tablist', 'aria-label': 'Nền tảng' },
    ['shopee', 'tiktok'].filter((k) => nenTangDuocXem().includes(k)).map((k) => h('button', {
      role: 'tab', type: 'button', 'data-nen-tang': k, class: k === st.nenTang && 'dang-chon', 'aria-selected': String(k === st.nenTang),
      onclick: () => doiNenTang(k),
    }, NEN_TANG[k].ten)));
}

/** Đổi sàn: mỗi sàn có bảng tính + bản nháp riêng → lưu bảng đang sửa, mở bảng gần nhất của sàn kia. */
function doiNenTang(k) {
  if (k === st.nenTang) return;
  roiBang();
  st.nenTang = k;
  try { localStorage.setItem(KHOA_NEN_TANG, k); } catch { /* bỏ qua */ }
  docNhap();
  veLai();
  batDauPhien();
}

/** Trạng thái lưu: "Đang lưu…" / "✓ Đã lưu lúc hh:mm" / "⚠ Chưa lưu được – bấm để thử lại". */
function trangThaiLuu() {
  if (st.luu.tt === 'dang') return { chu: 'Đang lưu…', lop: 'nhan-tim' };
  if (st.luu.tt === 'loi') return { chu: '⚠ Chưa lưu được – bấm để thử lại', lop: 'nhan-do', loi: true };
  if (st.thayDoi) return { chu: st.bangTinh && coSheets() ? 'Sẽ tự lưu…' : 'chưa lưu lên Sheets', lop: 'nhan-vang' };
  if (st.bangTinh) return { chu: st.luu.luc ? `✓ Đã lưu lúc ${gioPhut(st.luu.luc)}` : '✓ Đã lưu', lop: 'nhan-xanh' };
  return { chu: '', lop: 'nhan-an' };
}

function veTrangThaiLuu() {
  const t = trangThaiLuu();
  return h('button', { type: 'button', class: ['nhan-nho', 'nhan-trang-thai-luu', t.lop], disabled: !t.loi, title: t.loi ? st.luu.loi : '',
    onclick: () => luuNgay({ thuCong: true }) }, t.chu);
}

/** Nút 💾 luôn hiện: có thay đổi → sáng "💾 Lưu lên Sheets"; không có → mờ "✓ Đã lưu". */
function trangThaiNutLuu() {
  if (!st.ds.length && !st.bangTinh) return { tat: true, chu: '💾 Lưu lên Sheets' };
  if (st.thayDoi || !st.bangTinh || st.luu.tt === 'loi') return { tat: false, chu: '💾 Lưu lên Sheets' };
  return { tat: true, chu: '✓ Đã lưu' };
}

/** Cập nhật phần đầu tab (tên bảng, danh sách bảng, trạng thái lưu) — không đụng tới bảng sản phẩm. */
function capNhatDau() {
  const cu = goc?.querySelector('.the-dau');
  if (!cu) return;
  const dangChon = cu.contains(document.activeElement) && document.activeElement.tagName === 'SELECT';
  if (!dangChon) { cu.replaceWith(veDau()); return; }
  cu.querySelector('.nhan-trang-thai-luu')?.replaceWith(veTrangThaiLuu());
  const nut = cu.querySelector('.nut-luu-sheets');
  if (nut) { const t = trangThaiNutLuu(); nut.disabled = t.tat; nut.textContent = t.chu; }
}

/** Sau khi sửa 1 dòng: chỉ thay dòng đó + ô tổng kết. Không lọc / sắp xếp lại (dòng không nhảy chỗ). */
function capNhatDong(i) {
  const d = st.ds[i];
  const gians = gianDangXem();
  const dsPhi = nt().dsPhi();
  const tr = goc.querySelector(`tr[data-id="${d._id}"]`);
  if (!tr) { veLai(); return; }
  veGiu(tr.parentElement, () => tr.replaceWith(veDong(i, gians, dsPhi)));
  const tk = goc.querySelector('.luoi-tong-ket');
  if (tk) tk.replaceWith(veTongKet(gians, dsPhi));
}

/** Chọn nhanh bảng của mình (cùng sàn) — không cần mở hộp "Mở bảng tính". */
function veChonBang() {
  const ds = [...st.dsBang];
  if (st.bangTinh && !ds.some((b) => b.id === st.bangTinh.id)) ds.unshift({ id: st.bangTinh.id, ten: st.bangTinh.ten });
  const hienTai = st.bangTinh?.id || '';
  return h('select', {
    class: 'o-nhap chon-bang', 'aria-label': 'Chọn bảng tính', title: 'Chọn nhanh bảng của bạn', disabled: !coSheets(),
    onchange: (e) => {
      const v = e.target.value;
      e.target.value = hienTai;
      e.target.blur();
      if (v === '__moi') { taoMoi(); return; }
      if (v === '__ds') { moDanhSach(); return; }
      const b = st.dsBang.find((x) => x.id === v);
      if (b) moBangTinh(b);
    },
  },
  hienTai ? null : h('option', { value: '' }, '— chọn bảng —'),
  ds.map((b) => h('option', { value: b.id, selected: b.id === hienTai }, b.ten)),
  h('option', { value: '__moi' }, '➕ Bảng mới…'),
  h('option', { value: '__ds' }, '📂 Quản lý bảng tính…'));
}

function veDau() {
  const ten = st.bangTinh ? st.bangTinh.ten : 'Bảng tính mới';
  const nut = trangThaiNutLuu();
  return h('div', { class: 'the-dau' },
    h('div', null,
      h('h2', null, 'Tính lợi nhuận'),
      h('p', { class: 'mo-ta dong-phien' },
        '👤 ', h('b', null, st.nguoi || 'chưa đăng nhập'), ' · ', h('b', null, nt().ten), ' · 📄 ', h('b', { class: 'ten-bang' }, ten), ' ',
        veChonBang(), ' ', veTrangThaiLuu(),
        h('span', { class: 'chu-nhat' }, ` · ${st.ds.length} dòng`))),
    h('div', { class: 'hang-nut' },
      h('button', { class: 'nut', onclick: moDanhSach }, '📂 Mở bảng tính'),
      coSheets() ? h('button', { class: 'nut nut-chinh nut-luu-sheets', onclick: () => luuLenSheets(false), disabled: nut.tat }, nut.chu) : null,
      coSheets() && st.bangTinh ? h('button', { class: 'nut', onclick: () => luuLenSheets(true), disabled: !st.ds.length }, 'Lưu thành bản mới') : null,
      h('button', { class: 'nut', onclick: taoMoi, disabled: !coSheets() && !st.ds.length && !st.bangTinh }, '🧹 Bảng mới')));
}

function veDieuKhien(gians) {
  const tat = tatCaGian();
  const chonNganh = h('select', { class: 'o-nhap', 'aria-label': 'Ngành mặc định', onchange: (e) => { st.nganhMacDinh = e.target.value; luuNhap(); } },
    dsNganh().map((n) => h('option', { value: n, selected: n === nganhMacDinh() }, n)));
  const oTim = h('input', { type: 'search', class: 'o-nhap', placeholder: 'Tìm tên, phân loại…', value: st.tim, 'aria-label': 'Tìm', 'data-o': 'tim',
    oninput: (e) => { st.tim = e.target.value; st.trang = 0; treLai(veLai); } });

  return h('div', { class: 'dieu-khien' },
    h('div', { class: 'hang hang-dk' },
      h('span', { class: 'nhan-ngang' }, 'Gian hiển thị'),
      h('div', { class: 'ds-chip' }, tat.map((g) => {
        const bat = gians.includes(g);
        return h('button', {
          class: ['chip-gian', `gian-${mauGian(g, tat)}`, bat && 'dang-bat'], 'aria-pressed': String(bat),
          onclick: () => {
            const moi = bat ? gians.filter((x) => x !== g) : tat.filter((x) => gians.includes(x) || x === g);
            if (!moi.length) { thongBao('Phải hiển thị ít nhất 1 gian.', 'tt'); return; }
            datGianXem(moi.length === tat.length ? null : moi);
            if (st.sapXep && !moi.includes(st.sapXep.gian)) st.sapXep = null;
            luuNhap();
            veLai();
          },
        }, bat ? '✓ ' : '', g);
      })),
      h('span', { class: 'gian-cach' }),
      h('label', { class: 'nhan-ngang' }, 'Ngành mặc định ', chonNganh)),
    h('div', { class: 'hang hang-dk' },
      h('button', { class: 'nut nut-nho', onclick: themDong }, '➕ Thêm dòng'),
      h('button', { class: 'nut nut-nho', onclick: async () => { const f = await chonFile(); if (f) napFile([f]); } }, '📥 Nhập Excel'),
      h('button', { class: 'nut nut-nho', onclick: () => xuatExcel(gians), disabled: !st.ds.length }, '📤 Xuất Excel'),
      h('button', { class: 'nut nut-nho', onclick: taiFileMau }, '📄 File mẫu'),
      h('span', { class: 'gian-cach' }),
      oTim,
      h('label', { class: 'hop-kiem hop-kiem-ngang' },
        h('input', { type: 'checkbox', checked: st.chiLo, onchange: (e) => { st.chiLo = e.target.checked; st.trang = 0; veLai(); } }), ' Chỉ dòng lỗ'),
      st.sapXep ? h('span', { class: 'chip chip-sap-xep' },
        `Sắp xếp: ${st.sapXep.gian} · ${nt().cot.find(([k]) => k === st.sapXep.kichBan)?.[2] ?? ''} ${st.sapXep.chieu < 0 ? '↓' : '↑'}`,
        h('button', { class: 'chip-xoa', 'aria-label': 'Bỏ sắp xếp', onclick: () => { st.sapXep = null; veLai(); } }, '×')) : null),
    veGiaCanDat());
}

/** Đổi thiết lập giá cần đạt của SÀN ĐANG XEM (sàn kia giữ nguyên), lưu trên máy, vẽ lại bảng. */
function doiMucTieu(sua) {
  Object.assign(st.mucTieu[st.nenTang], sua);
  luuMucTieu();
  veLai();
}

/** Hàng "🎯 Giá cần đạt": mỗi sàn có bộ ô nhập riêng (lãi mong muốn, đơn vị, kịch bản QC với TikTok, làm tròn). */
function veGiaCanDat() {
  const mt = mtNay();
  const ten = nt().ten;
  const chon = (giaTri, ds, nhan, khiDoi) => h('select', { class: 'o-nhap', 'aria-label': `${nhan} (${ten})`, 'data-o': `gcd:${st.nenTang}:${nhan}`, onchange: (e) => khiDoi(e.target.value) },
    ds.map(([k, chu]) => h('option', { value: k, selected: k === giaTri }, chu)));
  const bat = h('label', { class: 'hop-kiem hop-kiem-ngang nhan-gia-can-dat' },
    h('input', { type: 'checkbox', checked: mt.bat, 'aria-label': `Hiện giá cần đạt (${ten})`, onchange: (e) => doiMucTieu({ bat: e.target.checked }) }),
    ` 🎯 Giá cần đạt — ${ten}`);
  if (!mt.bat) return h('div', { class: 'hang hang-dk hang-gia-can-dat' }, bat, h('span', { class: 'chu-nhat' }, 'Bật để xem giá bán tối thiểu cho mức lãi mong muốn ở từng gian.'));
  const oLai = oSo({
    giaTri: mt.giaTri, kieu: mt.donVi === 'pt' ? 'phantram' : 'tien', choPhepTrong: false,
    kiemTra: (so) => loiMucLai(so, mt.donVi), class: 'o-nhap o-nhap-so',
    'aria-label': `Lãi mong muốn (${ten})`, 'data-o': `gcd:${st.nenTang}:lai`,
    khiLuu: (so) => doiMucTieu({ giaTri: so }),
  });
  return h('div', { class: 'hang hang-dk hang-gia-can-dat' }, bat,
    h('label', { class: 'nhan-ngang' }, 'Lãi mong muốn ', oLai),
    chon(mt.donVi, [['pt', '% giá bán'], ['dong', 'đ / đơn']], 'Đơn vị lãi', (v) => doiMucTieu({ donVi: v, giaTri: MUC_LAI_MAC_DINH[v] })),
    nt().coKichBan ? chon(mt.kichBan, [['ca2', 'Cả 2 kịch bản (an toàn)'], ['qc', 'Có QC'], ['khongqc', 'Không QC']], 'Kịch bản QC', (v) => doiMucTieu({ kichBan: v })) : null,
    chon(mt.lamTron, [['len1000', 'Làm tròn lên 1.000'], ['duoi9000', 'Đuôi 9.000'], ['khong', 'Không làm tròn']], 'Làm tròn', (v) => doiMucTieu({ lamTron: v })));
}

function veTrong() {
  const vung = h('button', { class: 'vung-tha vung-tha-lon', onclick: async () => { const f = await chonFile(); if (f) napFile([f]); } },
    linhVat(),
    h('span', null, h('b', null, 'Thả file Excel sản phẩm vào đây'), h('br'),
      'hoặc bấm để chọn file. Cột cần có: Tên sản phẩm | Phân loại | Ngành hàng | Giá vốn | Giá bán', h('br'),
      h('span', { class: 'chu-nhat' }, 'Hoặc bấm "➕ Thêm dòng" để nhập tay, "📂 Mở bảng tính" để mở bảng đã lưu.')));
  ganKeoTha(vung, napFile);
  return h('div', { class: 'the' }, vung);
}

function veTongKet(gians, dsPhi) {
  const t = nt().tongKet(st.ds, gians, dsPhi, thangNay());
  const duoi = mtNay().bat ? demDuoiGiaCanDat(st.ds, gians, (d, g) => giaCanDatDong(d, g, dsPhi)) : null;
  const chanGCD = (g) => (duoi ? h('div', { class: 'o-tong-chan' }, duoi[g] ? h('span', { class: 'chu-lo' }, `🎯 ${duoi[g]} dòng dưới giá cần đạt`) : h('span', null, '🎯 Đều đạt giá cần đạt')) : null);
  const tatGian = tatCaGian();
  return h('div', { class: 'luoi-tong-ket' },
    h('div', { class: 'o-tong' },
      h('div', { class: 'o-tong-nhan' }, 'Sản phẩm'),
      h('div', { class: 'o-tong-so' }, dinhDangTien(t.soDong)),
      t.thieuGiaBan ? h('div', { class: 'chu-nhat' }, `${t.thieuGiaBan} dòng chưa có giá bán`) : h('div', { class: 'chu-nhat' }, `Phí đang áp dụng (tháng ${hienThiThang(thangNay())})`)),
    h('div', { class: 'o-tong' },
      h('div', { class: 'o-tong-nhan' }, 'Tổng giá vốn'),
      h('div', { class: 'o-tong-so' }, dinhDangTien(t.tongVon), h('small', null, ' đ'))),
    gians.map((g) => {
      const x = t.theoGian[g];
      if (st.nenTang === 'shopee') {
        return h('div', { class: ['o-tong', `gian-${mauGian(g, tatGian)}`] },
          h('div', { class: 'o-tong-nhan' }, g, ' · lãi TB / đơn'),
          h('div', { class: 'o-tong-so' }, h('b', { class: lop(x.tb) }, x.tb === null ? '—' : dinhDangTien(x.tb))),
          h('div', { class: 'o-tong-chan' },
            x.soDongLo ? h('span', { class: 'chu-lo' }, `${x.soDongLo} dòng lỗ`) : h('span', null, 'Không dòng nào lỗ'),
            x.thieuPhi ? h('span', null, ` · ${x.thieuPhi} dòng chưa có phí`) : null,
            x.phiTam ? h('span', { class: 'chu-canh-bao' }, ` · ⚠ ${x.phiTam} dòng dùng phí tạm`) : null), chanGCD(g));
      }
      return h('div', { class: ['o-tong', `gian-${mauGian(g, tatGian)}`] },
        h('div', { class: 'o-tong-nhan' }, g, ' · lãi TB / đơn'),
        h('div', { class: 'o-tong-hai' },
          h('div', null, h('small', null, 'Có QC'), h('b', { class: lop(x.tbQC) }, x.tbQC === null ? '—' : dinhDangTien(x.tbQC))),
          h('div', null, h('small', null, 'Không QC'), h('b', { class: lop(x.tbKhongQC) }, x.tbKhongQC === null ? '—' : dinhDangTien(x.tbKhongQC)))),
        h('div', { class: 'o-tong-chan' },
          x.soDongLo ? h('span', { class: 'chu-lo' }, `${x.soDongLo} dòng lỗ`) : h('span', null, 'Không dòng nào lỗ'),
          x.thieuPhi ? h('span', null, ` · ${x.thieuPhi} dòng chưa có phí`) : null,
            x.phiTam ? h('span', { class: 'chu-canh-bao' }, ` · ⚠ ${x.phiTam} dòng dùng phí tạm`) : null), chanGCD(g));
    }));
}

const lop = (x) => (x === null || x === undefined ? '' : x < 0 ? 'chu-lo' : 'chu-lai');

function veBang(gians, dsPhi) {
  const tatGian = tatCaGian();
  const cot = nt().cot;
  const coGCD = mtNay().bat;
  const soCotGian = cot.length + (coGCD ? 1 : 0);
  const chiSo = nt().locVaSapXep(st.ds, { gians, dsPhi, thang: thangNay(), chiLo: st.chiLo, tim: st.tim, sapXep: st.sapXep });
  const soTrang = Math.max(1, Math.ceil(chiSo.length / MOI_TRANG));
  st.trang = Math.min(st.trang, soTrang - 1);
  const trangNay = chiSo.slice(st.trang * MOI_TRANG, (st.trang + 1) * MOI_TRANG);

  const nutSap = (g, kichBan, nhan) => {
    const dang = st.sapXep && st.sapXep.gian === g && st.sapXep.kichBan === kichBan ? st.sapXep.chieu : 0;
    return h('th', {
      class: ['so', 'th-sap-xep', `gian-${mauGian(g, tatGian)}`], scope: 'col',
      'aria-sort': dang < 0 ? 'descending' : dang > 0 ? 'ascending' : 'none',
    }, h('button', {
      class: 'nut-sap-xep', title: 'Bấm để sắp xếp theo lãi',
      onclick: () => {
        st.sapXep = dang === 0 ? { gian: g, kichBan, chieu: -1 } : dang < 0 ? { gian: g, kichBan, chieu: 1 } : null;
        st.trang = 0;
        veLai();
      },
    }, nhan, ' ', h('span', { class: 'mui-ten' }, dang < 0 ? '↓' : dang > 0 ? '↑' : '↕')));
  };

  const dauBang = h('thead', null,
    h('tr', null,
      h('th', { rowspan: 2, class: 'so cot-stt', scope: 'col' }, '#'),
      h('th', { rowspan: 2, scope: 'col' }, 'Tên sản phẩm'),
      h('th', { rowspan: 2, scope: 'col' }, 'Phân loại'),
      h('th', { rowspan: 2, scope: 'col' }, 'Ngành'),
      h('th', { rowspan: 2, class: 'so', scope: 'col' }, 'Giá vốn'),
      h('th', { rowspan: 2, class: 'so', scope: 'col' }, 'Giá bán'),
      gians.map((g) => h('th', { colspan: soCotGian, class: ['th-gian', `gian-${mauGian(g, tatGian)}`], scope: 'colgroup' }, g)),
      h('th', { rowspan: 2, scope: 'col' }, h('span', { class: 'an-chu' }, 'Thao tác'))),
    h('tr', null, gians.map((g) => [cot.map(([k, nhan]) => nutSap(g, k, nhan)),
      coGCD ? h('th', { class: ['so', 'th-gia-can-dat', `gian-${mauGian(g, tatGian)}`], scope: 'col', title: moTaMucTieu() }, '🎯 Giá cần đạt') : null])));

  const hang = trangNay.map((i) => veDong(i, gians, dsPhi));
  const soCot = 7 + gians.length * soCotGian;

  return h('div', { class: 'the the-bang' },
    h('div', { class: 'khung-bang khung-bang-cao', 'data-cuon': 'loi-nhuan', 'data-dieu-huong': '' },
      h('table', { class: 'bang bang-ln' }, dauBang,
        h('tbody', null, hang.length ? hang : h('tr', null, h('td', { colspan: soCot, class: 'o-trong' }, st.chiLo ? 'Không có dòng lỗ nào 🎉' : 'Không có dòng nào khớp.'))))),
    h('div', { class: 'hang hang-trang' },
      h('span', { class: 'chu-nhat' }, chiSo.length === st.ds.length ? `${st.ds.length} dòng` : `Đang hiện ${chiSo.length} / ${st.ds.length} dòng`),
      h('span', { class: 'gian-cach' }),
      soTrang > 1 ? [
        h('button', { class: 'nut nut-nho', disabled: st.trang === 0, onclick: () => { st.trang--; veLai(); } }, '‹ Trước'),
        h('span', { class: 'chu-nhat' }, `Trang ${st.trang + 1} / ${soTrang}`),
        h('button', { class: 'nut nut-nho', disabled: st.trang >= soTrang - 1, onclick: () => { st.trang++; veLai(); } }, 'Sau ›'),
      ] : null),
    veGhiChuPhi(gians, dsPhi));
}

/** Ghi chú dưới bảng: các gian đang dùng TẠM phí tháng cũ / chưa có phí cho ngành nào. */
function veGhiChuPhi(gians, dsPhi) {
  const ds = new Set();
  for (const d of st.ds) {
    if (!Number.isFinite(d.gia_ban) || d.gia_ban <= 0) continue;
    for (const g of gians) { const r = nt().laiTaiGian(d, g, dsPhi, thangNay()); if (r.canhBaoPhi) ds.add(r.canhBaoPhi); }
  }
  if (!ds.size) return null;
  return h('div', { class: 'canh-bao ghi-chu-phi' }, [...ds].map((c) => h('div', null, '⚠ ', c)));
}

function veDong(i, gians, dsPhi) {
  const d = st.ds[i];
  // Sửa 1 ô → chỉ cập nhật dòng này (không vẽ lại cả bảng)
  const doi = (truong, giaTri) => { d[truong] = giaTri; daSua(); capNhatDong(i); };
  const oTen = (truong, rong) => oChu({
    class: 'o-bang', giaTri: d[truong] ?? '', title: d[truong] ?? '', 'data-o': `${d._id}:${truong}`, style: { width: rong },
    'aria-label': `${truong === 'ten' ? 'Tên' : 'Phân loại'} dòng ${i + 1}`,
    khiLuu: (moi) => doi(truong, moi),
  });
  const oTien = (truong, nhan) => oSo({
    class: truong === 'gia_ban' && !Number.isFinite(d.gia_ban) && 'o-thieu', kieu: 'tien',
    giaTri: Number.isFinite(d[truong]) ? d[truong] : null, placeholder: truong === 'gia_ban' ? 'nhập giá' : '',
    'data-o': `${d._id}:${truong}`, 'aria-label': `${nhan} dòng ${i + 1}`,
    khiLuu: (so) => doi(truong, so),
  });
  const nganhs = dsNganh();
  const chonNganh = h('select', { class: 'o-bang o-chon', 'data-o': `${d._id}:nganh`, 'aria-label': `Ngành dòng ${i + 1}`, onchange: (e) => doi('nganh', e.target.value) },
    (nganhs.includes(d.nganh) ? nganhs : [d.nganh, ...nganhs]).map((n) => h('option', { value: n, selected: n === d.nganh }, n || '—')));

  const oLai = (r, kichBan) => {
    if (r.trangThai === 'thieu-gia') return h('td', { class: 'so o-lai chu-nhat' }, '—');
    if (r.trangThai === 'thieu-phi') return h('td', { class: 'so o-lai chu-nhat', title: `Chưa có bộ phí ${d.nganh} cho gian này (≤ ${hienThiThang(thangNay())})` }, 'chưa có phí');
    const [lai, pt] = laiCot(r, kichBan);
    const thieuQC = kichBan === 'qc' && thieuPhiQC(r.phi);
    // Gian chưa có phí ngành này ở tháng mới nhất → đang dùng TẠM phí tháng cũ: báo rõ, không lặng lẽ
    const tam = r.canhBaoPhi;
    const title = [tam, thieuQC ? `${d.nganh}: ${CANH_BAO_QC}` : null].filter(Boolean).join('\n') || null;
    return h('td', { class: ['so', 'o-lai', lai < 0 ? 'o-lo' : '', tam && 'co-canh-bao-phi'], title },
      h('div', { class: lop(lai) }, tam || thieuQC ? h('span', { class: tam ? 'dau-canh-bao-phi' : 'dau-canh-bao-qc', 'aria-label': tam || CANH_BAO_QC }, '⚠ ') : null, dinhDangTien(lai)),
      h('div', { class: 'chu-pt' }, tam ? `phí tạm ${hienThiThang(r.phi.thang)}` : dinhDangPhanTram(pt)));
  };

  const n = nt();
  return h('tr', { 'data-id': d._id, class: n.laDongLo(d, gians, dsPhi, thangNay()) ? 'dong-lo' : '' },
    h('td', { class: 'so cot-stt chu-nhat' }, i + 1),
    h('td', null, oTen('ten', '190px')),
    h('td', null, oTen('phan_loai', '64px')),
    h('td', null, chonNganh),
    h('td', { class: 'so' }, oTien('gia_von', 'Giá vốn')),
    h('td', { class: 'so' }, oTien('gia_ban', 'Giá bán')),
    gians.map((g) => { const r = n.laiTaiGian(d, g, dsPhi, thangNay()); return [n.cot.map(([k]) => oLai(r, k)), mtNay().bat ? oGiaCanDat(d, g, dsPhi) : null]; }),
    h('td', { class: 'o-thao-tac' },
      h('button', { class: 'nut-icon', title: 'Nhân bản dòng', 'aria-label': `Nhân bản dòng ${i + 1}`, onclick: () => { st.ds.splice(i + 1, 0, { ...d, _id: moiId() }); daSua(); veLai(); } }, '📋'),
      h('button', { class: 'nut-icon', title: 'Xóa dòng', 'aria-label': `Xóa dòng ${i + 1}`, onclick: () => { st.ds.splice(i, 1); daSua(); veLai(); } }, '🗑')));
}

/** "15% giá bán · cả 2 kịch bản · làm tròn lên 1.000" */
function moTaMucTieu() {
  const mt = mtNay();
  return [mt.donVi === 'pt' ? `Lãi ${dinhDangPhanTram(mt.giaTri / 100)} giá bán` : `Lãi ${dinhDangTien(mt.giaTri)} đ / đơn`,
    nt().coKichBan ? { ca2: 'cả 2 kịch bản QC', qc: 'có QC', khongqc: 'không QC' }[mt.kichBan] : null,
    { len1000: 'làm tròn lên 1.000', duoi9000: 'đuôi 9.000', khong: 'không làm tròn' }[mt.lamTron]].filter(Boolean).join(' · ');
}

function oGiaCanDat(d, g, dsPhi) {
  const r = giaCanDatDong(d, g, dsPhi);
  if (r.trangThai === 'thieu-von') return h('td', { class: 'so o-gcd chu-nhat', title: 'Chưa có giá vốn' }, '—');
  if (r.trangThai === 'thieu-phi') return h('td', { class: 'so o-gcd chu-nhat', title: `Chưa có bộ phí ${d.nganh} cho gian này` }, 'chưa có phí');
  if (r.trangThai === 'khong-dat') return h('td', { class: 'so o-gcd chu-lo', title: 'Tổng phí % + lãi % ≥ 100%: không giá nào đạt được' }, 'không đạt được');
  return h('td', { class: ['so', 'o-gcd', r.thieu !== null && 'o-gcd-thieu'], title: moTaMucTieu() },
    h('div', { class: 'gia-gcd' }, dinhDangTien(r.gia)),
    r.thieu !== null ? h('div', { class: 'chu-pt chu-lo' }, `thiếu ${dinhDangTien(r.thieu)}`)
      : Number.isFinite(d.gia_ban) && d.gia_ban > 0 ? h('div', { class: 'chu-pt chu-lai' }, '✓ đạt') : null);
}

// ---------- thao tác ----------

function themDong() {
  st.ds.push({ _id: moiId(), ten: 'Sản phẩm mới', phan_loai: '', nganh: nganhMacDinh(), gia_von: null, gia_ban: null });
  st.tim = '';
  st.chiLo = false;
  st.sapXep = null;
  st.trang = Math.floor((st.ds.length - 1) / MOI_TRANG);
  daSua();
  veLai();
  const o = goc.querySelector(`[data-o="${st.ds.at(-1)._id}:ten"]`);
  if (o) { o.focus(); o.select(); }
}

async function napFile(files) {
  const f = files[0];
  if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { thongBao(`"${f.name}" không phải file Excel.`, 'loi'); return; }
  let kq;
  try {
    kq = docBangSanPham(docBang(await f.arrayBuffer()).dong, { dsNganh: dsNganh(), nganhMacDinh: nganhMacDinh() });
  } catch (e) { thongBao(`Không đọc được file: ${e.message}`, 'loi'); return; }
  if (kq.loi) { thongBao(kq.loi, 'loi'); return; }
  if (!kq.dong.length) { thongBao('File không có dòng sản phẩm nào.', 'tt'); return; }
  st.ds.push(...kq.dong.map((r) => ({ ...r, _id: moiId() })));
  daSua();
  veLai();
  chucMung(`Đã nhập ${kq.dong.length} sản phẩm!`);
  kq.canhBao.slice(0, 4).forEach((c) => thongBao(c, 'tt'));
}

function taiFileMau() {
  const X = globalThis.XLSX;
  const ws = X.utils.aoa_to_sheet([TIEU_DE_MAU,
    ['Tranh tráng gương mẫu A', '30x40', 'Tranh', 20000, 79000],
    ['Tranh "Có ngoặc kép"', '40x60', 'Tranh', '35.000', '129.000'],
    ['Decal dán tường mẫu B', '60x90', 'Decal', 15000, ''],
  ]);
  ws['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sản phẩm');
  taiXuong('mau_tinh_loi_nhuan.xlsx', X.write(wb, { type: 'array', bookType: 'xlsx' }));
}

function tenFileAnToan(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'bang-tinh';
}

function xuatExcel(gians) {
  const X = globalThis.XLSX;
  const n = nt();
  const mang = n.bangXuat(st.ds, gians, n.dsPhi(), thangNay());
  if (mtNay().bat) {
    // thêm cột giá cần đạt ở cuối (5 cột đầu vẫn nhập lại được)
    mang[0].push(...gians.map((g) => `${g} - Giá cần đạt`));
    st.ds.forEach((d, i) => mang[i + 1].push(...gians.map((g) => { const r = giaCanDatDong(d, g, n.dsPhi()); return r.trangThai === 'ok' ? r.gia : ''; })));
  }
  const ws = X.utils.aoa_to_sheet(mang);
  ws['!cols'] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 11 }, ...gians.flatMap(() => n.cot.flatMap(() => [{ wch: 14 }, { wch: 9 }]))];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const homNay = new Date();
  const thongTin = X.utils.aoa_to_sheet([
    ['Bảng tính', st.bangTinh ? st.bangTinh.ten : 'Bảng tính mới'],
    ['Bộ phí', `Đang áp dụng tại tháng ${hienThiThang(thangNay())} (ngày xuất)`],
    ['Nền tảng', n.ten],
    ['Gian', gians.join(', ')],
    ...(mtNay().bat ? [['Giá cần đạt', moTaMucTieu()]] : []),
    ['Ngày xuất', homNay.toLocaleString('vi-VN')],
    ['Ghi chú', `Sheet "Lợi nhuận": 5 cột đầu nhập lại được vào app. ${n.congThuc}`],
  ]);
  thongTin['!cols'] = [{ wch: 12 }, { wch: 80 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Lợi nhuận');
  X.utils.book_append_sheet(wb, thongTin, 'Thông tin');
  const ngay = `${homNay.getFullYear()}${String(homNay.getMonth() + 1).padStart(2, '0')}${String(homNay.getDate()).padStart(2, '0')}`;
  taiXuong(`loi-nhuan${st.nenTang === 'shopee' ? '-shopee' : ''}_${tenFileAnToan(st.bangTinh ? st.bangTinh.ten : 'bang-tinh')}_${ngay}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }));
}

async function taoMoi() {
  if (!(await xongLuuHoacBo('tạo bảng mới'))) return;
  let bang = null;
  if (coSheets()) {
    const ten = await nhapChu('Tên bảng mới:', tenKhongTrung(tenMacDinh()), { nutDongY: 'Tạo' });
    if (!ten) return;
    bang = { id: idMoi(), ten };
  }
  ++phien;
  Object.assign(st, { ds: [], bangTinh: bang, thayDoi: !!bang, tim: '', chiLo: false, sapXep: null, trang: 0, luu: { tt: '', luc: null, loi: '' } });
  luuNhap();
  veLai();
  if (bang) luuNgay();
}

// Nút 💾: lưu ngay bảng CỦA MÌNH (mọi tài khoản), không chờ 3 giây.
async function luuLenSheets(banMoi) {
  if (!coSheets()) return;
  if (!st.bangTinh || banMoi) {
    if (!st.ds.length) return;
    const ten = await nhapChu('Đặt tên cho bảng tính:', st.bangTinh && banMoi ? `${st.bangTinh.ten} (bản sao)` : tenKhongTrung(tenMacDinh()), { nutDongY: 'Lưu' });
    if (!ten) return;
    ++phien;
    st.bangTinh = { id: idMoi(), ten };
    st.thayDoi = true;
    luuNhap();
  }
  const ten = st.bangTinh.ten;
  if (await luuNgay({ thuCong: true })) { veLai(); chucMung(`Đã lưu "${ten}" lên Google Sheets!`); }
}

const ngayGio = (iso) => { const d = new Date(iso); return iso && !isNaN(d) ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; };

/** "Mở bảng tính": CHỈ bảng của tài khoản đang đăng nhập + sàn đang chọn, và mục "Bảng cũ chưa có chủ". */
async function moDanhSach() {
  if (!coSheets()) { thongBao('Cần đăng nhập để mở bảng tính đã lưu.', 'tt'); return; }
  const san = st.nenTang;
  let ds, cu;
  try {
    [ds, cu] = await Promise.all([kho.dsBangTinhCuaToi(san), kho.dsBangTinhCu().catch(() => [])]);
  } catch (e) { thongBao(`Không tải được danh sách: ${e.message}`, 'loi'); return; }
  sapXepBang(ds);
  if (san === st.nenTang) { st.dsBang = [...ds]; capNhatDau(); }
  const sanNhan = ['tiktok', 'shopee'].filter((k) => nenTangDuocXem().includes(k));
  document.querySelector('dialog.hop-thoai-bang-tinh')?.remove();
  const dlg = h('dialog', { class: 'hop-thoai hop-thoai-rong hop-thoai-bang-tinh', 'aria-labelledby': 'bt-tieu-de' },
    h('div', { class: 'hop-thoai-dau' },
      h('h2', { id: 'bt-tieu-de' }, `📂 Bảng tính của ${st.nguoi} · ${NEN_TANG[san].ten}`),
      h('button', { class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
    h('p', { class: 'goi-y' }, `Chỉ hiện bảng của bạn trên sàn ${NEN_TANG[san].ten}. Người khác không xem được bảng của bạn.`),
    ds.length ? h('div', { class: 'khung-bang khung-bang-vua' }, h('table', { class: 'bang' },
      h('thead', null, h('tr', null, h('th', null, 'Tên'), h('th', { class: 'so' }, 'Số dòng'), h('th', null, 'Ngày tạo'), h('th', null, 'Sửa cuối'), h('th', null, ''))),
      h('tbody', null, ds.map((b) => h('tr', { class: st.bangTinh?.id === b.id ? 'dong-dang-mo' : '' },
        h('td', null, h('b', null, b.ten), st.bangTinh?.id === b.id ? h('span', { class: 'nhan-nho nhan-tim' }, 'đang mở') : null),
        h('td', { class: 'so' }, dinhDangTien(b.so_dong)),
        h('td', { class: 'chu-nhat' }, ngayGio(b.tao_luc)),
        h('td', { class: 'chu-nhat' }, ngayGio(b.cap_nhat_luc)),
        h('td', { class: 'o-thao-tac' },
          h('button', { class: 'nut nut-nho nut-chinh', onclick: () => moBangTinh(b, dlg) }, 'Mở'),
          h('button', { class: 'nut-icon', title: 'Đổi tên', 'aria-label': `Đổi tên ${b.ten}`, onclick: () => doiTenBangTinh(b, dlg) }, '✏️'),
          h('button', { class: 'nut-icon', title: 'Xóa', 'aria-label': `Xóa ${b.ten}`, onclick: () => xoaBangTinh(b, dlg) }, '🗑')))))))
      : manTrong('Chưa có bảng tính nào', `Nhập sản phẩm — bảng ${NEN_TANG[san].ten} của bạn tự lưu lên Sheets.`),
    cu.length ? h('div', { class: 'muc-bang-cu' },
      h('h3', null, `📦 Bảng cũ chưa có chủ (${cu.length})`),
      h('p', { class: 'goi-y' }, 'Bảng lưu trước khi có bảng riêng từng người. Bấm "Nhận" để thành bảng của bạn (chọn sàn) — bảng sẽ biến khỏi danh sách của người khác. Dữ liệu cũ không bị xóa.'),
      h('div', { class: 'khung-bang khung-bang-vua' }, h('table', { class: 'bang' },
        h('thead', null, h('tr', null, h('th', null, 'Tên'), h('th', { class: 'so' }, 'Số dòng'), h('th', null, 'Cập nhật'), h('th', null, 'Nhận bảng này'))),
        h('tbody', null, cu.map((b) => h('tr', null,
          h('td', null, h('b', null, b.ten || b.id)),
          h('td', { class: 'so' }, dinhDangTien(b.so_dong)),
          h('td', { class: 'chu-nhat' }, ngayGio(b.cap_nhat_luc)),
          h('td', { class: 'o-thao-tac' }, sanNhan.map((k) =>
            h('button', { class: 'nut nut-nho', onclick: () => nhanBangCu(b, k, dlg) }, `Nhận vào ${NEN_TANG[k].ten}`))))))))) : null);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

async function nhanBangCu(b, san, dlg) {
  if (!(await xacNhan(`Nhận "${b.ten || b.id}" thành bảng ${NEN_TANG[san].ten} của ${st.nguoi}? Người khác sẽ không thấy bảng này nữa.`, { nutDongY: 'Nhận bảng này' }))) return;
  try {
    const kq = await kho.nhanBangTinhCu(b.id, san);
    dlg.close();
    thongBao(`Đã nhận "${kq.ten}" vào ${NEN_TANG[san].ten}.`);
    if (san !== st.nenTang) doiNenTang(san); else await taiDsBang();
    moDanhSach();
  } catch (e) {
    thongBao(`Chưa nhận được: ${e.message}`, 'loi');
  }
}

async function moBangTinh(b, dlg) {
  if (b.id === st.bangTinh?.id && !st.thayDoi) { dlg?.close(); return; }
  if (!(await xongLuuHoacBo('mở bảng khác'))) return;
  if (await taiBang(b, ++phien)) {
    dlg?.close();
    thongBao(`Đã mở "${b.ten}" (${st.ds.length} dòng).`);
  }
}

async function doiTenBangTinh(b, dlg) {
  const moi = await nhapChu(`Đổi tên bảng "${b.ten}" thành:`, b.ten, { nutDongY: 'Đổi tên' });
  if (!moi || moi === b.ten) return;
  try {
    await kho.doiTenBangTinhCuaToi(st.nenTang, b.id, moi);
    const o = st.dsBang.find((x) => x.id === b.id);
    if (o) o.ten = moi;
    if (st.bangTinh?.id === b.id) { st.bangTinh.ten = moi; luuNhap(); }
    capNhatDau();
    dlg.close();
    thongBao(`Đã đổi tên thành "${moi}".`);
    moDanhSach();
  } catch (e) {
    thongBao(`Chưa đổi tên được: ${e.message}`, 'loi');
  }
}

async function xoaBangTinh(b, dlg) {
  if (!(await xacNhan(`Xóa bảng tính "${b.ten}" khỏi Google Sheets? Thao tác được ghi vào LICH_SU.`, { nutDongY: 'Xóa', nguyHiem: true }))) return;
  try {
    await kho.xoaBangTinhCuaToi(st.nenTang, b.id);
    st.dsBang = st.dsBang.filter((x) => x.id !== b.id);
    if (st.bangTinh?.id === b.id) {
      // xóa bảng đang mở → mở bảng gần nhất còn lại (hoặc tạo bảng trống)
      clearTimeout(henLuu);
      Object.assign(st, { ds: [], bangTinh: null, thayDoi: false });
      luuNhap(); veLai(); batDauPhien();
    } else capNhatDau();
    dlg.close();
    thongBao(`Đã xóa "${b.ten}".`);
    moDanhSach();
  } catch (e) {
    thongBao(`Chưa xóa được: ${e.message}`, 'loi');
  }
}
