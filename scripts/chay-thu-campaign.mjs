// Chạy thử tab Campaign trên file mẫu THẬT trong mau/ (không commit).
// In kết quả ra màn hình; file đăng ký thử ghi vào mau/ (đã chặn bằng .gitignore).
//   node scripts/chay-thu-campaign.mjs [A|B|C] [lãi tối thiểu %] [X% cho A]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const goc = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mau = path.join(goc, 'mau');
if (!fs.existsSync(mau)) { console.log('Không có thư mục mau/ — bỏ qua.'); process.exit(0); }
for (const f of ['xlsx.full.min.js', 'jszip.min.js']) vm.runInThisContext(fs.readFileSync(path.join(goc, 'vendor', f), 'utf8'));

const { docBang, docFileSanPham } = await import('../js/excel/doc.js');
const { taoFileDangKy } = await import('../js/excel/prefill.js');
const { docBangGiaVon, taoBangTraVon } = await import('../js/core/gia-von.js');
const { chonBoPhi, chuanHoaThang } = await import('../js/core/phi.js');
const { docSo } = await import('../js/core/so.js');
const { docPrefill, tinhCampaign, tongHop, sapXepL30D } = await import('../js/core/campaign.js');

const [chienLuoc = 'B', laiMin = '10', giam = '20'] = process.argv.slice(2);
const files = fs.readdirSync(mau);

const von = [];
for (const f of files.filter((f) => /^Von_.*\.xlsx$/i.test(f))) von.push(...docBangGiaVon(docBang(fs.readFileSync(path.join(mau, f))).dong).banGhi);

const phi = docBang(fs.readFileSync(path.join(mau, 'bang-phi-khoi-tao.xlsx'))).dong.slice(1).map((d) => ({
  gian: d[0], nganh: d[1], thang: chuanHoaThang(d[2]), phi_san: docSo(d[3]), phi_vc: docSo(d[4]), phi_xl: docSo(d[5]), phi_qc: docSo(d[6]), aff_qc: docSo(d[7]), aff_noqc: docSo(d[8]),
}));

const banDo = new Map();
for (const f of files.filter((f) => /all_information.*\.xlsx$/i.test(f))) docFileSanPham(fs.readFileSync(path.join(mau, f))).forEach((x) => banDo.set(x.sku_id, x));

const fPrefill = files.find((f) => /prefill/i.test(f));
const buf = fs.readFileSync(path.join(mau, fPrefill));
const pre = docPrefill(docBang(buf).dong);
const cd = { chienLuoc, laiMin: +laiMin / 100, giamPT: +giam / 100, buoc: 1000 };
const t0 = Date.now();
const ds = tinhCampaign({ dong: pre.dong, banDoSP: banDo, bangVon: taoBangTraVon(von), ganTay: new Map(), layPhi: (n) => chonBoPhi(phi, 'Tường Vip', n, '2026-10'), cd });
console.log(`Tính ${ds.length} SKU trong ${Date.now() - t0} ms — chiến lược ${chienLuoc}, lãi tối thiểu ${laiMin}%${chienLuoc === 'A' ? `, giảm ${giam}%` : ''}`);
const th = tongHop(ds);
console.log('Nhóm:', th.dem);
console.log('Vào được theo loại:', th.theoLoai);
console.log('Lý do loại:', th.lyDo);
if (th.laiTB) console.log('Lãi TB:', Object.fromEntries(Object.entries(th.laiTB).map(([k, v]) => [k, k.startsWith('pt') ? `${(v * 100).toFixed(1)}%` : Math.round(v)])));
console.log('Cảnh báo giá bán lẻ bất thường:', ds.filter((r) => r.canhBao.some((c) => c.includes('bất thường'))).length);
console.log('Suy ra từ tên (vào được/loại):', ds.filter((r) => r.nd?.suyRaTuTen?.length && ['VAO', 'LOAI'].includes(r.nhom)).length);
console.log('Ví dụ 3 dòng bị loại:');
for (const r of sapXepL30D(ds).filter((x) => x.nhom === 'LOAI').slice(0, 3)) console.log('  ', r.nd.nhom, r.nd.phanLoai, 'x', r.nd.soLuong, '| giá', r.gia, '|', r.lyDo);

const giu = new Map(ds.filter((r) => r.nhom === 'VAO').map((r) => [r.soDong, { gia: r.gia, soLuong: r.soLuong }]));
const t1 = Date.now();
const { duLieu, soDong } = await taoFileDangKy(buf, { giuDong: giu, soDongTieuDe: pre.soDongTieuDe, cotGia: pre.cotGia, cotSoLuong: pre.cotSoLuong });
const ra = path.join(mau, `thu-${chienLuoc}_dang-ky.xlsx`);
fs.writeFileSync(ra, duLieu);
console.log(`File đăng ký: ${soDong} dòng, ${Date.now() - t1} ms → ${path.relative(goc, ra)}`);
