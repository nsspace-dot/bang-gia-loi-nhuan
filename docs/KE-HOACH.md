# Kế hoạch — App "Bảng giá & Lợi nhuận"

> Repo này PUBLIC. Không ghi vào repo: số liệu kinh doanh thật (giá vốn, giá bán, phí, SKU ID, tên sản phẩm cụ thể, doanh số), URL Apps Script, mật khẩu.
> File mẫu thật nằm trong `mau/` (đã chặn bằng `.gitignore`).

## Trạng thái

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| GĐ0 | Đọc tài liệu + file mẫu, kế hoạch | ✅ Đã duyệt |
| GĐ1 | Module công thức + test, Apps Script, tab Bảng phí, tab Giá vốn, Cài đặt | ✅ Đã duyệt |
| GĐ2 | Tab Tính lợi nhuận (sửa 6 lỗi app cũ, có test) | ✅ Đã duyệt |
| GĐ3 | Tab Set giá | ✅ Đã duyệt |
| GĐ4 | Tab Campaign | ✅ Đã duyệt |
| GĐ5 | HUONG-DAN.md | 🔄 Chờ duyệt |

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

Thêm: chọn gian hiển thị, lọc dòng lỗ, sắp xếp theo lãi (bấm tiêu đề cột), tìm kiếm không dấu, phân trang 100 dòng, nhân bản/xóa dòng, xuất Excel (5 cột đầu nhập lại được + lãi & % từng gian + sheet Thông tin).

Test trình duyệt (`tests/giao-dien.test.js`) dùng Playwright nếu máy có; không có thì tự bỏ qua.

Phí: KHÔNG có ô chọn tháng — luôn dùng bộ phí đang áp dụng tại thời điểm hiện tại (bộ mới nhất có tháng áp dụng ≤ tháng hiện tại). Áp dụng cho cả tab Tính lợi nhuận và Set giá.

## GĐ3 — Tab Set giá

- Nguồn giá vốn: chọn nhóm từ giá vốn đã lưu, hoặc thả file giá vốn (không lưu lên Sheets).
- Cài đặt (nhớ lần trước): gian hàng, lãi mong muốn (% trên giá hoặc đ/đơn), kịch bản (Có QC / Không QC / Cả 2), làm tròn (lên 1.000 / đuôi 9.000 / không).
- Mỗi size: giá đề xuất (giá thấp nhất đạt mức lãi, đã làm tròn), giá chốt tay (tùy chọn), lãi có QC & không QC (đ, %), giá hòa vốn (theo kịch bản), mức giảm tối đa còn hòa vốn (%, đ).
- Kiểm tra bậc giá trên giá đang dùng (giá chốt nếu có, không thì giá đề xuất): size lớn hơn phải giá ≥ size nhỏ (cùng nhóm); Bộ 3 tấm phải rẻ hơn 3 × Bộ 1 tấm cùng size (Bộ 1 tấm lấy từ giá vốn đã lưu nếu không nằm trong lựa chọn).
- Xuất file: sheet "Sản phẩm" đúng mẫu nhập tab Tính lợi nhuận (Giá bán = giá đang dùng), sheet "Chi tiết", sheet "Cài đặt".
- Logic: `js/core/set-gia.js`, test: `tests/set-gia.test.js` + test trình duyệt.

## GĐ4 — Tab Campaign

- **Danh sách campaign** (sheet CAMPAIGN): xem lại (tải kết quả), nhân bản cài đặt sang campaign mới.
- **Chạy campaign**: tên, gian, ngày bắt đầu – kết thúc, tháng phí (mặc định theo ngày bắt đầu, sửa được); thả file prefill + một/nhiều file sản phẩm; chiến lược A/B/C (+X% cho A), lãi tối thiểu (nhập mỗi lần), bước làm tròn 100/500/1.000. App nhớ gian, chiến lược, X%, bước làm tròn.
- **Đọc file**: prefill đọc theo tên cột (dòng tiêu đề tìm trong 6 dòng đầu); ô Campaign price/stock có sẵn (trống/công thức/số) đều bị bỏ qua và ghi đè. File sản phẩm: sheet Template, dòng 1 là khóa, dữ liệu từ dòng 6, ghép theo SKU ID. SKU không có trong file sản phẩm → nhận diện theo tên trong prefill + cảnh báo.
- **Chiến lược**: A = giá bán lẻ × (1 − X) làm tròn xuống, vượt trần thì hạ sát dưới trần + ghi chú; B = giá thấp nhất đạt lãi tối thiểu ở cả 2 kịch bản, làm tròn lên; C = số làm tròn lớn nhất < trần (và < giá bán lẻ).
- **Vào được** khi: trong khoảng giá, < giá bán lẻ, lãi có QC và không QC ≥ lãi tối thiểu (phí đúng ngành của SKU), đủ tồn. Số lượng mặc định = mức tối thiểu của "Campaign stock range", không vượt tồn.
- **Lý do loại**: Lỗ / Dưới lãi tối thiểu / Vượt trần không đủ lãi (kể cả ở giá cao nhất được phép vẫn không đủ lãi) / Thiếu tồn / Bỏ chọn tay / khoảng giá. Ngoài phạm vi chỉ đếm.
- **Màn duyệt**: 4 nhóm (Vào được / Bị loại / Cần gán / Ngoài phạm vi), sắp xếp L30D giảm dần, tìm kiếm, phân trang 100 dòng; sửa giá / số lượng từng dòng (tính lại ngay), bỏ chọn; nhãn "suy ra từ tên", "gán tay".
- **Cần gán**: chọn nhóm + size + số tranh/tấm → lưu NOI_SKU theo SKU ID (cần mật khẩu, chỉ áp dụng khi Sheets xác nhận); "Áp dụng cùng phân loại"; "Gán cho cả sản phẩm" (cùng Product ID, mỗi SKU giữ size riêng nếu đọc được).
- **Cảnh báo**: giá bán lẻ không chia hết 1.000; SKU đang ở campaign khác cùng gian có thời gian chồng lấn với giá khác; SKU lần trước (campaign trước cùng gian) vào được mà lần này không, kèm lý do.
- **File đăng ký** `<tên>_dang-ky.xlsx`: sửa thẳng XML file gốc (`js/excel/prefill.js`) — giữ dòng ghi chú, ô gộp, tiêu đề, thứ tự & độ rộng cột, giá trị các cột khác; Campaign price ghi SỐ (bỏ công thức kể cả công thức dùng chung), Campaign stock ghi số; xóa dòng không vào được; cập nhật vùng dữ liệu / bộ lọc, bỏ calcChain.
- **File báo cáo** `<tên>_bao-cao.xlsx`: Tổng hợp, Vào được, Bị loại, Cần gán.
- Tên file bỏ dấu tiếng Việt (một số trình duyệt đổi tên file có dấu thành "download").
- **Lưu**: CAMPAIGN + CAMPAIGN_KQ (không lưu dòng ngoài phạm vi, chỉ đếm trong tong_hop).
- Logic `js/core/campaign.js`; test `tests/campaign.test.js` + test trình duyệt; chạy thử trên file thật: `node scripts/chay-thu-campaign.mjs [A|B|C] [lãi%] [X%]` (chỉ in ra màn hình, file ghi vào mau/).

## Kiến trúc

- **Web tĩnh, không cần build**, host bằng **GitHub Pages** (Settings → Pages → Deploy from a branch → chọn nhánh → thư mục `/ (root)`). File `.nojekyll` để GitHub phục vụ nguyên trạng.
- HTML + CSS + JavaScript module (`<script type="module">`), mỗi phần một file.
- **Thư viện lưu trong repo** (`vendor/`, ghim phiên bản, không phụ thuộc CDN):
  - SheetJS 0.20.3 — đọc/ghi Excel. Lấy từ gói npm `@e965/xlsx@0.20.3` (bản đóng gói lại của SheetJS trên npm, vì trang tải chính thức cdn.sheetjs.com bị chặn trong môi trường phát triển). SHA-256 của `vendor/xlsx.full.min.js`: `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`.
  - JSZip 3.10.1 (npm `jszip`) — sửa trực tiếp XML file prefill để giữ nguyên định dạng. SHA-256 `vendor/jszip.min.js`: `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e`.
  - Font Quicksand (SIL OFL) trong `fonts/`, có bộ ký tự tiếng Việt.
- **File người dùng không rời trình duyệt.** Chỉ dữ liệu dùng chung đi lên Google Sheets qua Apps Script.
- **File TikTok "all_information" ghi sai vùng dữ liệu** (khai báo 5 dòng dù có hàng nghìn dòng) → `js/excel/doc.js` tự tính lại vùng dữ liệu khi đọc.

### Cấu trúc thư mục

```
index.html                 khung 5 tab + Cài đặt
.nojekyll                  để GitHub Pages phục vụ nguyên trạng
css/app.css, css/fonts.css
fonts/                     Quicksand (woff2)
vendor/                    xlsx.full.min.js, jszip.min.js
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
  bang-tinh.js             tab Tính lợi nhuận: đọc file, lãi theo gian, lọc, sắp xếp, xuất
  set-gia.js               tab Set giá: giá đề xuất, hòa vốn, bậc giá
  campaign.js              tab Campaign: đọc prefill, chiến lược, điều kiện vào được, cảnh báo, báo cáo
js/data/api.js             gọi Apps Script, báo lỗi rõ ràng
js/data/kho.js             cache localStorage + trạng thái đồng bộ
js/excel/doc.js            đọc Excel (tự sửa vùng dữ liệu)
js/excel/prefill.js        ghi file đăng ký campaign (sửa XML file gốc)
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
