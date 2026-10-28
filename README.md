# APP HUB - 3 ứng dụng chạy offline, cập nhật qua GitHub

**Đã tùy chỉnh từ ZIP của** `gptlohoi-del/App-Hub` (Vite/Capacitor 8), với ba module `smoodri`, `tapluyenpiano`, `kinhtest2`.

## 1. Cần làm trên GitHub (không cần Android Studio)

1. Sao lưu mã nguồn hiện tại của repo `https://github.com/gptlohoi-del/App-Hub`.
2. Giải nén file `App-Hub-ready.zip` tải từ ChatGPT, **chép nội dung bên trong** lên **gốc** repo `App-Hub`, không chỉ tải nguyên file zip lên GitHub. Cách dễ nhất: GitHub Desktop → Clone repo App-Hub → chép thư mục/tệp → Commit → Push. Đảm bảo thư mục `.github/workflows/` tồn tại trong repo sau khi đẩy.
3. Vào **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Vào **Actions → 2. Publish Offline Web OTA → Run workflow**, đợi thành công. Kiểm tra `https://gptlohoi-del.github.io/App-Hub/updates/latest.json` mở được.
5. Vào **Actions → 1. Build APK (Android) → Run workflow**, đợi thành công. Trong lần chạy vừa xong, phần **Artifacts**, tải `App-Hub-debug-APK` về; giải nén artifact này để lấy `app-debug.apk` rồi cài trên Android.
6. Tắt Wi-Fi và dữ liệu di động; mở App Hub, thử 3 app. Nếu bật Internet sau đó, App Hub tự kiểm tra bản cập nhật khi mở; có nút "Kiểm tra cập nhật" để kiểm tra thủ công.

**Quan trọng:** workflow APK ở đây cho ra *debug APK* dùng thử cá nhân, không phải APK release ký riêng để phát hành rộng rãi. Không thể xác nhận hoạt động trên cảm biến Android nếu chưa thử trên điện thoại.

## 2. Repo mới sẽ tự xuất hiện như thế nào?

- Tạo **repo công khai** trong cùng tài khoản `gptlohoi-del`.
- Repo chứa `index.html` ở thư mục gốc cùng tất cả tài nguyên cần cho offline.
- Tại mục **About → Topics**, gắn topic `app-hub-module`.
- (Khuyến nghị) Thêm `apphub.json` vào repo để đặt tên:

```json
{
  "id": "ten-repo-viet-thuong",
  "name": "Tên hiện trên App Hub",
  "version": "1.0.0",
  "description": "Chức năng offline",
  "entry": "index.html"
}
```

- Workflow `2. Publish Offline Web OTA` chạy định kỳ **mỗi 2 giờ** (GitHub Actions có thể trễ). Muốn cập nhật ngay, vào **Actions → Run workflow**.
- Khi `latest.json` thay đổi, APK đã cài sẽ tải trọn gói ZIP mới và áp dụng khi chuyển nền hoặc mở lại. Không buộc người dùng cài APK mới cho sửa đổi thuần HTML/CSS/JS.
- Mỗi lần tạo thêm repo chỉ chạy với repo tĩnh HTML/CSS/JS ở gốc. Repo có React, build riêng, phụ thuộc CDN hoặc API, quyền native mới phải được tích hợp thêm. Không dùng topic với code không tin cậy.

Ba repo ban đầu được khai báo sẵn trong `modules.config.json`, nên **không cần gắn topic** cho chúng. Các repo thêm sau tự được tìm bằng topic.

## 3. Các điều chỉnh chỉ trong bản sao dành cho APK

- Piano: đổi JSZip từ CDN thành bản nội bộ cài bằng npm; đọc danh sách bài MXL từ `apphub-files.json`; bỏ yêu cầu tải Google Fonts.
- Kinh: giữ cả 2 file MP3 (~29 MB), file phụ đề, IPA.txt; đọc danh sách bài MP3 từ `apphub-files.json`, không dựa vào việc liệt kê thư mục của website.
- Cả ba: chạy trong vùng cục bộ của APK; tắt đăng ký service worker PWA trong **bản đóng gói**, vì bộ nhớ cập nhật do Capacitor Updater quản lý.
- Repo gốc `smoodri`, `tapluyenpiano`, `kinhtest2` không bị thay đổi bởi bộ mã này.

## 4. Tổ chức và các chú ý

- `public/modules/`: bản sao các tính năng ban đầu, đồng thời sẽ được tạo lại trong GitHub Actions từ HEAD của 3 repo.
- `public/modules.json`: danh mục hiển thị trong APK, tạo lại mỗi lần build.
- `scripts/collect_modules.py`: tự lấy ZIP các repo công khai và chuẩn hóa cho offline.
- `scripts/publish_update.py`: đóng gói đầy đủ `dist/` thành một ZIP OTA (root ZIP có `index.html`) và manifest.
- `.github/workflows/build-apk.yml`: tạo APK debug khi bạn kích hoạt thủ công.
- `.github/workflows/publish-updates.yml`: tải repo mới, tạo, kiểm tra và đưa gói OTA lên GitHub Pages.
- `src/main.js`: màn hình App Hub và bộ kiểm tra OTA.

**Phiên bản nguồn:** file ZIP của người dùng tại thời điểm trò chuyện. GitHub Actions sau này lấy repo mới nhất theo mặc định.

**Lưu ý vận hành:**
- APK không phụ thuộc mạng để chạy các module và tệp đã đóng gói; còn tải cập nhật bắt buộc có mạng. Cần kiểm thử thực tế GPS/cảm biến/âm thanh trên Android.
- Bản cập nhật hiện là **nguyên gói** gồm cả MP3, ~28MB trở lên. Có thể tối ưu cập nhật từng tệp ở phiên bản sau.
- Không tắt app giữa lúc đang tải, trừ khi cần thiết; plugin giữ bản đang dùng nếu tải bản mới lỗi.
- Plugin `next()` có thể kích hoạt khi ứng dụng chuyển nền *hoặc* lần mở lại. Không sử dụng OTA để thay đổi mã native hoặc yêu cầu quyền Android mới.
- `localStorage` do những app gốc sử dụng tồn tại trên WebView origin của App Hub. Giữ nguyên appId `vn.gptlohoi.apphub` cho các bản APK tiếp theo để tránh dữ liệu bị đổi vùng lưu trữ.
- Chỉ phát hành mã nguồn bạn có quyền phân phối; tệp nhạc/bản ghi âm cần quyền sử dụng phù hợp. Plugin OTA cũng cần phù hợp quy định nếu đưa lên Google Play.
- GitHub Actions/Pages có hạn mức dịch vụ; Github token mặc định có thể không đọc repo private.

## 5. Chạy trên máy tính khi cần

```bash
npm install
python scripts/collect_modules.py   # tải lại 3 repo công khai qua GitHub API
npm run dev
```

Muốn xem bản build Web thực tế: `npm run build && npm run preview`.
Để tự tạo Android: `npm run build && npx cap add android && npx cap sync android`.

**Tài liệu:** https://capacitorjs.com/docs ; https://capgo.app/docs/plugins/updater/ ; https://docs.github.com/en/pages
