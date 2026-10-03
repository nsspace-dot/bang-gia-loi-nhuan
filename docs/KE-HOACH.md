# Kế hoạch — App "Bảng giá & Lợi nhuận" (GĐ0)

> Trạng thái: **CHỜ DUYỆT**. Chưa viết code ứng dụng.

## 1. Đã đọc gì, thấy gì

| File | Nội dung chính | Điều cần lưu ý |
|---|---|---|
| `Code cũ.txt` (app cũ) | 1 file HTML, SheetJS 0.18.5, 8 khoản phí, `calcProfit` | Xác nhận đủ 6 lỗi trong yêu cầu (dòng `r[keys[3]]`, ghép chuỗi vào `innerHTML`, `replace(/[^\d.]/g,'')` đọc "45.000" thành 45, URL Apps Script ghi cứng, POST không xác thực, báo "đã lưu" trước khi lưu xong) |
| `Von_Laminate/Lien/Decal.xlsx` | 28 + 38 + 13 dòng giá vốn, đúng mẫu 5 cột | Bảng gốc đã có sẵn các ca "size lớn mà vốn rẻ hơn" (vd Laminate 30x70 rẻ hơn 30x60) → cảnh báo sẽ bắt được |
| `..._all_information_template_1/2/3.xlsx` | 723 + 55 + 6.440 = **7.218 SKU** | ⚠️ File TikTok ghi sai kích thước sheet (`A1:AL5`) → thư viện đọc Excel sẽ chỉ thấy 5 dòng nếu không xử lý. Tool sẽ tự tính lại vùng dữ liệu |
| `Processing_result_Campaign_prefill_template_GOC.xlsx` | **6.444 SKU**, 16 cột, ô gộp A1:J1 | Mọi số đều lưu dạng chữ ("97000"); Campaign price có 6.324 công thức + 120 số; 354 dòng có trần < giá bán lẻ; 21 dòng giá bán lẻ lẻ (721.538, 1.044.615) |

## 2. Chạy thử nhận diện (bản nháp) trên file mẫu

100% SKU của prefill tìm thấy trong 3 file sản phẩm (6.444/6.444).

| Nhóm | Kỳ vọng | Bản nháp | Ghi chú |
|---|---|---|---|
| Laminate 1 tấm | ~2.810 | 2.845 | lệch do quy tắc "x 3 tấm" chưa hoàn chỉnh trong bản nháp |
| Bộ 3 tấm | ~306 | 198 (+~110 ca "…cm x 3 tấm") | sau khi sửa quy tắc sẽ gần ~306 |
| Liễn gỗ / nhựa | ~775 / ~770 | 742 / 737 | |
| Decal 1/2/3 tấm | 990 / 50 / 50 | 990 / 50 / 50 | khớp |
| Cần gán | ~54 | 57 | 40 tranh tròn ĐK 20/25cm, 10 liễn không ghi nẹp, 7 size không có vốn |

Các ví dụ nhận diện trong yêu cầu: khớp cả 6 (sau khi bỏ lọc theo ngành, xem C2).

## 3. Các điểm cần anh/chị quyết định

- **C1. Test công thức:** Vốn 22.155, Giá 71.000 (Tường Vip, Tranh) → Lãi có QC = **15.266,6** ✅; Lãi không QC tính ra **17.496** (71.000 − 22.155 − 5.008 − 71.000 × 37,1%), không phải 17.495. Đề xuất test dùng 17.496.
- **C2. Không lọc theo "Product Category":** SKU 1736123989257848822 (liễn gỗ 30x40, ví dụ trong yêu cầu) bị TikTok xếp vào ngành **Đồng hồ**. Đề xuất: chỉ nhận diện theo chữ (phân loại → seller_sku → tên), không dựa vào ngành TikTok.
- **C3. ~64 SKU có size, là tranh, nhưng không có từ khóa loại** (vd "Bộ 3 Tranh Treo Tường Bắc Âu … x 3 tấm" ở ngành Hình dán; "Gỗ MDF, 40x60"; tranh Phật "Mẫu 01, 30x40cm"). Đề xuất: đưa vào **❓ Cần gán** thay vì âm thầm bỏ qua → số "Cần gán" sẽ ~120 thay vì ~54.
- **C4. Size vuông của liễn** (60x60, 80x80…): bảng vốn có 80x80 ở "khổ ngang", không có ở "khổ dọc". Đề xuất: size vuông tìm ở cả 2 bảng dọc/ngang.
- **C5. Tên có "(Bộ 3 tấm)" nhưng phân loại chỉ ghi 1 size** (vd "Mẫu 01, 30x60cm", ~32 SKU): đề xuất xếp vào "Bộ 3 tấm đồng size".
- **C6. "Size lớn hơn"** (cảnh báo vốn/giá): đề xuất = cả chiều rộng và chiều cao đều ≥ (vd 30x70 > 30x60), không so diện tích (tránh cảnh báo sai kiểu 30x60 vs 40x40).
- **C7. Campaign stock** ghi dạng số (file gốc lưu dạng chữ) — TikTok nhận cả hai.

## 4. Kiến trúc

- **Web tĩnh, không cần build.** HTML + CSS + JavaScript chia module (`<script type="module">`). Vercel chỉ việc phục vụ file.
- **Thư viện ghim phiên bản, lưu thẳng trong repo** (`vendor/`), không phụ thuộc CDN:
  - SheetJS 0.20.3 — đọc mọi file Excel, ghi file báo cáo/xuất.
  - JSZip 3.10.1 — sửa **trực tiếp XML** của file prefill để giữ nguyên 100% định dạng (ô gộp, độ rộng cột, dòng ghi chú), chỉ thay Campaign price/stock và xóa dòng.
- **Kiểm thử:** dùng trình chạy test có sẵn của Node (`node --test`), không cần cài gói. Cùng một module công thức chạy được cả trên trình duyệt và trong test. Có thêm test chạy trên file mẫu `mau/` (tự bỏ qua nếu máy không có `mau/`).
- **Ảnh chụp màn hình:** Playwright (chỉ dùng khi phát triển).
- **File người dùng không rời trình duyệt.** Chỉ dữ liệu dùng chung (phí, vốn, bảng nối SKU, campaign, bảng tính) đi lên Google Sheets.

### Cấu trúc thư mục

```
index.html                 khung 5 tab + Cài đặt
css/app.css
js/app.js                  khởi động, chuyển tab, thanh trạng thái đồng bộ
js/core/                   (logic thuần, có test, không đụng giao diện)
  cong-thuc.js             CÔNG THỨC DUY NHẤT: lãi QC/không QC, giá cần, hòa vốn
  so.js                    đọc số "45.000"/"45,000", định dạng kiểu VN
  phi.js                   chọn bộ phí mới nhất có tháng ≤ tháng cần tính
  lam-tron.js              làm tròn lên/xuống/đuôi 9.000/sát dưới trần
  size.js                  đọc size, so sánh size lớn/nhỏ
  nhan-dien.js             Decal / Liễn / Laminate / ngoài phạm vi / cần gán
  gia-von.js               kiểm tra & so sánh khi nạp lại giá vốn
  campaign.js              chiến lược A/B/C, điều kiện "vào được", lý do loại
  set-gia.js               giá đề xuất, kiểm tra bậc giá
js/data/
  api.js                   gọi Apps Script (đọc/ghi, mật khẩu, báo lỗi rõ)
  kho.js                   cache localStorage + trạng thái đồng bộ
js/excel/
  doc.js                   đọc Excel (tự sửa lỗi kích thước sheet TikTok)
  prefill.js               ghi file đăng ký bằng sửa XML
  bao-cao.js               file báo cáo, file mẫu, file xuất
js/ui/                     mỗi tab 1 file + dom.js (tạo phần tử an toàn, không ghép chuỗi HTML)
vendor/                    xlsx.full.min.js, jszip.min.js (ghim phiên bản)
apps-script/Code.gs        dán vào Google Apps Script
tests/                     *.test.js
HUONG-DAN.md               (GĐ5)
```

## 5. Google Sheets (Apps Script quản lý)

| Sheet | Khóa | Cột |
|---|---|---|
| `DANH_MUC` | loai + ten | loai (GIAN/NGANH), ten, thu_tu, dang_dung |
| `BANG_PHI` | gian + nganh + thang | gian, nganh, thang (yyyy-mm), phi_san, phi_vc, phi_xl, phi_qc, aff_qc, aff_noqc, cap_nhat_luc |
| `GIA_VON` | nhom + phan_loai | nhom, phan_loai, nganh, gia_von, gia_ban, file_nguon, cap_nhat_luc |
| `NOI_SKU` | sku_id | sku_id, loai, nhom, phan_loai (size), so_luong, phan_loai_goc, seller_sku, ghi_chu, cap_nhat_luc |
| `CAMPAIGN` | id | id, ten, gian, bat_dau, ket_thuc, thang_phi, chien_luoc, tham_so (JSON: X%, làm tròn…), lai_toi_thieu, file_goc, tong_hop (JSON), trang_thai, xuat_luc, tao_luc |
| `CAMPAIGN_KQ` | campaign_id + sku_id | campaign_id, sku_id, product_id, ket_qua (VAO/LOAI/GAN/NGOAI), ly_do, loai, nhom, size, so_luong_tranh, gia_von, gia_ban_le, gia_campaign, so_luong, lai_qc, lai_noqc, ghi_chu |
| `BANG_TINH` | id | id, ten, gian_hien_thi, thang_phi, so_dong, cap_nhat_luc |
| `BANG_TINH_DONG` | bang_tinh_id + stt | bang_tinh_id, stt, ten, phan_loai, nganh, gia_von, gia_ban |
| `LICH_SU` | — | thoi_gian, hanh_dong, sheet, khoa, du_lieu_cu (JSON), du_lieu_moi (JSON) |

Quy tắc Apps Script:
- `GET ?action=docTatCa` → trả toàn bộ dữ liệu (chỉ cần URL).
- `POST {action, matKhau, banGhi[]}` → kiểm tra mật khẩu với **Script Properties** (`MAT_KHAU`); sai → trả lỗi, không ghi gì.
- Ghi theo **từng bản ghi** (upsert theo khóa), có `LockService`; ghi nhiều bản ghi trong 1 lần gọi (vd 80 dòng giá vốn) vẫn là upsert từng dòng.
- Mỗi bản ghi thay đổi → 1 dòng `LICH_SU`. Riêng kết quả campaign (~6.000 dòng) ghi 1 dòng tóm tắt để LICH_SU không phình.
- Trả `{ok:true, ...}` chỉ sau khi ghi xong; app chỉ báo "Đã lưu" khi nhận được `ok:true`.

## 6. Giai đoạn

| GĐ | Nội dung | Kết quả bàn giao |
|---|---|---|
| GĐ1 | `core/` (công thức, số, phí, làm tròn, size) + test; `Code.gs`; tab Bảng phí, Giá vốn, Cài đặt | test xanh, ảnh chụp 3 màn |
| GĐ2 | Tab Tính lợi nhuận + test 6 lỗi cũ | ảnh chụp, file xuất |
| GĐ3 | Tab Set giá | ảnh chụp, file xuất |
| GĐ4 | Tab Campaign (nhận diện, duyệt, file đăng ký, báo cáo) chạy thử với `mau/` | bảng đối chiếu số lượng, ảnh chụp |
| GĐ5 | `HUONG-DAN.md` | |
