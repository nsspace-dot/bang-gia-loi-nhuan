// CÔNG THỨC DUY NHẤT — mọi tab đều tính lãi qua module này.
//
// Bộ phí (phi) lưu phần trăm dạng số thường: phi_san = 23.4 nghĩa là 23,4%.
//   Phí cố định     = phi_vc + phi_xl
//   Lãi có QC       = Giá − Vốn − Phí cố định − Giá × (Sàn + QC + AFF có QC)
//   Lãi không QC    = Giá − Vốn − Phí cố định − Giá × (Sàn + AFF không QC)
//   % lãi           = Lãi / Giá
//   Giá cần đạt lãi m (% giá), tổng phí % = a:   Giá = (Vốn + Phí cố định) / (1 − a − m)
//   Giá cần đạt lãi L (đ/đơn):                   Giá = (Vốn + Phí cố định + L) / (1 − a)
//   "Cả 2 kịch bản": a = MAX(a có QC, a không QC)

export const KHOAN_PHI = [
  { khoa: 'phi_san', ten: 'Phí sàn', donVi: '%' },
  { khoa: 'phi_vc', ten: 'Phí bồi hoàn V/C', donVi: 'đ' },
  { khoa: 'phi_xl', ten: 'Phí xử lý đơn hàng', donVi: 'đ' },
  { khoa: 'phi_qc', ten: 'Chi phí QC', donVi: '%' },
  { khoa: 'aff_qc', ten: 'AFF có QC', donVi: '%' },
  { khoa: 'aff_noqc', ten: 'AFF không QC', donVi: '%' },
];

const so = (x) => (Number.isFinite(+x) ? +x : 0);

export function phiCoDinh(phi) {
  return so(phi.phi_vc) + so(phi.phi_xl);
}

/** Tổng phí % (dạng tỉ lệ 0..1) của kịch bản có QC. */
export function tyLePhiQC(phi) {
  return (so(phi.phi_san) + so(phi.phi_qc) + so(phi.aff_qc)) / 100;
}

/** Tổng phí % (dạng tỉ lệ 0..1) của kịch bản không QC. */
export function tyLePhiKhongQC(phi) {
  return (so(phi.phi_san) + so(phi.aff_noqc)) / 100;
}

/** Tỉ lệ phí theo kịch bản: 'qc' | 'khongqc' | 'ca2'. */
export function tyLePhi(phi, kichBan) {
  if (kichBan === 'qc') return tyLePhiQC(phi);
  if (kichBan === 'khongqc') return tyLePhiKhongQC(phi);
  return Math.max(tyLePhiQC(phi), tyLePhiKhongQC(phi));
}

/**
 * Tính lãi cho 1 sản phẩm.
 * @returns {{laiQC:number, laiKhongQC:number, ptQC:number|null, ptKhongQC:number|null}}
 */
export function tinhLai(von, gia, phi) {
  von = so(von);
  gia = so(gia);
  const coDinh = phiCoDinh(phi);
  const laiQC = gia - von - coDinh - gia * tyLePhiQC(phi);
  const laiKhongQC = gia - von - coDinh - gia * tyLePhiKhongQC(phi);
  return {
    laiQC,
    laiKhongQC,
    ptQC: gia > 0 ? laiQC / gia : null,
    ptKhongQC: gia > 0 ? laiKhongQC / gia : null,
  };
}

/**
 * Giá tối thiểu để đạt mức lãi mong muốn.
 * @param {object} tuyChon { kichBan: 'qc'|'khongqc'|'ca2', laiPhanTram?: 0.15, laiDong?: 10000 }
 * @returns {number|null} null nếu không thể đạt (tổng phí + lãi ≥ 100%)
 */
export function giaCanDat(von, phi, tuyChon = {}) {
  const a = tyLePhi(phi, tuyChon.kichBan || 'ca2');
  const m = so(tuyChon.laiPhanTram);
  const L = so(tuyChon.laiDong);
  const mauSo = 1 - a - m;
  if (mauSo <= 0) return null;
  return (so(von) + phiCoDinh(phi) + L) / mauSo;
}

/** Giá hòa vốn (lãi = 0) theo kịch bản. */
export function giaHoaVon(von, phi, kichBan = 'ca2') {
  return giaCanDat(von, phi, { kichBan });
}

// ---------- SHOPEE — bộ phí và công thức RIÊNG, không dùng chung với TikTok ----------
//   Lãi Shopee = Giá − Vốn − Phí hạ tầng − Giá × (tổng 8 khoản %) / 100

export const KHOAN_PHI_SHOPEE = [
  { khoa: 'phi_co_dinh', ten: 'Phí cố định', donVi: '%' },
  { khoa: 'voucher_xtra', ten: 'Voucher Xtra', donVi: '%' },
  { khoa: 'phi_ha_tang', ten: 'Phí hạ tầng', donVi: 'đ' },
  { khoa: 'phi_xu_ly', ten: 'Phí xử lý', donVi: '%' },
  { khoa: 'phi_dich_vu', ten: 'Phí dịch vụ', donVi: '%' },
  { khoa: 'quang_cao', ten: 'Quảng cáo', donVi: '%' },
  { khoa: 'voucher_shop', ten: 'Voucher shop', donVi: '%' },
  { khoa: 'aff', ten: 'AFF', donVi: '%' },
  { khoa: 'phi_hoan_vcktc', ten: 'Phí hoàn V/C KTC', donVi: '%' },
];

/** Bộ phí Shopee mặc định của 1 ngành (dùng khi gian × ngành chưa lưu bộ phí nào). */
export function phiShopeeMacDinh(nganh) {
  return {
    phi_co_dinh: nganh === 'Lịch' ? 18.7 : 19.1,
    voucher_xtra: 5.5,
    phi_ha_tang: 3000,
    phi_xu_ly: 6,
    phi_dich_vu: 7.5,
    quang_cao: 8.2,
    voucher_shop: 1.2,
    aff: 2,
    phi_hoan_vcktc: 0.5,
  };
}

/** Tổng 8 khoản % của Shopee (dạng tỉ lệ 0..1). */
export function tyLePhiShopee(phi) {
  return KHOAN_PHI_SHOPEE.filter((k) => k.donVi === '%').reduce((t, k) => t + so(phi[k.khoa]), 0) / 100;
}

/** Tính lãi Shopee cho 1 sản phẩm. @returns {{lai:number, pt:number|null}} */
export function tinhLaiShopee(von, gia, phi) {
  von = so(von);
  gia = so(gia);
  const lai = gia - von - so(phi.phi_ha_tang) - gia * tyLePhiShopee(phi);
  return { lai, pt: gia > 0 ? lai / gia : null };
}
