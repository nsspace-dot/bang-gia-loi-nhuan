// Test giao diện trên trình duyệt thật (Playwright). Máy không có Playwright thì tự bỏ qua.
// Dữ liệu GIẢ, Apps Script giả lập (scripts/may-chu-thu.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONG = 18000 + Math.floor(Math.random() * 1000);
const URL_APP = `http://localhost:${CONG}`;

function timPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { /* thử thư mục cài toàn cục */ }
  try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); } catch { return null; }
}
const pw = timPlaywright();
const boQua = !pw && 'không có Playwright';

let mayChu, trinhDuyet, tmp;

before(async () => {
  if (boQua) return;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bggl-'));
  mayChu = spawn(process.execPath, [path.join(GOC, 'scripts/may-chu-thu.mjs'), String(CONG), '--du-lieu-gia'], { stdio: 'pipe' });
  await new Promise((ok) => mayChu.stdout.once('data', ok));
  trinhDuyet = await pw.chromium.launch();
});

after(async () => {
  await trinhDuyet?.close();
  mayChu?.kill();
});

async function moTrang(matKhau = 'mat-khau-thu') {
  const p = await trinhDuyet.newPage();
  const loi = [];
  p.on('pageerror', (e) => loi.push(String(e)));
  await p.addInitScript(([url, mk]) => {
    if (!sessionStorage.getItem('da-khoi-tao')) {
      localStorage.clear();
      localStorage.setItem('bggl.caidat.v1', JSON.stringify({ url }));
      sessionStorage.setItem('bggl.matkhau.v1', mk);
      sessionStorage.setItem('da-khoi-tao', '1');
    }
  }, [`${URL_APP}/gas`, matKhau]);
  await p.goto(`${URL_APP}/#loi-nhuan`);
  await p.waitForSelector('.dong-bo-xong');
  return { p, loi };
}

function taoFile(ten, dong) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const X = ctx.XLSX;
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(dong), 'Sản phẩm');
  const f = path.join(tmp, ten);
  fs.writeFileSync(f, X.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  return f;
}

async function napFile(p, f) {
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.vung-tha')]);
  await fc.setFiles(f);
  await p.waitForSelector('.bang-ln tbody tr');
}

const TEN_KHO = 'Tranh "MẪU THỬ" <b>đậm</b> & \'nháy\'';

test('LỖI 1 + 2 + 3 trên giao diện: tên có ngoặc kép giữ nguyên, giá bán trống để trống, "45.000" đọc đúng', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  await napFile(p, taoFile('a.xlsx', [
    ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán'],
    [TEN_KHO, '30x40', 'Tranh', '45.000', ''],
    ['Decal thử', '60x90', 'Decal', '15,000', '79.000'],
  ]));
  assert.equal(await p.inputValue('[aria-label="Tên dòng 1"]'), TEN_KHO);
  assert.equal(await p.locator('.bang-ln b').count(), 0, 'không được sinh thẻ <b> từ dữ liệu');
  assert.equal(await p.inputValue('[aria-label="Giá bán dòng 1"]'), '');
  assert.equal(await p.inputValue('[aria-label="Giá vốn dòng 1"]'), '45.000');
  assert.equal(await p.inputValue('[aria-label="Giá vốn dòng 2"]'), '15.000');
  assert.equal(await p.inputValue('[aria-label="Giá bán dòng 2"]'), '79.000');
  // dòng 1 chưa có giá bán → không có lãi (không ra số âm giả)
  assert.ok(!(await p.locator('tbody tr').first().locator('.o-lai .chu-lo').count()));
  // sửa tên có ngoặc kép trực tiếp trong ô vẫn giữ nguyên
  await p.fill('[aria-label="Tên dòng 2"]', 'Decal "mới"');
  await p.press('[aria-label="Tên dòng 2"]', 'Tab');
  assert.equal(await p.inputValue('[aria-label="Tên dòng 2"]'), 'Decal "mới"');
  // xuất Excel: 5 cột đầu đúng như file mẫu, giá bán trống vẫn trống
  const [tai] = await Promise.all([p.waitForEvent('download'), p.click('text=📤 Xuất Excel')]);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const wb = ctx.XLSX.read(fs.readFileSync(await tai.path()), { type: 'buffer' });
  const dong = JSON.parse(JSON.stringify(ctx.XLSX.utils.sheet_to_json(wb.Sheets['Lợi nhuận'], { header: 1, defval: '' })));
  assert.deepEqual(dong[0].slice(0, 5), ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán']);
  assert.deepEqual(dong[1].slice(0, 5), [TEN_KHO, '30x40', 'Tranh', 45000, '']);
  assert.equal(dong[2][4], 79000);
  assert.deepEqual(loi, []);
  await p.close();
});

test('LỖI 5 + 6 trên giao diện: sai mật khẩu → báo lỗi, không báo "đã lưu"; đúng mật khẩu → lưu và mở lại được', { skip: boQua }, async () => {
  let { p } = await moTrang('sai');
  await napFile(p, taoFile('b.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], ['A', 1000, 5000], ['B', 2000, 9000]]));
  await p.click('text=💾 Lưu lên Sheets');
  await p.fill('dialog[open] input', 'Bảng thử nghiệm');
  await p.click('dialog[open] >> text=Lưu');
  await p.waitForSelector('.thong-bao-loi');
  assert.match(await p.textContent('.thong-bao-loi'), /CHƯA lưu được: Sai mật khẩu/);
  assert.equal(await p.locator('.chuc-mung', { hasText: 'Đã lưu' }).count(), 0, 'không được báo đã lưu');
  assert.match(await p.textContent('.the-dau'), /chưa lưu lên Sheets/);
  await p.close();

  ({ p } = await moTrang('mat-khau-thu'));
  await napFile(p, taoFile('c.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], [TEN_KHO, 1000, 5000], ['B', 2000, '']]));
  await p.click('text=💾 Lưu lên Sheets');
  await p.fill('dialog[open] input', 'Bảng thử nghiệm');
  await p.click('dialog[open] >> text=Lưu');
  await p.waitForSelector('.chuc-mung >> text=Đã lưu');
  assert.match(await p.textContent('.the-dau'), /đã lưu/);
  // bảng mới rồi mở lại
  await p.click('text=🧹 Bảng mới');
  await p.click('text=📂 Mở bảng tính');
  await p.click('dialog[open] >> text=Mở');
  await p.waitForSelector('[aria-label="Tên dòng 1"]');
  assert.equal(await p.inputValue('[aria-label="Tên dòng 1"]'), TEN_KHO);
  assert.equal(await p.inputValue('[aria-label="Giá bán dòng 2"]'), '');
  await p.close();
});
