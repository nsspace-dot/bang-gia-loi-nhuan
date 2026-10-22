// Gọi Google Apps Script Web App. Chỉ báo thành công khi Apps Script trả { ok: true }.

const THOI_GIAN_CHO = 120000;

export class LoiApi extends Error {}

async function goi(url, tuyChon) {
  if (!url) throw new LoiApi('Chưa nhập URL Apps Script (mở ⚙️ Cài đặt).');
  const ctrl = new AbortController();
  const hen = setTimeout(() => ctrl.abort(), THOI_GIAN_CHO);
  let res;
  try {
    res = await fetch(url, { ...tuyChon, signal: ctrl.signal, redirect: 'follow' });
  } catch (e) {
    if (e.name === 'AbortError') throw new LoiApi('Apps Script không trả lời sau 2 phút. Thử lại sau.');
    throw new LoiApi('Không kết nối được Apps Script. Kiểm tra mạng, URL (phải kết thúc bằng /exec) và quyền truy cập Web App là "Bất kỳ ai".');
  } finally {
    clearTimeout(hen);
  }
  const chu = await res.text();
  if (!res.ok) throw new LoiApi(`Apps Script trả lỗi HTTP ${res.status}.`);
  let du;
  try {
    du = JSON.parse(chu);
  } catch {
    if (/<html/i.test(chu)) throw new LoiApi('Apps Script trả về trang web thay vì dữ liệu — thường do Web App chưa đặt quyền "Bất kỳ ai" hoặc URL sai.');
    throw new LoiApi('Apps Script trả về dữ liệu không đọc được.');
  }
  if (!du || du.ok !== true) throw new LoiApi(du && du.loi ? du.loi : 'Apps Script báo lỗi không rõ.');
  return du;
}

export function goiGet(url, thamSo) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(thamSo)) u.searchParams.set(k, v);
  return goi(u.toString(), { method: 'GET' });
}

export function goiPost(url, body) {
  // text/plain để trình duyệt không gửi yêu cầu kiểm tra CORS trước (Apps Script không hỗ trợ)
  return goi(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
}
