// Test tab Set giá — dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tinhSetGia, chiTietTaiGia, kiemTraBacGia, bangXuatTheoMau } from '../js/core/set-gia.js';
import { docBangSanPham } from '../js/core/bang-tinh.js';
import { khoaVon } from '../js/core/gia-von.js';

const PHI = { phi_san: 20, phi_vc: 2000, phi_xl: 3000, phi_qc: 8, aff_qc: 5, aff_noqc: 10 }; // QC 33%, không QC 30%
const layPhi = (nganh) => (nganh === 'Tranh' ? PHI : null);
const VON = [
  { nhom: 'Bộ 1 tấm', phan_loai: '30x40', nganh: 'Tranh', gia_von: 20000 },
  { nhom: 'Bộ 1 tấm', phan_loai: '40x60', nganh: 'Tranh', gia_von: 30000 },
  { nhom: 'Bộ 3 tấm đồng size', phan_loai: '30x40x3', nganh: 'Tranh', gia_von: 70000 },
  { nhom: 'Decal PP', phan_loai: '50x70', nganh: 'Decal', gia_von: 10000 },
  { nhom: 'Bộ 1 tấm', phan_loai: '50x70', nganh: 'Tranh', gia_von: null },
];
const CD = { kieuLai: 'pt', lai: 0.15, kichBan: 'ca2', lamTron: 'len1000' };

test('giá đề xuất "cả 2 kịch bản": cả lãi QC và không QC đều ≥ mức mong muốn', () => {
  const [a] = tinhSetGia(VON, layPhi, CD);
  // (20.000 + 5.000) / (1 − 0,33 − 0,15) = 48.076,9 → làm tròn lên 49.000
  assert.ok(Math.abs(a.giaToiThieu - 25000 / 0.52) < 1e-6);
  assert.equal(a.giaDeXuat, 49000);
  const ct = chiTietTaiGia(a, a.giaDeXuat);
  assert.ok(ct.ptQC >= 0.15 && ct.ptKhongQC >= 0.15);
});

test('kịch bản riêng: không QC dùng tổng phí 30%', () => {
  const [a] = tinhSetGia(VON, layPhi, { ...CD, kichBan: 'khongqc', lamTron: 'khong' });
  assert.ok(Math.abs(a.giaDeXuat - 25000 / 0.55) < 1e-6);
  assert.ok(Math.abs(chiTietTaiGia(a, a.giaDeXuat).ptKhongQC - 0.15) < 1e-9);
});

test('lãi theo số đồng/đơn', () => {
  const [a] = tinhSetGia(VON, layPhi, { kieuLai: 'dong', lai: 10000, kichBan: 'qc', lamTron: 'khong' });
  assert.ok(Math.abs(chiTietTaiGia(a, a.giaDeXuat).laiQC - 10000) < 1e-6);
});

test('làm tròn đuôi 9.000', () => {
  const [a] = tinhSetGia(VON, layPhi, { ...CD, lamTron: 'duoi9000' });
  assert.equal(a.giaDeXuat, 49000);
  const [, b] = tinhSetGia(VON, layPhi, { ...CD, lamTron: 'duoi9000' });
  // (30.000 + 5.000) / 0,52 = 67.307,7 → 69.000
  assert.equal(b.giaDeXuat, 69000);
});

test('giá hòa vốn và mức giảm tối đa còn hòa vốn', () => {
  const [a] = tinhSetGia(VON, layPhi, CD);
  assert.ok(Math.abs(a.hoaVon - 25000 / 0.67) < 1e-6);
  const ct = chiTietTaiGia(a, 49000);
  assert.ok(Math.abs(ct.giamToiDaDong - (49000 - 25000 / 0.67)) < 1e-6);
  // giảm đúng mức đó thì lãi (kịch bản xấu nhất) = 0
  const sauGiam = chiTietTaiGia(a, 49000 - ct.giamToiDaDong);
  assert.ok(Math.abs(Math.min(sauGiam.laiQC, sauGiam.laiKhongQC)) < 1e-6);
});

test('thiếu phí / thiếu vốn / không thể đạt → báo lỗi dòng', () => {
  const kq = tinhSetGia(VON, layPhi, CD);
  assert.match(kq[3].loi, /Chưa có bộ phí ngành "Decal"/);
  assert.match(kq[4].loi, /Giá vốn trống/);
  assert.match(tinhSetGia(VON.slice(0, 1), layPhi, { ...CD, lai: 0.7 })[0].loi, /Không đạt được/);
});

test('bậc giá: size lớn hơn mà giá thấp hơn → cảnh báo', () => {
  const kq = tinhSetGia(VON.slice(0, 2), layPhi, CD);
  const giaTay = new Map([['40x60', 45000]]);
  const cb = kiemTraBacGia(kq, (d) => giaTay.get(d.phan_loai) ?? d.giaDeXuat);
  assert.equal(cb.size, 1);
  assert.match(cb.get(khoaVon('Bộ 1 tấm', '40x60'))[0], /lớn hơn 30x40 nhưng giá thấp hơn/);
  assert.equal(kiemTraBacGia(kq, (d) => d.giaDeXuat).size, 0);
});

test('bậc giá: Bộ 3 tấm phải rẻ hơn 3 × bộ 1 tấm cùng size (kể cả khi chỉ chọn nhóm Bộ 3 tấm)', () => {
  const kq = tinhSetGia(VON.slice(0, 3), layPhi, CD);
  // giá đề xuất bộ 3 = (70.000+5.000)/0,52 → 145.000 ≥ 3 × 49.000 = 147.000? Không → không cảnh báo
  assert.equal(kiemTraBacGia(kq, (d) => d.giaDeXuat).size, 0);
  const cb = kiemTraBacGia(kq, (d) => (d.phan_loai === '30x40x3' ? 150000 : d.giaDeXuat));
  assert.match(cb.get(khoaVon('Bộ 3 tấm đồng size', '30x40x3'))[0], /không rẻ hơn 3 × bộ 1 tấm 30x40/);
  // chỉ có nhóm Bộ 3 tấm, bộ 1 tấm lấy từ tham chiếu
  const chi3 = kq.filter((d) => d.nhom.startsWith('Bộ 3'));
  const cb2 = kiemTraBacGia(chi3, () => 150000, kq.filter((d) => d.nhom === 'Bộ 1 tấm').map((d) => ({ d, gia: d.giaDeXuat })));
  assert.equal(cb2.size, 1);
});

test('file xuất theo mẫu nhập của tab Tính lợi nhuận → nhập lại được', () => {
  const kq = tinhSetGia(VON, layPhi, CD);
  const xuat = bangXuatTheoMau(kq, (d) => d.giaDeXuat);
  assert.deepEqual(xuat[0], ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán']);
  assert.equal(xuat.length, 1 + 3); // bỏ dòng lỗi
  const { dong } = docBangSanPham(xuat, { dsNganh: ['Tranh', 'Decal'] });
  assert.deepEqual(dong[0], { ten: 'Bộ 1 tấm', phan_loai: '30x40', nganh: 'Tranh', gia_von: 20000, gia_ban: 49000 });
});
