# Bản vá tùy chỉnh PiP cho App Hub

1. Cập nhật mã nguồn repo SmooDri riêng trước.
2. Đưa các file của gói App-Hub-PiP-CHI-FILE-SUA.zip vào **đúng đường dẫn** trong repo App Hub. Bản này gộp quyền GPS, bản vá đóng PiP/dừng đo trước đây và sửa `public void onDestroy()`.
3. Chạy workflow 1. Build APK (Android Release Signed), cài bản APK mới theo quyền Android/thiết bị quản lý.
4. Từ đó các cấu hình PiP được thay đổi ở Settings của SmooDri. Những sửa đổi giao diện Web sau này có thể xuất bản OTA.

Không thể điều khiển trực tiếp chiều rộng/chiều cao PiP theo pixel. Android tự đặt kích thước, chỉ nhận tỷ lệ đề xuất 16:9, 4:3, 1:1.

Tốc độ GPS từ SmooDri Web không có bảo đảm cập nhật ở nền; nếu không có dữ liệu mới sau 3,2s PiP hiển thị `--`. Muốn tốc độ nền liên tục cần triển khai riêng nguồn GPS Android native và thiết kế quyền phù hợp.

Một số Android có thể không gọi close action của PiP như mong đợi; dùng nút KẾT THÚC trong menu PiP để chủ động dừng đo. Chưa build Gradle hoặc thử trên điện thoại thật.
