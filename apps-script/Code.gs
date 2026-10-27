/**
 * Apps Script cho app "Bảng giá & Lợi nhuận".
 * Dán toàn bộ file này vào Extensions → Apps Script của Google Sheets, rồi Deploy → Web App.
 *
 * - GET ?action=ping (không cần đăng nhập). Mọi lệnh khác: POST (Content-Type text/plain) body JSON { action, token, ... }
 * - Đăng nhập: POST { action: 'dangNhap', ten, matKhau } → token (giữ 6 giờ trong CacheService).
 *   Tài khoản ở sheet TAI_KHOAN: mật khẩu lưu dạng hash SHA-256 + salt, không lưu mật khẩu thô.
 * - Vai trò: admin (xem + sửa tất cả, quản lý tài khoản); shopee / tiktok: xem dữ liệu nền tảng của mình và
 *   SỬA bảng phí + danh mục gian của đúng nền tảng đó (QUYEN_GHI). Không đụng được nền tảng kia.
 *   Quyền được kiểm tra ở đây cho MỌI lệnh đọc và ghi, không dựa vào giao diện.
 * - Tạo admin đầu tiên: đặt Script properties SETUP_ADMIN_TEN + SETUP_ADMIN_MAT_KHAU rồi chạy tay hàm taoAdminDauTien().
 * - Mọi thay đổi ghi vào sheet LICH_SU (kèm người sửa); riêng bảng phí ghi thêm từng ô vào LICH_SU_BANG_PHI
 *   (TikTok) và LICH_SU_BANG_PHI_SHOPEE (Shopee).
 */

var PHIEN_BAN = '2.1.0';

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
  // Bảng phí Shopee: riêng hoàn toàn với BANG_PHI (TikTok)
  BANG_PHI_SHOPEE: {
    cot: ['gian', 'nganh', 'thang', 'phi_co_dinh', 'voucher_xtra', 'phi_ha_tang', 'phi_xu_ly', 'phi_dich_vu', 'quang_cao', 'voucher_shop', 'aff', 'phi_hoan_vcktc', 'cap_nhat_luc'],
    khoa: ['gian', 'nganh', 'thang'],
    so: ['phi_co_dinh', 'voucher_xtra', 'phi_ha_tang', 'phi_xu_ly', 'phi_dich_vu', 'quang_cao', 'voucher_shop', 'aff', 'phi_hoan_vcktc'],
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
    cot: ['id', 'ten', 'gian_hien_thi', 'thang_phi', 'so_dong', 'cap_nhat_luc'],
    khoa: ['id'], so: ['so_dong'],
  },
  BANG_TINH_DONG: {
    cot: ['bang_tinh_id', 'stt', 'ten', 'phan_loai', 'nganh', 'gia_von', 'gia_ban'],
    khoa: ['bang_tinh_id', 'stt'], so: ['stt', 'gia_von', 'gia_ban'],
    con: 'bang_tinh_id',
  },
  LICH_SU: {
    cot: ['thoi_gian', 'hanh_dong', 'sheet', 'khoa', 'du_lieu_cu', 'du_lieu_moi', 'nguoi_dung'],
    khoa: [], so: [],
  },
  LICH_SU_BANG_PHI: {
    cot: ['thoi_gian', 'hanh_dong', 'thang', 'gian', 'nganh', 'o', 'gia_tri_cu', 'gia_tri_moi', 'nguoi_dung'],
    khoa: [], so: [],
  },
  LICH_SU_BANG_PHI_SHOPEE: {
    cot: ['thoi_gian', 'hanh_dong', 'thang', 'gian', 'nganh', 'o', 'gia_tri_cu', 'gia_tri_moi', 'nguoi_dung'],
    khoa: [], so: [],
  },
  // Tài khoản: KHÔNG bao giờ trả về trình duyệt cột salt / hash. Không nằm trong SHEET_GHI / SHEET_DOC.
  TAI_KHOAN: {
    cot: ['ten_dang_nhap', 'vai_tro', 'salt', 'hash', 'tao_luc', 'cap_nhat_luc'],
    khoa: ['ten_dang_nhap'], so: [],
  },
};

// Sheet được phép upsert / xóa trực tiếp
var SHEET_GHI = ['DANH_MUC', 'BANG_PHI', 'BANG_PHI_SHOPEE', 'GIA_VON', 'NOI_SKU', 'CAMPAIGN'];
// Sheet trả về trong docTatCa
var SHEET_DOC = ['DANH_MUC', 'BANG_PHI', 'BANG_PHI_SHOPEE', 'GIA_VON', 'NOI_SKU', 'CAMPAIGN', 'BANG_TINH'];

var SAI_TOI_DA = 5;          // đăng nhập sai quá số lần này (theo tên đăng nhập) ...
var KHOA_GIAY = 10 * 60;     // ... thì khóa 10 phút
var PHIEN_GIAY = 6 * 60 * 60; // token hết hạn sau 6 giờ (tối đa của CacheService)
var SO_VONG_HASH = 500;       // SHA-256 lặp lại để dò mật khẩu chậm hơn
var VAI_TRO = ['admin', 'shopee', 'tiktok'];

// Dữ liệu mỗi vai trò được ĐỌC. DANH_MUC chỉ trả các loại danh mục của nền tảng đó.
var QUYEN_DOC = {
  admin: { sheet: SHEET_DOC, danhMuc: null },
  shopee: { sheet: ['DANH_MUC', 'BANG_PHI_SHOPEE', 'BANG_TINH'], danhMuc: ['GIAN_SHOPEE'] },
  tiktok: { sheet: ['DANH_MUC', 'BANG_PHI', 'GIA_VON', 'NOI_SKU', 'CAMPAIGN', 'BANG_TINH'], danhMuc: ['GIAN', 'NGANH'] },
};

// Dữ liệu vai trò không phải admin được GHI (upsert / xoa): bảng phí + loại danh mục của đúng nền tảng.
// Mọi lệnh ghi khác (bảng tính, campaign, giá vốn, tài khoản…) chỉ admin.
var QUYEN_GHI = {
  shopee: { sheet: ['BANG_PHI_SHOPEE'], danhMuc: ['GIAN_SHOPEE'] },
  tiktok: { sheet: ['BANG_PHI'], danhMuc: ['GIAN', 'NGANH'] },
};

var NGUOI_DUNG_ = ''; // người đang gọi (ghi vào lịch sử)

var TEN_O_PHI = {
  phi_san: 'Phí sàn (%)', phi_vc: 'Phí bồi hoàn V/C (đ)', phi_xl: 'Phí xử lý đơn hàng (đ)',
  phi_qc: 'Chi phí QC (%)', aff_qc: 'AFF có QC (%)', aff_noqc: 'AFF không QC (%)',
};

var TEN_O_PHI_SHOPEE = {
  phi_co_dinh: 'Phí cố định (%)', voucher_xtra: 'Voucher Xtra (%)', phi_ha_tang: 'Phí hạ tầng (đ)',
  phi_xu_ly: 'Phí xử lý (%)', phi_dich_vu: 'Phí dịch vụ (%)', quang_cao: 'Quảng cáo (%)',
  voucher_shop: 'Voucher shop (%)', aff: 'AFF (%)', phi_hoan_vcktc: 'Phí hoàn V/C KTC (%)',
};

// Sheet bảng phí → sheet lịch sử từng ô + tên các ô
var LICH_SU_PHI = {
  BANG_PHI: { sheet: 'LICH_SU_BANG_PHI', tenO: TEN_O_PHI },
  BANG_PHI_SHOPEE: { sheet: 'LICH_SU_BANG_PHI_SHOPEE', tenO: TEN_O_PHI_SHOPEE },
};

// ============ Điểm vào ============

function doGet(e) {
  return xuLy_(function () {
    var p = (e && e.parameter) || {};
    if (p.action === 'ping') return { phienBan: PHIEN_BAN, daCoAdmin: daCoAdmin_() };
    throw loi_('Cần đăng nhập. Phiên bản app cũ — tải lại trang.', 'CAN_DANG_NHAP');
  });
}

function doPost(e) {
  return xuLy_(function () {
    var body;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (x) { throw loi_('Dữ liệu gửi lên không phải JSON.'); }
    if (body.action === 'dangNhap') return dangNhap_(body.ten, body.matKhau);
    var phien = xacThuc_(body.token);
    NGUOI_DUNG_ = phien.ten;
    switch (body.action) {
      // --- mọi vai trò ---
      case 'phien': return { ten: phien.ten, vaiTro: phien.vaiTro };
      case 'dangXuat': CacheService.getScriptCache().remove('phien_' + body.token); return {};
      case 'docTatCa': return { duLieu: docTatCa_(phien.vaiTro) };
      case 'docBangTinh': canDoc_(phien, 'BANG_TINH'); return { duLieu: docCon_('BANG_TINH_DONG', body.id) };
      case 'docCampaignKQ': canDoc_(phien, 'CAMPAIGN'); return { duLieu: docCon_('CAMPAIGN_KQ', body.id) };
    }
    // --- ghi bảng phí / danh mục: admin, hoặc vai trò của ĐÚNG nền tảng (kiểm tra từng bản ghi) ---
    switch (body.action) {
      case 'upsert':
        canGhi_(phien, body.sheet, (body.banGhi || []).map(function (b) { return b ? b.loai : undefined; }));
        return { banGhi: upsert_(body.sheet, body.banGhi || []) };
      case 'xoa':
        canGhi_(phien, body.sheet, (body.khoa || []).map(loaiCuaKhoa_));
        return { daXoa: xoa_(body.sheet, body.khoa || []) };
    }
    // --- chỉ admin: bảng tính, campaign + quản lý tài khoản ---
    canAdmin_(phien);
    switch (body.action) {
      case 'luuCampaign': return luuCha_('CAMPAIGN', body.campaign, 'CAMPAIGN_KQ', body.ketQua || [], 'id');
      case 'luuBangTinh': return luuCha_('BANG_TINH', body.bangTinh, 'BANG_TINH_DONG', body.dong || [], 'id');
      case 'xoaBangTinh': return { daXoa: xoaCha_('BANG_TINH', 'BANG_TINH_DONG', body.id) };
      case 'dsTaiKhoan': return { taiKhoan: dsTaiKhoan_() };
      case 'themTaiKhoan': return { taiKhoan: themTaiKhoan_(body.ten, body.matKhau, body.vaiTro) };
      case 'xoaTaiKhoan': return { daXoa: xoaTaiKhoan_(phien, body.ten) };
      case 'doiMatKhau': return { taiKhoan: doiMatKhau_(body.ten, body.matKhau) };
      case 'doiVaiTro': return { taiKhoan: doiVaiTro_(phien, body.ten, body.vaiTro) };
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
    if (x && x.ma) kq.ma = x.ma;
  }
  return ContentService.createTextOutput(JSON.stringify(kq)).setMimeType(ContentService.MimeType.JSON);
}

/** ma: 'CAN_DANG_NHAP' (chưa đăng nhập / token hết hạn) | 'KHONG_CO_QUYEN' */
function loi_(thongBao, ma) {
  var x = new Error(thongBao);
  x.laLoiNguoiDung = true;
  if (ma) x.ma = ma;
  return x;
}

// ============ Đăng nhập, phiên, quyền ============

function chuanTen_(ten) {
  return String(ten === undefined || ten === null ? '' : ten).trim().toLowerCase();
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** SHA-256(salt + mật khẩu), lặp SO_VONG_HASH lần. Lưu dạng "sha256$<số vòng>$<hex>". */
function bamMatKhau_(salt, matKhau, soVong) {
  var h = String(matKhau);
  for (var i = 0; i < soVong; i++) {
    h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + h, Utilities.Charset.UTF_8));
  }
  return 'sha256$' + soVong + '$' + h;
}

function khopMatKhau_(tk, matKhau) {
  var phan = String(tk.hash || '').split('$');
  var soVong = Number(phan[1]) || SO_VONG_HASH;
  return soSanhAnToan_(bamMatKhau_(String(tk.salt), matKhau, soVong), String(tk.hash));
}

function taoSalt_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function kiemTraMatKhauMoi_(matKhau) {
  if (typeof matKhau !== 'string' || matKhau.length < 8) throw loi_('Mật khẩu phải có ít nhất 8 ký tự.');
  if (matKhau.length > 200) throw loi_('Mật khẩu quá dài.');
}

function timTaiKhoan_(ten) {
  var t = chuanTen_(ten);
  var tk = null;
  docSheet_('TAI_KHOAN').ds.forEach(function (o) { if (chuanTen_(o.ten_dang_nhap) === t) tk = o; });
  return tk;
}

function daCoAdmin_() {
  return docSheet_('TAI_KHOAN').ds.some(function (o) { return o.vai_tro === 'admin'; });
}

function dangNhap_(ten, matKhau) {
  var t = chuanTen_(ten);
  if (!t || !matKhau) throw loi_('Nhập tên đăng nhập và mật khẩu.');
  if (t.length > 64) throw loi_('Sai tên đăng nhập hoặc mật khẩu.');
  var cache = CacheService.getScriptCache();
  var khoaSai = 'sai_dn_' + t;
  var soLanSai = Number(cache.get(khoaSai) || 0);
  if (soLanSai >= SAI_TOI_DA) throw loi_('Đăng nhập sai quá ' + SAI_TOI_DA + ' lần. Tài khoản tạm khóa 10 phút.');
  var tk = timTaiKhoan_(t);
  // Không có tài khoản vẫn băm 1 lần để thời gian trả lời giống nhau
  var dung = tk ? khopMatKhau_(tk, String(matKhau)) : (bamMatKhau_('x', String(matKhau), SO_VONG_HASH), false);
  if (!dung || VAI_TRO.indexOf(tk.vai_tro) < 0) {
    cache.put(khoaSai, String(soLanSai + 1), KHOA_GIAY);
    throw loi_('Sai tên đăng nhập hoặc mật khẩu.');
  }
  cache.remove(khoaSai);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('phien_' + token, t, PHIEN_GIAY);
  return { token: token, ten: t, vaiTro: tk.vai_tro, hetHanSau: PHIEN_GIAY };
}

/** Token → { ten, vaiTro }. Vai trò đọc lại từ TAI_KHOAN mỗi lần: xóa / đổi vai trò có hiệu lực ngay. */
function xacThuc_(token) {
  if (!token || typeof token !== 'string') throw loi_('Cần đăng nhập.', 'CAN_DANG_NHAP');
  var ten = CacheService.getScriptCache().get('phien_' + token);
  var tk = ten ? timTaiKhoan_(ten) : null;
  if (!tk || VAI_TRO.indexOf(tk.vai_tro) < 0) throw loi_('Phiên đăng nhập đã hết hạn. Đăng nhập lại.', 'CAN_DANG_NHAP');
  return { ten: chuanTen_(tk.ten_dang_nhap), vaiTro: tk.vai_tro };
}

function canAdmin_(phien) {
  if (phien.vaiTro !== 'admin') throw loi_('Tài khoản "' + phien.ten + '" (' + phien.vaiTro + ') không được làm việc này (chỉ admin).', 'KHONG_CO_QUYEN');
}

/**
 * Quyền ghi (upsert / xoa) vào sheet. admin: mọi sheet ghi được. shopee / tiktok: chỉ sheet bảng phí của mình,
 * hoặc DANH_MUC khi MỌI bản ghi / khóa thuộc loại danh mục của mình (dsLoai = loại của từng bản ghi / khóa).
 */
function canGhi_(phien, sheet, dsLoai) {
  if (phien.vaiTro === 'admin') return;
  var q = QUYEN_GHI[phien.vaiTro];
  if (q && q.sheet.indexOf(sheet) >= 0) return;
  if (q && sheet === 'DANH_MUC' && dsLoai.length && dsLoai.every(function (l) { return q.danhMuc.indexOf(String(l)) >= 0; })) return;
  throw loi_('Tài khoản "' + phien.ten + '" (' + phien.vaiTro + ') không được sửa dữ liệu này.', 'KHONG_CO_QUYEN');
}

/** Loại danh mục của 1 khóa xóa: chuỗi "loai|ten" hoặc object { loai, ten }. */
function loaiCuaKhoa_(k) {
  if (typeof k === 'string') return k.split('|')[0];
  return k ? k.loai : undefined;
}

function canDoc_(phien, sheet) {
  if (QUYEN_DOC[phien.vaiTro].sheet.indexOf(sheet) < 0) throw loi_('Tài khoản "' + phien.ten + '" không được xem dữ liệu này.', 'KHONG_CO_QUYEN');
}

// ============ Quản lý tài khoản (admin) ============

function boMat_(tk) {
  return { ten_dang_nhap: chuanTen_(tk.ten_dang_nhap), vai_tro: tk.vai_tro, tao_luc: tk.tao_luc, cap_nhat_luc: tk.cap_nhat_luc };
}

function dsTaiKhoan_() {
  return docSheet_('TAI_KHOAN').ds.map(boMat_);
}

function kiemTraVaiTro_(vaiTro) {
  if (VAI_TRO.indexOf(vaiTro) < 0) throw loi_('Vai trò phải là: ' + VAI_TRO.join(', ') + '.');
}

/** Ghi 1 tài khoản (thêm hoặc cập nhật) + 1 dòng LICH_SU không chứa salt / hash. */
function ghiTaiKhoan_(ban, hanhDong, moTa) {
  var d = docSheet_('TAI_KHOAN');
  var cu = null;
  d.ds.forEach(function (o) { if (chuanTen_(o.ten_dang_nhap) === ban.ten_dang_nhap) cu = o; });
  var bayGio = new Date().toISOString();
  ban.cap_nhat_luc = bayGio;
  if (!ban.tao_luc) ban.tao_luc = cu ? cu.tao_luc : bayGio;
  var dong = d.dau.map(function (c) { return c ? giaTriGhi_(null, c, ban[c]) : ''; });
  var r = cu ? d.sh.getRange(cu._dong, 1, 1, dong.length) : d.sh.getRange(d.sh.getLastRow() + 1, 1, 1, dong.length);
  r.setNumberFormat('@');
  r.setValues([dong]);
  ghiLichSu_([[bayGio, hanhDong, 'TAI_KHOAN', ban.ten_dang_nhap, cu ? JSON.stringify({ vai_tro: cu.vai_tro }) : '', JSON.stringify(moTa)]]);
  SpreadsheetApp.flush();
  return boMat_(ban);
}

function themTaiKhoan_(ten, matKhau, vaiTro) {
  var t = chuanTen_(ten);
  if (!/^[a-z0-9._-]{3,32}$/.test(t)) throw loi_('Tên đăng nhập 3–32 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -');
  kiemTraVaiTro_(vaiTro);
  kiemTraMatKhauMoi_(matKhau);
  return voiKhoa_(function () {
    if (timTaiKhoan_(t)) throw loi_('Tên đăng nhập "' + t + '" đã có.');
    var salt = taoSalt_();
    return ghiTaiKhoan_({ ten_dang_nhap: t, vai_tro: vaiTro, salt: salt, hash: bamMatKhau_(salt, matKhau, SO_VONG_HASH) },
      'THEM', { vai_tro: vaiTro });
  });
}

function doiMatKhau_(ten, matKhau) {
  kiemTraMatKhauMoi_(matKhau);
  return voiKhoa_(function () {
    var tk = timTaiKhoan_(ten);
    if (!tk) throw loi_('Không có tài khoản "' + chuanTen_(ten) + '".');
    var salt = taoSalt_();
    return ghiTaiKhoan_({ ten_dang_nhap: chuanTen_(tk.ten_dang_nhap), vai_tro: tk.vai_tro, salt: salt, hash: bamMatKhau_(salt, matKhau, SO_VONG_HASH), tao_luc: tk.tao_luc },
      'DOI_MAT_KHAU', { mat_khau: 'đã đổi' });
  });
}

function soAdmin_() {
  return docSheet_('TAI_KHOAN').ds.filter(function (o) { return o.vai_tro === 'admin'; }).length;
}

function doiVaiTro_(phien, ten, vaiTro) {
  kiemTraVaiTro_(vaiTro);
  return voiKhoa_(function () {
    var tk = timTaiKhoan_(ten);
    if (!tk) throw loi_('Không có tài khoản "' + chuanTen_(ten) + '".');
    if (tk.vai_tro === 'admin' && vaiTro !== 'admin') {
      if (chuanTen_(tk.ten_dang_nhap) === phien.ten) throw loi_('Không tự bỏ quyền admin của chính mình.');
      if (soAdmin_() <= 1) throw loi_('Phải còn ít nhất 1 admin.');
    }
    return ghiTaiKhoan_({ ten_dang_nhap: chuanTen_(tk.ten_dang_nhap), vai_tro: vaiTro, salt: tk.salt, hash: tk.hash, tao_luc: tk.tao_luc },
      'DOI_VAI_TRO', { vai_tro: vaiTro });
  });
}

function xoaTaiKhoan_(phien, ten) {
  return voiKhoa_(function () {
    var tk = timTaiKhoan_(ten);
    if (!tk) return 0;
    if (chuanTen_(tk.ten_dang_nhap) === phien.ten) throw loi_('Không tự xóa tài khoản đang đăng nhập.');
    if (tk.vai_tro === 'admin' && soAdmin_() <= 1) throw loi_('Phải còn ít nhất 1 admin.');
    laySheet_('TAI_KHOAN').deleteRow(tk._dong);
    ghiLichSu_([[new Date().toISOString(), 'XOA', 'TAI_KHOAN', chuanTen_(tk.ten_dang_nhap), JSON.stringify({ vai_tro: tk.vai_tro }), '']]);
    SpreadsheetApp.flush();
    return 1;
  });
}

/**
 * CHẠY TAY 1 LẦN trong trình soạn thảo Apps Script để tạo admin đầu tiên:
 *   1. Project Settings → Script properties: thêm SETUP_ADMIN_TEN và SETUP_ADMIN_MAT_KHAU (≥ 8 ký tự).
 *   2. Chọn hàm taoAdminDauTien → Run.
 * Hàm tự xóa 2 thuộc tính đó sau khi chạy. Chỉ chạy được khi CHƯA có admin nào.
 */
function taoAdminDauTien() {
  var props = PropertiesService.getScriptProperties();
  var ten = props.getProperty('SETUP_ADMIN_TEN');
  var matKhau = props.getProperty('SETUP_ADMIN_MAT_KHAU');
  try {
    if (daCoAdmin_()) throw new Error('Đã có admin. Hãy đăng nhập app bằng admin để tạo / đổi tài khoản.');
    if (!ten || !matKhau) throw new Error('Thiếu Script properties SETUP_ADMIN_TEN / SETUP_ADMIN_MAT_KHAU.');
    NGUOI_DUNG_ = 'taoAdminDauTien';
    var tk = themTaiKhoan_(ten, matKhau, 'admin');
    console.log('Đã tạo admin "' + tk.ten_dang_nhap + '". Đăng nhập app bằng tài khoản này.');
    return tk;
  } finally {
    props.deleteProperty('SETUP_ADMIN_MAT_KHAU');
    props.deleteProperty('SETUP_ADMIN_TEN');
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

/** Các dòng lịch sử từng ô của 1 bộ phí (gian × ngành × tháng). tenO = TEN_O_PHI | TEN_O_PHI_SHOPEE */
function lichSuBangPhi_(tenO, thoiGian, hanhDong, cu, moi) {
  var goc = moi || cu;
  var dong = [];
  Object.keys(tenO).forEach(function (k) {
    var a = cu ? giaTriGhi_(null, k, cu[k]) : '';
    var b = moi ? giaTriGhi_(null, k, moi[k]) : '';
    if (a !== b) dong.push([thoiGian, hanhDong, String(goc.thang), String(goc.gian), String(goc.nganh), tenO[k], a, b, NGUOI_DUNG_]);
  });
  return dong;
}

function ghiLichSuBangPhi_(tenSheet, dong) {
  if (!dong.length) return;
  var sh = laySheet_(tenSheet);
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

/** Chỉ trả dữ liệu vai trò được xem; sheet không được xem trả mảng rỗng. */
function docTatCa_(vaiTro) {
  var q = QUYEN_DOC[vaiTro];
  var kq = {};
  SHEET_DOC.forEach(function (t) {
    if (q.sheet.indexOf(t) < 0) { kq[t] = []; return; }
    var ds = docSheet_(t).ds.map(bo_);
    if (t === 'DANH_MUC' && q.danhMuc) ds = ds.filter(function (o) { return q.danhMuc.indexOf(o.loai) >= 0; });
    kq[t] = ds;
  });
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
    var lsPhi = LICH_SU_PHI[ten];
    var gioVN = lsPhi ? gioDiaPhuong_() : '';
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
      if (lsPhi) lichSuPhi = lichSuPhi.concat(lichSuBangPhi_(lsPhi.tenO, gioVN, cu ? 'SUA' : 'THEM', cu, ban));
    });
    if (themMoi.length) {
      var r2 = d.sh.getRange(d.sh.getLastRow() + 1, 1, themMoi.length, d.dau.length);
      r2.setNumberFormat('@');
      r2.setValues(themMoi);
    }
    ghiLichSu_(lichSu);
    if (lsPhi) ghiLichSuBangPhi_(lsPhi.sheet, lichSuPhi);
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
    var lsPhi = LICH_SU_PHI[ten];
    var gioVN = lsPhi ? gioDiaPhuong_() : '';
    var dongXoa = d.ds.filter(function (o) { return canXoa[khoaCua_(ct, o)]; });
    // xóa từ dưới lên để số dòng không bị lệch
    dongXoa.sort(function (a, b) { return b._dong - a._dong; }).forEach(function (o) {
      d.sh.deleteRow(o._dong);
      lichSu.push([bayGio, 'XOA', ten, khoaCua_(ct, o), JSON.stringify(bo_(o)), '']);
      if (lsPhi) lichSuPhi = lichSuPhi.concat(lichSuBangPhi_(lsPhi.tenO, gioVN, 'XOA', o, null));
    });
    ghiLichSu_(lichSu);
    if (lsPhi) ghiLichSuBangPhi_(lsPhi.sheet, lichSuPhi);
    SpreadsheetApp.flush();
    return dongXoa.length;
  });
}

/** Lưu 1 bản ghi cha (campaign / bảng tính) + thay toàn bộ dòng con của nó. LICH_SU ghi 1 dòng tóm tắt. */
function luuCha_(tenCha, cha, tenCon, dsCon, cotId) {
  if (!cha || !cha[cotId]) throw loi_('Thiếu ' + cotId + '.');
  var ctCon = CAU_TRUC[tenCon];
  return voiKhoa_(function () {
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
  });
}

function xoaCha_(tenCha, tenCon, id) {
  if (!id) throw loi_('Thiếu id.');
  return voiKhoa_(function () {
    var bayGio = new Date().toISOString();
    var dCha = docSheet_(tenCha);
    var cu = null;
    dCha.ds.forEach(function (o) { if (String(o.id) === String(id)) cu = o; });
    if (cu) dCha.sh.deleteRow(cu._dong);
    var soCon = xoaDongCon_(tenCon, CAU_TRUC[tenCon].con, id);
    ghiLichSu_([[bayGio, 'XOA', tenCha, String(id), cu ? JSON.stringify(bo_(cu)) : '', JSON.stringify({ soDongConDaXoa: soCon })]]);
    SpreadsheetApp.flush();
    return cu ? 1 : 0;
  });
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
  dong = dong.map(function (d) { return d.concat([NGUOI_DUNG_]); });
  var sh = laySheet_('LICH_SU');
  var r = sh.getRange(sh.getLastRow() + 1, 1, dong.length, dong[0].length);
  r.setNumberFormat('@');
  r.setValues(dong);
}

/** Chạy tay 1 lần trong trình soạn thảo Apps Script để tạo sẵn các sheet. */
function taoCacSheet() {
  Object.keys(CAU_TRUC).forEach(laySheet_);
}
