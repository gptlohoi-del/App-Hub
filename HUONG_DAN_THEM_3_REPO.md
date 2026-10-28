# APP HUB — Bổ sung 3 repo (linktong, thoisao, tungkinh)

## Thành phần

Bản vá này bổ sung 3 repo mới, giữ 3 repo trước đó:
- smoodri
- tapluyenpiano
- kinhtest2
- linktong — danh mục liên kết (danh mục offline; trang web bên ngoài cần mạng)
- thoisao — nhạc MP3 + phụ đề được đóng gói offline
- tungkinh — dữ liệu `data.js` + CSS Tailwind + bộ tạo QR lưu cục bộ

Bản vá có các thư mục mới `public/modules/linktong`, `public/modules/thoisao`, `public/modules/tungkinh`, và cập nhật:
- `modules.config.json`
- `package.json` (thêm `tailwindcss` để biên dịch CSS offline cho `tungkinh`)
- `scripts/collect_modules.py`
- `scripts/generate_tailwind_css.mjs`
- `scripts/vendor/*`
- `src/main.js` (điều hướng từ linktong sang các module đã đóng gói)
- `public/modules.json`
- `public/modules/tapluyenpiano/vendor/jszip.min.js` (bổ sung file thư viện offline)

**Không chứa** `.github/workflows/` để **không ghi đè** workflow release có ký APK mà bạn đã cấu hình trước đây.
Không chứa `.jks` hoặc GitHub Secrets.

## Cách cập nhật repository trên GitHub

1. Sao lưu repository App-Hub hiện tại (tốt nhất clone bằng GitHub Desktop).
2. Giải nén `App-Hub-them-3-repo.zip`.
3. Chép **các nội dung bên trong** thư mục ZIP vào **thư mục gốc** của repo App-Hub, chọn ghi đè file trùng tên. Giữ nguyên `.github/workflows/` hiện tại.
4. Commit và push lên nhánh `main`.
5. Trong GitHub Actions của `App-Hub`, chọn `2. Publish Offline Web OTA` > `Run workflow` (hoặc đợi workflow tự chạy khi push). Chờ status màu xanh.
6. Mở **APK App Hub hiện đã cài** khi có Internet, nhấn kiểm tra cập nhật, chờ tải hoàn thành và **mở lại** App Hub.
7. Kiểm tra 6 tính năng; tắt Internet rồi thử lại `thoisao` và `tungkinh`. Trình phát MP3 có thể cần người dùng bấm Play trước theo chính sách Android.

## Rất quan trọng

- **Không cần tải APK mới** nếu APK hiện tại đã hoạt động với Web OTA và tương thích với gói Web mới. Đây là cập nhật giao diện/module, không thêm mã native.
- Nếu APK hiện tại **chưa được xác nhận tự cập nhật OTA** thì thay đổi GitHub không tự làm APK có tính năng mới. Cần kiểm tra OTA thực tế trước; không thể khẳng định APK đã cập nhật chỉ vì GitHub Actions hiện xanh.
- `linktong`: các website ngoài App Hub vẫn cần mạng; những link đến repo đã tích hợp được ưu tiên mở module nội bộ.
- `tungkinh`: tạo QR trong ứng dụng hoạt động offline, nhưng người nhận muốn truy cập URL chia sẻ trên máy khác cần mạng. Các URL chia sẻ dùng địa chỉ GitHub Pages công khai, không dùng `localhost` trong APK.
- Bộ CSS của `tungkinh` được biên dịch lại tự động từ HTML mỗi lần tập hợp repo; giữ `tailwindcss` trong `package.json`.
- Repo `tungkinh` có một file `.rar` không được App Hub sử dụng, nên bản đóng gói bỏ qua file đó.
- Bản vá **chưa triển khai** PiP và chạy nền; đó là nâng cấp native riêng và cần APK mới khi thực hiện.

## Lần sau muốn thêm repo mới mà không gửi link

1. Repo nằm trong cùng tài khoản GitHub `gptlohoi-del`.
2. Repo công khai, có file `index.html` ở thư mục gốc, và tài nguyên cần thiết có thể đóng gói offline.
3. Trên trang repo, vào About > Topics, thêm **`app-hub-module`**.
4. App Hub đã có `autoDiscoverByTopic: true` trong `modules.config.json`. Lần chạy `2. Publish Offline Web OTA` tiếp theo sẽ quét topic, tổng hợp mã nguồn rồi phân phối bản cập nhật mới.

Lưu ý: repo mới với phụ thuộc CDN, API, permission native hoặc cấu trúc đặc biệt có thể cần điều chỉnh trước khi hoạt động offline; không phải repo bất kỳ đều tự tương thích hoàn toàn.
