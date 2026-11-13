// Nhập / xuất Excel bảng phí Shopee — logic thuần (không đụng giao diện, chạy được trong Node để test).
// Mỗi dòng file: Gian hàng | Ngành | Tháng áp dụng | 9 khoản phí Shopee.

import { KHOAN_PHI_SHOPEE, phiShopeeMacDinh } from './cong-thuc.js';
import { chuanHoaThang, laThangHopLe, hienThiThang, khoaPhi } from './phi.js';
import { docSo } from './so.js';
import { NGANH_SHOPEE } from './danh-muc.js';

export const COT_EXCEL_SHOPEE = ['Gian hàng', 'Ngành', 'Tháng áp dụng', ...KHOAN_PHI_SHOPEE.map((k) => `${k.ten} (${k.donVi})`)];

const dongPhi = (p) => [p.gian, p.nganh, hienThiThang(p.thang), ...KHOAN_PHI_SHOPEE.map((k) => p[k.khoa] ?? 0)];

/** Toàn bộ bảng phí Shopee → mảng dòng (có tiêu đề), sắp theo gian, tháng, ngành. */
export function bangXuatPhiShopee(ds) {
  const sx = [...ds].sort((a, b) => a.gian.localeCompare(b.gian, 'vi') || a.thang.localeCompare(b.thang)
    || NGANH_SHOPEE.indexOf(a.nganh) - NGANH_SHOPEE.indexOf(b.nganh));
  return [COT_EXCEL_SHOPEE, ...sx.map(dongPhi)];
}

/** File mẫu: tiêu đề + 5 ngành của 1 gian, giá trị mặc định, tháng cho trước. */
export function bangMauPhiShopee(gian, thang) {
  return [COT_EXCEL_SHOPEE, ...NGANH_SHOPEE.map((n) => dongPhi({ gian, nganh: n, thang, ...phiShopeeMacDinh(n) }))];
}

/** Ô tháng: "10/2026", "2026-10", hoặc số ngày kiểu Excel (ô bị Excel tự đổi thành ngày). */
function docThang(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return chuanHoaThang(v);
}

function loiSo(k, so) {
  if (so === null) return 'không phải số';
  if (so < 0) return 'không được âm';
  if (k.donVi === '%' && so >= 100) return 'phải nhỏ hơn 100%';
  return null;
}

/**
 * Đọc file nhập, so với bảng phí đang có. KHÔNG ghi gì.
 * @param mang  mảng dòng của sheet (dòng đầu là tiêu đề)
 * @param opts  { dsHienCo: bản ghi BANG_PHI_SHOPEE hiện có, gians: danh sách gian Shopee đang dùng }
 * @returns {{ loiFile?: string, moi: Array, doi: Array, giongCu: number, loi: Array }}
 *   moi:  [{ soDong, banGhi }]                  — bộ (gian, ngành, tháng) chưa có
 *   doi:  [{ soDong, banGhi, cu, oDoi:[khoa] }]  — đã có, khác giá trị
 *   loi:  [{ soDong, loi:[chuỗi] }]              — số dòng tính như Excel (dòng tiêu đề = 1)
 */
export function docNhapPhiShopee(mang, { dsHienCo = [], gians = [] } = {}) {
  const kq = { moi: [], doi: [], giongCu: 0, loi: [] };
  const tieuDe = (mang[0] || []).map((x) => String(x).trim().toLowerCase());
  const viTri = COT_EXCEL_SHOPEE.map((c) => tieuDe.indexOf(c.toLowerCase()));
  const thieu = COT_EXCEL_SHOPEE.filter((_, i) => viTri[i] < 0);
  if (thieu.length) return { ...kq, loiFile: `File thiếu cột: ${thieu.join(', ')}. Bấm "File mẫu" để lấy file đúng mẫu.` };

  const hienCo = new Map(dsHienCo.map((p) => [khoaPhi(p), p]));
  const daGap = new Map(); // khóa → số dòng đầu tiên trong file
  mang.slice(1).forEach((d, i) => {
    const soDong = i + 2;
    if (!d || !d.some((x) => String(x ?? '').trim())) return;
    const loi = [];
    const gian = String(d[viTri[0]] ?? '').trim();
    const nganh = String(d[viTri[1]] ?? '').trim();
    const thoThang = d[viTri[2]];
    const thang = docThang(thoThang);
    if (!gian) loi.push('thiếu gian');
    else if (!gians.includes(gian)) loi.push(`gian "${gian}" chưa có trong danh sách gian Shopee (thêm gian trước)`);
    if (!nganh) loi.push('thiếu ngành');
    else if (!NGANH_SHOPEE.includes(nganh)) loi.push(`ngành "${nganh}" không hợp lệ (${NGANH_SHOPEE.join(', ')})`);
    if (!laThangHopLe(thang)) loi.push(`tháng "${thoThang}" không hợp lệ (vd 10/2026)`);
    const banGhi = { gian, nganh, thang };
    KHOAN_PHI_SHOPEE.forEach((k, j) => {
      const tho = d[viTri[3 + j]];
      if (tho === '' || tho === null || tho === undefined || String(tho).trim() === '') { loi.push(`${k.ten}: trống`); return; }
      const so = docSo(tho);
      const l = loiSo(k, so);
      if (l) loi.push(`${k.ten}: ${l}`);
      else banGhi[k.khoa] = so;
    });
    if (!loi.length) {
      const khoa = khoaPhi(banGhi);
      if (daGap.has(khoa)) loi.push(`trùng gian + ngành + tháng với dòng ${daGap.get(khoa)}`);
      else daGap.set(khoa, soDong);
    }
    if (loi.length) { kq.loi.push({ soDong, loi }); return; }
    const cu = hienCo.get(khoaPhi(banGhi));
    if (!cu) { kq.moi.push({ soDong, banGhi }); return; }
    const oDoi = KHOAN_PHI_SHOPEE.map((k) => k.khoa).filter((k) => (cu[k] ?? 0) !== banGhi[k]);
    if (oDoi.length) kq.doi.push({ soDong, banGhi, cu, oDoi });
    else kq.giongCu++;
  });
  return kq;
}
