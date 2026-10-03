// Tab Bảng phí: gian hàng × ngành × tháng áp dụng.
import { h, thayNoiDung, xacNhan, chonFile, taiXuong } from './dom.js';
import { thongBao } from './thong-bao.js';
import { manTrong } from './linh-vat.js';
import { moCaiDat } from './cai-dat.js';
import * as kho from '../data/kho.js';
import { KHOAN_PHI, tyLePhiQC, tyLePhiKhongQC, phiCoDinh } from '../core/cong-thuc.js';
import { chonBoPhi, cacThangCoPhi, thangHienTai, hienThiThang, chuanHoaThang, laThangHopLe } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangSo, dinhDangPhanTram } from '../core/so.js';
import { layDanhSach, mauGian } from '../core/danh-muc.js';
import { docBang } from '../excel/doc.js';

const st = { gian: null, thang: thangHienTai(), nhap: {} }; // nhap[nganh][khoa] = chuỗi người dùng gõ
let goc;

export function taoTabBangPhi(phanTu) {
  goc = phanTu;
  kho.dangKy(() => ve());
  ve();
}

function dsGian() { return layDanhSach(kho.duLieu().DANH_MUC, 'GIAN'); }
function dsNganh() { return layDanhSach(kho.duLieu().DANH_MUC, 'NGANH'); }

function coThayDoi() {
  return Object.values(st.nhap).some((o) => Object.keys(o).length);
}

/** Bản ghi nguồn đang hiển thị cho 1 ngành: đúng tháng, hoặc bộ gần nhất trước đó. */
function nguon(nganh) {
  return chonBoPhi(kho.duLieu().BANG_PHI, st.gian, nganh, st.thang);
}

function giaTriO(nganh, khoa) {
  const n = st.nhap[nganh]?.[khoa];
  if (n !== undefined) return n;
  const r = nguon(nganh);
  return r && r[khoa] !== null && r[khoa] !== undefined ? dinhDangSo(r[khoa]) : '';
}

function soCuaO(nganh, khoa) {
  const n = st.nhap[nganh]?.[khoa];
  if (n !== undefined) return n.trim() === '' ? 0 : docSo(n);
  const r = nguon(nganh);
  return r ? (r[khoa] ?? 0) : 0;
}

function loiO(khoa, so) {
  if (so === null) return 'Không phải số';
  if (so < 0) return 'Không được âm';
  const donVi = KHOAN_PHI.find((k) => k.khoa === khoa).donVi;
  if (donVi === '%' && so >= 100) return 'Phải nhỏ hơn 100%';
  return null;
}

function boPhiDangNhap(nganh) {
  const r = {};
  for (const k of KHOAN_PHI) r[k.khoa] = soCuaO(nganh, k.khoa);
  return r;
}

function ve() {
  const gians = dsGian();
  if (!st.gian || !gians.includes(st.gian)) st.gian = gians[0];
  const ts = kho.lay();
  if (!kho.layCaiDat().url && !ts.duLieu.BANG_PHI.length) {
    thayNoiDung(goc, manTrong('Chưa kết nối Google Sheets', 'Nhập URL Apps Script và mật khẩu ở Cài đặt để xem và lưu bảng phí.',
      h('button', { class: 'nut nut-chinh', onclick: moCaiDat }, '⚙️ Mở Cài đặt')));
    return;
  }
  thayNoiDung(goc,
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null, h('h2', null, 'Bảng phí'), h('p', { class: 'mo-ta' }, 'Phí theo gian hàng × ngành × tháng áp dụng. Sửa phí tháng mới không làm mất phí tháng cũ.')),
        h('div', { class: 'hang-nut' },
          h('button', { class: 'nut', onclick: nhapExcel }, '📥 Nhập từ Excel'),
          h('button', { class: 'nut', onclick: xuatExcel, disabled: !ts.duLieu.BANG_PHI.length }, '📤 Xuất Excel'))),
      h('div', { class: 'chon-gian', role: 'tablist', 'aria-label': 'Gian hàng' },
        gians.map((g) => h('button', {
          class: ['vien-gian', `gian-${mauGian(g, gians)}`, g === st.gian && 'dang-chon'],
          role: 'tab', 'aria-selected': String(g === st.gian),
          onclick: () => doiGianThang(g, st.thang),
        }, g))),
      veChonThang(),
      veThongBaoNguon(),
      veBang(),
      veHangLuu()),
    veDanhMuc());
}

async function doiGianThang(gian, thang) {
  if (coThayDoi() && !(await xacNhan('Bạn có thay đổi chưa lưu. Bỏ các thay đổi này?', { nutDongY: 'Bỏ thay đổi', nguyHiem: true }))) return;
  st.gian = gian;
  st.thang = thang;
  st.nhap = {};
  ve();
}

function veChonThang() {
  const cacThang = cacThangCoPhi(kho.duLieu().BANG_PHI, st.gian);
  const oThang = h('input', { type: 'month', class: 'o-nhap', value: st.thang, 'aria-label': 'Tháng áp dụng',
    onchange: (e) => { const t = chuanHoaThang(e.target.value); if (t) doiGianThang(st.gian, t); else e.target.value = st.thang; } });
  return h('div', { class: 'hang hang-thang' },
    h('label', { class: 'nhan-ngang' }, 'Tháng áp dụng ', oThang),
    cacThang.length ? h('span', { class: 'chu-nhat' }, 'Đã có:') : null,
    cacThang.map((t) => h('button', { class: ['the-thang', t === st.thang && 'dang-chon'], onclick: () => doiGianThang(st.gian, t) }, hienThiThang(t))));
}

function veThongBaoNguon() {
  const nganhs = dsNganh();
  const ds = kho.duLieu().BANG_PHI;
  const coDungThang = ds.some((p) => p.gian === st.gian && p.thang === st.thang);
  const cuNhat = nganhs.map(nguon).filter(Boolean).map((r) => r.thang).sort().at(-1);
  if (coDungThang) {
    return h('div', { class: 'ghi-chu ghi-chu-xanh' }, `Đang xem bộ phí tháng ${hienThiThang(st.thang)} của ${st.gian}. Ngành nào chưa có phí riêng tháng này sẽ dùng bộ phí gần nhất trước đó (ghi ở đầu cột).`);
  }
  if (cuNhat) {
    return h('div', { class: 'ghi-chu ghi-chu-vang' }, `Chưa có bộ phí tháng ${hienThiThang(st.thang)} — đang dùng bộ phí tháng ${hienThiThang(cuNhat)}. Sửa và bấm Lưu sẽ tạo bộ phí mới cho tháng ${hienThiThang(st.thang)}; tháng ${hienThiThang(cuNhat)} vẫn giữ nguyên.`);
  }
  return h('div', { class: 'ghi-chu ghi-chu-vang' }, `${st.gian} chưa có bộ phí nào từ tháng ${hienThiThang(st.thang)} trở về trước. Nhập phí rồi bấm Lưu.`);
}

function veBang() {
  const nganhs = dsNganh();
  const oTong = {};
  const capNhatTong = (nganh) => {
    const p = boPhiDangNhap(nganh);
    const coLoi = KHOAN_PHI.some((k) => loiO(k.khoa, p[k.khoa]));
    const [a, b, c] = oTong[nganh];
    a.textContent = coLoi ? '—' : dinhDangPhanTram(tyLePhiQC(p));
    b.textContent = coLoi ? '—' : dinhDangPhanTram(tyLePhiKhongQC(p));
    c.textContent = coLoi ? '—' : `${dinhDangTien(phiCoDinh(p))} đ`;
  };

  const dauCot = nganhs.map((n) => {
    const r = nguon(n);
    const chu = !r ? 'chưa có' : r.thang === st.thang ? `tháng ${hienThiThang(r.thang)}` : `dùng ${hienThiThang(r.thang)}`;
    return h('th', { class: 'so', scope: 'col' }, h('div', null, n), h('div', { class: ['chu-nhat', r && r.thang !== st.thang && 'chu-ke-thua'] }, chu));
  });

  const hang = KHOAN_PHI.map((k) => h('tr', null,
    h('th', { scope: 'row' }, k.ten, h('span', { class: 'don-vi' }, ` (${k.donVi})`)),
    nganhs.map((n) => {
      const inp = h('input', {
        class: 'o-so', type: 'text', inputmode: 'decimal', value: giaTriO(n, k.khoa),
        'aria-label': `${k.ten} — ${n}`,
        oninput: (e) => {
          (st.nhap[n] ||= {})[k.khoa] = e.target.value;
          danhDau(inp, n, k.khoa);
          capNhatTong(n);
          capNhatNutLuu();
        },
      });
      danhDau(inp, n, k.khoa);
      return h('td', { class: 'so' }, h('div', { class: 'o-co-don-vi' }, inp, h('span', null, k.donVi)));
    })));

  const hangTong = [
    ['Tổng phí % có QC', 0], ['Tổng phí % không QC', 1], ['Phí cố định / đơn', 2],
  ].map(([ten, i]) => h('tr', { class: 'hang-tong' }, h('th', { scope: 'row' }, ten),
    nganhs.map((n) => { const td = h('td', { class: 'so' }); (oTong[n] ||= [])[i] = td; return td; })));

  const bang = h('div', { class: 'khung-bang' },
    h('table', { class: 'bang bang-phi' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Khoản phí'), dauCot)),
      h('tbody', null, hang),
      h('tfoot', null, hangTong)));
  nganhs.forEach(capNhatTong);
  return bang;
}

function danhDau(inp, nganh, khoa) {
  const n = st.nhap[nganh]?.[khoa];
  const so = soCuaO(nganh, khoa);
  const loi = loiO(khoa, so);
  const r = nguon(nganh);
  const doi = n !== undefined && so !== (r ? r[khoa] ?? 0 : null);
  inp.classList.toggle('o-loi', !!loi);
  inp.classList.toggle('o-doi', doi && !loi);
  inp.title = loi || (doi ? `Cũ: ${r ? dinhDangSo(r[khoa] ?? 0) : 'chưa có'}` : '');
}

let nutLuu, chuLuu;
function nganhCanLuu() {
  return dsNganh().filter((n) => {
    if (!st.nhap[n] || !Object.keys(st.nhap[n]).length) return false;
    const r = nguon(n);
    return KHOAN_PHI.some((k) => soCuaO(n, k.khoa) !== (r ? r[k.khoa] ?? 0 : null));
  });
}
function coLoiNhap() {
  return dsNganh().some((n) => KHOAN_PHI.some((k) => loiO(k.khoa, soCuaO(n, k.khoa))));
}
function capNhatNutLuu() {
  const ds = nganhCanLuu();
  const loi = coLoiNhap();
  nutLuu.disabled = !ds.length || loi;
  chuLuu.textContent = loi ? 'Có ô nhập sai (tô đỏ) — sửa trước khi lưu.' : ds.length ? `Sẽ lưu phí tháng ${hienThiThang(st.thang)} cho: ${ds.join(', ')}` : 'Chưa có thay đổi.';
}

function veHangLuu() {
  nutLuu = h('button', { class: 'nut nut-chinh', onclick: luu }, `💾 Lưu bộ phí tháng ${hienThiThang(st.thang)}`);
  chuLuu = h('span', { class: 'chu-nhat' });
  const coDungThang = kho.duLieu().BANG_PHI.some((p) => p.gian === st.gian && p.thang === st.thang);
  const hang = h('div', { class: 'hang-nut hang-luu' },
    nutLuu,
    h('button', { class: 'nut', onclick: () => { st.nhap = {}; ve(); } }, 'Hoàn tác'),
    chuLuu,
    h('span', { class: 'gian-cach' }),
    coDungThang ? h('button', { class: 'nut nut-nho nut-vien-do', onclick: xoaThang }, `Xóa bộ phí tháng ${hienThiThang(st.thang)}`) : null);
  capNhatNutLuu();
  return hang;
}

async function luu() {
  const ds = nganhCanLuu();
  if (!ds.length || coLoiNhap()) return;
  const banGhi = ds.map((n) => ({ gian: st.gian, nganh: n, thang: st.thang, ...boPhiDangNhap(n) }));
  nutLuu.disabled = true;
  nutLuu.textContent = 'Đang lưu…';
  try {
    await kho.ghi('BANG_PHI', banGhi);
    st.nhap = {};
    thongBao(`Đã lưu bộ phí tháng ${hienThiThang(st.thang)} — ${st.gian} (${ds.join(', ')}).`);
    ve();
  } catch (e) {
    thongBao(`Chưa lưu được: ${e.message}`, 'loi');
    nutLuu.textContent = `💾 Lưu bộ phí tháng ${hienThiThang(st.thang)}`;
    capNhatNutLuu();
  }
}

async function xoaThang() {
  const ds = kho.duLieu().BANG_PHI.filter((p) => p.gian === st.gian && p.thang === st.thang);
  if (!(await xacNhan(`Xóa bộ phí tháng ${hienThiThang(st.thang)} của ${st.gian} (${ds.length} ngành)? Các tháng khác không bị ảnh hưởng. Thao tác được ghi vào LICH_SU.`, { nutDongY: 'Xóa', nguyHiem: true }))) return;
  try {
    await kho.xoa('BANG_PHI', ds.map((p) => ({ gian: p.gian, nganh: p.nganh, thang: p.thang })));
    st.nhap = {};
    thongBao(`Đã xóa bộ phí tháng ${hienThiThang(st.thang)} của ${st.gian}.`);
  } catch (e) {
    thongBao(`Chưa xóa được: ${e.message}`, 'loi');
  }
}

// ---------- Danh mục gian / ngành ----------

function veDanhMuc() {
  const khoi = (loai, tieuDe) => {
    const ds = layDanhSach(kho.duLieu().DANH_MUC, loai);
    const oThem = h('input', { class: 'o-nhap', placeholder: loai === 'GIAN' ? 'Tên gian mới' : 'Tên ngành mới', maxlength: 40 });
    return h('div', { class: 'khoi-danh-muc' },
      h('h4', null, tieuDe),
      h('div', { class: 'ds-chip' }, ds.map((t) => h('span', { class: ['chip', loai === 'GIAN' && `gian-${mauGian(t, ds)}`] }, t,
        h('button', { class: 'chip-xoa', title: `Bỏ ${t}`, 'aria-label': `Bỏ ${t}`, onclick: () => doiDanhMuc(loai, t, 'bo') }, '×')))),
      h('form', { class: 'hang', onsubmit: (e) => { e.preventDefault(); const t = oThem.value.trim(); if (t) doiDanhMuc(loai, t, 'them'); } },
        oThem, h('button', { class: 'nut nut-nho', type: 'submit' }, '+ Thêm')));
  };
  return h('details', { class: 'the the-phu' },
    h('summary', null, 'Gian hàng & ngành (thêm / bớt)'),
    h('div', { class: 'luoi-2' }, khoi('GIAN', 'Gian hàng'), khoi('NGANH', 'Ngành')),
    h('p', { class: 'goi-y' }, 'Bỏ một gian/ngành chỉ ẩn khỏi danh sách; phí đã lưu vẫn còn trong Google Sheets.'));
}

async function doiDanhMuc(loai, ten, hanhDong) {
  const dm = kho.duLieu().DANH_MUC;
  const hienCo = layDanhSach(dm, loai);
  const banGhi = [];
  // Lần đầu: lưu luôn danh sách mặc định để giữ thứ tự
  if (!dm.some((d) => d.loai === loai)) hienCo.forEach((t, i) => banGhi.push({ loai, ten: t, thu_tu: i + 1, dang_dung: 'co' }));
  if (hanhDong === 'them') {
    if (hienCo.some((t) => t.toLowerCase() === ten.toLowerCase())) { thongBao(`"${ten}" đã có rồi.`, 'tt'); return; }
    const maxTT = Math.max(0, ...dm.filter((d) => d.loai === loai).map((d) => d.thu_tu || 0), hienCo.length);
    banGhi.push({ loai, ten, thu_tu: maxTT + 1, dang_dung: 'co' });
  } else {
    if (hienCo.length <= 1) { thongBao('Phải còn ít nhất 1 mục.', 'tt'); return; }
    if (!(await xacNhan(`Bỏ "${ten}" khỏi danh sách?`))) return;
    const i = banGhi.findIndex((b) => b.ten === ten);
    if (i >= 0) banGhi[i].dang_dung = 'khong';
    else banGhi.push({ loai, ten, dang_dung: 'khong' });
  }
  try {
    await kho.ghi('DANH_MUC', banGhi);
    thongBao(hanhDong === 'them' ? `Đã thêm "${ten}".` : `Đã bỏ "${ten}".`);
  } catch (e) {
    thongBao(`Chưa lưu được: ${e.message}`, 'loi');
  }
}

// ---------- Nhập / xuất Excel ----------

const COT_EXCEL = ['Gian hàng', 'Ngành', 'Tháng áp dụng', ...KHOAN_PHI.map((k) => `${k.ten} (${k.donVi})`)];

function xuatExcel() {
  const ds = [...kho.duLieu().BANG_PHI].sort((a, b) => (a.gian + a.thang + a.nganh).localeCompare(b.gian + b.thang + b.nganh, 'vi'));
  const X = globalThis.XLSX;
  const ws = X.utils.aoa_to_sheet([COT_EXCEL, ...ds.map((p) => [p.gian, p.nganh, hienThiThang(p.thang), ...KHOAN_PHI.map((k) => p[k.khoa] ?? 0)])]);
  ws['!cols'] = COT_EXCEL.map((c, i) => ({ wch: i < 3 ? 14 : 18 }));
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Bảng phí');
  taiXuong(`bang-phi_${thangHienTai()}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }));
}

async function nhapExcel() {
  const f = await chonFile();
  if (!f) return;
  let dong;
  try { dong = docBang(await f.arrayBuffer()).dong; } catch (e) { thongBao(`Không đọc được file: ${e.message}`, 'loi'); return; }
  const tieuDe = (dong[0] || []).map((x) => String(x).trim().toLowerCase());
  const viTri = COT_EXCEL.map((c) => tieuDe.indexOf(c.toLowerCase()));
  if (viTri.some((i) => i < 0)) {
    thongBao(`File cần đủ các cột: ${COT_EXCEL.join(', ')}. Bấm "Xuất Excel" để lấy file đúng mẫu.`, 'loi');
    return;
  }
  const loi = [], banGhi = [];
  dong.slice(1).forEach((d, i) => {
    if (!d.some((x) => String(x).trim())) return;
    const thang = chuanHoaThang(d[viTri[2]]);
    const b = { gian: String(d[viTri[0]]).trim(), nganh: String(d[viTri[1]]).trim(), thang };
    KHOAN_PHI.forEach((k, j) => { b[k.khoa] = docSo(d[viTri[3 + j]]) ?? 0; });
    const loiDong = [];
    if (!b.gian || !b.nganh) loiDong.push('thiếu gian/ngành');
    if (!laThangHopLe(thang)) loiDong.push(`tháng "${d[viTri[2]]}" không hợp lệ (vd 10/2026)`);
    KHOAN_PHI.forEach((k) => { const l = loiO(k.khoa, b[k.khoa]); if (l) loiDong.push(`${k.ten}: ${l}`); });
    if (loiDong.length) loi.push(`Dòng ${i + 2}: ${loiDong.join('; ')}`);
    else banGhi.push(b);
  });
  if (loi.length) { thongBao(`File có ${loi.length} dòng lỗi. ${loi.slice(0, 3).join(' | ')}`, 'loi'); return; }
  if (!banGhi.length) { thongBao('File không có dòng phí nào.', 'tt'); return; }
  const cacGian = [...new Set(banGhi.map((b) => b.gian))];
  if (!(await xacNhan(`Lưu ${banGhi.length} bộ phí (${cacGian.join(', ')})? Bộ phí trùng gian + ngành + tháng sẽ được cập nhật, các tháng khác giữ nguyên.`, { nutDongY: `Lưu ${banGhi.length} bộ phí` }))) return;
  try {
    const kq = await kho.ghi('BANG_PHI', banGhi);
    thongBao(`Đã lưu ${kq.length} bộ phí từ file.`);
  } catch (e) {
    thongBao(`Chưa lưu được: ${e.message}`, 'loi');
  }
}
