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

test('Set giá: chọn nhóm → có giá đề xuất, cảnh báo bậc giá, giá chốt tay, xuất file đúng mẫu nhập', { skip: boQua }, async () => {
  const { p, loi } = await moTrang();
  await p.click('[data-tab="set-gia"]');
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

  await p.click('[data-tab="campaign"]');
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
  await fetch(`${URL_APP}/gas`, { method: 'POST', body: JSON.stringify({ action: 'upsert', matKhau: 'mat-khau-thu', sheet: 'BANG_PHI', banGhi: [{ gian: 'Nhà Sách', nganh: 'Sách', thang: '2026-09', phi_san: 11, phi_vc: 1, phi_xl: 1, phi_qc: 1, aff_qc: 1, aff_noqc: 1 }] }) });
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
