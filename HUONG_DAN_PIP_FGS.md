# App Hub – GỘP Picture-in-Picture + SmooDri Foreground Service

**Đầu vào:** Bản `App-Hub-main(2).zip` của bạn. Bản vá này chỉ thêm/thay **14 file**; không xóa bất kỳ repo PWA nào và không cần sửa repo smoodri gốc.

## Các tính năng

- Bắt đầu SmooDri trong App Hub sẽ yêu cầu chạy Foreground Service đọc gia tốc kế/linear acceleration bằng Android native (khi người dùng chủ động nhấn BẮT ĐẦU).
- Android hiển thị thông báo `SmooDri · Đang đo nền` và nút **DỪNG ĐO**. Dịch vụ độc lập với WebView; có cơ chế Wake Lock trong phiên (tối đa 12 giờ) và dừng khi người dùng yêu cầu.
- Khi **đang đo**, nhấn nút **◱ PiP** hoặc chuyển sang Home/ứng dụng khác để thu nhỏ trên điện thoại có hỗ trợ PiP và cho phép tính năng đó.
- Trong cửa sổ nhỏ hiển thị **điểm tham khảo, GA, PHANH, CUA, Ổ GÀ** do dịch vụ native tính toán. Đây là **ước lượng riêng**, chưa đồng nhất với điểm từ thuật toán Web SmooDri.
- Mở lại App Hub sẽ trở về giao diện bình thường; nếu tắt màn hình, cửa sổ PiP biến mất nhưng dịch vụ có thể tiếp tục theo dõi thông qua thông báo Android.
- Vẫn giữ phần OTA checksum, chẩn đoán lỗi, 6 repo hiện có, và workflow release ký APK.

## Cách cài đặt (không yêu cầu ghi đè toàn bộ App Hub)

1. **Sao lưu** repo App-Hub hiện tại. Có thể tạo nhánh mới để kiểm tra trước khi áp dụng vào `main`.
2. Giải nén bản vá này và sao chép **toàn bộ các file bên trong** vào các đường dẫn cùng tên trong repo `App-Hub`, chọn thay thế file cũ. Không chép thư mục cha vào repo. Các file `.github` có thể bị ẩn trên Windows.
3. Commit và Push, chạy workflow **1. Build APK (Android Release Signed)** từ `main` (không phải Re-run một lần chạy cũ).
4. Bước **Install SmooDri Foreground Service and Picture-in-Picture** phải có dấu xanh trước khi chạy Gradle, rồi bước ký và Upload Artifact đều phải thành công.
5. Tải `App-Hub-release-APK`, giải nén, cài đè bản release hiện tại nếu cùng package, cùng keystore và versionCode cao hơn. Sao lưu dữ liệu người dùng trước; đừng gỡ/xóa dữ liệu khi không cần thiết.

## Kiểm thử lần đầu (khi xe đã dừng)

1. Mở App Hub → SmooDri; để điện thoại cố định rồi nhấn BẮT ĐẦU và chờ cảm biến cân chỉnh.
2. Kiểm tra thông báo Android **SmooDri · Đang đo nền**; nếu điện thoại hỏi quyền thông báo, hãy cấp quyền hợp lệ.
3. Bấm **◱ PiP**: kiểm tra cửa sổ nhỏ có xuất hiện và các chỉ số native có cập nhật không. Hoặc nhấn Home/chuyển Google Maps khi dịch vụ đang chạy để kiểm tra PiP tự động.
4. Mở lại SmooDri; kết thúc bằng nút DỪNG trong SmooDri hoặc thông báo Android. Xác nhận dịch vụ dừng hẳn.
5. Tắt Wi-Fi/dữ liệu di động rồi thử lại để xác nhận offline.
6. Thử tắt màn hình (chỉ khi an toàn); đo nền có thể tiếp tục nhưng phụ thuộc giới hạn pin/hãng Android. Không khẳng định hoạt động 100% ở mọi máy.

## Những điều cần biết

- **Đây là mã nguồn để build APK, chưa phải file APK có thể cài.** Không kiểm chứng được hành vi PiP/FGS trên thiết bị thật trong môi trường hiện tại.
- PiP dùng API Android được thiết kế chủ yếu cho video, cuộc gọi và điều hướng. Một bảng chỉ số như SmooDri cần kiểm thử với thiết bị, phiên bản Android và chính sách quản lý cụ thể.
- Dịch vụ nền native hiện **chưa phát tiếng bíp khi màn hình tắt** và **chưa lưu nhật ký hành trình đầy đủ**; chỉ đo và cung cấp trạng thái/điểm ước lượng. PiP không đồng nghĩa dịch vụ chạy nền.
- Không có quyền Admin, overlay đặc biệt hay cách vượt qua chính sách quản lý điện thoại. PiP có thể bị hệ thống vô hiệu hóa.
- Vì các file native mới, **phải build/cài APK mới một lần này**. Các sửa giao diện/thuật toán Web tương thích vẫn có thể sử dụng OTA về sau.
- GitHub Actions đang tái tạo thư mục android/ khi build. Script `scripts/install_smoodri_motion.py` tích hợp cả hai plugin trong **cùng một lần chạy** sau `npx cap sync android`, tránh ghi đè phần native lẫn nhau.
- **Không dùng điểm ước lượng để đánh giá an toàn giao thông**. Hãy thiết lập chế độ khi xe dừng, không tương tác với cửa sổ khi đang lái.

## Chẩn đoán khi lỗi

Có thể lấy log qua ADB và tìm các từ `SmooDriMotionService`, `AndroidRuntime`, `AppHubPiP`, `ForegroundServiceStartNotAllowedException`.

Nếu workflow báo lỗi ở bước Gradle, gửi đúng phần log đầu tiên có dòng `error:` cùng tên file và dòng để sửa chính xác.
