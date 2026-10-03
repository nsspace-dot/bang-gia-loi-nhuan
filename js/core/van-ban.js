// Tiện ích xử lý chữ tiếng Việt.

/** Chữ thường, NFC, gộp khoảng trắng. Giữ dấu. */
export function chuanHoa(s) {
  return String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s\u00a0]+/g, ' ').trim();
}

/** Bỏ dấu tiếng Việt + chữ thường: "Nẹp Gỗ" → "nep go". */
export function boDau(s) {
  return chuanHoa(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/** Tìm cụm từ đứng riêng (không dính chữ cái khác hai bên). tu phải là chữ thường. */
export function coTu(vanBan, tu) {
  const t = tu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${t}(?=$|[^\\p{L}\\p{N}])`, 'u').test(vanBan);
}
