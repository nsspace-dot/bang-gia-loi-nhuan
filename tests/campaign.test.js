// Test tab Campaign — dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  docPrefill, docKhoangGia, docKhoangTon, tinhCampaign, suaDong, tongHop, sapXepL30D,
  canhBaoChongLan, soVoiLanTruoc, chongLan, bangBaoCao, dongKetQua, nhomLyDo,
} from '../js/core/campaign.js';
import { taoBangTraVon } from '../js/core/gia-von.js';

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['xlsx.full.min.js', 'jszip.min.js']) vm.runInThisContext(fs.readFileSync(path.join(GOC, 'vendor', f), 'utf8'));
const { taoFileDangKy } = await import('../js/excel/prefill.js');
const { docBang, docWorkbook } = await import('../js/excel/doc.js');

const PHI = { phi_san: 20, phi_vc: 2000, phi_xl: 3000, phi_qc: 8, aff_qc: 5, aff_noqc: 10 }; // QC 33%, không QC 30%
const VON = taoBangTraVon([
  { nhom: 'Bộ 1 tấm', phan_loai: '30x40', nganh: 'Tranh', gia_von: 20000 },
  { nhom: 'Nẹp gỗ khổ dọc', phan_loai: '40x60', nganh: 'Tranh', gia_von: 30000 },
  { nhom: 'Decal PP', phan_loai: '60x90', nganh: 'Decal', gia_von: 25000 },
]);
const TIEU_DE = ['Product ID', 'Product Name', 'SKU ID', 'SKU Name', 'Retail price', 'Campaign Price Range', 'Campaign price', 'Campaign Price Reason', 'Available stock', 'Campaign stock range', 'Campaign stock', 'Product Category', 'Brands Name', 'L30D sales', 'Region', 'Error Msg'];
const dongP = (sku, ten, retail, khoang, ton, l30d = '0') => ['P1', ten, sku, 'default_sku_name', String(retail), khoang, '', '', String(ton), '>5', '6', 'Ngành giả', 'X', l30d, '', ''];
const MANG = [
  ['Ghi chú thử nghiệm'],
  TIEU_DE,
  dongP('S1', 'Tranh Tráng Gương Thử 30x40cm', 99000, '>=1 and <99000', 50, '3'),
  dongP('S2', 'Tranh Liễn Thử Nẹp gỗ 40x60', 120000, '>=1 and <70000', 50, '9'),
  dongP('S3', 'Decal Dán Thử 60x90', 90000, '>=1 and <90000', 3, '1'),
  dongP('S4', 'Lịch Treo Tường Thử 2099', 150000, '>=1 and <150000', 50),
  dongP('S5', 'Tranh Tròn Tráng Gương ĐK 20cm', 80000, '>=1 and <80000', 50),
  dongP('S6', 'Tranh Tráng Gương Thử 30x40cm', 99001, '>=1 and <99001', 50),
];
const pre = docPrefill(MANG);
const banDo = new Map();
const tinh = (cd, ganTay = new Map()) => tinhCampaign({ dong: pre.dong, banDoSP: banDo, bangVon: VON, ganTay, layPhi: () => PHI, cd });
const theoSku = (ds) => Object.fromEntries(ds.map((r) => [r.sku_id, r]));

test('đọc khoảng giá / khoảng tồn', () => {
  assert.deepEqual(docKhoangGia('>=1 and <107800'), { san: 1, sanGom: true, tran: 107800, tranGom: false });
  assert.deepEqual(docKhoangGia('>1000 and <=5000'), { san: 1000, sanGom: false, tran: 5000, tranGom: true });
  assert.equal(docKhoangTon('>5'), 6);
  assert.equal(docKhoangTon('>=5'), 5);
  assert.equal(docKhoangTon(''), 1);
});

test('đọc prefill theo TÊN cột (dòng 1 ghi chú, dòng 2 tiêu đề)', () => {
  assert.equal(pre.loi, null);
  assert.equal(pre.dong.length, 6);
  assert.equal(pre.dong[0].soDong, 3);
  assert.equal(pre.cotGia, 6);
  assert.equal(pre.cotSoLuong, 10);
  assert.equal(pre.dong[0].tonMin, 6);
  // đảo thứ tự cột vẫn đọc đúng
  const dao = MANG.map((d) => [...d].reverse());
  const p2 = docPrefill(dao);
  assert.equal(p2.dong[1].retail, 120000);
  assert.equal(p2.cotGia, 15 - 6);
});

test('chiến lược A: giảm X% làm tròn XUỐNG; vượt trần thì hạ dưới trần + ghi chú', () => {
  const r = theoSku(tinh({ chienLuoc: 'A', giamPT: 0.2, laiMin: 0.1, buoc: 1000 }));
  assert.equal(r.S1.gia, 79000); // 99.000 × 0,8 = 79.200 → 79.000
  assert.equal(r.S1.nhom, 'VAO');
  // S2: 120.000 × 0,8 = 96.000 ≥ trần 70.000 → 69.000
  assert.equal(r.S2.gia, 69000);
  assert.deepEqual(r.S2.ghiChuGia, ['đã hạ dưới trần']);
});

test('chiến lược B: giá sàn đạt lãi tối thiểu ở CẢ 2 kịch bản, làm tròn LÊN', () => {
  const r = theoSku(tinh({ chienLuoc: 'B', laiMin: 0.15, buoc: 1000 }));
  // (20.000 + 5.000) / (1 − 0,33 − 0,15) = 48.077 → 49.000
  assert.equal(r.S1.gia, 49000);
  assert.ok(r.S1.lai.ptQC >= 0.15 && r.S1.lai.ptKhongQC >= 0.15);
  assert.equal(r.S1.nhom, 'VAO');
});

test('chiến lược C: số làm tròn lớn nhất NHỎ HƠN trần', () => {
  const r = theoSku(tinh({ chienLuoc: 'C', laiMin: 0.1, buoc: 1000 }));
  assert.equal(r.S1.gia, 98000);
  const r500 = theoSku(tinh({ chienLuoc: 'C', laiMin: 0.1, buoc: 500 }));
  assert.equal(r500.S1.gia, 98500);
});

test('vượt trần không đủ lãi (B và A)', () => {
  // S2 liễn vốn 30.000: cần ≥ (35.000)/0,57 = 61.404 → 62.000 với lãi 10% ... dùng lãi 30% để vượt trần 70.000
  const b = theoSku(tinh({ chienLuoc: 'B', laiMin: 0.3, buoc: 1000 }));
  assert.equal(b.S2.nhom, 'LOAI');
  assert.match(b.S2.lyDo, /Vượt trần không đủ lãi/);
  assert.equal(nhomLyDo(b.S2), 'Vượt trần không đủ lãi');
  const a = theoSku(tinh({ chienLuoc: 'A', giamPT: 0.1, laiMin: 0.3, buoc: 1000 }));
  assert.equal(a.S2.gia, 69000);
  assert.match(a.S2.lyDo, /Vượt trần không đủ lãi/);
});

test('dưới lãi tối thiểu / lỗ', () => {
  const r = theoSku(tinh({ chienLuoc: 'A', giamPT: 0.5, laiMin: 0.2, buoc: 1000 }));
  // S1: 49.000 × ... 99.000 × 0,5 = 49.500 → 49.000: lãi không QC = 49.000−25.000−14.700 = 9.300 (19%) < 20%
  assert.match(r.S1.lyDo, /Dưới lãi tối thiểu/);
  const lo = theoSku(tinh({ chienLuoc: 'A', giamPT: 0.7, laiMin: 0.1, buoc: 1000 }));
  assert.match(lo.S1.lyDo, /^Lỗ/);
});

test('thiếu tồn → loại; số lượng mặc định = mức tối thiểu, không vượt tồn', () => {
  const r = theoSku(tinh({ chienLuoc: 'C', laiMin: 0.05, buoc: 1000 }));
  assert.equal(r.S1.soLuong, 6);
  assert.equal(r.S3.soLuong, 3);
  assert.match(r.S3.lyDo, /Thiếu tồn \(có 3, cần 6\)/);
});

test('ngoài phạm vi (lịch) và cần gán (không đọc được size)', () => {
  const r = theoSku(tinh({ chienLuoc: 'C', laiMin: 0.05, buoc: 1000 }));
  assert.equal(r.S4.nhom, 'NGOAI');
  assert.equal(r.S5.nhom, 'GAN');
});

test('gán tay theo SKU → tính giá bình thường', () => {
  const r = theoSku(tinh({ chienLuoc: 'C', laiMin: 0.05, buoc: 1000 }, new Map([['S5', { nhom: 'Bộ 1 tấm', phan_loai: '30x40', so_luong: 1 }]])));
  assert.equal(r.S5.nhom, 'VAO');
  assert.equal(r.S5.nd.nguon, 'gan-tay');
});

test('cảnh báo giá bán lẻ bất thường (không chia hết 1.000)', () => {
  const r = theoSku(tinh({ chienLuoc: 'C', laiMin: 0.05, buoc: 1000 }));
  assert.ok(r.S6.canhBao.some((c) => c.includes('Giá bán lẻ bất thường')));
  assert.ok(!r.S1.canhBao.some((c) => c.includes('bất thường')));
});

test('sửa tay giá / số lượng → tính lại ngay; bỏ chọn', () => {
  const cd = { chienLuoc: 'C', laiMin: 0.1, buoc: 1000 };
  const r = theoSku(tinh(cd));
  const ha = suaDong(r.S1, { gia: 30000 }, cd);
  assert.equal(ha.nhom, 'LOAI');
  assert.match(ha.lyDo, /Lỗ|Dưới lãi/);
  const sl = suaDong(r.S1, { soLuong: 99 }, cd);
  assert.match(sl.lyDo, /vượt tồn/);
  const bo = suaDong(r.S1, { boChon: true }, cd);
  assert.equal(bo.lyDo, 'Bỏ chọn tay');
  assert.equal(suaDong(bo, { boChon: false }, cd).nhom, 'VAO');
});

test('sắp xếp mặc định L30D giảm dần', () => {
  assert.deepEqual(sapXepL30D(tinh({ chienLuoc: 'C', laiMin: 0.1, buoc: 1000 })).map((r) => r.sku_id).slice(0, 3), ['S2', 'S1', 'S3']);
});

test('chồng thời gian + giá khác → cảnh báo; so với lần trước', () => {
  assert.ok(chongLan('2026-10-01', '2026-10-10', '2026-10-10', '2026-10-20'));
  assert.ok(!chongLan('2026-10-01', '2026-10-09', '2026-10-10', '2026-10-20'));
  const ds = tinh({ chienLuoc: 'C', laiMin: 0.1, buoc: 1000 });
  const cl = canhBaoChongLan(ds, [{ ten: 'CP cũ', kq: new Map([['S1', 75000], ['S6', 99000]]) }]);
  assert.match(cl.get('S1')[0], /CP cũ.*75\.000/);
  assert.ok(!cl.has('S6'));
  const tr = soVoiLanTruoc(ds, new Map([['S3', { ket_qua: 'VAO', gia_campaign: 70000 }], ['S1', { ket_qua: 'VAO', gia_campaign: 1 }]]), 'Tháng trước');
  assert.match(tr.get('S3'), /Lần trước \("Tháng trước"\) vào được.*Thiếu tồn/);
  assert.ok(!tr.has('S1'));
});

test('tổng hợp + báo cáo + dòng lưu Sheets', () => {
  const ds = tinh({ chienLuoc: 'C', laiMin: 0.1, buoc: 1000 });
  const th = tongHop(ds);
  assert.equal(th.dem.VAO + th.dem.LOAI + th.dem.GAN + th.dem.NGOAI, 6);
  assert.equal(th.dem.NGOAI, 1);
  const bc = bangBaoCao(ds, { ten: 'Thử' });
  assert.deepEqual(Object.keys(bc), ['Tổng hợp', 'Vào được', 'Bị loại', 'Cần gán']);
  assert.equal(bc['Vào được'].length - 1, th.dem.VAO);
  assert.equal(bc['Bị loại'].length - 1, th.dem.LOAI);
  assert.equal(bc['Cần gán'].length - 1, th.dem.GAN);
  const kq = dongKetQua(ds);
  assert.equal(kq.length, 5); // bỏ ngoài phạm vi
  assert.ok(kq.every((k) => k.sku_id && k.ket_qua));
});

// ---------- FILE ĐĂNG KÝ ----------

function taoPrefillGia() {
  const X = globalThis.XLSX;
  const ws = X.utils.aoa_to_sheet(MANG);
  // Campaign price là công thức như file sửa tay
  for (let r = 3; r <= MANG.length; r++) ws[`G${r}`] = { t: 'n', f: `E${r}*80%`, v: 1 };
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
  ws['!cols'] = TIEU_DE.map((_, i) => ({ wch: i === 1 ? 60 : 18 }));
  ws['!autofilter'] = { ref: `A2:P${MANG.length}` };
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sheet1');
  return X.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('file đăng ký: giữ dòng ghi chú, ô gộp, tiêu đề, số cột; giá là SỐ; xóa dòng không vào được', async () => {
  const goc = taoPrefillGia();
  const giu = new Map([[3, { gia: 79000, soLuong: 6 }], [7, { gia: 61000, soLuong: 8 }]]);
  const { duLieu, soDong } = await taoFileDangKy(goc, { giuDong: giu, soDongTieuDe: 2, cotGia: 6, cotSoLuong: 10 });
  assert.equal(soDong, 2);
  const wb = docWorkbook(Buffer.from(duLieu));
  const ws = wb.Sheets.Sheet1;
  const mang = JSON.parse(JSON.stringify(docBang(Buffer.from(duLieu)).dong));
  assert.equal(mang.length, 4);
  assert.deepEqual(mang[0].slice(0, 1), ['Ghi chú thử nghiệm']);
  assert.deepEqual(mang[1], TIEU_DE);
  assert.equal(mang[2][2], 'S1');
  assert.equal(mang[3][2], 'S5');
  // Campaign price là số, không còn công thức
  const o = ws['!data'][2][6];
  assert.equal(o.t, 'n');
  assert.equal(o.v, 79000);
  assert.equal(o.f, undefined);
  assert.equal(ws['!data'][3][10].v, 8);
  // các cột khác giữ nguyên
  assert.equal(mang[3][4], '80000');
  assert.equal(mang[3][5], '>=1 and <80000');
  // ô gộp + vùng lọc
  assert.deepEqual(JSON.parse(JSON.stringify(ws['!merges'])), [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }]);
  const Z = globalThis.JSZip;
  const xml = await (await Z.loadAsync(duLieu)).file('xl/worksheets/sheet1.xml').async('string');
  assert.match(xml, /<dimension ref="A1:P4"\/>/);
  assert.doesNotMatch(xml, /<f>/);
  assert.match(xml, /<autoFilter ref="A2:P4"/);
});

test('file đăng ký: ô Campaign price trống (không có thẻ <c>) vẫn được điền đúng chỗ', async () => {
  const X = globalThis.XLSX;
  const mang = MANG.map((d, i) => (i >= 2 ? d.map((x, j) => (j === 6 || j === 10 ? null : x)) : d));
  const ws = X.utils.aoa_to_sheet(mang);
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sheet1');
  const { duLieu } = await taoFileDangKy(X.write(wb, { type: 'buffer', bookType: 'xlsx' }), { giuDong: new Map([[4, { gia: 69000, soLuong: 6 }]]), soDongTieuDe: 2, cotGia: 6, cotSoLuong: 10 });
  const d = JSON.parse(JSON.stringify(docBang(Buffer.from(duLieu)).dong));
  assert.equal(d.length, 3);
  assert.equal(d[2][2], 'S2');
  assert.equal(d[2][6], 69000);
  assert.equal(d[2][10], 6);
  assert.equal(d[2][7], '');
});

test('"Gán cho cả sản phẩm": mỗi SKU giữ size riêng trong nhóm đã chọn', async () => {
  const { sizeRiengTrongNhom } = await import('../js/core/campaign.js');
  const von = [
    { nhom: 'Bộ 3 tấm đồng size', phan_loai: '30x40x3' }, { nhom: 'Bộ 3 tấm đồng size', phan_loai: '40x60x3' },
    { nhom: 'Bộ 1 tấm', phan_loai: '40x60' },
  ];
  assert.equal(sizeRiengTrongNhom({ variation_value: 'Mẫu 2, 40X60 x 3 tấm' }, 'Bộ 3 tấm đồng size', von), '40x60x3');
  assert.equal(sizeRiengTrongNhom({ variation_value: 'Mẫu 2, 30x40 x 3 tấm' }, 'Bộ 3 tấm đồng size', von), '30x40x3');
  assert.equal(sizeRiengTrongNhom({ variation_value: 'Mẫu 2, 50x70 x 3 tấm' }, 'Bộ 3 tấm đồng size', von), null);
  assert.equal(sizeRiengTrongNhom({ variation_value: 'Mẫu 01, ĐK 20cm' }, 'Bộ 1 tấm', von), null);
});
