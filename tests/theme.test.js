// Test theme giao diện: bộ biến màu đủ, độ tương phản đủ, chọn / lưu / khôi phục theme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const docTep = (t) => fs.readFileSync(path.join(GOC, t), 'utf8');

/** { tenTheme: { bien: giaTri } } — Kẹo hồng = :root; theme khác = :root đè bằng khối của nó. */
function docTheme() {
  const bien = (khoi) => Object.fromEntries([...khoi.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const goc = bien(docTep('css/app.css').match(/:root, \[data-theme="keo-hong"\] \{([\s\S]*?)\n\}/)[1]);
  const kq = { 'keo-hong': goc };
  // mỗi theme có thể có nhiều khối (màu, hình khối) → gộp lại
  for (const m of docTep('css/theme.css').matchAll(/\[data-theme="([\w-]+)"\] \{([\s\S]*?)\n\}/g)) {
    const rieng = { ...(kq[m[1]]?._rieng || {}), ...bien(m[2]) };
    kq[m[1]] = { ...goc, ...rieng, _rieng: rieng };
  }
  return kq;
}

const doSang = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
};
/** Tỉ lệ tương phản WCAG 2.x */
export const tuongPhan = (a, b) => { const [x, y] = [doSang(a), doSang(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const THEME = docTheme();

// [chữ, nền, tối thiểu] — 4.5 = chữ thường (WCAG AA), 3 = chữ phụ / chữ đậm cỡ nút
const CAP = [
  ['chu', 'nen', 4.5], ['chu', 'the', 4.5], ['chu', 'nen-2', 4.5], ['chu', 'o-nhap-nen', 4.5], ['chu', 'o-so-nen', 4.5],
  ['chu', 'bang-hover', 4.5], ['chu', 'lo-nen-nhat', 4.5], ['chu', 'vang-nen', 4.5], ['chu', 'dau-trang-nen', 4.5],
  ['chu-phu', 'the', 4.5], ['chu-phu', 'nen-2', 4.5], ['chu-phu', 'bang-dau-nen', 4.5], ['chu-phu', 'khoa-nen', 4.5],
  ['chu-phu', 'dau-trang-nen', 4.5], ['chu-nhat', 'the', 3], ['chu-nhat', 'nen', 3],
  ['lai', 'the', 4.5], ['lai', 'lai-nen', 4.5], ['lai', 'bang-hover', 4.5],
  ['lo', 'the', 4.5], ['lo', 'lo-nen', 4.5], ['lo', 'lo-nen-nhat', 4.5],
  ['lai-chu-dam', 'lai-nen', 4.5], ['lo-chu-dam', 'lo-nen', 4.5], ['vang-chu-dam', 'vang-nen', 4.5],
  ['vang', 'vang-nen', 4.5], ['vang', 'the', 4.5], ['tim', 'tim-nen', 4.5], ['tim', 'the', 4.5],
  ['chinh-dam', 'chinh-nhat', 3], ['chinh-dam', 'the', 3],
  ['chu-tren-chinh', 'chinh', 4.5], ['chu-tren-chinh', 'chinh-dam', 4.5], ['chu-tren-lo', 'lo', 4.5], ['chu-tren-lo', 'lo-dam', 4.5],
  ...['bac-ha', 'oai-huong', 'dao', 'bo', 'troi', 'chanh', 'hong', 'xam'].map((g) => [`${g}-chu`, g, 4.5]),
];
// Kẹo hồng giữ ĐÚNG như trước theo yêu cầu. 3 cặp vốn đã thấp từ trước — ngoại lệ đã biết, không đổi màu:
// chữ trắng trên nút hồng (2,99), chữ trắng trên nút hồng khi rê chuột (4,13), chữ nhạt trên nền kem (2,92).
const NGOAI_LE = { 'keo-hong': { 'chu-tren-chinh/chinh': 2.95, 'chu-tren-chinh/chinh-dam': 4.1, 'chu-nhat/nen': 2.9 } };

test('có đủ 8 theme, khớp danh sách trong js/ui/theme.js và đoạn áp sớm trong index.html', async () => {
  const { DS_THEME, THEME_MAC_DINH } = await import('../js/ui/theme.js');
  const ids = DS_THEME.map((t) => t.id);
  assert.deepEqual(ids, ['keo-hong', 'toi-gian', 'toi', 'cam-shopee', 'den-cyan', 'xanh-bien', 'mint', 'giay']);
  assert.equal(THEME_MAC_DINH, 'keo-hong');
  assert.deepEqual(Object.keys(THEME).sort(), [...ids].sort());
  assert.deepEqual(DS_THEME.map((t) => t.ten), ['Kẹo hồng', 'Sáng tối giản', 'Tối', 'Cam Shopee', 'Đen Cyan TikTok', 'Xanh biển', 'Mint pastel', 'Giấy cổ điển']);
  const som = docTep('index.html').match(/var DS = \[([^\]]+)\]/)[1].match(/'([\w-]+)'/g).map((x) => x.slice(1, -1));
  assert.deepEqual(som, ids, 'đoạn áp theme sớm trong <head> phải cùng danh sách');
});

test('mỗi theme đặt lại ĐỦ mọi biến màu của Kẹo hồng (không sót biến nào dùng màu hồng mặc định)', () => {
  // biến màu = giá trị Kẹo hồng là mã màu / rgba / bóng đổ (bỏ qua biến hình khối, font)
  const mau = Object.keys(THEME['keo-hong']).filter((k) => /^(#|rgba|transparent)/.test(THEME['keo-hong'][k]) || /^(bong|man-mo)/.test(k));
  for (const [ten, t] of Object.entries(THEME)) {
    if (ten === 'keo-hong') continue;
    const thieu = mau.filter((k) => !(k in t._rieng));
    assert.deepEqual(thieu, [], `${ten} thiếu biến`);
  }
});

test('độ tương phản đủ ở cả 8 theme (WCAG): chữ, ô nhập, ô khóa, lãi / lỗ, thông báo, nút, chip gian', () => {
  const loi = [];
  for (const [ten, t] of Object.entries(THEME)) {
    for (const [a, b, toiThieu] of CAP) {
      const can = NGOAI_LE[ten]?.[`${a}/${b}`] ?? toiThieu;
      assert.match(t[a], /^#[0-9a-f]{6}$/i, `${ten} --${a}`);
      assert.match(t[b], /^#[0-9a-f]{6}$/i, `${ten} --${b}`);
      const tp = tuongPhan(t[a], t[b]);
      if (tp < can) loi.push(`${ten}: --${a} trên --${b} = ${tp.toFixed(2)} < ${can}`);
    }
  }
  assert.deepEqual(loi, []);
});

test('lãi (xanh) và lỗ (đỏ) phân biệt được ở mọi theme', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const [ten, t] of Object.entries(THEME)) {
    const [lr, lg] = rgb(t.lai), [or, og] = rgb(t.lo);
    assert.ok(lg > lr, `${ten}: lãi phải ngả xanh lá`);
    assert.ok(or > og, `${ten}: lỗ phải ngả đỏ`);
    assert.notEqual(t.lai, t.lo);
    // lỗ khác màu nút chính (không lẫn ô lỗ với điểm nhấn)
    assert.notEqual(t.lo.toLowerCase(), t.chinh.toLowerCase(), ten);
  }
});

test('hiệu năng: không ảnh nền, không blur, không animation lặp mới, không thêm font', () => {
  const boChuThich = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  const css = boChuThich(docTep('css/app.css') + docTep('css/theme.css'));
  assert.doesNotMatch(css, /backdrop-filter|url\(/);
  assert.doesNotMatch(boChuThich(docTep('css/theme.css')), /animation|@keyframes|@font-face|font-family/);
  // Không tải font mới: chỉ được dùng font CÓ SẴN của hệ điều hành (không url, không @font-face)
  for (const m of boChuThich(docTep('css/theme.css')).matchAll(/--font[\w-]*:\s*([^;]+);/g)) {
    assert.match(m[1], /^(Georgia|'Noto Serif'|'Times New Roman'|serif|,|\s)+$/, m[1]);
  }
  assert.equal(fs.readdirSync(path.join(GOC, 'fonts')).filter((f) => f.endsWith('.woff2')).length, 12, 'không thêm file font');
  const lap = [...css.matchAll(/animation:[^;]*infinite/g)].map((m) => m[0]);
  assert.deepEqual(lap, ['animation: nhap-nhay 1s infinite', 'animation: nghieng-dau 4s ease-in-out infinite'], 'chỉ 2 animation lặp có sẵn từ trước');
});

test('ô màu xem trước trong menu khớp màu thật của theme (nền, nút chính, chữ / điểm nhấn)', async () => {
  const { DS_THEME } = await import('../js/ui/theme.js');
  for (const t of DS_THEME) {
    const v = THEME[t.id];
    assert.equal(t.mau[0], v.nen, t.id);
    assert.equal(t.mau[1], v.chinh, t.id);
    assert.ok([v.chu, v.tim].includes(t.mau[2]), t.id);
  }
});

test('áp theme sớm: đoạn script trong <head> chạy TRƯỚC khi nạp CSS (không nháy màu cũ)', () => {
  const html = docTep('index.html');
  const viTriScript = html.indexOf("localStorage.getItem('bggl.theme.v1')");
  assert.ok(viTriScript > 0 && viTriScript < html.indexOf('css/app.css') && viTriScript < html.indexOf('css/theme.css'));
  assert.ok(html.indexOf('css/theme.css') > html.indexOf('css/app.css'), 'theme.css nạp sau app.css để đè biến');
});

// ---------- logic chọn / lưu / khôi phục (Node, document + localStorage giả) ----------

function moiTruongGia(giaTriLuu) {
  const nho = new Map(giaTriLuu === undefined ? [] : [['bggl.theme.v1', giaTriLuu]]);
  globalThis.localStorage = { getItem: (k) => (nho.has(k) ? nho.get(k) : null), setItem: (k, v) => nho.set(k, String(v)), removeItem: (k) => nho.delete(k) };
  const thuocTinh = new Map();
  globalThis.document = { documentElement: { setAttribute: (k, v) => thuocTinh.set(k, v), getAttribute: (k) => thuocTinh.get(k) ?? null } };
  return { nho, theme: () => thuocTinh.get('data-theme') };
}

test('chọn theme: áp ngay lên <html data-theme> và lưu vào khóa riêng bggl.theme.v1', async () => {
  const mt = moiTruongGia();
  const { chonTheme, layTheme, KHOA_THEME } = await import('../js/ui/theme.js');
  assert.equal(KHOA_THEME, 'bggl.theme.v1');
  assert.equal(layTheme(), 'keo-hong', 'chưa chọn → mặc định');
  assert.equal(chonTheme('den-cyan'), 'den-cyan');
  assert.equal(mt.theme(), 'den-cyan');
  assert.equal(mt.nho.get('bggl.theme.v1'), 'den-cyan');
  assert.equal(layTheme(), 'den-cyan');
});

test('giá trị lưu không hợp lệ → quay về mặc định Kẹo hồng', async () => {
  const { layTheme, apDungTheme, chonTheme } = await import('../js/ui/theme.js');
  for (const xau of ['', 'hong-hong', '<script>', 'KEO-HONG', '{"id":"toi"}']) {
    const mt = moiTruongGia(xau);
    assert.equal(layTheme(), 'keo-hong', xau);
    assert.equal(apDungTheme(layTheme()), 'keo-hong');
    assert.equal(mt.theme(), 'keo-hong');
  }
  const mt = moiTruongGia();
  assert.equal(chonTheme('khong-co'), 'keo-hong');
  assert.equal(mt.nho.get('bggl.theme.v1'), 'keo-hong');
  // localStorage bị chặn (chế độ riêng tư) → vẫn chạy, dùng mặc định
  globalThis.localStorage = { getItem: () => { throw new Error('chặn'); }, setItem: () => { throw new Error('chặn'); } };
  assert.equal(layTheme(), 'keo-hong');
  assert.equal(chonTheme('toi'), 'toi');
});

test('đăng xuất / xóa dữ liệu tạm KHÔNG xóa theme (khóa riêng, không lẫn dữ liệu phí)', () => {
  const kho = docTep('js/data/kho.js');
  assert.ok(!kho.includes('bggl.theme'), 'kho dữ liệu không đụng tới khóa theme');
  assert.doesNotMatch(kho, /localStorage\.clear\(\)/);
});

test('mỗi theme có "tính cách" riêng: bộ hình khối (bo góc, viền, nút, khoảng cách, tiêu đề) khác nhau', () => {
  const HINH = ['bo-goc', 'bo-goc-nut', 'vien-day', 'kieu-ke', 'nut-noi', 'khoang-the', 'tieu-de-dam', 'tieu-de-hoa', 'font'];
  const bo = Object.entries(THEME).map(([ten, t]) => [ten, HINH.map((k) => t[k]).join('|')]);
  assert.equal(new Set(bo.map(([, v]) => v)).size, 8, `phải khác nhau: ${JSON.stringify(bo)}`);
  // Kẹo hồng giữ nguyên hình khối cũ
  const k = THEME['keo-hong'];
  assert.deepEqual([k['bo-goc'], k['bo-goc-nho'], k['bo-goc-nut'], k['vien-day'], k['kieu-ke'], k['nut-noi'], k['khoang-the']],
    ['18px', '12px', '999px', '2px', 'dashed', '2px', '20px 22px']);
});

test('tab đang chọn kiểu gạch chân / khối đặc vẫn đủ tương phản', () => {
  // Tối: chữ --chinh trên nền đầu trang; Cam Shopee / Xanh biển: chữ trắng trên khối --chinh; Sáng tối giản: --chu
  assert.ok(tuongPhan(THEME.toi.chinh, THEME.toi['dau-trang-nen']) >= 4.5);
  assert.ok(tuongPhan(THEME.toi.chinh, THEME.toi.the) >= 4.5);
  for (const t of ['cam-shopee', 'xanh-bien']) assert.ok(tuongPhan(THEME[t]['chu-tren-chinh'], THEME[t].chinh) >= 4.5, t);
  assert.ok(tuongPhan(THEME['den-cyan'].chu, THEME['den-cyan'].the) >= 4.5);
});
