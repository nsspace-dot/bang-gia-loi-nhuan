// Giả lập tối thiểu môi trường Google Apps Script để chạy Code.gs trong Node.
// Dùng cho test và cho máy chủ thử (scripts/may-chu-thu.mjs).
import fs from 'node:fs';
import vm from 'node:vm';

class SheetGiaLap {
  constructor(ten) { this.ten = ten; this.o = []; this.maxRows = 1000; }
  getName() { return this.ten; }
  getLastRow() {
    for (let r = this.o.length - 1; r >= 0; r--) if ((this.o[r] || []).some((v) => v !== '' && v != null)) return r + 1;
    return 0;
  }
  getLastColumn() { return Math.max(0, ...this.o.map((d) => { let c = (d || []).length; while (c > 0 && (d[c - 1] === '' || d[c - 1] == null)) c--; return c; })); }
  getMaxRows() { return Math.max(this.maxRows, this.o.length); }
  getRange(r, c, nr = 1, nc = 1) { return new VungGiaLap(this, r, c, nr, nc); }
  getDataRange() { return new VungGiaLap(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  setFrozenRows() {}
  deleteRow(r) { this.o.splice(r - 1, 1); }
  deleteRows(r, n) { this.o.splice(r - 1, n); }
}

class VungGiaLap {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() {
    const kq = [];
    for (let i = 0; i < this.nr; i++) {
      const d = this.sh.o[this.r - 1 + i] || [];
      const dong = [];
      for (let j = 0; j < this.nc; j++) { const v = d[this.c - 1 + j]; dong.push(v === undefined || v === null ? '' : v); }
      kq.push(dong);
    }
    return kq;
  }
  setValues(v) {
    if (v.length !== this.nr || v.some((d) => d.length !== this.nc)) throw new Error(`Kích thước không khớp: ${v.length}x${v[0]?.length} vs ${this.nr}x${this.nc}`);
    for (let i = 0; i < this.nr; i++) {
      const ri = this.r - 1 + i;
      while (this.sh.o.length <= ri) this.sh.o.push([]);
      for (let j = 0; j < this.nc; j++) this.sh.o[ri][this.c - 1 + j] = v[i][j];
    }
    return this;
  }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
}

export function taoMoiTruong({ matKhau = 'mat-khau-thu' } = {}) {
  const sheets = new Map();
  const cache = new Map();
  const thuocTinh = new Map(matKhau ? [['MAT_KHAU', matKhau]] : []);
  let dangKhoa = false;
  const ctx = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (t) => sheets.get(t) || null,
        insertSheet: (t) => { const s = new SheetGiaLap(t); sheets.set(t, s); return s; },
      }),
      flush() {},
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => thuocTinh.get(k) ?? null }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (dangKhoa) return false; dangKhoa = true; return true; },
        releaseLock: () => { dangKhoa = false; },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ noiDung: s, setMimeType() { return this; }, getContent() { return s; } }),
    },
    Utilities: { formatDate: (d) => d.toISOString() },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx);

  return {
    sheets,
    thuocTinh,
    get: (thamSo) => JSON.parse(ctx.doGet({ parameter: thamSo }).getContent()),
    post: (body) => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent()),
    duLieuSheet: (t) => (sheets.get(t)?.o || []).map((d) => [...d]),
  };
}
