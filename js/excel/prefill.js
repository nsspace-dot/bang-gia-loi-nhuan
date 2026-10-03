// Ghi FILE ĐĂNG KÝ campaign bằng cách sửa trực tiếp XML của file prefill gốc (JSZip),
// để giữ NGUYÊN dòng ghi chú, ô gộp, tiêu đề, thứ tự cột, độ rộng cột, định dạng.
// Chỉ: điền Campaign price (SỐ, bỏ công thức), điền Campaign stock, xóa các dòng không vào được.

function thuVien() {
  const Z = globalThis.JSZip;
  if (!Z) throw new Error('Chưa tải được thư viện JSZip (vendor/jszip.min.js).');
  return Z;
}

/** "A" → 0, "AB" → 27 */
export function chiSoCot(chu) {
  let n = 0;
  for (const c of chu) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}
export function chuCot(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

async function timSheet(zip, tenSheet) {
  const wb = await zip.file('xl/workbook.xml').async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const cacSheet = [...wb.matchAll(/<sheet\b[^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"[^>]*\/>/g)].map((m) => ({ ten: m[1], rid: m[2] }));
  const s = cacSheet.find((x) => x.ten === tenSheet) || cacSheet[0];
  const rel = [...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${s.rid}"`));
  const target = rel.match(/Target="([^"]*)"/)[1];
  return { duongDan: target.startsWith('/') ? target.slice(1) : `xl/${target}`, ten: s.ten };
}

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Đặt giá trị số cho ô `cot` trong XML 1 dòng (đã đánh số lại). Giữ style s="…", bỏ công thức. */
function datOSo(dongXml, cot, soDong, giaTri) {
  const ref = `${cot}${soDong}`;
  const mau = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = dongXml.match(mau);
  const style = m ? (m[1].match(/\ss="\d+"/) || [''])[0] : '';
  const oMoi = `<c r="${ref}"${style}><v>${giaTri}</v></c>`;
  if (m) return dongXml.replace(mau, oMoi);
  // chưa có ô → chèn đúng thứ tự cột
  const iCot = chiSoCot(cot);
  const cacO = [...dongXml.matchAll(/<c r="([A-Z]+)\d+"/g)];
  const sau = cacO.find((o) => chiSoCot(o[1]) > iCot);
  if (sau) return dongXml.slice(0, sau.index) + oMoi + dongXml.slice(sau.index);
  return dongXml.replace(/<\/row>$/, `${oMoi}</row>`).replace(/<row([^>]*)\/>$/, `<row$1>${oMoi}</row>`);
}

/**
 * @param {ArrayBuffer|Uint8Array} duLieu file prefill gốc
 * @param {object} p
 *   giuDong: Map<soDongGoc (1-based), { gia:number, soLuong:number }> — chỉ giữ các dòng này
 *   soDongTieuDe: số dòng đầu giữ nguyên (ghi chú + tiêu đề), vd 2
 *   cotGia, cotSoLuong: chỉ số cột (0-based) của Campaign price / Campaign stock
 * @returns {Promise<Uint8Array>}
 */
export async function taoFileDangKy(duLieu, { giuDong, soDongTieuDe, cotGia, cotSoLuong, tenSheet = 'Sheet1' }) {
  const JSZip = thuVien();
  const zip = await JSZip.loadAsync(duLieu);
  const { duongDan, ten } = await timSheet(zip, tenSheet);
  let xml = await zip.file(duongDan).async('string');
  const chuGia = chuCot(cotGia), chuSL = chuCot(cotSoLuong);

  const iDau = xml.indexOf('<sheetData');
  const iCuoi = xml.indexOf('</sheetData>');
  if (iDau < 0 || iCuoi < 0) throw new Error('File prefill không đúng cấu trúc (thiếu sheetData).');
  const moDau = xml.indexOf('>', iDau) + 1;
  const thanCu = xml.slice(moDau, iCuoi);

  let soMoi = soDongTieuDe;
  let cotCuoi = 0;
  const thanMoi = [];
  for (const m of thanCu.matchAll(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)) {
    let dongXml = m[0];
    const r = +dongXml.match(/<row\b[^>]*?\sr="(\d+)"/)[1];
    for (const o of dongXml.matchAll(/<c r="([A-Z]+)\d+"/g)) cotCuoi = Math.max(cotCuoi, chiSoCot(o[1]));
    if (r <= soDongTieuDe) { thanMoi.push(dongXml); continue; }
    const giu = giuDong.get(r);
    if (!giu) continue;
    soMoi++;
    dongXml = dongXml
      .replace(/^<row\b[^>]*?>/, (the) => the.replace(/\sr="\d+"/, ` r="${soMoi}"`).replace(/\sspans="[^"]*"/, ''))
      .replace(/<c r="([A-Z]+)\d+"/g, `<c r="$1${soMoi}"`);
    dongXml = datOSo(dongXml, chuGia, soMoi, Math.round(giu.gia));
    dongXml = datOSo(dongXml, chuSL, soMoi, Math.round(giu.soLuong));
    thanMoi.push(dongXml);
  }
  const dongCuoi = soMoi;
  const vung = `A1:${chuCot(cotCuoi)}${dongCuoi}`;
  xml = xml.slice(0, moDau) + thanMoi.join('') + xml.slice(iCuoi);

  // Kích thước, bộ lọc, ô gộp
  xml = xml.replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="${vung}"/>`);
  xml = xml.replace(/<sortState\b[\s\S]*?<\/sortState>|<sortState\b[^>]*\/>/g, '');
  xml = xml.replace(/<autoFilter ref="([A-Z]+)(\d+):([A-Z]+)\d+"/, (_, c1, r1, c2) => `<autoFilter ref="${c1}${r1}:${c2}${Math.max(dongCuoi, +r1)}"`);
  xml = xml.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/, (_, ben) => {
    const giu = [...ben.matchAll(/<mergeCell ref="[A-Z]+(\d+):[A-Z]+(\d+)"\s*\/>/g)].filter((m) => +m[2] <= soDongTieuDe).map((m) => m[0]);
    return giu.length ? `<mergeCells count="${giu.length}">${giu.join('')}</mergeCells>` : '';
  });
  // con trỏ đang chọn có thể trỏ vào dòng đã xóa → về A1
  xml = xml.replace(/<selection\b[^>]*\/>/g, '<selection activeCell="A1" sqref="A1"/>');
  zip.file(duongDan, xml);

  // Vùng lọc đã đặt tên trong workbook.xml
  let wb = await zip.file('xl/workbook.xml').async('string');
  wb = wb.replace(/(<definedName\b[^>]*name="_xlnm\._FilterDatabase"[^>]*>)([^<]*)(<\/definedName>)/g, (all, a, ref, c) => {
    const m = ref.match(/^(.*!\$[A-Z]+\$\d+:\$[A-Z]+\$)(\d+)$/);
    return m ? `${a}${m[1]}${Math.max(dongCuoi, soDongTieuDe)}${c}` : all;
  });
  zip.file('xl/workbook.xml', wb);

  // Bỏ calcChain (công thức đã bị thay bằng số)
  if (zip.file('xl/calcChain.xml')) {
    zip.remove('xl/calcChain.xml');
    const ct = await zip.file('[Content_Types].xml').async('string');
    zip.file('[Content_Types].xml', ct.replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''));
    const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    zip.file('xl/_rels/workbook.xml.rels', rels.replace(/<Relationship\b[^>]*Target="calcChain\.xml"[^>]*\/>/, ''));
  }
  return { duLieu: await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }), soDong: dongCuoi - soDongTieuDe, tenSheet: escapeXml(ten) };
}
