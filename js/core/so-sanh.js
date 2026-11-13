// So sánh lãi 1 sản phẩm ở 2 sàn (tab "So sánh 2 sàn"): TikTok (bảng phí + công thức TikTok, 1 kịch bản QC)
// đối chiếu Shopee (bảng phí + công thức Shopee). Cùng giá vốn, cùng giá bán.

import { laiTaiGian, TIEU_DE_MAU } from './bang-tinh.js';
import { laiTaiGianShopee } from './bang-tinh-shopee.js';

/** Chênh lệch nhỏ hơn mức này (đ / đơn) coi là ngang nhau. */
export const NGUONG_NGANG = 1000;

/**
 * @param cd { gianTT, kichBanTT: 'qc'|'khongqc', dsPhiTT, gianSP, dsPhiSP, thang }
 * @returns {{ tiktok: {trangThai, lai?, pt?}, shopee: {trangThai, lai?, pt?}, chenh: number|null, nen: 'tiktok'|'shopee'|'ngang'|null }}
 *   chenh = lãi Shopee − lãi TikTok (dương: Shopee lời hơn). null khi 1 bên chưa tính được.
 */
export function soSanhDong(dong, cd) {
  const rt = laiTaiGian(dong, cd.gianTT, cd.dsPhiTT, cd.thang);
  const tiktok = rt.trangThai === 'ok'
    ? { trangThai: 'ok', lai: cd.kichBanTT === 'qc' ? rt.laiQC : rt.laiKhongQC, pt: cd.kichBanTT === 'qc' ? rt.ptQC : rt.ptKhongQC }
    : { trangThai: rt.trangThai };
  const rs = laiTaiGianShopee(dong, cd.gianSP, cd.dsPhiSP, cd.thang);
  const shopee = rs.trangThai === 'ok' ? { trangThai: 'ok', lai: rs.lai, pt: rs.pt } : { trangThai: rs.trangThai };
  if (tiktok.trangThai !== 'ok' || shopee.trangThai !== 'ok') return { tiktok, shopee, chenh: null, nen: null };
  const chenh = shopee.lai - tiktok.lai;
  return { tiktok, shopee, chenh, nen: Math.abs(chenh) < NGUONG_NGANG ? 'ngang' : chenh > 0 ? 'shopee' : 'tiktok' };
}

/** Tổng kết: số dòng so được, lời hơn ở mỗi sàn / ngang, lãi TB mỗi sàn, chênh lệch TB. */
export function tongHopSoSanh(ds, cd) {
  const kq = { soDong: ds.length, soSanhDuoc: 0, tiktok: 0, shopee: 0, ngang: 0, tbTT: null, tbSP: null, tbChenh: null };
  let tt = 0, sp = 0;
  for (const d of ds) {
    const r = soSanhDong(d, cd);
    if (r.nen === null) continue;
    kq.soSanhDuoc++;
    kq[r.nen]++;
    tt += r.tiktok.lai;
    sp += r.shopee.lai;
  }
  if (kq.soSanhDuoc) {
    kq.tbTT = tt / kq.soSanhDuoc;
    kq.tbSP = sp / kq.soSanhDuoc;
    kq.tbChenh = kq.tbSP - kq.tbTT;
  }
  return kq;
}

/** Thứ tự dòng: theo chênh lệch (chieu 1 tăng / -1 giảm), dòng chưa so được luôn cuối; null = giữ thứ tự nhập. */
export function sapXepSoSanh(ds, cd, chieu = null) {
  const chiSo = ds.map((_, i) => i);
  if (!chieu) return chiSo;
  const ch = new Map(chiSo.map((i) => [i, soSanhDong(ds[i], cd).chenh]));
  return chiSo.sort((a, b) => {
    const x = ch.get(a), y = ch.get(b);
    if (x === null && y === null) return a - b;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * chieu || a - b;
  });
}

const NHAN_NEN = { tiktok: 'TikTok', shopee: 'Shopee', ngang: 'Ngang' };
const LY_DO = { 'thieu-gia': 'thiếu giá bán', 'thieu-phi': 'chưa có phí' };

/** Mảng dòng để xuất Excel: 5 cột như file mẫu (nhập lại được) + lãi 2 sàn + chênh lệch + nên bán. */
export function bangXuatSoSanh(ds, cd) {
  const tron = (x) => (Number.isFinite(x) ? Math.round(x) : '');
  const pt = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : '');
  const qc = cd.kichBanTT === 'qc' ? 'có QC' : 'không QC';
  const dau = [...TIEU_DE_MAU, `TikTok ${cd.gianTT} (${qc}) - Lãi`, `TikTok ${cd.gianTT} - % lãi`, `Shopee ${cd.gianSP} - Lãi`, `Shopee ${cd.gianSP} - % lãi`, 'Chênh lệch (Shopee − TikTok)', 'Nên bán'];
  return [dau, ...ds.map((d) => {
    const r = soSanhDong(d, cd);
    const ben = (x) => (x.trangThai === 'ok' ? [tron(x.lai), pt(x.pt)] : [LY_DO[x.trangThai] || '', '']);
    return [d.ten, d.phan_loai, d.nganh, d.gia_von ?? '', d.gia_ban ?? '', ...ben(r.tiktok), ...ben(r.shopee), tron(r.chenh), r.nen ? NHAN_NEN[r.nen] : ''];
  })];
}
