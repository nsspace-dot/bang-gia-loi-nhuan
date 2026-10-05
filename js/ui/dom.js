// Tạo phần tử giao diện an toàn: chữ luôn đi qua textContent / thuộc tính,
// KHÔNG ghép chuỗi dữ liệu vào innerHTML (tránh lỗi tên có dấu ngoặc kép, ký tự < >...).

/**
 * h('button', { class: 'nut', onclick: fn, title: 'x' }, 'Chữ', conKhac)
 * Thuộc tính bắt đầu bằng "on" là sự kiện; 'class' nhận chuỗi hoặc mảng; 'style' nhận object.
 */
export function h(the, thuocTinh, ...con) {
  const el = document.createElement(the);
  if (thuocTinh) datThuocTinh(el, thuocTinh);
  themCon(el, con);
  return el;
}

function datThuocTinh(el, tt) {
  for (const [k, v] of Object.entries(tt)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function themCon(el, con) {
  for (const c of con.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function xoaHet(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function thayNoiDung(el, ...con) {
  xoaHet(el);
  themCon(el, con);
  return el;
}

/** SVG tĩnh do app tự viết (không chứa dữ liệu người dùng). */
export function svg(chuoi) {
  const t = document.createElement('template');
  t.innerHTML = chuoi.trim();
  return t.content.firstElementChild;
}

export function giamChuyenDong() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Hộp thoại xác nhận nhỏ (Promise<boolean>). */
export function xacNhan(cauHoi, { nutDongY = 'Đồng ý', nguyHiem = false } = {}) {
  return new Promise((resolve) => {
    const dong = (kq) => { dlg.close(); dlg.remove(); resolve(kq); };
    const dlg = h('dialog', { class: 'hop-thoai hop-thoai-nho' },
      h('p', { class: 'hop-thoai-cau-hoi' }, cauHoi),
      h('div', { class: 'hang-nut' },
        h('button', { class: 'nut', onclick: () => dong(false) }, 'Hủy'),
        h('button', { class: ['nut', nguyHiem ? 'nut-nguy-hiem' : 'nut-chinh'], onclick: () => dong(true) }, nutDongY)));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); dong(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/** Chọn file (Promise<File|null>). */
export function chonFile(accept = '.xlsx,.xls') {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

/** Gắn kéo-thả file vào một vùng. */
export function ganKeoTha(vung, khiCoFile) {
  vung.addEventListener('dragover', (e) => { e.preventDefault(); vung.classList.add('dang-keo'); });
  vung.addEventListener('dragleave', () => vung.classList.remove('dang-keo'));
  vung.addEventListener('drop', (e) => {
    e.preventDefault();
    vung.classList.remove('dang-keo');
    const f = [...e.dataTransfer.files];
    if (f.length) khiCoFile(f);
  });
}

export function taiXuong(tenFile, du, kieu = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([du], { type: kieu }));
  const a = h('a', { href: url, download: tenFile });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Hộp thoại nhập 1 dòng chữ (Promise<string|null>). */
export function nhapChu(cauHoi, macDinh = '', { nutDongY = 'Đồng ý' } = {}) {
  return new Promise((resolve) => {
    const o = h('input', { class: 'o-nhap o-nhap-rong', value: macDinh, maxlength: 120 });
    const dong = (kq) => { dlg.close(); dlg.remove(); resolve(kq); };
    const dlg = h('dialog', { class: 'hop-thoai hop-thoai-nho' },
      h('form', { onsubmit: (e) => { e.preventDefault(); const t = o.value.trim(); if (t) dong(t); else o.focus(); } },
        h('p', { class: 'hop-thoai-cau-hoi' }, cauHoi),
        o,
        h('div', { class: 'hang-nut' },
          h('span', { class: 'gian-cach' }),
          h('button', { type: 'button', class: 'nut', onclick: () => dong(null) }, 'Hủy'),
          h('button', { type: 'submit', class: 'nut nut-chinh' }, nutDongY))));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); dong(null); });
    document.body.append(dlg);
    dlg.showModal();
    o.select();
  });
}

/**
 * Vẽ lại một vùng mà GIỮ NGUYÊN: vị trí cuộn trang, vị trí cuộn của các khung có [data-cuon],
 * ô đang focus (theo data-o) và vị trí con trỏ trong ô.
 */
export function veGiu(vung, ve) {
  const x = window.scrollX, y = window.scrollY;
  const cuon = [...vung.querySelectorAll('[data-cuon]')].map((el) => [el.dataset.cuon, el.scrollTop, el.scrollLeft]);
  const a = document.activeElement;
  const coFocus = a && a !== document.body && vung.contains(a);
  const khoa = coFocus ? a.dataset?.o : null;
  let chon = null;
  try { chon = coFocus && a.setSelectionRange ? [a.selectionStart, a.selectionEnd, a.selectionDirection] : null; } catch { chon = null; }
  const giaTriDangGo = coFocus && 'value' in a ? a.value : null;
  // Giữ chiều cao tối thiểu trong lúc thay nội dung để trang không bị co lại (tránh nhảy cuộn)
  const caoCu = vung.offsetHeight;
  vung.style.minHeight = `${caoCu}px`;
  ve();
  for (const [k, t, l] of cuon) {
    const el = vung.querySelector(`[data-cuon="${CSS.escape(k)}"]`);
    if (el) { el.scrollTop = t; el.scrollLeft = l; }
  }
  if (khoa) {
    const moi = vung.querySelector(`[data-o="${CSS.escape(khoa)}"]`);
    if (moi) {
      if (giaTriDangGo !== null && moi.value !== giaTriDangGo && moi.dataset.goc !== undefined && giaTriDangGo !== a.dataset.goc) moi.value = giaTriDangGo;
      moi.focus({ preventScroll: true });
      try { if (chon && moi.setSelectionRange) moi.setSelectionRange(...chon); } catch { /* ô không hỗ trợ chọn */ }
    }
  }
  vung.style.minHeight = '';
  if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
}

const henGio = new WeakMap();
/** Chờ người dùng ngừng gõ (mặc định 180 ms) rồi mới chạy fn — dùng cho ô tìm kiếm. */
export function treLai(fn, ms = 180) {
  clearTimeout(henGio.get(fn));
  henGio.set(fn, setTimeout(fn, ms));
}
