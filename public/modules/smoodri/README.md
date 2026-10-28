# SmooDri 8.0 — Trợ lý lái xe êm ái

## Cài đặt / cập nhật

1. Sao lưu phiên bản trước.
2. Giải nén và **tải toàn bộ nội dung trong thư mục `hotrolaixe-main`** lên thư mục gốc website (hoặc cùng đường dẫn với bản cũ). Giữ nguyên cấu trúc thư mục `icons/`.
3. Mở website bằng **HTTPS** (ví dụ GitHub Pages). Cảm biến trên điện thoại có thể không hoạt động qua HTTP hoặc khi chưa được cấp quyền.
4. Tắt/mở lại tab hoặc ứng dụng đã cài để nhận bản cập nhật. Nếu màn hình vẫn là bản cũ, đóng mọi tab của ứng dụng rồi mở lại trực tuyến.
5. Cố định điện thoại và **dừng xe** khi bấm Bắt đầu/cân chỉnh lại 0G. Không thao tác ứng dụng trong lúc điều khiển xe.

## Thay đổi chính

- Nút **− / +** thay đổi mức độ êm ái theo bước 5, trong khoảng 20–100. **+** yêu cầu êm hơn (ngưỡng G thấp hơn), **−** linh hoạt hơn (ngưỡng G cao hơn).
- Bỏ cài đặt ngưỡng bắt đầu phát tiếng bíp, cảnh báo phát từ **100%** của từng chỉ số. Âm cảnh báo được giới hạn cường độ và có khoảng nghỉ.
- Trong cài đặt có thể chọn 1–4 thanh hiển thị, ở cả Thanh ngang và Vòng tròn. **Ẩn thanh không dừng đo, tính điểm và cảnh báo**.
- Chế độ cài đặt nâng cao có 5 ngưỡng G/G/s riêng. Điều chỉnh các giá trị này chuyển sang `Tùy chỉnh`; nút ± hoặc thanh mức êm ái sẽ áp dụng lại ngưỡng đồng bộ.
- Tách **Điểm chuyến đi** (tích lũy) và **Điểm hiện tại** (có hồi phục). Đây là thuật toán đánh giá thử nghiệm, chưa được chuẩn hóa.
- Cân chỉnh trung bình nhiều mẫu sau thời gian chờ, phát hiện mất dữ liệu cảm biến, không nhận diện lạng lách chỉ từ một cú cua hoặc một đỉnh jerk.
- Độ dốc chỉ hiển thị dạng **tương đối / ước tính** khi có dữ liệu gia tốc tuyến tính; không coi là đo độ dốc tuyệt đối.
- Icon PNG/SVG cục bộ và Service Worker cache phiên bản 8 hỗ trợ hoạt động offline sau khi tải trọn các tệp cốt lõi.

## Lưu ý quan trọng

- Không thể kiểm định độ chính xác lực G, độ dốc và mức êm ái nếu chưa thử trên thiết bị thật, ở các vị trí đặt điện thoại và loại đường/xe khác nhau.
- Độ dốc tuyệt đối, tư thế lắp điện thoại, độ ổn định cảm biến, hạn chế hoạt động nền và phát âm thanh phụ thuộc thiết bị/trình duyệt.
- Kết quả chỉ để tham khảo, không dùng để quyết định tốc độ lái an toàn.
- Dữ liệu cài đặt dùng `localStorage` ở khóa `smoodri_cfg_v8`; chương trình đọc lại bản cũ `smoodri_cfg_v7` nếu có.

## Danh sách file

- `index.html`: màn hình chính và cài đặt
- `style.css`: giao diện và bố cục mobile one-view
- `app.js`: đo cảm biến, đánh giá, cảnh báo và lưu cài đặt
- `manifest.json`: cài đặt PWA
- `sw.js`: cache offline
- `icons/`: icon PNG chuẩn và SVG nguồn
