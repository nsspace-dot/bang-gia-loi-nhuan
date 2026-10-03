// Tab Tính lợi nhuận — logic thuần: đọc file sản phẩm, tính lãi từng dòng theo gian, tổng kết, lọc, sắp xếp, xuất.
// Dòng: { ten, phan_loai, nganh, gia_von: number|null, gia_ban: number|null }

import { docSo } from './so.js';
import { boDau } from './van-ban.js';
import { tinhLai } from './cong-thuc.js';
import { chonBoPhi } from './phi.js';

export const TIEU_DE_MAU = ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán'];

// Nhận diện cột theo TÊN (không đoán theo vị trí). Thứ tự kiểm tra quan trọng:
// "giá vốn"/"giá bán" xét trước "tên", "phân loại" xét trước "loại".
function loaiCot(tieuDe) {
  const t = boDau(tieuDe).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/^(gia von|von|gia goc|cost)\b/.test(t) || t.startsWith('gia von')) return 'gia_von';
  if (/^(gia ban|gia niem yet|gia|price|sell)\b/.test(t) && !t.includes('von')) return 'gia_ban';
  if (/^(phan loai|loai|bien the|variation)\b/.test(t)) return 'phan_loai';
  if (/^(nganh|nganh hang|category)\b/.test(t)) return 'nganh';
  if (/^(ten|ten san pham|san pham|name|product)\b/.test(t)) return 'ten';
  return null;
}

/**
 * Đọc bảng sản phẩm (mảng dòng). Tìm dòng tiêu đề trong 10 dòng đầu.
 * Giá bán TRỐNG thì để null — tuyệt đối không lấy cột khác thay thế.
 * @returns {{dong:Array, canhBao:string[], loi:string|null}}
 */
export function docBangSanPham(mang, { dsNganh = [], nganhMacDinh = '' } = {}) {
  let iTieuDe = -1, cot = null;
  for (let i = 0; i < Math.min(10, mang.length); i++) {
    const c = {};
    (mang[i] || []).forEach((x, j) => { const k = loaiCot(x); if (k && c[k] === undefined) c[k] = j; });
    if (c.ten !== undefined && (c.gia_von !== undefined || c.gia_ban !== undefined)) { iTieuDe = i; cot = c; break; }
  }
  if (iTieuDe < 0) return { dong: [], canhBao: [], loi: 'Không tìm thấy dòng tiêu đề. File cần có cột "Tên sản phẩm" và "Giá vốn" / "Giá bán" (tải file mẫu để xem).' };

  const canhBao = [];
  const nganhLa = new Set();
  const dong = [];
  for (let i = iTieuDe + 1; i < mang.length; i++) {
    const d = mang[i] || [];
    const lay = (k) => (cot[k] === undefined ? '' : d[cot[k]]);
    const ten = String(lay('ten') ?? '').trim();
    if (!ten) continue;
    const kiemSo = (k, nhan) => {
      const tho = lay(k);
      const so = docSo(tho);
      if (so === null && tho !== '' && tho !== null && tho !== undefined && String(tho).trim() !== '') {
        canhBao.push(`Dòng ${i + 1} (${ten}): ${nhan} "${tho}" không phải số — để trống.`);
      }
      return so;
    };
    const thoNganh = String(lay('nganh') ?? '').trim();
    let nganh = dsNganh.find((n) => boDau(n) === boDau(thoNganh)) || '';
    if (!nganh) {
      if (thoNganh) nganhLa.add(thoNganh);
      nganh = nganhMacDinh;
    }
    dong.push({
      ten,
      phan_loai: String(lay('phan_loai') ?? '').trim(),
      nganh,
      gia_von: kiemSo('gia_von', 'giá vốn'),
      gia_ban: kiemSo('gia_ban', 'giá bán'),
    });
  }
  if (nganhLa.size) canhBao.push(`Ngành không có trong danh sách (${[...nganhLa].join(', ')}) — đã dùng ngành mặc định "${nganhMacDinh}".`);
  const thieuBan = dong.filter((r) => r.gia_ban === null).length;
  if (thieuBan) canhBao.push(`${thieuBan} dòng chưa có giá bán — để trống, chưa tính lãi.`);
  return { dong, canhBao, loi: null };
}

/**
 * Lãi của 1 dòng tại 1 gian.
 * @returns {{trangThai:'ok'|'thieu-gia'|'thieu-phi', laiQC?, laiKhongQC?, ptQC?, ptKhongQC?, phi?}}
 */
export function laiTaiGian(dong, gian, dsPhi, thang) {
  if (!Number.isFinite(dong.gia_ban) || dong.gia_ban <= 0) return { trangThai: 'thieu-gia' };
  const phi = chonBoPhi(dsPhi, gian, dong.nganh, thang);
  if (!phi) return { trangThai: 'thieu-phi' };
  return { trangThai: 'ok', phi, ...tinhLai(dong.gia_von ?? 0, dong.gia_ban, phi) };
}

/** Dòng lỗ = có ít nhất 1 gian (trong các gian đang xem) có lãi QC hoặc không QC < 0. */
export function laDongLo(dong, gians, dsPhi, thang) {
  return gians.some((g) => {
    const r = laiTaiGian(dong, g, dsPhi, thang);
    return r.trangThai === 'ok' && (r.laiQC < 0 || r.laiKhongQC < 0);
  });
}

/**
 * Lọc + sắp xếp. sapXep = { gian, kichBan: 'qc'|'khongqc', chieu: 1|-1 } hoặc null (giữ thứ tự nhập).
 * Dòng chưa tính được lãi luôn nằm cuối.
 * @returns mảng chỉ số (vị trí trong ds gốc)
 */
export function locVaSapXep(ds, { gians, dsPhi, thang, chiLo = false, tim = '', sapXep = null }) {
  const t = boDau(tim).trim();
  let chiSo = ds.map((_, i) => i).filter((i) => {
    const d = ds[i];
    if (t && !boDau(`${d.ten} ${d.phan_loai} ${d.nganh}`).includes(t)) return false;
    if (chiLo && !laDongLo(d, gians, dsPhi, thang)) return false;
    return true;
  });
  if (sapXep) {
    const giaTri = new Map(chiSo.map((i) => {
      const r = laiTaiGian(ds[i], sapXep.gian, dsPhi, thang);
      return [i, r.trangThai === 'ok' ? (sapXep.kichBan === 'qc' ? r.laiQC : r.laiKhongQC) : null];
    }));
    chiSo = [...chiSo].sort((a, b) => {
      const x = giaTri.get(a), y = giaTri.get(b);
      if (x === null && y === null) return a - b;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x - y) * sapXep.chieu || a - b;
    });
  }
  return chiSo;
}

/** Tổng kết: số dòng, tổng vốn, lãi trung bình (chỉ tính dòng có giá bán + có phí), số dòng lỗ theo gian. */
export function tongKet(ds, gians, dsPhi, thang) {
  const kq = {
    soDong: ds.length,
    tongVon: ds.reduce((s, d) => s + (Number.isFinite(d.gia_von) ? d.gia_von : 0), 0),
    thieuGiaBan: ds.filter((d) => !Number.isFinite(d.gia_ban) || d.gia_ban <= 0).length,
    theoGian: {},
  };
  for (const g of gians) {
    let n = 0, qc = 0, kqc = 0, lo = 0, thieuPhi = 0;
    for (const d of ds) {
      const r = laiTaiGian(d, g, dsPhi, thang);
      if (r.trangThai === 'thieu-phi') thieuPhi++;
      if (r.trangThai !== 'ok') continue;
      n++; qc += r.laiQC; kqc += r.laiKhongQC;
      if (r.laiQC < 0 || r.laiKhongQC < 0) lo++;
    }
    kq.theoGian[g] = { soDongTinh: n, tbQC: n ? qc / n : null, tbKhongQC: n ? kqc / n : null, soDongLo: lo, thieuPhi };
  }
  return kq;
}

/** Mảng dòng để xuất Excel: 5 cột như file mẫu (nhập lại được) + lãi từng gian. */
export function bangXuat(ds, gians, dsPhi, thang) {
  const tieuDe = [...TIEU_DE_MAU];
  for (const g of gians) tieuDe.push(`${g} - Lãi có QC`, `${g} - % có QC`, `${g} - Lãi không QC`, `${g} - % không QC`);
  const tron = (x) => (Number.isFinite(x) ? Math.round(x) : '');
  const pt = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : '');
  return [tieuDe, ...ds.map((d) => {
    const dong = [d.ten, d.phan_loai, d.nganh, d.gia_von ?? '', d.gia_ban ?? ''];
    for (const g of gians) {
      const r = laiTaiGian(d, g, dsPhi, thang);
      if (r.trangThai === 'ok') dong.push(tron(r.laiQC), pt(r.ptQC), tron(r.laiKhongQC), pt(r.ptKhongQC));
      else dong.push(r.trangThai === 'thieu-phi' ? 'chưa có phí' : 'thiếu giá bán', '', '', '');
    }
    return dong;
  })];
}
