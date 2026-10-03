// Các kiểu làm tròn giá. Đơn vị: đồng.

const EPS = 1e-6;

export function lamTronLen(x, buoc = 1000) {
  return Math.ceil(x / buoc - EPS) * buoc;
}

export function lamTronXuong(x, buoc = 1000) {
  return Math.floor(x / buoc + EPS) * buoc;
}

/** Số nhỏ nhất ≥ x có đuôi 9.000 (vd 71.200 → 79.000; 79.000 → 79.000). */
export function lamTronDuoi9000(x) {
  return Math.ceil((x - 9000) / 10000 - EPS) * 10000 + 9000;
}

/** Số làm tròn lớn nhất mà vẫn NHỎ HƠN hẳn trần (vd trần 107.800, bước 1.000 → 107.000; trần 108.000 → 107.000). */
export function satDuoiTran(tran, buoc = 1000) {
  return Math.ceil(tran / buoc - EPS) * buoc - buoc;
}

/** kieu: 'len1000' | 'duoi9000' | 'khong' */
export function lamTronTheoKieu(x, kieu) {
  if (x === null || !Number.isFinite(x)) return null;
  if (kieu === 'len1000') return lamTronLen(x, 1000);
  if (kieu === 'duoi9000') return lamTronDuoi9000(x);
  return x;
}
