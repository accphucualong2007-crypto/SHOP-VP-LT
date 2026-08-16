# SHOP VÕ PHỤC LT V3

Tính năng:
- Shop bán võ phục online
- Font Times New Roman
- Giỏ hàng và đặt hàng
- VietQR theo đúng số tiền + mã đơn
- Tra cứu đơn bằng mã đơn + số điện thoại
- Admin quản lý sản phẩm, upload/sửa ảnh, giá, size, mô tả
- Admin quản lý đơn và trạng thái thanh toán
- Express 5 tương thích, không dùng app.get("*")
- API lỗi luôn trả JSON để tránh "Unexpected token <"

## Chạy Windows

Mở CMD trong đúng thư mục có package.json:

    npm install
    npm start

Mở:
http://localhost:3000

Admin:
http://localhost:3000/admin.html

Mật khẩu mặc định:
admin123

Tra cứu đơn:
http://localhost:3000/track.html

## VietQR

Vào Admin -> VietQR & Cài đặt.
Mã ngân hàng mặc định: MB
STK mặc định: 0389744881
Tên tài khoản mặc định: SHOP VO PHUC LT

Hãy đổi sang thông tin tài khoản thực tế của shop trước khi nhận tiền.

## Nếu đang dùng D:\VSC\sop3

Bạn có thể đổi tên thư mục cũ hoặc tạo thư mục mới. Điều quan trọng là CMD phải đứng trong thư mục có file package.json.

Không chạy npm install ở thư mục cha không có package.json.
