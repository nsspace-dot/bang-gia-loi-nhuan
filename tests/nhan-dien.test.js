// Test nhận diện — tên sản phẩm, SKU và giá vốn đều là dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nhanDien, lyDoNgoaiPhamVi } from '../js/core/nhan-dien.js';
import { taoBangTraVon } from '../js/core/gia-von.js';

const VON = taoBangTraVon([
  { nhom: 'Bộ 1 tấm', phan_loai: '30x40', nganh: 'Tranh', gia_von: 1000 },
  { nhom: 'Bộ 1 tấm', phan_loai: '40x60', nganh: 'Tranh', gia_von: 2000 },
  { nhom: 'Bộ 3 tấm đồng size', phan_loai: '20x30x3', nganh: 'Tranh', gia_von: 3000 },
  { nhom: 'Bộ 3 tấm đồng size', phan_loai: '30x40x3', nganh: 'Tranh', gia_von: 3500 },
  { nhom: 'Nẹp gỗ khổ dọc', phan_loai: '30x40', nganh: 'Tranh', gia_von: 400 },
  { nhom: 'Nẹp gỗ khổ dọc', phan_loai: '40x60', nganh: 'Tranh', gia_von: 600 },
  { nhom: 'Nẹp nhựa khổ dọc', phan_loai: '30x60', nganh: 'Tranh', gia_von: 300 },
  { nhom: 'Nẹp nhựa khổ ngang', phan_loai: '80x40', nganh: 'Tranh', gia_von: 800 },
  { nhom: 'Nẹp gỗ khổ ngang', phan_loai: '80x80', nganh: 'Tranh', gia_von: 900 },
  { nhom: 'Decal PP', phan_loai: '50x70', nganh: 'Decal', gia_von: 100 },
  { nhom: 'Decal PP', phan_loai: '60x90', nganh: 'Decal', gia_von: 200 },
  { nhom: 'Decal PP', phan_loai: '60x150', nganh: 'Decal', gia_von: 250 },
]);

const sp = (variation_value, product_name, seller_sku = '', sku_id = 'X') => ({ sku_id, variation_value, product_name, seller_sku });
const nd = (...a) => nhanDien(sp(...a), VON);

// ---------- NGOÀI PHẠM VI (xét trước Laminate/Liễn/Decal) ----------

test('lịch laminate tráng gương → ngoài phạm vi, KHÔNG nhận thành tranh laminate', () => {
  const r = nd('M01, BLOC ĐẠI 10x15 CM', '[LỊCH TẾT 2099] Lịch Laminate Treo Tường 40x60cm - Mẫu Thử', '40X60B99X99');
  assert.equal(r.trangThai, 'NGOAI');
  assert.equal(r.lyDo, 'Lịch');
  assert.equal(nd('M02', 'LỊCH TREO TƯỜNG TRÁNG GƯƠNG BO VIỀN 30x40').trangThai, 'NGOAI');
});

test('"lịch sử" KHÔNG bị coi là lịch', () => {
  const r = nd('Mẫu 1, 30x40cm', 'Tranh Tráng Gương Chủ Đề Lịch Sử Việt Nam');
  assert.equal(r.trangThai, 'OK');
  assert.equal(r.nhom, 'Bộ 1 tấm');
});

test('đồng hồ → ngoài phạm vi', () => {
  assert.equal(nd('Mẫu 1, 30x60cm', 'Tranh Đồng Hồ Tráng Gương Treo Tường').lyDo, 'Đồng hồ');
});

test('đồng hồ nhưng tên có "liễn"/"canvas" hoặc seller_sku có CAN- → vẫn là Liễn', () => {
  const a = nd('Mẫu 6, 30 X 40 CM, Nẹp gỗ', 'Tranh Liễn Mẫu Thử Trang Trí Phòng Khách - Đồng Hồ Cát');
  assert.equal(a.trangThai, 'OK');
  assert.equal(a.loai, 'LIEN');
  const b = nd('Mẫu 6, 30x40cm', 'Tranh Đồng Hồ Mẫu Thử', '30X40CAN-GO');
  assert.equal(b.loai, 'LIEN');
  assert.equal(b.nhom, 'Nẹp gỗ khổ dọc');
  const c = nd('Mẫu 1, 30x40cm, Nẹp gỗ', 'Tranh Vải Canvas Đồng Hồ Thử');
  assert.equal(c.loai, 'LIEN');
});

test('khung ảnh, khung bằng khen, trà, topping → ngoài phạm vi', () => {
  assert.equal(nd('Mẫu 1, 20x30', 'Khung Ảnh Để Bàn Gỗ').lyDo, 'Khung ảnh');
  assert.equal(nd('Mẫu 1, 21x30', 'Khung Bằng Khen A4 Mẫu Thử').lyDo, 'Khung bằng khen');
  assert.equal(nd('COMBO 5 GÓI', 'Trà Thử Nghiệm 500G').lyDo, 'Trà');
  assert.equal(nd('Gói 1kg', 'Topping Trân Châu Thử').lyDo, 'Topping');
});

test('tên mẫu trong PHÂN LOẠI có chữ "trà"/"thanh lịch" không làm decal bị loại', () => {
  assert.equal(nd('Cún uống trà, 60x90 x 2 TẤM', 'Decal Dán Tủ Thử').trangThai, 'OK');
  assert.equal(nd('Hoa thanh lịch, 50x70', 'Decal Dán Tường Thử').trangThai, 'OK');
  assert.equal(nd('Mẫu 1, 50x70', 'Decal Dán Tường Phong Cách Thanh Lịch').trangThai, 'OK');
});

test('"tráng gương" không bị nhầm với "trà"', () => {
  assert.equal(lyDoNgoaiPhamVi(sp('Mẫu 1, 30x40', 'Tranh Tráng Gương Thử')), null);
});

test('không có từ khóa và không phải tranh → ngoài phạm vi (ngành khác)', () => {
  assert.equal(nd('Màu đỏ', 'Tượng Gốm Để Bàn').trangThai, 'NGOAI');
});

// ---------- DECAL ----------

test('decal: số tấm', () => {
  const a = nd('HOA THỬ, 50x70 x 1 TẤM', 'Decal Dán Tường Thử');
  assert.deepEqual([a.trangThai, a.nhom, a.phanLoai, a.soLuong, a.von, a.nganh], ['OK', 'Decal PP', '50x70', 1, 100, 'Decal']);
  const b = nd('HOA THỬ, 60x90 x 3 TẤM', 'Decal Dán Tường Thử');
  assert.deepEqual([b.soLuong, b.von], [3, 600]);
  const c = nd('HOA THỬ, 60x90', 'Decal Dán Tường Thử');
  assert.equal(c.soLuong, 1);
});

test('decal nhận theo seller_sku kết thúc bằng DECAL', () => {
  const r = nd('Mẫu 1', 'Giấy Dán Thử', '60X150DECAL');
  assert.deepEqual([r.loai, r.phanLoai, r.trangThai], ['DECAL', '60x150', 'OK']);
});

// ---------- LIỄN ----------

test('liễn: combo 2 nẹp gỗ', () => {
  const r = nd('Combo 2 tranh nẹp gỗ, 40x60cm', 'Tranh Liễn Thử');
  assert.deepEqual([r.nhom, r.phanLoai, r.soLuong, r.von], ['Nẹp gỗ khổ dọc', '40x60', 2, 1200]);
});

test('liễn: (COMBO 3) nẹp nhựa', () => {
  const r = nd('Nẹp Nhựa Chữ Thử (COMBO 3), 30x60cm', 'Tranh Liễn Thư Pháp Thử');
  assert.deepEqual([r.nhom, r.soLuong, r.von], ['Nẹp nhựa khổ dọc', 3, 900]);
});

test('liễn: combo theo seller_sku 30X40X3CAN-GO', () => {
  const r = nd('Mẫu 1, 30x40cm', 'Tranh Canvas Thử', '30X40X3CAN-GO');
  assert.deepEqual([r.nhom, r.soLuong, r.von], ['Nẹp gỗ khổ dọc', 3, 1200]);
});

test('liễn khổ ngang: rộng > cao', () => {
  const r = nd('Nẹp nhựa, 80x40cm', 'Tranh Liễn Thử');
  assert.deepEqual([r.nhom, r.phanLoai, r.trangThai], ['Nẹp nhựa khổ ngang', '80x40', 'OK']);
});

test('liễn size vuông: tìm cả bảng khổ dọc và khổ ngang', () => {
  const r = nd('Nẹp gỗ, 80x80cm', 'Tranh Liễn Thử');
  assert.deepEqual([r.nhom, r.trangThai], ['Nẹp gỗ khổ ngang', 'OK']);
});

test('liễn không ghi loại nẹp → cần gán', () => {
  const r = nd('Mẫu 01, 30x40cm', 'Tranh Liễn Câu Đối Thử');
  assert.equal(r.trangThai, 'GAN');
  assert.match(r.lyDo, /nẹp/);
});

// ---------- LAMINATE ----------

test('laminate 1 tấm', () => {
  const r = nd('Mẫu 03, 30x40cm', 'Tranh Laminate Tráng Gương Thử');
  assert.deepEqual([r.loai, r.nhom, r.phanLoai, r.von, r.nganh], ['LAMINATE', 'Bộ 1 tấm', '30x40', 1000, 'Tranh']);
});

test('laminate bộ 3 tấm: "20x30x3cm"', () => {
  const r = nd('Mẫu 14, 20x30x3cm', 'Tranh Bo Viền Thử');
  assert.deepEqual([r.nhom, r.phanLoai, r.soLuong, r.von], ['Bộ 3 tấm đồng size', '20x30x3', 1, 3000]);
});

test('laminate bộ 3 tấm: "30x40cm x 3 tấm"', () => {
  const r = nd('Mẫu 01, 30x40cm x 3 tấm', 'Tranh Tráng Gương Thử');
  assert.deepEqual([r.nhom, r.phanLoai, r.trangThai], ['Bộ 3 tấm đồng size', '30x40x3', 'OK']);
  assert.deepEqual(r.suyRaTuTen, []);
});

test('laminate: tên có "(Bộ 3 tấm)", phân loại chỉ 1 size → bộ 3 tấm, có nhãn "suy ra từ tên"', () => {
  const r = nd('Mẫu 01, 30x40cm', 'Tranh Chữ Thử (Bộ 3 tấm) - Tranh Laminate Tráng Gương');
  assert.deepEqual([r.nhom, r.phanLoai], ['Bộ 3 tấm đồng size', '30x40x3']);
  assert.deepEqual(r.suyRaTuTen, ['bộ 3 tấm']);
});

test('laminate nhận theo seller_sku có TTT', () => {
  assert.equal(nd('Mẫu 10, 30X40CM', 'Tranh Treo Tường Thử', '30X40TTT').loai, 'LAMINATE');
});

test('laminate: x 2 tấm → Bộ 1 tấm × 2', () => {
  const r = nd('Mẫu 1, 40x60 x 2 tấm', 'Tranh Tráng Gương Thử');
  assert.deepEqual([r.nhom, r.soLuong, r.von], ['Bộ 1 tấm', 2, 4000]);
});

// ---------- CẦN GÁN ----------

test('không đọc được size (tranh tròn ĐK) → cần gán', () => {
  const r = nd('Mẫu 01, ĐK 20cm (Kèm Đế)', 'Tranh Tròn Tráng Gương Để Bàn Thử');
  assert.equal(r.trangThai, 'GAN');
  assert.match(r.lyDo, /size/);
});

test('size không có trong bảng giá vốn → cần gán', () => {
  const r = nd('Mẫu 1, 70x140cm', 'Tranh Tráng Gương Thử');
  assert.equal(r.trangThai, 'GAN');
  assert.match(r.lyDo, /không có trong bảng giá vốn/);
});

test('là tranh có size nhưng không có từ khóa loại → cần gán (không bỏ qua)', () => {
  const r = nd('Mẫu 1, 30x40 x 3 tấm', 'Bộ 3 Tranh Treo Tường Phong Cách Thử');
  assert.equal(r.trangThai, 'GAN');
  assert.match(r.lyDo, /Chưa rõ loại/);
});

test('gán tay theo SKU ID được ưu tiên', () => {
  const ganTay = new Map([['SKU-9', { nhom: 'Bộ 1 tấm', phan_loai: '40x60', so_luong: 2 }]]);
  const r = nhanDien(sp('Mẫu 01, ĐK 20cm', 'Tranh Tròn Thử', '', 'SKU-9'), VON, ganTay);
  assert.deepEqual([r.trangThai, r.nguon, r.von], ['OK', 'gan-tay', 4000]);
});
