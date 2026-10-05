// Tab Campaign (Laminate + Liễn + Decal): danh sách campaign, chạy campaign mới, màn duyệt, xuất file, lưu.
import { h, thayNoiDung, xacNhan, chonFile, ganKeoTha, taiXuong, veGiu, treLai } from './dom.js';
import { oSo } from './o-so.js';
import { thongBao } from './thong-bao.js';
import { manTrong, linhVat, chucMung } from './linh-vat.js';
import * as kho from '../data/kho.js';
import {
  docPrefill, tinhCampaign, suaDong, tongHop, sapXepL30D, moTaNhanDien, chongLan,
  canhBaoChongLan, soVoiLanTruoc, bangBaoCao, dongKetQua, sizeRiengTrongNhom,
} from '../core/campaign.js';
import { taoBangTraVon } from '../core/gia-von.js';
import { chonBoPhi, chuanHoaThang, hienThiThang, laThangHopLe } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangPhanTram } from '../core/so.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';
import { boDau, chuanHoa } from '../core/van-ban.js';
import { docBang, docFileSanPham } from '../excel/doc.js';
import { taoFileDangKy } from '../excel/prefill.js';

const KHOA_CD = 'bggl.campaign.v1';
const MOI_TRANG = 100;
const TEN_CL = { A: 'A. Giảm cố định X%', B: 'B. Giảm sâu nhất còn lãi tối thiểu', C: 'C. Sát dưới trần' };
const NHAN_NHOM = { VAO: '✅ Vào được', LOAI: '❌ Bị loại', GAN: '❓ Cần gán', NGOAI: '⊘ Ngoài phạm vi' };

let goc;
const cacheKQ = new Map(); // id campaign → kết quả đã tải

function moi() {
  const nho = docNho();
  return {
    man: 'ds',
    tt: { id: `cp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ten: '', gian: nho.gian || '', bat_dau: '', ket_thuc: '', thang_phi: '', thangTuDong: true, tao_luc: new Date().toISOString() },
    cd: { chienLuoc: nho.chienLuoc || 'B', giamPT: nho.giamPT ?? '20', laiMin: '', buoc: nho.buoc || 1000 },
    filePrefill: null,
    fileSP: [],
    banDoSP: new Map(),
    ketQua: null,
    sua: new Map(),
    xem: 'VAO', tim: '', chiCanhBao: false, trang: 0,
    them: { chongLan: new Map(), lanTruoc: new Map(), ghiChu: [], dangTai: false },
    daLuu: false,
  };
}
let st;

function docNho() { try { return JSON.parse(localStorage.getItem(KHOA_CD) || '{}'); } catch { return {}; } }
function luuNho() {
  try { localStorage.setItem(KHOA_CD, JSON.stringify({ gian: st.tt.gian, chienLuoc: st.cd.chienLuoc, giamPT: st.cd.giamPT, buoc: st.cd.buoc })); } catch { /* bỏ qua */ }
}

export function taoTabCampaign(phanTu) {
  goc = phanTu;
  st = moi();
  // Màn chạy campaign KHÔNG vẽ lại khi đồng bộ nền (kết quả chỉ đổi khi bấm Tính lại)
  kho.dangKy((_, ct) => { if (ct.duLieuDoi && st.man === 'ds') veLai(); });
  ve();
}

function ve() {
  thayNoiDung(goc, st.man === 'ds' ? veDanhSach() : veChay());
}

/** Vẽ lại tab, giữ vị trí cuộn, ô đang focus và con trỏ. */
function veLai() {
  veGiu(goc, ve);
}

// =====================================================================
// Danh sách campaign
// =====================================================================

function parseJSON(s) { try { return typeof s === 'string' ? JSON.parse(s || '{}') : (s || {}); } catch { return {}; } }
const ngayVN = (s) => (s ? s.split('-').reverse().join('/') : '—');

function veDanhSach() {
  const ds = [...kho.duLieu().CAMPAIGN].sort((a, b) => String(b.bat_dau).localeCompare(String(a.bat_dau)) || String(b.tao_luc).localeCompare(String(a.tao_luc)));
  const gians = layDanhSach(kho.duLieu().DANH_MUC, 'GIAN');
  return [
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null, h('h2', null, 'Campaign'), h('p', { class: 'mo-ta' }, 'Laminate + Liễn + Decal · mỗi campaign là một phiên: tính giá, duyệt, xuất file đăng ký và báo cáo')),
        h('button', { class: 'nut nut-chinh', onclick: () => { st = moi(); st.man = 'chay'; veLai(); } }, '＋ Campaign mới'))),
    ds.length
      ? h('div', { class: 'the the-bang' }, h('div', { class: 'khung-bang' }, h('table', { class: 'bang' },
        h('thead', null, h('tr', null, ['Tên', 'Gian', 'Thời gian', 'Tháng phí', 'Chiến lược', 'Lãi tối thiểu', 'Vào / Loại / Gán', 'Xuất lúc', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', null, ds.map((c) => {
          const th = parseJSON(c.tong_hop);
          const ts = parseJSON(c.tham_so);
          return h('tr', null,
            h('td', null, h('b', null, c.ten)),
            h('td', null, h('span', { class: ['chip', `gian-${mauGian(c.gian, gians)}`] }, c.gian)),
            h('td', null, `${ngayVN(c.bat_dau)} → ${ngayVN(c.ket_thuc)}`),
            h('td', null, hienThiThang(c.thang_phi)),
            h('td', null, (TEN_CL[c.chien_luoc] || c.chien_luoc || '').split('.')[0], c.chien_luoc === 'A' && ts.giamPT ? ` (${ts.giamPT}%)` : ''),
            h('td', { class: 'so' }, c.lai_toi_thieu !== null && c.lai_toi_thieu !== '' ? `${c.lai_toi_thieu}%` : '—'),
            h('td', { class: 'so' }, h('span', { class: 'chu-lai' }, th.VAO ?? '—'), ' / ', h('span', { class: 'chu-lo' }, th.LOAI ?? '—'), ' / ', th.GAN ?? '—'),
            h('td', { class: 'chu-nhat' }, c.xuat_luc ? new Date(c.xuat_luc).toLocaleString('vi-VN') : 'chưa xuất'),
            h('td', { class: 'o-thao-tac' },
              h('button', { class: 'nut nut-nho', onclick: () => xemLai(c) }, 'Xem lại'),
              h('button', { class: 'nut nut-nho', onclick: () => nhanBan(c) }, 'Nhân bản cài đặt')));
        })))))
      : h('div', { class: 'the' }, manTrong('Chưa có campaign nào', 'Bấm "＋ Campaign mới", thả file prefill campaign + file sản phẩm TikTok để bắt đầu.')),
  ];
}

function nhanBan(c) {
  st = moi();
  const ts = parseJSON(c.tham_so);
  st.man = 'chay';
  st.tt.ten = `${c.ten} (bản sao)`;
  st.tt.gian = c.gian;
  st.cd = { chienLuoc: c.chien_luoc || 'B', giamPT: ts.giamPT ?? '20', laiMin: c.lai_toi_thieu !== null && c.lai_toi_thieu !== undefined ? String(c.lai_toi_thieu) : '', buoc: ts.buoc || 1000 };
  veLai();
  thongBao(`Đã nhân bản cài đặt từ "${c.ten}". Nhập ngày, thả file rồi bấm Tính.`, 'tt');
}

async function layKQ(id) {
  if (!cacheKQ.has(id)) cacheKQ.set(id, await kho.docCampaignKQ(id));
  return cacheKQ.get(id);
}

async function xemLai(c) {
  let kq;
  try { kq = await layKQ(c.id); } catch (e) { thongBao(`Không tải được kết quả: ${e.message}`, 'loi'); return; }
  const th = parseJSON(c.tong_hop);
  const ts = parseJSON(c.tham_so);
  const dem = (n) => kq.filter((r) => r.ket_qua === n).length;
  const taiKQ = () => {
    const X = globalThis.XLSX;
    const wb = X.utils.book_new();
    const dau = ['SKU ID', 'Product ID', 'Lý do', 'Loại', 'Nhóm', 'Size', 'Số tranh', 'Giá vốn', 'Giá bán lẻ', 'Giá campaign', 'Số lượng', 'Lãi có QC', 'Lãi không QC', 'Ghi chú'];
    for (const [n, ten] of [['VAO', 'Vào được'], ['LOAI', 'Bị loại'], ['GAN', 'Cần gán']]) {
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([dau, ...kq.filter((r) => r.ket_qua === n).map((r) => [r.sku_id, r.product_id, r.ly_do, r.loai, r.nhom, r.phan_loai, r.so_luong_tranh, r.gia_von, r.gia_ban_le, r.gia_campaign, r.so_luong, r.lai_qc, r.lai_noqc, r.ghi_chu])]), ten);
    }
    taiXuong(`${tenFile(c.ten)}_ket-qua.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }));
  };
  const dlg = h('dialog', { class: 'hop-thoai hop-thoai-rong' },
    h('div', { class: 'hop-thoai-dau' }, h('h2', null, `🎯 ${c.ten}`), h('button', { class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
    h('p', { class: 'mo-ta' }, `${c.gian} · ${ngayVN(c.bat_dau)} → ${ngayVN(c.ket_thuc)} · phí tháng ${hienThiThang(c.thang_phi)} · ${TEN_CL[c.chien_luoc] || ''}${c.chien_luoc === 'A' ? ` ${ts.giamPT}%` : ''} · lãi tối thiểu ${c.lai_toi_thieu}% · làm tròn ${dinhDangTien(+ts.buoc || 1000)}`),
    h('p', { class: 'chu-nhat' }, `File gốc: ${c.file_goc || '—'} · xuất lúc ${c.xuat_luc ? new Date(c.xuat_luc).toLocaleString('vi-VN') : '—'}`),
    h('div', { class: 'ds-chip', style: { marginTop: '12px' } },
      h('span', { class: 'chip chip-so nhan-xanh' }, `✅ Vào được: ${dem('VAO')}`),
      h('span', { class: 'chip chip-so nhan-do' }, `❌ Bị loại: ${dem('LOAI')}`),
      h('span', { class: 'chip chip-so nhan-vang' }, `❓ Cần gán: ${dem('GAN')}`),
      h('span', { class: 'chip chip-so' }, `⊘ Ngoài phạm vi: ${th.NGOAI ?? '—'}`)),
    th.laiTB ? h('p', { style: { marginTop: '10px' } }, `Lãi TB (vào được): có QC ${dinhDangTien(th.laiTB.laiQC)} đ (${dinhDangPhanTram(th.laiTB.ptQC)}) · không QC ${dinhDangTien(th.laiTB.laiKhongQC)} đ (${dinhDangPhanTram(th.laiTB.ptKhongQC)})`) : null,
    h('div', { class: 'hang-nut' }, h('span', { class: 'gian-cach' }),
      h('button', { class: 'nut', onclick: () => { dlg.close(); nhanBan(c); } }, 'Nhân bản cài đặt'),
      h('button', { class: 'nut nut-chinh', onclick: taiKQ }, '📊 Tải kết quả (Excel)')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

// =====================================================================
// Chạy campaign
// =====================================================================

function giaTriLaiMin() {
  const so = docSo(st.cd.laiMin);
  return so === null || so < 0 || so >= 100 ? null : so / 100;
}
function giaTriGiam() {
  const so = docSo(st.cd.giamPT);
  return so === null || so <= 0 || so >= 100 ? null : so / 100;
}
function cdTinh() {
  return { chienLuoc: st.cd.chienLuoc, giamPT: giaTriGiam() ?? 0, laiMin: giaTriLaiMin() ?? 0, buoc: +st.cd.buoc || 1000 };
}
function thieuGi() {
  const t = [];
  if (!st.tt.ten.trim()) t.push('tên campaign');
  if (!st.tt.bat_dau || !st.tt.ket_thuc) t.push('ngày bắt đầu – kết thúc');
  else if (st.tt.ket_thuc < st.tt.bat_dau) t.push('ngày kết thúc phải sau ngày bắt đầu');
  if (!laThangHopLe(st.tt.thang_phi)) t.push('tháng phí');
  if (!st.filePrefill) t.push('file prefill');
  if (giaTriLaiMin() === null) t.push('lãi tối thiểu');
  if (st.cd.chienLuoc === 'A' && giaTriGiam() === null) t.push('X% giảm');
  return t;
}

function doiTT(thayDoi, tinhLai = true) {
  Object.assign(st.tt, thayDoi);
  if ('bat_dau' in thayDoi && st.tt.thangTuDong && thayDoi.bat_dau) st.tt.thang_phi = thayDoi.bat_dau.slice(0, 7);
  luuNho();
  if (tinhLai && st.ketQua) tinh(false);
  else veLai();
}
function doiCD(thayDoi) {
  Object.assign(st.cd, thayDoi);
  luuNho();
  if (st.ketQua && !thieuGi().length) tinh(false);
  else veLai();
}

function nhomNut(tuyChon, giaTri, khiChon, nhan) {
  return h('div', { class: 'nhom-nut', role: 'group', 'aria-label': nhan },
    tuyChon.map(([gt, chu]) => h('button', { class: ['nut-chon', String(gt) === String(giaTri) && 'dang-chon'], 'aria-pressed': String(String(gt) === String(giaTri)), onclick: () => khiChon(gt) }, chu)));
}

function veChay() {
  const gians = layDanhSach(kho.duLieu().DANH_MUC, 'GIAN');
  if (!gians.includes(st.tt.gian)) st.tt.gian = gians.includes('Tường Vip') ? 'Tường Vip' : gians[0];
  const thieu = thieuGi();
  return [
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null,
          h('button', { class: 'nut nut-nho', onclick: async () => {
            if (st.ketQua && !st.daLuu && !(await xacNhan('Campaign này chưa lưu. Quay lại danh sách?', { nutDongY: 'Quay lại', nguyHiem: true }))) return;
            st.man = 'ds'; veLai();
          } }, '‹ Danh sách campaign'),
          h('h2', { class: 'tieu-de-cp', style: { marginTop: '8px' } }, st.tt.ten || 'Campaign mới')),
        h('span', { class: ['nhan-nho', 'nhan-xanh', 'nhan-da-luu-cp', !st.daLuu && 'nhan-an'] }, 'đã lưu lên Sheets')),
      h('div', { class: 'luoi-cai-dat luoi-cp' }, veThongTin(gians), veFile(), veCaiDatGia()),
      h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-chinh nut-lon', disabled: thieu.length > 0, onclick: () => tinh(true) }, st.ketQua ? '🔄 Tính lại' : '🧮 Tính giá campaign'),
        thieu.length ? h('span', { class: 'chu-nhat' }, `Còn thiếu: ${thieu.join(', ')}`) : h('span', { class: 'chu-nhat' }, 'Sẵn sàng.'))),
    st.ketQua ? veDuyet() : null,
  ];
}

function veThongTin(gians) {
  const o = (thuocTinh) => h('input', { class: 'o-nhap', ...thuocTinh });
  return h('div', { class: 'o-cai-dat' },
    h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '1'), 'Thông tin campaign'),
    h('label', { class: 'nhan-nho-o' }, 'Tên campaign',
      o({ type: 'text', value: st.tt.ten, placeholder: 'vd: Siêu sale 11.11', 'data-o': 'ten', oninput: (e) => { st.tt.ten = e.target.value; capNhatNutTinh(); }, onchange: () => { const t = goc.querySelector('.tieu-de-cp'); if (t) t.textContent = st.tt.ten || 'Campaign mới'; } })),
    h('div', { class: 'nhan-nho-o' }, 'Gian hàng',
      h('div', { class: 'ds-chip' }, gians.map((g) => h('button', { class: ['chip-gian', `gian-${mauGian(g, gians)}`, g === st.tt.gian && 'dang-bat'], onclick: () => doiTT({ gian: g }) }, g)))),
    h('div', { class: 'hang' },
      h('label', { class: 'nhan-nho-o' }, 'Bắt đầu', o({ type: 'date', value: st.tt.bat_dau, onchange: (e) => doiTT({ bat_dau: e.target.value }) })),
      h('label', { class: 'nhan-nho-o' }, 'Kết thúc', o({ type: 'date', value: st.tt.ket_thuc, onchange: (e) => doiTT({ ket_thuc: e.target.value }) }))),
    h('label', { class: 'nhan-nho-o' }, 'Tháng phí áp dụng',
      h('div', { class: 'hang' },
        o({ type: 'month', value: st.tt.thang_phi, onchange: (e) => doiTT({ thang_phi: chuanHoaThang(e.target.value) || '', thangTuDong: false }) }),
        h('span', { class: 'chu-nhat' }, st.tt.thangTuDong ? 'theo ngày bắt đầu' : 'đã sửa tay'))));
}

function capNhatNutTinh() {
  const nut = goc.querySelector('.nut-lon');
  const chu = nut?.nextElementSibling;
  if (!nut) return;
  const thieu = thieuGi();
  nut.disabled = thieu.length > 0;
  if (chu) chu.textContent = thieu.length ? `Còn thiếu: ${thieu.join(', ')}` : 'Sẵn sàng.';
}

function veFile() {
  const vungPre = h('button', { class: ['vung-tha', 'vung-tha-nho', st.filePrefill && 'vung-tha-xong'], onclick: async () => { const f = await chonFile(); if (f) napPrefill([f]); } },
    linhVat('nho'),
    st.filePrefill
      ? h('span', null, h('b', null, `✓ ${st.filePrefill.ten}`), h('br'), `${dinhDangTien(st.filePrefill.pre.dong.length)} SKU — bấm để đổi file`)
      : h('span', null, h('b', null, 'File prefill campaign'), h('br'), 'Processing_result_Campaign_prefill…xlsx'));
  ganKeoTha(vungPre, napPrefill);
  const timThay = st.filePrefill ? st.filePrefill.pre.dong.filter((d) => st.banDoSP.has(d.sku_id)).length : 0;
  const vungSP = h('button', { class: ['vung-tha', 'vung-tha-nho', st.fileSP.length && 'vung-tha-xong'], onclick: async () => { const f = await chonFile(); if (f) napSanPham([f]); } },
    linhVat('nho'),
    st.fileSP.length
      ? h('span', null, h('b', null, `✓ ${st.fileSP.length} file sản phẩm`), h('br'), `${dinhDangTien(st.banDoSP.size)} SKU — thả thêm file để bổ sung`)
      : h('span', null, h('b', null, 'File sản phẩm TikTok (một hoặc nhiều)'), h('br'), 'all_information…xlsx — kéo thả nhiều file cùng lúc'));
  ganKeoTha(vungSP, napSanPham);
  return h('div', { class: 'o-cai-dat' },
    h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '2'), 'File'),
    vungPre, vungSP,
    st.filePrefill && st.fileSP.length
      ? h('p', { class: timThay === st.filePrefill.pre.dong.length ? 'chu-lai' : 'chu-lo' }, `Tìm thấy ${dinhDangTien(timThay)} / ${dinhDangTien(st.filePrefill.pre.dong.length)} SKU trong file sản phẩm`)
      : st.filePrefill ? h('p', { class: 'goi-y goi-y-sat' }, 'Chưa có file sản phẩm: sẽ nhận diện theo tên trong file prefill (kém chính xác).') : null,
    st.fileSP.length ? h('button', { class: 'nut nut-nho', onclick: () => { st.fileSP = []; st.banDoSP = new Map(); if (st.ketQua) tinh(false); else veLai(); } }, 'Bỏ các file sản phẩm') : null);
}

function veCaiDatGia() {
  // Gõ: chỉ cập nhật nút Tính (không vẽ lại). Rời ô / Enter: tính lại nếu đã có kết quả.
  const oLai = oSo({
    class: ['o-nhap', 'o-nhap-so'], kieu: 'so', giaTri: docSo(st.cd.laiMin), placeholder: 'vd 10', 'data-o': 'laiMin', 'aria-label': 'Lãi tối thiểu (%)',
    kiemTra: (so) => (so >= 100 ? 'Phải nhỏ hơn 100%' : null),
    khiGo: (_so, _ok, chuoi) => { st.cd.laiMin = chuoi; capNhatNutTinh(); },
    khiLuu: () => { st.cd.laiMin = oLai.value; doiCD({}); },
  });
  const oGiam = oSo({
    class: ['o-nhap', 'o-nhap-so'], kieu: 'so', giaTri: docSo(st.cd.giamPT), 'data-o': 'giamPT', 'aria-label': 'Giảm X%',
    kiemTra: (so) => (so <= 0 || so >= 100 ? 'Từ 0 đến 100%' : null), choPhepTrong: false,
    khiGo: (_so, _ok, chuoi) => { st.cd.giamPT = chuoi; capNhatNutTinh(); },
    khiLuu: () => { st.cd.giamPT = oGiam.value; doiCD({}); },
  });
  return h('div', { class: 'o-cai-dat' },
    h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '3'), 'Cài đặt giá'),
    h('div', { class: 'nhan-nho-o' }, 'Chiến lược giá',
      h('div', { class: 'ds-chien-luoc' }, ['A', 'B', 'C'].map((k) => h('button', {
        class: ['chien-luoc', st.cd.chienLuoc === k && 'dang-chon'], 'aria-pressed': String(st.cd.chienLuoc === k), onclick: () => doiCD({ chienLuoc: k }),
      }, h('b', null, TEN_CL[k]), h('small', null, {
        A: 'Giá bán lẻ × (1 − X%), làm tròn xuống. Vượt trần thì hạ sát dưới trần.',
        B: 'Giá thấp nhất mà cả có QC và không QC vẫn đạt lãi tối thiểu, làm tròn lên.',
        C: 'Số làm tròn lớn nhất còn nhỏ hơn trần (và nhỏ hơn giá bán lẻ).',
      }[k]))))),
    st.cd.chienLuoc === 'A' ? h('label', { class: 'nhan-nho-o hang' }, 'Giảm X = ', oGiam, '%') : null,
    h('label', { class: 'nhan-nho-o hang' }, 'Lãi tối thiểu (trên giá campaign) ', oLai, '%', h('span', { class: 'chu-nhat' }, ' — nhập mỗi lần')),
    h('div', { class: 'nhan-nho-o' }, 'Làm tròn theo bước', nhomNut([[100, '100'], [500, '500'], [1000, '1.000']], st.cd.buoc, (v) => doiCD({ buoc: v }), 'Bước làm tròn')));
}

// ---------- nạp file ----------

async function napPrefill(files) {
  const f = files[0];
  if (!/\.xlsx$/i.test(f.name)) { thongBao('File prefill phải là .xlsx', 'loi'); return; }
  try {
    const buf = await f.arrayBuffer();
    const pre = docPrefill(docBang(buf).dong);
    if (pre.loi) { thongBao(pre.loi, 'loi'); return; }
    st.filePrefill = { ten: f.name, buf, pre };
    st.ketQua = null;
    st.sua = new Map();
    st.daLuu = false;
    if (!st.tt.ten) st.tt.ten = f.name.replace(/\.xlsx$/i, '').replace(/^Processing_result_Campaign_prefill_template_?/i, '') || '';
    veLai();
    thongBao(`Đã đọc ${pre.dong.length} SKU từ file prefill.`);
  } catch (e) {
    thongBao(`Không đọc được file prefill: ${e.message}`, 'loi');
  }
}

async function napSanPham(files) {
  let them = 0;
  for (const f of files) {
    if (!/\.xlsx$/i.test(f.name)) { thongBao(`"${f.name}" không phải .xlsx`, 'loi'); continue; }
    try {
      const ds = docFileSanPham(await f.arrayBuffer());
      ds.forEach((x) => st.banDoSP.set(String(x.sku_id), x));
      st.fileSP.push({ ten: f.name, soSku: ds.length });
      them += ds.length;
    } catch (e) {
      thongBao(`"${f.name}": ${e.message}`, 'loi');
    }
  }
  if (them) thongBao(`Đã đọc ${them} SKU từ ${files.length} file sản phẩm.`);
  if (st.ketQua) tinh(false); else veLai();
}

// ---------- tính ----------

function tinh(lanDau) {
  if (thieuGi().length) { veLai(); return; }
  const d = kho.duLieu();
  const ganTay = new Map(d.NOI_SKU.map((r) => [String(r.sku_id), r]));
  const cd = cdTinh();
  const layPhi = (nganh) => chonBoPhi(d.BANG_PHI, st.tt.gian, nganh, st.tt.thang_phi);
  let ds = tinhCampaign({ dong: st.filePrefill.pre.dong, banDoSP: st.banDoSP, bangVon: taoBangTraVon(d.GIA_VON), ganTay, layPhi, cd });
  ds = ds.map((r) => (st.sua.has(r.sku_id) ? suaDong(r, st.sua.get(r.sku_id), cd) : r));
  st.ketQua = sapXepL30D(ds);
  st.daLuu = false;
  if (lanDau) {
    st.trang = 0;
    st.xem = 'VAO';
    chucMung(`Đã tính ${dinhDangTien(ds.length)} SKU!`);
  }
  veLai();
  taiSoSanh();
}

/** Tải kết quả các campaign khác để cảnh báo chồng lấn / so với lần trước. */
async function taiSoSanh() {
  const cacCp = kho.duLieu().CAMPAIGN.filter((c) => c.gian === st.tt.gian && c.id !== st.tt.id);
  const chong = cacCp.filter((c) => chongLan(st.tt.bat_dau, st.tt.ket_thuc, c.bat_dau, c.ket_thuc));
  const truoc = cacCp.filter((c) => c.bat_dau && c.bat_dau < st.tt.bat_dau).sort((a, b) => String(b.bat_dau).localeCompare(String(a.bat_dau)))[0];
  if (!chong.length && !truoc) { st.them = { chongLan: new Map(), lanTruoc: new Map(), ghiChu: ['Chưa có campaign nào khác cùng gian để so sánh.'], dangTai: false }; veLai(); return; }
  st.them.dangTai = true;
  try {
    const cacChong = [];
    for (const c of chong) {
      const kq = await layKQ(c.id);
      cacChong.push({ ten: c.ten, kq: new Map(kq.filter((r) => r.ket_qua === 'VAO').map((r) => [String(r.sku_id), r.gia_campaign])) });
    }
    let lanTruoc = new Map();
    if (truoc) {
      const kq = await layKQ(truoc.id);
      lanTruoc = soVoiLanTruoc(st.ketQua, new Map(kq.map((r) => [String(r.sku_id), r])), truoc.ten);
    }
    st.them = {
      chongLan: canhBaoChongLan(st.ketQua, cacChong), lanTruoc, dangTai: false,
      ghiChu: [chong.length ? `Đã so với ${chong.length} campaign chồng thời gian: ${chong.map((c) => c.ten).join(', ')}.` : 'Không có campaign nào chồng thời gian.',
        truoc ? `So với campaign trước: "${truoc.ten}".` : 'Chưa có campaign trước cùng gian.'],
    };
  } catch (e) {
    st.them = { chongLan: new Map(), lanTruoc: new Map(), dangTai: false, ghiChu: [`Không tải được campaign khác để so sánh: ${e.message}`] };
  }
  veLai();
}

// =====================================================================
// Màn duyệt
// =====================================================================

function canhBaoCua(r) {
  return [...r.canhBao, ...(st.them.chongLan.get(r.sku_id) || []), ...(st.them.lanTruoc.has(r.sku_id) ? [st.them.lanTruoc.get(r.sku_id)] : [])];
}

function veDuyet() {
  const ds = st.ketQua;
  const th = tongHop(ds);
  const dem = th.dem;
  const coCanhBao = ds.filter((r) => canhBaoCua(r).length).length;
  const tim = boDau(st.tim).trim();
  const loc = ds.filter((r) => r.nhom === st.xem
    && (!tim || boDau(`${r.sku_id} ${r.sp.product_name} ${r.sp.variation_value} ${r.sp.seller_sku}`).includes(tim))
    && (!st.chiCanhBao || canhBaoCua(r).length));
  const soTrang = Math.max(1, Math.ceil(loc.length / MOI_TRANG));
  st.trang = Math.min(st.trang, soTrang - 1);
  const trang = loc.slice(st.trang * MOI_TRANG, (st.trang + 1) * MOI_TRANG);

  return [
    h('div', { class: 'luoi-tong-ket luoi-nhom-cp' },
      ['VAO', 'LOAI', 'GAN', 'NGOAI'].map((n) => h('button', {
        class: ['o-tong', 'o-nhom', `o-nhom-${n.toLowerCase()}`, st.xem === n && 'dang-chon'], 'aria-pressed': String(st.xem === n),
        onclick: () => { st.xem = n; st.trang = 0; veLai(); },
      }, h('div', { class: 'o-tong-nhan' }, NHAN_NHOM[n]), h('div', { class: 'o-tong-so' }, dinhDangTien(dem[n])),
      h('div', { class: 'chu-nhat' }, {
        VAO: th.laiTB ? `Lãi TB: QC ${dinhDangPhanTram(th.laiTB.ptQC)} · không QC ${dinhDangPhanTram(th.laiTB.ptKhongQC)}` : '—',
        LOAI: Object.entries(th.lyDo).filter(([k]) => k !== 'Ngoài phạm vi').map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Không có',
        GAN: 'Chọn nhóm + size để gán, lưu theo SKU',
        NGOAI: 'Lịch, đồng hồ, khung, trà… — chỉ đếm',
      }[n])))),
    h('div', { class: 'the the-bang' },
      h('div', { class: 'hang hang-dk' },
        h('input', { type: 'search', class: 'o-nhap', placeholder: 'Tìm SKU, tên, phân loại…', value: st.tim, 'data-o': 'tim-cp', oninput: (e) => { st.tim = e.target.value; st.trang = 0; treLai(veLai); } }),
        h('label', { class: 'hop-kiem hop-kiem-ngang' }, h('input', { type: 'checkbox', checked: st.chiCanhBao, onchange: (e) => { st.chiCanhBao = e.target.checked; st.trang = 0; veLai(); } }), ` Chỉ dòng có cảnh báo (${coCanhBao})`),
        h('span', { class: 'gian-cach' }),
        h('span', { class: 'chu-nhat' }, st.them.dangTai ? '⏳ Đang so với campaign khác…' : st.them.ghiChu.join(' '))),
      h('div', { class: 'khung-bang khung-bang-cao', 'data-cuon': 'campaign', 'data-dieu-huong': '' }, st.xem === 'GAN' ? veBangGan(trang) : veBangGia(trang)),
      h('div', { class: 'hang hang-trang' },
        h('span', { class: 'chu-nhat' }, `${dinhDangTien(loc.length)} dòng · sắp xếp theo L30D sales giảm dần`),
        h('span', { class: 'gian-cach' }),
        soTrang > 1 ? [
          h('button', { class: 'nut nut-nho', disabled: st.trang === 0, onclick: () => { st.trang--; veLai(); } }, '‹ Trước'),
          h('span', { class: 'chu-nhat' }, `Trang ${st.trang + 1} / ${soTrang}`),
          h('button', { class: 'nut nut-nho', disabled: st.trang >= soTrang - 1, onclick: () => { st.trang++; veLai(); } }, 'Sau ›'),
        ] : null)),
    h('div', { class: 'the thanh-xuat' },
      h('div', null, h('b', null, `File đăng ký sẽ có ${dinhDangTien(dem.VAO)} SKU`), h('div', { class: 'chu-nhat' }, `Xóa ${dinhDangTien(ds.length - dem.VAO)} dòng không vào được (kể cả ngoài phạm vi). Campaign price ghi số, không công thức.`)),
      h('span', { class: 'gian-cach' }),
      h('button', { class: 'nut', disabled: !dem.VAO, onclick: () => xuatDangKy() }, '📥 File đăng ký'),
      h('button', { class: 'nut', onclick: () => xuatBaoCao() }, '📊 File báo cáo'),
      h('button', { class: 'nut', onclick: () => luuSheets() }, '💾 Lưu lên Sheets'),
      h('button', { class: 'nut nut-chinh', disabled: !dem.VAO, onclick: xuatVaLuu }, '✅ Xuất cả 2 file & lưu')),
  ];
}

function oNhanDien(r) {
  if (!r.nd?.nhom) return h('span', { class: 'chu-nhat' }, '—');
  return h('div', null, moTaNhanDien(r.nd),
    r.nd.nguon === 'gan-tay' ? h('span', { class: 'nhan-nho nhan-tim' }, 'gán tay') : null,
    r.nd.suyRaTuTen?.length ? h('span', { class: 'nhan-nho nhan-vang', title: `Suy ra từ tên sản phẩm: ${r.nd.suyRaTuTen.join(', ')} — kiểm tra lại` }, 'suy ra từ tên') : null);
}

function oSanPham(r) {
  return h('div', { class: 'o-sp' },
    h('div', { class: 'o-sp-ten', title: r.sp.product_name }, r.sp.product_name),
    h('div', { class: 'chu-nhat' }, r.sp.variation_value || '—', r.sp.seller_sku ? ` · ${r.sp.seller_sku}` : '', ` · SKU ${r.sku_id}`));
}

/** Sửa 1 dòng (giá / số lượng / bỏ chọn): chỉ thay dòng đó + các ô đếm, KHÔNG vẽ lại bảng, dòng không nhảy chỗ. */
function suaMotDong(r, thayDoi) {
  const cd = cdTinh();
  const cu = st.sua.get(r.sku_id) || {};
  st.sua.set(r.sku_id, { ...cu, ...thayDoi });
  const i = st.ketQua.indexOf(r);
  const moi = suaDong(r, thayDoi, cd);
  st.ketQua[i] = moi;
  st.daLuu = false;
  const tr = goc.querySelector(`tr[data-sku="${CSS.escape(r.sku_id)}"]`);
  if (!tr) { veLai(); return; }
  veGiu(tr.parentElement, () => tr.replaceWith(veDongGia(moi, cd)));
  // cập nhật các ô đếm + thanh xuất (cùng kích thước, không đẩy bố cục)
  const dem = goc.querySelector('.luoi-nhom-cp');
  const xuat = goc.querySelector('.thanh-xuat');
  const [demMoi, , xuatMoi] = veDuyet();
  if (dem) dem.replaceWith(demMoi);
  if (xuat) xuat.replaceWith(xuatMoi);
  const nhanLuu = goc.querySelector('.nhan-da-luu-cp');
  if (nhanLuu) nhanLuu.classList.add('nhan-an');
}

function veDongGia(r, cd) {
  const cb = canhBaoCua(r);
  if (st.xem === 'NGOAI') {
    return h('tr', { 'data-sku': r.sku_id }, h('td', { class: 'so' }, r.l30d), h('td', null, oSanPham(r)), h('td', null, r.lyDo), h('td', { class: 'chu-nhat' }, cb.join(' · ')));
  }
  const coThe = !!r.phi;
  const oGia = oSo({
    class: st.sua.get(r.sku_id)?.gia !== undefined && 'o-doi', kieu: 'tien', disabled: !coThe, choPhepTrong: false,
    giaTri: Number.isFinite(r.gia) ? r.gia : null, kiemTra: (so) => (so <= 0 ? 'Giá phải lớn hơn 0' : null),
    'data-o': `gia:${r.sku_id}`, 'aria-label': `Giá campaign SKU ${r.sku_id}`,
    khiLuu: (so) => suaMotDong(r, { gia: so }),
  });
  const oSL = oSo({
    class: ['o-so-nho', st.sua.get(r.sku_id)?.soLuong !== undefined && 'o-doi'], kieu: 'tien', disabled: !coThe, choPhepTrong: false,
    giaTri: r.soLuong ?? null, kiemTra: (so) => (!Number.isInteger(so) ? 'Phải là số nguyên' : null),
    'data-o': `sl:${r.sku_id}`, 'aria-label': `Số lượng SKU ${r.sku_id}`,
    khiLuu: (so) => suaMotDong(r, { soLuong: so }),
  });
  const oLai = (lai, pt) => h('td', { class: ['so', 'o-lai', Number.isFinite(pt) && pt < cd.laiMin && 'o-lo'] },
    Number.isFinite(lai) ? [h('div', { class: lai < 0 ? 'chu-lo' : 'chu-lai' }, dinhDangTien(lai)), h('div', { class: 'chu-pt' }, dinhDangPhanTram(pt))] : '—');
  const daChuyen = r.nhom !== st.xem;
  return h('tr', { 'data-sku': r.sku_id, class: [cb.length && 'dong-canh-bao', daChuyen && 'dong-da-chuyen'] },
    h('td', null, h('input', { type: 'checkbox', class: 'o-chon-sku', 'aria-label': `Chọn SKU ${r.sku_id}`, checked: r.nhom === 'VAO', disabled: !(r.nhom === 'VAO' || r.boChon),
      onchange: (e) => suaMotDong(r, { boChon: !e.target.checked }) })),
    h('td', { class: 'so' }, r.l30d),
    h('td', null, oSanPham(r)),
    h('td', null, oNhanDien(r)),
    h('td', { class: 'so' }, dinhDangTien(r.nd?.von)),
    h('td', { class: 'so' }, h('span', { class: r.canhBao.some((c) => c.includes('bất thường')) ? 'chu-vang' : '' }, dinhDangTien(r.retail))),
    h('td', { class: 'chu-nhat o-khoang' }, r.khoangChu),
    h('td', { class: 'so' }, oGia, r.ghiChuGia?.length ? h('div', { class: 'chu-pt' }, r.ghiChuGia.join(', ')) : null),
    oLai(r.lai?.laiQC, r.lai?.ptQC),
    oLai(r.lai?.laiKhongQC, r.lai?.ptKhongQC),
    h('td', { class: 'so' }, h('div', { class: 'hang hang-sl' }, oSL, h('span', { class: 'chu-nhat' }, `/ ${r.ton}`))),
    h('td', { class: 'o-ly-do' },
      daChuyen ? h('div', { class: 'nhan-nho nhan-tim' }, `→ chuyển sang ${NHAN_NHOM[r.nhom]}`) : null,
      r.nhom === 'LOAI' ? h('div', { class: 'chu-lo' }, r.lyDo) : null,
      cb.map((c) => h('div', { class: 'chu-vang' }, '⚠ ', c))));
}

function veBangGia(trang) {
  const cd = cdTinh();
  const laNgoai = st.xem === 'NGOAI';
  return h('table', { class: 'bang bang-ln bang-cp' },
    h('thead', null, h('tr', null,
      laNgoai ? null : h('th', { scope: 'col', title: 'Chọn đưa vào file đăng ký' }, '✓'),
      h('th', { scope: 'col', class: 'so' }, 'L30D'),
      h('th', { scope: 'col' }, 'Sản phẩm / phân loại'),
      h('th', { scope: 'col' }, laNgoai ? 'Lý do' : 'Nhận diện'),
      laNgoai ? null : [
        h('th', { scope: 'col', class: 'so' }, 'Vốn'),
        h('th', { scope: 'col', class: 'so' }, 'Giá lẻ'),
        h('th', { scope: 'col' }, 'Khoảng giá'),
        h('th', { scope: 'col', class: 'so' }, 'Giá campaign'),
        h('th', { scope: 'col', class: 'so' }, 'Lãi có QC'),
        h('th', { scope: 'col', class: 'so' }, 'Lãi không QC'),
        h('th', { scope: 'col', class: 'so' }, 'SL / tồn'),
      ],
      h('th', { scope: 'col' }, laNgoai ? 'Ghi chú' : st.xem === 'LOAI' ? 'Lý do loại / cảnh báo' : 'Ghi chú / cảnh báo'))),
    h('tbody', null, trang.length ? trang.map((r) => veDongGia(r, cd)) : h('tr', null, h('td', { colspan: 12, class: 'o-trong' }, 'Không có dòng nào.'))));
}

// ---------- Cần gán ----------

function veBangGan(trang) {
  const dsVon = kho.duLieu().GIA_VON;
  const cacNhom = [...new Set(dsVon.map((r) => r.nhom))];
  return h('table', { class: 'bang bang-ln bang-cp' },
    h('thead', null, h('tr', null,
      h('th', { scope: 'col', class: 'so' }, 'L30D'), h('th', { scope: 'col' }, 'Sản phẩm / phân loại'), h('th', { scope: 'col' }, 'Lý do'),
      h('th', { scope: 'col' }, 'Gán: nhóm giá vốn · size · số tranh/tấm'))),
    h('tbody', null, trang.length ? trang.map((r) => {
      const goiY = r.nd?.nhom && cacNhom.includes(r.nd.nhom) ? r.nd.nhom : '';
      const chonNhom = h('select', { class: 'o-nhap o-nhap-nho', 'aria-label': `Nhóm SKU ${r.sku_id}` },
        h('option', { value: '' }, '— nhóm —'), cacNhom.map((n) => h('option', { value: n, selected: n === goiY }, n)));
      const chonSize = h('select', { class: 'o-nhap o-nhap-nho', 'aria-label': `Size SKU ${r.sku_id}` });
      const doSize = () => {
        const cacSize = dsVon.filter((v) => v.nhom === chonNhom.value).map((v) => v.phan_loai);
        const sz = r.nd?.phanLoai || '';
        thayNoiDung(chonSize, h('option', { value: '' }, '— size —'), cacSize.map((s) => h('option', { value: s, selected: s.toLowerCase() === sz.toLowerCase() }, s)));
      };
      chonNhom.addEventListener('change', doSize);
      doSize();
      const oSL = h('input', { class: 'o-nhap o-nhap-nho o-nhap-so', type: 'text', value: String(r.nd?.soLuong || 1), 'aria-label': `Số tranh SKU ${r.sku_id}` });
      const cungPL = st.ketQua.filter((x) => x.nhom === 'GAN' && chuanHoa(x.sp.variation_value) === chuanHoa(r.sp.variation_value) && r.sp.variation_value);
      const cungSP = st.ketQua.filter((x) => x.nhom === 'GAN' && x.product_id === r.product_id);
      const lay = () => {
        const sl = docSo(oSL.value);
        if (!chonNhom.value || !chonSize.value) { thongBao('Chọn nhóm và size trước.', 'tt'); return null; }
        if (!Number.isInteger(sl) || sl < 1) { thongBao('Số tranh/tấm phải là số nguyên ≥ 1.', 'loi'); return null; }
        return { nhom: chonNhom.value, phan_loai: chonSize.value, so_luong: sl };
      };
      return h('tr', null,
        h('td', { class: 'so' }, r.l30d),
        h('td', null, oSanPham(r)),
        h('td', { class: 'chu-lo' }, r.lyDo, canhBaoCua(r).map((c) => h('div', { class: 'chu-vang' }, '⚠ ', c))),
        h('td', null, h('div', { class: 'hang' }, chonNhom, chonSize, '×', oSL),
          h('div', { class: 'hang', style: { marginTop: '4px' } },
            h('button', { class: 'nut nut-nho nut-chinh', onclick: () => { const g = lay(); if (g) ganTay([r], g, 'mot'); } }, 'Gán'),
            cungPL.length > 1 ? h('button', { class: 'nut nut-nho', title: `Các SKU cần gán có cùng phân loại "${r.sp.variation_value}"`, onclick: () => { const g = lay(); if (g) ganTay(cungPL, g, 'cung-phan-loai'); } }, `Áp dụng cùng phân loại (${cungPL.length})`) : null,
            cungSP.length > 1 ? h('button', { class: 'nut nut-nho', title: 'Mọi SKU cần gán cùng Product ID; mỗi SKU giữ size riêng của nó', onclick: () => { const g = lay(); if (g) ganTay(cungSP, g, 'ca-san-pham'); } }, `Gán cho cả sản phẩm (${cungSP.length})`) : null)));
    }) : h('tr', null, h('td', { colspan: 4, class: 'o-trong' }, 'Không có SKU nào cần gán 🎉'))));
}

async function ganTay(cacDong, g, kieu) {
  const dsVon = kho.duLieu().GIA_VON;
  const banGhi = cacDong.map((r) => ({
    sku_id: r.sku_id, product_id: r.product_id, nhom: g.nhom,
    phan_loai: kieu === 'ca-san-pham' ? (sizeRiengTrongNhom(r.sp, g.nhom, dsVon) || g.phan_loai) : g.phan_loai,
    so_luong: g.so_luong, phan_loai_goc: r.sp.variation_value, seller_sku: r.sp.seller_sku,
    ghi_chu: `Gán tay ở campaign "${st.tt.ten}"`,
  }));
  try {
    await kho.ghi('NOI_SKU', banGhi);
    thongBao(`Đã lưu gán tay ${banGhi.length} SKU lên Sheets (lần sau tự dùng).`);
    tinh(false);
  } catch (e) {
    thongBao(`CHƯA lưu được gán tay: ${e.message}`, 'loi');
  }
}

// ---------- Xuất & lưu ----------

/** Tên file an toàn: bỏ dấu tiếng Việt (một số trình duyệt/hệ điều hành đổi tên file có dấu thành "download"). */
function tenFile(s) {
  return String(s || 'campaign').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .replace(/[^\w .()-]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'campaign';
}

async function xuatDangKy() {
  const giu = new Map(st.ketQua.filter((r) => r.nhom === 'VAO').map((r) => [r.soDong, { gia: r.gia, soLuong: r.soLuong }]));
  const { pre } = st.filePrefill;
  try {
    const { duLieu, soDong } = await taoFileDangKy(st.filePrefill.buf, { giuDong: giu, soDongTieuDe: pre.soDongTieuDe, cotGia: pre.cotGia, cotSoLuong: pre.cotSoLuong });
    taiXuong(`${tenFile(st.tt.ten)}_dang-ky.xlsx`, duLieu, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return soDong;
  } catch (e) {
    thongBao(`Không tạo được file đăng ký: ${e.message}`, 'loi');
    return null;
  }
}

function thongTinCP() {
  const cd = st.cd;
  return {
    ten: st.tt.ten, gian: st.tt.gian, bat_dau: ngayVN(st.tt.bat_dau), ket_thuc: ngayVN(st.tt.ket_thuc),
    thangPhiHienThi: hienThiThang(st.tt.thang_phi),
    chienLuocHienThi: `${TEN_CL[cd.chienLuoc]}${cd.chienLuoc === 'A' ? ` (X = ${cd.giamPT}%)` : ''} · làm tròn ${dinhDangTien(+cd.buoc)}`,
    laiMinHienThi: `${cd.laiMin}%`, file_goc: st.filePrefill.ten, xuat_luc: new Date().toLocaleString('vi-VN'),
  };
}

function xuatBaoCao() {
  const X = globalThis.XLSX;
  const bc = bangBaoCao(st.ketQua.map((r) => ({ ...r, canhBao: canhBaoCua(r) })), thongTinCP());
  const wb = X.utils.book_new();
  for (const [ten, mang] of Object.entries(bc)) {
    const ws = X.utils.aoa_to_sheet(mang);
    ws['!cols'] = ten === 'Tổng hợp' ? [{ wch: 30 }, { wch: 40 }, { wch: 14 }] : mang[0].map((c) => ({ wch: /Tên/.test(c) ? 50 : /Ghi chú|Lý do/.test(c) ? 50 : /SKU ID|Product ID/.test(c) ? 21 : 13 }));
    X.utils.book_append_sheet(wb, ws, ten);
  }
  taiXuong(`${tenFile(st.tt.ten)}_bao-cao.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }));
}

async function luuSheets(daXuat = false) {
  const th = tongHop(st.ketQua);
  const cd = st.cd;
  const campaign = {
    id: st.tt.id, ten: st.tt.ten.trim(), gian: st.tt.gian, bat_dau: st.tt.bat_dau, ket_thuc: st.tt.ket_thuc, thang_phi: st.tt.thang_phi,
    chien_luoc: cd.chienLuoc, tham_so: JSON.stringify({ giamPT: cd.giamPT, buoc: +cd.buoc }), lai_toi_thieu: docSo(cd.laiMin),
    file_goc: st.filePrefill.ten, tong_hop: JSON.stringify({ ...th.dem, laiTB: th.laiTB, lyDo: th.lyDo }),
    trang_thai: daXuat ? 'da-xuat' : 'nhap', tao_luc: st.tt.tao_luc,
    ...(daXuat ? { xuat_luc: new Date().toISOString() } : {}),
  };
  const dangLuu = thongBao(`Đang lưu campaign (${dinhDangTien(th.dem.VAO + th.dem.LOAI + th.dem.GAN)} dòng kết quả)…`, 'tt');
  try {
    await kho.luuCampaign(campaign, dongKetQua(st.ketQua));
    cacheKQ.delete(st.tt.id);
    st.daLuu = true;
    veLai();
    return true;
  } catch (e) {
    thongBao(`CHƯA lưu được campaign: ${e.message}`, 'loi');
    return false;
  } finally {
    dangLuu.dong();
  }
}

async function xuatVaLuu() {
  const soDong = await xuatDangKy();
  if (soDong === null) return;
  xuatBaoCao();
  const ok = await luuSheets(true);
  chucMung(ok ? `Đã xuất ${dinhDangTien(soDong)} SKU và lưu campaign!` : `Đã xuất ${dinhDangTien(soDong)} SKU (chưa lưu được lên Sheets)`);
}

