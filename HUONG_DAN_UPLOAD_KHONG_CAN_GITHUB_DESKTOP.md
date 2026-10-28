# APP HUB – BẢN ĐẦY ĐỦ PiP + Foreground Service + OTA

Bộ này được ghép từ ZIP `App-Hub-main(2).zip` bạn đã gửi và bản vá PiP/Foreground Service; dùng để thay các tệp trong `gptlohoi-del/App-Hub` bằng trình duyệt, không cần GitHub Desktop.

## 1. Đưa toàn bộ file lên GitHub bằng trình duyệt

1. Sao lưu repo đang có: tại https://github.com/gptlohoi-del/App-Hub chọn **Code → Download ZIP**.
2. Giải nén `App-Hub-FULL-PiP-FGS-OTA.zip`. **Không** upload nguyên tệp ZIP lên GitHub; phải upload nội dung bên trong.
3. Windows File Explorer: **View → Show → Hidden items** để thấy `.github`.
4. Mở https://github.com/gptlohoi-del/App-Hub và bảo đảm đang ở nhánh `main`.
5. Chọn **Add file → Upload files**. Trong thư mục giải nén, chọn **tất cả nội dung bên trong** (các thư mục `.github`, `src`, `scripts`, `native`, `public` và các file ở thư mục gốc). Kéo thả lên trang Upload files. **Không kéo thư mục cha** để tránh tạo nhầm `App-Hub/App-Hub/`.
6. Kiểm tra trên trang upload có các file `.github/workflows/build-apk.yml`, `scripts/install_smoodri_motion.py`, `native/smoodri/java/MainActivity.java`, `src/main.js` và `public/modules/smoodri/index.html`.
7. Commit lên `main` với thông điệp `Integrate SmooDri PiP and foreground sensor service`.

GitHub giới hạn 100 file / lần upload và 25 MiB / file. Bộ ZIP này có ít hơn 100 file và không có file riêng nào quá 25 MiB. Nếu trình duyệt báo lỗi do file trùng, hãy dùng trình biên tập **https://github.dev/gptlohoi-del/App-Hub** và kéo thả các thư mục vào Explorer, chọn thay thế các file trùng, rồi commit bằng tab Source Control. Không xóa nhầm file cũ khác và không xóa Secrets.

## 2. Build APK một lần để có tính năng native

1. Mở https://github.com/gptlohoi-del/App-Hub/actions.
2. Chọn `1. Build APK (Android Release Signed)` → `Run workflow` trên `main`.
3. Trong log phải thấy bước `Install SmooDri Foreground Service and Picture-in-Picture`, tiếp theo `Build unsigned release APK`, `Sign and verify release APK`, `UPLOAD signed release APK to GitHub` thành công.
4. Ở trang Summary → Artifacts, tải `App-Hub-release-APK`, giải nén lấy `App-Hub-release.apk`.
5. Cài đè nếu cùng `applicationId`, chữ ký và `versionCode` tăng. Sao lưu dữ liệu quan trọng trước; không gỡ App Hub khi chưa cần thiết.

## 3. Cách thử

- Khi xe đã dừng, mở App Hub → SmooDri → nhấn `BẮT ĐẦU`.
- Nếu có yêu cầu quyền thông báo hợp lệ, đồng ý để thấy thông báo đo nền và nút DỪNG ĐO.
- Đợi trạng thái đo nền hoạt động, thử nút **`◱ Thu nhỏ PiP`** trên thanh App Hub. Bạn cũng có thể nhấn Home khi đang đo; Android phải hỗ trợ và cho phép PiP.
- PiP hiển thị **chỉ số native ước lượng**, chưa phải đúng thuật toán Web SmooDri. Quan sát thông báo Android khi chuyển sang ứng dụng khác hoặc tắt màn hình; Android có thể giới hạn dịch vụ tùy nhà sản xuất.
- Quay lại và nhấn DỪNG trên SmooDri hoặc thông báo Android để kết thúc phiên; không thao tác khi đang lái xe.
- Kiểm tra cập nhật OTA riêng bằng một lần sửa nhỏ HTML/CSS rồi chạy workflow `2. Publish Offline Web OTA`. Không cần build APK mới cho sửa giao diện thuần Web, nếu OTA đang hoạt động.

## 4. Những lưu ý kỹ thuật

- APK mới là bắt buộc để **thêm native plugin** lần này. Cơ chế OTA không thể tự thêm Java native vào APK cũ.
- App Hub hiện có 6 repository được ghim trong `modules.config.json` (`smoodri`, `tapluyenpiano`, `kinhtest2`, `linktong`, `thoisao`, `tungkinh`), và có thể tự tìm thêm repo theo topic. Các module được đóng gói offline; link website ngoài vẫn cần mạng.
- `src/main.js` và `src/style.css` mới là các file được Vite sử dụng. Các file `main.js`, `style.css` tại thư mục gốc được đồng bộ cho nhất quán nhưng không phải nguồn build.
- GitHub Actions tự tải lại bản PWA gốc của các repo để build và chèn bridge SmooDri vào bản sao offline. `smoodri` gốc không bị sửa.
- Chưa có xác nhận đã **biên dịch APK thật** hoặc thử cảm biến/PiP trên điện thoại thực tế tại thời điểm tạo bộ mã nguồn. Script Android đã được chạy thử với cấu trúc Android mẫu; cần quan sát log Gradle khi build.
- Không đưa mật khẩu, token hoặc file `*.jks` lên GitHub. Repo ZIP này không chứa khóa ký. Ba Secrets ký APK hiện có phải được giữ lại trong Settings → Secrets and variables → Actions.
