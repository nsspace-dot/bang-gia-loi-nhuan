// Giá vốn: đọc file, so sánh với dữ liệu đã lưu, cảnh báo.
// Bản ghi: { nhom, phan_loai, nganh, gia_von, gia_ban }

import { docSo } from './so.js';
import { chuanHoa, boDau } from './van-ban.js';
import { docPhanLoai, lonHon } from './size.js';

export function khoaVon(nhom, phanLoai) {
  return `${chuanHoa(nhom)}|${boDau(phanLoai).replace(/\s+/g, '').replace(/[×*]/g, 'x')}`;
}

const COT = {
  nhom: ['ten san pham', 'nhom'],
  phan_loai: ['phan loai', 'size'],
  nganh: ['nganh hang', 'nganh'],
  gia_von: ['gia von', 'von'],
  gia_ban: ['gia ban'],
};

/**
 * Đọc bảng (mảng các dòng, mỗi dòng là mảng ô) theo tên cột.
 * @returns {{banGhi:Array, loi:Array<{dong:number, noiDung:string}>}}
 */
export function docBangGiaVon(dong) {
  const loi = [];
  const iTieuDe = dong.findIndex((d) => {
    const t = (d || []).map(boDau);
    return t.some((x) => x.includes('gia von')) && t.some((x) => x.includes('ten san pham') || x === 'nhom');
  });
  if (iTieuDe < 0) {
    return { banGhi: [], loi: [{ dong: 0, noiDung: 'Không tìm thấy dòng tiêu đề (cần có cột "Tên sản phẩm" và "Giá vốn").' }] };
  }
  const tieuDe = dong[iTieuDe].map(boDau);
  const viTri = {};
  for (const [k, ten] of Object.entries(COT)) {
    // ưu tiên khớp chính xác, sau đó khớp "bắt đầu bằng"
    let i = tieuDe.findIndex((t) => ten.includes(t));
    if (i < 0) i = tieuDe.findIndex((t) => ten.some((x) => t.startsWith(x)));
    viTri[k] = i;
  }
  for (const k of ['nhom', 'phan_loai', 'gia_von']) {
    if (viTri[k] < 0) loi.push({ dong: iTieuDe + 1, noiDung: `Thiếu cột "${k === 'nhom' ? 'Tên sản phẩm' : k === 'phan_loai' ? 'Phân loại' : 'Giá vốn'}".` });
  }
  if (loi.length) return { banGhi: [], loi };

  const banGhi = [];
  for (let i = iTieuDe + 1; i < dong.length; i++) {
    const d = dong[i] || [];
    const lay = (k) => (viTri[k] >= 0 ? d[viTri[k]] : '');
    const nhom = String(lay('nhom') ?? '').trim();
    const phanLoai = String(lay('phan_loai') ?? '').trim();
    if (!nhom && !phanLoai) continue;
    const thoVon = lay('gia_von');
    const giaVon = docSo(thoVon);
    const soDong = i + 1;
    if (!nhom) loi.push({ dong: soDong, noiDung: 'Thiếu tên sản phẩm (nhóm).' });
    if (giaVon === null) {
      const trong = thoVon === null || thoVon === undefined || String(thoVon).trim() === '';
      loi.push({ dong: soDong, noiDung: trong ? `${nhom} ${phanLoai}: giá vốn trống.` : `${nhom} ${phanLoai}: giá vốn "${thoVon}" không phải số.` });
    }
    banGhi.push({
      nhom,
      phan_loai: phanLoai,
      nganh: String(lay('nganh') ?? '').trim(),
      gia_von: giaVon,
      gia_ban: docSo(lay('gia_ban')),
      _dong: soDong,
    });
  }
  return { banGhi, loi };
}

/**
 * So sánh dữ liệu mới với dữ liệu đã lưu.
 * @returns {{them:Array, doi:Array<{cu, moi, cot:string[]}>, giuNguyen:Array}}
 */
export function soSanhGiaVon(daLuu, moi) {
  const cu = new Map((daLuu || []).map((r) => [khoaVon(r.nhom, r.phan_loai), r]));
  const them = [], doi = [], giuNguyen = [];
  for (const r of moi) {
    const c = cu.get(khoaVon(r.nhom, r.phan_loai));
    if (!c) { them.push(r); continue; }
    const cot = ['gia_von', 'gia_ban', 'nganh'].filter((k) => (c[k] ?? null) !== (r[k] ?? null) && !(k === 'nganh' && !r[k]));
    if (cot.length) doi.push({ cu: c, moi: r, cot });
    else giuNguyen.push(r);
  }
  return { them, doi, giuNguyen };
}

/**
 * Cảnh báo trong cùng nhóm: size lớn hơn mà vốn lại rẻ hơn.
 * @returns {Array<{nhom, lon, nho, noiDung}>}
 */
export function canhBaoBacVon(ds) {
  const theoNhom = new Map();
  for (const r of ds) {
    const sz = docPhanLoai(r.phan_loai);
    if (!sz || !Number.isFinite(r.gia_von)) continue;
    const k = chuanHoa(r.nhom);
    if (!theoNhom.has(k)) theoNhom.set(k, []);
    theoNhom.get(k).push({ r, sz });
  }
  const kq = [];
  for (const ds2 of theoNhom.values()) {
    for (const a of ds2) {
      for (const b of ds2) {
        if (a !== b && lonHon(a.sz, b.sz) && a.r.gia_von < b.r.gia_von) {
          kq.push({
            nhom: a.r.nhom,
            lon: a.r,
            nho: b.r,
            noiDung: `${a.r.nhom}: ${a.r.phan_loai} lớn hơn ${b.r.phan_loai} nhưng vốn lại rẻ hơn`,
          });
        }
      }
    }
  }
  return kq;
}

/** Bảng tra nhanh: khoaVon → bản ghi. */
export function taoBangTraVon(ds) {
  const m = new Map();
  for (const r of ds || []) m.set(khoaVon(r.nhom, r.phan_loai), r);
  return m;
}
