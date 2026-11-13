/**
 * Apps Script cho app "Bảng giá & Lợi nhuận".
 * Dán toàn bộ file này vào Extensions → Apps Script của Google Sheets, rồi Deploy → Web App.
 *
 * - Đọc: GET  ?action=ping | docTatCa | docCampaignKQ&id=... | docBangTinh&id=...
 * - Ghi: POST (Content-Type text/plain) body JSON { action, matKhau, ... }
 *        Mật khẩu so với Script Properties "MAT_KHAU" (Project Settings → Script properties).
 * - Mọi thay đổi ghi vào sheet LICH_SU; riêng bảng phí ghi thêm từng ô vào LICH_SU_BANG_PHI.
 */

var PHIEN_BAN = '1.2.0';

// Cấu trúc các sheet. khoa = các cột tạo nên khóa duy nhất. so = cột kiểu số.
var CAU_TRUC = {
  DANH_MUC: {
    cot: ['loai', 'ten', 'thu_tu', 'dang_dung', 'cap_nhat_luc'],
    khoa: ['loai', 'ten'], so: ['thu_tu'],
  },
  BANG_PHI: {
    cot: ['gian', 'nganh', 'thang', 'phi_san', 'phi_vc', 'phi_xl', 'phi_qc', 'aff_qc', 'aff_noqc', 'cap_nhat_luc'],
    khoa: ['gian', 'nganh', 'thang'], so: ['phi_san', 'phi_vc', 'phi_xl', 'phi_qc', 'aff_qc', 'aff_noqc'],
  },
  GIA_VON: {
    cot: ['nhom', 'phan_loai', 'nganh', 'gia_von', 'gia_ban', 'file_nguon', 'cap_nhat_luc'],
    khoa: ['nhom', 'phan_loai'], so: ['gia_von', 'gia_ban'],
  },
  NOI_SKU: {
    cot: ['sku_id', 'product_id', 'nhom', 'phan_loai', 'so_luong', 'phan_loai_goc', 'seller_sku', 'ghi_chu', 'cap_nhat_luc'],
    khoa: ['sku_id'], so: ['so_luong'],
  },
  CAMPAIGN: {
    cot: ['id', 'ten', 'gian', 'bat_dau', 'ket_thuc', 'thang_phi', 'chien_luoc', 'tham_so', 'lai_toi_thieu', 'file_goc', 'tong_hop', 'trang_thai', 'xuat_luc', 'tao_luc', 'cap_nhat_luc'],
    khoa: ['id'], so: ['lai_toi_thieu'],
  },
  CAMPAIGN_KQ: {
    cot: ['campaign_id', 'sku_id', 'product_id', 'ket_qua', 'ly_do', 'loai', 'nhom', 'phan_loai', 'so_luong_tranh', 'gia_von', 'gia_ban_le', 'gia_campaign', 'so_luong', 'lai_qc', 'lai_noqc', 'ghi_chu'],
    khoa: ['campaign_id', 'sku_id'], so: ['so_luong_tranh', 'gia_von', 'gia_ban_le', 'gia_campaign', 'so_luong', 'lai_qc', 'lai_noqc'],
    con: 'campaign_id',
  },
  BANG_TINH: {
    // da_nhan_boi / nhan_vao_san / nhan_luc: thêm ở v1.2 — bảng cũ đã có người "nhận"
    cot: ['id', 'ten', 'gian_hien_thi', 'thang_phi', 'so_dong', 'cap_nhat_luc', 'da_nhan_boi', 'nhan_vao_san', 'nhan_luc'],
    khoa: ['id'], so: ['so_dong'],
  },
  BANG_TINH_DONG: {
    cot: ['bang_tinh_id', 'stt', 'ten', 'phan_loai', 'nganh', 'gia_von', 'gia_ban'],
    khoa: ['bang_tinh_id', 'stt'], so: ['stt', 'gia_von', 'gia_ban'],
    con: 'bang_tinh_id',
  },
  // ---- v1.2: người dùng + bảng tính riêng theo người & theo sàn ----
  NGUOI_DUNG: {
    cot: ['ten', 'dang_dung', 'thu_tu', 'tao_luc', 'cap_nhat_luc'],
    khoa: ['ten'], so: ['thu_tu'],
  },
  BANG_TINH_TIKTOK: {
    cot: ['id', 'ten', 'nguoi_tao', 'san', 'gian_hien_thi', 'so_dong', 'nguon_cu', 'tao_luc', 'cap_nhat_luc'],
    khoa: ['id'], so: ['so_dong'],
  },
  BANG_TINH_DONG_TIKTOK: {
    cot: ['bang_tinh_id', 'stt', 'ten', 'phan_loai', 'nganh', 'gia_von', 'gia_ban'],
    khoa: ['bang_tinh_id', 'stt'], so: ['stt', 'gia_von', 'gia_ban'],
    con: 'bang_tinh_id',
  },
  BANG_TINH_SHOPEE: {
    cot: ['id', 'ten', 'nguoi_tao', 'san', 'gian_hien_thi', 'so_dong', 'nguon_cu', 'tao_luc', 'cap_nhat_luc'],
    khoa: ['id'], so: ['so_dong'],
  },
  BANG_TINH_DONG_SHOPEE: {
    cot: ['bang_tinh_id', 'stt', 'ten', 'phan_loai', 'nganh', 'gia_von', 'gia_ban'],
    khoa: ['bang_tinh_id', 'stt'], so: ['stt', 'gia_von', 'gia_ban'],
    con: 'bang_tinh_id',
  },
  LICH_SU: {
    cot: ['thoi_gian', 'hanh_dong', 'sheet', 'khoa', 'du_lieu_cu', 'du_lieu_moi'],
    khoa: [], so: [],
  },
  LICH_SU_BANG_PHI: {
    cot: ['thoi_gian', 'hanh_dong', 'thang', 'gian', 'nganh', 'o', 'gia_tri_cu', 'gia_tri_moi'],
    khoa: [], so: [],
  },
};

// Sheet được phép upsert / xóa trực tiếp
var SHEET_GHI = ['DANH_MUC', 'BANG_PHI', 'GIA_VON', 'NOI_SKU', 'CAMPAIGN', 'NGUOI_DUNG'];
// Sheet trả về trong docTatCa. KHÔNG trả bảng tính (mỗi người chỉ đọc được bảng của mình).
var SHEET_DOC = ['DANH_MUC', 'BANG_PHI', 'GIA_VON', 'NOI_SKU', 'CAMPAIGN', 'NGUOI_DUNG'];

// Sàn → sheet bảng tính riêng
var SAN = {
  TIKTOK: { ten: 'TikTok', cha: 'BANG_TINH_TIKTOK', con: 'BANG_TINH_DONG_TIKTOK' },
  SHOPEE: { ten: 'Shopee', cha: 'BANG_TINH_SHOPEE', con: 'BANG_TINH_DONG_SHOPEE' },
};

var SAI_TOI_DA = 10;        // sai mật khẩu quá số lần này ...
var KHOA_GIAY = 10 * 60;    // ... thì khóa 10 phút

var TEN_O_PHI = {
  phi_san: 'Phí sàn (%)', phi_vc: 'Phí bồi hoàn V/C (đ)', phi_xl: 'Phí xử lý đơn hàng (đ)',
  phi_qc: 'Chi phí QC (%)', aff_qc: 'AFF có QC (%)', aff_noqc: 'AFF không QC (%)',
};

// ============ Điểm vào ============

function doGet(e) {
  return xuLy_(function () {
    var p = (e && e.parameter) || {};
    switch (p.action) {
      case 'ping': return { phienBan: PHIEN_BAN, coMatKhau: !!layMatKhau_() };
      case 'docTatCa': return { duLieu: docTatCa_() };
      case 'docCampaignKQ': return { duLieu: docCon_('CAMPAIGN_KQ', p.id) };
      // Bảng cũ (trước v1.2): chỉ đọc được khi CHƯA có người nhận
      case 'docBangTinh': return { duLieu: docBangTinhCu_(p.id) };
      case 'dsBangTinhCu': return { duLieu: dsBangTinhCu_() };
      // Bảng của 1 người trên 1 sàn: chỉ trả bảng có nguoi_tao đúng tên người gửi yêu cầu
      case 'dsBangTinhCuaToi': return { duLieu: dsBangTinhCuaNguoi_(p.nguoi, p.san) };
      case 'docBangTinhCuaToi': return { duLieu: docBangTinhCuaNguoi_(p.nguoi, p.san, p.id) };
      default: throw loi_('Hành động không hợp lệ: ' + p.action);
    }
  });
}

function doPost(e) {
  return xuLy_(function () {
    var body;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (x) { throw loi_('Dữ liệu gửi lên không phải JSON.'); }
    // Không cần mật khẩu: người dùng tự thêm tên mình; mỗi người lưu / sửa / xóa bảng tính CỦA MÌNH
    switch (body.action) {
      case 'themNguoi': return { banGhi: themNguoi_(body.ten) };
      case 'luuBangTinhCuaToi': return luuBangTinhCuaNguoi_(body.nguoi, body.san, body.bangTinh, body.dong || []);
      case 'doiTenBangTinhCuaToi': return { banGhi: doiTenBangTinhCuaNguoi_(body.nguoi, body.san, body.id, body.ten) };
      case 'xoaBangTinhCuaToi': return { daXoa: xoaBangTinhCuaNguoi_(body.nguoi, body.san, body.id) };
      case 'nhanBangTinhCu': return { banGhi: nhanBangTinhCu_(body.nguoi, body.san, body.id) };
      default: break;
    }
    kiemTraMatKhau_(body.matKhau);
    switch (body.action) {
      case 'doiTenNguoi': return { banGhi: doiTenNguoi_(body.tenCu, body.tenMoi) };
      case 'kiemTraMatKhau': return {};
      case 'upsert': return { banGhi: upsert_(body.sheet, body.banGhi || []) };
      case 'xoa': return { daXoa: xoa_(body.sheet, body.khoa || []) };
      case 'luuCampaign': return luuCha_('CAMPAIGN', body.campaign, 'CAMPAIGN_KQ', body.ketQua || [], 'id');
      case 'luuBangTinh': return luuCha_('BANG_TINH', body.bangTinh, 'BANG_TINH_DONG', body.dong || [], 'id');
      case 'xoaBangTinh': return { daXoa: xoaCha_('BANG_TINH', 'BANG_TINH_DONG', body.id) };
      default: throw loi_('Hành động không hợp lệ: ' + body.action);
    }
  });
}

function xuLy_(fn) {
  var kq;
  try {
    kq = fn();
    kq.ok = true;
  } catch (x) {
    kq = { ok: false, loi: x && x.laLoiNguoiDung ? x.message : 'Lỗi Apps Script: ' + (x && x.message ? x.message : x) };
  }
  return ContentService.createTextOutput(JSON.stringify(kq)).setMimeType(ContentService.MimeType.JSON);
}

function loi_(thongBao) {
  var x = new Error(thongBao);
  x.laLoiNguoiDung = true;
  return x;
}

// ============ Mật khẩu ============

function layMatKhau_() {
  return PropertiesService.getScriptProperties().getProperty('MAT_KHAU') || '';
}

function kiemTraMatKhau_(matKhau) {
  var dung = layMatKhau_();
  if (!dung) throw loi_('Chưa đặt mật khẩu. Vào Apps Script → Project Settings → Script properties, thêm MAT_KHAU.');
  var cache = CacheService.getScriptCache();
  var soLanSai = Number(cache.get('sai_mat_khau') || 0);
  if (soLanSai >= SAI_TOI_DA) throw loi_('Sai mật khẩu quá nhiều lần. Thử lại sau 10 phút.');
  if (!soSanhAnToan_(String(matKhau || ''), dung)) {
    cache.put('sai_mat_khau', String(soLanSai + 1), KHOA_GIAY);
    throw loi_('Sai mật khẩu.');
  }
}

function soSanhAnToan_(a, b) {
  var khac = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    khac |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return khac === 0;
}

// ============ Lịch sử bảng phí (từng ô) ============

/** Các dòng lịch sử từng ô của 1 bộ phí (gian × ngành × tháng). */
function lichSuBangPhi_(thoiGian, hanhDong, cu, moi) {
  var goc = moi || cu;
  var dong = [];
  Object.keys(TEN_O_PHI).forEach(function (k) {
    var a = cu ? giaTriGhi_(null, k, cu[k]) : '';
    var b = moi ? giaTriGhi_(null, k, moi[k]) : '';
    if (a !== b) dong.push([thoiGian, hanhDong, String(goc.thang), String(goc.gian), String(goc.nganh), TEN_O_PHI[k], a, b]);
  });
  return dong;
}

function ghiLichSuBangPhi_(dong) {
  if (!dong.length) return;
  var sh = laySheet_('LICH_SU_BANG_PHI');
  var r = sh.getRange(sh.getLastRow() + 1, 1, dong.length, dong[0].length);
  r.setNumberFormat('@');
  r.setValues(dong);
}

function gioDiaPhuong_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// ============ Sheet ============

function laySheet_(ten) {
  var ct = CAU_TRUC[ten];
  if (!ct) throw loi_('Sheet không hợp lệ: ' + ten);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ten);
  if (!sh) {
    sh = ss.insertSheet(ten);
    sh.getRange(1, 1, 1, ct.cot.length).setValues([ct.cot]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // Định dạng chữ thuần để Sheets không tự đổi SKU ID 19 số, tháng "2026-10"... thành số/ngày
    sh.getRange(1, 1, sh.getMaxRows(), ct.cot.length).setNumberFormat('@');
  } else {
    // Bổ sung cột mới nếu phiên bản sau thêm cột
    var dau = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    var thieu = ct.cot.filter(function (c) { return dau.indexOf(c) < 0; });
    if (thieu.length) {
      sh.getRange(1, dau.filter(String).length + 1, 1, thieu.length).setValues([thieu]).setFontWeight('bold');
    }
  }
  return sh;
}

/** Đọc toàn bộ sheet thành mảng object (cột số được đổi sang số). */
function docSheet_(ten) {
  var sh = laySheet_(ten);
  var ct = CAU_TRUC[ten];
  var vung = sh.getDataRange().getValues();
  var dau = vung[0];
  var ds = [];
  for (var i = 1; i < vung.length; i++) {
    var o = {}, coDuLieu = false;
    for (var c = 0; c < dau.length; c++) {
      if (!dau[c]) continue;
      var v = vung[i][c];
      if (v !== '' && v !== null) coDuLieu = true;
      o[dau[c]] = chuyenGiaTri_(ct, dau[c], v);
    }
    if (coDuLieu) { o._dong = i + 1; ds.push(o); }
  }
  return { sh: sh, dau: dau, ds: ds };
}

function chuyenGiaTri_(ct, cot, v) {
  if (ct.so.indexOf(cot) >= 0) {
    if (v === '' || v === null) return null;
    var n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  return v === null ? '' : String(v);
}

function khoaCua_(ct, o) {
  return ct.khoa.map(function (k) { return String(o[k] === undefined || o[k] === null ? '' : o[k]).trim(); }).join('|');
}

function bo_(o) {
  var r = {};
  for (var k in o) if (k.charAt(0) !== '_') r[k] = o[k];
  return r;
}

function docTatCa_() {
  var kq = {};
  SHEET_DOC.forEach(function (t) { kq[t] = docSheet_(t).ds.map(bo_); });
  return kq;
}

function docCon_(ten, id) {
  if (!id) throw loi_('Thiếu id.');
  var cotCha = CAU_TRUC[ten].con;
  return docSheet_(ten).ds.filter(function (o) { return String(o[cotCha]) === String(id); }).map(bo_);
}

function giaTriGhi_(ct, cot, v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ============ Ghi ============

function voiKhoa_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw loi_('Máy chủ đang bận (có người khác đang lưu). Thử lại sau ít giây.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Ghi từng bản ghi theo khóa: có rồi thì cập nhật dòng đó, chưa có thì thêm dòng mới. */
function upsert_(ten, banGhi) {
  if (SHEET_GHI.indexOf(ten) < 0) throw loi_('Không được ghi trực tiếp vào sheet ' + ten);
  var ct = CAU_TRUC[ten];
  return voiKhoa_(function () {
    var d = docSheet_(ten);
    var theoKhoa = {};
    d.ds.forEach(function (o) { theoKhoa[khoaCua_(ct, o)] = o; });
    var bayGio = new Date().toISOString();
    var lichSu = [], themMoi = [], daLuu = [], lichSuPhi = [];
    var gioVN = ten === 'BANG_PHI' ? gioDiaPhuong_() : '';
    banGhi.forEach(function (moi) {
      var khoa = khoaCua_(ct, moi);
      if (ct.khoa.some(function (k) { return moi[k] === undefined || moi[k] === null || String(moi[k]).trim() === ''; })) {
        throw loi_('Bản ghi thiếu khóa (' + ct.khoa.join(', ') + ').');
      }
      var cu = theoKhoa[khoa];
      var ban = {};
      ct.cot.forEach(function (c) { ban[c] = moi[c] !== undefined ? moi[c] : (cu ? cu[c] : ''); });
      // Không đổi gì thì không ghi, không thêm lịch sử
      if (cu && giongNhau_(ct, cu, ban)) { daLuu.push(bo_(cu)); return; }
      if (ct.cot.indexOf('cap_nhat_luc') >= 0) ban.cap_nhat_luc = bayGio;
      var dong = d.dau.map(function (c) { return c ? giaTriGhi_(ct, c, ban[c]) : ''; });
      if (cu && cu._dong) {
        var r = d.sh.getRange(cu._dong, 1, 1, dong.length);
        r.setNumberFormat('@');
        r.setValues([dong]);
        ban._dong = cu._dong;
      } else if (cu && cu._moi !== undefined) {
        themMoi[cu._moi] = dong; // trùng khóa trong cùng 1 lần gửi
        ban._moi = cu._moi;
      } else {
        ban._moi = themMoi.length;
        themMoi.push(dong);
      }
      theoKhoa[khoa] = ban;
      daLuu.push(bo_(ban));
      lichSu.push([bayGio, cu ? 'SUA' : 'THEM', ten, khoa, cu ? JSON.stringify(bo_(cu)) : '', JSON.stringify(bo_(ban))]);
      if (ten === 'BANG_PHI') lichSuPhi = lichSuPhi.concat(lichSuBangPhi_(gioVN, cu ? 'SUA' : 'THEM', cu, ban));
    });
    if (themMoi.length) {
      var r2 = d.sh.getRange(d.sh.getLastRow() + 1, 1, themMoi.length, d.dau.length);
      r2.setNumberFormat('@');
      r2.setValues(themMoi);
    }
    ghiLichSu_(lichSu);
    ghiLichSuBangPhi_(lichSuPhi);
    SpreadsheetApp.flush();
    return daLuu;
  });
}

function giongNhau_(ct, cu, moi) {
  return ct.cot.every(function (c) {
    if (c === 'cap_nhat_luc') return true;
    return giaTriGhi_(ct, c, cu[c]) === giaTriGhi_(ct, c, moi[c]);
  });
}

function xoa_(ten, dsKhoa) {
  if (SHEET_GHI.indexOf(ten) < 0) throw loi_('Không được xóa trực tiếp trong sheet ' + ten);
  var ct = CAU_TRUC[ten];
  return voiKhoa_(function () {
    var d = docSheet_(ten);
    var canXoa = {};
    dsKhoa.forEach(function (k) { canXoa[typeof k === 'string' ? k : khoaCua_(ct, k)] = true; });
    var bayGio = new Date().toISOString();
    var lichSu = [], lichSuPhi = [];
    var gioVN = ten === 'BANG_PHI' ? gioDiaPhuong_() : '';
    var dongXoa = d.ds.filter(function (o) { return canXoa[khoaCua_(ct, o)]; });
    // xóa từ dưới lên để số dòng không bị lệch
    dongXoa.sort(function (a, b) { return b._dong - a._dong; }).forEach(function (o) {
      d.sh.deleteRow(o._dong);
      lichSu.push([bayGio, 'XOA', ten, khoaCua_(ct, o), JSON.stringify(bo_(o)), '']);
      if (ten === 'BANG_PHI') lichSuPhi = lichSuPhi.concat(lichSuBangPhi_(gioVN, 'XOA', o, null));
    });
    ghiLichSu_(lichSu);
    ghiLichSuBangPhi_(lichSuPhi);
    SpreadsheetApp.flush();
    return dongXoa.length;
  });
}

/** Lưu 1 bản ghi cha (campaign / bảng tính) + thay toàn bộ dòng con của nó. LICH_SU ghi 1 dòng tóm tắt. */
function luuCha_(tenCha, cha, tenCon, dsCon, cotId) {
  if (!cha || !cha[cotId]) throw loi_('Thiếu ' + cotId + '.');
  return voiKhoa_(function () { return luuChaKhongKhoa_(tenCha, cha, tenCon, dsCon, cotId); });
}

/** Phần thân của luuCha_ (gọi khi đã giữ khóa). */
function luuChaKhongKhoa_(tenCha, cha, tenCon, dsCon, cotId) {
  var ctCon = CAU_TRUC[tenCon];
  return (function () {
    var bayGio = new Date().toISOString();
    var ctCha = CAU_TRUC[tenCha];
    var dCha = docSheet_(tenCha);
    var cu = null;
    dCha.ds.forEach(function (o) { if (String(o[cotId]) === String(cha[cotId])) cu = o; });
    var ban = {};
    ctCha.cot.forEach(function (c) { ban[c] = cha[c] !== undefined ? cha[c] : (cu ? cu[c] : ''); });
    ban.cap_nhat_luc = bayGio;
    var dong = dCha.dau.map(function (c) { return c ? giaTriGhi_(ctCha, c, ban[c]) : ''; });
    var r = cu ? dCha.sh.getRange(cu._dong, 1, 1, dong.length) : dCha.sh.getRange(dCha.sh.getLastRow() + 1, 1, 1, dong.length);
    r.setNumberFormat('@');
    r.setValues([dong]);

    var soCu = xoaDongCon_(tenCon, ctCon.con, cha[cotId]);
    var dCon = docSheet_(tenCon);
    if (dsCon.length) {
      var mang = dsCon.map(function (o) {
        o[ctCon.con] = cha[cotId];
        return dCon.dau.map(function (c) { return c ? giaTriGhi_(ctCon, c, o[c]) : ''; });
      });
      var r2 = dCon.sh.getRange(dCon.sh.getLastRow() + 1, 1, mang.length, dCon.dau.length);
      r2.setNumberFormat('@');
      r2.setValues(mang);
    }
    ghiLichSu_([[bayGio, cu ? 'SUA' : 'THEM', tenCha, String(cha[cotId]),
      cu ? JSON.stringify(bo_(cu)) : '', JSON.stringify({ banGhi: bo_(ban), soDongCon: dsCon.length, soDongConCu: soCu })]]);
    SpreadsheetApp.flush();
    return { banGhi: bo_(ban), soDongCon: dsCon.length };
  })();
}

function xoaCha_(tenCha, tenCon, id) {
  if (!id) throw loi_('Thiếu id.');
  return voiKhoa_(function () { return xoaChaKhongKhoa_(tenCha, tenCon, id); });
}

/** Phần thân của xoaCha_ (gọi khi đã giữ khóa). */
function xoaChaKhongKhoa_(tenCha, tenCon, id) {
  return (function () {
    var bayGio = new Date().toISOString();
    var dCha = docSheet_(tenCha);
    var cu = null;
    dCha.ds.forEach(function (o) { if (String(o.id) === String(id)) cu = o; });
    if (cu) dCha.sh.deleteRow(cu._dong);
    var soCon = xoaDongCon_(tenCon, CAU_TRUC[tenCon].con, id);
    ghiLichSu_([[bayGio, 'XOA', tenCha, String(id), cu ? JSON.stringify(bo_(cu)) : '', JSON.stringify({ soDongConDaXoa: soCon })]]);
    SpreadsheetApp.flush();
    return cu ? 1 : 0;
  })();
}

/** Xóa mọi dòng con thuộc id (gom các đoạn liên tiếp để xóa nhanh). */
function xoaDongCon_(tenCon, cotCha, id) {
  var d = docSheet_(tenCon);
  var dong = d.ds.filter(function (o) { return String(o[cotCha]) === String(id); })
    .map(function (o) { return o._dong; }).sort(function (a, b) { return b - a; });
  var i = 0;
  while (i < dong.length) {
    var cuoi = dong[i], dau = cuoi;
    while (i + 1 < dong.length && dong[i + 1] === dau - 1) { i++; dau = dong[i]; }
    d.sh.deleteRows(dau, cuoi - dau + 1);
    i++;
  }
  return dong.length;
}

function ghiLichSu_(dong) {
  if (!dong.length) return;
  var sh = laySheet_('LICH_SU');
  var r = sh.getRange(sh.getLastRow() + 1, 1, dong.length, dong[0].length);
  r.setNumberFormat('@');
  r.setValues(dong);
}

// ============ v1.2: người dùng ============

function chuanTen_(ten) {
  return String(ten === undefined || ten === null ? '' : ten).replace(/\s+/g, ' ').trim();
}

function timNguoi_(ten) {
  var t = chuanTen_(ten).toLowerCase();
  var kq = null;
  docSheet_('NGUOI_DUNG').ds.forEach(function (o) { if (chuanTen_(o.ten).toLowerCase() === t) kq = o; });
  return kq;
}

/** Tên phải có trong danh sách và đang dùng. Trả về tên đúng như đã lưu. */
function nguoiHopLe_(ten) {
  var t = chuanTen_(ten);
  if (!t) throw loi_('Chưa chọn tên người dùng. Bấm "👤" ở góc trên để chọn tên.');
  var o = timNguoi_(t);
  if (!o || o.dang_dung === 'khong') throw loi_('Tên "' + t + '" không có trong danh sách người dùng (hoặc đã bị ẩn). Chọn lại tên.');
  return o.ten;
}

/** Ai cũng tự thêm được tên mình (không cần mật khẩu). Không cho trùng tên. */
function themNguoi_(ten) {
  var t = chuanTen_(ten);
  if (!t) throw loi_('Tên trống.');
  if (t.length > 40) throw loi_('Tên tối đa 40 ký tự.');
  return voiKhoa_(function () {
    var cu = timNguoi_(t);
    if (cu && cu.dang_dung === 'khong') throw loi_('Tên "' + cu.ten + '" đã bị ẩn. Nhờ người có mật khẩu bật lại, hoặc chọn tên khác.');
    if (cu) throw loi_('Tên "' + cu.ten + '" đã có — hãy chọn trong danh sách.');
    var bayGio = new Date().toISOString();
    var d = docSheet_('NGUOI_DUNG');
    var ban = { ten: t, dang_dung: 'co', thu_tu: d.ds.length + 1, tao_luc: bayGio, cap_nhat_luc: bayGio };
    ghiDongMoi_(d, 'NGUOI_DUNG', ban);
    ghiLichSu_([[bayGio, 'THEM', 'NGUOI_DUNG', t, '', JSON.stringify(ban)]]);
    SpreadsheetApp.flush();
    return ban;
  });
}

/** Đổi tên người dùng (cần mật khẩu): đổi luôn chủ của các bảng tính. */
function doiTenNguoi_(tenCu, tenMoi) {
  var cuT = chuanTen_(tenCu), moiT = chuanTen_(tenMoi);
  if (!cuT || !moiT) throw loi_('Thiếu tên cũ / tên mới.');
  return voiKhoa_(function () {
    var cu = timNguoi_(cuT);
    if (!cu) throw loi_('Không thấy tên "' + cuT + '".');
    var trung = timNguoi_(moiT);
    if (trung && trung._dong !== cu._dong) throw loi_('Tên "' + moiT + '" đã có.');
    var bayGio = new Date().toISOString();
    var d = docSheet_('NGUOI_DUNG');
    var ban = bo_(cu); ban.ten = moiT; ban.cap_nhat_luc = bayGio;
    ghiDongCu_(d, 'NGUOI_DUNG', cu._dong, ban);
    var soBang = 0;
    Object.keys(SAN).forEach(function (k) {
      var dc = docSheet_(SAN[k].cha);
      dc.ds.forEach(function (o) {
        if (o.nguoi_tao === cu.ten) { var b = bo_(o); b.nguoi_tao = moiT; ghiDongCu_(dc, SAN[k].cha, o._dong, b); soBang++; }
      });
    });
    var dCu = docSheet_('BANG_TINH');
    dCu.ds.forEach(function (o) {
      if (o.da_nhan_boi === cu.ten) { var b = bo_(o); b.da_nhan_boi = moiT; ghiDongCu_(dCu, 'BANG_TINH', o._dong, b); }
    });
    ghiLichSu_([[bayGio, 'SUA', 'NGUOI_DUNG', cu.ten, JSON.stringify(bo_(cu)), JSON.stringify({ banGhi: ban, soBangTinhDoiChu: soBang })]]);
    SpreadsheetApp.flush();
    return ban;
  });
}

function ghiDongMoi_(d, ten, ban) {
  var ct = CAU_TRUC[ten];
  var dong = d.dau.map(function (c) { return c ? giaTriGhi_(ct, c, ban[c]) : ''; });
  var r = d.sh.getRange(d.sh.getLastRow() + 1, 1, 1, dong.length);
  r.setNumberFormat('@');
  r.setValues([dong]);
}

function ghiDongCu_(d, ten, soDong, ban) {
  var ct = CAU_TRUC[ten];
  var dong = d.dau.map(function (c) { return c ? giaTriGhi_(ct, c, ban[c]) : ''; });
  var r = d.sh.getRange(soDong, 1, 1, dong.length);
  r.setNumberFormat('@');
  r.setValues([dong]);
}

// ============ v1.2: bảng tính riêng theo người + sàn ============

function sanHopLe_(san) {
  var k = String(san || '').toUpperCase();
  if (!SAN[k]) throw loi_('Sàn không hợp lệ: ' + san + ' (chỉ TIKTOK / SHOPEE).');
  return k;
}

/** Danh sách bảng của ĐÚNG người này trên sàn này (không trả bảng của người khác). */
function dsBangTinhCuaNguoi_(nguoi, san) {
  var ten = nguoiHopLe_(nguoi);
  var k = sanHopLe_(san);
  return docSheet_(SAN[k].cha).ds.filter(function (o) { return o.nguoi_tao === ten; }).map(bo_);
}

function bangCuaNguoi_(ten, k, id) {
  if (!id) throw loi_('Thiếu id.');
  var kq = null;
  docSheet_(SAN[k].cha).ds.forEach(function (o) { if (String(o.id) === String(id)) kq = o; });
  if (kq && kq.nguoi_tao !== ten) throw loi_('Không phải bảng tính của bạn.');
  return kq;
}

function docBangTinhCuaNguoi_(nguoi, san, id) {
  var ten = nguoiHopLe_(nguoi);
  var k = sanHopLe_(san);
  if (!bangCuaNguoi_(ten, k, id)) throw loi_('Không thấy bảng tính này (có thể đã bị xóa).');
  return docCon_(SAN[k].con, id);
}

function luuBangTinhCuaNguoi_(nguoi, san, bangTinh, dong) {
  var ten = nguoiHopLe_(nguoi);
  var k = sanHopLe_(san);
  if (!bangTinh || !bangTinh.id) throw loi_('Thiếu id bảng tính.');
  if (!chuanTen_(bangTinh.ten)) throw loi_('Bảng tính chưa có tên.');
  return voiKhoa_(function () {
    var cu = bangCuaNguoi_(ten, k, bangTinh.id); // bảng của người khác → báo lỗi
    var bayGio = new Date().toISOString();
    var cha = {
      id: String(bangTinh.id), ten: chuanTen_(bangTinh.ten), nguoi_tao: ten, san: k,
      gian_hien_thi: bangTinh.gian_hien_thi || '', so_dong: dong.length,
      nguon_cu: cu ? cu.nguon_cu : '', tao_luc: cu && cu.tao_luc ? cu.tao_luc : bayGio,
    };
    return luuChaKhongKhoa_(SAN[k].cha, cha, SAN[k].con, dong, 'id');
  });
}

function doiTenBangTinhCuaNguoi_(nguoi, san, id, tenMoi) {
  var ten = nguoiHopLe_(nguoi);
  var k = sanHopLe_(san);
  var t = chuanTen_(tenMoi);
  if (!t) throw loi_('Tên bảng tính trống.');
  return voiKhoa_(function () {
    var cu = bangCuaNguoi_(ten, k, id);
    if (!cu) throw loi_('Không thấy bảng tính này.');
    var bayGio = new Date().toISOString();
    var ban = bo_(cu); ban.ten = t; ban.cap_nhat_luc = bayGio;
    ghiDongCu_(docSheet_(SAN[k].cha), SAN[k].cha, cu._dong, ban);
    ghiLichSu_([[bayGio, 'SUA', SAN[k].cha, String(id), JSON.stringify(bo_(cu)), JSON.stringify(ban)]]);
    SpreadsheetApp.flush();
    return ban;
  });
}

function xoaBangTinhCuaNguoi_(nguoi, san, id) {
  var ten = nguoiHopLe_(nguoi);
  var k = sanHopLe_(san);
  return voiKhoa_(function () {
    if (!bangCuaNguoi_(ten, k, id)) return 0;
    return xoaChaKhongKhoa_(SAN[k].cha, SAN[k].con, id);
  });
}

/** Bảng cũ (sheet BANG_TINH, trước v1.2) chưa có người nhận — chỉ thông tin đầu bảng. */
function dsBangTinhCu_() {
  return docSheet_('BANG_TINH').ds.filter(function (o) { return !o.da_nhan_boi; }).map(function (o) {
    return { id: o.id, ten: o.ten, so_dong: o.so_dong, gian_hien_thi: o.gian_hien_thi, cap_nhat_luc: o.cap_nhat_luc };
  });
}

function docBangTinhCu_(id) {
  if (!id) throw loi_('Thiếu id.');
  var cu = null;
  docSheet_('BANG_TINH').ds.forEach(function (o) { if (String(o.id) === String(id)) cu = o; });
  if (!cu || cu.da_nhan_boi) return [];
  return docCon_('BANG_TINH_DONG', id);
}

/** Nhận 1 bảng cũ: chép sang sheet của sàn đã chọn, chủ = người nhận. Bảng cũ vẫn giữ nguyên (chỉ đánh dấu đã nhận). */
function nhanBangTinhCu_(nguoi, san, id) {
  var ten = nguoiHopLe_(nguoi);
  var k = sanHopLe_(san);
  if (!id) throw loi_('Thiếu id.');
  return voiKhoa_(function () {
    var dCu = docSheet_('BANG_TINH');
    var cu = null;
    dCu.ds.forEach(function (o) { if (String(o.id) === String(id)) cu = o; });
    if (!cu) throw loi_('Không thấy bảng cũ này.');
    if (cu.da_nhan_boi) throw loi_('Bảng này đã có người nhận.');
    var dong = docCon_('BANG_TINH_DONG', id).sort(function (a, b) { return (a.stt || 0) - (b.stt || 0); })
      .map(function (o) { return { stt: o.stt, ten: o.ten, phan_loai: o.phan_loai, nganh: o.nganh, gia_von: o.gia_von, gia_ban: o.gia_ban }; });
    var bayGio = new Date().toISOString();
    var idMoi = String(id);
    var trung = false;
    docSheet_(SAN[k].cha).ds.forEach(function (o) { if (String(o.id) === idMoi) trung = true; });
    if (trung) idMoi = idMoi + '_' + k.toLowerCase();
    var cha = {
      id: idMoi, ten: cu.ten || ('Bảng cũ ' + id), nguoi_tao: ten, san: k, gian_hien_thi: cu.gian_hien_thi || '',
      so_dong: dong.length, nguon_cu: String(id), tao_luc: cu.cap_nhat_luc || bayGio,
    };
    var kq = luuChaKhongKhoa_(SAN[k].cha, cha, SAN[k].con, dong, 'id');
    var danhDau = bo_(cu); danhDau.da_nhan_boi = ten; danhDau.nhan_vao_san = k; danhDau.nhan_luc = bayGio;
    ghiDongCu_(docSheet_('BANG_TINH'), 'BANG_TINH', cu._dong, danhDau);
    ghiLichSu_([[bayGio, 'NHAN', 'BANG_TINH', String(id), JSON.stringify(bo_(cu)), JSON.stringify({ nguoi: ten, san: k, idMoi: idMoi })]]);
    SpreadsheetApp.flush();
    return kq.banGhi;
  });
}

/** Chạy tay 1 lần trong trình soạn thảo Apps Script để tạo sẵn các sheet. */
function taoCacSheet() {
  Object.keys(CAU_TRUC).forEach(laySheet_);
}
