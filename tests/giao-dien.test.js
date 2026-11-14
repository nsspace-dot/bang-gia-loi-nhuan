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

// Tài khoản GIẢ của máy chủ thử (scripts/may-chu-thu.mjs --du-lieu-gia)
const TK = { admin: ['admin', 'mat-khau-thu'], shopee: ['nv-shopee', 'shopee-123'], tiktok: ['nv-tiktok', 'tiktok-123'] };

/** Mở trang mới (máy sạch), đặt URL Apps Script giả lập; dangNhap = vai trò cần đăng nhập, hoặc false để dừng ở màn đăng nhập. */
async function moTrang(dangNhap = 'admin') {
  const p = await trinhDuyet.newPage();
  const loi = [];
  p.on('pageerror', (e) => loi.push(String(e)));
  await p.addInitScript((url) => {
    if (!sessionStorage.getItem('da-khoi-tao')) {
      localStorage.clear();
      localStorage.setItem('bggl.caidat.v1', JSON.stringify({ url }));
      sessionStorage.setItem('da-khoi-tao', '1');
    }
  }, `${URL_APP}/gas`);
  await p.goto(`${URL_APP}/#loi-nhuan`);
  await p.waitForSelector('#dn-ten');
  if (dangNhap) {
    await dienDangNhap(p, ...TK[dangNhap]);
    await p.waitForSelector('.dong-bo-xong');
    await batDauBangTrong(p);
  }
  return { p, loi };
}

/**
 * Tab Tính lợi nhuận tự mở bảng dùng gần nhất của tài khoản (máy chủ thử dùng chung cho cả file test).
 * Test nào cũng bắt đầu từ 1 bảng TRỐNG: chờ tự mở xong, bảng gần nhất có dòng thì tạo bảng mới.
 */
async function batDauBangTrong(p) {
  if (!(await p.locator('#tab-loi-nhuan:not([hidden])').count())) return;
  await p.waitForSelector('#tab-loi-nhuan[data-da-mo="true"]', { state: 'attached' });
  if (!(await p.locator('#tab-loi-nhuan .bang-ln tbody tr').count())) return;
  await p.click('#tab-loi-nhuan >> text=🧹 Bảng mới'); // → bảng nháp trống
  if (await p.locator('dialog.hop-thoai-nhap').count()) await p.click('dialog.hop-thoai-nhap >> text=🗑 Bỏ, không lưu');
  await p.waitForSelector('#tab-loi-nhuan .vung-tha');
}

async function dienDangNhap(p, ten, mk) {
  await p.fill('#dn-ten', ten);
  await p.fill('#dn-mk', mk);
  await p.click('.hop-dang-nhap button[type=submit]');
}

/** Đổi sàn khi đang ở bảng nháp có dữ liệu → app hỏi "Bảng nháp này chưa lưu": chọn 💾 Lưu với tên cho trước. */
async function doiSanLuuNhap(p, san, ten) {
  await p.click(`[data-nen-tang="${san}"]`);
  const hoi = await p.waitForSelector('dialog.hop-thoai-nhap', { timeout: 3000 }).catch(() => null);
  if (hoi) {
    await p.click('dialog.hop-thoai-nhap >> text=💾 Lưu');
    await p.fill('dialog[open] input', ten);
    await p.click('dialog[open] >> text=Lưu');
  }
  await p.waitForSelector(`[data-nen-tang="${san}"][aria-selected="true"]`);
  await p.waitForSelector('#tab-loi-nhuan[data-da-mo="true"]', { state: 'attached' });
}

/** Gọi Apps Script giả lập từ Node (không qua trình duyệt). */
async function goiGas(body) {
  return (await fetch(`${URL_APP}/gas`, { method: 'POST', body: JSON.stringify(body) })).json();
}
async function tokenAdmin() {
  return (await goiGas({ action: 'dangNhap', ten: TK.admin[0], matKhau: TK.admin[1] })).token;
}

/** Toàn bộ dữ liệu (đọc bằng token admin). */
async function docGas() {
  return (await goiGas({ action: 'docTatCa', token: await tokenAdmin() })).duLieu;
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

test('LỖI 5 + 6 trên giao diện: sai mật khẩu → không vào được; đúng mật khẩu → lưu và mở lại được', { skip: boQua }, async () => {
  let { p } = await moTrang(false);
  await dienDangNhap(p, 'admin', 'sai-mat-khau');
  await p.waitForSelector('.dn-loi .dong-kq-loi');
  assert.match(await p.textContent('.dn-loi'), /Sai tên đăng nhập hoặc mật khẩu/);
  assert.equal(await p.evaluate(() => sessionStorage.getItem('bggl.phien.v1')), null);
  assert.equal(await p.locator('.bang-ln, .vung-tha').count(), 0, 'chưa đăng nhập thì không dựng tab nào');
  await p.close();

  ({ p } = await moTrang('admin'));
  await napFile(p, taoFile('c.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], [TEN_KHO, 1000, 5000], ['B', 2000, '']]));
  await p.click('text=💾 Lưu lên Sheets'); // lưu ngay, không chờ tự lưu
  await p.waitForSelector('.chuc-mung >> text=Đã lưu');
  assert.match(await p.textContent('.the-dau'), /✓ Đã lưu lúc \d\d:\d\d/);
  const tenBang = await p.textContent('.ten-bang');
  // bảng mới rồi mở lại
  await p.click('text=🧹 Bảng mới');
  await p.waitForSelector('.vung-tha');
  await p.click('text=📂 Mở bảng tính');
  await p.click(`dialog[open] tr:has(b:text-is("${tenBang}")) >> text=Mở`);
  await p.waitForSelector('[aria-label="Tên dòng 1"]');
  assert.equal(await p.inputValue('[aria-label="Tên dòng 1"]'), TEN_KHO);
  assert.equal(await p.inputValue('[aria-label="Giá bán dòng 2"]'), '');
  await p.close();
});

test('Set giá: chọn nhóm → có giá đề xuất, cảnh báo bậc giá, giá chốt tay, xuất file đúng mẫu nhập', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  await p.$eval('[data-tab="set-gia"]', (b) => b.click()); // nút đang ẩn
  await p.click('.chip-loc:has-text("Bộ 1 tấm")');
  await p.waitForSelector('.bang-sg tbody tr');
  // dữ liệu giả có 60x90 vốn rẻ hơn 50x70 → giá đề xuất sai bậc → cảnh báo
  assert.ok(await p.locator('.dong-canh-bao').count() >= 1);
  const truoc = await p.locator('.dong-canh-bao').count();
  // chốt tay giá 60x90 cao hơn 50x70 → hết cảnh báo cho dòng đó
  await p.fill('[aria-label="Giá chốt Bộ 1 tấm 60x90"]', '999.000');
  await p.press('[aria-label="Giá chốt Bộ 1 tấm 60x90"]', 'Tab');
  await p.waitForTimeout(200);
  assert.ok(await p.locator('.dong-canh-bao').count() < truoc);
  const [tai] = await Promise.all([p.waitForEvent('download'), p.click('text=📤 Xuất file')]);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const wb = ctx.XLSX.read(fs.readFileSync(await tai.path()), { type: 'buffer' });
  const dong = JSON.parse(JSON.stringify(ctx.XLSX.utils.sheet_to_json(wb.Sheets['Sản phẩm'], { header: 1 })));
  assert.deepEqual(dong[0], ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán']);
  assert.deepEqual(dong.find((d) => d[1] === '60x90').slice(0, 5), ['Bộ 1 tấm', '60x90', 'Tranh', 19011, 999000]);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Campaign: thả prefill + file sản phẩm → tính → gán tay → xuất file đăng ký & lưu', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  // file prefill giả: dòng 1 ghi chú (gộp A1:J1), dòng 2 tiêu đề, Campaign price là công thức
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const X = ctx.XLSX;
  const TD = ['Product ID', 'Product Name', 'SKU ID', 'SKU Name', 'Retail price', 'Campaign Price Range', 'Campaign price', 'Campaign Price Reason', 'Available stock', 'Campaign stock range', 'Campaign stock', 'Product Category', 'Brands Name', 'L30D sales', 'Region', 'Error Msg'];
  const d = (pid, sku, retail, tran, l30) => [pid, 'Tên giả', sku, 'default_sku_name', String(retail), `>=1 and <${tran}`, '', '', '50', '>5', '6', 'x', 'x', String(l30), '', ''];
  const mang = [['Ghi chú giả'], TD, d('P1', 'S1', 99000, 99000, 5), d('P1', 'S2', 129000, 129000, 9), d('P2', 'S3', 80000, 80000, 1), d('P3', 'S4', 150000, 150000, 0)];
  const ws = X.utils.aoa_to_sheet(mang);
  for (let r = 3; r <= 6; r++) ws[`G${r}`] = { t: 'n', f: `E${r}*80%`, v: 0 };
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
  let wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sheet1');
  const fPre = path.join(tmp, 'prefill.xlsx');
  fs.writeFileSync(fPre, X.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  // file sản phẩm giả (sheet Template: dòng 1 khóa, dữ liệu từ dòng 6)
  const sp = [['product_id', 'category', 'product_name', 'sku_id', 'variation_value', 'seller_sku'], ['V4'], ['Tên'], ['x'], ['x'],
    ['P1', 'c', 'Tranh Tráng Gương Thử', 'S1', 'Mẫu 1, 30x40cm', ''],
    ['P1', 'c', 'Tranh Tráng Gương Thử', 'S2', 'Mẫu 1, 40x60cm', ''],
    ['P2', 'c', 'Tranh Tròn Tráng Gương Thử', 'S3', 'Mẫu 1, ĐK 20cm', ''],
    ['P3', 'c', 'Lịch Treo Tường Thử', 'S4', 'Mẫu 1', '']];
  wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(sp), 'Template');
  const fSP = path.join(tmp, 'all_information.xlsx');
  fs.writeFileSync(fSP, X.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  await p.$eval('[data-tab="campaign"]', (b) => b.click()); // nút đang ẩn
  await p.click('text=＋ Campaign mới');
  await p.fill('[data-o=ten]', 'Thử nghiệm');
  await p.press('[data-o=ten]', 'Tab');
  await p.fill('input[type=date] >> nth=0', '2026-10-10');
  await p.dispatchEvent('input[type=date] >> nth=0', 'change');
  await p.fill('input[type=date] >> nth=1', '2026-10-12');
  await p.dispatchEvent('input[type=date] >> nth=1', 'change');
  let [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#tab-campaign .vung-tha >> nth=0')]);
  await fc.setFiles(fPre);
  await p.waitForSelector('.vung-tha-xong');
  [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#tab-campaign .vung-tha >> nth=1')]);
  await fc.setFiles(fSP);
  await p.waitForSelector('text=Tìm thấy 4 / 4 SKU');
  await p.click('.chien-luoc:has-text("C. Sát dưới trần")');
  await p.fill('[data-o=laiMin]', '10');
  await p.press('[data-o=laiMin]', 'Tab');
  await p.click('.nut-lon');
  await p.waitForSelector('.o-nhom');
  const so = async (n) => (await p.textContent(`.o-nhom-${n} .o-tong-so`)).trim();
  assert.deepEqual([await so('vao'), await so('loai'), await so('gan'), await so('ngoai')], ['2', '0', '1', '1']);
  // sắp xếp L30D giảm dần: S2 (9) trước S1 (5)
  assert.match(await p.textContent('.bang-cp tbody tr:first-child'), /SKU S2/);
  // gán tay S3 → Bộ 1 tấm 30x40
  await p.click('.o-nhom-gan');
  await p.selectOption('select[aria-label="Nhóm SKU S3"]', 'Bộ 1 tấm');
  await p.selectOption('select[aria-label="Size SKU S3"]', '30x40');
  await p.click('tbody button:has-text("Gán")');
  await p.waitForFunction(() => document.querySelector('.o-nhom-vao .o-tong-so')?.textContent.trim() === '3');
  // xuất + lưu
  await p.click('.o-nhom-vao');
  const tai = [];
  p.on('download', (x) => tai.push(x));
  await p.click('text=✅ Xuất cả 2 file & lưu');
  await p.waitForSelector('.chuc-mung >> text=lưu campaign');
  await p.waitForTimeout(500);
  const dk = tai.find((x) => x.suggestedFilename() === 'Thu nghiem_dang-ky.xlsx');
  assert.ok(dk, `tên file: ${tai.map((x) => x.suggestedFilename())}`);
  assert.ok(tai.some((x) => x.suggestedFilename() === 'Thu nghiem_bao-cao.xlsx'));
  const out = X.read(fs.readFileSync(await dk.path()), { type: 'buffer' });
  const s = out.Sheets.Sheet1;
  const dong = JSON.parse(JSON.stringify(X.utils.sheet_to_json(s, { header: 1, defval: '' })));
  assert.equal(dong.length, 5);
  assert.equal(dong[0][0], 'Ghi chú giả');
  assert.deepEqual(dong[1], TD);
  assert.deepEqual(dong.slice(2).map((x) => x[2]), ['S1', 'S2', 'S3']); // giữ thứ tự gốc
  assert.equal(s.G3.t, 'n');
  assert.equal(s.G3.f, undefined);
  assert.equal(s.G3.v, 98000);
  assert.equal(s.K3.v, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(s['!merges'])), [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }]);
  // danh sách campaign có campaign vừa lưu
  await p.click('text=‹ Danh sách campaign');
  assert.match(await p.textContent('.bang'), /Thử nghiệm/);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Bảng phí KHÔNG giựt: sửa liên tục 10 ô, lăn chuột, ↑↓, đồng bộ nền khi đang sửa, Esc, Enter, Lưu', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  await p.setViewportSize({ width: 1280, height: 620 });
  await p.click('[data-tab="bang-phi"]');
  await p.click('.vien-gian:has-text("Tường Vip")');
  await p.fill('input[type=month]', '2026-10');
  await p.dispatchEvent('input[type=month]', 'change');
  await p.waitForSelector('[aria-label="Phí sàn — Tranh"]');
  // cuộn xuống sao cho bảng nằm ngay dưới thanh tiêu đề (mọi ô cần sửa đều đang nhìn thấy)
  await p.evaluate(() => {
    const dau = document.querySelector('.dau-trang').offsetHeight;
    window.scrollTo(0, document.querySelector('.bang-phi').getBoundingClientRect().top + window.scrollY - dau - 8);
  });
  const y0 = await p.evaluate(() => window.scrollY);
  assert.ok(y0 > 100, `trang phải cuộn được (y=${y0})`);
  await p.evaluate(() => { document.querySelector('.bang-phi').__danhDau = 'cu'; });
  const bangCu = () => p.evaluate(() => document.querySelector('.bang-phi')?.__danhDau === 'cu');
  const yNay = () => p.evaluate(() => window.scrollY);
  // Đặt con trỏ vào ô mà KHÔNG cuộn (giống người dùng bấm vào ô đang nhìn thấy; p.click của Playwright tự cuộn)
  const vaoO = (s) => p.evaluate((s) => { const el = document.querySelector(s); el.focus({ preventScroll: true }); el.select(); }, s);

  // 1) Sửa liên tục 10 ô (gõ + Tab) → không vẽ lại bảng, không nhảy cuộn
  const o = [
    ['Phí sàn — Tranh', '23,8'], ['Phí sàn — Decal', '22.6'], ['Chi phí QC — Tranh', '8,14'], ['Chi phí QC — Decal', '8.14'],
    ['AFF có QC — Tranh', '5'], ['AFF có QC — Decal', '5,5'], ['AFF không QC — Tranh', '10'], ['AFF không QC — Decal', '15'],
    ['Phí bồi hoàn V/C — Tranh', '2008'], ['Phí bồi hoàn V/C — Decal', '2.008'],
  ];
  for (const [nhan, gt] of o) {
    const sel = `[aria-label="${nhan}"]`;
    await vaoO(sel);
    await p.keyboard.press('Delete');
    await p.keyboard.type(gt);
    // trong lúc gõ: KHÔNG định dạng lại (con trỏ không nhảy)
    assert.equal(await p.inputValue(sel), gt);
    await p.press(sel, 'Tab');
    assert.equal(await yNay(), y0, `cuộn bị nhảy sau khi sửa ${nhan}`);
    assert.ok(await bangCu(), `bảng bị vẽ lại sau khi sửa ${nhan}`);
  }
  // rời ô mới chuẩn hóa: "22.6" → "22,6", "2008" → "2.008", "2.008" giữ "2.008"
  assert.equal(await p.inputValue('[aria-label="Phí sàn — Decal"]'), '22,6');
  assert.equal(await p.inputValue('[aria-label="Chi phí QC — Decal"]'), '8,14');
  assert.equal(await p.inputValue('[aria-label="Phí bồi hoàn V/C — Tranh"]'), '2.008');
  assert.equal(await p.inputValue('[aria-label="Phí bồi hoàn V/C — Decal"]'), '2.008');
  assert.match(await p.textContent('.hang-luu'), /Sẽ lưu phí tháng 10\/2026 cho: Tranh, Decal/);

  // 2) Lăn chuột trên ô đang focus + phím ↑↓ → số KHÔNG đổi
  const sel = '[aria-label="Phí sàn — Tranh"]';
  await vaoO(sel);
  const truoc = await p.inputValue(sel);
  const hop = await p.locator(sel).boundingBox();
  await p.mouse.move(hop.x + 10, hop.y + 10);
  await p.mouse.wheel(0, 120);
  await p.mouse.wheel(0, -120);
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.inputValue(sel), truoc);
  await p.waitForTimeout(600); // chờ hiệu ứng cuộn mượt của bánh xe chuột kết thúc
  await p.evaluate((y) => window.scrollTo(0, y), y0);
  assert.equal(await yNay(), y0);

  // 3) Esc hủy phần đang gõ; Enter chuyển sang ô kế tiếp
  await p.keyboard.type('99');
  await p.keyboard.press('Escape');
  assert.equal(await p.inputValue(sel), truoc);
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Phí sàn — Lịch');

  // 4) Đồng bộ nền mang dữ liệu mới về khi đang có ô sửa chưa lưu → KHÔNG vẽ lại, chỉ hiện "Có dữ liệu mới"
  await goiGas({ action: 'upsert', token: await tokenAdmin(), sheet: 'BANG_PHI', banGhi: [{ gian: 'Nhà Sách', nganh: 'Sách', thang: '2026-09', phi_san: 11, phi_vc: 1, phi_xl: 1, phi_qc: 1, aff_qc: 1, aff_noqc: 1 }] });
  await p.keyboard.type('21,5'); // đang gõ dở trong ô Phí sàn — Lịch
  await p.evaluate(() => document.getElementById('trang-thai-dong-bo').dispatchEvent(new MouseEvent('click'))); // = đồng bộ nền, không mất focus
  await p.waitForSelector('.du-lieu-moi');
  assert.ok(await bangCu(), 'đồng bộ nền không được vẽ lại bảng khi đang sửa');
  assert.equal(await yNay(), y0);
  assert.equal(await p.inputValue('[aria-label="Phí sàn — Lịch"]'), '21,5');
  assert.equal(await p.inputValue('[aria-label="Phí sàn — Decal"]'), '22,6');
  // Bấm "Tải lại": vẽ lại nhưng giữ số đang sửa + vị trí cuộn
  await p.evaluate(() => [...document.querySelectorAll('.du-lieu-moi button')].find((b) => b.textContent === 'Tải lại').click());
  assert.ok(!(await bangCu()));
  assert.equal(await yNay(), y0);
  assert.equal(await p.inputValue('[aria-label="Phí sàn — Decal"]'), '22,6');
  assert.equal(await p.inputValue('[aria-label="Phí sàn — Lịch"]'), '21,5');

  // 5) Lưu → cập nhật tại chỗ, giữ vị trí cuộn
  await p.evaluate(() => document.querySelector('.hang-luu .nut-chinh').click());
  await p.waitForSelector('.thong-bao-ok >> text=Đã lưu bộ phí');
  assert.equal(await yNay(), y0);
  assert.equal(await p.inputValue('[aria-label="Phí sàn — Decal"]'), '22,6');
  assert.equal(await p.inputValue('[aria-label="Chi phí QC — Tranh"]'), '8,14');
  assert.match(await p.textContent('.hang-luu'), /Chưa có thay đổi/);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Tính lợi nhuận: sửa giá 1 dòng chỉ cập nhật dòng đó (không vẽ lại bảng, dòng không nhảy khi đang sắp xếp)', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const X = ctx.XLSX;
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Tên sản phẩm', 'Ngành hàng', 'Giá vốn', 'Giá bán'],
    ...Array.from({ length: 40 }, (_, i) => [`SP ${i + 1}`, 'Tranh', 10000 + i * 100, 60000 + i * 1000])]), 'Sản phẩm');
  const f = path.join(tmp, 'ds40.xlsx');
  fs.writeFileSync(f, X.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  await p.setViewportSize({ width: 1280, height: 700 });
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#tab-loi-nhuan .vung-tha')]);
  await fc.setFiles(f);
  await p.waitForSelector('.bang-ln tbody tr');
  await p.click('.th-sap-xep >> nth=0'); // sắp xếp theo lãi
  await p.evaluate(() => { window.scrollTo(0, 300); document.querySelector('.khung-bang[data-cuon]').scrollTop = 80; document.querySelector('.bang-ln').__danhDau = 'cu'; });
  const cuonBang0 = await p.evaluate(() => document.querySelector('.khung-bang[data-cuon]').scrollTop);
  const y0 = await p.evaluate(() => window.scrollY);
  const tenDong3 = await p.inputValue('.bang-ln tbody tr:nth-child(3) [aria-label^="Tên"]');
  await p.evaluate(() => { const el = document.querySelector('.bang-ln tbody tr:nth-child(3) [aria-label^="Giá bán"]'); el.focus({ preventScroll: true }); el.select(); });
  await p.keyboard.type('1000'); // giá rất thấp → lẽ ra xuống cuối nếu sắp xếp lại
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => document.querySelector('.bang-ln').__danhDau), 'cu', 'bảng không được vẽ lại');
  assert.equal(await p.evaluate(() => window.scrollY), y0);
  assert.equal(await p.evaluate(() => document.querySelector('.khung-bang[data-cuon]').scrollTop), cuonBang0);
  assert.equal(await p.inputValue('.bang-ln tbody tr:nth-child(3) [aria-label^="Tên"]'), tenDong3, 'dòng không được nhảy chỗ');
  assert.equal(await p.inputValue('.bang-ln tbody tr:nth-child(3) [aria-label^="Giá bán"]'), '1.000');
  assert.ok(await p.locator('.bang-ln tbody tr:nth-child(3).dong-lo').count());
  // Enter đã chuyển con trỏ sang ô kế tiếp
  assert.match(await p.evaluate(() => document.activeElement.getAttribute('aria-label') || ''), /dòng/);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Bảng phí: ngành thiếu Chi phí QC → ô tô vàng + cảnh báo; nhập QC thì hết cảnh báo', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  await p.click('[data-tab="bang-phi"]');
  await p.click('.vien-gian:has-text("Nhà Sách")');
  await p.waitForSelector('[aria-label="Chi phí QC — Trà"]');
  assert.equal(await p.locator('.bang-phi td.o-thieu-qc').count(), 1);
  assert.match(await p.textContent('.canh-bao-qc'), /Trà: Chưa nhập phí QC – lãi Có QC sẽ bị tính cao hơn thực tế/);
  await p.fill('[aria-label="Chi phí QC — Trà"]', '6');
  assert.equal(await p.locator('.bang-phi td.o-thieu-qc').count(), 0);
  assert.ok(await p.locator('.canh-bao-qc').isHidden());
  assert.deepEqual(loi, []);
  await p.close();
});

test('Bảng phí: tab con Shopee | TikTok; Shopee hiện mặc định, tính tổng, lưu vào BANG_PHI_SHOPEE; TikTok giữ nguyên', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  await p.click('[data-tab="bang-phi"]');
  // mặc định mở TikTok như trước
  assert.deepEqual(await p.$$eval('#tab-bang-phi .tab-con-san [role=tab]', (ds) => ds.map((b) => b.textContent)), ['Shopee', 'TikTok']);
  assert.equal(await p.getAttribute('[data-san="tiktok"]', 'aria-selected'), 'true');
  await p.waitForSelector('#bang-phi-tiktok .bang-phi');

  await p.click('[data-san="shopee"]');
  assert.ok(await p.locator('#bang-phi-tiktok').isHidden());
  assert.deepEqual(await p.$$eval('#bang-phi-shopee .vien-gian', (ds) => ds.map((b) => b.textContent)),
    ['Nhà Sách', 'CN1', 'CN2', 'Tường Vip', 'Tranh Vip', 'Tường Vip New']);
  await p.click('#bang-phi-shopee .vien-gian:has-text("CN1")');
  await p.waitForSelector('[aria-label="Phí cố định — Lịch"]');
  assert.equal(await p.inputValue('[aria-label="Phí cố định — Lịch"]'), '18,7');
  assert.equal(await p.inputValue('[aria-label="Phí cố định — Sách"]'), '19,1');
  assert.equal(await p.inputValue('[aria-label="Phí hạ tầng — Trà"]'), '3.000');
  assert.equal(await p.inputValue('[aria-label="Voucher Xtra — Tranh"]'), '5,5');
  assert.match(await p.textContent('#bang-phi-shopee .ghi-chu'), /đang hiện giá trị mặc định/);
  const tong = await p.$$eval('#bang-phi-shopee tfoot tr:first-child td', (ds) => ds.map((d) => d.textContent));
  assert.match(tong[0], /^50(,0)?\s?%$/);
  assert.match(tong[2], /^49,6\s?%$/);

  // sửa 1 ô → tổng cập nhật ngay; lưu → ghi 5 ngành vào sheet Shopee
  await p.fill('[aria-label="AFF — Sách"]', '3');
  await p.press('[aria-label="AFF — Sách"]', 'Tab');
  assert.match((await p.$$eval('#bang-phi-shopee tfoot tr:first-child td', (ds) => ds.map((d) => d.textContent)))[0], /^51(,0)?\s?%$/);
  assert.match(await p.textContent('#bang-phi-shopee .hang-luu'), /cho: Sách, Tranh, Lịch, Decal, Trà/);
  await p.click('#bang-phi-shopee .hang-luu .nut-chinh');
  await p.waitForSelector('#bang-phi-shopee .ghi-chu-xanh');
  const du = await docGas();
  const cn1 = du.BANG_PHI_SHOPEE.filter((x) => x.gian === 'CN1');
  assert.equal(cn1.length, 5);
  assert.equal(cn1.find((x) => x.nganh === 'Sách').aff, 3);
  assert.ok(!du.BANG_PHI.some((x) => x.gian === 'CN1'), 'không ghi vào bảng phí TikTok');
  assert.match(await p.textContent('#bang-phi-shopee .hang-luu'), /Chưa có thay đổi/);

  // quay lại TikTok: bảng TikTok vẫn như cũ; tab con được nhớ khi mở lại trang
  await p.click('[data-san="tiktok"]');
  assert.ok(await p.locator('#bang-phi-tiktok .bang-phi').isVisible());
  assert.ok(await p.locator('#bang-phi-shopee').isHidden());
  await p.click('[data-san="shopee"]');
  await p.reload();
  await p.waitForSelector('.dong-bo-xong');
  await p.click('[data-tab="bang-phi"]');
  assert.equal(await p.getAttribute('[data-san="shopee"]', 'aria-selected'), 'true');
  assert.deepEqual(loi, []);
  await p.close();
});

test('Tính lợi nhuận: chọn nền tảng Shopee | TikTok; Shopee mỗi gian 1 cột lãi theo phí Shopee, chưa có phí thì không tính; nhớ lựa chọn', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  const chon = (k) => p.getAttribute(`[data-nen-tang="${k}"]`, 'aria-selected');
  assert.deepEqual(await p.$$eval('#tab-loi-nhuan .tab-con-san [role=tab]', (ds) => ds.map((b) => b.textContent)), ['Shopee', 'TikTok']);
  assert.equal(await chon('tiktok'), 'true', 'lần đầu mở TikTok như trước');
  const fSan = taoFile('ln-san.xlsx', [
    ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán'],
    ['Tranh A', '30x40', 'Tranh', 20000, 100000],
    ['Tranh B', '60x90', 'Tranh', 80000, 100000],
  ]);
  await napFile(p, fSan);
  const gianDau = () => p.$$eval('.bang-ln .th-gian', (ds) => ds.map((d) => [d.textContent, d.colSpan]));
  // TikTok: như hiện tại — gian TikTok, 2 cột lãi mỗi gian
  assert.deepEqual(await gianDau(), [['Nhà Sách', 2], ['Sách Hay', 2], ['Tranh Lịch', 2], ['Tường Vip', 2]]);
  assert.equal(await p.locator('.bang-ln tbody tr:first-child .o-lai').count(), 8);

  await doiSanLuuNhap(p, 'shopee', 'Bảng TikTok thử');
  assert.equal(await chon('shopee'), 'true');
  // mỗi sàn có bảng tính riêng → bảng Shopee nhập lại cùng file
  await batDauBangTrong(p);
  await napFile(p, fSan);
  assert.deepEqual(await gianDau(), ['Nhà Sách', 'CN1', 'CN2', 'Tường Vip', 'Tranh Vip', 'Tường Vip New'].map((g) => [g, 1]));
  const o = await p.$$eval('.bang-ln tbody tr:first-child .o-lai', (ds) => ds.map((d) => [d.querySelector('div')?.textContent ?? d.textContent, d.title]));
  assert.equal(o.length, 6);
  // Nhà Sách chưa lưu bộ phí Shopee → "chưa có phí", không tính bằng phí mặc định
  assert.equal(o[0][0], 'chưa có phí');
  assert.match(o[0][1], /Chưa có bộ phí Tranh cho gian này/);
  // chỉ Tranh Vip × Tranh có phí (tổng 60%): 100.000 − 20.000 − 3.000 − 60.000 = 17.000
  assert.equal(o[4][0], '17.000');
  // CN1 bỏ qua: test Bảng phí Shopee phía trên có thể đã lưu phí cho CN1
  assert.deepEqual([0, 2, 3, 5].map((i) => o[i][0]), Array(4).fill('chưa có phí'));
  // Tranh B lỗ ở Tranh Vip: 100.000 − 80.000 − 3.000 − 60.000 = −43.000
  assert.ok(await p.locator('.bang-ln tbody tr:nth-child(2).dong-lo').count());
  assert.match(await p.textContent('.luoi-tong-ket'), /2 dòng chưa có phí/);
  assert.doesNotMatch(await p.textContent('.luoi-tong-ket'), /mặc định/);
  // sắp xếp theo lãi gian Shopee
  await p.click('.bang-ln .th-sap-xep:nth-child(5) button');
  assert.match(await p.textContent('.chip-sap-xep'), /Tranh Vip · lãi ↓/);

  // tải lại trang → vẫn Shopee
  await p.reload();
  await p.waitForSelector('.dong-bo-xong');
  assert.equal(await chon('shopee'), 'true');
  await p.waitForSelector('.bang-ln .th-gian');
  assert.equal(await p.locator('.bang-ln .th-gian').count(), 6);
  // quay lại TikTok → mở lại bảng TikTok (dùng gần nhất)
  await doiSanLuuNhap(p, 'tiktok', 'Bảng Shopee thử');
  await p.waitForSelector('.bang-ln .th-gian');
  assert.deepEqual((await gianDau()).map(([, n]) => n), [2, 2, 2, 2]);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Bảng phí Shopee: thêm gian mới → hiện ở Bảng phí và ở Tính lợi nhuận chế độ Shopee; không lẫn sang TikTok', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  await p.click('[data-tab="bang-phi"]');
  await p.click('[data-san="shopee"]');
  await p.click('#bang-phi-shopee summary:has-text("Gian hàng Shopee")');
  await p.fill('[aria-label="Thêm — Gian hàng Shopee"]', 'CN3');
  await p.click('#bang-phi-shopee .khoi-danh-muc button[type=submit]');
  await p.waitForSelector('#bang-phi-shopee .vien-gian:has-text("CN3")');
  assert.deepEqual(await p.$$eval('#bang-phi-shopee .vien-gian', (ds) => ds.map((b) => b.textContent)),
    ['Nhà Sách', 'CN1', 'CN2', 'Tường Vip', 'Tranh Vip', 'Tường Vip New', 'CN3']);
  const du = await docGas();
  assert.deepEqual(du.DANH_MUC.filter((d) => d.loai === 'GIAN_SHOPEE').map((d) => d.ten),
    ['Nhà Sách', 'CN1', 'CN2', 'Tường Vip', 'Tranh Vip', 'Tường Vip New', 'CN3']);
  assert.ok(!du.DANH_MUC.some((d) => d.loai === 'GIAN' && d.ten === 'CN3'));
  // TikTok không có CN3
  await p.click('[data-san="tiktok"]');
  assert.equal(await p.locator('#bang-phi-tiktok .vien-gian:has-text("CN3")').count(), 0);
  // Tính lợi nhuận → Shopee có thêm cột CN3
  await p.click('[data-tab="loi-nhuan"]');
  await p.click('[data-nen-tang="shopee"]');
  await p.click('text=➕ Thêm dòng');
  assert.deepEqual(await p.$$eval('.bang-ln .th-gian', (ds) => ds.map((d) => d.textContent)),
    ['Nhà Sách', 'CN1', 'CN2', 'Tường Vip', 'Tranh Vip', 'Tường Vip New', 'CN3']);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Bảng phí Shopee: file mẫu, xuất Excel, nhập Excel có xem trước (mới / thay đổi / lỗi) và chỉ ghi khi xác nhận', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const X = ctx.XLSX;
  const docTai = async (nut) => {
    const [tai] = await Promise.all([p.waitForEvent('download'), p.click(nut)]);
    const wb = X.read(fs.readFileSync(await tai.path()), { type: 'buffer' });
    return JSON.parse(JSON.stringify(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })));
  };
  const docPhiSP = async () => (await docGas()).BANG_PHI_SHOPEE;
  await p.click('[data-tab="bang-phi"]');
  await p.click('[data-san="shopee"]');
  await p.waitForSelector('#bang-phi-shopee .bang-phi-shopee');

  const mau = await docTai('#bang-phi-shopee button:has-text("File mẫu")');
  assert.equal(mau.length, 6);
  assert.equal(mau[0][0], 'Gian hàng');
  assert.deepEqual(mau.slice(1).map((d) => d[1]), ['Sách', 'Tranh', 'Lịch', 'Decal', 'Trà']);
  const xuat = await docTai('#bang-phi-shopee button:has-text("Xuất Excel")');
  assert.equal(xuat.length, (await docPhiSP()).length + 1);
  const tv = xuat.find((d) => d[0] === 'Tranh Vip' && d[1] === 'Tranh');
  assert.equal(tv[2], '08/2026');

  // file nhập: Tranh Vip × Tranh đổi AFF 12 → 13; CN2 × Sách tháng 12/2026 mới; 1 dòng lỗi
  const tieuDe = mau[0];
  const sua = [...tv]; sua[tieuDe.indexOf('AFF (%)')] = 13;
  const moi = [...mau[1]]; moi[0] = 'CN2'; moi[2] = '12/2026';
  const sai = [...mau[2]]; sai[0] = 'CN2'; sai[2] = '12/2026'; sai[tieuDe.indexOf('Phí xử lý (%)')] = 'sáu';
  const nhap = async (ten, dong) => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#bang-phi-shopee button:has-text("Nhập Excel")')]);
    await fc.setFiles(taoFile(ten, [tieuDe, ...dong]));
    await p.waitForSelector('.xem-truoc-nhap');
  };
  const truoc = JSON.stringify(await docPhiSP());
  await nhap('loi.xlsx', [sua, moi, sai]);
  assert.match(await p.textContent('.tom-tat-nhap'), /1 dòng mới\s+1 dòng thay đổi\s+1 dòng lỗi/);
  assert.match(await p.textContent('.nhom-loi'), /Dòng 4: Phí xử lý: không phải số/);
  assert.match(await p.textContent('.nhom-doi'), /Tranh Vip · Tranh · 08\/2026 .*AFF 12 → 13/);
  assert.ok(await p.locator('.xem-truoc-nhap .nut-chinh').isDisabled(), 'còn dòng lỗi thì không cho lưu');
  await p.click('.xem-truoc-nhap button:has-text("Hủy")');
  assert.equal(JSON.stringify(await docPhiSP()), truoc, 'chưa xác nhận thì không ghi gì');

  await nhap('dung.xlsx', [sua, moi]);
  assert.equal(JSON.stringify(await docPhiSP()), truoc, 'mở xem trước chưa ghi gì');
  await p.click('.xem-truoc-nhap button:has-text("Lưu 2 bộ phí")');
  await p.waitForSelector('.xem-truoc-nhap', { state: 'detached' });
  const sau = await docPhiSP();
  assert.equal(sau.find((x) => x.gian === 'Tranh Vip' && x.nganh === 'Tranh' && x.thang === '2026-08').aff, 13);
  assert.equal(sau.find((x) => x.gian === 'CN2' && x.nganh === 'Sách' && x.thang === '2026-12').phi_co_dinh, 19.1);
  assert.deepEqual(loi, []);
  await p.close();
});

/** Gọi thẳng Apps Script giả lập TỪ TRANG bằng token đang đăng nhập (bỏ qua giao diện). */
const goiBangTokenTrang = (p, body) => p.evaluate(async (body) => {
  const { token } = JSON.parse(sessionStorage.getItem('bggl.phien.v1'));
  return (await fetch('/gas', { method: 'POST', body: JSON.stringify({ ...body, token }) })).json();
}, body);

test('Vai trò shopee: chỉ thấy phần Shopee; SỬA được bảng phí + gian Shopee; không đụng được TikTok', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('shopee');
  assert.match(await p.textContent('#nguoi-dung'), /nv-shopee\s*\(shopee\)/);
  const tabHien = await p.$$eval('.thanh-tab [role=tab]:not([hidden])', (ds) => ds.map((b) => b.dataset.tab));
  assert.deepEqual(tabHien, ['loi-nhuan', 'bang-phi'], 'không có tab Tài khoản');
  // Tính lợi nhuận: chỉ nền tảng Shopee; bảng tính CỦA MÌNH lưu được (sàn Shopee)
  assert.deepEqual(await p.$$eval('[data-nen-tang]', (ds) => ds.map((b) => b.dataset.nenTang)), ['shopee']);
  assert.match(await p.textContent('.dong-phien'), /👤 nv-shopee · Shopee · 📄 Bảng của nv-shopee – Shopee/);
  await p.click('text=➕ Thêm dòng');
  await p.click('text=💾 Lưu lên Sheets');
  await p.waitForSelector('.chuc-mung >> text=Đã lưu');
  // Bảng phí: chỉ tab con Shopee, ô mở khóa, có Lưu / Hoàn tác / Nhập Excel / thêm gian
  await p.click('[data-tab="bang-phi"]');
  assert.deepEqual(await p.$$eval('#tab-bang-phi .tab-con-san [role=tab]', (ds) => ds.map((b) => b.textContent)), ['Shopee']);
  await p.click('#bang-phi-shopee .vien-gian:has-text("Tường Vip New")');
  const o = '[aria-label="Phí xử lý — Decal"]';
  await p.waitForSelector(o);
  assert.ok(await p.locator(o).isEnabled());
  assert.equal(await p.locator('.chi-xem').count(), 0);
  assert.equal(await p.locator('#bang-phi-shopee button:has-text("Nhập Excel")').count(), 1);
  // Hoàn tác: bỏ phần vừa gõ
  const truoc = await p.inputValue(o);
  await p.fill(o, '7,7'); await p.press(o, 'Tab');
  await p.click('#bang-phi-shopee .hang-luu button:has-text("Hoàn tác")');
  assert.equal(await p.inputValue(o), truoc);
  // Lưu
  await p.fill(o, '6,6'); await p.press(o, 'Tab');
  await p.click('#bang-phi-shopee .hang-luu .nut-chinh');
  await p.waitForSelector('#bang-phi-shopee .ghi-chu-xanh');
  assert.ok((await docGas()).BANG_PHI_SHOPEE.some((x) => x.gian === 'Tường Vip New' && x.nganh === 'Decal' && x.phi_xu_ly === 6.6));
  // Xóa bộ phí tháng (vừa tạo)
  await p.click('#bang-phi-shopee button:has-text("Xóa bộ phí tháng")');
  await p.click('dialog[open] button:has-text("Xóa")');
  await p.waitForSelector('#bang-phi-shopee button:has-text("Xóa bộ phí tháng")', { state: 'detached' });
  assert.ok(!(await docGas()).BANG_PHI_SHOPEE.some((x) => x.gian === 'Tường Vip New' && x.phi_xu_ly === 6.6));
  // Thêm rồi bớt gian Shopee
  await p.click('#bang-phi-shopee summary:has-text("Gian hàng Shopee")');
  await p.fill('[aria-label="Thêm — Gian hàng Shopee"]', 'CN-NV');
  await p.click('#bang-phi-shopee .khoi-danh-muc button[type=submit]');
  await p.waitForSelector('#bang-phi-shopee .vien-gian:has-text("CN-NV")');
  if (!(await p.locator('[aria-label="Bỏ CN-NV"]').isVisible())) await p.click('#bang-phi-shopee summary:has-text("Gian hàng Shopee")');
  await p.click('[aria-label="Bỏ CN-NV"]');
  await p.click('dialog[open] button:has-text("Đồng ý")');
  await p.waitForSelector('#bang-phi-shopee .vien-gian:has-text("CN-NV")', { state: 'detached' });
  // Dữ liệu tạm trên máy chỉ có phần Shopee (Apps Script đã lọc)
  const cache = await p.evaluate(() => JSON.parse(localStorage.getItem('bggl.cache.v1')));
  assert.equal(cache.nguoi, 'nv-shopee');
  for (const k of ['BANG_PHI', 'GIA_VON', 'NOI_SKU', 'CAMPAIGN']) assert.deepEqual(cache.duLieu[k], [], k);
  assert.ok(cache.duLieu.DANH_MUC.every((d) => d.loai === 'GIAN_SHOPEE'));
  // Gõ thẳng #gia-von / #tai-khoan → không mở được
  for (const tab of ['gia-von', 'tai-khoan']) {
    await p.goto(`${URL_APP}/?lan=${tab}#${tab}`); // đổi query để tải lại trang thật
    await p.waitForSelector('.dong-bo-xong');
    assert.notEqual(await p.evaluate(() => location.hash), `#${tab}`);
    assert.ok(await p.locator(`#tab-${tab}`).isHidden());
  }
  // Gọi thẳng Apps Script bằng token shopee để ghi phần TikTok → bị từ chối
  for (const body of [
    { action: 'upsert', sheet: 'BANG_PHI', banGhi: [{ gian: 'Nhà Sách', nganh: 'Sách', thang: '2026-10', phi_san: 1 }] },
    { action: 'xoa', sheet: 'BANG_PHI', khoa: [{ gian: 'Nhà Sách', nganh: 'Sách', thang: '2026-08' }] },
    { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'GIAN', ten: 'Nhà Sách', dang_dung: 'khong' }] },
    { action: 'luuBangTinh', bangTinh: { id: 'x', ten: 'x' }, dong: [] },
  ]) {
    const r = await goiBangTokenTrang(p, body);
    assert.equal(r.ma, 'KHONG_CO_QUYEN', `${body.action} ${body.sheet || ''}`);
  }
  assert.ok((await docGas()).DANH_MUC.every((d) => !(d.loai === 'GIAN' && d.dang_dung === 'khong')));
  assert.deepEqual(loi, []);
  await p.close();
});

test('Vai trò tiktok: chỉ thấy phần TikTok; SỬA được bảng phí + gian TikTok; không đụng được Shopee', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('tiktok');
  assert.deepEqual(await p.$$eval('[data-nen-tang]', (ds) => ds.map((b) => b.dataset.nenTang)), ['tiktok']);
  assert.equal(await p.locator('[data-tab="tai-khoan"]').isHidden(), true);
  await p.click('[data-tab="bang-phi"]');
  assert.deepEqual(await p.$$eval('#tab-bang-phi .tab-con-san [role=tab]', (ds) => ds.map((b) => b.textContent)), ['TikTok']);
  await p.click('#bang-phi-tiktok .vien-gian:has-text("Sách Hay")');
  const o = '[aria-label="AFF có QC — Lịch"]';
  await p.waitForSelector(o);
  assert.ok(await p.locator(o).isEnabled());
  assert.equal(await p.locator('button:has-text("Nhập từ Excel")').count(), 1);
  assert.equal(await p.locator('#bang-phi-tiktok summary:has-text("Gian hàng & ngành")').count(), 1);
  await p.fill(o, '4,4'); await p.press(o, 'Tab');
  await p.click('#bang-phi-tiktok .hang-luu .nut-chinh');
  await p.waitForSelector('#bang-phi-tiktok .ghi-chu-xanh');
  assert.ok((await docGas()).BANG_PHI.some((x) => x.gian === 'Sách Hay' && x.nganh === 'Lịch' && x.aff_qc === 4.4));
  const cache = await p.evaluate(() => JSON.parse(localStorage.getItem('bggl.cache.v1')));
  assert.deepEqual(cache.duLieu.BANG_PHI_SHOPEE, []);
  assert.ok(!cache.duLieu.DANH_MUC.some((d) => d.loai === 'GIAN_SHOPEE'));
  // Gọi thẳng Apps Script bằng token tiktok để ghi phần Shopee → bị từ chối
  const truoc = JSON.stringify((await docGas()).BANG_PHI_SHOPEE);
  for (const body of [
    { action: 'upsert', sheet: 'BANG_PHI_SHOPEE', banGhi: [{ gian: 'CN1', nganh: 'Sách', thang: '2026-10', phi_co_dinh: 1 }] },
    { action: 'xoa', sheet: 'BANG_PHI_SHOPEE', khoa: [{ gian: 'Tranh Vip', nganh: 'Tranh', thang: '2026-08' }] },
    { action: 'upsert', sheet: 'DANH_MUC', banGhi: [{ loai: 'GIAN_SHOPEE', ten: 'CN1', dang_dung: 'khong' }] },
  ]) {
    const r = await goiBangTokenTrang(p, body);
    assert.equal(r.ma, 'KHONG_CO_QUYEN', `${body.action} ${body.sheet}`);
  }
  assert.equal(JSON.stringify((await docGas()).BANG_PHI_SHOPEE), truoc);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Admin quản lý tài khoản trên giao diện: thêm, đổi vai trò, đổi mật khẩu, xóa (người bị xóa bị đăng xuất)', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('admin');
  await p.click('[data-tab="tai-khoan"]');
  await p.waitForSelector('.bang-tai-khoan');
  assert.deepEqual(await p.$$eval('.bang-tai-khoan tbody tr', (ds) => ds.map((d) => d.dataset.tk)), ['admin', 'nv-shopee', 'nv-tiktok']);
  assert.ok(!(await p.textContent('#tab-tai-khoan')).includes('sha256'), 'không hiện hash');
  // thêm
  await p.fill('[aria-label="Tên đăng nhập mới"]', 'nv-moi');
  await p.fill('[aria-label="Mật khẩu tài khoản mới"]', 'mat-khau-nv-moi');
  await p.selectOption('[aria-label="Vai trò tài khoản mới"]', 'tiktok');
  await p.click('.hang-them-tk button[type=submit]');
  await p.waitForSelector('tr[data-tk="nv-moi"]');
  // đổi vai trò
  await p.selectOption('[aria-label="Vai trò nv-moi"]', 'shopee');
  await p.click('dialog[open] button:has-text("Đồng ý")');
  await p.waitForFunction(() => document.querySelector('[aria-label="Vai trò nv-moi"]')?.value === 'shopee' && !document.querySelector('dialog[open]'));
  // đổi mật khẩu
  await p.click('tr[data-tk="nv-moi"] >> text=🔑 Đổi mật khẩu');
  await p.fill('#tk-mk-moi', 'mat-khau-moi-2');
  await p.click('dialog[open] >> text=Lưu mật khẩu');
  await p.waitForSelector('#tk-mk-moi', { state: 'detached' });
  // nv-moi đăng nhập bằng mật khẩu mới ở máy khác → vai trò shopee
  const p2 = await trinhDuyet.newPage();
  await p2.addInitScript((url) => { if (!sessionStorage.getItem('x')) { localStorage.setItem('bggl.caidat.v1', JSON.stringify({ url })); sessionStorage.setItem('x', '1'); } }, `${URL_APP}/gas`);
  await p2.goto(`${URL_APP}/#loi-nhuan`);
  await dienDangNhap(p2, 'nv-moi', 'mat-khau-nv-moi');
  await p2.waitForSelector('.dn-loi .dong-kq-loi');
  await dienDangNhap(p2, 'nv-moi', 'mat-khau-moi-2');
  await p2.waitForSelector('.dong-bo-xong');
  assert.match(await p2.textContent('#nguoi-dung'), /nv-moi\s*\(shopee\)/);
  // admin xóa nv-moi → lần đồng bộ sau của nv-moi hiện lại màn đăng nhập
  await p.click('[aria-label="Xóa nv-moi"]');
  await p.click('dialog[open] button:has-text("Xóa")');
  await p.waitForSelector('tr[data-tk="nv-moi"]', { state: 'detached' });
  await p2.evaluate(() => document.getElementById('trang-thai-dong-bo').click());
  await p2.waitForSelector('#dn-ten');
  assert.match(await p2.textContent('.dn-loi'), /hết hạn hoặc tài khoản đã đổi/);
  assert.equal(await p2.evaluate(() => sessionStorage.getItem('bggl.phien.v1')), null);
  // admin không tự xóa được mình: không có nút xóa ở dòng của mình
  assert.equal(await p.locator('[aria-label="Xóa admin"]').count(), 0);
  assert.deepEqual(loi, []);
  await p.close();
  await p2.close();
});

test('Đăng xuất xóa phiên + dữ liệu tạm; đăng nhập sai 5 lần thì khóa tạm', { skip: boQua }, async () => {
  await goiGas({ action: 'themTaiKhoan', token: await tokenAdmin(), ten: 'nv-khoa', matKhau: 'mat-khau-khoa', vaiTro: 'tiktok' });
  const { p, loi } = await moTrang('admin');
  assert.ok(await p.evaluate(() => localStorage.getItem('bggl.cache.v1')));
  await p.click('#nut-dang-xuat');
  await p.waitForSelector('#dn-ten');
  assert.equal(await p.evaluate(() => sessionStorage.getItem('bggl.phien.v1')), null);
  assert.equal(await p.evaluate(() => localStorage.getItem('bggl.cache.v1')), null);
  for (let i = 0; i < 5; i++) {
    await dienDangNhap(p, 'nv-khoa', `sai-${i}`);
    await p.waitForFunction((i) => /Sai tên đăng nhập/.test(document.querySelector('.dn-loi')?.textContent) && !document.querySelector('.hop-dang-nhap button[type=submit]').disabled, i);
  }
  await dienDangNhap(p, 'nv-khoa', 'mat-khau-khoa');
  await p.waitForFunction(() => /khóa 10 phút/.test(document.querySelector('.dn-loi')?.textContent));
  assert.equal(await p.evaluate(() => sessionStorage.getItem('bggl.phien.v1')), null);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Hết phiên khi đang sửa bảng phí: đăng nhập lại cùng tài khoản → giữ phần đang sửa, lưu được', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('admin');
  await p.click('[data-tab="bang-phi"]');
  await p.click('[data-san="shopee"]');
  await p.click('#bang-phi-shopee .vien-gian:has-text("CN2")');
  await p.fill('[aria-label="AFF — Trà"]', '4,5');
  await p.press('[aria-label="AFF — Trà"]', 'Tab');
  // thu hồi token (= hết 6 giờ) rồi đồng bộ
  await p.evaluate(async () => {
    const { token } = JSON.parse(sessionStorage.getItem('bggl.phien.v1'));
    await fetch('/gas', { method: 'POST', body: JSON.stringify({ action: 'dangXuat', token }) });
    document.getElementById('trang-thai-dong-bo').click();
  });
  await p.waitForSelector('#dn-ten');
  assert.equal(await p.inputValue('#dn-ten'), 'admin', 'điền sẵn tên cũ');
  await p.fill('#dn-mk', TK.admin[1]);
  await p.click('.hop-dang-nhap button[type=submit]');
  await p.waitForSelector('.hop-dang-nhap', { state: 'detached' });
  assert.equal(await p.inputValue('[aria-label="AFF — Trà"]'), '4,5', 'không tải lại trang, phần đang sửa còn nguyên');
  await p.click('#bang-phi-shopee .hang-luu .nut-chinh');
  await p.waitForSelector('#bang-phi-shopee .ghi-chu-xanh');
  const cn2 = (await docGas()).BANG_PHI_SHOPEE.filter((x) => x.gian === 'CN2' && x.nganh === 'Trà');
  assert.ok(cn2.some((x) => x.aff === 4.5));
  assert.deepEqual(loi, []);
  await p.close();
});

test('Hết phiên rồi đăng nhập tài khoản khác → tải lại trang theo vai trò mới', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('admin');
  await p.evaluate(async () => {
    const { token } = JSON.parse(sessionStorage.getItem('bggl.phien.v1'));
    await fetch('/gas', { method: 'POST', body: JSON.stringify({ action: 'dangXuat', token }) });
    document.getElementById('trang-thai-dong-bo').click();
  });
  await p.waitForSelector('#dn-ten');
  await dienDangNhap(p, ...TK.shopee);
  await p.waitForSelector('#nguoi-dung:has-text("nv-shopee")');
  await p.waitForSelector('.dong-bo-xong');
  assert.ok(await p.locator('[data-tab="tai-khoan"]').isHidden());
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('bggl.cache.v1')).duLieu.BANG_PHI.length), 0);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Theme: chọn ở nút 🎨 áp ngay không tải lại trang, giữ khi đổi Shopee/TikTok, tải lại trang, đăng xuất', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('admin');
  const theme = () => p.evaluate(() => document.documentElement.dataset.theme);
  const nenTrang = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await theme(), 'keo-hong', 'mặc định');
  await p.evaluate(() => { window.__chuaTaiLai = true; });
  await p.click('#nut-theme');
  assert.equal(await p.getAttribute('#nut-theme', 'aria-expanded'), 'true');
  const muc = await p.$$eval('.menu-theme .muc-theme', (ds) => ds.map((b) => [b.querySelector('.ten-theme').textContent, b.querySelectorAll('.o-mau i').length]));
  assert.deepEqual(muc.map(([t]) => t), ['Kẹo hồng', 'Sáng tối giản', 'Tối', 'Cam Shopee', 'Đen Cyan TikTok', 'Xanh biển', 'Mint pastel', 'Giấy cổ điển']);
  assert.ok(muc.every(([, n]) => n === 3), 'mỗi dòng có ô màu xem trước');
  await p.click('.muc-theme[data-theme-id="toi"]');
  assert.equal(await theme(), 'toi');
  assert.equal(await nenTrang(), 'rgb(14, 22, 38)');
  assert.equal(await p.evaluate(() => window.__chuaTaiLai), true, 'không tải lại trang');
  assert.equal(await p.evaluate(() => localStorage.getItem('bggl.theme.v1')), 'toi');
  assert.equal(await p.getAttribute('.muc-theme[data-theme-id="toi"]', 'aria-checked'), 'true');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.menu-theme').count(), 0);
  await p.click('#nut-theme');
  await p.mouse.click(5, 500); // bấm ra ngoài → đóng
  assert.equal(await p.locator('.menu-theme').count(), 0);
  assert.equal(await theme(), 'toi');
  // đổi nền tảng Shopee / TikTok → theme giữ nguyên
  await p.click('[data-nen-tang="shopee"]');
  await p.click('[data-nen-tang="tiktok"]');
  assert.equal(await theme(), 'toi');
  // tải lại → khôi phục
  await p.reload();
  await p.waitForSelector('.dong-bo-xong');
  assert.equal(await theme(), 'toi');
  // đăng xuất → màn đăng nhập vẫn dùng theme đã lưu
  await p.click('#nut-dang-xuat');
  await p.waitForSelector('#dn-ten');
  assert.equal(await theme(), 'toi');
  assert.equal(await p.evaluate(() => localStorage.getItem('bggl.theme.v1')), 'toi');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.hop-dang-nhap')).backgroundColor), 'rgb(21, 31, 50)');
  // người khác đăng nhập trên cùng máy → theme vẫn giữ
  await dienDangNhap(p, ...TK.shopee);
  await p.waitForSelector('.dong-bo-xong');
  assert.equal(await theme(), 'toi');
  assert.deepEqual(loi, []);
  await p.close();
});

test('Theme: áp ngay trong <head> trước khi vẽ (không nháy); giá trị lưu không hợp lệ → Kẹo hồng', { skip: boQua }, async () => {
  const p = await trinhDuyet.newPage();
  // ghi lại theme tại thời điểm <body> vừa xuất hiện (trước khi app.js chạy)
  await p.addInitScript(() => {
    localStorage.setItem('bggl.theme.v1', 'giay');
    new MutationObserver((_, ob) => { if (document.body) { window.__themeLucDau = document.documentElement.dataset.theme; ob.disconnect(); } })
      .observe(document, { childList: true, subtree: true });
  });
  await p.goto(`${URL_APP}/`);
  await p.waitForSelector('#nut-theme');
  assert.equal(await p.evaluate(() => window.__themeLucDau), 'giay');
  await p.close();

  const q = await trinhDuyet.newPage();
  await q.addInitScript(() => localStorage.setItem('bggl.theme.v1', 'theme-la'));
  await q.goto(`${URL_APP}/`);
  await q.waitForSelector('#nut-theme');
  assert.equal(await q.evaluate(() => document.documentElement.dataset.theme), 'keo-hong');
  await q.close();
});

test('Điện thoại (390px): thanh trên không tràn ngang, nút 🎨 và ⚙️ nằm trong màn hình, menu theme vừa màn hình', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('admin');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(100);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'không cuộn ngang');
  for (const nut of ['#nut-theme', '#nut-cai-dat', '#nut-dang-xuat']) {
    const r = await p.locator(nut).boundingBox();
    assert.ok(r && r.x >= 0 && r.x + r.width <= 390, `${nut} nằm trong màn hình`);
  }
  assert.ok((await p.locator('#nut-dang-xuat').boundingBox()).height < 40, 'Đăng xuất 1 dòng');
  await p.click('#nut-theme');
  const m = await p.locator('.menu-theme').boundingBox();
  assert.ok(m.x >= 0 && m.x + m.width <= 390 && m.y + m.height <= 844, 'menu vừa màn hình');
  await p.click('.muc-theme[data-theme-id="mint"]');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'mint');
  assert.deepEqual(loi, []);
  await p.close();
});

test('Cả 8 theme: thanh tab 1 hàng ở 1280px; điện thoại 390px không cuộn ngang, nút 🎨 / ⚙️ trong màn hình, bảng phí cuộn trong khung', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('admin');
  const ds = ['keo-hong', 'toi-gian', 'toi', 'cam-shopee', 'den-cyan', 'xanh-bien', 'mint', 'giay'];
  for (const th of ds) {
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), th);
    await p.setViewportSize({ width: 1280, height: 860 });
    await p.click('[data-tab="loi-nhuan"]');
    const hang = await p.$$eval('.thanh-tab [role=tab]:not([hidden])', (bs) => new Set(bs.map((b) => b.offsetTop)).size);
    assert.equal(hang, 1, `${th}: tab rớt dòng ở 1280px`);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.click('[data-tab="bang-phi"]');
    await p.waitForTimeout(50);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${th}: cuộn ngang trên điện thoại`);
    for (const nut of ['#nut-theme', '#nut-cai-dat']) {
      const r = await p.locator(nut).boundingBox();
      assert.ok(r.x >= 0 && r.x + r.width <= 390, `${th}: ${nut} ra ngoài màn hình`);
    }
  }
  assert.deepEqual(loi, []);
  await p.close();
});

test('Phông chữ cả 8 theme: chữ tiếng Việt chỉ dùng 1 họ phông của theme (không lẫn phông dự phòng), không "giả đậm" > 700', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('admin');
  await p.evaluate(() => localStorage.setItem('bggl.loinhuan.v2:admin:tiktok', JSON.stringify({ ds: [{ ten: 'Tranh ệ ở ữ ậ ỵ', phan_loai: '30x40', nganh: 'Tranh', gia_von: 20000, gia_ban: 90000 }] })));
  await p.reload();
  await p.waitForSelector('.bang-ln tbody tr');
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  // Họ phông, bỏ chữ chỉ độ đậm: "Quicksand Light SemiBold" → "Quicksand"
  const ho = (ten) => ten.replace(/\s+(Light|Regular|Medium|SemiBold|Semibold|Bold|Italic)\b/g, '').trim();
  const phongCua = async (chon) => {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: chon });
    const ds = new Set();
    for (const id of nodeIds) for (const f of (await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id })).fonts) if (!/emoji/i.test(f.familyName)) ds.add(ho(f.familyName));
    return [...ds];
  };
  for (const th of ['keo-hong', 'toi-gian', 'toi', 'cam-shopee', 'den-cyan', 'xanh-bien', 'mint', 'giay']) {
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), th);
    await p.waitForTimeout(30);
    // chỉ phần CHỮ (ký hiệu ✓ ↕ ⚠ – mượn phông hệ thống là bình thường)
    const chu = await phongCua('.thuong-hieu h1, .the-dau h2, .mo-ta b, .bang-ln thead th:not(.th-sap-xep), .o-tong-nhan, .hop-kiem-ngang, [aria-label="Tên dòng 1"]');
    assert.equal(chu.length, 1, `${th}: chữ dùng nhiều họ phông ${JSON.stringify(chu)}`);
    assert.match(chu[0], th === 'giay' ? /Times New Roman|Noto Serif|Liberation Serif|DejaVu Serif/ : /^Quicksand$/, `${th}: ${chu[0]}`);
    const nhanBan = await phongCua('[aria-label="Nhân bản dòng 1"]');
    assert.deepEqual(nhanBan, [], `${th}: nút nhân bản phải là emoji, không rơi vào phông lạ (${nhanBan})`);
    const dam = await p.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,th,b,.nut,[role=tab]')].map((e) => +getComputedStyle(e).fontWeight));
    assert.ok(Math.max(...dam) <= 700, `${th}: có chữ đậm ${Math.max(...dam)} > 700`);
  }
  assert.deepEqual(loi, []);
  await p.close();
});

test('Giá cần đạt: mỗi sàn có ô nhập riêng; cột giá cần đạt đúng theo bảng phí sàn đó; nhớ riêng từng sàn; xuất Excel', { skip: boQua }, async () => {
  const { giaCanDatTikTok, giaCanDatShopeeTaiGian, MUC_TIEU_MAC_DINH } = await import('../js/core/gia-can-dat.js');
  const { thangHienTai } = await import('../js/core/phi.js');
  const { p, loi } = await moTrang('admin');
  await p.evaluate(() => {
    localStorage.setItem('bggl.loinhuan.v1', JSON.stringify({ ds: [
      { ten: 'Tranh rẻ', phan_loai: '30x40', nganh: 'Tranh', gia_von: 20000, gia_ban: 30000 },
      { ten: 'Tranh đắt', phan_loai: '60x90', nganh: 'Tranh', gia_von: 20000, gia_ban: 200000 },
      { ten: 'Chưa giá', phan_loai: '', nganh: 'Tranh', gia_von: 20000, gia_ban: null }] }));
    localStorage.removeItem('bggl.loinhuan.giacandat.v1');
  });
  // bản nháp giờ tách theo tài khoản + sàn: dùng cùng danh sách cho cả 2 sàn
  await p.evaluate(() => { const d = localStorage.getItem('bggl.loinhuan.v1'); for (const k of ['tiktok', 'shopee']) localStorage.setItem(`bggl.loinhuan.v2:admin:${k}`, d); });
  await p.reload();
  await p.waitForSelector('.bang-ln tbody tr');
  await p.click('[data-nen-tang="tiktok"]');
  assert.equal(await p.locator('.th-gia-can-dat').count(), 0, 'mặc định tắt');
  // TikTok: bật, 15% giá bán, cả 2 kịch bản, lên 1.000 (mặc định)
  await p.check('[aria-label="Hiện giá cần đạt (TikTok)"]');
  const giansTT = await p.$$eval('.bang-ln .th-gian', (ds) => ds.map((d) => d.textContent));
  assert.equal(await p.locator('.th-gia-can-dat').count(), giansTT.length, 'mỗi gian 1 cột giá cần đạt');
  const du = await docGas();
  const mt = { ...MUC_TIEU_MAC_DINH, bat: true };
  const o = await p.$$eval('.bang-ln tbody tr', (ts) => ts.map((t) => [...t.querySelectorAll('.o-gcd')].map((c) => c.textContent)));
  giansTT.forEach((g, j) => {
    const r = giaCanDatTikTok({ nganh: 'Tranh', gia_von: 20000, gia_ban: 30000 }, g, du.BANG_PHI, thangHienTai(), mt);
    if (r.trangThai !== 'ok') return;
    assert.match(o[0][j], new RegExp(`^${r.gia.toLocaleString('vi-VN').replace(/\./g, '\\.')}thiếu`), `${g}: ${o[0][j]}`);
    assert.match(o[1][j], /✓ đạt$/);
    assert.doesNotMatch(o[2][j], /thiếu|đạt/, 'chưa có giá bán: chỉ hiện giá cần đạt');
  });
  assert.match(await p.textContent('.luoi-tong-ket'), /🎯 1 dòng dưới giá cần đạt/);
  // Shopee: ô nhập riêng, còn tắt; bật với 10.000 đ / đơn
  await doiSanLuuNhap(p, 'shopee', 'GCĐ TikTok');
  assert.equal(await p.isChecked('[aria-label="Hiện giá cần đạt (Shopee)"]'), false, 'Shopee có thiết lập riêng');
  assert.equal(await p.locator('[aria-label="Kịch bản QC (Shopee)"]').count(), 0, 'Shopee không có kịch bản QC');
  await p.check('[aria-label="Hiện giá cần đạt (Shopee)"]');
  await p.selectOption('[aria-label="Đơn vị lãi (Shopee)"]', 'dong');
  assert.equal(await p.inputValue('[aria-label="Lãi mong muốn (Shopee)"]'), '10.000');
  await p.fill('[aria-label="Lãi mong muốn (Shopee)"]', '12.000');
  await p.press('[aria-label="Lãi mong muốn (Shopee)"]', 'Enter');
  await p.waitForFunction(() => document.querySelector('.th-gia-can-dat')?.title.includes('12.000'));
  const giansSP = await p.$$eval('.bang-ln .th-gian', (ds) => ds.map((d) => d.textContent));
  const os = await p.$$eval('.bang-ln tbody tr:nth-child(2) .o-gcd', (cs) => cs.map((c) => c.textContent));
  const mtSP = { ...MUC_TIEU_MAC_DINH, bat: true, donVi: 'dong', giaTri: 12000 };
  giansSP.forEach((g, j) => {
    const r = giaCanDatShopeeTaiGian({ nganh: 'Tranh', gia_von: 20000, gia_ban: 200000 }, g, du.BANG_PHI_SHOPEE, thangHienTai(), mtSP);
    if (r.trangThai === 'thieu-phi') assert.equal(os[j], 'chưa có phí', g);
    else assert.ok(os[j].startsWith(r.gia.toLocaleString('vi-VN')), `${g}: ${os[j]} ≠ ${r.gia}`);
  });
  // quay lại TikTok: thiết lập TikTok còn nguyên (15%)
  await doiSanLuuNhap(p, 'tiktok', 'GCĐ Shopee');
  assert.equal(await p.inputValue('[aria-label="Lãi mong muốn (TikTok)"]'), '15');
  assert.equal(await p.inputValue('[aria-label="Đơn vị lãi (TikTok)"]'), 'pt');
  // tải lại trang → nhớ riêng từng sàn
  await p.reload();
  await p.waitForSelector('.bang-ln tbody tr');
  const luu = await p.evaluate(() => JSON.parse(localStorage.getItem('bggl.loinhuan.giacandat.v1')));
  assert.deepEqual([luu.tiktok.bat, luu.tiktok.giaTri, luu.shopee.bat, luu.shopee.donVi, luu.shopee.giaTri], [true, 15, true, 'dong', 12000]);
  assert.ok(await p.isChecked('[aria-label="Hiện giá cần đạt (TikTok)"]'));
  // xuất Excel có cột giá cần đạt, 5 cột đầu giữ nguyên
  const [tai] = await Promise.all([p.waitForEvent('download'), p.click('text=📤 Xuất Excel')]);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const wb = ctx.XLSX.read(fs.readFileSync(await tai.path()), { type: 'buffer' });
  const dau = JSON.parse(JSON.stringify(ctx.XLSX.utils.sheet_to_json(wb.Sheets['Lợi nhuận'], { header: 1 })[0]));
  assert.deepEqual(dau.slice(0, 5), ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán']);
  assert.deepEqual(dau.slice(-giansTT.length), giansTT.map((g) => `${g} - Giá cần đạt`));
  // tắt → mất cột
  await p.uncheck('[aria-label="Hiện giá cần đạt (TikTok)"]');
  assert.equal(await p.locator('.th-gia-can-dat').count(), 0);
  assert.deepEqual(loi, []);
  await p.close();
});

test('Lịch sử sửa phí trong app: hiện ai sửa ô nào, cũ → mới; lọc gian / tháng; tự tải lại sau khi lưu; mỗi vai trò chỉ thấy lịch sử sàn mình', { skip: boQua }, async () => {
  const { p, loi } = await moTrang('shopee');
  await p.click('[data-tab="bang-phi"]');
  await p.click('#bang-phi-shopee .vien-gian:has-text("CN2")');
  const o = '[aria-label="Quảng cáo — Lịch"]';
  await p.waitForSelector(o);
  await p.click('#bang-phi-shopee summary:has-text("Lịch sử sửa phí")');
  await p.waitForSelector('#bang-phi-shopee .lich-su-phi :is(table, p.chu-nhat:not(:has-text("Đang tải")))');
  const truoc = await p.locator('#bang-phi-shopee .bang-lich-su tbody tr').count();
  // sửa 1 ô rồi lưu → lịch sử (đang mở) tự tải lại, dòng mới nhất ở đầu
  await p.fill(o, '9,3'); await p.press(o, 'Tab');
  await p.click('#bang-phi-shopee .hang-luu .nut-chinh');
  await p.waitForSelector('#bang-phi-shopee .ghi-chu-xanh');
  await p.waitForFunction((n) => document.querySelectorAll('#bang-phi-shopee .bang-lich-su tbody tr').length > n, truoc);
  // CN2 có thể chưa từng lưu → Lưu ghi cả 5 ngành; tìm dòng của ô vừa sửa (mới nhất trước)
  const dau = await p.$$eval('#bang-phi-shopee .bang-lich-su tbody tr', (ts) => ts.map((t) => [...t.children].map((d) => d.textContent))
    .find((d) => d[5] === 'Lịch' && d[6] === 'Quảng cáo (%)'));
  assert.equal(dau[1], 'nv-shopee', 'ghi tên người sửa');
  assert.equal(dau[4], 'CN2');
  assert.equal(dau[5], 'Lịch');
  assert.equal(dau[6], 'Quảng cáo (%)');
  assert.match(dau[7], /→ 9,3$/);
  assert.match(dau[0], /^\d\d\/\d\d\/\d{4} \d\d:\d\d$/);
  // lọc: bỏ "chỉ gian CN2" → thấy cả gian khác (Tranh Vip có dữ liệu giả)
  const chiGian = await p.locator('#bang-phi-shopee .bang-lich-su tbody tr').count();
  await p.uncheck('#bang-phi-shopee .lich-su-phi label:has-text("Chỉ gian CN2") input');
  assert.ok(await p.locator('#bang-phi-shopee .bang-lich-su tbody tr').count() > chiGian);
  assert.ok(await p.locator('#bang-phi-shopee .bang-lich-su td:has-text("Tranh Vip")').count() > 0);
  // shopee không có tab TikTok nên không có lịch sử TikTok; gọi thẳng API cũng bị từ chối
  assert.equal(await p.locator('#bang-phi-tiktok').count(), 0);
  assert.equal((await goiBangTokenTrang(p, { action: 'docLichSuPhi', nenTang: 'tiktok' })).ma, 'KHONG_CO_QUYEN');
  assert.deepEqual(loi, []);
  await p.close();

  const t = await moTrang('tiktok');
  await t.p.click('[data-tab="bang-phi"]');
  await t.p.waitForSelector('#bang-phi-tiktok [aria-label="Phí sàn — Tranh"]');
  await t.p.click('#bang-phi-tiktok summary:has-text("Lịch sử sửa phí")');
  await t.p.uncheck('#bang-phi-tiktok .lich-su-phi label:has-text("Chỉ gian") input');
  await t.p.waitForSelector('#bang-phi-tiktok .bang-lich-su tbody tr');
  assert.equal(await t.p.locator('#bang-phi-tiktok .bang-lich-su td:has-text("CN2")').count(), 0, 'không lẫn lịch sử Shopee');
  assert.equal((await goiBangTokenTrang(t.p, { action: 'docLichSuPhi', nenTang: 'shopee' })).ma, 'KHONG_CO_QUYEN');
  assert.deepEqual(t.loi, []);
  await t.p.close();
});

test('Tab So sánh 2 sàn (chỉ admin): lãi TikTok vs Shopee đúng theo bảng phí; dùng chung danh sách với Tính lợi nhuận; sắp xếp; xuất Excel', { skip: boQua }, async () => {
  const { soSanhDong } = await import('../js/core/so-sanh.js');
  const { thangHienTai } = await import('../js/core/phi.js');
  const { p, loi } = await moTrang('admin');
  await p.evaluate(() => localStorage.setItem('bggl.loinhuan.v1', JSON.stringify({ ds: [
    { ten: 'Tranh A', phan_loai: '30x40', nganh: 'Tranh', gia_von: 20000, gia_ban: 100000 },
    { ten: 'Tranh B', phan_loai: '60x90', nganh: 'Tranh', gia_von: 60000, gia_ban: 150000 },
    { ten: 'Chưa giá', phan_loai: '', nganh: 'Tranh', gia_von: 1000, gia_ban: null }] })));
  // bản nháp giờ tách theo tài khoản + sàn: dùng cùng danh sách cho cả 2 sàn
  await p.evaluate(() => { const d = localStorage.getItem('bggl.loinhuan.v1'); for (const k of ['tiktok', 'shopee']) localStorage.setItem(`bggl.loinhuan.v2:admin:${k}`, d); });
  await p.reload();
  await p.waitForSelector('.dong-bo-xong');
  assert.ok(await p.locator('[data-tab="so-sanh"]').isVisible(), 'admin thấy tab So sánh 2 sàn');
  await p.click('[data-tab="so-sanh"]');
  await p.waitForSelector('.bang-so-sanh tbody tr');
  await p.selectOption('[aria-label="Gian TikTok"]', 'Nhà Sách');
  await p.selectOption('[aria-label="Gian Shopee"]', 'Tranh Vip');
  await p.selectOption('[aria-label="Kịch bản"]', 'khongqc');
  const du = await docGas();
  const cd = { gianTT: 'Nhà Sách', kichBanTT: 'khongqc', dsPhiTT: du.BANG_PHI, gianSP: 'Tranh Vip', dsPhiSP: du.BANG_PHI_SHOPEE, thang: thangHienTai() };
  const dong = await p.$$eval('.bang-so-sanh tbody tr', (ts) => ts.map((t) => [...t.children].map((c) => c.textContent)));
  const vn = (x) => Math.round(x).toLocaleString('vi-VN');
  [{ gia_von: 20000, gia_ban: 100000 }, { gia_von: 60000, gia_ban: 150000 }].forEach((d, i) => {
    const r = soSanhDong({ nganh: 'Tranh', ...d }, cd);
    assert.ok(dong[i][6].startsWith(vn(r.tiktok.lai)), `TikTok dòng ${i + 1}: ${dong[i][6]}`);
    assert.ok(dong[i][7].startsWith(vn(r.shopee.lai)), `Shopee dòng ${i + 1}: ${dong[i][7]}`);
    assert.equal(dong[i][8], `${r.chenh > 0 ? '+' : ''}${vn(r.chenh)}`);
    assert.equal(dong[i][9], { tiktok: 'TikTok', shopee: 'Shopee', ngang: 'Ngang' }[r.nen]);
  });
  assert.deepEqual(dong[2].slice(6), ['—', '—', '—', '—'], 'thiếu giá bán: không so');
  assert.match(await p.textContent('#tab-so-sanh .luoi-tong-ket'), /2 \/ 3/);
  // sắp xếp theo chênh lệch: giảm dần, dòng chưa so được cuối
  await p.click('.bang-so-sanh .nut-sap-xep');
  const ten = await p.$$eval('.bang-so-sanh tbody tr td:nth-child(2)', (ds) => ds.map((d) => d.textContent));
  assert.equal(ten.at(-1), 'Chưa giá');
  // nhớ lựa chọn
  await p.reload();
  await p.waitForSelector('.dong-bo-xong');
  await p.click('[data-tab="so-sanh"]');
  assert.equal(await p.inputValue('[aria-label="Gian Shopee"]'), 'Tranh Vip');
  assert.equal(await p.inputValue('[aria-label="Kịch bản"]'), 'khongqc');
  // sửa danh sách ở Tính lợi nhuận → quay lại So sánh thấy ngay
  await p.click('[data-tab="loi-nhuan"]');
  await p.click('text=➕ Thêm dòng');
  await p.click('[data-tab="so-sanh"]');
  await p.waitForFunction(() => document.querySelectorAll('.bang-so-sanh tbody tr').length === 4);
  // xuất Excel
  const [tai] = await Promise.all([p.waitForEvent('download'), p.click('#tab-so-sanh button:has-text("Xuất Excel")')]);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GOC, 'vendor/xlsx.full.min.js'), 'utf8'), ctx);
  const wb = ctx.XLSX.read(fs.readFileSync(await tai.path()), { type: 'buffer' });
  const hang = JSON.parse(JSON.stringify(ctx.XLSX.utils.sheet_to_json(wb.Sheets['So sánh 2 sàn'], { header: 1 })));
  assert.deepEqual(hang[0].slice(-2), ['Chênh lệch (Shopee − TikTok)', 'Nên bán']);
  assert.equal(hang.length, 5);
  assert.deepEqual(loi, []);
  await p.close();
  // shopee / tiktok không thấy, không mở được tab này
  for (const vt of ['shopee', 'tiktok']) {
    const q = await moTrang(vt);
    assert.ok(await q.p.locator('[data-tab="so-sanh"]').isHidden(), vt);
    await q.p.goto(`${URL_APP}/?lan=ss#so-sanh`);
    await q.p.waitForSelector('.dong-bo-xong');
    assert.ok(await q.p.locator('#tab-so-sanh').isHidden(), `${vt} không mở được #so-sanh`);
    await q.p.close();
  }
});

// ---------- Bảng tính của từng người (tách theo sàn), tự mở bảng gần nhất, tự lưu ----------

/** Tạo tài khoản GIẢ (bằng token admin) rồi mở trang đăng nhập bằng tài khoản đó, máy sạch. */
async function moTrangTK(ten, vaiTro = 'tiktok') {
  await goiGas({ action: 'themTaiKhoan', token: await tokenAdmin(), ten, matKhau: 'mat-khau-gia', vaiTro });
  const { p, loi } = await moTrang(false);
  await dienDangNhap(p, ten, 'mat-khau-gia');
  await p.waitForSelector('.dong-bo-xong');
  return { p, loi };
}

/** Ghi lại các trạng thái lưu (chữ + thời điểm) để kiểm tra "Sẽ tự lưu… → Đang lưu… → ✓ Đã lưu lúc". */
const ghiTrangThaiLuu = (p) => p.evaluate(() => {
  window.__tt = []; const t0 = performance.now();
  const ghi = () => { const t = document.querySelector('#tab-loi-nhuan .nhan-trang-thai-luu')?.textContent; if (t && t !== window.__tt.at(-1)?.t) window.__tt.push({ t, ms: performance.now() - t0 }); };
  new MutationObserver(ghi).observe(document.body, { subtree: true, childList: true, characterData: true }); ghi();
});

test('2 tài khoản trên 2 trình duyệt: mỗi người bảng riêng theo sàn, không thấy bảng của nhau; tự lưu sau 3 giây; nhận bảng cũ', { skip: boQua }, async () => {
  // Lan (tiktok): chưa có bảng → tự tạo "Bảng của lan – TikTok" trống
  const lan = (await moTrangTK('lan')).p;
  await lan.waitForSelector('.nhan-trang-thai-luu >> text=/✓ Đã lưu lúc \\d\\d:\\d\\d/');
  assert.match(await lan.textContent('.dong-phien'), /👤 lan · TikTok · 📄 Bảng của lan – TikTok/);
  assert.equal(await lan.locator('.bang-ln tbody tr').count(), 0);
  await napFile(lan, taoFile('lan.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], [TEN_KHO, 1000, 5000], ['B', 2000, '']]));
  assert.equal(await lan.textContent('.nut-luu-sheets'), '💾 Lưu lên Sheets');
  await ghiTrangThaiLuu(lan);
  await lan.waitForSelector('.nhan-trang-thai-luu >> text=/✓ Đã lưu lúc/', { timeout: 8000 });
  const tt = await lan.evaluate(() => window.__tt);
  const dang = tt.find((x) => x.t === 'Đang lưu…');
  assert.ok(dang && dang.ms >= 2500, `tự lưu ~3 giây sau lần sửa cuối: ${JSON.stringify(tt)}`);
  assert.equal(await lan.textContent('.nut-luu-sheets'), '✓ Đã lưu');
  assert.equal(await lan.isEnabled('.nut-luu-sheets'), false);

  // Minh (tiktok, trình duyệt khác): bảng riêng, KHÔNG thấy bảng của Lan; thấy "Bảng cũ chưa có chủ" → nhận
  const minh = (await moTrangTK('minh')).p;
  await minh.waitForSelector('.ten-bang >> text=Bảng của minh – TikTok');
  assert.equal(await minh.locator('.bang-ln tbody tr').count(), 0);
  assert.doesNotMatch(await minh.textContent('.chon-bang'), /lan/);
  await minh.click('text=📂 Mở bảng tính');
  await minh.waitForSelector('dialog[open] h2 >> text=Bảng tính của minh · TikTok');
  assert.doesNotMatch(await minh.textContent('dialog[open]'), /Bảng của lan/);
  assert.match(await minh.textContent('dialog[open] .muc-bang-cu'), /Bảng cũ \(thử\)/);
  assert.equal(await minh.locator('dialog[open] button:has-text("Nhận vào Shopee")').count(), 0, 'tài khoản tiktok chỉ nhận vào TikTok');
  await minh.click('dialog[open] >> text=Nhận vào TikTok');
  await minh.click('dialog.hop-thoai-nho button:has-text("Nhận bảng này")');
  await minh.waitForSelector('dialog[open] tr:has-text("Bảng cũ (thử)") >> text=Mở');
  assert.equal(await minh.locator('dialog[open] .muc-bang-cu').count(), 0);
  await minh.click('dialog[open] tr:has-text("Bảng cũ (thử)") >> text=Mở');
  await minh.waitForSelector('.ten-bang >> text=Bảng cũ (thử)');
  assert.equal(await minh.inputValue('[aria-label="Tên dòng 1"]'), 'Tranh thử A');
  // dòng Trà ở gian Tường Vip: gian đã có phí 10/2026 cho ngành khác → ⚠ phí tạm + ghi chú
  const o = minh.locator('.bang-ln tbody tr:nth-child(2) td.co-canh-bao-phi');
  assert.ok(await o.count() >= 1);
  assert.match(await o.first().getAttribute('title'), /Gian .+ chưa có phí ngành Trà tháng \d\d\/2026 – đang dùng tạm phí tháng 08\/2026/);
  assert.match(await minh.textContent('.ghi-chu-phi'), /Gian Tường Vip chưa có phí ngành Trà tháng 10\/2026 – đang dùng tạm phí tháng 08\/2026/);
  assert.match(await minh.textContent('.luoi-tong-ket'), /⚠ 1 dòng dùng phí tạm/);
  await minh.close();

  // Lan: danh sách chỉ có bảng của Lan; bảng cũ đã có chủ → không còn
  await lan.click('text=📂 Mở bảng tính');
  await lan.waitForSelector('dialog[open] h2 >> text=Bảng tính của lan · TikTok');
  const dsLan = await lan.textContent('dialog[open]');
  assert.match(dsLan, /Bảng của lan – TikTok/);
  assert.doesNotMatch(dsLan, /Bảng cũ \(thử\)|minh/);
  await lan.close();
});

test('Chọn nhanh bảng (dropdown); đổi bảng / đổi sàn khi đang sửa → lưu ngay; mở lại → tự mở bảng dùng gần nhất (cả máy khác)', { skip: boQua }, async () => {
  let { p, loi } = await moTrangTK('hoa', 'admin');
  await p.waitForSelector('.ten-bang >> text=Bảng của hoa – TikTok');
  await napFile(p, taoFile('hoa.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], ['Bảng một', 1000, 5000]]));
  // tạo bảng 2 từ dropdown ngay khi đang sửa (chưa đủ 3 giây) → bảng 1 được lưu trước
  await p.selectOption('.chon-bang', '__moi');
  await p.waitForSelector('.ten-bang >> text=Bảng nháp');
  assert.equal(await p.locator('.bang-ln tbody tr').count(), 0);
  // bảng nháp: nhập rồi bấm 💾 mới hỏi tên
  await napFile(p, taoFile('hoa2.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], ['Dòng bảng hai', 1000, 5000]]));
  await p.click('.nut-luu-sheets');
  await p.fill('dialog[open] input', 'Bảng hai');
  await p.click('dialog[open] >> text=Lưu');
  await p.waitForSelector('.ten-bang >> text=Bảng hai');
  await p.waitForSelector('.nhan-trang-thai-luu >> text=/✓ Đã lưu lúc/');
  const tuy = await p.$$eval('.chon-bang option', (o) => o.map((x) => x.textContent));
  assert.ok(tuy.includes('Bảng hai') && tuy.includes('Bảng của hoa – TikTok') && tuy.includes('➕ Bảng mới…'), tuy.join('|'));
  // chọn lại bảng 1 → có dữ liệu đã lưu
  const id1 = await p.$eval('.chon-bang', (s) => [...s.options].find((o) => o.textContent === 'Bảng của hoa – TikTok').value);
  await p.selectOption('.chon-bang', id1);
  await p.waitForSelector('.ten-bang >> text=Bảng của hoa – TikTok');
  assert.equal(await p.inputValue('[aria-label="Tên dòng 1"]'), 'Bảng một');
  // sửa rồi đổi sang Shopee ngay → bảng TikTok lưu ngay; Shopee có bảng riêng
  await p.fill('[aria-label="Tên dòng 1"]', 'Bảng một (sửa)');
  await p.press('[aria-label="Tên dòng 1"]', 'Tab');
  await p.click('[data-nen-tang="shopee"]');
  await p.waitForSelector('.ten-bang >> text=Bảng của hoa – Shopee');
  assert.equal(await p.locator('.bang-ln tbody tr').count(), 0);
  await p.click('[data-nen-tang="tiktok"]');
  await p.waitForSelector('.ten-bang >> text=Bảng của hoa – TikTok');
  await p.reload();
  await p.waitForSelector('.dong-bo-xong');
  await p.waitForSelector('.ten-bang >> text=Bảng của hoa – TikTok');
  assert.equal(await p.inputValue('[aria-label="Tên dòng 1"]'), 'Bảng một (sửa)');
  assert.deepEqual(loi, []);
  await p.close();
  // máy khác (không có nháp) → mở bảng sửa gần nhất trên Sheets
  ({ p } = await moTrang(false));
  await dienDangNhap(p, 'hoa', 'mat-khau-gia');
  await p.waitForSelector('.ten-bang >> text=Bảng của hoa – TikTok');
  await p.waitForSelector('[aria-label="Tên dòng 1"]');
  assert.equal(await p.inputValue('[aria-label="Tên dòng 1"]'), 'Bảng một (sửa)');
  await p.close();
});

test('Bảng nháp: 🧹 Bảng mới không hỏi tên, KHÔNG tự lưu; rời nháp có dữ liệu → hỏi Lưu / Bỏ / Ở lại; 💾 mới hỏi tên', { skip: boQua }, async () => {
  const { p, loi } = await moTrangTK('nhap1', 'admin');
  await p.waitForSelector('.ten-bang >> text=Bảng của nhap1 – TikTok');
  await p.click('text=🧹 Bảng mới');
  await p.waitForSelector('.ten-bang >> text=Bảng nháp');
  assert.equal(await p.locator('dialog[open]').count(), 0, 'không hỏi tên');
  assert.match(await p.textContent('.nhan-trang-thai-luu'), /📝 Nháp – chưa lưu/);
  await napFile(p, taoFile('nhap.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], ['SP nháp', 1000, 5000]]));
  await p.waitForTimeout(4000);
  assert.match(await p.textContent('.nhan-trang-thai-luu'), /📝 Nháp – chưa lưu/, 'nháp không tự lưu');
  const ds = (await goiGas({ action: 'dsBangTinhCuaToi', token: (await goiGas({ action: 'dangNhap', ten: 'nhap1', matKhau: 'mat-khau-gia' })).token, san: 'tiktok' })).duLieu;
  assert.equal(ds.length, 1, 'trên Sheets vẫn chỉ có 1 bảng');
  // tải lại trang → nháp vẫn còn trên máy
  await p.reload();
  await p.waitForSelector('.dong-bo-xong');
  await p.waitForSelector('.ten-bang >> text=Bảng nháp');
  assert.equal(await p.inputValue('[aria-label="Tên dòng 1"]'), 'SP nháp');
  // rời nháp (đổi sàn) → hỏi; "Ở lại" → không đổi
  await p.click('[data-nen-tang="shopee"]');
  await p.waitForSelector('dialog.hop-thoai-nhap >> text=Bảng nháp này chưa lưu');
  await p.click('dialog.hop-thoai-nhap >> text=Ở lại');
  assert.equal(await p.getAttribute('[data-nen-tang="tiktok"]', 'aria-selected'), 'true');
  // mở bảng khác → "💾 Lưu" → hỏi tên → lưu rồi mới mở
  await p.selectOption('.chon-bang', { label: 'Bảng của nhap1 – TikTok' });
  await p.click('dialog.hop-thoai-nhap >> text=💾 Lưu');
  await p.fill('dialog[open] input', 'Nháp đã lưu');
  await p.click('dialog[open] >> text=Lưu');
  await p.waitForSelector('.ten-bang >> text=Nháp đã lưu');
  // Bảng mới (nháp trống) → đổi sàn không hỏi; nháp có dữ liệu → "Bỏ, không lưu"
  await p.click('text=🧹 Bảng mới');
  await p.waitForSelector('.ten-bang >> text=Bảng nháp');
  await p.click('text=➕ Thêm dòng');
  await p.click('text=🧹 Bảng mới');
  await p.click('dialog.hop-thoai-nhap >> text=🗑 Bỏ, không lưu');
  await p.waitForSelector('.vung-tha');
  await p.click('[data-nen-tang="shopee"]');
  await p.waitForSelector('[data-nen-tang="shopee"][aria-selected="true"]');
  assert.equal(await p.locator('dialog.hop-thoai-nhap').count(), 0, 'nháp trống không hỏi');
  assert.deepEqual(loi, []);
  await p.close();
});

test('🗑 Xóa hết dòng: hỏi 1 lần, ↩ Hoàn tác trong 10 giây; bảng đã lưu tự lưu sau khi xóa; "Xóa bảng" trong danh sách', { skip: boQua }, async () => {
  const { p, loi } = await moTrangTK('xoa1', 'tiktok');
  await p.waitForSelector('.ten-bang >> text=Bảng của xoa1 – TikTok');
  await napFile(p, taoFile('xoa.xlsx', [['Tên sản phẩm', 'Giá vốn', 'Giá bán'], ['A', 1000, 5000], ['B', 2000, 6000], ['C', 3000, 7000]]));
  await p.click('.nut-luu-sheets');
  await p.waitForSelector('.chuc-mung >> text=Đã lưu');
  await p.click('text=🗑 Xóa hết dòng');
  await p.click('dialog[open] button:text-is("Xóa hết")');
  await p.waitForSelector('.vung-tha');
  assert.match(await p.textContent('.thong-bao:has(.thong-bao-nut)'), /Đã xóa 3 dòng ·.*↩ Hoàn tác/);
  await p.waitForSelector('.nhan-trang-thai-luu >> text=/✓ Đã lưu lúc/', { timeout: 8000 }); // tự lưu sau khi xóa
  const tk = (await goiGas({ action: 'dangNhap', ten: 'xoa1', matKhau: 'mat-khau-gia' })).token;
  const id = (await goiGas({ action: 'dsBangTinhCuaToi', token: tk, san: 'tiktok' })).duLieu[0].id;
  assert.equal((await goiGas({ action: 'docBangTinhCuaToi', token: tk, san: 'tiktok', id })).duLieu.length, 0);
  // hoàn tác (vẫn trong 10 giây) → 3 dòng quay lại, tự lưu lại
  await p.click('.thong-bao-nut >> text=↩ Hoàn tác');
  await p.waitForSelector('[aria-label="Tên dòng 3"]');
  await p.waitForSelector('.nhan-trang-thai-luu >> text=/✓ Đã lưu lúc/', { timeout: 8000 });
  assert.equal((await goiGas({ action: 'docBangTinhCuaToi', token: tk, san: 'tiktok', id })).duLieu.length, 3);
  // Xóa bảng trong danh sách (hỏi lại trước khi xóa)
  await p.click('text=📂 Mở bảng tính');
  await p.click('dialog[open] button:has-text("Xóa bảng")');
  await p.click('dialog.hop-thoai-nho button:text-is("Xóa")');
  await p.waitForSelector('.thong-bao >> text=/Đã xóa "Bảng của xoa1 – TikTok"/');
  assert.equal((await goiGas({ action: 'dsBangTinhCuaToi', token: tk, san: 'tiktok' })).duLieu.filter((b) => b.id === id).length, 0);
  assert.deepEqual(loi, []);
  await p.close();
});
