// Tab Giá vốn: xem, nạp file (xem trước thay đổi), sửa, xóa, cảnh báo.
import { h, thayNoiDung, xacNhan, chonFile, ganKeoTha, taiXuong } from './dom.js';
import { thongBao } from './thong-bao.js';
import { manTrong, linhVat, chucMung } from './linh-vat.js';
import { moCaiDat } from './cai-dat.js';
import * as kho from '../data/kho.js';
import { docBangGiaVon, soSanhGiaVon, canhBaoBacVon, khoaVon } from '../core/gia-von.js';
import { docPhanLoai } from '../core/size.js';
import { docSo, dinhDangTien } from '../core/so.js';
import { docBang } from '../excel/doc.js';

const st = { nhom: '', tim: '', dangSua: null };
let goc;

export function taoTabGiaVon(phanTu) {
  goc = phanTu;
  kho.dangKy(() => ve());
  ve();
}

function dienTich(r) {
  const s = docPhanLoai(r.phan_loai);
  return s ? s.rong * s.cao * (s.nhan || 1) : Infinity;
}

function sapXep(ds) {
  const thuTuNhom = new Map();
  ds.forEach((r) => { if (!thuTuNhom.has(r.nhom)) thuTuNhom.set(r.nhom, thuTuNhom.size); });
  return [...ds].sort((a, b) => thuTuNhom.get(a.nhom) - thuTuNhom.get(b.nhom) || dienTich(a) - dienTich(b) || String(a.phan_loai).localeCompare(String(b.phan_loai)));
}

function ngayGio(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function ve() {
  const ds = kho.duLieu().GIA_VON;
  if (!kho.layCaiDat().url && !ds.length) {
    thayNoiDung(goc, manTrong('Chưa kết nối Google Sheets', 'Nhập URL Apps Script và mật khẩu ở Cài đặt để lưu giá vốn dùng chung.',
      h('button', { class: 'nut nut-chinh', onclick: moCaiDat }, '⚙️ Mở Cài đặt')));
    return;
  }
  const nhoms = [...new Set(sapXep(ds).map((r) => r.nhom))];
  if (st.nhom && !nhoms.includes(st.nhom)) st.nhom = '';
  const capNhatCuoi = ds.map((r) => r.cap_nhat_luc).filter(Boolean).sort().at(-1);

  const vungTha = h('button', { class: 'vung-tha', onclick: async () => { const f = await chonFile(); if (f) napFile([f]); } },
    linhVat('nho'),
    h('span', null, h('b', null, 'Thả file giá vốn vào đây'), h('br'), 'hoặc bấm để chọn file .xlsx (cột: Tên sản phẩm | Phân loại | Ngành hàng | Giá vốn | Giá bán)'));
  ganKeoTha(vungTha, napFile);

  thayNoiDung(goc,
    h('div', { class: 'the' },
      h('div', { class: 'the-dau' },
        h('div', null,
          h('h2', null, 'Giá vốn'),
          h('p', { class: 'mo-ta' }, `${ds.length} dòng · ${nhoms.length} nhóm · cập nhật lần cuối ${ngayGio(capNhatCuoi)}`)),
        h('div', { class: 'hang-nut' },
          h('button', { class: 'nut', onclick: taiFileMau }, '📄 Tải file mẫu'),
          h('button', { class: 'nut', onclick: () => xuatExcel(ds), disabled: !ds.length }, '📤 Xuất Excel'))),
      vungTha,
      veCanhBao(ds)),
    ds.length ? veBang(ds, nhoms) : h('div', { class: 'the' }, manTrong('Chưa có giá vốn', 'Thả file giá vốn của bộ phận giá vốn vào ô phía trên để bắt đầu.')));
}

function veCanhBao(ds) {
  const bac = canhBaoBacVon(ds);
  const trong = ds.filter((r) => !Number.isFinite(r.gia_von));
  if (!bac.length && !trong.length) return null;
  return h('details', { class: 'canh-bao' },
    h('summary', null, `⚠️ ${bac.length + trong.length} cảnh báo trong bảng giá vốn hiện tại`),
    h('ul', null,
      trong.map((r) => h('li', null, `${r.nhom} ${r.phan_loai}: giá vốn trống hoặc không phải số`)),
      bac.map((c) => h('li', null, `${c.nhom}: ${c.lon.phan_loai} (${dinhDangTien(c.lon.gia_von)}) lớn hơn ${c.nho.phan_loai} (${dinhDangTien(c.nho.gia_von)}) nhưng vốn lại rẻ hơn`))));
}

function veBang(ds, nhoms) {
  const dem = new Map();
  ds.forEach((r) => dem.set(r.nhom, (dem.get(r.nhom) || 0) + 1));
  const tim = st.tim.trim().toLowerCase();
  const hien = sapXep(ds).filter((r) => (!st.nhom || r.nhom === st.nhom) && (!tim || `${r.nhom} ${r.phan_loai} ${r.nganh}`.toLowerCase().includes(tim)));
  const canhBao = new Set(canhBaoBacVon(ds).flatMap((c) => [khoaVon(c.lon.nhom, c.lon.phan_loai)]));

  const oTim = h('input', { class: 'o-nhap', type: 'search', placeholder: 'Tìm size, nhóm…', value: st.tim, 'aria-label': 'Tìm',
    oninput: (e) => { st.tim = e.target.value; const vt = e.target.selectionStart; ve(); const o = goc.querySelector('input[type=search]'); o.focus(); o.setSelectionRange(vt, vt); } });

  let nhomTruoc = null;
  const hang = [];
  for (const r of hien) {
    if (r.nhom !== nhomTruoc && !st.nhom) {
      hang.push(h('tr', { class: 'hang-nhom' }, h('th', { colspan: 7, scope: 'rowgroup' }, r.nhom, h('span', { class: 'chu-nhat' }, ` · ${dem.get(r.nhom)} size`))));
      nhomTruoc = r.nhom;
    }
    hang.push(veDong(r, canhBao.has(khoaVon(r.nhom, r.phan_loai))));
  }

  return h('div', { class: 'the' },
    h('div', { class: 'hang hang-loc' },
      h('div', { class: 'ds-chip' },
        h('button', { class: ['chip chip-loc', !st.nhom && 'dang-chon'], onclick: () => { st.nhom = ''; ve(); } }, `Tất cả (${ds.length})`),
        nhoms.map((n) => h('button', { class: ['chip chip-loc', st.nhom === n && 'dang-chon'], onclick: () => { st.nhom = n; ve(); } }, `${n} (${dem.get(n)})`))),
      h('span', { class: 'gian-cach' }),
      oTim),
    h('div', { class: 'khung-bang khung-bang-cao' },
      h('table', { class: 'bang' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, 'Nhóm'), h('th', { scope: 'col' }, 'Phân loại'), h('th', { scope: 'col' }, 'Ngành'),
          h('th', { scope: 'col', class: 'so' }, 'Giá vốn (đ)'), h('th', { scope: 'col', class: 'so' }, 'Giá bán (đ)'),
          h('th', { scope: 'col' }, 'Cập nhật'), h('th', { scope: 'col' }, h('span', { class: 'an-chu' }, 'Thao tác')))),
        h('tbody', null, hang.length ? hang : h('tr', null, h('td', { colspan: 7, class: 'o-trong' }, 'Không có dòng nào khớp.'))))));
}

function veDong(r, coCanhBao) {
  const khoa = khoaVon(r.nhom, r.phan_loai);
  const dangSua = st.dangSua === khoa;
  let oVon;
  const luuSua = async () => {
    const so = docSo(oVon.value);
    if (so === null || so < 0) { oVon.classList.add('o-loi'); oVon.focus(); return; }
    if (so === r.gia_von) { st.dangSua = null; ve(); return; }
    oVon.disabled = true;
    try {
      await kho.ghi('GIA_VON', [{ nhom: r.nhom, phan_loai: r.phan_loai, gia_von: so }]);
      st.dangSua = null;
      thongBao(`Đã lưu giá vốn ${r.nhom} ${r.phan_loai}: ${dinhDangTien(so)} đ.`);
    } catch (e) {
      oVon.disabled = false;
      thongBao(`Chưa lưu được: ${e.message}`, 'loi');
    }
  };
  const oGia = dangSua
    ? (oVon = h('input', { class: 'o-so', type: 'text', inputmode: 'numeric', value: Number.isFinite(r.gia_von) ? dinhDangTien(r.gia_von) : '', 'aria-label': `Giá vốn ${r.nhom} ${r.phan_loai}`,
      onkeydown: (e) => { if (e.key === 'Enter') luuSua(); if (e.key === 'Escape') { st.dangSua = null; ve(); } } }))
    : h('span', { class: !Number.isFinite(r.gia_von) ? 'chu-loi' : '' }, Number.isFinite(r.gia_von) ? dinhDangTien(r.gia_von) : 'trống');
  if (dangSua) queueMicrotask(() => { oVon.focus(); oVon.select(); });

  return h('tr', { class: coCanhBao ? 'dong-canh-bao' : '' },
    h('td', null, r.nhom),
    h('td', null, h('b', null, r.phan_loai), coCanhBao ? h('span', { class: 'nhan-nho nhan-vang', title: 'Size lớn hơn mà vốn rẻ hơn size nhỏ' }, '⚠ bậc vốn') : null),
    h('td', null, r.nganh || '—'),
    h('td', { class: 'so' }, oGia),
    h('td', { class: 'so' }, Number.isFinite(r.gia_ban) ? dinhDangTien(r.gia_ban) : '—'),
    h('td', { class: 'chu-nhat' }, ngayGio(r.cap_nhat_luc)),
    h('td', { class: 'o-thao-tac' }, dangSua
      ? [h('button', { class: 'nut nut-nho nut-chinh', onclick: luuSua }, 'Lưu'), h('button', { class: 'nut nut-nho', onclick: () => { st.dangSua = null; ve(); } }, 'Hủy')]
      : [h('button', { class: 'nut-icon', title: 'Sửa giá vốn', 'aria-label': `Sửa ${r.nhom} ${r.phan_loai}`, onclick: () => { st.dangSua = khoa; ve(); } }, '✏️'),
        h('button', { class: 'nut-icon', title: 'Xóa', 'aria-label': `Xóa ${r.nhom} ${r.phan_loai}`, onclick: () => xoaDong(r) }, '🗑')]));
}

async function xoaDong(r) {
  if (!(await xacNhan(`Xóa giá vốn "${r.nhom} ${r.phan_loai}"? Thao tác được ghi vào LICH_SU.`, { nutDongY: 'Xóa', nguyHiem: true }))) return;
  try {
    await kho.xoa('GIA_VON', [{ nhom: r.nhom, phan_loai: r.phan_loai }]);
    thongBao(`Đã xóa ${r.nhom} ${r.phan_loai}.`);
  } catch (e) {
    thongBao(`Chưa xóa được: ${e.message}`, 'loi');
  }
}

// ---------- Nạp file ----------

async function napFile(files) {
  const moi = [], loi = [], tenFile = [];
  for (const f of files) {
    if (!/\.(xlsx|xls)$/i.test(f.name)) { thongBao(`"${f.name}" không phải file Excel.`, 'loi'); continue; }
    try {
      const r = docBangGiaVon(docBang(await f.arrayBuffer()).dong);
      r.banGhi.forEach((b) => { b.file_nguon = f.name; });
      moi.push(...r.banGhi);
      loi.push(...r.loi.map((l) => ({ ...l, file: f.name })));
      tenFile.push(f.name);
    } catch (e) {
      thongBao(`Không đọc được "${f.name}": ${e.message}`, 'loi');
    }
  }
  if (!tenFile.length) return;
  moXemTruoc(moi, loi, tenFile);
}

function moXemTruoc(moi, loi, tenFile) {
  const daLuu = kho.duLieu().GIA_VON;
  const hopLe = moi.filter((b) => b.nhom && Number.isFinite(b.gia_von));
  const ss = soSanhGiaVon(daLuu, hopLe);
  // cảnh báo bậc vốn trên dữ liệu SAU khi lưu
  const sauKhiLuu = new Map(daLuu.map((r) => [khoaVon(r.nhom, r.phan_loai), r]));
  hopLe.forEach((r) => sauKhiLuu.set(khoaVon(r.nhom, r.phan_loai), { ...sauKhiLuu.get(khoaVon(r.nhom, r.phan_loai)), ...r }));
  const bac = canhBaoBacVon([...sauKhiLuu.values()]);
  const soLuu = ss.them.length + ss.doi.length;

  const dongDoi = [
    ...ss.doi.map((d) => {
      const chenh = Number.isFinite(d.cu.gia_von) && d.cu.gia_von ? (d.moi.gia_von - d.cu.gia_von) / d.cu.gia_von : null;
      return h('tr', null, h('td', null, h('span', { class: 'nhan-nho nhan-tim' }, 'Đổi')), h('td', null, d.cu.nhom), h('td', null, d.cu.phan_loai),
        h('td', { class: 'so' }, h('s', { class: 'chu-nhat' }, dinhDangTien(d.cu.gia_von)), ' → ', h('b', null, dinhDangTien(d.moi.gia_von))),
        h('td', { class: ['so', chenh > 0 ? 'chu-lo' : chenh < 0 ? 'chu-lai' : ''] }, chenh === null ? '—' : `${chenh > 0 ? '+' : ''}${(chenh * 100).toFixed(1).replace('.', ',')}%`));
    }),
    ...ss.them.map((r) => h('tr', null, h('td', null, h('span', { class: 'nhan-nho nhan-xanh' }, 'Mới')), h('td', null, r.nhom), h('td', null, r.phan_loai),
      h('td', { class: 'so' }, h('b', null, dinhDangTien(r.gia_von))), h('td', { class: 'so' }, '—'))),
  ];

  const nutLuu = h('button', { class: 'nut nut-chinh', disabled: !soLuu }, soLuu ? `💾 Lưu ${soLuu} thay đổi` : 'Không có gì thay đổi');
  const dlg = h('dialog', { class: 'hop-thoai hop-thoai-rong', 'aria-labelledby': 'xt-tieu-de' },
    h('div', { class: 'hop-thoai-dau' },
      h('h2', { id: 'xt-tieu-de' }, 'Xem trước giá vốn'),
      h('button', { class: 'nut-dong', 'aria-label': 'Đóng', onclick: () => dlg.close() }, '×')),
    h('p', { class: 'mo-ta' }, `File: ${tenFile.join(', ')}`),
    h('div', { class: 'ds-chip' },
      h('span', { class: 'chip chip-so nhan-xanh' }, `➕ Thêm mới: ${ss.them.length}`),
      h('span', { class: 'chip chip-so nhan-tim' }, `✏️ Thay đổi: ${ss.doi.length}`),
      h('span', { class: 'chip chip-so' }, `= Giữ nguyên: ${ss.giuNguyen.length}`),
      loi.length ? h('span', { class: 'chip chip-so nhan-do' }, `⚠️ Lỗi (bỏ qua): ${loi.length}`) : null),
    loi.length ? h('div', { class: 'canh-bao canh-bao-do' }, h('b', null, 'Các dòng lỗi sẽ KHÔNG được lưu:'),
      h('ul', null, loi.map((l) => h('li', null, `${l.file} — dòng ${l.dong}: ${l.noiDung}`)))) : null,
    bac.length ? h('div', { class: 'canh-bao' }, h('b', null, `Cảnh báo bậc vốn sau khi lưu (${bac.length}):`),
      h('ul', null, bac.map((c) => h('li', null, `${c.noiDung} (${dinhDangTien(c.lon.gia_von)} < ${dinhDangTien(c.nho.gia_von)})`)))) : null,
    dongDoi.length ? h('div', { class: 'khung-bang khung-bang-vua' }, h('table', { class: 'bang' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Nhóm'), h('th', null, 'Phân loại'), h('th', { class: 'so' }, 'Giá vốn (đ)'), h('th', { class: 'so' }, 'Chênh lệch'))),
      h('tbody', null, dongDoi))) : h('p', { class: 'o-trong' }, 'Tất cả giá vốn trong file giống hệt dữ liệu đã lưu.'),
    h('div', { class: 'hang-nut' }, h('span', { class: 'gian-cach' }), h('button', { class: 'nut', onclick: () => dlg.close() }, 'Hủy'), nutLuu));

  nutLuu.addEventListener('click', async () => {
    nutLuu.disabled = true;
    nutLuu.textContent = 'Đang lưu…';
    // Dòng thay đổi dùng đúng tên nhóm / phân loại đã lưu để không tạo bản ghi trùng
    const banGhi = [
      ...ss.doi.map((d) => ({ nhom: d.cu.nhom, phan_loai: d.cu.phan_loai, nganh: d.moi.nganh || d.cu.nganh, gia_von: d.moi.gia_von, gia_ban: d.moi.gia_ban, file_nguon: d.moi.file_nguon })),
      ...ss.them.map((r) => ({ nhom: r.nhom, phan_loai: r.phan_loai, nganh: r.nganh, gia_von: r.gia_von, gia_ban: r.gia_ban, file_nguon: r.file_nguon })),
    ];
    try {
      await kho.ghi('GIA_VON', banGhi);
      dlg.close();
      chucMung(`Đã lưu ${banGhi.length} dòng giá vốn!`);
    } catch (e) {
      thongBao(`Chưa lưu được: ${e.message}`, 'loi');
      nutLuu.disabled = false;
      nutLuu.textContent = `💾 Lưu ${soLuu} thay đổi`;
    }
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

// ---------- File mẫu / xuất ----------

const TIEU_DE = ['Tên sản phẩm', 'Phân loại', 'Ngành hàng', 'Giá vốn', 'Giá bán'];

function ghiFile(ten, dong) {
  const X = globalThis.XLSX;
  const ws = X.utils.aoa_to_sheet(dong);
  ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sản phẩm');
  taiXuong(ten, X.write(wb, { type: 'array', bookType: 'xlsx' }));
}

function taiFileMau() {
  ghiFile('mau_gia_von.xlsx', [TIEU_DE, ['Bộ 1 tấm', '30x40', 'Tranh', 10000, ''], ['Bộ 3 tấm đồng size', '20x30x3', 'Tranh', 25000, ''], ['Nẹp gỗ khổ ngang', '80x40', 'Tranh', 30000, '']]);
}

function xuatExcel(ds) {
  ghiFile('gia_von.xlsx', [TIEU_DE, ...sapXep(ds).map((r) => [r.nhom, r.phan_loai, r.nganh, r.gia_von ?? '', r.gia_ban ?? ''])]);
}
