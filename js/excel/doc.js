// Đọc Excel trong trình duyệt (cũng chạy được trong Node để test).
// Dùng SheetJS (vendor/xlsx.full.min.js) — biến toàn cục XLSX.

function thuVien() {
  const X = globalThis.XLSX;
  if (!X) throw new Error('Chưa tải được thư viện đọc Excel (vendor/xlsx.full.min.js).');
  return X;
}

/** Đọc file thành workbook. Tự sửa vùng dữ liệu bị ghi sai (file TikTok ghi A1:AL5 dù có hàng nghìn dòng). */
export function docWorkbook(duLieu) {
  const X = thuVien();
  const wb = X.read(duLieu, { type: duLieu instanceof ArrayBuffer ? 'array' : 'buffer', dense: true, cellDates: false });
  for (const ten of wb.SheetNames) suaVung(wb.Sheets[ten]);
  return wb;
}

export function suaVung(ws) {
  const data = ws['!data'];
  if (!Array.isArray(data)) return;
  let soDong = 0, soCot = 0;
  data.forEach((dong, r) => {
    if (!dong) return;
    for (let c = dong.length - 1; c >= 0; c--) {
      if (dong[c] && dong[c].v !== undefined && dong[c].v !== null && dong[c].v !== '') {
        soDong = Math.max(soDong, r + 1);
        soCot = Math.max(soCot, c + 1);
        break;
      }
    }
  });
  if (soDong && soCot) ws['!ref'] = thuVien().utils.encode_range({ s: { r: 0, c: 0 }, e: { r: soDong - 1, c: soCot - 1 } });
}

/** Sheet → mảng các dòng (mỗi dòng là mảng giá trị ô). */
export function sheetThanhMang(ws) {
  return thuVien().utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true });
}

/** Sheet đầu tiên (hoặc theo tên) → mảng dòng. */
export function docBang(duLieu, tenSheet) {
  const wb = docWorkbook(duLieu);
  const ten = tenSheet && wb.SheetNames.includes(tenSheet) ? tenSheet : wb.SheetNames[0];
  return { tenSheet: ten, dong: sheetThanhMang(wb.Sheets[ten]), wb };
}

/**
 * File sản phẩm TikTok "all_information" (sheet Template):
 * dòng 1 = khóa cột (product_id, sku_id, ...), dòng 3 = tên tiếng Việt, dữ liệu từ dòng 6.
 * @returns {Array<object>} mỗi phần tử là 1 SKU, khóa theo dòng 1.
 */
export function docFileSanPham(duLieu) {
  const wb = docWorkbook(duLieu);
  const ten = wb.SheetNames.find((t) => t.toLowerCase() === 'template');
  if (!ten) throw new Error('Không thấy sheet "Template" — có phải file sản phẩm TikTok (all_information) không?');
  const dong = sheetThanhMang(wb.Sheets[ten]);
  const khoa = (dong[0] || []).map((k) => String(k).trim());
  if (!khoa.includes('sku_id')) throw new Error('Dòng 1 của sheet Template không có cột "sku_id".');
  const kq = [];
  for (let i = 5; i < dong.length; i++) {
    const d = dong[i];
    const o = {};
    khoa.forEach((k, c) => { if (k) o[k] = d[c] === undefined || d[c] === null ? '' : String(d[c]); });
    if (o.sku_id) kq.push(o);
  }
  return kq;
}
