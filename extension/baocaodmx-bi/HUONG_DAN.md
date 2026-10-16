# SKST Cụm 933 — Thử lấy BI (1.0.3)

## Cài một lần trên mỗi máy Windows/Mac

1. Giải nén `baocaodmx-bi-extension.zip` vào thư mục cố định.
2. Mở Chrome, nhập `chrome://extensions` vào thanh địa chỉ.
3. Bật **Chế độ dành cho nhà phát triển** → **Tải tiện ích đã giải nén**.
4. Chọn thư mục `baocaodmx-bi` có file `manifest.json`.
5. Bấm biểu tượng mảnh ghép trên Chrome và ghim **SKST Cụm 933 — Đồng bộ BI**.

## Mỗi lần dùng

1. Đăng nhập BI công ty bằng QR SSO trong cùng Chrome/profile.
2. Mở https://lebangdinh.github.io/baocaodmx/bi-test.html và đăng nhập Google bằng một trong hai email đã có quyền Firebase. Nếu đã đăng nhập thì không cần làm lại.
3. Bấm tiện ích → **Lấy dữ liệu & đồng bộ**. Mặc định lấy toàn bộ; có thể chọn riêng Realtime hoặc Lũy kế.
4. Giữ Chrome mở. Tiện ích mở tab BI riêng, xử lý từng báo cáo, đóng tab nó tạo rồi quay lại SKST. Không đóng tab hoặc đổi bộ lọc trong lúc chạy.
5. Chờ thông báo **BẢN THỬ: đã đọc…**. Mở **Kết quả đối chiếu và lỗi** để xem số; kết quả thử chưa ghi vào Firebase và chưa thay dữ liệu đang dùng. Báo cáo thất bại được ghi rõ ở **Chi tiết báo cáo chưa cập nhật**, dữ liệu cũ của loại đó được giữ nguyên.

## Phạm vi bản thử

- Hai cửa hàng cố định: 933 (TGDĐ) và 10341 (TopZone).
- Doanh thu siêu thị: thực + quy đổi, lũy kế + realtime. Tự bật và kiểm tra **Chi tiết doanh thu** trước mỗi lần lấy bảng; áp dụng cả tab Nhân viên.
- Thi đua siêu thị: lũy kế + realtime.
- Doanh thu nhân viên: thực + quy đổi, lũy kế + realtime.
- Thi đua nhân viên: lũy kế từng cửa hàng.
- Trả chậm nhân viên: **chỉ Lũy kế**, trang `/dashboard/tra-cham` → **Tỷ trọng trả góp** → **Lũy kế** → lọc siêu thị → **Xem**. Realtime đang lỗi tại BI nên tạm ngưng lấy; lựa chọn Chỉ Realtime không chạy trả chậm.
- Giờ công không nhập vì baocaodmx hiện không có cổng giờ công.
- Chỉ nhận tháng hiện tại tại Việt Nam. Nếu BI còn chọn tháng cũ, tiện ích dừng nhập bảng đó và yêu cầu chọn đúng tháng trên BI.
- Nếu có nhiều trang dữ liệu, bản thử từ chối nhập bảng đó thay vì lấy thiếu.

## Quyền và dữ liệu

Không đọc mật khẩu, cookie hoặc mã SSO. Không kết nối website SKST của bên khác.
Dữ liệu đi từ tab BI sang baocaodmx; trang baocaodmx dùng Firebase SDK và quy tắc quyền hiện có để ghi vào `dailyData/YYYY-MM-DD`. Không thêm email và không sửa Firebase Rules.
Mỗi loại báo cáo chung phải đủ cả hai cửa hàng mới được thay thế. Ghép DT thực/QĐ bằng mã; thiếu/trùng mã thì từ chối.
Bản dữ liệu cục bộ trước nhập lưu trong `skst_bi_before_import_v1` để hỗ trợ khôi phục. Không lưu báo cáo trong tiện ích.

## Cập nhật / khắc phục

- Sau khi cập nhật web, tải lại baocaodmx bằng Ctrl+Shift+R.
- Sau khi thay file tiện ích, bấm nút tải lại tiện ích tại chrome://extensions rồi tải lại tab baocaodmx.
- Hết phiên SSO: đăng nhập BI lại rồi chạy.
- Báo không đủ quyền Firebase: kiểm tra email Google đang đăng nhập ở SKST; không sửa quyền để bỏ qua lỗi.
- Có nhiều tab SKST: chọn đúng tab trước khi bấm tiện ích.
- Dừng trong lúc lấy: bỏ toàn bộ lượt đang lấy. Khi đã bắt đầu ghi Firebase, phải chờ kết quả lưu.

## Tình trạng kiểm thử

Đã kiểm tra cú pháp, ghép doanh thu/target, phạm vi cửa hàng/tháng, báo cáo thiếu/trùng, quyền bị từ chối, đổi tài khoản, chống gửi lặp và các kiểm thử hiện có của dự án.
Chưa chạy xuyên suốt trên phiên BI công ty có SSO. Lần chạy đầu cần đối chiếu số và phản hồi lỗi cụ thể; không cam kết thời gian dưới một phút.

Phần thao tác BI phát triển từ file skst-bi-extension.zip do người dùng cung cấp; đã thay cầu nối, luồng điều phối và giới hạn nguồn/đích cho baocaodmx.

Trạng thái nút: nền xanh đậm là đang chọn. Tiện ích kiểm tra hai cặp Lũy kế/Realtime và DT thực/DT quy đổi bằng trạng thái nút, đọc lại sau khi giao diện cập nhật; không suy ra kỳ báo cáo từ tên cột.

Bản 1.0.1 chỉ chạy với trang bi-test.html. Sau khi đối chiếu thành công mới phát hành bản kết nối trang chính để ghi Firebase.

Bản 1.0.2: hiện tiến độ/lỗi liên tục trong cửa sổ tiện ích; biểu tượng có dấu … khi chạy, ! khi lỗi, OK khi xong; tự mở trang thử nếu chưa mở, tự tải lại một lần nếu tab có từ trước lúc cài tiện ích.

Bản 1.0.3: sửa dò tên shop có/không có mã số, loại tab Ngành hàng BI khỏi kiểm tra bộ lọc; kiểm tra ô Chi tiết doanh thu qua trạng thái checkbox/dấu tích/nền ô màu xanh đậm. Dừng ở báo cáo đầu tiên bị lỗi và giữ tab BI.
Nếu còn vướng: tại tab BI đang dừng, mở tiện ích → **Kiểm tra nút BI · tải tệp chẩn đoán** → gửi tệp `skst-bi-controls.json`. Tệp chỉ lấy cấu trúc các nút và tên shop liên quan, không lấy cookie, SSO hoặc bảng doanh thu.
