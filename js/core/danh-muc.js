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

/** Danh sách đang dùng (theo thứ tự) từ bản ghi DANH_MUC; trống thì dùng mặc định. */
export function layDanhSach(dsDanhMuc, loai) {
  const ds = (dsDanhMuc || []).filter((d) => d.loai === loai);
  if (!ds.length) return loai === 'GIAN' ? [...GIAN_MAC_DINH] : [...NGANH_MAC_DINH];
  return ds
    .filter((d) => d.dang_dung !== 'khong')
    .sort((a, b) => (a.thu_tu ?? 0) - (b.thu_tu ?? 0))
    .map((d) => d.ten);
}
