// Tab Tính lợi nhuận: bảng sản phẩm, lãi có QC / không QC theo từng gian, tổng kết,
// nhập/xuất Excel, lưu "bảng tính" lên Google Sheets.
import { h, thayNoiDung, xacNhan, chonFile, ganKeoTha, taiXuong, nhapChu } from './dom.js';
import { thongBao } from './thong-bao.js';
import { manTrong, linhVat, chucMung } from './linh-vat.js';
import * as kho from '../data/kho.js';
import { docBangSanPham, laiTaiGian, locVaSapXep, tongKet, bangXuat, TIEU_DE_MAU } from '../core/bang-tinh.js';
import { thangHienTai, hienThiThang, chuanHoaThang } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangPhanTram } from '../core/so.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';
import { docBang } from '../excel/doc.js';

const KHOA_NHAP = 'bggl.loinhuan.v1';
const MOI_TRANG = 100;

let soId = 0;
const moiId = () => ++soId;

const st = {
  ds: [],              // { _id, ten, phan_loai, nganh, gia_von, gia_ban }
  bangTinh: null,      // { id, ten } khi đang mở bảng tính đã lưu
  thayDoi: false,      // có thay đổi chưa lưu lên Sheets
  thang: thangHienTai(),
  gianXem: null,       // null = tất cả gian
  nganhMacDinh: '',
  tim: '',
  chiLo: false,
  sapXep: null,        // { gian, kichBan, chieu }
  trang: 0,
};
let goc;

export function taoTabLoiNhuan(phanTu) {
  goc = phanTu;
  docNhap();
  kho.dangKy(() => ve());
  ve();
}

// ---------- lưu tạm trên máy (bản nháp) ----------

function docNhap() {
  try {
    const d = JSON.parse(localStorage.getItem(KHOA_NHAP) || 'null');
    if (!d) return;
    st.ds = (d.ds || []).map((r) => ({ ...r, _id: moiId() }));
    Object.assign(st, { bangTinh: d.bangTinh || null, thayDoi: !!d.thayDoi, thang: chuanHoaThang(d.thang) || st.thang, gianXem: d.gianXem || null, nganhMacDinh: d.nganhMacDinh || '' });
  } catch { /* bản nháp hỏng thì bỏ qua */ }
}

function luuNhap() {
  try {
    localStorage.setItem(KHOA_NHAP, JSON.stringify({
      ds: st.ds.map(({ _id, ...r }) => r), bangTinh: st.bangTinh, thayDoi: st.thayDoi, thang: st.thang, gianXem: st.gianXem, nganhMacDinh: st.nganhMacDinh,
    }));
  } catch { /* hết bộ nhớ trình duyệt: vẫn dùng được, chỉ không giữ nháp */ }
}

function daSua() {
  st.thayDoi = true;
  luuNhap();
}

// ---------- dữ liệu dẫn xuất ----------

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
  const oDangGo = document.activeElement?.dataset?.o; // giữ con trỏ khi vẽ lại
  const gians = gianDangXem();
  const dsPhi = kho.duLieu().BANG_PHI;

  const the = h('div', { class: 'the' }, veDau(), veDieuKhien(gians));
  ganKeoTha(the, napFile);
  thayNoiDung(goc, the, st.ds.length ? [veTongKet(gians, dsPhi), veBang(gians, dsPhi)] : veTrong());

  const o = oDangGo && goc.querySelector(`[data-o="${oDangGo}"]`);
  if (o) {
    o.focus();
    if (o.setSelectionRange && o.type !== 'number') { const n = o.value.length; o.setSelectionRange(n, n); }
  }
}

function veDau() {
  const ten = st.bangTinh ? st.bangTinh.ten : 'Bảng tính mới';
  return h('div', { class: 'the-dau' },
    h('div', null,
      h('h2', null, 'Tính lợi nhuận'),
      h('p', { class: 'mo-ta' }, '📄 ', h('b', null, ten),
        st.thayDoi ? h('span', { class: 'nhan-nho nhan-vang' }, 'chưa lưu lên Sheets') : st.bangTinh ? h('span', { class: 'nhan-nho nhan-xanh' }, 'đã lưu') : null,
        h('span', { class: 'chu-nhat' }, ` · ${st.ds.length} dòng · bản nháp tự lưu trên máy này`))),
    h('div', { class: 'hang-nut' },
      h('button', { class: 'nut', onclick: moDanhSach }, '📂 Mở bảng tính'),
      h('button', { class: 'nut nut-chinh', onclick: () => luuLenSheets(false), disabled: !st.ds.length }, '💾 Lưu lên Sheets'),
      st.bangTinh ? h('button', { class: 'nut', onclick: () => luuLenSheets(true), disabled: !st.ds.length }, 'Lưu thành bản mới') : null,
      h('button', { class: 'nut', onclick: taoMoi, disabled: !st.ds.length && !st.bangTinh }, '🧹 Bảng mới')));
}

function veDieuKhien(gians) {
  const tat = tatCaGian();
  const oThang = h('input', { type: 'month', class: 'o-nhap', value: st.thang, 'aria-label': 'Tháng phí',
    onchange: (e) => { const t = chuanHoaThang(e.target.value); if (t) { st.thang = t; luuNhap(); ve(); } else e.target.value = st.thang; } });
  const chonNganh = h('select', { class: 'o-nhap', 'aria-label': 'Ngành mặc định', onchange: (e) => { st.nganhMacDinh = e.target.value; luuNhap(); } },
    dsNganh().map((n) => h('option', { value: n, selected: n === nganhMacDinh() }, n)));
  const oTim = h('input', { type: 'search', class: 'o-nhap', placeholder: 'Tìm tên, phân loại…', value: st.tim, 'aria-label': 'Tìm', 'data-o': 'tim',
    oninput: (e) => { st.tim = e.target.value; st.trang = 0; ve(); } });

  return h('div', { class: 'dieu-khien' },
    h('div', { class: 'hang hang-dk' },
      h('label', { class: 'nhan-ngang' }, 'Tháng phí ', oThang),
      h('span', { class: 'nhan-ngang' }, 'Gian hiển thị'),
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
            ve();
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
        h('input', { type: 'checkbox', checked: st.chiLo, onchange: (e) => { st.chiLo = e.target.checked; st.trang = 0; ve(); } }), ' Chỉ dòng lỗ'),
      st.sapXep ? h('span', { class: 'chip chip-sap-xep' },
        `Sắp xếp: ${st.sapXep.gian} · ${st.sapXep.kichBan === 'qc' ? 'có QC' : 'không QC'} ${st.sapXep.chieu < 0 ? '↓' : '↑'}`,
        h('button', { class: 'chip-xoa', 'aria-label': 'Bỏ sắp xếp', onclick: () => { st.sapXep = null; ve(); } }, '×')) : null));
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
  const t = tongKet(st.ds, gians, dsPhi, st.thang);
  const tatGian = tatCaGian();
  return h('div', { class: 'luoi-tong-ket' },
    h('div', { class: 'o-tong' },
      h('div', { class: 'o-tong-nhan' }, 'Sản phẩm'),
      h('div', { class: 'o-tong-so' }, dinhDangTien(t.soDong)),
      t.thieuGiaBan ? h('div', { class: 'chu-nhat' }, `${t.thieuGiaBan} dòng chưa có giá bán`) : h('div', { class: 'chu-nhat' }, `Phí tháng ${hienThiThang(st.thang)}`)),
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
          x.thieuPhi ? h('span', null, ` · ${x.thieuPhi} dòng chưa có phí`) : null));
    }));
}

const lop = (x) => (x === null || x === undefined ? '' : x < 0 ? 'chu-lo' : 'chu-lai');

function veBang(gians, dsPhi) {
  const tatGian = tatCaGian();
  const chiSo = locVaSapXep(st.ds, { gians, dsPhi, thang: st.thang, chiLo: st.chiLo, tim: st.tim, sapXep: st.sapXep });
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
        ve();
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
    h('div', { class: 'khung-bang khung-bang-cao' },
      h('table', { class: 'bang bang-ln' }, dauBang,
        h('tbody', null, hang.length ? hang : h('tr', null, h('td', { colspan: soCot, class: 'o-trong' }, st.chiLo ? 'Không có dòng lỗ nào 🎉' : 'Không có dòng nào khớp.'))))),
    h('div', { class: 'hang hang-trang' },
      h('span', { class: 'chu-nhat' }, chiSo.length === st.ds.length ? `${st.ds.length} dòng` : `Đang hiện ${chiSo.length} / ${st.ds.length} dòng`),
      h('span', { class: 'gian-cach' }),
      soTrang > 1 ? [
        h('button', { class: 'nut nut-nho', disabled: st.trang === 0, onclick: () => { st.trang--; ve(); } }, '‹ Trước'),
        h('span', { class: 'chu-nhat' }, `Trang ${st.trang + 1} / ${soTrang}`),
        h('button', { class: 'nut nut-nho', disabled: st.trang >= soTrang - 1, onclick: () => { st.trang++; ve(); } }, 'Sau ›'),
      ] : null));
}

function veDong(i, gians, dsPhi) {
  const d = st.ds[i];
  const doi = (truong, giaTri) => { d[truong] = giaTri; daSua(); ve(); };
  const oChu = (truong, rong) => h('input', {
    class: 'o-bang', type: 'text', value: d[truong] ?? '', title: d[truong] ?? '', 'data-o': `${d._id}:${truong}`, style: { minWidth: rong },
    'aria-label': `${truong === 'ten' ? 'Tên' : 'Phân loại'} dòng ${i + 1}`,
    onchange: (e) => doi(truong, e.target.value.trim()),
  });
  const oSo = (truong, nhan) => h('input', {
    class: ['o-so', truong === 'gia_ban' && !Number.isFinite(d.gia_ban) && 'o-thieu'], type: 'text', inputmode: 'numeric',
    value: Number.isFinite(d[truong]) ? dinhDangTien(d[truong]) : '', placeholder: truong === 'gia_ban' ? 'nhập giá' : '',
    'data-o': `${d._id}:${truong}`, 'aria-label': `${nhan} dòng ${i + 1}`,
    onchange: (e) => {
      const tho = e.target.value.trim();
      const so = tho === '' ? null : docSo(tho);
      if (tho !== '' && (so === null || so < 0)) { e.target.classList.add('o-loi'); thongBao(`"${tho}" không phải số hợp lệ.`, 'loi'); return; }
      doi(truong, so);
    },
  });
  const nganhs = dsNganh();
  const chonNganh = h('select', { class: 'o-bang o-chon', 'data-o': `${d._id}:nganh`, 'aria-label': `Ngành dòng ${i + 1}`, onchange: (e) => doi('nganh', e.target.value) },
    (nganhs.includes(d.nganh) ? nganhs : [d.nganh, ...nganhs]).map((n) => h('option', { value: n, selected: n === d.nganh }, n || '—')));

  const oLai = (r, kichBan) => {
    if (r.trangThai === 'thieu-gia') return h('td', { class: 'so o-lai chu-nhat' }, '—');
    if (r.trangThai === 'thieu-phi') return h('td', { class: 'so o-lai chu-nhat', title: `Chưa có bộ phí ${d.nganh} cho gian này (≤ ${hienThiThang(st.thang)})` }, 'chưa có phí');
    const lai = kichBan === 'qc' ? r.laiQC : r.laiKhongQC;
    const pt = kichBan === 'qc' ? r.ptQC : r.ptKhongQC;
    return h('td', { class: ['so', 'o-lai', lai < 0 ? 'o-lo' : ''] },
      h('div', { class: lop(lai) }, dinhDangTien(lai)),
      h('div', { class: 'chu-pt' }, dinhDangPhanTram(pt)));
  };

  return h('tr', { class: gians.some((g) => { const r = laiTaiGian(d, g, dsPhi, st.thang); return r.trangThai === 'ok' && (r.laiQC < 0 || r.laiKhongQC < 0); }) ? 'dong-lo' : '' },
    h('td', { class: 'so cot-stt chu-nhat' }, i + 1),
    h('td', null, oChu('ten', '190px')),
    h('td', null, oChu('phan_loai', '64px')),
    h('td', null, chonNganh),
    h('td', { class: 'so' }, oSo('gia_von', 'Giá vốn')),
    h('td', { class: 'so' }, oSo('gia_ban', 'Giá bán')),
    gians.map((g) => { const r = laiTaiGian(d, g, dsPhi, st.thang); return [oLai(r, 'qc'), oLai(r, 'khongqc')]; }),
    h('td', { class: 'o-thao-tac' },
      h('button', { class: 'nut-icon', title: 'Nhân bản dòng', 'aria-label': `Nhân bản dòng ${i + 1}`, onclick: () => { st.ds.splice(i + 1, 0, { ...d, _id: moiId() }); daSua(); ve(); } }, '⧉'),
      h('button', { class: 'nut-icon', title: 'Xóa dòng', 'aria-label': `Xóa dòng ${i + 1}`, onclick: () => { st.ds.splice(i, 1); daSua(); ve(); } }, '🗑')));
}

// ---------- thao tác ----------

function themDong() {
  st.ds.push({ _id: moiId(), ten: 'Sản phẩm mới', phan_loai: '', nganh: nganhMacDinh(), gia_von: null, gia_ban: null });
  st.tim = '';
  st.chiLo = false;
  st.sapXep = null;
  st.trang = Math.floor((st.ds.length - 1) / MOI_TRANG);
  daSua();
  ve();
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
  ve();
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
  const ws = X.utils.aoa_to_sheet(bangXuat(st.ds, gians, dsPhi, st.thang));
  ws['!cols'] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 11 }, ...gians.flatMap(() => [{ wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 9 }])];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const homNay = new Date();
  const thongTin = X.utils.aoa_to_sheet([
    ['Bảng tính', st.bangTinh ? st.bangTinh.ten : 'Bảng tính mới'],
    ['Tháng phí', hienThiThang(st.thang)],
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
  if (st.thayDoi && st.ds.length && !(await xacNhan('Bảng hiện tại có thay đổi chưa lưu lên Sheets. Bỏ và tạo bảng mới?', { nutDongY: 'Bỏ thay đổi', nguyHiem: true }))) return;
  Object.assign(st, { ds: [], bangTinh: null, thayDoi: false, tim: '', chiLo: false, sapXep: null, trang: 0 });
  luuNhap();
  ve();
}

async function luuLenSheets(banMoi) {
  if (!st.ds.length) return;
  let { bangTinh } = st;
  if (!bangTinh || banMoi) {
    const ten = await nhapChu('Đặt tên cho bảng tính:', bangTinh && banMoi ? `${bangTinh.ten} (bản sao)` : `Bảng tính ${hienThiThang(st.thang)}`, { nutDongY: 'Lưu' });
    if (!ten) return;
    bangTinh = { id: `bt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ten };
  }
  const dangLuu = thongBao(`Đang lưu "${bangTinh.ten}" (${st.ds.length} dòng)…`, 'tt');
  try {
    const kq = await kho.luuBangTinh({ id: bangTinh.id, ten: bangTinh.ten, gian_hien_thi: gianDangXem().join(','), thang_phi: st.thang },
      st.ds.map(({ _id, ...r }) => r));
    st.bangTinh = { id: kq.id, ten: kq.ten };
    st.thayDoi = false;
    luuNhap();
    ve();
    chucMung(`Đã lưu "${kq.ten}" lên Google Sheets!`);
  } catch (e) {
    thongBao(`CHƯA lưu được: ${e.message}`, 'loi');
  } finally {
    dangLuu.dong();
  }
}

function moDanhSach() {
  const ds = [...kho.duLieu().BANG_TINH].sort((a, b) => String(b.cap_nhat_luc).localeCompare(String(a.cap_nhat_luc)));
  const ngay = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const dlg = h('dialog', { class: 'hop-thoai hop-thoai-rong', 'aria-labelledby': 'bt-tieu-de' },
    h('div', { class: 'hop-thoai-dau' },
      h('h2', { id: 'bt-tieu-de' }, '📂 Bảng tính đã lưu'),
      h('button', { class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
    ds.length ? h('div', { class: 'khung-bang khung-bang-vua' }, h('table', { class: 'bang' },
      h('thead', null, h('tr', null, h('th', null, 'Tên'), h('th', { class: 'so' }, 'Số dòng'), h('th', null, 'Tháng phí'), h('th', null, 'Cập nhật'), h('th', null, ''))),
      h('tbody', null, ds.map((b) => h('tr', { class: st.bangTinh?.id === b.id ? 'dong-dang-mo' : '' },
        h('td', null, h('b', null, b.ten), st.bangTinh?.id === b.id ? h('span', { class: 'nhan-nho nhan-tim' }, 'đang mở') : null),
        h('td', { class: 'so' }, dinhDangTien(b.so_dong)),
        h('td', null, hienThiThang(b.thang_phi)),
        h('td', { class: 'chu-nhat' }, ngay(b.cap_nhat_luc)),
        h('td', { class: 'o-thao-tac' },
          h('button', { class: 'nut nut-nho nut-chinh', onclick: () => moBangTinh(b, dlg) }, 'Mở'),
          h('button', { class: 'nut-icon', title: 'Xóa', 'aria-label': `Xóa ${b.ten}`, onclick: () => xoaBangTinh(b, dlg) }, '🗑')))))))
      : manTrong('Chưa có bảng tính nào', 'Nhập sản phẩm rồi bấm "💾 Lưu lên Sheets" để lưu và mở lại trên máy khác.'));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

async function moBangTinh(b, dlg) {
  if (st.thayDoi && st.ds.length && !(await xacNhan('Bảng hiện tại có thay đổi chưa lưu lên Sheets. Bỏ và mở bảng khác?', { nutDongY: 'Bỏ thay đổi', nguyHiem: true }))) return;
  try {
    const dong = await kho.docBangTinh(b.id);
    const tat = tatCaGian();
    const gianLuu = String(b.gian_hien_thi || '').split(',').filter((g) => tat.includes(g));
    Object.assign(st, {
      ds: dong.map((r) => ({ ...r, _id: moiId() })), bangTinh: { id: b.id, ten: b.ten }, thayDoi: false,
      thang: chuanHoaThang(b.thang_phi) || st.thang, gianXem: gianLuu.length && gianLuu.length < tat.length ? gianLuu : null,
      tim: '', chiLo: false, sapXep: null, trang: 0,
    });
    luuNhap();
    dlg.close();
    ve();
    thongBao(`Đã mở "${b.ten}" (${dong.length} dòng).`);
  } catch (e) {
    thongBao(`Không mở được: ${e.message}`, 'loi');
  }
}

async function xoaBangTinh(b, dlg) {
  if (!(await xacNhan(`Xóa bảng tính "${b.ten}" khỏi Google Sheets? Thao tác được ghi vào LICH_SU.`, { nutDongY: 'Xóa', nguyHiem: true }))) return;
  try {
    await kho.xoaBangTinh(b.id);
    if (st.bangTinh?.id === b.id) { st.bangTinh = null; st.thayDoi = st.ds.length > 0; luuNhap(); ve(); }
    dlg.close();
    thongBao(`Đã xóa "${b.ten}".`);
    moDanhSach();
  } catch (e) {
    thongBao(`Chưa xóa được: ${e.message}`, 'loi');
  }
}
