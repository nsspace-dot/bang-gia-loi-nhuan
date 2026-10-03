# Kế hoạch — App "Bảng giá & Lợi nhuận"

> Repo này PUBLIC. Không ghi vào repo: số liệu kinh doanh thật (giá vốn, giá bán, phí, SKU ID, tên sản phẩm cụ thể, doanh số), URL Apps Script, mật khẩu.
> File mẫu thật nằm trong `mau/` (đã chặn bằng `.gitignore`).

## Trạng thái

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| GĐ0 | Đọc tài liệu + file mẫu, kế hoạch | ✅ Đã duyệt |
| GĐ1 | Module công thức + test, Apps Script, tab Bảng phí, tab Giá vốn, Cài đặt | ✅ Đã duyệt |
| GĐ2 | Tab Tính lợi nhuận (sửa 6 lỗi app cũ, có test) | 🔄 Chờ duyệt |
| GĐ3 | Tab Set giá | |
| GĐ4 | Tab Campaign | |
| GĐ5 | HUONG-DAN.md | |

## Quyết định đã duyệt (GĐ0)

- **C1.** Test công thức dùng kết quả tính đúng theo công thức (con số trong yêu cầu ban đầu lệch 1đ do tính nhầm). Test với số liệu thật đọc từ `mau/kiem-tra-that.json`, không nằm trong repo.
- **C2.** Nhận diện theo chữ, KHÔNG lọc theo ngành TikTok. Loại NGOÀI PHẠM VI trước khi xét loại:
  - "lịch" (trừ "lịch sử") → ngoài phạm vi, kể cả lịch laminate tráng gương.
  - "đồng hồ" → ngoài phạm vi, trừ khi tên có "liễn"/"canvas" hoặc seller_sku có "CAN-" (vẫn là Liễn).
  - "khung ảnh", "khung bằng khen", "trà", "topping" → ngoài phạm vi.
  - Các từ trên chỉ xét trong **tên sản phẩm** (xem "Điểm mới cần duyệt").
- **C3.** Tranh có size nhưng không có từ khóa loại → ❓ Cần gán. Có nút "Gán cho cả sản phẩm" (cùng Product ID, mỗi SKU giữ size riêng) và "Áp dụng cho các SKU cùng phân loại".
- **C4.** Liễn size vuông: tìm ở cả bảng khổ dọc và khổ ngang.
- **C5.** Tên có "(Bộ 3 tấm)", phân loại chỉ 1 size → Bộ 3 tấm, gắn nhãn "suy ra từ tên" ở màn duyệt.
- **C6.** "Size lớn hơn" = cả rộng và cao đều ≥ (một chiều lớn hơn hẳn).
- **C7.** Campaign stock ghi dạng số.
- Bộ 3 tấm nhận thêm kiểu ghi "30x40cm x 3 tấm".

## Đã duyệt thêm ở GĐ1

- **Từ khóa ngoài phạm vi chỉ xét trong TÊN SẢN PHẨM**, không xét phân loại. Lý do: phân loại của decal thường là tên hoa văn ("… uống trà", "… trà sữa", "Hoa … thanh lịch"); nếu xét cả phân loại thì khoảng 10 SKU decal hợp lệ bị loại oan.
- **"thanh lịch", "lịch sự", "lịch lãm"** cũng không bị coi là lịch (giống "lịch sử").
- **"nẹp" (gỗ/nhựa) trong phân loại** được coi là dấu hiệu Liễn. Có sản phẩm tên ghi "Laminate tráng gương" nhưng phân loại ghi "Nẹp Nhựa" — đây là liễn.
- **Bộ 3 tấm suy ra từ tên mà size không có trong bảng "Bộ 3 tấm đồng size"** (vd 50x100) → Cần gán, không tự đổi sang 1 tấm.

## GĐ2 — Tab Tính lợi nhuận

| Lỗi app cũ | Cách sửa | Test |
|---|---|---|
| 1. Giá bán trống bị lấy nhầm giá vốn | Đọc cột theo TÊN, không dùng cột dự phòng theo vị trí; giá bán trống = trống, chưa tính lãi | `tests/loi-nhuan.test.js`, `tests/giao-dien.test.js` |
| 2. Tên có ngoặc kép làm vỡ ô nhập | Mọi giao diện dựng bằng `dom.js/h()` (textContent/thuộc tính), không ghép chuỗi vào innerHTML | test quét `js/ui/` + test trình duyệt thật |
| 3. "45.000"/"45,000" đọc sai | `core/so.js/docSo` | `tests/loi-nhuan.test.js` |
| 4. URL Apps Script ghi cứng, ghi không xác thực | URL nhập ở Cài đặt; mật khẩu kiểm tra ở Apps Script | test quét code + test Code.gs |
| 5. Báo "đã lưu" khi chưa lưu | Chỉ báo sau khi Apps Script trả `ok:true`; lỗi → "CHƯA lưu được: …" | `tests/loi-nhuan.test.js` (fetch giả qua Code.gs), test trình duyệt |
| 6. Danh sách chỉ lưu trên từng máy | Lưu "bảng tính" có tên lên Sheets (BANG_TINH + BANG_TINH_DONG), mở lại / xóa; bản nháp vẫn tự lưu trên máy | `tests/loi-nhuan.test.js`, test trình duyệt |

Thêm: chọn tháng phí, chọn gian hiển thị, lọc dòng lỗ, sắp xếp theo lãi (bấm tiêu đề cột), tìm kiếm không dấu, phân trang 100 dòng, nhân bản/xóa dòng, xuất Excel (5 cột đầu nhập lại được + lãi & % từng gian + sheet Thông tin).

Test trình duyệt (`tests/giao-dien.test.js`) dùng Playwright nếu máy có; không có thì tự bỏ qua.

## Kiến trúc

- **Web tĩnh, không cần build**, host bằng **GitHub Pages** (Settings → Pages → Deploy from a branch → chọn nhánh → thư mục `/ (root)`). File `.nojekyll` để GitHub phục vụ nguyên trạng.
- HTML + CSS + JavaScript module (`<script type="module">`), mỗi phần một file.
- **Thư viện lưu trong repo** (`vendor/`, ghim phiên bản, không phụ thuộc CDN):
  - SheetJS 0.20.3 — đọc/ghi Excel. Lấy từ gói npm `@e965/xlsx@0.20.3` (bản đóng gói lại của SheetJS trên npm, vì trang tải chính thức cdn.sheetjs.com bị chặn trong môi trường phát triển). SHA-256 của `vendor/xlsx.full.min.js`: `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`.
  - JSZip (GĐ4) — sửa trực tiếp XML file prefill để giữ nguyên 100% định dạng.
  - Font Quicksand (SIL OFL) trong `fonts/`, có bộ ký tự tiếng Việt.
- **File người dùng không rời trình duyệt.** Chỉ dữ liệu dùng chung đi lên Google Sheets qua Apps Script.
- **File TikTok "all_information" ghi sai vùng dữ liệu** (khai báo 5 dòng dù có hàng nghìn dòng) → `js/excel/doc.js` tự tính lại vùng dữ liệu khi đọc.

### Cấu trúc thư mục

```
index.html                 khung 5 tab + Cài đặt
.nojekyll                  để GitHub Pages phục vụ nguyên trạng
css/app.css, css/fonts.css
fonts/                     Quicksand (woff2)
vendor/                    xlsx.full.min.js (+ jszip ở GĐ4)
js/app.js                  khởi động, chuyển tab, trạng thái đồng bộ
js/core/                   LOGIC THUẦN, có test, không đụng giao diện
  cong-thuc.js             CÔNG THỨC DUY NHẤT
  so.js                    đọc "45.000"/"45,000", định dạng kiểu VN
  phi.js                   chọn bộ phí theo tháng
  lam-tron.js              làm tròn lên/xuống/đuôi 9.000/sát dưới trần
  size.js, van-ban.js      đọc size, xử lý chữ tiếng Việt
  gia-von.js               đọc file giá vốn, so sánh khi nạp lại, cảnh báo
  nhan-dien.js             Decal / Liễn / Laminate / ngoài phạm vi / cần gán
  danh-muc.js              gian hàng, ngành, màu gian
js/data/api.js             gọi Apps Script, báo lỗi rõ ràng
js/data/kho.js             cache localStorage + trạng thái đồng bộ
js/excel/doc.js            đọc Excel (tự sửa vùng dữ liệu)
js/ui/                     dom.js (tạo phần tử an toàn), linh-vat.js, thong-bao.js, cai-dat.js, tab-*.js
apps-script/Code.gs        dán vào Google Apps Script
tests/                     test (dữ liệu giả) + giả lập Apps Script
scripts/may-chu-thu.mjs    chạy app trên máy với Apps Script giả lập
scripts/chay-thu-mau.mjs   chạy nhận diện trên mau/ (chỉ in ra màn hình)
```

### Lệnh

```
node --test "tests/*.test.js"                 # chạy toàn bộ test
node scripts/may-chu-thu.mjs 8080 --du-lieu-gia   # mở http://localhost:8080, URL Apps Script: http://localhost:8080/gas, mật khẩu: mat-khau-thu
node scripts/chay-thu-mau.mjs [--chi-tiet]    # cần thư mục mau/
```

## Google Sheets (Apps Script quản lý)

| Sheet | Khóa | Cột |
|---|---|---|
| `DANH_MUC` | loai + ten | loai (GIAN/NGANH), ten, thu_tu, dang_dung, cap_nhat_luc |
| `BANG_PHI` | gian + nganh + thang | gian, nganh, thang (yyyy-mm), phi_san, phi_vc, phi_xl, phi_qc, aff_qc, aff_noqc, cap_nhat_luc |
| `GIA_VON` | nhom + phan_loai | nhom, phan_loai, nganh, gia_von, gia_ban, file_nguon, cap_nhat_luc |
| `NOI_SKU` | sku_id | sku_id, product_id, nhom, phan_loai, so_luong, phan_loai_goc, seller_sku, ghi_chu, cap_nhat_luc |
| `CAMPAIGN` | id | id, ten, gian, bat_dau, ket_thuc, thang_phi, chien_luoc, tham_so (JSON), lai_toi_thieu, file_goc, tong_hop (JSON), trang_thai, xuat_luc, tao_luc, cap_nhat_luc |
| `CAMPAIGN_KQ` | campaign_id + sku_id | ket_qua (VAO/LOAI/GAN/NGOAI), ly_do, loai, nhom, phan_loai, so_luong_tranh, gia_von, gia_ban_le, gia_campaign, so_luong, lai_qc, lai_noqc, ghi_chu |
| `BANG_TINH` | id | id, ten, gian_hien_thi, thang_phi, so_dong, cap_nhat_luc |
| `BANG_TINH_DONG` | bang_tinh_id + stt | ten, phan_loai, nganh, gia_von, gia_ban |
| `LICH_SU` | — | thoi_gian, hanh_dong (THEM/SUA/XOA), sheet, khoa, du_lieu_cu, du_lieu_moi |

Quy tắc Apps Script (`apps-script/Code.gs`):
- `GET ?action=ping | docTatCa | docCampaignKQ&id= | docBangTinh&id=` — chỉ cần URL.
- `POST {action, matKhau, …}` — mật khẩu so với Script Properties `MAT_KHAU`. Sai 10 lần → khóa 10 phút.
- Ghi theo từng bản ghi (upsert theo khóa) trong `LockService`. Ghi lại y hệt dữ liệu cũ thì bỏ qua.
- Mỗi thay đổi → 1 dòng `LICH_SU`. Campaign / bảng tính (nhiều dòng con) → 1 dòng tóm tắt.
- Mọi ô lưu dạng chữ thuần để Sheets không tự đổi SKU ID 19 số hoặc "2026-10" thành số/ngày.
- App chỉ báo "Đã lưu" khi nhận `{ok:true}`.

## Giao diện

- Pastel, bo tròn, font Quicksand. Linh vật mèo ôm máy tính (SVG) ở màn trống, ô thả file, và khi lưu xong (vẫy tay + hoa giấy nhẹ).
- Mỗi gian một màu: Nhà Sách bạc hà, Sách Hay oải hương, Tranh Lịch hồng đào, Tường Vip vàng bơ. Lãi xanh lá, lỗ đỏ.
- Bảng số căn phải, chữ số đều nhau (tabular), phân cách hàng nghìn kiểu Việt Nam. Bảng campaign (GĐ4) sẽ phân trang / cuộn ảo.
- Tôn trọng `prefers-reduced-motion` (tắt toàn bộ chuyển động).
