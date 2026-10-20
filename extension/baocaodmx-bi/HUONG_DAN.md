# SKST Cụm 933 — Lấy BI & tự nhập 1.1.3

## Cập nhật từ bản 1.0.x

1. Giải nén ZIP mới, thay toàn bộ file trong thư mục baocaodmx-bi đã cài.
2. Mở chrome://extensions, tìm SKST Cụm 933 và bấm nút tải lại ↻. Kiểm tra phiên bản **1.1.3**.
3. Tại https://lebangdinh.github.io/baocaodmx/ nhấn Ctrl+Shift+R.

## Cài lần đầu (mỗi máy một lần)

Giải nén → chrome://extensions → bật Chế độ dành cho nhà phát triển → Tải tiện ích đã giải nén → chọn thư mục baocaodmx-bi chứa manifest.json → ghim tiện ích.

## Mỗi lần dùng

1. Đăng nhập BI công ty bằng QR SSO trong cùng Chrome/profile. Giữ bộ lọc tháng ở tháng hiện tại.
2. Mở **https://lebangdinh.github.io/baocaodmx/**, đăng nhập Google bằng một trong hai email đã có quyền Firebase.
3. Bấm tiện ích, chọn **Chỉ Realtime hôm nay**, **Lũy kế** hoặc **Toàn bộ**, rồi bấm **Lấy dữ liệu & tự nhập**.
4. Giữ Chrome mở và không đổi bộ lọc trong lúc chạy. Tiện ích tự lấy dữ liệu, chạy parser đang có trên baocaodmx, tự nhập và ghi Firebase.
5. Chờ thông báo **Đã nhập và đồng bộ Firebase**. Nếu báo cáo lỗi, tiện ích dừng ở tab BI đó; kết quả lượt chưa hoàn tất chưa được nhập.

## Cách lấy báo cáo

| Báo cáo | Phạm vi mỗi bảng |
|---|---|
| Doanh thu siêu thị, Lũy kế và Realtime | Chung shop 933 + 10341, lần lượt DT thực và DT quy đổi, bật Chi tiết doanh thu |
| Thi đua siêu thị, Lũy kế và Realtime | Chung shop 933 + 10341 |
| Doanh thu nhân viên, Lũy kế và Realtime | Chung shop 933 + 10341, giữ mapping của parser nhập tay |
| Thi đua nhân viên Lũy kế | Bấm shop 933 rồi shop 10341, nhập đúng mục TGDĐ/TopZone |
| Trả chậm Lũy kế | Tỷ trọng trả góp → Vùng Trung Bộ → Đà Nẵng → shop 933 → quay lại Đà Nẵng → shop 10341 |

Trả chậm Realtime đang lỗi trên BI nên không lấy. SKST hiện không có cổng nhập giờ công nên không lấy giờ công.
Toàn bộ: 9 bảng; Lũy kế: 6 bảng; Realtime: 3 bảng. Hai loại doanh thu vẫn cần đọc riêng DT thực và DT quy đổi vì BI chỉ hiện một loại mỗi lần.

## Parser và quyền đồng bộ

- Dùng nguyên hàm parsePastedData của baocaodmx, cùng các loại dữ liệu và ngữ cảnh của thao tác dán tay. Không viết lại parser.
- Nội dung lấy chung không bị ép toàn bộ thành một shop. Mã nhân viên và mapping shop do parser hiện có xử lý.
- Ghép DT thực/QĐ theo mã tương ứng; thiếu hoặc trùng mã thì từ chối bảng đó.
- Trang baocaodmx xác thực Google và ghi vào dailyData/YYYY-MM-DD theo Firebase Rules hiện có. Không thêm email, không sửa Rules, không đọc mật khẩu/cookie/SSO.
- Chỉ báo hoàn tất đồng bộ sau khi Firebase xác nhận ghi thành công. Quyền bị từ chối thì không áp dụng kết quả vào phiên cục bộ.
- Lưu bản dữ liệu cục bộ trước nhập trong skst_bi_before_import_v1.
- Bảng phân tích không hợp lệ được giữ nguyên dữ liệu cũ; thông báo nêu rõ nếu chỉ nhập được một phần.

## Khi gặp lỗi thao tác trên BI

Tiện ích dừng và giữ tab BI đang vướng. Tại tab đó, bấm **Kiểm tra nút BI · tải tệp chẩn đoán**, gửi skst-bi-controls.json. Tệp chỉ chứa cấu trúc nút và tên shop liên quan, không chứa bảng doanh thu, cookie hay SSO.
Trang bi-test.html vẫn là chế độ đối chiếu, chưa ghi kết quả lấy thử; bản 1.1.1 mặc định chạy trên trang chính và tự nhập.

## Kiểm thử

Đã kiểm tra bảng chung hai shop qua parser thật, giữ mapping nhân viên như dán tay, ghép hai loại doanh thu, lịch chạy 9/6/3 bảng, bộ lọc hai shop, chỉ mở riêng thi đua NV, tự nhập/Firebase thành công và bị từ chối, đổi tài khoản/ngày, chống lặp, cùng các kiểm thử nhân sự/KPI hiện có.
Thao tác trên phiên BI có SSO vẫn cần kiểm chứng trên máy người dùng; không cam kết chạy dưới một phút.

Bản 1.1.1: chấp nhận màn thi đua nhân viên chỉ còn nút Lũy kế đang chọn; sau shop đầu, bỏ tích shop cũ, tích shop còn lại và Tải lại ngay trên màn nhân viên. Không mở lại trang/không tìm nút tên shop lần thứ hai khi đã ở màn nhân viên.


## Bản 1.1.2 — Báo cáo trả chậm giao diện mới (20/10/2026)

- Chỉ sửa luồng trả chậm; các luồng doanh thu và thi đua giữ nguyên.
- Mở Tỷ trọng trả góp, chọn Lũy kế và Xem. Giữ bộ lọc siêu thị sẵn có; danh sách Đà Nẵng phải có đúng shop 933 và 10341.
- Tự bấm Vùng Trung Bộ → Đà Nẵng → shop 933; lấy đủ bảng nhân viên; bấm Đà Nẵng trên thanh đường dẫn → shop 10341.
- Xác minh tiêu đề Nhân viên, tên shop, tháng và số dòng. Bảng còn trang tiếp theo, thiếu dòng hoặc gặp đối tác chưa nhận diện sẽ dừng lượt nhập.
- Hai shop có thứ tự/nhóm đối tác khác nhau: ghép theo tên cột, cộng doanh thu cùng nhân viên, tính lại tỷ trọng từ tổng; đối tác không có ở shop đó tính bằng 0. Đây là dữ liệu tổng hợp nhân viên hai shop, tương thích parser và cách phân shop theo danh sách nhân sự đang có trên baocaodmx.
- Chuẩn hóa thành một bảng clipboard gửi về parser hiện có. Không cần sửa web hoặc Firebase.
- Tăng thời gian chờ riêng báo cáo trả chậm lên 7 phút để đủ bước đi sâu và quay lại. Các báo cáo khác giữ thời gian cũ.
- Đã kiểm tra hai mẫu 9 dòng/shop ngày 20/10/2026 qua mã parser của website: 12 nhân viên sau khi cộng theo tên; cột SMARTPOS, KREDIVO, Kim Ngân Pay và Samsung Finance+ đúng thứ tự. Kiểm tra từ chối nhầm shop, khác tháng, thiếu dòng, thiếu cột, trùng shop, đối tác lạ.
- Chưa kiểm thử trên phiên BI SSO thật; cần người dùng chạy thử bản này.

Cập nhật: giải nén, chép toàn bộ file trong thư mục mới vào thư mục tiện ích cũ (có thêm installment.js), vào chrome://extensions bấm ↻. Xác nhận 1.1.2, tải lại tab BI và baocaodmx. Chọn Lũy kế & thi đua nhân viên hoặc Toàn bộ báo cáo để thử phần trả chậm.


## Bản 1.1.3 — Sửa dừng ở bảng Vùng

Bản 1.1.2 chờ cấu trúc thead/th/tbody/td. Bản này nhận cấp Vùng/Khu vực/Siêu thị/Nhân viên từ tiêu đề clipboard và tìm chữ bấm trên cả link/button/span/div. Danh sách shop đọc từ nội dung báo cáo; không cần bảng HTML truyền thống. Khi chờ lỗi, thông báo ghi cấp đang thấy hoặc lý do bảng chưa hợp lệ; tệp chẩn đoán có thêm các nút đường dẫn.

Đã chạy các hàm lấy dữ liệu thật trên giao diện mô phỏng chỉ có div (không có th/tbody/td), từ bảng Vùng, Khu vực và từ chi tiết nhân viên; xác nhận quay về Đà Nẵng và lấy shop còn lại. Đồng thời kiểm tra dữ liệu mẫu qua parser website. Đây vẫn là kiểm thử mô phỏng, chưa phải xác nhận chạy trên phiên SSO thật.

Cập nhật lên 1.1.3: chép toàn bộ file vào đúng thư mục tiện ích đang cài → chrome://extensions → bấm ↻ → kiểm tra phiên bản 1.1.3. Tải lại tab BI và baocaodmx trước khi chạy. Nếu vẫn dừng, gửi dòng lỗi của tiện ích cùng tệp Kiểm tra nút BI mới để xác định chính xác bước vướng.
