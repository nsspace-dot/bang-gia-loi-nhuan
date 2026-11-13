// Tab Tính lợi nhuận: bảng sản phẩm, lãi có QC / không QC theo từng gian, tổng kết,
// nhập/xuất Excel, lưu "bảng tính" lên Google Sheets.
import { h, thayNoiDung, xacNhan, chonFile, ganKeoTha, taiXuong, nhapChu, veGiu, treLai } from './dom.js';
import { oSo, oChu, dangGoDo } from './o-so.js';
import { moChonNguoi } from './nguoi-dung.js';
import { baoDuLieuMoi, boChoTaiLai } from './du-lieu-moi.js';
import { thongBao } from './thong-bao.js';
import { manTrong, linhVat, chucMung } from './linh-vat.js';
import * as kho from '../data/kho.js';
import { docBangSanPham, laiTaiGian, locVaSapXep, tongKet, bangXuat, TIEU_DE_MAU } from '../core/bang-tinh.js';
import { thangHienTai, hienThiThang, chuanHoaThang, thieuPhiQC, CANH_BAO_QC } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangPhanTram } from '../core/so.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';
import { docBang } from '../excel/doc.js';

const KHOA_NHAP_CU = 'bggl.loinhuan.v1';      // bản nháp chung cả máy (trước khi có người dùng)
const KHOA_SAN = 'bggl.san.v1';
const khoaNhap = (nguoi, san) => `bggl.loinhuan.v2:${nguoi || '_'}:${san}`; // bản nháp riêng theo người + sàn
const MOI_TRANG = 100;
const TU_LUU_MS = 3000; // tự lưu lên Sheets sau 3 giây kể từ lần sửa cuối

let soId = 0;
const moiId = () => ++soId;

const st = {
  ds: [],              // { _id, ten, phan_loai, nganh, gia_von, gia_ban }
  san: 'TIKTOK',        // sàn đang chọn: TIKTOK | SHOPEE
  khoaNhap: null,       // khóa bản nháp đang dùng (người + sàn)
  nguoi: '',            // người của bản nháp đang mở (giữ lại để lưu đúng chủ khi vừa đổi người)
  dsBang: [],           // các bảng của người + sàn này (mới sửa trước)
  luu: { tt: '', luc: null, loi: '' }, // trạng thái lưu Sheets: '' | 'dang' | 'xong' | 'loi'
  phienSua: 0,          // tăng mỗi lần sửa — biết có sửa thêm trong lúc đang lưu / đang tải
  bangTinh: null,      // { id, ten } khi đang mở bảng tính đã lưu (của người + sàn hiện tại)
  thayDoi: false,      // có thay đổi chưa lưu lên Sheets
  gianXem: null,       // null = tất cả gian
  nganhMacDinh: '',
  tim: '',
  chiLo: false,
  sapXep: null,        // { gian, kichBan, chieu }
  trang: 0,
};
let goc;
let henLuu = null;      // hẹn giờ tự lưu
let dangLuuP = null;    // lần lưu đang chạy
let phien = 0;          // tăng khi đổi người / sàn / bảng → bỏ kết quả tải cũ

export function taoTabLoiNhuan(phanTu) {
  goc = phanTu;
  try { st.san = kho.SAN[localStorage.getItem(KHOA_SAN)] ? localStorage.getItem(KHOA_SAN) : 'TIKTOK'; } catch { /* mặc định TikTok */ }
  docNhap();
  kho.dangKy((_, ct) => {
    // Đổi người dùng → cất bản nháp của người cũ, mở bản nháp của người mới
    if (ct.nguoiDoi) { roiBang(); docNhap(); veLai(); batDauPhien(); return; }
    if (!ct.duLieuDoi) return;
    if (dangGoDo(goc) && ct.nguon !== 'cache') { baoDuLieuMoi('loi-nhuan', veLai); return; }
    veLai();
  });
  veLai();
  batDauPhien();
}

// ---------- tự mở bảng gần nhất / tự lưu ----------

const tenMacDinh = () => `Bảng của ${st.nguoi} – ${kho.SAN[st.san]}`;
const idMoi = () => `bt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const coSheets = () => !!(st.nguoi && kho.layCaiDat().url);
const gioPhut = (iso) => { const d = new Date(iso); return iso && !isNaN(d) ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''; };
function tenKhongTrung(ten) {
  const co = new Set(st.dsBang.map((b) => b.ten));
  if (!co.has(ten)) return ten;
  for (let i = 2; ; i++) if (!co.has(`${ten} (${i})`)) return `${ten} (${i})`;
}
const sapXepBang = (ds) => ds.sort((a, b) => String(b.cap_nhat_luc).localeCompare(String(a.cap_nhat_luc)));

/** Rời bảng hiện tại (đổi người / sàn): cất nháp, có thay đổi thì lưu ngay lên Sheets. */
function roiBang() {
  luuNhap();
  if (st.thayDoi && st.bangTinh && coSheets()) luuNgay();
  else clearTimeout(henLuu);
}

/**
 * Mở app / đổi người / đổi sàn: mở bảng dùng gần nhất của người + sàn đó.
 * Bản nháp trên máy nhớ bảng gần nhất; máy mới thì lấy bảng sửa gần nhất trên Sheets.
 * Chưa có bảng nào → tạo "Bảng của <Tên> – <Sàn>" trống.
 */
async function batDauPhien() {
  const ma = ++phien;
  const khoa = st.khoaNhap;
  if (!coSheets()) { capNhatDau(); return; }
  let ds;
  try { ds = sapXepBang(await kho.dsBangTinhCuaToi(st.san, st.nguoi)); } catch (e) {
    if (ma === phien) { st.luu = { tt: 'loi', loi: e.message }; capNhatDau(); }
    return;
  }
  if (ma !== phien || st.khoaNhap !== khoa) return;
  st.dsBang = ds;
  const daCo = st.bangTinh && ds.find((b) => b.id === st.bangTinh.id);
  if (st.bangTinh && st.thayDoi) { capNhatDau(); henTuLuu(); return; }           // còn sửa dở → tự lưu tiếp
  if (daCo) { await taiBang(daCo, ma); return; }                                  // bảng gần nhất → lấy bản mới nhất
  if (st.ds.length && !st.bangTinh) {                                             // nháp chưa thuộc bảng nào → thành bảng mới
    st.bangTinh = { id: idMoi(), ten: tenKhongTrung(tenMacDinh()) };
    st.thayDoi = true; luuNhap(); veLai(); henTuLuu(); return;
  }
  if (ds.length) { await taiBang(ds[0], ma); return; }
  Object.assign(st, { ds: [], bangTinh: { id: idMoi(), ten: tenMacDinh() }, thayDoi: true, trang: 0 });
  luuNhap(); veLai(); luuNgay();
}

/** Tải 1 bảng từ Sheets vào tab. Bỏ qua nếu người dùng đã đổi bảng / đang sửa trong lúc chờ. */
async function taiBang(b, ma) {
  const khoa = st.khoaNhap;
  const v = st.phienSua;
  try {
    const dong = await kho.docBangTinhCuaToi(st.san, b.id, st.nguoi);
    if (ma !== phien || st.khoaNhap !== khoa || st.phienSua !== v) return false;
    const tat = tatCaGian();
    const gianLuu = String(b.gian_hien_thi || '').split(',').filter((g) => tat.includes(g));
    Object.assign(st, {
      ds: dong.map((r) => ({ ...r, _id: moiId() })), bangTinh: { id: b.id, ten: b.ten }, thayDoi: false,
      gianXem: gianLuu.length && gianLuu.length < tat.length ? gianLuu : null,
      tim: '', chiLo: false, sapXep: null, trang: 0, luu: { tt: 'xong', luc: b.cap_nhat_luc, loi: '' },
    });
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

/** Lưu bảng đang mở lên Sheets ngay. Chụp dữ liệu trước rồi mới gửi (đổi người / sàn giữa chừng vẫn lưu đúng bảng). */
async function luuNgay({ thuCong = false } = {}) {
  clearTimeout(henLuu);
  henLuu = null;
  if (!st.bangTinh || !coSheets()) return false;
  const chup = {
    nguoi: st.nguoi, san: st.san, khoa: st.khoaNhap, v: st.phienSua,
    bang: { id: st.bangTinh.id, ten: st.bangTinh.ten, gian_hien_thi: gianDangXem().join(',') },
    dong: st.ds.map(({ _id, ...r }) => r),
  };
  st.luu = { ...st.luu, tt: 'dang' };
  capNhatDau();
  const truoc = dangLuuP;
  const lan = (async () => {
    if (truoc) await truoc.catch(() => {});
    return kho.luuBangTinhCuaToi(chup.san, chup.bang, chup.dong, chup.nguoi);
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
  try { st.dsBang = sapXepBang(await kho.dsBangTinhCuaToi(st.san, st.nguoi)); capNhatDau(); } catch { /* giữ danh sách cũ */ }
}

// ---------- lưu tạm trên máy (bản nháp) ----------

function docNhap() {
  Object.assign(st, { ds: [], bangTinh: null, thayDoi: false, tim: '', chiLo: false, sapXep: null, trang: 0, dsBang: [], luu: { tt: '', luc: null, loi: '' } });
  st.nguoi = kho.layNguoi();
  st.khoaNhap = khoaNhap(st.nguoi, st.san);
  try {
    let tho = localStorage.getItem(st.khoaNhap);
    // Bản nháp cũ (chung cả máy) → chuyển 1 lần vào bản nháp của người + sàn đang chọn, không mất
    if (!tho && kho.layNguoi()) {
      const cu = localStorage.getItem(KHOA_NHAP_CU);
      if (cu) {
        tho = cu;
        const d0 = JSON.parse(cu);
        if (d0) d0.bangTinh = null; // bảng cũ đã lưu giờ phải "nhận" trong danh sách
        tho = JSON.stringify(d0);
        localStorage.setItem(st.khoaNhap, tho);
        localStorage.removeItem(KHOA_NHAP_CU);
      }
    }
    const d = JSON.parse(tho || 'null');
    if (!d) return;
    st.ds = (d.ds || []).map((r) => ({ ...r, _id: moiId() }));
    Object.assign(st, { bangTinh: d.bangTinh || null, thayDoi: !!d.thayDoi, gianXem: d.gianXem || null, nganhMacDinh: d.nganhMacDinh || '' });
  } catch { /* bản nháp hỏng thì bỏ qua */ }
}

function luuNhap() {
  if (!st.khoaNhap) return;
  try {
    localStorage.setItem(st.khoaNhap, JSON.stringify({
      ds: st.ds.map(({ _id, ...r }) => r), bangTinh: st.bangTinh, thayDoi: st.thayDoi, gianXem: st.gianXem, nganhMacDinh: st.nganhMacDinh,
    }));
  } catch { /* hết bộ nhớ trình duyệt: vẫn dùng được, chỉ không giữ nháp */ }
}

function doiSan(san) {
  if (san === st.san) return;
  roiBang();
  st.san = san;
  try { localStorage.setItem(KHOA_SAN, san); } catch { /* bỏ qua */ }
  docNhap();
  veLai();
  batDauPhien();
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

const tatCaGian = () => layDanhSach(kho.duLieu().DANH_MUC, 'GIAN');
const dsNganh = () => layDanhSach(kho.duLieu().DANH_MUC, 'NGANH');
function gianDangXem() {
  const tat = tatCaGian();
  const ds = st.gianXem ? tat.filter((g) => st.gianXem.includes(g)) : tat;
  return ds.length ? ds : tat;
}
function nganhMacDinh() {
  const ds = dsNganh();
  return ds.includes(st.nganhMacDinh) ? st.nganhMacDinh : ds.includes('Tranh') ? 'Tranh' : ds[0];
}

// ---------- vẽ ----------

function ve() {
  const gians = gianDangXem();
  const dsPhi = kho.duLieu().BANG_PHI;

  const the = h('div', { class: 'the' }, veDau(), veDieuKhien(gians));
  ganKeoTha(the, napFile);
  thayNoiDung(goc, the, st.ds.length ? [veTongKet(gians, dsPhi), veBang(gians, dsPhi)] : veTrong());
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
  const dsPhi = kho.duLieu().BANG_PHI;
  const tr = goc.querySelector(`tr[data-id="${d._id}"]`);
  if (!tr) { veLai(); return; }
  veGiu(tr.parentElement, () => tr.replaceWith(veDong(i, gians, dsPhi)));
  const tk = goc.querySelector('.luoi-tong-ket');
  if (tk) tk.replaceWith(veTongKet(gians, dsPhi));
}

/** Nút Lưu luôn hiện: có thay đổi → sáng "💾 Lưu lên Sheets"; không có → mờ "✓ Đã lưu". */
function trangThaiNutLuu() {
  if (!st.ds.length && !st.bangTinh) return { tat: true, chu: '💾 Lưu lên Sheets' };
  if (st.thayDoi || !st.bangTinh || st.luu.tt === 'loi') return { tat: false, chu: '💾 Lưu lên Sheets' };
  return { tat: true, chu: '✓ Đã lưu' };
}

/** Chọn nhanh bảng của mình (cùng người + sàn) — không cần mở hộp "Mở bảng tính". */
function veChonBang() {
  const ds = [...st.dsBang];
  if (st.bangTinh && !ds.some((b) => b.id === st.bangTinh.id)) ds.unshift({ id: st.bangTinh.id, ten: st.bangTinh.ten });
  const hienTai = st.bangTinh?.id || '';
  return h('select', {
    class: 'o-nhap chon-bang', 'aria-label': 'Chọn bảng tính', title: 'Chọn nhanh bảng của bạn', disabled: !coSheets(),
    onchange: async (e) => {
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
        '👤 ', h('b', null, st.nguoi || 'chưa chọn tên'), ' · ', h('b', null, kho.SAN[st.san]), ' · 📄 ', h('b', { class: 'ten-bang' }, ten), ' ',
        veChonBang(), ' ', veTrangThaiLuu(),
        h('span', { class: 'chu-nhat' }, ` · ${st.ds.length} dòng`))),
    h('div', { class: 'hang-nut' },
      h('button', { class: 'nut', onclick: moDanhSach }, '📂 Mở bảng tính'),
      h('button', { class: 'nut nut-chinh nut-luu-sheets', onclick: () => luuLenSheets(false), disabled: nut.tat }, nut.chu),
      st.bangTinh ? h('button', { class: 'nut', onclick: () => luuLenSheets(true), disabled: !st.ds.length }, 'Lưu thành bản mới') : null,
      h('button', { class: 'nut', onclick: taoMoi, disabled: !st.ds.length && !st.bangTinh }, '🧹 Bảng mới')));
}

function veDieuKhien(gians) {
  const tat = tatCaGian();
  const chonNganh = h('select', { class: 'o-nhap', 'aria-label': 'Ngành mặc định', onchange: (e) => { st.nganhMacDinh = e.target.value; luuNhap(); } },
    dsNganh().map((n) => h('option', { value: n, selected: n === nganhMacDinh() }, n)));
  const oTim = h('input', { type: 'search', class: 'o-nhap', placeholder: 'Tìm tên, phân loại…', value: st.tim, 'aria-label': 'Tìm', 'data-o': 'tim',
    oninput: (e) => { st.tim = e.target.value; st.trang = 0; treLai(veLai); } });

  return h('div', { class: 'dieu-khien' },
    h('div', { class: 'hang hang-dk' },
      h('span', { class: 'nhan-ngang' }, 'Sàn'),
      h('div', { class: 'ds-chip', role: 'group', 'aria-label': 'Sàn' }, Object.entries(kho.SAN).map(([k, ten]) =>
        h('button', { class: ['chip-san', st.san === k && 'dang-chon'], 'aria-pressed': String(st.san === k), onclick: () => doiSan(k) }, ten))),
      h('span', { class: 'nhan-ngang', style: { marginLeft: '12px' } }, 'Gian hiển thị'),
      h('div', { class: 'ds-chip' }, tat.map((g) => {
        const bat = gians.includes(g);
        return h('button', {
          class: ['chip-gian', `gian-${mauGian(g, tat)}`, bat && 'dang-bat'], 'aria-pressed': String(bat),
          onclick: () => {
            const moi = bat ? gians.filter((x) => x !== g) : tat.filter((x) => gians.includes(x) || x === g);
            if (!moi.length) { thongBao('Phải hiển thị ít nhất 1 gian.', 'tt'); return; }
            st.gianXem = moi.length === tat.length ? null : moi;
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
        `Sắp xếp: ${st.sapXep.gian} · ${st.sapXep.kichBan === 'qc' ? 'có QC' : 'không QC'} ${st.sapXep.chieu < 0 ? '↓' : '↑'}`,
        h('button', { class: 'chip-xoa', 'aria-label': 'Bỏ sắp xếp', onclick: () => { st.sapXep = null; veLai(); } }, '×')) : null));
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
  const t = tongKet(st.ds, gians, dsPhi, thangNay());
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
      return h('div', { class: ['o-tong', `gian-${mauGian(g, tatGian)}`] },
        h('div', { class: 'o-tong-nhan' }, g, ' · lãi TB / đơn'),
        h('div', { class: 'o-tong-hai' },
          h('div', null, h('small', null, 'Có QC'), h('b', { class: lop(x.tbQC) }, x.tbQC === null ? '—' : dinhDangTien(x.tbQC))),
          h('div', null, h('small', null, 'Không QC'), h('b', { class: lop(x.tbKhongQC) }, x.tbKhongQC === null ? '—' : dinhDangTien(x.tbKhongQC)))),
        h('div', { class: 'o-tong-chan' },
          x.soDongLo ? h('span', { class: 'chu-lo' }, `${x.soDongLo} dòng lỗ`) : h('span', null, 'Không dòng nào lỗ'),
          x.thieuPhi ? h('span', { class: 'dau-canh-bao-phi' }, ` · ⚠ ${x.thieuPhi} dòng chưa có phí`) : null,
          x.phiTam ? h('span', { class: 'dau-canh-bao-phi' }, ` · ⚠ ${x.phiTam} dòng dùng phí tạm`) : null));
    }));
}

const lop = (x) => (x === null || x === undefined ? '' : x < 0 ? 'chu-lo' : 'chu-lai');

function veBang(gians, dsPhi) {
  const tatGian = tatCaGian();
  const chiSo = locVaSapXep(st.ds, { gians, dsPhi, thang: thangNay(), chiLo: st.chiLo, tim: st.tim, sapXep: st.sapXep });
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
      gians.map((g) => h('th', { colspan: 2, class: ['th-gian', `gian-${mauGian(g, tatGian)}`], scope: 'colgroup' }, g)),
      h('th', { rowspan: 2, scope: 'col' }, h('span', { class: 'an-chu' }, 'Thao tác'))),
    h('tr', null, gians.map((g) => [nutSap(g, 'qc', 'Có QC'), nutSap(g, 'khongqc', 'Không QC')])));

  const hang = trangNay.map((i) => veDong(i, gians, dsPhi));
  const soCot = 7 + gians.length * 2;

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

/** Ghi chú các trường hợp thiếu phí / đang dùng tạm phí khác (đặt dưới bảng để không đẩy bố cục khi sửa). */
function veGhiChuPhi(gians, dsPhi) {
  const ds = new Set();
  for (const d of st.ds) for (const g of gians) { const r = laiTaiGian(d, g, dsPhi, thangNay()); if (r.canhBaoPhi) ds.add(r.canhBaoPhi); }
  if (!ds.size) return null;
  return h('div', { class: 'canh-bao ghi-chu-phi' }, h('b', null, '⚠ Thiếu bộ phí:'),
    h('ul', null, [...ds].sort().map((c) => h('li', null, c))),
    h('div', { class: 'chu-nhat' }, 'Vào tab 💸 Bảng phí để nhập phí cho đúng gian / ngành / tháng.'));
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
    if (r.trangThai === 'thieu-phi') {
      return h('td', { class: 'so o-lai co-canh-bao-phi', title: r.canhBaoPhi },
        h('div', { class: 'dau-canh-bao-phi' }, '⚠ chưa có phí'), h('div', { class: 'chu-pt' }, `ngành ${d.nganh || '—'}`));
    }
    const lai = kichBan === 'qc' ? r.laiQC : r.laiKhongQC;
    const pt = kichBan === 'qc' ? r.ptQC : r.ptKhongQC;
    const thieuQC = kichBan === 'qc' && thieuPhiQC(r.phi);
    // Đang dùng TẠM bộ phí khác (vd ngành Trà chưa có phí tháng mới) → ⚠ + ghi chú, không lặng lẽ
    const ghiChu = [r.canhBaoPhi, thieuQC ? `${d.nganh}: ${CANH_BAO_QC}` : null].filter(Boolean).join('\n');
    return h('td', { class: ['so', 'o-lai', lai < 0 ? 'o-lo' : '', r.canhBaoPhi && 'co-canh-bao-phi'], title: ghiChu || null },
      h('div', { class: lop(lai) }, (thieuQC || r.canhBaoPhi) ? h('span', { class: r.canhBaoPhi ? 'dau-canh-bao-phi' : 'dau-canh-bao-qc', 'aria-label': ghiChu }, '⚠ ') : null, dinhDangTien(lai)),
      h('div', { class: 'chu-pt' }, r.canhBaoPhi ? `phí tạm ${hienThiThang(r.phi.thang)}` : dinhDangPhanTram(pt)));
  };

  return h('tr', { 'data-id': d._id, class: gians.some((g) => { const r = laiTaiGian(d, g, dsPhi, thangNay()); return r.trangThai === 'ok' && (r.laiQC < 0 || r.laiKhongQC < 0); }) ? 'dong-lo' : '' },
    h('td', { class: 'so cot-stt chu-nhat' }, i + 1),
    h('td', null, oTen('ten', '190px')),
    h('td', null, oTen('phan_loai', '64px')),
    h('td', null, chonNganh),
    h('td', { class: 'so' }, oTien('gia_von', 'Giá vốn')),
    h('td', { class: 'so' }, oTien('gia_ban', 'Giá bán')),
    gians.map((g) => { const r = laiTaiGian(d, g, dsPhi, thangNay()); return [oLai(r, 'qc'), oLai(r, 'khongqc')]; }),
    h('td', { class: 'o-thao-tac' },
      h('button', { class: 'nut-icon', title: 'Nhân bản dòng', 'aria-label': `Nhân bản dòng ${i + 1}`, onclick: () => { st.ds.splice(i + 1, 0, { ...d, _id: moiId() }); daSua(); veLai(); } }, '⧉'),
      h('button', { class: 'nut-icon', title: 'Xóa dòng', 'aria-label': `Xóa dòng ${i + 1}`, onclick: () => { st.ds.splice(i, 1); daSua(); veLai(); } }, '🗑')));
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
  const dsPhi = kho.duLieu().BANG_PHI;
  const ws = X.utils.aoa_to_sheet(bangXuat(st.ds, gians, dsPhi, thangNay()));
  ws['!cols'] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 11 }, ...gians.flatMap(() => [{ wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 9 }])];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const homNay = new Date();
  const thongTin = X.utils.aoa_to_sheet([
    ['Bảng tính', st.bangTinh ? st.bangTinh.ten : 'Bảng tính mới'],
    ['Bộ phí', `Đang áp dụng tại tháng ${hienThiThang(thangNay())} (ngày xuất)`],
    ['Gian', gians.join(', ')],
    ['Ngày xuất', homNay.toLocaleString('vi-VN')],
    ['Ghi chú', 'Sheet "Lợi nhuận": 5 cột đầu nhập lại được vào app. Lãi = Giá − Vốn − Phí cố định − Giá × tổng phí %.'],
  ]);
  thongTin['!cols'] = [{ wch: 12 }, { wch: 80 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Lợi nhuận');
  X.utils.book_append_sheet(wb, thongTin, 'Thông tin');
  const ngay = `${homNay.getFullYear()}${String(homNay.getMonth() + 1).padStart(2, '0')}${String(homNay.getDate()).padStart(2, '0')}`;
  taiXuong(`loi-nhuan_${tenFileAnToan(st.bangTinh ? st.bangTinh.ten : 'bang-tinh')}_${ngay}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }));
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

/** Cần tên người dùng trước khi làm việc với bảng tính trên Sheets. */
function canTen() {
  if (kho.layNguoi()) return true;
  thongBao('Chọn tên của bạn trước — bảng tính được lưu riêng cho từng người.', 'tt');
  moChonNguoi({ lanDau: true });
  return false;
}

// Lưu bảng CỦA MÌNH: không cần mật khẩu.
// Nút 💾: lưu ngay, không chờ 3 giây.
async function luuLenSheets(banMoi) {
  if (!canTen()) return;
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

/** "Mở bảng tính": CHỈ bảng của người đang chọn + sàn đang chọn, và mục "Bảng cũ chưa có chủ". */
async function moDanhSach() {
  if (!canTen()) return;
  const nguoi = kho.layNguoi();
  const san = st.san;
  let ds, cu;
  try {
    [ds, cu] = await Promise.all([kho.dsBangTinhCuaToi(san), kho.dsBangTinhCu().catch(() => [])]);
  } catch (e) { thongBao(`Không tải được danh sách: ${e.message}`, 'loi'); return; }
  sapXepBang(ds);
  if (san === st.san && nguoi === st.nguoi) { st.dsBang = [...ds]; capNhatDau(); }
  document.querySelector('dialog.hop-thoai-bang-tinh')?.remove();
  const dlg = h('dialog', { class: 'hop-thoai hop-thoai-rong hop-thoai-bang-tinh', 'aria-labelledby': 'bt-tieu-de' },
    h('div', { class: 'hop-thoai-dau' },
      h('h2', { id: 'bt-tieu-de' }, `📂 Bảng tính của ${nguoi} · ${kho.SAN[san]}`),
      h('button', { class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
    h('p', { class: 'goi-y' }, `Chỉ hiện bảng của bạn trên sàn ${kho.SAN[san]}. Đổi sàn ở mục "Sàn" trong tab.`),
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
      : manTrong('Chưa có bảng tính nào', `Nhập sản phẩm rồi bấm "💾 Lưu lên Sheets" để lưu bảng ${kho.SAN[san]} của bạn.`),
    cu.length ? h('div', { class: 'muc-bang-cu' },
      h('h3', null, `📦 Bảng cũ chưa có chủ (${cu.length})`),
      h('p', { class: 'goi-y' }, 'Bảng lưu trước khi có tên người dùng. Bấm "Nhận" để thành bảng của bạn (chọn sàn) — bảng sẽ biến khỏi danh sách của người khác.'),
      h('div', { class: 'khung-bang khung-bang-vua' }, h('table', { class: 'bang' },
        h('thead', null, h('tr', null, h('th', null, 'Tên'), h('th', { class: 'so' }, 'Số dòng'), h('th', null, 'Cập nhật'), h('th', null, 'Nhận bảng này'))),
        h('tbody', null, cu.map((b) => h('tr', null,
          h('td', null, h('b', null, b.ten || b.id)),
          h('td', { class: 'so' }, dinhDangTien(b.so_dong)),
          h('td', { class: 'chu-nhat' }, ngayGio(b.cap_nhat_luc)),
          h('td', { class: 'o-thao-tac' }, Object.entries(kho.SAN).map(([k, ten]) =>
            h('button', { class: 'nut nut-nho', onclick: () => nhanBangCu(b, k, dlg) }, `Nhận vào ${ten}`))))))))) : null);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

async function nhanBangCu(b, san, dlg) {
  if (!(await xacNhan(`Nhận "${b.ten || b.id}" thành bảng ${kho.SAN[san]} của ${kho.layNguoi()}? Người khác sẽ không thấy bảng này nữa.`, { nutDongY: 'Nhận bảng này' }))) return;
  try {
    const kq = await kho.nhanBangTinhCu(b.id, san);
    dlg.close();
    thongBao(`Đã nhận "${kq.ten}" vào ${kho.SAN[san]}.`);
    if (san !== st.san) doiSan(san); else await taiDsBang();
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
    await kho.doiTenBangTinhCuaToi(st.san, b.id, moi);
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
  if (!(await xacNhan(`Xóa bảng tính "${b.ten}" khỏi Google Sheets? Không khôi phục được (lịch sử vẫn ghi trong LICH_SU).`, { nutDongY: 'Xóa', nguyHiem: true }))) return;
  try {
    await kho.xoaBangTinhCuaToi(st.san, b.id);
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
