# Hướng dẫn sử dụng — Bảng giá & Lợi nhuận

Tài liệu dành cho người **không biết code**. Làm lần lượt từ trên xuống; phần 1–4 chỉ cần làm **một lần**.

---

## Mục lục

1. [App gồm những gì, dữ liệu nằm ở đâu](#1-app-gồm-những-gì-dữ-liệu-nằm-ở-đâu)
2. [Tạo Google Sheets và dán Apps Script](#2-tạo-google-sheets-và-dán-apps-script)
3. [Bật GitHub Pages để có đường link app](#3-bật-github-pages-để-có-đường-link-app)
4. [Mở app lần đầu](#4-mở-app-lần-đầu)
5. [Cách dùng hằng ngày](#5-cách-dùng-hằng-ngày)
6. [Cập nhật Code.gs khi có phiên bản mới](#6-cập-nhật-codegs-khi-có-phiên-bản-mới)
7. [Đổi mật khẩu, xem lịch sử, sao lưu](#7-đổi-mật-khẩu-xem-lịch-sử-sao-lưu)
8. [Lỗi thường gặp](#8-lỗi-thường-gặp)
9. [Dành cho người phát triển](#9-dành-cho-người-phát-triển)

---

## 1. App gồm những gì, dữ liệu nằm ở đâu

| Thành phần | Nằm ở đâu | Ghi chú |
|---|---|---|
| **App** (giao diện, cách tính) | GitHub Pages — một đường link web | Repo public: ai có link đều mở được app, nhưng **không thấy dữ liệu** nếu không có URL Apps Script |
| **Dữ liệu dùng chung** (bảng phí, giá vốn, gán tay SKU, campaign, bảng tính đã lưu, lịch sử) | Google Sheets **của shop** | Truy cập qua Google Apps Script (Web App) |
| **URL Apps Script + mật khẩu** | Trình duyệt **từng máy** (nhập ở ⚙️ Cài đặt) | Không bao giờ nằm trong code |
| **File Excel** bạn thả vào (prefill, file sản phẩm, giá vốn…) | Chỉ trong trình duyệt | Không gửi lên máy chủ nào |

> ⚠️ **Giữ kín URL Apps Script.** Ai có URL là **xem được** bảng phí, giá vốn (xem không cần mật khẩu). Muốn **sửa / lưu / xóa** thì phải có mật khẩu.

---

## 2. Tạo Google Sheets và dán Apps Script

### 2.1. Tạo file Google Sheets
1. Vào <https://sheets.google.com> bằng tài khoản Google **của shop** → **Trống** (Blank).
2. Đặt tên, ví dụ `Bang gia loi nhuan - DU LIEU`.

### 2.2. Dán Apps Script
1. Trong file Sheets vừa tạo: menu **Tiện ích mở rộng** (Extensions) → **Apps Script**.
2. Tab mới mở ra, có sẵn file `Code.gs` với vài dòng `function myFunction() {}` → **xóa hết**.
3. Mở file [`apps-script/Code.gs`](apps-script/Code.gs) trong repo này trên GitHub → bấm nút **Copy raw file** (biểu tượng 2 tờ giấy) → quay lại Apps Script → **dán** vào.
4. Bấm 💾 **Lưu** (hoặc Ctrl + S). Đặt tên dự án nếu được hỏi, ví dụ `Bang gia API`.

### 2.3. Đặt mật khẩu
1. Bên trái màn hình Apps Script, bấm ⚙️ **Cài đặt dự án** (Project Settings).
2. Kéo xuống **Thuộc tính của tập lệnh** (Script properties) → **Thêm thuộc tính**:
   - **Thuộc tính** (Property): `MAT_KHAU` — viết HOA, đúng như vậy.
   - **Giá trị** (Value): mật khẩu bạn chọn (nên dài, khó đoán; ví dụ 4 từ ngẫu nhiên ghép lại).
3. Bấm **Lưu thuộc tính tập lệnh**.

> Mật khẩu chỉ nằm trong Apps Script. Sai mật khẩu quá 10 lần thì bị khóa 10 phút.

### 2.4. Tạo sẵn các sheet (không bắt buộc, nhưng nên làm)
1. Quay lại trình soạn thảo (biểu tượng `< >` bên trái).
2. Ở thanh trên cùng, ô chọn hàm → chọn **`taoCacSheet`** → bấm ▶ **Chạy**.
3. Lần đầu Google sẽ hỏi quyền: **Xem xét quyền** → chọn tài khoản → nếu thấy "Google chưa xác minh ứng dụng này" bấm **Nâng cao** → **Đi tới … (không an toàn)** → **Cho phép**. (Đây là script của chính bạn nên an toàn.)
4. Mở lại file Sheets: sẽ có các sheet `DANH_MUC`, `BANG_PHI`, `GIA_VON`, `NOI_SKU`, `CAMPAIGN`, `CAMPAIGN_KQ`, `BANG_TINH`, `BANG_TINH_DONG`, `LICH_SU`.

> **Không sửa tay** tên sheet, dòng tiêu đề (dòng 1) hay thứ tự cột. Muốn sửa số liệu thì sửa trong app để có lịch sử.

### 2.5. Triển khai Web App (lấy URL)
1. Góc trên bên phải: **Triển khai** (Deploy) → **Tùy chọn triển khai mới** (New deployment).
2. Bấm ⚙️ cạnh "Chọn loại" → **Ứng dụng web** (Web app).
3. Điền:
   - **Mô tả**: `v1`
   - **Thực thi dưới dạng** (Execute as): **Tôi** (Me — tài khoản của bạn)
   - **Người có quyền truy cập** (Who has access): **Bất kỳ ai** (Anyone)
4. **Triển khai** → (cho phép quyền nếu được hỏi) → copy **URL ứng dụng web**, có dạng
   `https://script.google.com/macros/s/AKfy…/exec`
5. Lưu URL này ở chỗ an toàn (ví dụ ghi chú riêng). **Không** dán vào code, không đăng công khai.

---

## 3. Bật GitHub Pages để có đường link app

1. Mở repo trên GitHub → **Settings** (Cài đặt) → mục **Pages** (cột trái).
2. **Source**: chọn **Deploy from a branch**.
3. **Branch**: chọn nhánh đang dùng (hiện tại: `claude/cool-ride-vkco99`; sau này nếu gộp vào `main` thì chọn `main`) → thư mục **`/ (root)`** → **Save**.
4. Chờ 1–2 phút, tải lại trang: GitHub hiện link dạng
   `https://nsspace-dot.github.io/bang-gia-loi-nhuan/`
5. Mở link đó → app hiện ra. Lưu link vào dấu trang (bookmark).

> Mỗi lần có code mới đẩy lên nhánh đó, GitHub Pages tự cập nhật sau 1–2 phút. Nếu app chưa đổi, bấm **Ctrl + F5** để tải lại.
>
> Repo đã có file `.nojekyll` — **đừng xóa** (để GitHub phục vụ nguyên trạng các file).

---

## 4. Mở app lần đầu

Làm trên **mỗi máy** sẽ dùng app.

1. Mở link app → cửa sổ **⚙️ Cài đặt** tự hiện (hoặc bấm ⚙️ góc phải trên).
2. Dán **URL Apps Script** (bước 2.5).
3. Nhập **mật khẩu** (bước 2.3). Máy dùng chung thì **đừng tích** "Nhớ mật khẩu" (khi đó phải nhập lại mỗi lần mở trình duyệt).
4. Bấm **Kiểm tra kết nối** → phải thấy 2 dòng xanh: "Kết nối được Apps Script" và "Mật khẩu đúng".
5. Bấm **Lưu cài đặt**. Góc trên phải hiện 🟢 **Đã đồng bộ hh:mm**.

### 4.1. Nạp bảng phí ban đầu
1. Tab **💸 Bảng phí** → **📥 Nhập từ Excel** → chọn file `bang-phi-khoi-tao.xlsx` (file đã gửi riêng, không có trong repo).
2. Xác nhận **Lưu 17 bộ phí** → thông báo "Đã lưu…".
3. Kiểm tra lại từng gian. Sửa ô nào thì ô đó tô vàng; bấm **💾 Lưu bộ phí tháng …**.

### 4.2. Nạp giá vốn
1. Tab **📦 Giá vốn** → kéo thả các file `Von_Laminate.xlsx`, `Von_Lien.xlsx`, `Von_Decal.xlsx` (thả nhiều file cùng lúc được).
2. Màn **Xem trước** liệt kê: thêm mới / thay đổi (giá cũ → mới) / giữ nguyên / dòng lỗi, kèm cảnh báo "size lớn mà vốn rẻ hơn".
3. Bấm **💾 Lưu … thay đổi**.

---

## 5. Cách dùng hằng ngày

### Thanh trạng thái (góc phải trên)
- 🟢 **Đã đồng bộ hh:mm** — dữ liệu mới nhất từ Google Sheets.
- 🟡 **Đang đồng bộ…**
- 🔴 **Lỗi đồng bộ** — rê chuột để xem lý do; app vẫn chạy bằng dữ liệu tạm lần trước. Bấm vào để thử lại.

App **chỉ báo "Đã lưu"** khi Google Sheets xác nhận thành công. Thấy "**CHƯA lưu được: …**" nghĩa là chưa lưu — đọc lý do và làm lại.

### Nhập số nhanh (mọi bảng)
- Gõ số kiểu nào cũng được: `8,14` hoặc `8.14` (%), `2.008` hoặc `2008` (đ). App tự chuẩn hóa khi bạn **rời ô** hoặc bấm **Enter**.
- **Enter** hoặc **Tab**: sang ô kế tiếp · **Shift + Enter**: về ô trước · **Esc**: hủy phần đang gõ.
- Lăn chuột hay bấm ↑↓ trong ô **không** làm đổi số.
- Ô tô vàng = đã sửa, chưa lưu. Ô tô đỏ = nhập sai (rê chuột để xem lý do).
- App tự đồng bộ với Google Sheets 5 phút/lần. Nếu bạn đang sửa dở, app **không** tự làm mới bảng mà hiện thông báo nhỏ góc trái dưới **"Có dữ liệu mới từ Google Sheets — Tải lại"**. Bấm **Tải lại** khi tiện; số bạn đang sửa vẫn được giữ.

### 💸 Bảng phí
- Chọn **gian** → chọn **tháng áp dụng** → sửa → **Lưu**.
- Phí tháng mới **không** xóa phí tháng cũ. Khi tính, app dùng **bộ phí mới nhất có tháng áp dụng ≤ tháng đang tính**.
- Ví dụ: sàn tăng phí từ 11/2026 → chọn tháng `11/2026`, sửa ngành bị đổi, Lưu. Ngành không sửa vẫn dùng bộ phí cũ.
- **Gian hàng & ngành (thêm / bớt)** ở cuối trang.

### 📦 Giá vốn
- Bộ phận giá vốn gửi file mới → thả vào → xem trước → Lưu. Chỉ dòng thay đổi được ghi (có lịch sử).
- Sửa nhanh 1 dòng: bấm ✏️ → gõ giá → Enter.

### 🧮 Tính lợi nhuận
- Thả file Excel sản phẩm (cột: Tên sản phẩm | Phân loại | Ngành hàng | Giá vốn | Giá bán) hoặc **➕ Thêm dòng**. Bấm **📄 File mẫu** để lấy mẫu.
- Lãi tính theo **bộ phí đang áp dụng hiện tại**, cho từng gian (bấm tên gian để ẩn / hiện).
- **Chỉ dòng lỗ**: lọc nhanh. Bấm tiêu đề cột **Có QC / Không QC** của một gian để sắp xếp theo lãi.
- **💾 Lưu lên Sheets**: đặt tên bảng tính để mở lại trên máy khác (**📂 Mở bảng tính**). Bản nháp vẫn tự giữ trên máy đang dùng.
- **📤 Xuất Excel**: 5 cột đầu đúng mẫu nhập (nhập lại được) + lãi từng gian.

### 🏷️ Set giá
1. Chọn nhóm giá vốn đã lưu (hoặc thả file giá vốn).
2. Chọn gian, mức lãi mong muốn (% trên giá hoặc đ/đơn), kịch bản (Có QC / Không QC / Cả 2), cách làm tròn.
3. Xem **giá đề xuất**, lãi, **giá hòa vốn**, **giảm tối đa còn hòa vốn**. Dòng tô vàng = **sai bậc giá** (size lớn rẻ hơn size nhỏ, hoặc bộ 3 tấm không rẻ hơn 3 × bộ 1 tấm).
4. Muốn chỉnh giá size nào thì gõ vào cột **Giá chốt**.
5. **📤 Xuất file**: sheet "Sản phẩm" đúng mẫu nhập tab Tính lợi nhuận (để kiểm chứng).

### 🎯 Campaign
1. **＋ Campaign mới** (hoặc **Nhân bản cài đặt** từ campaign cũ).
2. **Thông tin**: tên, gian, ngày bắt đầu – kết thúc. *Tháng phí* tự lấy theo ngày bắt đầu (sửa được).
3. **File**: thả **file prefill** TikTok + **các file sản phẩm** `all_information` (thả nhiều file một lúc). Phải thấy "Tìm thấy X / X SKU".
4. **Cài đặt giá**:
   - **A** — giảm cố định X% so với giá bán lẻ (làm tròn xuống; vượt trần thì hạ sát dưới trần).
   - **B** — giá thấp nhất mà cả có QC và không QC vẫn đạt lãi tối thiểu (làm tròn lên).
   - **C** — sát dưới trần.
   - **Lãi tối thiểu**: nhập **mỗi lần**.
   - **Làm tròn**: 100 / 500 / 1.000.
5. **🧮 Tính giá campaign** → màn duyệt có 4 ô: ✅ Vào được · ❌ Bị loại · ❓ Cần gán · ⊘ Ngoài phạm vi (bấm để xem).
   - Sửa **giá** / **số lượng** từng dòng: lãi tính lại ngay. Bỏ tích ✓ để loại 1 dòng.
   - Nhãn **"suy ra từ tên"**: app đoán từ tên sản phẩm (vd "Bộ 3 tấm") — nên kiểm tra lại.
   - **❓ Cần gán**: chọn nhóm + size + số tranh/tấm → **Gán** (lưu theo SKU, lần sau tự nhận). Có nút **Áp dụng cùng phân loại** và **Gán cho cả sản phẩm**.
   - **Chỉ dòng có cảnh báo**: giá bán lẻ lẻ (không chia hết 1.000), SKU đang ở campaign khác trùng thời gian với giá khác, SKU lần trước vào được mà lần này bị loại.
6. **✅ Xuất cả 2 file & lưu**:
   - `<tên>_dang-ky.xlsx` — giữ nguyên cấu trúc file TikTok, chỉ điền Campaign price (số) + Campaign stock và **xóa dòng không vào được**. Tải file này lên TikTok.
   - `<tên>_bao-cao.xlsx` — Tổng hợp, Vào được, Bị loại, Cần gán.
   - Kết quả lưu lên Google Sheets để xem lại / so sánh lần sau.

---

## 6. Cập nhật Code.gs khi có phiên bản mới

Chỉ làm khi được báo **"Code.gs có thay đổi"**. **KHÔNG tạo triển khai mới** — làm như sau để **giữ nguyên URL**:

1. Mở file Google Sheets → **Tiện ích mở rộng** → **Apps Script**.
2. Mở `Code.gs` → **xóa hết** → dán nội dung mới từ [`apps-script/Code.gs`](apps-script/Code.gs) → 💾 **Lưu**.
3. **Triển khai** (Deploy) → **Quản lý các bản triển khai** (Manage deployments).
4. Chọn bản triển khai đang dùng → bấm ✏️ **Chỉnh sửa** (Edit).
5. Ô **Phiên bản** (Version) → chọn **Phiên bản mới** (New version) → **Triển khai** (Deploy).
6. URL **giữ nguyên** — không cần nhập lại ở các máy.
7. Kiểm tra: mở app → ⚙️ Cài đặt → **Kiểm tra kết nối** → xem số phiên bản.

> ❌ Nếu lỡ bấm "Tùy chọn triển khai mới" thì sẽ ra **URL mới**; các máy phải nhập lại URL. Bản cũ vẫn chạy code cũ.

---

## 7. Đổi mật khẩu, xem lịch sử, sao lưu

- **Đổi mật khẩu**: Apps Script → ⚙️ Cài đặt dự án → Thuộc tính tập lệnh → sửa giá trị `MAT_KHAU` → Lưu. Không cần triển khai lại. Sau đó nhập mật khẩu mới ở ⚙️ Cài đặt trên mỗi máy.
- **Lịch sử**: sheet `LICH_SU` — mỗi lần thêm / sửa / xóa có: thời gian, hành động (THEM / SUA / XOA), sheet, khóa, dữ liệu cũ, dữ liệu mới. Lưu campaign / bảng tính ghi 1 dòng tóm tắt.
- **Sao lưu**: Google Sheets → **Tệp** → **Tạo bản sao**, hoặc **Tải xuống** → Excel. Nên làm hằng tháng.
- **Dung lượng**: mỗi campaign lưu khoảng 6.000 dòng kết quả. Google Sheets giới hạn 10 triệu ô (đủ vài chục campaign). Khi sheet `CAMPAIGN_KQ` quá lớn, sao lưu file rồi xóa bớt dòng của các campaign cũ.

---

## 8. Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| Không kết nối được Apps Script | Mất mạng, URL sai, chưa triển khai | Kiểm tra mạng; URL phải kết thúc bằng `/exec`; làm lại bước 2.5 |
| Apps Script trả về trang web thay vì dữ liệu | Quyền truy cập không phải "Bất kỳ ai" | Quản lý các bản triển khai → Chỉnh sửa → "Bất kỳ ai" → Phiên bản mới |
| Chưa đặt mật khẩu | Thiếu thuộc tính `MAT_KHAU` | Làm bước 2.3 |
| Sai mật khẩu / Sai quá nhiều lần | Gõ sai | Kiểm tra lại; bị khóa thì chờ 10 phút |
| Máy chủ đang bận | Người khác đang lưu cùng lúc | Chờ vài giây, bấm lưu lại |
| chưa có phí (trong bảng) | Gian/ngành chưa có bộ phí ≤ tháng đang tính | Tab Bảng phí → nhập phí cho ngành đó |
| Không thấy sheet "Template" | Thả nhầm file vào ô file sản phẩm | Dùng file `…all_information….xlsx` tải từ TikTok |
| Tìm thấy ít SKU hơn trong file sản phẩm | Thiếu file sản phẩm | Tải đủ các file `all_information` của gian rồi thả thêm |
| App không đổi sau khi cập nhật | Trình duyệt giữ bản cũ | Ctrl + F5 |

---

## 9. Dành cho người phát triển

- Web tĩnh, **không cần build**. Thư viện nằm trong `vendor/` (SheetJS 0.20.3, JSZip 3.10.1), font trong `fonts/`.
- Chạy thử trên máy (Node 20+), có Apps Script giả lập + dữ liệu giả:
  ```
  node scripts/may-chu-thu.mjs 8080 --du-lieu-gia
  ```
  Mở <http://localhost:8080> — URL Apps Script: `http://localhost:8080/gas`, mật khẩu `mat-khau-thu`.
- Test: `node --test "tests/*.test.js"` (test trình duyệt tự bỏ qua nếu máy không có Playwright).
- File mẫu thật để trong `mau/` (đã chặn bằng `.gitignore`). **Repo public — không commit số liệu kinh doanh, URL Apps Script, mật khẩu.**
- Chi tiết thiết kế: [docs/KE-HOACH.md](docs/KE-HOACH.md).
