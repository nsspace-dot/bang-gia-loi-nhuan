// Giá cần đạt (giá bán tối thiểu để có mức lãi mong muốn) cho tab Tính lợi nhuận — mỗi sàn một bộ thiết lập riêng.
// TikTok dùng bảng phí TikTok (giaCanDat, theo kịch bản QC); Shopee dùng bảng phí Shopee (giaCanDatShopee).

import { giaCanDat, giaCanDatShopee } from './cong-thuc.js';
import { chonBoPhi } from './phi.js';
import { lamTronTheoKieu } from './lam-tron.js';

/** Thiết lập mặc định của 1 sàn. donVi: 'pt' (% giá bán) | 'dong' (đ / đơn). kichBan chỉ dùng cho TikTok. */
export const MUC_TIEU_MAC_DINH = { bat: false, giaTri: 15, donVi: 'pt', kichBan: 'ca2', lamTron: 'len1000' };
/** Mức lãi mặc định theo đơn vị: 15% giá bán, hoặc 10.000 đ / đơn. */
export const MUC_LAI_MAC_DINH = { pt: 15, dong: 10000 };

/** Làm sạch thiết lập đọc từ bộ nhớ máy (giá trị lạ → mặc định). */
export function chuanMucTieu(x) {
  const m = { ...MUC_TIEU_MAC_DINH };
  if (!x || typeof x !== 'object') return m;
  m.bat = x.bat === true;
  if (['pt', 'dong'].includes(x.donVi)) m.donVi = x.donVi;
  if (['qc', 'khongqc', 'ca2'].includes(x.kichBan)) m.kichBan = x.kichBan;
  if (['len1000', 'duoi9000', 'khong'].includes(x.lamTron)) m.lamTron = x.lamTron;
  const g = typeof x.giaTri === 'number' ? x.giaTri : NaN;
  m.giaTri = loiMucLai(g, m.donVi) ? MUC_LAI_MAC_DINH[m.donVi] : g;
  return m;
}

/** Lỗi của mức lãi người dùng nhập, null nếu hợp lệ. */
export function loiMucLai(giaTri, donVi) {
  if (giaTri === null || !Number.isFinite(giaTri)) return 'Không phải số';
  if (giaTri < 0) return 'Không được âm';
  if (donVi === 'pt' && giaTri >= 100) return 'Phải nhỏ hơn 100%';
  return null;
}

const tuyChonLai = (mt) => (mt.donVi === 'pt' ? { laiPhanTram: mt.giaTri / 100 } : { laiDong: mt.giaTri });

/**
 * @returns {{trangThai:'ok'|'thieu-von'|'thieu-phi'|'khong-dat', gia?:number, thieu?:number|null}}
 *   gia: đã làm tròn theo mt.lamTron. thieu: gia − giá bán khi giá bán đang THẤP hơn (null nếu chưa có giá bán / đã đạt).
 */
function ketQua(dong, phi, tinh, mt) {
  if (!Number.isFinite(dong.gia_von)) return { trangThai: 'thieu-von' };
  if (!phi) return { trangThai: 'thieu-phi' };
  const tho = tinh(phi);
  if (tho === null) return { trangThai: 'khong-dat' };
  const gia = lamTronTheoKieu(tho, mt.lamTron);
  const coGia = Number.isFinite(dong.gia_ban) && dong.gia_ban > 0;
  return { trangThai: 'ok', gia, thieu: coGia && dong.gia_ban < gia ? gia - dong.gia_ban : null };
}

export function giaCanDatTikTok(dong, gian, dsPhi, thang, mt) {
  const phi = chonBoPhi(dsPhi, gian, dong.nganh, thang);
  return ketQua(dong, phi, (p) => giaCanDat(dong.gia_von, p, { kichBan: mt.kichBan, ...tuyChonLai(mt) }), mt);
}

export function giaCanDatShopeeTaiGian(dong, gian, dsPhi, thang, mt) {
  const phi = chonBoPhi(dsPhi, gian, dong.nganh, thang);
  return ketQua(dong, phi, (p) => giaCanDatShopee(dong.gia_von, p, tuyChonLai(mt)), mt);
}

/** Số dòng đang có giá bán thấp hơn giá cần đạt, theo gian. */
export function demDuoiGiaCanDat(ds, gians, tinhGia) {
  const kq = {};
  for (const g of gians) kq[g] = ds.filter((d) => { const r = tinhGia(d, g); return r.trangThai === 'ok' && r.thieu !== null; }).length;
  return kq;
}
