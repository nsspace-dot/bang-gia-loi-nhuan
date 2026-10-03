import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docBangGiaVon, soSanhGiaVon, canhBaoBacVon, khoaVon } from '../js/core/gia-von.js';
import { docSize, lonHon } from '../js/core/size.js';

test('đọc size nhiều kiểu ghi', () => {
  assert.deepEqual(docSize('Mẫu 1, 30x40cm'), { rong: 30, cao: 40, nhan: null });
  assert.deepEqual(docSize('Mẫu 6, 30 X 40 CM, Nẹp gỗ'), { rong: 30, cao: 40, nhan: null });
  assert.deepEqual(docSize('Mẫu 14, 20x30x3cm'), { rong: 20, cao: 30, nhan: 3 });
  assert.deepEqual(docSize('60X150DECAL'), { rong: 60, cao: 150, nhan: null });
  assert.deepEqual(docSize('HOA, 50x70 x 1 TẤM'), { rong: 50, cao: 70, nhan: 1 });
  assert.deepEqual(docSize('Mẫu 1, 30x40cm x 3 tấm'), { rong: 30, cao: 40, nhan: 3 });
  assert.deepEqual(docSize('50X100X3CAN-GO'), { rong: 50, cao: 100, nhan: 3 });
  assert.equal(docSize('Mẫu 1, ĐK 20cm'), null);
  assert.equal(docSize('Mặc định'), null);
});

test('size lớn hơn = cả rộng và cao đều ≥', () => {
  assert.ok(lonHon({ rong: 30, cao: 70 }, { rong: 30, cao: 60 }));
  assert.ok(!lonHon({ rong: 30, cao: 60 }, { rong: 40, cao: 40 }));
  assert.ok(!lonHon({ rong: 40, cao: 40 }, { rong: 30, cao: 60 }));
  assert.ok(!lonHon({ rong: 30, cao: 40 }, { rong: 30, cao: 40 }));
});

const FILE = [
  ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán'],
  ['Nhóm A', '20x30', 'Tranh', 10000, ''],
  ['Nhóm A', '30x40', 'Tranh', '15.000', ''],
  ['Nhóm A', '30x60', 'Tranh', 14000, ''], // lớn hơn 30x40 mà rẻ hơn
  ['Nhóm A', '40x40', 'Tranh', '', ''], // trống
  ['Nhóm B', '20x30x3', 'Tranh', 'abc', ''], // không phải số
  ['', '', '', '', ''],
];

test('đọc file giá vốn theo tên cột + báo lỗi giá trống / không phải số', () => {
  const { banGhi, loi } = docBangGiaVon(FILE);
  assert.equal(banGhi.length, 5);
  assert.equal(banGhi[1].gia_von, 15000);
  assert.equal(banGhi[3].gia_von, null);
  assert.equal(loi.length, 2);
  assert.match(loi[0].noiDung, /trống/);
  assert.match(loi[1].noiDung, /không phải số/);
});

test('đọc được khi thứ tự cột khác', () => {
  const { banGhi, loi } = docBangGiaVon([
    ['Giá vốn', 'Phân loại', 'Tên sản phẩm'],
    [5000, '13x18', 'Nhóm C'],
  ]);
  assert.equal(loi.length, 0);
  assert.deepEqual([banGhi[0].nhom, banGhi[0].phan_loai, banGhi[0].gia_von], ['Nhóm C', '13x18', 5000]);
});

test('cảnh báo size lớn hơn mà vốn rẻ hơn', () => {
  const { banGhi } = docBangGiaVon(FILE);
  const cb = canhBaoBacVon(banGhi);
  assert.equal(cb.length, 1);
  assert.equal(cb[0].lon.phan_loai, '30x60');
  assert.equal(cb[0].nho.phan_loai, '30x40');
});

test('so sánh khi nạp lại: thêm mới / thay đổi / giữ nguyên', () => {
  const daLuu = [
    { nhom: 'Nhóm A', phan_loai: '20x30', nganh: 'Tranh', gia_von: 10000, gia_ban: null },
    { nhom: 'Nhóm A', phan_loai: '30x40', nganh: 'Tranh', gia_von: 14000, gia_ban: null },
  ];
  const moi = [
    { nhom: 'Nhóm A', phan_loai: '20x30', nganh: 'Tranh', gia_von: 10000, gia_ban: null },
    { nhom: 'nhóm a', phan_loai: '30X40', nganh: 'Tranh', gia_von: 15000, gia_ban: null },
    { nhom: 'Nhóm A', phan_loai: '50x70', nganh: 'Tranh', gia_von: 30000, gia_ban: null },
  ];
  const r = soSanhGiaVon(daLuu, moi);
  assert.equal(r.giuNguyen.length, 1);
  assert.equal(r.doi.length, 1);
  assert.deepEqual(r.doi[0].cot, ['gia_von']);
  assert.equal(r.them.length, 1);
});

test('khóa giá vốn không phân biệt hoa thường / dấu ×', () => {
  assert.equal(khoaVon('Bộ 1 tấm', '30X40'), khoaVon('bộ 1 tấm', '30×40'));
});
