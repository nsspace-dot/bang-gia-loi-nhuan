// Tab Tính lợi nhuận — test cho 6 lỗi của app cũ + logic bảng tính. Dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docBangSanPham, laiTaiGian, locVaSapXep, tongKet, bangXuat, laDongLo } from '../js/core/bang-tinh.js';
import { taoMoiTruong } from './gia-lap-gas.js';

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NGANH = ['Sách', 'Tranh', 'Decal'];
const PHI = [
  { gian: 'G1', nganh: 'Tranh', thang: '2026-01', phi_san: 20, phi_vc: 2000, phi_xl: 3000, phi_qc: 8, aff_qc: 5, aff_noqc: 10 },
  { gian: 'G1', nganh: 'Tranh', thang: '2026-10', phi_san: 25, phi_vc: 2000, phi_xl: 3000, phi_qc: 8, aff_qc: 5, aff_noqc: 10 },
  { gian: 'G2', nganh: 'Tranh', thang: '2026-01', phi_san: 10, phi_vc: 1000, phi_xl: 1000, phi_qc: 5, aff_qc: 5, aff_noqc: 5 },
];

// ---------- LỖI 1: giá bán trống bị lấy nhầm giá vốn ----------

test('LỖI 1: cột Giá bán trống → để trống (null), KHÔNG lấy giá vốn', () => {
  const { dong } = docBangSanPham([
    ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán'],
    ['Tranh A', '30x40', 'Tranh', 12000, ''],
    ['Tranh B', '30x40', 'Tranh', 12000, null],
    ['Tranh C', '30x40', 'Tranh', 12000, 50000],
  ], { dsNganh: NGANH, nganhMacDinh: 'Tranh' });
  assert.equal(dong[0].gia_ban, null);
  assert.equal(dong[1].gia_ban, null);
  assert.equal(dong[2].gia_ban, 50000);
  // chưa có giá bán → không tính lãi (không ra lãi âm giả)
  assert.equal(laiTaiGian(dong[0], 'G1', PHI, '2026-10').trangThai, 'thieu-gia');
});

test('LỖI 1: file KHÔNG có cột Giá bán → giá bán trống, không lấy cột thứ 4', () => {
  const { dong } = docBangSanPham([['Tên', 'Loại', 'Ngành', 'Giá vốn'], ['X', '', 'Tranh', 9000]], { dsNganh: NGANH });
  assert.equal(dong[0].gia_von, 9000);
  assert.equal(dong[0].gia_ban, null);
});

test('LỖI 1: đọc theo tên cột, thứ tự cột khác vẫn đúng', () => {
  const { dong } = docBangSanPham([['Giá bán', 'Giá vốn', 'Tên sản phẩm'], [70000, 20000, 'Y']], { dsNganh: NGANH, nganhMacDinh: 'Sách' });
  assert.deepEqual([dong[0].ten, dong[0].gia_von, dong[0].gia_ban, dong[0].nganh], ['Y', 20000, 70000, 'Sách']);
});

test('đọc lại được file app cũ xuất ra (tiêu đề ở dòng 3, có cột lãi)', () => {
  const { dong, loi } = docBangSanPham([
    ['Bảng Tính Lợi Nhuận — Xuất Ngày: 01/01/2026'], [],
    ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn (đ)', 'Giá bán (đ)', 'G1 (QC)', 'G1 (noQC)'],
    ['Z', 'A3', 'Tranh', 1000, 5000, 123, 456],
  ], { dsNganh: NGANH });
  assert.equal(loi, null);
  assert.deepEqual([dong[0].gia_von, dong[0].gia_ban], [1000, 5000]);
});

// ---------- LỖI 2: tên có dấu ngoặc kép làm vỡ ô nhập ----------

test('LỖI 2: tên có ngoặc kép / ký tự HTML được giữ nguyên khi đọc file', () => {
  const ten = 'Tranh "MẪU THỬ" <b>&\'';
  const { dong } = docBangSanPham([['Tên sản phẩm', 'Giá vốn'], [ten, 1]], { dsNganh: NGANH });
  assert.equal(dong[0].ten, ten);
});

test('LỖI 2: giao diện không ghép chuỗi dữ liệu vào innerHTML', () => {
  for (const f of fs.readdirSync(path.join(GOC, 'js/ui'))) {
    const nd = fs.readFileSync(path.join(GOC, 'js/ui', f), 'utf8');
    const dong = nd.split('\n').filter((d) => /innerHTML|outerHTML|insertAdjacentHTML/.test(d) && !d.trim().startsWith('//'));
    // Chỉ cho phép 1 chỗ: dom.js/svg() dựng SVG tĩnh do app tự viết
    if (f === 'dom.js') assert.deepEqual(dong.map((d) => d.trim()), ['t.innerHTML = chuoi.trim();'], f);
    else assert.deepEqual(dong, [], `${f} dùng innerHTML`);
  }
});

// ---------- LỖI 3: số dạng chữ ----------

test('LỖI 3: "45.000" và "45,000" đọc thành 45000', () => {
  const { dong, canhBao } = docBangSanPham([
    ['Tên sản phẩm', 'Giá vốn', 'Giá bán'],
    ['A', '45.000', '120,000'],
    ['B', '45,000', '1.234.567'],
    ['C', '45.000 đ', 'abc'],
  ], { dsNganh: NGANH });
  assert.deepEqual(dong.map((d) => [d.gia_von, d.gia_ban]), [[45000, 120000], [45000, 1234567], [45000, null]]);
  assert.ok(canhBao.some((c) => c.includes('"abc"')));
});

// ---------- LỖI 4: URL Apps Script ghi cứng, ghi không cần xác thực ----------

test('LỖI 4: không có URL Apps Script / mật khẩu ghi cứng trong code', () => {
  const quet = (thuMuc) => fs.readdirSync(thuMuc, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(thuMuc, e.name);
    return e.isDirectory() ? quet(p) : /\.(js|html|gs)$/.test(e.name) ? [p] : [];
  });
  for (const f of [...quet(path.join(GOC, 'js')), path.join(GOC, 'index.html'), path.join(GOC, 'apps-script/Code.gs')]) {
    const nd = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(nd, /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/, f);
    assert.doesNotMatch(nd, /AKfycb/, f);
  }
});

test('LỖI 4: Bảng phí / Giá vốn / quản lý tên vẫn cần mật khẩu; bảng tính CỦA MÌNH lưu không cần mật khẩu nhưng phải đúng tên trong danh sách', () => {
  const g = taoMoiTruong();
  assert.equal(g.post({ action: 'upsert', sheet: 'GIA_VON', banGhi: [{ nhom: 'N', phan_loai: '1x1', gia_von: 1 }] }).ok, false);
  assert.equal(g.post({ action: 'upsert', sheet: 'NGUOI_DUNG', banGhi: [{ ten: 'X' }] }).ok, false);
  assert.match(g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Không có', san: 'TIKTOK', bangTinh: { id: 'b', ten: 'x' }, dong: [] }).loi, /không có trong danh sách/);
  g.post({ action: 'themNguoi', ten: 'Lan' });
  assert.equal(g.post({ action: 'luuBangTinhCuaToi', nguoi: 'Lan', san: 'TIKTOK', bangTinh: { id: 'b', ten: 'x' }, dong: [] }).ok, true);
});

function boNho() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

async function taoKho(xuLyFetch) {
  globalThis.localStorage = boNho();
  globalThis.sessionStorage = boNho();
  globalThis.fetch = xuLyFetch;
  const kho = await import(`../js/data/kho.js?lan=${Math.random()}`);
  kho.luuCaiDat({ url: 'http://may-thu.local/gas' });
  return kho;
}

/** fetch giả: chuyển yêu cầu vào Code.gs chạy trên Sheets giả lập. */
function fetchQuaGas(gas) {
  return async (url, tuyChon) => {
    const u = new URL(url);
    const kq = tuyChon.method === 'POST' ? gas.post(tuyChon.body) : gas.get(Object.fromEntries(u.searchParams));
    return { ok: true, status: 200, text: async () => JSON.stringify(kq) };
  };
}

const DONG = [
  { ten: 'Tranh "Có ngoặc kép"', phan_loai: '30x40', nganh: 'Tranh', gia_von: 12000, gia_ban: null },
  { ten: 'Decal B', phan_loai: '', nganh: 'Decal', gia_von: 9000, gia_ban: 45000 },
];

test('LỖI 6: lưu bảng tính CỦA MÌNH lên Sheets theo sàn (không mật khẩu), mở lại đúng dữ liệu, đổi tên, xóa', async () => {
  const gas = taoMoiTruong();
  gas.post({ action: 'themNguoi', ten: 'Lan' });
  const kho = await taoKho(fetchQuaGas(gas));
  kho.chonNguoi('Lan');
  const bt = await kho.luuBangTinhCuaToi('TIKTOK', { id: 'bt1', ten: 'Bảng tháng 10', gian_hien_thi: 'G1,G2' }, DONG);
  assert.equal(bt.so_dong, 2);
  assert.equal(bt.nguoi_tao, 'Lan');
  assert.deepEqual((await kho.dsBangTinhCuaToi('TIKTOK')).map((b) => b.id), ['bt1']);
  assert.deepEqual(await kho.dsBangTinhCuaToi('SHOPEE'), []);
  assert.deepEqual(await kho.docBangTinhCuaToi('TIKTOK', 'bt1'), DONG);
  // lưu lại với ít dòng hơn → thay toàn bộ dòng cũ
  await kho.luuBangTinhCuaToi('TIKTOK', { id: 'bt1', ten: 'Bảng tháng 10' }, DONG.slice(1));
  assert.deepEqual(await kho.docBangTinhCuaToi('TIKTOK', 'bt1'), DONG.slice(1));
  assert.equal((await kho.doiTenBangTinhCuaToi('TIKTOK', 'bt1', 'Tên mới')).ten, 'Tên mới');
  assert.equal(await kho.xoaBangTinhCuaToi('TIKTOK', 'bt1'), 1);
  assert.deepEqual(await kho.dsBangTinhCuaToi('TIKTOK'), []);
  // dữ liệu chung tải về KHÔNG chứa bảng tính của ai
  await kho.dongBo();
  assert.equal(kho.duLieu().BANG_TINH, undefined);
});

test('LỖI 5: tên không hợp lệ → Apps Script từ chối → báo lỗi, KHÔNG coi là đã lưu', async () => {
  const gas = taoMoiTruong();
  const kho = await taoKho(fetchQuaGas(gas));
  kho.chonNguoi('Người lạ');
  await assert.rejects(kho.luuBangTinhCuaToi('TIKTOK', { id: 'bt1', ten: 'X' }, DONG), /không có trong danh sách/);
});

test('LỖI 5: chưa chọn tên → báo lỗi trước khi gửi', async () => {
  let daGoi = false;
  const kho = await taoKho(async () => { daGoi = true; throw new Error('không được gọi'); });
  await assert.rejects(kho.luuBangTinhCuaToi('TIKTOK', { id: 'bt1', ten: 'X' }, DONG), /Chưa chọn tên/);
  assert.equal(daGoi, false);
});

test('LỖI 5: mất mạng / Apps Script trả trang HTML → báo lỗi rõ, không lưu', async () => {
  let kho = await taoKho(async () => { throw new TypeError('Failed to fetch'); });
  kho.chonNguoi('Lan');
  await assert.rejects(kho.luuBangTinhCuaToi('TIKTOK', { id: 'a', ten: 'X' }, DONG), /Không kết nối được/);
  kho = await taoKho(async () => ({ ok: true, status: 200, text: async () => '<html>Đăng nhập Google</html>' }));
  kho.chonNguoi('Lan');
  await assert.rejects(kho.luuBangTinhCuaToi('TIKTOK', { id: 'a', ten: 'X' }, DONG), /trang web/);
});

// ---------- Tính lãi, lọc, sắp xếp, tổng kết ----------

const DS = [
  { ten: 'Lãi', phan_loai: '', nganh: 'Tranh', gia_von: 10000, gia_ban: 60000 },
  { ten: 'Lỗ', phan_loai: '', nganh: 'Tranh', gia_von: 50000, gia_ban: 60000 },
  { ten: 'Chưa giá', phan_loai: '', nganh: 'Tranh', gia_von: 10000, gia_ban: null },
  { ten: 'Không phí', phan_loai: '', nganh: 'Sách', gia_von: 10000, gia_ban: 60000 },
];

test('chọn phí theo tháng: tháng 9 dùng bộ tháng 1, tháng 10 dùng bộ tháng 10', () => {
  assert.equal(laiTaiGian(DS[0], 'G1', PHI, '2026-09').phi.phi_san, 20);
  assert.equal(laiTaiGian(DS[0], 'G1', PHI, '2026-10').phi.phi_san, 25);
  assert.equal(laiTaiGian(DS[3], 'G1', PHI, '2026-10').trangThai, 'thieu-phi');
});

test('lọc dòng lỗ', () => {
  assert.ok(laDongLo(DS[1], ['G1'], PHI, '2026-10'));
  assert.ok(!laDongLo(DS[0], ['G1'], PHI, '2026-10'));
  const i = locVaSapXep(DS, { gians: ['G1', 'G2'], dsPhi: PHI, thang: '2026-10', chiLo: true });
  assert.deepEqual(i, [1]);
});

test('sắp xếp theo lãi (tăng/giảm); dòng chưa tính được lãi nằm cuối', () => {
  const tg = { gians: ['G1'], dsPhi: PHI, thang: '2026-10' };
  assert.deepEqual(locVaSapXep(DS, { ...tg, sapXep: { gian: 'G1', kichBan: 'qc', chieu: -1 } }), [0, 1, 2, 3]);
  assert.deepEqual(locVaSapXep(DS, { ...tg, sapXep: { gian: 'G1', kichBan: 'qc', chieu: 1 } }), [1, 0, 2, 3]);
});

test('tìm kiếm không dấu', () => {
  assert.deepEqual(locVaSapXep(DS, { gians: ['G1'], dsPhi: PHI, thang: '2026-10', tim: 'chua gia' }), [2]);
});

test('thiếu phí: ngành chưa có bộ phí tháng mới của gian → dùng tạm bộ cũ + CẢNH BÁO (không lặng lẽ)', () => {
  const ds = [
    { gian: 'CN1', nganh: 'Tranh', thang: '2026-10', phi_san: 20, phi_vc: 1000, phi_xl: 1000, phi_qc: 5, aff_qc: 5, aff_noqc: 5 },
    { gian: 'CN1', nganh: 'Trà', thang: '2026-08', phi_san: 18, phi_vc: 1000, phi_xl: 1000, phi_qc: 5, aff_qc: 5, aff_noqc: 5 },
  ];
  const tra = laiTaiGian({ nganh: 'Trà', gia_von: 1000, gia_ban: 10000 }, 'CN1', ds, '2026-11');
  assert.equal(tra.trangThai, 'ok');
  assert.equal(tra.phi.thang, '2026-08');
  assert.equal(tra.canhBaoPhi, 'Gian CN1 chưa có phí ngành Trà tháng 10/2026 – đang dùng tạm phí tháng 08/2026');
  assert.equal(laiTaiGian({ nganh: 'Tranh', gia_von: 1000, gia_ban: 10000 }, 'CN1', ds, '2026-11').canhBaoPhi, null);
  const sach = laiTaiGian({ nganh: 'Sách', gia_von: 1000, gia_ban: 10000 }, 'CN1', ds, '2026-11');
  assert.equal(sach.trangThai, 'thieu-phi');
  assert.match(sach.canhBaoPhi, /Gian CN1 chưa có phí ngành Sách tháng 11\/2026/);
  // cả gian đều dùng bộ cũ (chưa ngành nào có bộ mới) → bình thường, không cảnh báo
  assert.equal(laiTaiGian({ nganh: 'Trà', gia_von: 1, gia_ban: 10 }, 'CN1', ds.slice(1), '2026-11').canhBaoPhi, null);
  assert.equal(tongKet([{ nganh: 'Trà', gia_von: 1000, gia_ban: 10000 }], ['CN1'], ds, '2026-11').theoGian.CN1.phiTam, 1);
});

test('tổng kết: trung bình chỉ tính dòng có giá bán + có phí', () => {
  const t = tongKet(DS, ['G1'], PHI, '2026-10');
  assert.equal(t.soDong, 4);
  assert.equal(t.tongVon, 80000);
  assert.equal(t.thieuGiaBan, 1);
  assert.equal(t.theoGian.G1.soDongTinh, 2);
  assert.equal(t.theoGian.G1.soDongLo, 1);
  assert.equal(t.theoGian.G1.thieuPhi, 1);
  const a = laiTaiGian(DS[0], 'G1', PHI, '2026-10').laiQC, b = laiTaiGian(DS[1], 'G1', PHI, '2026-10').laiQC;
  assert.equal(t.theoGian.G1.tbQC, (a + b) / 2);
});

test('file xuất đọc lại được bằng chính chức năng nhập (5 cột đầu giữ nguyên)', () => {
  const xuat = bangXuat(DS, ['G1', 'G2'], PHI, '2026-10');
  assert.equal(xuat[0].length, 5 + 2 * 4);
  const { dong } = docBangSanPham(xuat, { dsNganh: NGANH, nganhMacDinh: 'Tranh' });
  assert.deepEqual(dong, DS);
});
