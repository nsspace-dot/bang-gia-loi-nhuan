// Nhận diện loại + size + giá vốn cho 1 SKU (phạm vi: Laminate, Liễn, Decal).
//
// Thứ tự tìm thông tin: variation_value → seller_sku → product_name.
// Bước 1: loại NGOÀI PHẠM VI trước (lịch, đồng hồ, khung ảnh, khung bằng khen, trà, topping).
// Bước 2: xác định loại (Decal / Liễn / Laminate). Không rõ loại nhưng là tranh hoặc có size → CẦN GÁN.
// Bước 3: đọc size, số tấm/số tranh, tra bảng giá vốn. Không đọc được / không có trong bảng → CẦN GÁN.

import { chuanHoa, boDau, coTu } from './van-ban.js';
import { docSize, chuoiSize } from './size.js';
import { khoaVon } from './gia-von.js';

export const NHOM = {
  LAM_1: 'Bộ 1 tấm',
  LAM_3: 'Bộ 3 tấm đồng size',
  DECAL: 'Decal PP',
  lien: (nep, kho) => `Nẹp ${nep === 'go' ? 'gỗ' : 'nhựa'} khổ ${kho === 'doc' ? 'dọc' : 'ngang'}`,
};

export const LOAI = { DECAL: 'DECAL', LIEN: 'LIEN', LAMINATE: 'LAMINATE' };
export const TEN_LOAI = { DECAL: 'Decal', LIEN: 'Liễn', LAMINATE: 'Laminate' };
const NGANH_CUA_LOAI = { DECAL: 'Decal', LIEN: 'Tranh', LAMINATE: 'Tranh' };

/** Loại của một nhóm giá vốn (dùng khi gán tay). */
export function loaiCuaNhom(nhom) {
  const n = boDau(nhom);
  if (n.includes('decal')) return LOAI.DECAL;
  if (n.startsWith('nep ')) return LOAI.LIEN;
  return LOAI.LAMINATE;
}

function laLien(vb, sku) {
  return /liễn|canvas/.test(vb) || /CAN-/i.test(sku);
}

/**
 * Lý do ngoài phạm vi, hoặc null nếu trong phạm vi.
 * Chỉ xét TÊN SẢN PHẨM: phân loại thường là tên mẫu/hoa văn (vd decal "Mèo uống trà sữa",
 * "Hoa thanh lịch") nên không dùng để loại.
 */
export function lyDoNgoaiPhamVi(sp) {
  const n = chuanHoa(sp.product_name);
  const vb = `${chuanHoa(sp.variation_value)} | ${n}`;
  const sku = String(sp.seller_sku ?? '');
  // "lịch" (trừ "lịch sử", "thanh lịch", "lịch sự", "lịch lãm") — kể cả lịch laminate tráng gương
  if (/(^|[^\p{L}])lịch(?!\s+(sử|sự|lãm))(?=$|[^\p{L}])/u.test(n.replace(/thanh\s+lịch/gu, ''))) return 'Lịch';
  if (/đồng\s+hồ/u.test(n) && !laLien(vb, sku)) return 'Đồng hồ';
  if (coTu(n, 'khung ảnh')) return 'Khung ảnh';
  if (coTu(n, 'khung bằng khen')) return 'Khung bằng khen';
  if (coTu(n, 'trà')) return 'Trà';
  if (coTu(n, 'topping')) return 'Topping';
  return null;
}

/** Loại theo 1 trường chữ. */
function loaiTrongTruong(text, laSku) {
  const t = chuanHoa(text);
  if (!t) return null;
  if (t.includes('decal')) return LOAI.DECAL;
  if (/liễn|canvas|nẹp/.test(t) || (laSku && /can-/.test(t))) return LOAI.LIEN;
  if (/tráng\s+gương|laminate|bo\s+viền/.test(t) || (laSku && /ttt/.test(t))) return LOAI.LAMINATE;
  return null;
}

function soTheoMau(text, mau) {
  const m = boDau(text).match(mau);
  return m ? +m[1] : null;
}

/**
 * @param {object} sp { sku_id, variation_value, seller_sku, product_name }
 * @param {Map} bangVon từ taoBangTraVon()
 * @param {Map} [ganTay] sku_id → { nhom, phan_loai, so_luong }
 */
export function nhanDien(sp, bangVon, ganTay) {
  const truong = [sp.variation_value, sp.seller_sku, sp.product_name];
  const kq = { trangThai: 'GAN', loai: null, nhom: null, phanLoai: null, soLuong: 1, vonDonVi: null, von: null, nganh: null, lyDo: '', suyRaTuTen: [], nguon: 'tu-dong' };

  // Gán tay có ưu tiên cao nhất
  const gt = ganTay && sp.sku_id != null ? ganTay.get(String(sp.sku_id)) : null;
  if (gt) {
    const loai = loaiCuaNhom(gt.nhom);
    Object.assign(kq, { nguon: 'gan-tay', loai, nhom: gt.nhom, phanLoai: gt.phan_loai, soLuong: Math.max(1, +gt.so_luong || 1) });
    return traVon(kq, bangVon, 'Đã gán tay nhưng nhóm/size không còn trong bảng giá vốn');
  }

  const ngoai = lyDoNgoaiPhamVi(sp);
  if (ngoai) return { ...kq, trangThai: 'NGOAI', lyDo: ngoai };

  let loai = null;
  for (let i = 0; i < 3 && !loai; i++) loai = loaiTrongTruong(truong[i], i === 1);

  let size = null;
  for (const t of truong) if ((size = docSize(t))) break;

  if (!loai) {
    const laTranh = coTu(chuanHoa(sp.product_name), 'tranh');
    if (size || laTranh) return { ...kq, lyDo: 'Chưa rõ loại (không có từ khóa Laminate/Liễn/Decal)' };
    return { ...kq, trangThai: 'NGOAI', lyDo: 'Ngành khác' };
  }
  kq.loai = loai;
  if (!size) return { ...kq, lyDo: 'Không đọc được size' };

  const v = sp.variation_value ?? '';
  const sku = String(sp.seller_sku ?? '');
  const ten = sp.product_name ?? '';

  if (loai === LOAI.DECAL) {
    kq.nhom = NHOM.DECAL;
    kq.phanLoai = chuoiSize(size.rong, size.cao);
    kq.soLuong = soTheoMau(v, /x\s*(\d+)\s*tam/) ?? size.nhan ?? 1;
  } else if (loai === LOAI.LIEN) {
    const nep = loaiNep(v, sku) ?? loaiNep(ten, '');
    if (nep && !loaiNep(v, sku)) kq.suyRaTuTen.push('loại nẹp');
    if (!nep) return { ...kq, lyDo: 'Không rõ loại nẹp (gỗ / nhựa)' };
    let combo = soTheoMau(v, /combo\s*(\d+)/) ?? soTheoMau(sku, /\d+x\d+x(\d{1,2})can-/);
    if (combo === null && size.nhan) combo = size.nhan;
    if (combo === null) {
      combo = soTheoMau(ten, /combo\s*(\d+)/);
      if (combo !== null) kq.suyRaTuTen.push('số tranh combo');
    }
    kq.soLuong = combo ?? 1;
    kq.phanLoai = chuoiSize(size.rong, size.cao);
    const kho = size.rong <= size.cao ? 'doc' : 'ngang';
    kq.nhom = NHOM.lien(nep, kho);
    // Size vuông: có thể nằm ở bảng khổ dọc hoặc khổ ngang
    if (size.rong === size.cao && !bangVon.has(khoaVon(kq.nhom, kq.phanLoai))) {
      const khac = NHOM.lien(nep, kho === 'doc' ? 'ngang' : 'doc');
      if (bangVon.has(khoaVon(khac, kq.phanLoai))) kq.nhom = khac;
    }
  } else {
    const vd = chuanHoa(v);
    const bo3TuPhanLoai = size.nhan === 3 || /bộ\s*3\s*tấm|x\s*3\s*tấm/.test(vd);
    const bo3TuTen = !bo3TuPhanLoai && /bộ\s*3\s*tấm/.test(chuanHoa(ten));
    if (bo3TuPhanLoai || bo3TuTen) {
      kq.nhom = NHOM.LAM_3;
      kq.phanLoai = chuoiSize(size.rong, size.cao, 3);
      kq.soLuong = 1;
      if (bo3TuTen) kq.suyRaTuTen.push('bộ 3 tấm');
    } else {
      kq.nhom = NHOM.LAM_1;
      kq.phanLoai = chuoiSize(size.rong, size.cao);
      kq.soLuong = soTheoMau(v, /x\s*(\d+)\s*tam/) ?? size.nhan ?? 1;
    }
  }
  return traVon(kq, bangVon, `Size ${kq.phanLoai} không có trong bảng giá vốn (${kq.nhom})`);
}

function loaiNep(text, sku) {
  const t = chuanHoa(text);
  const s = String(sku ?? '').toUpperCase();
  if (t.includes('nhựa') || /\bnhua\b/.test(boDau(t)) || /NHUA/.test(s)) return 'nhua';
  if (/(^|[^\p{L}])gỗ(?=$|[^\p{L}])/u.test(t) || /-GO\b/.test(s)) return 'go';
  return null;
}

function traVon(kq, bangVon, lyDoThieu) {
  const r = bangVon.get(khoaVon(kq.nhom, kq.phanLoai));
  if (!r || !Number.isFinite(r.gia_von)) return { ...kq, trangThai: 'GAN', lyDo: lyDoThieu };
  return {
    ...kq,
    trangThai: 'OK',
    nganh: r.nganh || NGANH_CUA_LOAI[kq.loai],
    vonDonVi: r.gia_von,
    von: r.gia_von * kq.soLuong,
    lyDo: '',
  };
}
