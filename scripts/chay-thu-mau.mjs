// Chạy thử nhận diện trên file mẫu THẬT trong mau/ (không commit).
// Chỉ in kết quả ra màn hình, không ghi file nào vào repo.
//   node scripts/chay-thu-mau.mjs           → tóm tắt
//   node scripts/chay-thu-mau.mjs --chi-tiet → in thêm danh sách cần gán
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const goc = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mau = path.join(goc, 'mau');
if (!fs.existsSync(mau)) { console.log('Không có thư mục mau/ — bỏ qua.'); process.exit(0); }
vm.runInThisContext(fs.readFileSync(path.join(goc, 'vendor/xlsx.full.min.js'), 'utf8'));

const { docBang, docFileSanPham } = await import('../js/excel/doc.js');
const { docBangGiaVon, taoBangTraVon, canhBaoBacVon } = await import('../js/core/gia-von.js');
const { nhanDien } = await import('../js/core/nhan-dien.js');

const files = fs.readdirSync(mau);
const von = [];
for (const f of files.filter((f) => /^Von_.*\.xlsx$/i.test(f))) {
  const { dong } = docBang(fs.readFileSync(path.join(mau, f)));
  const r = docBangGiaVon(dong);
  von.push(...r.banGhi);
  console.log(`Giá vốn ${f}: ${r.banGhi.length} dòng, ${r.loi.length} lỗi`);
}
console.log(`Cảnh báo bậc vốn: ${canhBaoBacVon(von).length}`);
const bang = taoBangTraVon(von);

const sp = new Map();
for (const f of files.filter((f) => /all_information.*\.xlsx$/i.test(f))) {
  const ds = docFileSanPham(fs.readFileSync(path.join(mau, f)));
  ds.forEach((x) => sp.set(x.sku_id, x));
  console.log(`File sản phẩm ${f}: ${ds.length} SKU`);
}

const fPrefill = files.find((f) => /prefill/i.test(f));
const { dong } = docBang(fs.readFileSync(path.join(mau, fPrefill)));
const tieuDe = dong[1].map(String);
const iSku = tieuDe.indexOf('SKU ID');
const skus = dong.slice(2).map((d) => String(d[iSku])).filter(Boolean);
const timThay = skus.filter((s) => sp.has(s));
console.log(`Prefill: ${skus.length} SKU, tìm thấy trong file sản phẩm: ${timThay.length}`);

const dem = {};
const tang = (k) => (dem[k] = (dem[k] || 0) + 1);
const canGan = [];
let suyRa = 0;
for (const s of timThay) {
  const r = nhanDien(sp.get(s), bang);
  if (r.trangThai === 'OK') {
    tang(`OK  ${r.nhom}${r.soLuong > 1 ? ` ×${r.soLuong}` : ''}`);
    if (r.suyRaTuTen.length) suyRa++;
  } else if (r.trangThai === 'GAN') { tang(`GAN ${r.lyDo.replace(/Size \S+ /, 'Size … ').replace(/\(.*\)$/, '')}`); canGan.push([s, r]); }
  else tang(`NGOAI ${r.lyDo}`);
}
console.log('\nKết quả nhận diện:');
for (const k of Object.keys(dem).sort()) console.log(`  ${String(dem[k]).padStart(5)}  ${k}`);
const tong = (p) => Object.entries(dem).filter(([k]) => k.startsWith(p)).reduce((a, [, v]) => a + v, 0);
console.log(`\nTự nhận diện: ${tong('OK')} (trong đó suy ra từ tên: ${suyRa}) | Cần gán: ${tong('GAN')} | Ngoài phạm vi: ${tong('NGOAI')}`);
if (process.argv.includes('--chi-tiet')) {
  for (const [s, r] of canGan) {
    const x = sp.get(s);
    console.log(`  ${r.lyDo} | ${x.variation_value.replace(/\s+/g, ' ')} | ${x.seller_sku} | ${x.product_name.slice(0, 70)}`);
  }
}
