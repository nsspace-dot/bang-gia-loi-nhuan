// Máy chủ thử trên máy: phục vụ app + giả lập Apps Script tại /gas (chạy Code.gs thật trên Sheets giả).
//   node scripts/may-chu-thu.mjs [cổng] [--du-lieu-gia]
// --du-lieu-gia: nạp sẵn bảng phí & giá vốn GIẢ để xem giao diện. Mật khẩu giả lập: mat-khau-thu
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { taoMoiTruong } from '../tests/gia-lap-gas.js';

const goc = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cong = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8080);
const gas = taoMoiTruong({ matKhau: 'mat-khau-thu' });

if (process.argv.includes('--du-lieu-gia')) {
  const MK = 'mat-khau-thu';
  const gians = ['Nhà Sách', 'Sách Hay', 'Tranh Lịch', 'Tường Vip'];
  const nganhs = ['Sách', 'Tranh', 'Lịch', 'Decal', 'Trà'];
  const phi = [];
  gians.forEach((g, i) => nganhs.forEach((n, j) => {
    phi.push({ gian: g, nganh: n, thang: '2026-08', phi_san: 18 + i + j * 0.5, phi_vc: 2000 + i * 300, phi_xl: 3000, phi_qc: 7.5 + i * 0.5, aff_qc: 4, aff_noqc: 9 + j });
  }));
  phi.push({ gian: 'Tường Vip', nganh: 'Tranh', thang: '2026-10', phi_san: 23.5, phi_vc: 2300, phi_xl: 3000, phi_qc: 9, aff_qc: 4, aff_noqc: 10 });
  phi.push({ gian: 'Tường Vip', nganh: 'Decal', thang: '2026-10', phi_san: 22.5, phi_vc: 2300, phi_xl: 3000, phi_qc: 9, aff_qc: 4, aff_noqc: 12 });
  gas.post({ action: 'upsert', matKhau: MK, sheet: 'BANG_PHI', banGhi: phi });
  const von = [];
  [['Bộ 1 tấm', 'Tranh', ['13x18', '20x30', '30x40', '40x60', '50x70', '60x90'], 6000],
    ['Bộ 3 tấm đồng size', 'Tranh', ['20x30x3', '30x40x3', '40x60x3'], 30000],
    ['Nẹp gỗ khổ dọc', 'Tranh', ['30x40', '40x60', '50x100'], 18000],
    ['Nẹp nhựa khổ ngang', 'Tranh', ['40x30', '60x40', '80x40'], 9000],
    ['Decal PP', 'Decal', ['50x70', '60x90', '60x120', '60x150'], 15000]].forEach(([nhom, nganh, sizes, co]) => {
    sizes.forEach((s, i) => von.push({ nhom, phan_loai: s, nganh, gia_von: co + i * Math.round(co * 0.6) + 11 }));
  });
  von.find((v) => v.phan_loai === '60x90').gia_von = 19011; // cố ý tạo 1 cảnh báo bậc vốn
  gas.post({ action: 'upsert', matKhau: MK, sheet: 'GIA_VON', banGhi: von });
}

const KIEU = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${cong}`);
  if (u.pathname === '/gas') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const kq = req.method === 'POST' ? gas.post(body) : gas.get(Object.fromEntries(u.searchParams));
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(kq));
      }, 250);
    });
    return;
  }
  const tep = path.join(goc, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!tep.startsWith(goc) || tep.includes(`${path.sep}mau${path.sep}`) || !fs.existsSync(tep) || fs.statSync(tep).isDirectory()) {
    res.writeHead(404); res.end('Không tìm thấy'); return;
  }
  res.writeHead(200, { 'Content-Type': KIEU[path.extname(tep)] || 'application/octet-stream' });
  fs.createReadStream(tep).pipe(res);
}).listen(cong, () => console.log(`Mở http://localhost:${cong}  (Apps Script giả lập: http://localhost:${cong}/gas, mật khẩu: mat-khau-thu)`));
