// Test với số liệu THẬT đọc từ mau/kiem-tra-that.json (thư mục mau/ không commit).
// Máy không có file này thì test tự bỏ qua.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tinhLai } from '../js/core/cong-thuc.js';

const duongDan = new URL('../mau/kiem-tra-that.json', import.meta.url);
const co = fs.existsSync(duongDan);
const du = co ? JSON.parse(fs.readFileSync(duongDan, 'utf8')) : { congThuc: [] };

test('công thức với số liệu thật (mau/)', { skip: !co && 'không có mau/kiem-tra-that.json' }, () => {
  for (const c of du.congThuc) {
    const r = tinhLai(c.von, c.gia, c.phi);
    assert.ok(Math.abs(r.laiQC - c.laiQC) < 0.01, `${c.ten}: lãi QC ${r.laiQC} ≠ ${c.laiQC}`);
    assert.ok(Math.abs(r.laiKhongQC - c.laiKhongQC) < 0.01, `${c.ten}: lãi không QC ${r.laiKhongQC} ≠ ${c.laiKhongQC}`);
  }
});
