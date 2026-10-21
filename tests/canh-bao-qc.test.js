// Cảnh báo thiếu "Chi phí QC". Dữ liệu GIẢ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thieuPhiQC } from '../js/core/phi.js';

test('thiếu phí QC khi = 0, trống, hoặc chưa có bộ phí', () => {
  assert.equal(thieuPhiQC({ phi_qc: 0 }), true);
  assert.equal(thieuPhiQC({ phi_qc: null }), true);
  assert.equal(thieuPhiQC({}), true);
  assert.equal(thieuPhiQC(null), true);
  assert.equal(thieuPhiQC({ phi_qc: 7.5 }), false);
  assert.equal(thieuPhiQC({ phi_qc: '6' }), false);
});
