// Tab Campaign — logic thuần: đọc file prefill, nhận diện, tính giá campaign theo chiến lược,
// điều kiện "vào được", lý do loại, cảnh báo, tổng hợp, báo cáo.

import { docSo } from './so.js';
import { boDau } from './van-ban.js';
import { tinhLai, giaCanDat } from './cong-thuc.js';
import { lamTronLen, lamTronXuong, satDuoiTran } from './lam-tron.js';
import { nhanDien, TEN_LOAI } from './nhan-dien.js';
import { docSize, docPhanLoai } from './size.js';

// Cột cần dùng trong file prefill (đọc theo TÊN, không theo vị trí)
export const COT_PREFILL = {
  product_id: 'Product ID',
  product_name: 'Product Name',
  sku_id: 'SKU ID',
  sku_name: 'SKU Name',
  retail: 'Retail price',
  khoang_gia: 'Campaign Price Range',
  gia: 'Campaign price',
  ton: 'Available stock',
  khoang_ton: 'Campaign stock range',
  so_luong: 'Campaign stock',
  category: 'Product Category',
  l30d: 'L30D sales',
};

const chuanTen = (s) => boDau(s).replace(/[^a-z0-9]/g, '');

/**
 * Đọc file prefill (mảng dòng, dòng 1 = ghi chú, dòng 2 = tiêu đề, dữ liệu từ dòng 3).
 * Tìm dòng tiêu đề trong 6 dòng đầu. soDong = số dòng thật trong Excel (1-based).
 */
export function docPrefill(mang) {
  let iTieuDe = -1;
  for (let i = 0; i < Math.min(6, mang.length); i++) {
    const t = (mang[i] || []).map(chuanTen);
    if (t.includes('skuid') && t.includes('campaignprice')) { iTieuDe = i; break; }
  }
  if (iTieuDe < 0) return { loi: 'Không thấy dòng tiêu đề có "SKU ID" và "Campaign price" — có phải file prefill campaign TikTok không?' };
  const tieuDe = mang[iTieuDe].map(chuanTen);
  const viTri = {};
  const thieu = [];
  for (const [k, ten] of Object.entries(COT_PREFILL)) {
    viTri[k] = tieuDe.indexOf(chuanTen(ten));
    if (viTri[k] < 0 && !['category', 'l30d', 'sku_name', 'product_name'].includes(k)) thieu.push(ten);
  }
  if (thieu.length) return { loi: `File prefill thiếu cột: ${thieu.join(', ')}` };
  const dong = [];
  for (let i = iTieuDe + 1; i < mang.length; i++) {
    const d = mang[i] || [];
    const lay = (k) => (viTri[k] >= 0 ? d[viTri[k]] : '');
    const sku = String(lay('sku_id') ?? '').trim();
    if (!sku) continue;
    dong.push({
      soDong: i + 1,
      product_id: String(lay('product_id') ?? '').trim(),
      product_name: String(lay('product_name') ?? ''),
      sku_id: sku,
      sku_name: String(lay('sku_name') ?? ''),
      retail: docSo(lay('retail')),
      khoang: docKhoangGia(lay('khoang_gia')),
      khoangChu: String(lay('khoang_gia') ?? ''),
      ton: docSo(lay('ton')) ?? 0,
      tonMin: docKhoangTon(lay('khoang_ton')),
      category: String(lay('category') ?? ''),
      l30d: docSo(lay('l30d')) ?? 0,
    });
  }
  return { dong, soDongTieuDe: iTieuDe + 1, cotGia: viTri.gia, cotSoLuong: viTri.so_luong, loi: null };
}

/** ">=1 and <107800" → { san: 1, sanGom: true, tran: 107800, tranGom: false } */
export function docKhoangGia(chu) {
  const kq = { san: null, sanGom: true, tran: null, tranGom: false };
  for (const m of String(chu ?? '').matchAll(/(>=|<=|>|<)\s*([\d.,]+)/g)) {
    const so = docSo(m[2]);
    if (so === null) continue;
    if (m[1][0] === '>') { kq.san = so; kq.sanGom = m[1] === '>='; } else { kq.tran = so; kq.tranGom = m[1] === '<='; }
  }
  return kq;
}

/** ">5" → 6, ">=5" → 5, "5" → 5, trống → 1 */
export function docKhoangTon(chu) {
  const s = String(chu ?? '').trim();
  let m = s.match(/^>\s*=\s*(\d+)/) || s.match(/^≥\s*(\d+)/);
  if (m) return +m[1];
  m = s.match(/^>\s*(\d+)/);
  if (m) return +m[1] + 1;
  m = s.match(/^(\d+)$/);
  return m ? +m[1] : 1;
}

/** Giá làm tròn lớn nhất còn hợp lệ dưới trần và dưới giá bán lẻ. */
export function giaToiDa(dong, buoc) {
  const ung = [];
  const { tran, tranGom } = dong.khoang;
  if (Number.isFinite(tran)) ung.push(tranGom ? lamTronXuong(tran, buoc) : satDuoiTran(tran, buoc));
  if (Number.isFinite(dong.retail)) ung.push(satDuoiTran(dong.retail, buoc));
  return ung.length ? Math.min(...ung) : null;
}

function trongTran(dong, gia) {
  const { tran, tranGom } = dong.khoang;
  if (!Number.isFinite(tran)) return true;
  return tranGom ? gia <= tran : gia < tran;
}
function trenSan(dong, gia) {
  const { san, sanGom } = dong.khoang;
  if (!Number.isFinite(san)) return true;
  return sanGom ? gia >= san : gia > san;
}

/** Thông tin sản phẩm cho nhận diện: lấy từ file sản phẩm; không có thì dùng tên trong prefill. */
export function sanPhamCua(dong, banDoSP) {
  const sp = banDoSP.get(dong.sku_id);
  if (sp) return { ...sp, sku_id: dong.sku_id, coTrongFileSP: true };
  return {
    sku_id: dong.sku_id,
    product_id: dong.product_id,
    product_name: dong.product_name,
    variation_value: /^default_sku_name$/i.test(dong.sku_name) ? '' : dong.sku_name,
    seller_sku: '',
    coTrongFileSP: false,
  };
}

/**
 * Nhận diện + tính giá đề xuất cho tất cả dòng prefill.
 * @param {object} p { dong, banDoSP: Map sku→sp, bangVon, ganTay: Map, layPhi: (nganh)=>phi|null, cd }
 *   cd = { chienLuoc: 'A'|'B'|'C', giamPT: 0.2, laiMin: 0.1, buoc: 1000 }
 */
export function tinhCampaign({ dong, banDoSP, bangVon, ganTay, layPhi, cd }) {
  return dong.map((d) => {
    const sp = sanPhamCua(d, banDoSP);
    const nd = nhanDien(sp, bangVon, ganTay);
    const r = { ...d, sp, nd, canhBao: [] };
    if (!sp.coTrongFileSP) r.canhBao.push('Không có trong file sản phẩm (nhận diện theo tên trong prefill)');
    if (Number.isFinite(d.retail) && d.retail % 1000 !== 0) r.canhBao.push(`Giá bán lẻ bất thường (${d.retail.toLocaleString('vi-VN')})`);
    if (nd.trangThai === 'NGOAI') return { ...r, nhom: 'NGOAI', lyDo: nd.lyDo };
    if (nd.trangThai === 'GAN') return { ...r, nhom: 'GAN', lyDo: nd.lyDo };
    const phi = layPhi(nd.nganh);
    if (!phi) return { ...r, nhom: 'LOAI', lyDo: `Chưa có bộ phí ngành ${nd.nganh}`, phi: null };
    const de = giaDeXuat(r, phi, cd);
    return danhGia({ ...r, phi, ...de, gia: de.giaDeXuat, soLuong: soLuongMacDinh(d) }, cd);
  });
}

export function soLuongMacDinh(d) {
  return Math.min(d.tonMin, Math.max(0, d.ton));
}

/** Giá đề xuất theo chiến lược. */
export function giaDeXuat(r, phi, cd) {
  const buoc = cd.buoc || 1000;
  const toiDa = giaToiDa(r, buoc);
  const ghiChu = [];
  let gia;
  // Giá thấp nhất để cả 2 kịch bản đều đạt lãi tối thiểu
  const tho = giaCanDat(r.nd.von, phi, { kichBan: 'ca2', laiPhanTram: cd.laiMin });
  const giaSan = tho === null ? null : lamTronLen(tho, buoc);
  if (cd.chienLuoc === 'A') {
    gia = lamTronXuong(r.retail * (1 - cd.giamPT), buoc);
    if (toiDa !== null && gia > toiDa) { gia = toiDa; ghiChu.push('đã hạ dưới trần'); }
  } else if (cd.chienLuoc === 'B') {
    gia = giaSan;
    if (gia !== null && Number.isFinite(r.khoang.san) && !trenSan(r, gia)) gia = lamTronLen(r.khoang.san + (r.khoang.sanGom ? 0 : 1), buoc);
  } else {
    gia = toiDa;
  }
  return { giaDeXuat: gia, giaSan, giaToiDa: toiDa, ghiChuGia: ghiChu };
}

/**
 * Đánh giá 1 dòng tại giá / số lượng hiện tại (có thể đã sửa tay).
 * Điều kiện VÀO ĐƯỢC: trong khoảng giá, < giá bán lẻ, lãi QC & không QC ≥ lãi tối thiểu, đủ tồn.
 */
export function danhGia(r, cd) {
  const { gia, soLuong } = r;
  if (r.boChon) return { ...r, nhom: 'LOAI', lyDo: 'Bỏ chọn tay', lyDoDS: ['Bỏ chọn tay'], lai: r.lai };
  if (!Number.isFinite(gia) || gia <= 0) {
    return { ...r, nhom: 'LOAI', lyDo: 'Không tính được giá (tổng phí + lãi tối thiểu ≥ 100%)', lyDoDS: ['khong-gia'], lai: null };
  }
  const lai = tinhLai(r.nd.von, gia, r.phi);
  const ptMin = Math.min(lai.ptQC, lai.ptKhongQC);
  // "Vượt trần không đủ lãi": kể cả ở mức giá cao nhất được phép (dưới trần, dưới giá bán lẻ) cũng không đủ lãi tối thiểu
  const khongTheDuLai = r.giaToiDa !== null && (!Number.isFinite(r.giaSan) || r.giaSan > r.giaToiDa);
  const ds = [];
  const vuotTran = !trongTran(r, gia);
  if (vuotTran) {
    ds.push(cd.chienLuoc === 'B' && !r.daSuaGia
      ? `Vượt trần không đủ lãi (cần ≥ ${fmt(r.giaSan)}, trần ${fmt(r.khoang.tran)})`
      : `Vượt trần khoảng giá (${r.khoangChu})`);
  } else {
    if (Number.isFinite(r.retail) && gia >= r.retail) ds.push('Không thấp hơn giá bán lẻ');
    if (lai.laiQC < 0 || lai.laiKhongQC < 0) ds.push(khongTheDuLai ? 'Vượt trần không đủ lãi (dưới trần thì lỗ)' : 'Lỗ');
    else if (ptMin < cd.laiMin - 1e-9) ds.push(khongTheDuLai ? `Vượt trần không đủ lãi (dưới trần chỉ lãi ${phanTram(ptMin)})` : `Dưới lãi tối thiểu (${phanTram(ptMin)})`);
  }
  if (!trenSan(r, gia)) ds.push(`Dưới sàn khoảng giá (${r.khoangChu})`);
  if (r.ton < r.tonMin) ds.push(`Thiếu tồn (có ${r.ton}, cần ${r.tonMin})`);
  else if (soLuong < r.tonMin) ds.push(`Số lượng dưới mức tối thiểu (${r.tonMin})`);
  else if (soLuong > r.ton) ds.push(`Số lượng vượt tồn kho (${r.ton})`);
  return { ...r, lai, nhom: ds.length ? 'LOAI' : 'VAO', lyDo: ds.join('; '), lyDoDS: ds };
}

const phanTram = (x) => `${(x * 100).toFixed(1).replace('.', ',')}%`;
const fmt = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('vi-VN') : '—');

/** Sửa tay giá / số lượng / bỏ chọn rồi đánh giá lại. */
export function suaDong(r, sua, cd) {
  if (r.nhom === 'NGOAI' || r.nhom === 'GAN' || !r.phi) return r;
  const moi = { ...r };
  if (sua.gia !== undefined) { moi.gia = sua.gia; moi.daSuaGia = sua.gia !== r.giaDeXuat; }
  if (sua.soLuong !== undefined) moi.soLuong = sua.soLuong;
  if (sua.boChon !== undefined) moi.boChon = sua.boChon;
  return danhGia(moi, cd);
}

/** Lý do loại dạng nhóm ngắn để thống kê. */
export function nhomLyDo(r) {
  if (r.nhom === 'NGOAI') return 'Ngoài phạm vi';
  const l = r.lyDo || '';
  if (l.startsWith('Bỏ chọn')) return 'Bỏ chọn tay';
  if (l.includes('Vượt trần không đủ lãi')) return 'Vượt trần không đủ lãi';
  if (/(^|; )Lỗ/.test(l)) return 'Lỗ';
  if (l.includes('Dưới lãi tối thiểu')) return 'Dưới lãi tối thiểu';
  if (l.includes('tồn') || l.includes('Số lượng')) return 'Thiếu tồn';
  if (l.includes('bộ phí')) return 'Chưa có bộ phí';
  return 'Khác (khoảng giá / giá bán lẻ)';
}

/** Mô tả nhận diện: "Liễn · Nẹp gỗ khổ dọc 40x60 × 2" */
export function moTaNhanDien(nd) {
  if (!nd || !nd.nhom) return '';
  return `${TEN_LOAI[nd.loai] || ''} · ${nd.nhom} ${nd.phanLoai}${nd.soLuong > 1 ? ` × ${nd.soLuong}` : ''}`;
}

/** Sắp xếp mặc định: L30D giảm dần, rồi theo thứ tự trong file. */
export function sapXepL30D(ds) {
  return [...ds].sort((a, b) => (b.l30d || 0) - (a.l30d || 0) || a.soDong - b.soDong);
}

/** Tổng hợp số lượng + lãi TB nhóm vào được. */
export function tongHop(ds) {
  const dem = { VAO: 0, LOAI: 0, GAN: 0, NGOAI: 0 };
  const theoLoai = {};
  const lyDo = {};
  let n = 0, qc = 0, kqc = 0, ptqc = 0, ptkqc = 0;
  for (const r of ds) {
    dem[r.nhom]++;
    if (r.nhom === 'VAO') {
      const k = `${TEN_LOAI[r.nd.loai]} · ${r.nd.nhom}`;
      theoLoai[k] = (theoLoai[k] || 0) + 1;
      n++; qc += r.lai.laiQC; kqc += r.lai.laiKhongQC; ptqc += r.lai.ptQC; ptkqc += r.lai.ptKhongQC;
    } else if (r.nhom === 'LOAI' || r.nhom === 'NGOAI') {
      const k = nhomLyDo(r);
      lyDo[k] = (lyDo[k] || 0) + 1;
    }
  }
  return {
    dem, theoLoai, lyDo,
    laiTB: n ? { laiQC: qc / n, laiKhongQC: kqc / n, ptQC: ptqc / n, ptKhongQC: ptkqc / n } : null,
  };
}

/** Hai khoảng ngày (YYYY-MM-DD) có chồng lấn không. */
export function chongLan(a1, a2, b1, b2) {
  if (!a1 || !b1) return false;
  return a1 <= (b2 || b1) && b1 <= (a2 || a1);
}

/**
 * Cảnh báo SKU đã nằm trong campaign khác có thời gian chồng lấn với GIÁ KHÁC.
 * @param cacCampaign [{ ten, kq: Map sku → gia_campaign }]
 */
export function canhBaoChongLan(ds, cacCampaign) {
  const kq = new Map();
  for (const r of ds) {
    if (r.nhom !== 'VAO') continue;
    for (const c of cacCampaign) {
      const giaKhac = c.kq.get(r.sku_id);
      if (giaKhac !== undefined && giaKhac !== r.gia) {
        if (!kq.has(r.sku_id)) kq.set(r.sku_id, []);
        kq.get(r.sku_id).push(`Đang ở campaign "${c.ten}" (chồng thời gian) với giá ${fmt(giaKhac)}`);
      }
    }
  }
  return kq;
}

/**
 * So với campaign trước cùng gian: SKU lần trước vào được mà lần này không.
 * @param kqTruoc Map sku → { ket_qua, gia_campaign }
 */
export function soVoiLanTruoc(ds, kqTruoc, tenTruoc) {
  const kq = new Map();
  for (const r of ds) {
    const t = kqTruoc.get(r.sku_id);
    if (t && t.ket_qua === 'VAO' && r.nhom !== 'VAO') {
      kq.set(r.sku_id, `Lần trước ("${tenTruoc}") vào được với giá ${fmt(t.gia_campaign)}; lần này: ${r.nhom === 'GAN' ? 'cần gán' : r.lyDo}`);
    }
  }
  return kq;
}

// ---------- báo cáo ----------

const pt = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : '');
const tron = (x) => (Number.isFinite(x) ? Math.round(x) : '');

function cotChung(r) {
  return [r.sku_id, r.product_id, r.sp.product_name, r.sp.variation_value, r.sp.seller_sku];
}

/** Các sheet báo cáo (mảng dòng). */
export function bangBaoCao(ds, info) {
  const th = tongHop(ds);
  const tongHopSheet = [
    ['Campaign', info.ten], ['Gian hàng', info.gian], ['Thời gian', `${info.bat_dau || ''} → ${info.ket_thuc || ''}`],
    ['Tháng phí', info.thangPhiHienThi], ['Chiến lược', info.chienLuocHienThi], ['Lãi tối thiểu', `${info.laiMinHienThi}`],
    ['File gốc', info.file_goc], ['Xuất lúc', info.xuat_luc], [],
    ['Nhóm', 'Số SKU'], ['✅ Vào được', th.dem.VAO], ['❌ Bị loại', th.dem.LOAI], ['❓ Cần gán', th.dem.GAN], ['Ngoài phạm vi', th.dem.NGOAI], ['Tổng', ds.length], [],
    ['Vào được theo loại', 'Số SKU'], ...Object.entries(th.theoLoai).sort(), [],
    ['Lý do loại', 'Số SKU'], ...Object.entries(th.lyDo).sort((a, b) => b[1] - a[1]), [],
    ['Lãi trung bình (vào được)', 'Có QC', 'Không QC'],
    ['Đồng / đơn', tron(th.laiTB?.laiQC), tron(th.laiTB?.laiKhongQC)],
    ['% trên giá campaign', pt(th.laiTB?.ptQC), pt(th.laiTB?.ptKhongQC)],
  ];
  const dauSP = ['SKU ID', 'Product ID', 'Tên sản phẩm', 'Phân loại', 'Seller SKU'];
  const dauGia = ['Loại', 'Nhóm giá vốn', 'Size', 'Số tranh/tấm', 'Giá vốn', 'Giá bán lẻ', 'Khoảng giá', 'Giá campaign', 'Lãi có QC', '% có QC', 'Lãi không QC', '% không QC', 'Số lượng', 'Tồn', 'L30D'];
  const giaCua = (r) => [TEN_LOAI[r.nd.loai] || '', r.nd.nhom || '', r.nd.phanLoai || '', r.nd.soLuong || '', tron(r.nd.von), tron(r.retail), r.khoangChu,
    tron(r.gia), tron(r.lai?.laiQC), pt(r.lai?.ptQC), tron(r.lai?.laiKhongQC), pt(r.lai?.ptKhongQC), r.soLuong ?? '', r.ton, r.l30d];
  const ghiChu = (r) => [...(r.ghiChuGia || []), ...(r.nd?.suyRaTuTen?.length ? [`suy ra từ tên: ${r.nd.suyRaTuTen.join(', ')}`] : []), ...(r.nd?.nguon === 'gan-tay' ? ['gán tay'] : []), ...r.canhBao].join('; ');
  const sx = sapXepL30D(ds);
  return {
    'Tổng hợp': tongHopSheet,
    'Vào được': [[...dauSP, ...dauGia, 'Ghi chú / cảnh báo'], ...sx.filter((r) => r.nhom === 'VAO').map((r) => [...cotChung(r), ...giaCua(r), ghiChu(r)])],
    'Bị loại': [[...dauSP, 'Lý do', ...dauGia, 'Ghi chú / cảnh báo'], ...sx.filter((r) => r.nhom === 'LOAI').map((r) => [...cotChung(r), r.lyDo, ...giaCua(r), ghiChu(r)])],
    'Cần gán': [[...dauSP, 'Lý do', 'Giá bán lẻ', 'L30D', 'Ghi chú'], ...sx.filter((r) => r.nhom === 'GAN').map((r) => [...cotChung(r), r.lyDo, tron(r.retail), r.l30d, r.canhBao.join('; ')])],
  };
}

/** Dòng lưu sheet CAMPAIGN_KQ (bỏ ngoài phạm vi, chỉ đếm). */
export function dongKetQua(ds) {
  return ds.filter((r) => r.nhom !== 'NGOAI').map((r) => ({
    sku_id: r.sku_id, product_id: r.product_id, ket_qua: r.nhom, ly_do: r.lyDo || '',
    loai: r.nd?.loai || '', nhom: r.nd?.nhom || '', phan_loai: r.nd?.phanLoai || '', so_luong_tranh: r.nd?.soLuong ?? '',
    gia_von: r.nd?.von ?? '', gia_ban_le: r.retail ?? '', gia_campaign: Number.isFinite(r.gia) ? r.gia : '', so_luong: r.soLuong ?? '',
    lai_qc: Number.isFinite(r.lai?.laiQC) ? Math.round(r.lai.laiQC) : '', lai_noqc: Number.isFinite(r.lai?.laiKhongQC) ? Math.round(r.lai.laiKhongQC) : '',
    ghi_chu: [...(r.ghiChuGia || []), ...r.canhBao].join('; '),
  }));
}

/**
 * "Gán cho cả sản phẩm": size riêng của 1 SKU trong nhóm đã chọn (đọc size từ phân loại → seller_sku → tên).
 * Trả phân loại trong bảng giá vốn, hoặc null nếu SKU không có size khớp.
 */
export function sizeRiengTrongNhom(sp, nhom, dsVon) {
  let sz = null;
  for (const t of [sp.variation_value, sp.seller_sku, sp.product_name]) if ((sz = docSize(t))) break;
  if (!sz) return null;
  const khop = dsVon.filter((v) => v.nhom === nhom).find((v) => {
    const p = docPhanLoai(v.phan_loai);
    return p && p.rong === sz.rong && p.cao === sz.cao;
  });
  return khop ? khop.phan_loai : null;
}
