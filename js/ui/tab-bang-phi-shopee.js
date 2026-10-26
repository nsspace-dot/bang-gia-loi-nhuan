// Tab con Bảng phí Shopee: gian × ngành × tháng áp dụng. Lưu ở sheet BANG_PHI_SHOPEE — riêng hoàn toàn với TikTok.
import { h, thayNoiDung, xacNhan, veGiu } from './dom.js';
import { oSo, dangGoDo } from './o-so.js';
import { baoDuLieuMoi, boChoTaiLai } from './du-lieu-moi.js';
import { thongBao } from './thong-bao.js';
import { manTrong } from './linh-vat.js';
import { moCaiDat } from './cai-dat.js';
import * as kho from '../data/kho.js';
import { KHOAN_PHI_SHOPEE, phiShopeeMacDinh, tyLePhiShopee } from '../core/cong-thuc.js';
import { chonBoPhi, cacThangCoPhi, thangHienTai, hienThiThang, chuanHoaThang } from '../core/phi.js';
import { docSo, dinhDangTien, dinhDangSo, dinhDangPhanTram } from '../core/so.js';
import { GIAN_SHOPEE, NGANH_SHOPEE, mauGian } from '../core/danh-muc.js';

const SHEET = 'BANG_PHI_SHOPEE';
const TEN_TAB = 'bang-phi-shopee';

const st = { gian: GIAN_SHOPEE[0], thang: thangHienTai(), nhap: {} }; // nhap[nganh][khoa] = chuỗi người dùng gõ
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
  if (!kho.layCaiDat().url && !dsPhi().length) {
    thayNoiDung(goc, manTrong('Chưa kết nối Google Sheets', 'Nhập URL Apps Script và mật khẩu ở Cài đặt để xem và lưu bảng phí Shopee.',
      h('button', { class: 'nut nut-chinh', onclick: moCaiDat }, '⚙️ Mở Cài đặt')));
    return;
  }
  thayNoiDung(goc,
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null, h('h2', null, 'Bảng phí Shopee'),
          h('p', { class: 'mo-ta' }, 'Phí theo gian hàng × ngành × tháng áp dụng. Lãi = Giá bán − Giá vốn − Phí hạ tầng − Giá bán × tổng các khoản %.'))),
      h('div', { class: 'chon-gian', role: 'tablist', 'aria-label': 'Gian hàng Shopee' },
        GIAN_SHOPEE.map((g) => h('button', {
          class: ['vien-gian', `gian-${mauGian(g, GIAN_SHOPEE)}`, g === st.gian && 'dang-chon'],
          role: 'tab', 'aria-selected': String(g === st.gian),
          onclick: () => doiGianThang(g, st.thang),
        }, g))),
      veChonThang(),
      veThongBaoNguon(),
      veBang(),
      veHangLuu()));
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
  nutLuu.disabled = !ds.length || loi;
  chuLuu.textContent = loi ? 'Có ô nhập sai (tô đỏ) — sửa trước khi lưu.' : ds.length ? `Sẽ lưu phí tháng ${hienThiThang(st.thang)} cho: ${ds.join(', ')}` : 'Chưa có thay đổi.';
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
