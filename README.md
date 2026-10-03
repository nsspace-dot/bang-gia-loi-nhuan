# Bảng giá & Lợi nhuận

Công cụ web tĩnh cho shop TikTok: tính lợi nhuận, set giá, chuẩn bị file đăng ký campaign, quản lý giá vốn và bảng phí.

- Chạy hoàn toàn trong trình duyệt; file Excel của bạn không được gửi lên máy chủ nào.
- Dữ liệu dùng chung (phí, giá vốn, campaign…) lưu trên Google Sheets của bạn qua Google Apps Script (`apps-script/Code.gs`).
- Host bằng GitHub Pages, không cần bước build.

**Hướng dẫn cài đặt & sử dụng: [HUONG-DAN.md](HUONG-DAN.md)** · Thiết kế: [docs/KE-HOACH.md](docs/KE-HOACH.md)

Chạy thử trên máy (Node 20+):

```
node --test "tests/*.test.js"
node scripts/may-chu-thu.mjs 8080 --du-lieu-gia
```
