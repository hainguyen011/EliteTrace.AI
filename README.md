# EliteTrace.AI - AI-Powered Information Verification Tool

EliteTrace.AI là một tiện ích mở rộng (Chrome Extension) được thiết kế để hỗ trợ người dùng xác thực tính chính xác của thông tin trên không gian mạng. Công cụ ứng dụng trí tuệ nhân tạo để phân tích dữ liệu đa phương tiện, giúp nhận diện tin giả và các nội dung thiếu kiểm chứng.

# Giá trị sử dụng

- Tính tức thời: Xử lý và đưa ra cảnh báo ngay lập tức trên giao diện trình duyệt, giúp người dùng tiết kiệm thời gian kiểm chứng.
- Độ khách quan: Sử dụng dữ liệu đối chiếu từ các nguồn tin báo chí chính thống, các tổ chức kiểm chứng sự thật (fact-checkers) và cơ sở dữ liệu học thuật toàn cầu.
- Đa dạng hình thức: Không chỉ giới hạn ở văn bản, công cụ còn tập trung giải quyết vấn đề nhức nhối về ảnh giả mạo và nội dung do AI can thiệp (Deepfake).
- Rất tốt đối với việc kiểm chứng hộp thư email hoặc các tin nhắn nghi ngờ có nội dung sai sự thật hoặc lừa đảo.
- Đánh giá độ tin cậy của trang web khi truy cập đảm bảo các tài nguyên được người dùng tải về là an toàn.

## Chức năng chính

- Phân tích văn bản: Đánh giá độ tin cậy của nội dung văn bản thông qua việc đối chiếu với các nguồn dữ liệu uy tín.
- Xác thực tệp tin trước khi tải xuống (Đang phát triển): Tự động quét và phân tích nội độ tin cậy của tệp tin hoặc tài nguyên trước khi người dùng lưu về máy.
- Xác thực hình ảnh từ màn hình: Kiểm tra nguồn gốc ảnh và nhận diện các dấu hiệu can thiệp kỹ thuật hoặc ảnh được tạo bởi AI.
- Phân tích tài liệu (Đang phát triển): Hỗ trợ tải lên các tệp tin như PDF, Docx để kiểm tra tính nhất quán và xác thực nguồn trích dẫn.
- Chỉ số tin cậy: Cung cấp thang điểm đánh giá mức độ xác thực dựa trên các bằng chứng thu thập được theo thời gian thực.


## Công nghệ sử dụng

- Framework: Chrome Extension Manifest V3.
- Giao diện: React.js và Tailwind CSS.
- AI Engine: Tích hợp các mô hình ngôn ngữ lớn để phân tích và đánh giá kết quả.

## Hướng dẫn cài đặt cho nhà phát triển

Để cài đặt dự án trong môi trường thử nghiệm, thực hiện theo các bước sau:

1. Clone repository:
   git clone https://github.com/hainguyen011/EliteTrace.AI.git hoặc download file ZIP và giải nén

2. Nạp tiện ích vào trình duyệt:
   - Truy cập chrome://extensions/ trên trình duyệt Chrome.
   - Kích hoạt "Chế độ dành cho nhà phát triển" (Developer mode).
   - Chọn "Tải tiện ích đã giải nén" (Load unpacked) và chọn thư mục build/dist của dự án.
   - Gim tiện ích (extension) vào browser
   - Reload lại page trước đó hoặc tắt và bật lại trình duyệt.

## Lộ trình phát triển

- Tối ưu hóa khả năng phân tích ngữ cảnh của AI.
- Mở rộng tính năng quét hình ảnh và video chuyên sâu.
- Hoàn thiện chức năng đánh giá tệp tin trước khi tải xuống.
- Cập nhật cơ sở dữ liệu xác thực đa ngôn ngữ.

## Tác giả

Dự án được phát triển và duy trì bởi:
- **Hai Nguyen** - [hainguyen011](https://github.com/hainguyen011)

## Đóng góp

Mọi ý kiến đóng góp hoặc báo cáo lỗi vui lòng gửi thông qua mục Issues của repository. Các đóng góp về mã nguồn thông qua Pull Request luôn được trân trọng.

## Giấy phép

Dự án được phân phối dưới giấy phép MIT.
