// Tab Tính lợi nhuận — phần Shopee: mỗi gian 1 cột lãi, tính bằng công thức + bảng phí Shopee (BANG_PHI_SHOPEE).
// Cùng kiểu với bang-tinh.js (TikTok) nhưng tách riêng, không dùng bộ phí / công thức TikTok.
// Dòng: { ten, phan_loai, nganh, gia_von: number|null, gia_ban: number|null }

import { boDau } from './van-ban.js';
import { tinhLaiShopee } from './cong-thuc.js';
import { chonBoPhi } from './phi.js';
import { TIEU_DE_MAU } from './bang-tinh.js';

/**
 * Lãi Shopee của 1 dòng tại 1 gian. Gian × ngành chưa lưu bộ phí Shopee nào ≤ tháng → 'thieu-phi'
 * (giống TikTok, KHÔNG tính bằng phí mặc định).
 * @returns {{trangThai:'ok'|'thieu-gia'|'thieu-phi', lai?, pt?, phi?}}
 */
export function laiTaiGianShopee(dong, gian, dsPhi, thang) {
  if (!Number.isFinite(dong.gia_ban) || dong.gia_ban <= 0) return { trangThai: 'thieu-gia' };
  const phi = chonBoPhi(dsPhi, gian, dong.nganh, thang);
  if (!phi) return { trangThai: 'thieu-phi' };
  return { trangThai: 'ok', phi, ...tinhLaiShopee(dong.gia_von ?? 0, dong.gia_ban, phi) };
}

/** Dòng lỗ = có ít nhất 1 gian (trong các gian đang xem) có lãi < 0. */
export function laDongLoShopee(dong, gians, dsPhi, thang) {
  return gians.some((g) => {
    const r = laiTaiGianShopee(dong, g, dsPhi, thang);
    return r.trangThai === 'ok' && r.lai < 0;
  });
}

/**
 * Lọc + sắp xếp. sapXep = { gian, chieu: 1|-1 } hoặc null (giữ thứ tự nhập). Dòng chưa tính được lãi luôn nằm cuối.
 * @returns mảng chỉ số (vị trí trong ds gốc)
 */
export function locVaSapXepShopee(ds, { gians, dsPhi, thang, chiLo = false, tim = '', sapXep = null }) {
  const t = boDau(tim).trim();
  let chiSo = ds.map((_, i) => i).filter((i) => {
    const d = ds[i];
    if (t && !boDau(`${d.ten} ${d.phan_loai} ${d.nganh}`).includes(t)) return false;
    if (chiLo && !laDongLoShopee(d, gians, dsPhi, thang)) return false;
    return true;
  });
  if (sapXep) {
    const giaTri = new Map(chiSo.map((i) => {
      const r = laiTaiGianShopee(ds[i], sapXep.gian, dsPhi, thang);
      return [i, r.trangThai === 'ok' ? r.lai : null];
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

/** Tổng kết: số dòng, tổng vốn, lãi trung bình (chỉ dòng có giá bán + có phí), số dòng lỗ, số dòng chưa có phí — theo gian. */
export function tongKetShopee(ds, gians, dsPhi, thang) {
  const kq = {
    soDong: ds.length,
    tongVon: ds.reduce((s, d) => s + (Number.isFinite(d.gia_von) ? d.gia_von : 0), 0),
    thieuGiaBan: ds.filter((d) => !Number.isFinite(d.gia_ban) || d.gia_ban <= 0).length,
    theoGian: {},
  };
  for (const g of gians) {
    let n = 0, tong = 0, lo = 0, thieuPhi = 0;
    for (const d of ds) {
      const r = laiTaiGianShopee(d, g, dsPhi, thang);
      if (r.trangThai === 'thieu-phi') thieuPhi++;
      if (r.trangThai !== 'ok') continue;
      n++; tong += r.lai;
      if (r.lai < 0) lo++;
    }
    kq.theoGian[g] = { soDongTinh: n, tb: n ? tong / n : null, soDongLo: lo, thieuPhi };
  }
  return kq;
}

/** Mảng dòng để xuất Excel: 5 cột như file mẫu (nhập lại được) + lãi, % lãi từng gian Shopee. */
export function bangXuatShopee(ds, gians, dsPhi, thang) {
  const tieuDe = [...TIEU_DE_MAU];
  for (const g of gians) tieuDe.push(`${g} - Lãi`, `${g} - % lãi`);
  const tron = (x) => (Number.isFinite(x) ? Math.round(x) : '');
  const pt = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : '');
  return [tieuDe, ...ds.map((d) => {
    const dong = [d.ten, d.phan_loai, d.nganh, d.gia_von ?? '', d.gia_ban ?? ''];
    for (const g of gians) {
      const r = laiTaiGianShopee(d, g, dsPhi, thang);
      if (r.trangThai === 'ok') dong.push(tron(r.lai), pt(r.pt));
      else dong.push(r.trangThai === 'thieu-phi' ? 'chưa có phí' : 'thiếu giá bán', '');
    }
    return dong;
  })];
}
