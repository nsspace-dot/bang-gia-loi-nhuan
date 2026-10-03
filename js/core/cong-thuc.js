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
