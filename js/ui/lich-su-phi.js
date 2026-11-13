// Khối "🕘 Lịch sử sửa phí" ở cuối tab Bảng phí (Shopee / TikTok): ai sửa ô nào, lúc nào, cũ → mới.
// Chỉ tải từ Apps Script khi mở khối; tải lại sau mỗi lần lưu / xóa phí trên máy này hoặc khi bấm "Tải lại".
import { h, thayNoiDung } from './dom.js';
import * as kho from '../data/kho.js';
import { hienThiThang } from '../core/phi.js';
import { dinhDangSo } from '../core/so.js';

const GIOI_HAN = 300;
const TRANG_THAI = {}; // nenTang → { mo, chiGian, chiThang, du, loi, dangTai }

/** Giá trị ô lưu dạng chữ thô ("9.3", "3000") → "9,3", "3.000"; trống → "—". */
export const hienThiGiaTri = (v) => (v === '' || v === null || v === undefined ? '—' : Number.isFinite(Number(v)) ? dinhDangSo(Number(v)) : String(v));

const HANH_DONG = { THEM: ['Thêm', 'nhan-xanh'], SUA: ['Sửa', 'nhan-vang'], XOA: ['Xóa', 'nhan-do'] };

/** "2026-11-07 09:15:02" hoặc ISO → "07/11/2026 09:15" */
export function hienThiThoiGian(x) {
  const m = String(x || '').match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(x || '—');
}

function trangThai(nenTang) {
  if (!TRANG_THAI[nenTang]) {
    TRANG_THAI[nenTang] = { mo: false, chiGian: true, chiThang: false, du: null, loi: '', dangTai: false };
    // lưu / xóa phí trên máy này → lịch sử cũ không còn đúng, lần vẽ sau tải lại
    kho.dangKy((_, ct) => { if (ct.duLieuDoi && ct.nguon === 'ghi') TRANG_THAI[nenTang].du = null; });
  }
  return TRANG_THAI[nenTang];
}

/**
 * @param {object} p { nenTang: 'shopee'|'tiktok', gian: gian đang xem, thang: tháng đang xem }
 */
export function veLichSuPhi({ nenTang, gian, thang }) {
  const t = trangThai(nenTang);
  const noiDung = h('div', { class: 'lich-su-phi' });
  const ve = () => {
    const ds = (t.du || []).filter((x) => (!t.chiGian || x.gian === gian) && (!t.chiThang || x.thang === thang));
    const hop = (nhan, khoa) => h('label', { class: 'hop-kiem hop-kiem-ngang' },
      h('input', { type: 'checkbox', checked: t[khoa], onchange: (e) => { t[khoa] = e.target.checked; ve(); } }), ` ${nhan}`);
    thayNoiDung(noiDung,
      h('div', { class: 'hang' },
        hop(`Chỉ gian ${gian}`, 'chiGian'), hop(`Chỉ tháng ${hienThiThang(thang)}`, 'chiThang'),
        h('span', { class: 'gian-cach' }),
        h('button', { type: 'button', class: 'nut nut-nho', disabled: t.dangTai, onclick: () => tai(true) }, t.dangTai ? 'Đang tải…' : '↻ Tải lại')),
      t.loi ? h('div', { class: 'ghi-chu ghi-chu-vang' }, `Không tải được lịch sử: ${t.loi}`)
        : t.du === null ? h('p', { class: 'chu-nhat' }, 'Đang tải lịch sử…')
          : !ds.length ? h('p', { class: 'chu-nhat' }, 'Chưa có lần sửa nào khớp bộ lọc.')
            : h('div', { class: 'khung-bang khung-bang-vua' }, h('table', { class: 'bang bang-lich-su' },
              h('thead', null, h('tr', null, ['Thời gian', 'Người sửa', '', 'Tháng', 'Gian', 'Ngành', 'Khoản phí', 'Cũ → mới'].map((c) => h('th', { scope: 'col' }, c)))),
              h('tbody', null, ds.map((x) => {
                const [chu, lop] = HANH_DONG[x.hanh_dong] || [x.hanh_dong, 'nhan-tim'];
                return h('tr', null,
                  h('td', { class: 'chu-nhat' }, hienThiThoiGian(x.thoi_gian)),
                  h('td', null, h('b', null, x.nguoi_dung || '—')),
                  h('td', null, h('span', { class: ['nhan-nho', lop] }, chu)),
                  h('td', null, hienThiThang(x.thang)),
                  h('td', null, x.gian),
                  h('td', null, x.nganh),
                  h('td', null, x.o),
                  h('td', { class: 'so' }, hienThiGiaTri(x.gia_tri_cu), ' → ', h('b', null, hienThiGiaTri(x.gia_tri_moi))));
              })))),
      t.du && t.du.length >= GIOI_HAN ? h('p', { class: 'goi-y' }, `Hiện ${GIOI_HAN} lần sửa gần nhất. Lịch sử đầy đủ ở Google Sheets (sheet ${nenTang === 'shopee' ? 'LICH_SU_BANG_PHI_SHOPEE' : 'LICH_SU_BANG_PHI'}).`) : null);
  };
  const tai = async (ep) => {
    if (t.dangTai || (t.du && !ep)) { ve(); return; }
    t.dangTai = true; t.loi = '';
    ve();
    try { t.du = await kho.docLichSuPhi(nenTang, { gioiHan: GIOI_HAN }); } catch (e) { t.loi = e.message; t.du = []; }
    t.dangTai = false;
    if (noiDung.isConnected) ve();
  };
  const khoi = h('details', { class: 'the the-phu khoi-lich-su', open: t.mo, ontoggle: () => { t.mo = khoi.open; if (t.mo) tai(false); } },
    h('summary', null, '🕘 Lịch sử sửa phí'), noiDung);
  if (t.mo) tai(false);
  return khoi;
}
