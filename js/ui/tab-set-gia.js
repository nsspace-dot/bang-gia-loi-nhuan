// Tab Set giá: từ giá vốn → giá đề xuất theo mức lãi mong muốn, kiểm tra bậc giá, xuất file.
import { h, thayNoiDung, chonFile, ganKeoTha, taiXuong } from './dom.js';
import { thongBao } from './thong-bao.js';
import { manTrong, linhVat, chucMung } from './linh-vat.js';
import * as kho from '../data/kho.js';
import { tinhSetGia, chiTietTaiGia, kiemTraBacGia, bangXuatTheoMau } from '../core/set-gia.js';
import { docBangGiaVon, khoaVon } from '../core/gia-von.js';
import { docPhanLoai } from '../core/size.js';
import { chonBoPhi, thangHienTai, hienThiThang } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangPhanTram } from '../core/so.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';
import { docBang } from '../excel/doc.js';

const KHOA_CD = 'bggl.setgia.v1';
const st = {
  nguon: 'luu',          // 'luu' = giá vốn đã lưu, 'file' = file thả vào
  nhomChon: [],
  gian: '',
  kieuLai: 'pt',         // 'pt' | 'dong'
  lai: '20',             // chuỗi người dùng gõ (pt: 20 = 20%)
  kichBan: 'ca2',
  lamTron: 'len1000',
  dsFile: [],
  tenFile: '',
  giaChot: {},           // khoaVon → giá chốt tay
};
let goc;

export function taoTabSetGia(phanTu) {
  goc = phanTu;
  try { Object.assign(st, JSON.parse(localStorage.getItem(KHOA_CD) || '{}')); } catch { /* bỏ qua */ }
  kho.dangKy(() => ve());
  ve();
}

function luuCaiDat() {
  try {
    const { nguon, nhomChon, gian, kieuLai, lai, kichBan, lamTron } = st;
    localStorage.setItem(KHOA_CD, JSON.stringify({ nguon, nhomChon, gian, kieuLai, lai, kichBan, lamTron }));
  } catch { /* bỏ qua */ }
}

const thangNay = () => thangHienTai();
const doi = (thayDoi) => { Object.assign(st, thayDoi); luuCaiDat(); ve(); };

function thuTuNhom(ds) {
  const m = new Map();
  ds.forEach((r) => { if (!m.has(r.nhom)) m.set(r.nhom, m.size); });
  return m;
}

function sapXep(ds) {
  const tt = thuTuNhom(ds);
  const dt = (r) => { const s = docPhanLoai(r.phan_loai); return s ? s.rong * s.cao * (s.nhan || 1) : Infinity; };
  return [...ds].sort((a, b) => tt.get(a.nhom) - tt.get(b.nhom) || dt(a) - dt(b));
}

function giaTriLai() {
  const so = docSo(st.lai);
  if (so === null || so < 0) return null;
  return st.kieuLai === 'pt' ? so / 100 : so;
}

// ---------- vẽ ----------

function ve() {
  const oDangGo = document.activeElement?.dataset?.o;
  const gians = layDanhSach(kho.duLieu().DANH_MUC, 'GIAN');
  if (!gians.includes(st.gian)) st.gian = gians.includes('Tường Vip') ? 'Tường Vip' : gians[0];
  const daLuu = kho.duLieu().GIA_VON;
  const cacNhom = [...thuTuNhom(sapXep(daLuu)).keys()];
  st.nhomChon = st.nhomChon.filter((n) => cacNhom.includes(n));

  const nguonVon = st.nguon === 'file' ? st.dsFile : daLuu.filter((r) => st.nhomChon.includes(r.nhom));
  const lai = giaTriLai();
  const dsPhi = kho.duLieu().BANG_PHI;
  const layPhi = (nganh) => chonBoPhi(dsPhi, st.gian, nganh, thangNay());
  const cd = { kieuLai: st.kieuLai, lai: lai ?? 0, kichBan: st.kichBan, lamTron: st.lamTron };
  const ketQua = lai === null ? [] : tinhSetGia(sapXep(nguonVon), layPhi, cd);
  const giaCua = (d) => st.giaChot[khoaVon(d.nhom, d.phan_loai)] ?? d.giaDeXuat;
  // Tham chiếu Bộ 1 tấm (để so Bộ 3 tấm) khi nhóm Bộ 1 tấm không nằm trong lựa chọn
  const thamChieu = lai === null ? [] : tinhSetGia(daLuu.filter((r) => r.nhom === 'Bộ 1 tấm'), layPhi, cd).filter((d) => !d.loi).map((d) => ({ d, gia: d.giaDeXuat }));
  const canhBao = kiemTraBacGia(ketQua, giaCua, thamChieu);

  thayNoiDung(goc,
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null,
          h('h2', null, 'Set giá'),
          h('p', { class: 'mo-ta' }, `Tính giá bán từ giá vốn theo mức lãi mong muốn · phí đang áp dụng (tháng ${hienThiThang(thangNay())})`)),
        h('div', { class: 'hang-nut' },
          Object.keys(st.giaChot).length ? h('button', { class: 'nut', onclick: () => doi({ giaChot: {} }) }, '↺ Bỏ giá chốt tay') : null,
          h('button', { class: 'nut nut-chinh', disabled: !ketQua.some((d) => !d.loi), onclick: () => xuatFile(ketQua, giaCua, canhBao) }, '📤 Xuất file'))),
      veCaiDat(gians, cacNhom, lai)),
    ketQua.length ? [veTongKet(ketQua, giaCua, canhBao), veBang(ketQua, giaCua, canhBao)] : veTrong(daLuu, lai));

  const o = oDangGo && goc.querySelector(`[data-o="${oDangGo}"]`);
  if (o) { o.focus(); if (o.setSelectionRange) { const n = o.value.length; o.setSelectionRange(n, n); } }
}

function nhomNut(tuyChon, giaTri, khiChon, nhan) {
  return h('div', { class: 'nhom-nut', role: 'group', 'aria-label': nhan },
    tuyChon.map(([gt, chu]) => h('button', { class: ['nut-chon', gt === giaTri && 'dang-chon'], 'aria-pressed': String(gt === giaTri), onclick: () => khiChon(gt) }, chu)));
}

function veCaiDat(gians, cacNhom, lai) {
  const oLai = h('input', {
    class: ['o-nhap', 'o-nhap-so', lai === null && 'o-loi'], type: 'text', inputmode: 'decimal', value: st.lai, 'data-o': 'lai', 'aria-label': 'Mức lãi mong muốn',
    oninput: (e) => { st.lai = e.target.value; luuCaiDat(); ve(); },
  });

  const vungFile = h('button', { class: 'vung-tha vung-tha-nho', onclick: async () => { const f = await chonFile(); if (f) napFile([f]); } },
    linhVat('nho'),
    h('span', null, st.tenFile ? [h('b', null, st.tenFile), ` · ${st.dsFile.length} dòng — bấm để đổi file`] : [h('b', null, 'Thả file giá vốn vào đây'), h('br'), 'cùng mẫu với tab Giá vốn (không lưu lên Sheets)']));
  ganKeoTha(vungFile, napFile);

  return h('div', { class: 'luoi-cai-dat' },
    h('div', { class: 'o-cai-dat o-cai-dat-rong' },
      h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '1'), 'Giá vốn'),
      nhomNut([['luu', '📦 Giá vốn đã lưu'], ['file', '📄 Thả file giá vốn']], st.nguon, (v) => doi({ nguon: v, giaChot: {} }), 'Nguồn giá vốn'),
      st.nguon === 'luu'
        ? (cacNhom.length
          ? h('div', { class: 'ds-chip' },
            cacNhom.map((n) => {
              const chon = st.nhomChon.includes(n);
              return h('button', { class: ['chip chip-loc', chon && 'dang-chon'], 'aria-pressed': String(chon),
                onclick: () => doi({ nhomChon: chon ? st.nhomChon.filter((x) => x !== n) : cacNhom.filter((x) => st.nhomChon.includes(x) || x === n) }) }, chon ? '✓ ' : '', n);
            }),
            h('button', { class: 'chip chip-loc', onclick: () => doi({ nhomChon: st.nhomChon.length === cacNhom.length ? [] : [...cacNhom] }) }, st.nhomChon.length === cacNhom.length ? 'Bỏ chọn hết' : 'Chọn tất cả'))
          : h('p', { class: 'goi-y' }, 'Chưa có giá vốn đã lưu — vào tab Giá vốn để nạp, hoặc chọn "Thả file giá vốn".'))
        : vungFile),
    h('div', { class: 'o-cai-dat' },
      h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '2'), 'Gian hàng'),
      h('div', { class: 'ds-chip' }, gians.map((g) => h('button', {
        class: ['chip-gian', `gian-${mauGian(g, gians)}`, g === st.gian && 'dang-bat'], 'aria-pressed': String(g === st.gian),
        onclick: () => doi({ gian: g }),
      }, g)))),
    h('div', { class: 'o-cai-dat' },
      h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '3'), 'Lãi mong muốn'),
      h('div', { class: 'hang' },
        nhomNut([['pt', '% trên giá'], ['dong', 'đ / đơn']], st.kieuLai, (v) => doi({ kieuLai: v, lai: v === 'pt' ? '20' : '10.000' }), 'Kiểu lãi'),
        oLai, h('span', { class: 'chu-nhat' }, st.kieuLai === 'pt' ? '%' : 'đ'))),
    h('div', { class: 'o-cai-dat' },
      h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '4'), 'Kịch bản'),
      nhomNut([['qc', 'Có QC'], ['khongqc', 'Không QC'], ['ca2', 'Cả 2']], st.kichBan, (v) => doi({ kichBan: v }), 'Kịch bản'),
      st.kichBan === 'ca2' ? h('p', { class: 'goi-y goi-y-sat' }, 'Giá đủ để cả có QC và không QC đều đạt mức lãi.') : null),
    h('div', { class: 'o-cai-dat' },
      h('div', { class: 'nhan-buoc' }, h('span', { class: 'so-buoc' }, '5'), 'Làm tròn'),
      nhomNut([['len1000', 'Lên 1.000'], ['duoi9000', 'Đuôi 9.000'], ['khong', 'Không']], st.lamTron, (v) => doi({ lamTron: v }), 'Làm tròn')));
}

function veTrong(daLuu, lai) {
  let tieuDe = 'Chọn giá vốn để bắt đầu', moTa = 'Bấm chọn nhóm giá vốn ở bước 1 (vd Bộ 1 tấm, Decal PP), hoặc thả file giá vốn.';
  if (lai === null) { tieuDe = 'Mức lãi chưa đúng'; moTa = 'Nhập mức lãi là số, vd 20 (%) hoặc 10.000 (đ/đơn).'; }
  else if (st.nguon === 'luu' && !daLuu.length) { tieuDe = 'Chưa có giá vốn'; moTa = 'Vào tab Giá vốn để nạp file của bộ phận giá vốn, hoặc chọn "Thả file giá vốn".'; }
  return h('div', { class: 'the' }, manTrong(tieuDe, moTa));
}

function veTongKet(ketQua, giaCua, canhBao) {
  const ok = ketQua.filter((d) => !d.loi);
  const ct = ok.map((d) => chiTietTaiGia(d, giaCua(d))).filter(Boolean);
  const tb = (f) => (ct.length ? ct.reduce((s, x) => s + f(x), 0) / ct.length : null);
  const soLoi = ketQua.length - ok.length;
  const tbQC = tb((x) => x.ptQC), tbK = tb((x) => x.ptKhongQC);
  return h('div', { class: 'luoi-tong-ket' },
    h('div', { class: 'o-tong' }, h('div', { class: 'o-tong-nhan' }, 'Số size'), h('div', { class: 'o-tong-so' }, ok.length),
      soLoi ? h('div', { class: 'chu-lo' }, `${soLoi} dòng không tính được`) : h('div', { class: 'chu-nhat' }, `Gian ${st.gian}`)),
    h('div', { class: 'o-tong' }, h('div', { class: 'o-tong-nhan' }, '% lãi TB tại giá đang dùng'),
      h('div', { class: 'o-tong-hai' },
        h('div', null, h('small', null, 'Có QC'), h('b', { class: tbQC < 0 ? 'chu-lo' : 'chu-lai' }, dinhDangPhanTram(tbQC))),
        h('div', null, h('small', null, 'Không QC'), h('b', { class: tbK < 0 ? 'chu-lo' : 'chu-lai' }, dinhDangPhanTram(tbK))))),
    h('div', { class: ['o-tong', canhBao.size ? 'o-tong-vang' : ''] }, h('div', { class: 'o-tong-nhan' }, 'Kiểm tra bậc giá'),
      h('div', { class: 'o-tong-so' }, canhBao.size ? `⚠ ${canhBao.size}` : '✓'),
      h('div', { class: 'chu-nhat' }, canhBao.size ? 'size có giá sai bậc — xem dòng tô vàng' : 'Size lớn giá cao hơn · bộ 3 tấm rẻ hơn 3 × 1 tấm')),
    h('div', { class: 'o-tong' }, h('div', { class: 'o-tong-nhan' }, 'Giá chốt tay'), h('div', { class: 'o-tong-so' }, Object.keys(st.giaChot).length),
      h('div', { class: 'chu-nhat' }, 'Gõ vào cột "Giá chốt" để sửa giá từng size')));
}

function veBang(ketQua, giaCua, canhBao) {
  const hang = [];
  let nhomTruoc = null;
  for (const d of ketQua) {
    if (d.nhom !== nhomTruoc) {
      hang.push(h('tr', { class: 'hang-nhom' }, h('th', { colspan: 11, scope: 'rowgroup' }, d.nhom)));
      nhomTruoc = d.nhom;
    }
    hang.push(veDong(d, giaCua, canhBao.get(khoaVon(d.nhom, d.phan_loai))));
  }
  const kb = st.kichBan === 'qc' ? 'có QC' : st.kichBan === 'khongqc' ? 'không QC' : 'cả 2';
  return h('div', { class: 'the the-bang' },
    canhBao.size ? h('details', { class: 'canh-bao', open: true },
      h('summary', null, `⚠️ ${[...canhBao.values()].flat().length} cảnh báo bậc giá`),
      h('ul', null, [...canhBao.values()].flat().map((c) => h('li', null, c)))) : null,
    h('div', { class: 'khung-bang khung-bang-cao' },
      h('table', { class: 'bang bang-ln bang-sg' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, 'Phân loại'), h('th', { scope: 'col' }, 'Ngành'),
          h('th', { scope: 'col', class: 'so' }, 'Giá vốn'),
          h('th', { scope: 'col', class: 'so', title: 'Giá thấp nhất đạt mức lãi, đã làm tròn' }, 'Giá đề xuất'),
          h('th', { scope: 'col', class: 'so' }, 'Giá chốt'),
          h('th', { scope: 'col', class: 'so' }, 'Lãi có QC'), h('th', { scope: 'col', class: 'so' }, 'Lãi không QC'),
          h('th', { scope: 'col', class: 'so', title: `Giá để lãi = 0 (kịch bản ${kb})` }, 'Giá hòa vốn'),
          h('th', { scope: 'col', class: 'so', title: 'Từ giá đang dùng, giảm tối đa bao nhiêu thì vẫn hòa vốn' }, 'Giảm tối đa'),
          h('th', { scope: 'col' }, ''))),
        h('tbody', null, hang))));
}

function veDong(d, giaCua, canhBao) {
  const k = khoaVon(d.nhom, d.phan_loai);
  if (d.loi) {
    return h('tr', { class: 'dong-loi' },
      h('td', null, h('b', null, d.phan_loai)), h('td', null, d.nganh || '—'),
      h('td', { class: 'so' }, Number.isFinite(d.von) ? dinhDangTien(d.von) : '—'),
      h('td', { colspan: 7, class: 'chu-lo' }, d.loi));
  }
  const gia = giaCua(d);
  const ct = chiTietTaiGia(d, gia);
  const coChot = st.giaChot[k] !== undefined;
  const oChot = h('input', {
    class: ['o-so', coChot && 'o-doi'], type: 'text', inputmode: 'numeric', value: coChot ? dinhDangTien(st.giaChot[k]) : '',
    placeholder: dinhDangTien(d.giaDeXuat), 'data-o': `chot:${k}`, 'aria-label': `Giá chốt ${d.nhom} ${d.phan_loai}`,
    onchange: (e) => {
      const tho = e.target.value.trim();
      const so = tho === '' ? null : docSo(tho);
      if (tho !== '' && (so === null || so <= 0)) { e.target.classList.add('o-loi'); thongBao(`"${tho}" không phải giá hợp lệ.`, 'loi'); return; }
      const moi = { ...st.giaChot };
      if (so === null || so === d.giaDeXuat) delete moi[k]; else moi[k] = so;
      doi({ giaChot: moi });
    },
  });
  const oLai = (lai, pt) => h('td', { class: ['so', 'o-lai', lai < 0 && 'o-lo'] },
    h('div', { class: lai < 0 ? 'chu-lo' : 'chu-lai' }, dinhDangTien(lai)), h('div', { class: 'chu-pt' }, dinhDangPhanTram(pt)));
  return h('tr', { class: canhBao ? 'dong-canh-bao' : '' },
    h('td', null, h('b', null, d.phan_loai)),
    h('td', null, d.nganh),
    h('td', { class: 'so' }, dinhDangTien(d.von)),
    h('td', { class: 'so' }, h('b', { class: coChot ? 'chu-gach' : 'chu-de-xuat' }, dinhDangTien(d.giaDeXuat))),
    h('td', { class: 'so' }, oChot),
    oLai(ct.laiQC, ct.ptQC),
    oLai(ct.laiKhongQC, ct.ptKhongQC),
    h('td', { class: 'so' }, dinhDangTien(d.hoaVon)),
    h('td', { class: ['so', 'o-lai', ct.giamToiDa < 0 && 'o-lo'] },
      h('div', { class: ct.giamToiDa < 0 ? 'chu-lo' : '' }, dinhDangPhanTram(ct.giamToiDa)),
      h('div', { class: 'chu-pt' }, `${dinhDangTien(ct.giamToiDaDong)} đ`)),
    h('td', null, canhBao ? h('span', { class: 'nhan-nho nhan-vang', title: canhBao.join('\n') }, '⚠ bậc giá') : null));
}

// ---------- file ----------

async function napFile(files) {
  const f = files[0];
  if (!/\.(xlsx|xls)$/i.test(f.name)) { thongBao(`"${f.name}" không phải file Excel.`, 'loi'); return; }
  try {
    const r = docBangGiaVon(docBang(await f.arrayBuffer()).dong);
    if (!r.banGhi.length) { thongBao(r.loi[0]?.noiDung || 'File không có dòng giá vốn nào.', 'loi'); return; }
    doi({ nguon: 'file', dsFile: r.banGhi, tenFile: f.name, giaChot: {} });
    if (r.loi.length) thongBao(`${r.loi.length} dòng lỗi trong file (vd: ${r.loi[0].noiDung})`, 'tt');
    else thongBao(`Đã đọc ${r.banGhi.length} dòng giá vốn từ "${f.name}".`);
  } catch (e) {
    thongBao(`Không đọc được file: ${e.message}`, 'loi');
  }
}

function xuatFile(ketQua, giaCua, canhBao) {
  const X = globalThis.XLSX;
  const ok = ketQua.filter((d) => !d.loi);
  const mau = X.utils.aoa_to_sheet(bangXuatTheoMau(ketQua, giaCua));
  mau['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  const chiTiet = X.utils.aoa_to_sheet([
    ['Nhóm', 'Phân loại', 'Ngành', 'Giá vốn', 'Giá đề xuất', 'Giá chốt', 'Lãi có QC', '% có QC', 'Lãi không QC', '% không QC', 'Giá hòa vốn', 'Giảm tối đa (%)', 'Giảm tối đa (đ)', 'Cảnh báo'],
    ...ok.map((d) => {
      const ct = chiTietTaiGia(d, giaCua(d));
      const pt = (x) => Math.round(x * 1000) / 10;
      return [d.nhom, d.phan_loai, d.nganh, d.von, d.giaDeXuat, giaCua(d), Math.round(ct.laiQC), pt(ct.ptQC), Math.round(ct.laiKhongQC), pt(ct.ptKhongQC),
        Math.round(d.hoaVon), pt(ct.giamToiDa), Math.round(ct.giamToiDaDong), (canhBao.get(khoaVon(d.nhom, d.phan_loai)) || []).join(' | ')];
    }),
  ]);
  chiTiet['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 8 }, ...Array(10).fill({ wch: 12 }), { wch: 60 }];
  const kb = { qc: 'Có QC', khongqc: 'Không QC', ca2: 'Cả 2 kịch bản' }[st.kichBan];
  const lt = { len1000: 'Lên 1.000', duoi9000: 'Đuôi 9.000', khong: 'Không làm tròn' }[st.lamTron];
  const caiDat = X.utils.aoa_to_sheet([
    ['Gian hàng', st.gian], ['Bộ phí', `Đang áp dụng tại tháng ${hienThiThang(thangNay())}`],
    ['Lãi mong muốn', st.kieuLai === 'pt' ? `${st.lai}% trên giá` : `${st.lai} đ/đơn`], ['Kịch bản', kb], ['Làm tròn', lt],
    ['Nguồn giá vốn', st.nguon === 'file' ? `File ${st.tenFile}` : `Đã lưu: ${st.nhomChon.join(', ')}`],
    ['Ngày xuất', new Date().toLocaleString('vi-VN')],
    ['Ghi chú', 'Sheet "Sản phẩm" đúng mẫu nhập của tab Tính lợi nhuận (Giá bán = giá chốt, nếu không chốt tay thì = giá đề xuất).'],
  ]);
  caiDat['!cols'] = [{ wch: 16 }, { wch: 90 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, mau, 'Sản phẩm');
  X.utils.book_append_sheet(wb, chiTiet, 'Chi tiết');
  X.utils.book_append_sheet(wb, caiDat, 'Cài đặt');
  const d = new Date();
  const ngay = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const gian = st.gian.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').replace(/\s+/g, '-');
  taiXuong(`set-gia_${gian}_${ngay}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }));
  chucMung(`Đã xuất ${ok.length} size!`);
}
