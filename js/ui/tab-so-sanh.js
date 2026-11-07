// Tab "So sánh 2 sàn" (chỉ admin — chỉ admin xem được dữ liệu cả 2 sàn): cùng danh sách sản phẩm với tab Tính lợi nhuận,
// đặt lãi TikTok (1 gian, 1 kịch bản QC) cạnh lãi Shopee (1 gian) → chênh lệch, sàn nào lời hơn.
import { h, thayNoiDung, taiXuong, veGiu } from './dom.js';
import { manTrong } from './linh-vat.js';
import * as kho from '../data/kho.js';
import { soSanhDong, tongHopSoSanh, sapXepSoSanh, bangXuatSoSanh, NGUONG_NGANG } from '../core/so-sanh.js';
import { thangHienTai, hienThiThang } from '../core/phi.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';
import { dinhDangTien, dinhDangPhanTram } from '../core/so.js';

const KHOA_NHAP_LOI_NHUAN = 'bggl.loinhuan.v1'; // bản nháp của tab Tính lợi nhuận (dùng chung danh sách sản phẩm)
const KHOA_CAI_DAT = 'bggl.sosanh.v1';

const st = { gianTT: null, kichBanTT: 'qc', gianSP: null, chieu: null, chiKhac: false };
let goc;

export function taoTabSoSanh(phanTu) {
  goc = phanTu;
  try { Object.assign(st, JSON.parse(localStorage.getItem(KHOA_CAI_DAT) || '{}')); } catch { /* bỏ qua */ }
  if (!['qc', 'khongqc'].includes(st.kichBanTT)) st.kichBanTT = 'qc';
  kho.dangKy((_, ct) => { if (ct.duLieuDoi) veLai(); });
  // Danh sách sản phẩm có thể vừa đổi ở tab Tính lợi nhuận → đọc lại mỗi lần mở tab
  document.addEventListener('bggl:mo-tab', (e) => { if (e.detail === 'so-sanh') veLai(); });
  ve();
}

function luuCaiDat() {
  try { localStorage.setItem(KHOA_CAI_DAT, JSON.stringify(st)); } catch { /* bỏ qua */ }
}

function veLai() { veGiu(goc, ve); }

/** Danh sách sản phẩm đang mở ở tab Tính lợi nhuận (bản nháp trên máy). */
function dsSanPham() {
  try { return (JSON.parse(localStorage.getItem(KHOA_NHAP_LOI_NHUAN) || 'null')?.ds || []).filter((d) => d && d.ten); } catch { return []; }
}

function cauHinh() {
  const du = kho.duLieu();
  const gTT = layDanhSach(du.DANH_MUC, 'GIAN');
  const gSP = layDanhSach(du.DANH_MUC, 'GIAN_SHOPEE');
  if (!gTT.includes(st.gianTT)) st.gianTT = gTT[0];
  if (!gSP.includes(st.gianSP)) st.gianSP = gSP[0];
  return { gTT, gSP, cd: { gianTT: st.gianTT, kichBanTT: st.kichBanTT, dsPhiTT: du.BANG_PHI, gianSP: st.gianSP, dsPhiSP: du.BANG_PHI_SHOPEE || [], thang: thangHienTai() } };
}

const doi = (sua) => { Object.assign(st, sua); luuCaiDat(); veLai(); };
const lop = (x) => (x === null || x === undefined ? '' : x < 0 ? 'chu-lo' : 'chu-lai');

function ve() {
  const ds = dsSanPham();
  const { gTT, gSP, cd } = cauHinh();
  const chon = (nhan, giaTri, cacMuc, khiDoi) => h('label', { class: 'nhan-ngang' }, nhan, ' ',
    h('select', { class: 'o-nhap', 'aria-label': nhan, onchange: (e) => khiDoi(e.target.value) },
      cacMuc.map(([k, chu]) => h('option', { value: k, selected: k === giaTri }, chu))));

  const dau = h('div', { class: 'the' },
    h('div', { class: 'the-dau' },
      h('div', null, h('h2', null, 'So sánh 2 sàn'),
        h('p', { class: 'mo-ta' }, `Cùng giá vốn, cùng giá bán: lãi ở TikTok so với Shopee, theo bảng phí đang áp dụng (tháng ${hienThiThang(cd.thang)}). Danh sách sản phẩm lấy từ tab Tính lợi nhuận.`)),
      h('div', { class: 'hang-nut' },
        h('button', { class: 'nut', onclick: () => document.querySelector('[data-tab="loi-nhuan"]')?.click() }, '🧮 Sửa danh sách ở Tính lợi nhuận'),
        h('button', { class: 'nut', onclick: () => xuatExcel(ds, cd), disabled: !ds.length }, '📤 Xuất Excel'))),
    h('div', { class: 'luoi-so-sanh-chon' },
      h('div', { class: 'o-chon-san o-chon-tiktok' }, h('b', null, 'TikTok'),
        chon('Gian TikTok', st.gianTT, gTT.map((g) => [g, g]), (v) => doi({ gianTT: v })),
        chon('Kịch bản', st.kichBanTT, [['qc', 'Có QC'], ['khongqc', 'Không QC']], (v) => doi({ kichBanTT: v }))),
      h('div', { class: 'o-chon-san o-chon-shopee' }, h('b', null, 'Shopee'),
        chon('Gian Shopee', st.gianSP, gSP.map((g) => [g, g]), (v) => doi({ gianSP: v })))),
    h('label', { class: 'hop-kiem hop-kiem-ngang' },
      h('input', { type: 'checkbox', checked: st.chiKhac, onchange: (e) => doi({ chiKhac: e.target.checked }) }),
      ` Ẩn dòng "ngang" (chênh dưới ${dinhDangTien(NGUONG_NGANG)} đ)`));

  if (!ds.length) {
    thayNoiDung(goc, dau, h('div', { class: 'the' }, manTrong('Chưa có sản phẩm',
      'Nhập hoặc mở bảng tính ở tab Tính lợi nhuận — tab này dùng chung danh sách sản phẩm đó.',
      h('button', { class: 'nut nut-chinh', onclick: () => document.querySelector('[data-tab="loi-nhuan"]')?.click() }, '🧮 Mở Tính lợi nhuận'))));
    return;
  }
  thayNoiDung(goc, dau, veTongHop(ds, cd, gTT, gSP), veBang(ds, cd, gTT, gSP));
}

function veTongHop(ds, cd, gTT, gSP) {
  const t = tongHopSoSanh(ds, cd);
  const o = (nhan, so, chan, them) => h('div', { class: ['o-tong', them] }, h('div', { class: 'o-tong-nhan' }, nhan), h('div', { class: 'o-tong-so' }, so), chan ? h('div', { class: 'o-tong-chan' }, chan) : null);
  return h('div', { class: 'luoi-tong-ket' },
    o('Sản phẩm so được', `${t.soSanhDuoc} / ${t.soDong}`, t.soDong > t.soSanhDuoc ? `${t.soDong - t.soSanhDuoc} dòng thiếu giá bán / chưa có phí` : 'Đủ dữ liệu cả 2 sàn'),
    o(`TikTok · ${cd.gianTT} lời hơn`, `${t.tiktok} SP`, t.tbTT === null ? null : h('span', { class: lop(t.tbTT) }, `Lãi TB ${dinhDangTien(t.tbTT)} đ`), `gian-${mauGian(cd.gianTT, gTT)}`),
    o(`Shopee · ${cd.gianSP} lời hơn`, `${t.shopee} SP`, t.tbSP === null ? null : h('span', { class: lop(t.tbSP) }, `Lãi TB ${dinhDangTien(t.tbSP)} đ`), `gian-${mauGian(cd.gianSP, gSP)}`),
    o('Ngang nhau', `${t.ngang} SP`, `Chênh dưới ${dinhDangTien(NGUONG_NGANG)} đ`),
    o('Chênh lệch TB / đơn', t.tbChenh === null ? '—' : `${t.tbChenh > 0 ? '+' : ''}${dinhDangTien(t.tbChenh)} đ`,
      t.tbChenh === null ? null : Math.abs(t.tbChenh) < NGUONG_NGANG ? 'Hai sàn ngang nhau' : t.tbChenh > 0 ? 'Shopee lời hơn' : 'TikTok lời hơn'));
}

function veBang(ds, cd, gTT, gSP) {
  const chiSo = sapXepSoSanh(ds, cd, st.chieu).filter((i) => !st.chiKhac || soSanhDong(ds[i], cd).nen !== 'ngang');
  const oLai = (x) => (x.trangThai === 'ok'
    ? h('td', { class: ['so', 'o-lai', x.lai < 0 && 'o-lo'] }, h('div', { class: lop(x.lai) }, dinhDangTien(x.lai)), h('div', { class: 'chu-pt' }, dinhDangPhanTram(x.pt)))
    : h('td', { class: 'so o-lai chu-nhat' }, x.trangThai === 'thieu-phi' ? 'chưa có phí' : '—'));
  const NEN = { tiktok: ['TikTok', 'nhan-nen-tiktok'], shopee: ['Shopee', 'nhan-nen-shopee'], ngang: ['Ngang', 'nhan-tim'] };
  const muiTen = st.chieu < 0 ? '↓' : st.chieu > 0 ? '↑' : '↕';
  return h('div', { class: 'the the-bang' },
    h('div', { class: 'khung-bang khung-bang-cao', 'data-cuon': 'so-sanh' },
      h('table', { class: 'bang bang-so-sanh' },
        h('thead', null, h('tr', null,
          h('th', { class: 'so cot-stt', scope: 'col' }, '#'),
          h('th', { scope: 'col' }, 'Tên sản phẩm'), h('th', { scope: 'col' }, 'Phân loại'), h('th', { scope: 'col' }, 'Ngành'),
          h('th', { class: 'so', scope: 'col' }, 'Giá vốn'), h('th', { class: 'so', scope: 'col' }, 'Giá bán'),
          h('th', { class: ['so', `gian-${mauGian(cd.gianTT, gTT)}`], scope: 'col' }, `TikTok · ${cd.gianTT}`, h('br'), h('small', null, cd.kichBanTT === 'qc' ? 'có QC' : 'không QC')),
          h('th', { class: ['so', `gian-${mauGian(cd.gianSP, gSP)}`], scope: 'col' }, `Shopee · ${cd.gianSP}`),
          h('th', { class: 'so th-sap-xep', scope: 'col', 'aria-sort': st.chieu < 0 ? 'descending' : st.chieu > 0 ? 'ascending' : 'none' },
            h('button', { class: 'nut-sap-xep', title: 'Bấm để sắp xếp theo chênh lệch', onclick: () => doi({ chieu: st.chieu === null ? -1 : st.chieu < 0 ? 1 : null }) },
              'Chênh lệch', h('br'), h('small', null, 'Shopee − TikTok '), h('span', { class: 'mui-ten' }, muiTen))),
          h('th', { scope: 'col' }, 'Nên bán'))),
        h('tbody', null, chiSo.length ? chiSo.map((i) => {
          const d = ds[i];
          const r = soSanhDong(d, cd);
          const [chu, lopNen] = r.nen ? NEN[r.nen] : ['—', ''];
          return h('tr', { class: [r.tiktok.lai < 0 && r.shopee.lai < 0 && 'dong-lo'] },
            h('td', { class: 'so cot-stt chu-nhat' }, i + 1),
            h('td', null, d.ten), h('td', null, d.phan_loai), h('td', null, d.nganh),
            h('td', { class: 'so' }, Number.isFinite(d.gia_von) ? dinhDangTien(d.gia_von) : '—'),
            h('td', { class: 'so' }, Number.isFinite(d.gia_ban) ? dinhDangTien(d.gia_ban) : '—'),
            oLai(r.tiktok), oLai(r.shopee),
            // màu trung tính: âm chỉ có nghĩa TikTok lời hơn, KHÔNG phải lỗ
            h('td', { class: 'so o-chenh', title: r.nen ? { tiktok: 'TikTok lời hơn', shopee: 'Shopee lời hơn', ngang: 'Ngang nhau' }[r.nen] : null },
              r.chenh === null ? '—' : `${r.chenh > 0 ? '+' : ''}${dinhDangTien(r.chenh)}`),
            h('td', null, r.nen ? h('span', { class: ['nhan-nho', 'nhan-nen', lopNen] }, chu) : h('span', { class: 'chu-nhat' }, '—')));
        }) : h('tr', null, h('td', { colspan: 10, class: 'o-trong' }, 'Không có dòng nào (đang ẩn dòng ngang).'))))),
    h('p', { class: 'goi-y' }, `${chiSo.length} / ${ds.length} dòng. Chênh lệch dương: Shopee lời hơn; âm: TikTok lời hơn.`));
}

function xuatExcel(ds, cd) {
  const X = globalThis.XLSX;
  const ws = X.utils.aoa_to_sheet(bangXuatSoSanh(ds, cd));
  ws['!cols'] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 11 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 10 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'So sánh 2 sàn');
  taiXuong(`so-sanh-2-san_${thangHienTai()}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }));
}
