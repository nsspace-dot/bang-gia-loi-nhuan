// Tab Set giá — logic thuần: giá đề xuất theo mức lãi mong muốn, hòa vốn, mức giảm tối đa, kiểm tra bậc giá.
// Dòng vào: bản ghi giá vốn { nhom, phan_loai, nganh, gia_von }.

import { tinhLai, giaCanDat, giaHoaVon } from './cong-thuc.js';
import { lamTronTheoKieu } from './lam-tron.js';
import { docPhanLoai, lonHon } from './size.js';
import { chuanHoa } from './van-ban.js';
import { khoaVon } from './gia-von.js';
import { TIEU_DE_MAU } from './bang-tinh.js';

const NHOM_1_TAM = chuanHoa('Bộ 1 tấm');
const NHOM_3_TAM = chuanHoa('Bộ 3 tấm đồng size');

/**
 * @param {Array} dsVon bản ghi giá vốn
 * @param {(nganh:string)=>object|null} layPhi trả bộ phí của ngành (đã chọn gian + tháng)
 * @param {object} cd { kieuLai: 'pt'|'dong', lai: number (pt: 0.15 = 15%; dong: số đ), kichBan: 'qc'|'khongqc'|'ca2', lamTron: 'len1000'|'duoi9000'|'khong' }
 */
export function tinhSetGia(dsVon, layPhi, cd) {
  return dsVon.map((r) => {
    const dong = { nhom: r.nhom, phan_loai: r.phan_loai, nganh: r.nganh, von: r.gia_von, loi: null };
    if (!Number.isFinite(r.gia_von)) return { ...dong, loi: 'Giá vốn trống' };
    const phi = layPhi(r.nganh);
    if (!phi) return { ...dong, loi: `Chưa có bộ phí ngành "${r.nganh || '—'}"` };
    const tho = giaCanDat(r.gia_von, phi, {
      kichBan: cd.kichBan,
      laiPhanTram: cd.kieuLai === 'pt' ? cd.lai : 0,
      laiDong: cd.kieuLai === 'dong' ? cd.lai : 0,
    });
    if (tho === null) return { ...dong, phi, loi: 'Không đạt được: tổng phí + lãi mong muốn ≥ 100% giá' };
    const hoaVon = giaHoaVon(r.gia_von, phi, cd.kichBan);
    return { ...dong, phi, giaToiThieu: tho, giaDeXuat: lamTronTheoKieu(tho, cd.lamTron), hoaVon };
  });
}

/** Lãi + hòa vốn + mức giảm tối đa tại một mức giá cụ thể (giá đề xuất hoặc giá chốt tay). */
export function chiTietTaiGia(dong, gia) {
  if (dong.loi || !Number.isFinite(gia) || gia <= 0) return null;
  const lai = tinhLai(dong.von, gia, dong.phi);
  const giamDong = gia - dong.hoaVon;
  return { ...lai, giamToiDaDong: giamDong, giamToiDa: dong.hoaVon !== null ? giamDong / gia : null };
}

/**
 * Kiểm tra bậc giá.
 *  - Cùng nhóm: size lớn hơn phải có giá ≥ size nhỏ hơn.
 *  - Bộ 3 tấm đồng size phải rẻ hơn 3 × Bộ 1 tấm cùng size (lấy giá Bộ 1 tấm từ dsThamChieu nếu không có trong ds).
 * @param giaCua (dong) => giá đang dùng
 * @returns Map khoaVon → [lời cảnh báo]
 */
export function kiemTraBacGia(ds, giaCua, dsThamChieu = []) {
  const kq = new Map();
  const them = (d, chu) => {
    const k = khoaVon(d.nhom, d.phan_loai);
    if (!kq.has(k)) kq.set(k, []);
    kq.get(k).push(chu);
  };
  const coGia = ds.filter((d) => !d.loi && Number.isFinite(giaCua(d))).map((d) => ({ d, sz: docPhanLoai(d.phan_loai), gia: giaCua(d) })).filter((x) => x.sz);

  for (const a of coGia) {
    for (const b of coGia) {
      if (a !== b && chuanHoa(a.d.nhom) === chuanHoa(b.d.nhom) && lonHon(a.sz, b.sz) && a.gia < b.gia) {
        them(a.d, `Size ${a.d.phan_loai} lớn hơn ${b.d.phan_loai} nhưng giá thấp hơn (${a.gia.toLocaleString('vi-VN')} < ${b.gia.toLocaleString('vi-VN')})`);
      }
    }
  }

  const gia1Tam = new Map();
  for (const x of [...dsThamChieu, ...coGia.map((c) => ({ d: c.d, gia: c.gia }))]) {
    const d = x.d || x;
    const gia = x.gia ?? giaCua(d);
    if (chuanHoa(d.nhom) === NHOM_1_TAM && Number.isFinite(gia)) gia1Tam.set(String(d.phan_loai).toLowerCase().replace(/\s+/g, ''), gia);
  }
  for (const a of coGia) {
    if (chuanHoa(a.d.nhom) !== NHOM_3_TAM) continue;
    const g1 = gia1Tam.get(`${a.sz.rong}x${a.sz.cao}`);
    if (g1 !== undefined && a.gia >= 3 * g1) {
      them(a.d, `Bộ 3 tấm ${a.d.phan_loai} (${a.gia.toLocaleString('vi-VN')}) không rẻ hơn 3 × bộ 1 tấm ${a.sz.rong}x${a.sz.cao} (${(3 * g1).toLocaleString('vi-VN')})`);
    }
  }
  return kq;
}

/** File xuất theo MẪU NHẬP của tab Tính lợi nhuận (5 cột): Giá bán = giá đang dùng. */
export function bangXuatTheoMau(ds, giaCua) {
  return [TIEU_DE_MAU, ...ds.filter((d) => !d.loi).map((d) => [d.nhom, d.phan_loai, d.nganh, d.von, Number.isFinite(giaCua(d)) ? giaCua(d) : ''])];
}
