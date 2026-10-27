// Danh mục gian hàng / ngành. Danh sách thật lưu ở sheet DANH_MUC; đây là giá trị mặc định khi sheet còn trống.

export const GIAN_MAC_DINH = ['Nhà Sách', 'Sách Hay', 'Tranh Lịch', 'Tường Vip'];
export const NGANH_MAC_DINH = ['Sách', 'Tranh', 'Lịch', 'Decal', 'Trà'];

// Màu pastel cho từng gian (nền, chữ). Gian thêm sau lấy màu theo thứ tự.
const MAU_GIAN = {
  'Nhà Sách': 'bac-ha',
  'Sách Hay': 'oai-huong',
  'Tranh Lịch': 'dao',
  'Tường Vip': 'bo',
};
const MAU_DU_PHONG = ['troi', 'chanh', 'hong', 'xam'];

export function mauGian(ten, danhSach = []) {
  if (MAU_GIAN[ten]) return MAU_GIAN[ten];
  const i = Math.max(0, danhSach.filter((t) => !MAU_GIAN[t]).indexOf(ten));
  return MAU_DU_PHONG[i % MAU_DU_PHONG.length];
}

// Shopee: gian lấy từ DANH_MUC loại GIAN_SHOPEE (6 gian dưới đây là mặc định ban đầu); ngành Shopee cố định.
export const GIAN_SHOPEE_MAC_DINH = ['Nhà Sách', 'CN1', 'CN2', 'Tường Vip', 'Tranh Vip', 'Tường Vip New'];
export const NGANH_SHOPEE = ['Sách', 'Tranh', 'Lịch', 'Decal', 'Trà'];

const MAC_DINH = { GIAN: GIAN_MAC_DINH, NGANH: NGANH_MAC_DINH, GIAN_SHOPEE: GIAN_SHOPEE_MAC_DINH };

/** Danh sách đang dùng (theo thứ tự) từ bản ghi DANH_MUC; trống thì dùng mặc định. loai: GIAN | NGANH | GIAN_SHOPEE */
export function layDanhSach(dsDanhMuc, loai) {
  const ds = (dsDanhMuc || []).filter((d) => d.loai === loai);
  if (!ds.length) return [...(MAC_DINH[loai] || [])];
  return ds
    .filter((d) => d.dang_dung !== 'khong')
    .sort((a, b) => (a.thu_tu ?? 0) - (b.thu_tu ?? 0))
    .map((d) => d.ten);
}
