// Tab con Bảng phí Shopee: gian × ngành × tháng áp dụng. Lưu ở sheet BANG_PHI_SHOPEE — riêng hoàn toàn với TikTok.
import { h, thayNoiDung, xacNhan, veGiu, chonFile, taiXuong } from './dom.js';
import { oSo, dangGoDo } from './o-so.js';
import { baoDuLieuMoi, boChoTaiLai } from './du-lieu-moi.js';
import { thongBao } from './thong-bao.js';
import { manTrong } from './linh-vat.js';
import { moCaiDat } from './cai-dat.js';
import * as kho from '../data/kho.js';
import { KHOAN_PHI_SHOPEE, phiShopeeMacDinh, tyLePhiShopee } from '../core/cong-thuc.js';
import { chonBoPhi, cacThangCoPhi, thangHienTai, hienThiThang, chuanHoaThang } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangSo, dinhDangPhanTram } from '../core/so.js';
import { NGANH_SHOPEE, layDanhSach, mauGian } from '../core/danh-muc.js';
import { khoiDanhMuc } from './danh-muc.js';
import { docBang } from '../excel/doc.js';
import { bangXuatPhiShopee, bangMauPhiShopee, docNhapPhiShopee, COT_EXCEL_SHOPEE } from '../core/phi-shopee-excel.js';

const SHEET = 'BANG_PHI_SHOPEE';
const TEN_TAB = 'bang-phi-shopee';

const st = { gian: null, thang: thangHienTai(), nhap: {} }; // nhap[nganh][khoa] = chuỗi người dùng gõ
let goc;
let dangLuu = false;

export function taoTabBangPhiShopee(phanTu) {
  goc = phanTu;
  kho.dangKy((_, ct) => {
    if (!ct.duLieuDoi || dangLuu) return;
    if ((coThayDoi() || dangGoDo(goc)) && ct.nguon !== 'cache') { baoDuLieuMoi(TEN_TAB, veLai); return; }
    veLai();
  });
  ve();
}

function veLai() {
  boChoTaiLai(TEN_TAB);
  veGiu(goc, ve);
}

const dsPhi = () => kho.duLieu()[SHEET] || [];
const dsGian = () => layDanhSach(kho.duLieu().DANH_MUC, 'GIAN_SHOPEE');

function coThayDoi() {
  return Object.values(st.nhap).some((o) => Object.keys(o).length);
}

/** Bộ phí đã lưu đang áp dụng cho 1 ngành (đúng tháng hoặc gần nhất trước đó), null nếu chưa có. */
function daLuu(nganh) {
  return chonBoPhi(dsPhi(), st.gian, nganh, st.thang);
}

/** Bộ phí đang hiển thị: đã lưu, hoặc mặc định nếu chưa lưu lần nào. */
function nguon(nganh) {
  return daLuu(nganh) || { ...phiShopeeMacDinh(nganh), macDinh: true };
}

function soCuaO(nganh, khoa) {
  const n = st.nhap[nganh]?.[khoa];
  if (n !== undefined) return n.trim() === '' ? 0 : docSo(n);
  return nguon(nganh)[khoa] ?? 0;
}

function loiO(khoa, so) {
  if (so === null) return 'Không phải số';
  if (so < 0) return 'Không được âm';
  const donVi = KHOAN_PHI_SHOPEE.find((k) => k.khoa === khoa).donVi;
  if (donVi === '%' && so >= 100) return 'Phải nhỏ hơn 100%';
  return null;
}

function boPhiDangNhap(nganh) {
  const r = {};
  for (const k of KHOAN_PHI_SHOPEE) r[k.khoa] = soCuaO(nganh, k.khoa);
  return r;
}

function ve() {
  const gians = dsGian();
  if (!st.gian || !gians.includes(st.gian)) st.gian = gians[0];
  if (!kho.layCaiDat().url && !dsPhi().length) {
    thayNoiDung(goc, manTrong('Chưa kết nối Google Sheets', 'Nhập URL Apps Script và mật khẩu ở Cài đặt để xem và lưu bảng phí Shopee.',
      h('button', { class: 'nut nut-chinh', onclick: moCaiDat }, '⚙️ Mở Cài đặt')));
    return;
  }
  thayNoiDung(goc,
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null, h('h2', null, 'Bảng phí Shopee'),
          h('p', { class: 'mo-ta' }, 'Phí theo gian hàng × ngành × tháng áp dụng. Lãi = Giá bán − Giá vốn − Phí hạ tầng − Giá bán × tổng các khoản %.')),
        h('div', { class: 'hang-nut' },
          coSua() ? h('button', { class: 'nut', onclick: nhapExcel }, '📥 Nhập Excel') : null,
          h('button', { class: 'nut', onclick: xuatExcel, disabled: !dsPhi().length }, '📤 Xuất Excel'),
          h('button', { class: 'nut', onclick: taiFileMau }, '📄 File mẫu'))),
      h('div', { class: 'chon-gian', role: 'tablist', 'aria-label': 'Gian hàng Shopee' },
        gians.map((g) => h('button', {
          class: ['vien-gian', `gian-${mauGian(g, gians)}`, g === st.gian && 'dang-chon'],
          role: 'tab', 'aria-selected': String(g === st.gian),
          onclick: () => doiGianThang(g, st.thang),
        }, g))),
      veChonThang(),
      veThongBaoNguon(),
      veBang(),
      coSua() ? veHangLuu() : veChiXem()),
    coSua() && h('details', { class: 'the the-phu' },
      h('summary', null, 'Gian hàng Shopee (thêm / bớt)'),
      khoiDanhMuc('GIAN_SHOPEE', 'Gian hàng Shopee'),
      h('p', { class: 'goi-y' }, 'Ngành Shopee cố định: Sách, Tranh, Lịch, Decal, Trà. Bỏ một gian chỉ ẩn khỏi danh sách; phí đã lưu vẫn còn trong Google Sheets.')));
}

async function doiGianThang(gian, thang) {
  if (coThayDoi() && !(await xacNhan('Bạn có thay đổi chưa lưu. Bỏ các thay đổi này?', { nutDongY: 'Bỏ thay đổi', nguyHiem: true }))) return;
  st.gian = gian;
  st.thang = thang;
  st.nhap = {};
  veLai();
}

function veChonThang() {
  const cacThang = cacThangCoPhi(dsPhi(), st.gian);
  const oThang = h('input', { type: 'month', class: 'o-nhap', value: st.thang, 'aria-label': 'Tháng áp dụng Shopee',
    onchange: (e) => { const t = chuanHoaThang(e.target.value); if (t) doiGianThang(st.gian, t); else e.target.value = st.thang; } });
  return h('div', { class: 'hang hang-thang' },
    h('label', { class: 'nhan-ngang' }, 'Tháng áp dụng ', oThang),
    cacThang.length ? h('span', { class: 'chu-nhat' }, 'Đã có:') : null,
    cacThang.map((t) => h('button', { class: ['the-thang', t === st.thang && 'dang-chon'], onclick: () => doiGianThang(st.gian, t) }, hienThiThang(t))));
}

function veThongBaoNguon() {
  const coDungThang = dsPhi().some((p) => p.gian === st.gian && p.thang === st.thang);
  const cuNhat = NGANH_SHOPEE.map(daLuu).filter(Boolean).map((r) => r.thang).sort().at(-1);
  if (coDungThang) {
    return h('div', { class: 'ghi-chu ghi-chu-xanh' }, `Đang xem bộ phí Shopee tháng ${hienThiThang(st.thang)} của ${st.gian}. Ngành nào chưa có phí riêng tháng này sẽ dùng bộ phí gần nhất trước đó (hoặc mặc định).`);
  }
  if (cuNhat) {
    return h('div', { class: 'ghi-chu ghi-chu-vang' }, `Chưa có bộ phí tháng ${hienThiThang(st.thang)} — đang dùng bộ phí tháng ${hienThiThang(cuNhat)}. Sửa và bấm Lưu sẽ tạo bộ phí mới cho tháng ${hienThiThang(st.thang)}; tháng ${hienThiThang(cuNhat)} vẫn giữ nguyên.`);
  }
  return h('div', { class: 'ghi-chu ghi-chu-vang' }, `${st.gian} chưa lưu bộ phí Shopee nào — đang hiện giá trị mặc định. Kiểm tra rồi bấm Lưu.`);
}

function veBang() {
  const oTong = {};
  const capNhatTong = (nganh) => {
    const p = boPhiDangNhap(nganh);
    const coLoi = KHOAN_PHI_SHOPEE.some((k) => loiO(k.khoa, p[k.khoa]));
    const [a, b] = oTong[nganh];
    a.textContent = coLoi ? '—' : dinhDangPhanTram(tyLePhiShopee(p));
    b.textContent = coLoi ? '—' : `${dinhDangTien(p.phi_ha_tang)} đ`;
  };

  const dauCot = NGANH_SHOPEE.map((n) => {
    const r = daLuu(n);
    const chu = !r ? 'mặc định' : r.thang === st.thang ? `tháng ${hienThiThang(r.thang)}` : `dùng ${hienThiThang(r.thang)}`;
    return h('th', { class: 'so', scope: 'col' }, h('div', null, n), h('div', { class: ['chu-nhat', (!r || r.thang !== st.thang) && 'chu-ke-thua'] }, chu));
  });

  const hang = KHOAN_PHI_SHOPEE.map((k) => h('tr', null,
    h('th', { scope: 'row' }, k.ten, h('span', { class: 'don-vi' }, ` (${k.donVi})`)),
    NGANH_SHOPEE.map((n) => {
      const inp = oSo({
        giaTri: nguon(n)[k.khoa] ?? null,
        giaTriGo: st.nhap[n]?.[k.khoa],
        kieu: k.donVi === '%' ? 'phantram' : 'tien',
        kiemTra: (so) => loiO(k.khoa, so),
        'aria-label': `${k.ten} — ${n}`,
        disabled: !coSua(),
        'data-o': `phi-shopee:${n}:${k.khoa}`,
        // Gõ: chỉ cập nhật ô này + dòng tổng + nút Lưu. KHÔNG vẽ lại bảng.
        khiGo: (_so, _hopLe, chuoi) => {
          (st.nhap[n] ||= {})[k.khoa] = chuoi;
          danhDau(inp, n, k.khoa);
          capNhatTong(n);
          capNhatNutLuu();
        },
        khiLuu: () => {
          (st.nhap[n] ||= {})[k.khoa] = inp.value;
          danhDau(inp, n, k.khoa);
          capNhatNutLuu();
        },
      });
      danhDau(inp, n, k.khoa);
      return h('td', { class: 'so' }, h('div', { class: 'o-co-don-vi' }, inp, h('span', null, k.donVi)));
    })));

  const hangTong = [['Tổng phí %', 0], ['Phí hạ tầng / đơn', 1]].map(([ten, i]) => h('tr', { class: 'hang-tong' }, h('th', { scope: 'row' }, ten),
    NGANH_SHOPEE.map((n) => { const td = h('td', { class: 'so' }); (oTong[n] ||= [])[i] = td; return td; })));

  const bang = h('div', { class: 'khung-bang', 'data-cuon': 'bang-phi-shopee', 'data-dieu-huong': '' },
    h('table', { class: 'bang bang-phi-shopee' },
      h('colgroup', null, h('col', { class: 'cot-ten-phi' }), NGANH_SHOPEE.map(() => h('col'))),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Khoản phí'), dauCot)),
      h('tbody', null, hang),
      h('tfoot', null, hangTong)));
  NGANH_SHOPEE.forEach(capNhatTong);
  return bang;
}

function danhDau(inp, nganh, khoa) {
  const n = st.nhap[nganh]?.[khoa];
  const so = soCuaO(nganh, khoa);
  const loi = loiO(khoa, so);
  const r = nguon(nganh);
  const doi = n !== undefined && so !== (r[khoa] ?? 0);
  if (n !== undefined) inp.classList.toggle('o-loi', !!loi);
  inp.classList.toggle('o-doi', doi && !loi);
  inp.title = loi || (doi ? `Cũ: ${dinhDangSo(r[khoa] ?? 0)}${r.macDinh ? ' (mặc định)' : ''}` : '');
}

let nutLuu, chuLuu;
/** Ngành cần lưu: đã sửa so với bộ đang hiển thị, hoặc chưa từng lưu (đang dùng mặc định). */
function nganhCanLuu() {
  return NGANH_SHOPEE.filter((n) => {
    const r = nguon(n);
    if (r.macDinh) return true;
    if (!st.nhap[n] || !Object.keys(st.nhap[n]).length) return false;
    return KHOAN_PHI_SHOPEE.some((k) => soCuaO(n, k.khoa) !== (r[k.khoa] ?? 0));
  });
}
function coLoiNhap() {
  return NGANH_SHOPEE.some((n) => KHOAN_PHI_SHOPEE.some((k) => loiO(k.khoa, soCuaO(n, k.khoa))));
}
function capNhatNutLuu() {
  const ds = nganhCanLuu();
  const loi = coLoiNhap();
  if (!nutLuu) return;
  nutLuu.disabled = !ds.length || loi;
  chuLuu.textContent = loi ? 'Có ô nhập sai (tô đỏ) — sửa trước khi lưu.' : ds.length ? `Sẽ lưu phí tháng ${hienThiThang(st.thang)} cho: ${ds.join(', ')}` : 'Chưa có thay đổi.';
}

/** Được sửa bảng phí Shopee: admin hoặc vai trò shopee (Apps Script kiểm tra lại). */
const coSua = () => kho.coQuyenSuaPhi('shopee');

/** Không có quyền sửa (vd tài khoản của nền tảng khác): chỉ xem. */
function veChiXem() {
  const p = kho.layPhien();
  return h('div', { class: 'ghi-chu ghi-chu-vang chi-xem' }, `Chỉ xem — tài khoản "${p ? p.ten : ''}" (${p ? p.vaiTro : ''}) không có quyền sửa bảng phí này.`);
}

function veHangLuu() {
  nutLuu = h('button', { class: 'nut nut-chinh', onclick: luu }, `💾 Lưu bộ phí tháng ${hienThiThang(st.thang)}`);
  chuLuu = h('span', { class: 'chu-nhat' });
  const coDungThang = dsPhi().some((p) => p.gian === st.gian && p.thang === st.thang);
  const hang = h('div', { class: 'hang-nut hang-luu' },
    nutLuu,
    h('button', { class: 'nut', onclick: () => { st.nhap = {}; veLai(); } }, 'Hoàn tác'),
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
  dangLuu = true;
  try {
    await kho.ghi(SHEET, banGhi);
    st.nhap = {};
    thongBao(`Đã lưu bộ phí Shopee tháng ${hienThiThang(st.thang)} — ${st.gian} (${ds.join(', ')}).`);
    veLai();
  } catch (e) {
    thongBao(`Chưa lưu được: ${e.message}`, 'loi');
    nutLuu.textContent = `💾 Lưu bộ phí tháng ${hienThiThang(st.thang)}`;
    capNhatNutLuu();
  } finally {
    dangLuu = false;
  }
}

async function xoaThang() {
  const ds = dsPhi().filter((p) => p.gian === st.gian && p.thang === st.thang);
  if (!(await xacNhan(`Xóa bộ phí Shopee tháng ${hienThiThang(st.thang)} của ${st.gian} (${ds.length} ngành)? Các tháng khác không bị ảnh hưởng. Thao tác được ghi vào LICH_SU.`, { nutDongY: 'Xóa', nguyHiem: true }))) return;
  dangLuu = true;
  try {
    await kho.xoa(SHEET, ds.map((p) => ({ gian: p.gian, nganh: p.nganh, thang: p.thang })));
    st.nhap = {};
    thongBao(`Đã xóa bộ phí Shopee tháng ${hienThiThang(st.thang)} của ${st.gian}.`);
    veLai();
  } catch (e) {
    thongBao(`Chưa xóa được: ${e.message}`, 'loi');
  } finally {
    dangLuu = false;
  }
}

// ---------- Nhập / xuất Excel ----------

function ghiFile(tenFile, mang, tenSheet) {
  const X = globalThis.XLSX;
  const ws = X.utils.aoa_to_sheet(mang);
  ws['!cols'] = COT_EXCEL_SHOPEE.map((_, i) => ({ wch: i < 3 ? 14 : 18 }));
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, tenSheet);
  taiXuong(tenFile, X.write(wb, { type: 'array', bookType: 'xlsx' }));
}

function xuatExcel() {
  ghiFile(`bang-phi-shopee_${thangHienTai()}.xlsx`, bangXuatPhiShopee(dsPhi()), 'Bảng phí Shopee');
}

function taiFileMau() {
  ghiFile('mau_bang_phi_shopee.xlsx', bangMauPhiShopee(dsGian()[0], thangHienTai()), 'Bảng phí Shopee');
}

async function nhapExcel() {
  const f = await chonFile();
  if (!f) return;
  let kq;
  try {
    kq = docNhapPhiShopee(docBang(await f.arrayBuffer()).dong, { dsHienCo: dsPhi(), gians: dsGian() });
  } catch (e) { thongBao(`Không đọc được file: ${e.message}`, 'loi'); return; }
  if (kq.loiFile) { thongBao(kq.loiFile, 'loi'); return; }
  if (!kq.moi.length && !kq.doi.length && !kq.loi.length) { thongBao(kq.giongCu ? `File có ${kq.giongCu} dòng, đều giống bảng phí hiện có — không có gì để lưu.` : 'File không có dòng phí nào.', 'tt'); return; }
  moXemTruoc(kq);
}

/** Hộp xem trước: dòng mới / dòng thay đổi / dòng lỗi. Chỉ ghi khi bấm xác nhận (và không còn dòng lỗi). */
function moXemTruoc(kq) {
  const soLuu = kq.moi.length + kq.doi.length;
  const coLoi = kq.loi.length > 0;
  const tenO = (k) => KHOAN_PHI_SHOPEE.find((x) => x.khoa === k).ten;
  const bo = (b) => `${b.gian} · ${b.nganh} · ${hienThiThang(b.thang)}`;
  const phan = (tieuDe, lop, dong) => (dong.length ? h('details', { class: ['xem-truoc-nhom', lop], open: true },
    h('summary', null, tieuDe), h('ul', { class: 'ds-xem-truoc' }, dong)) : null);
  const nutLuu = h('button', { class: 'nut nut-chinh', disabled: coLoi || !soLuu, onclick: () => luuNhap(kq, dlg, nutLuu) }, `💾 Lưu ${soLuu} bộ phí`);
  const dlg = h('dialog', { class: 'hop-thoai hop-thoai-rong xem-truoc-nhap', 'aria-labelledby': 'xt-tieu-de' },
    h('div', { class: 'hop-thoai-dau' },
      h('h2', { id: 'xt-tieu-de' }, '📥 Xem trước nhập bảng phí Shopee'),
      h('button', { class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
    h('p', { class: 'tom-tat-nhap' },
      h('span', { class: 'nhan-nho nhan-xanh' }, `${kq.moi.length} dòng mới`), ' ',
      h('span', { class: 'nhan-nho nhan-vang' }, `${kq.doi.length} dòng thay đổi`), ' ',
      h('span', { class: ['nhan-nho', coLoi ? 'nhan-do' : 'nhan-an'] }, `${kq.loi.length} dòng lỗi`),
      kq.giongCu ? h('span', { class: 'chu-nhat' }, ` · ${kq.giongCu} dòng giống hiện có (bỏ qua)`) : null),
    phan(`Dòng lỗi (${kq.loi.length})`, 'nhom-loi', kq.loi.map((l) => h('li', null, h('b', null, `Dòng ${l.soDong}: `), l.loi.join('; ')))),
    phan(`Dòng mới (${kq.moi.length})`, 'nhom-moi', kq.moi.map((m) => h('li', null, h('b', null, bo(m.banGhi)), ` (dòng ${m.soDong})`))),
    phan(`Dòng thay đổi (${kq.doi.length})`, 'nhom-doi', kq.doi.map((d) => h('li', null, h('b', null, bo(d.banGhi)), ` (dòng ${d.soDong}): `,
      d.oDoi.map((k) => `${tenO(k)} ${dinhDangSo(d.cu[k] ?? 0)} → ${dinhDangSo(d.banGhi[k])}`).join('; ')))),
    coLoi ? h('div', { class: 'ghi-chu ghi-chu-vang' }, 'File còn dòng lỗi — sửa file rồi nhập lại. Chưa ghi gì lên Google Sheets.') : null,
    h('div', { class: 'hang-nut' },
      h('span', { class: 'gian-cach' }),
      h('button', { class: 'nut', onclick: () => dlg.close() }, 'Hủy'),
      nutLuu));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

async function luuNhap(kq, dlg, nut) {
  const banGhi = [...kq.moi, ...kq.doi].map((x) => x.banGhi);
  nut.disabled = true;
  nut.textContent = 'Đang lưu…';
  dangLuu = true;
  try {
    const daLuu = await kho.ghi(SHEET, banGhi);
    dlg.close();
    thongBao(`Đã lưu ${daLuu.length} bộ phí Shopee từ file.`);
    veLai();
  } catch (e) {
    thongBao(`Chưa lưu được: ${e.message}`, 'loi');
    nut.disabled = false;
    nut.textContent = `💾 Lưu ${banGhi.length} bộ phí`;
  } finally {
    dangLuu = false;
  }
}
