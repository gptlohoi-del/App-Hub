# SỬA LỖI CÀI ĐẶT PiP BIẾN MẤT / PiP VẪN NHƯ CŨ

## Nguyên nhân đã xác định trong hai file ZIP gửi ngày 30/10/2026

- App Hub `index.html` trỏ đến `/src/main.js` nhưng phiên bản có PiP mới lại nằm tại `main.js` ở THƯ MỤC GỐC.
- CSS PiP tùy chỉnh nằm tại `style.css` ở gốc, còn `src/style.css` vẫn cũ.
- `scripts/collect_modules.py` lấy script cầu nối từ `scripts/vendor/apphub-smoodri-native-bridge.js`, nhưng file này vẫn cũ và không gửi cấu hình PiP; file cầu nối mới nằm nhầm ở gốc.
- Tương tự, native plugin và `MainActivity` mới nằm nhầm ở gốc, còn hai file nguồn `native/smoodri/java/` mà workflow dùng vẫn là bản cũ.
- Bản SmooDri trong `public/modules/smoodri` của ZIP App Hub cũng là bản cũ. Mỗi lần chạy Actions, `scripts/collect_modules.py` TẢI LẠI SmooDri từ repo GitHub: nếu bản trên GitHub còn cũ, bản OTA sẽ mất mục Cài đặt PiP.

## Cách sửa bằng trình duyệt GitHub (không dùng GitHub Desktop)

1. Mở repo **SmooDri** trên GitHub. Xác nhận `index.html` có `id="selPipRatio"` và `app.js` có `function bindPipSettings()`. Nếu chưa có, upload lại hai file từ ZIP `smoodri-main (3).zip` đã gửi.
2. Mở repo **App-Hub**. Upload **6 file mã nguồn** trong ZIP này vào đúng đường dẫn, ghi đè file cũ. KHÔNG upload trực tiếp toàn bộ ZIP như một file nén ở gốc, cũng không đưa nội dung vào gốc sai đường dẫn.
3. Chạy **2. Publish Offline Web OTA**, khi online mở App Hub > Kiểm tra cập nhật > kích hoạt phiên bản mới. Việc này sửa giao diện PiP, chuyển cấu hình màu/chữ/ẩn hiện và phục hồi Cài đặt PiP từ bản SmooDri hiện hành.
4. Nếu muốn tỷ lệ PiP (16:9, 4:3, 1:1) thay đổi thực sự trên Android, sau khi xác nhận OTA hoạt động hãy chạy **1. Build APK (Android Release Signed)** để đưa phương thức native `setAspectRatio` vào APK. Cài APK mới với cùng chữ ký, có thể phải xin phép quản trị viên.

## Kiểm tra nhanh
- Vào App Hub, kéo xuống cuối trang: sẽ thấy nhãn giao diện `PiP tùy chỉnh · 30/10/2026` sau khi OTA thành công.
- Mở SmooDri > Cài đặt, chỉnh màu PiP sang đỏ hoặc xanh khác biệt và bỏ chọn GA.
- Bắt đầu đo, mở PiP: màu thay đổi và chỉ số GA phải biến mất.
- Mở lại Cài đặt: tùy chọn PiP vẫn còn và vẫn lưu.

## Giới hạn
- Chưa biên dịch APK/kiểm thử trên máy Android. PiP native có thể chịu chính sách của thiết bị; tỷ lệ thực tế do hệ thống quyết định.
- Tốc độ Web trong PiP sẽ hiện `--` nếu WebView không có dữ liệu GPS mới; không mô phỏng dữ liệu sai.
- Lỗi mất mục Cài đặt có thể còn do một bản OTA đã kích hoạt hoặc cache cũ trên điện thoại; bản vá bảo vệ những lần Publish tiếp theo, nhưng cần cập nhật OTA thành công trên điện thoại.
- Không thay đổi cơ chế ký, quyền GPS, Foreground Service và hành động KẾT THÚC PiP.
