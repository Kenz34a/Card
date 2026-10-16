# Linh Thú — Đấu trường thẻ bài

Game thẻ bài tiếng Việt với tài khoản online và trang quản trị nhiều người chơi. Tên, hình SVG và thế giới thẻ bài được thiết kế riêng. Backend Node.js lưu tài khoản, phiên đăng nhập và tiến trình bằng SQLite tích hợp; không cần dịch vụ cơ sở dữ liệu bên ngoài hay khóa API. Vẫn có thể chơi khách và lưu riêng trong trình duyệt.

## Chạy game

Cần **Node.js 24 trở lên** (sử dụng `node:sqlite`). Không có thư viện cần cài và không cần bước build.

```sh
cd /workspace/Card
npm run dev
```

Máy chủ chạy ở cổng **3000**, lắng nghe trên `0.0.0.0`. Có thể chọn cổng khác bằng `PORT=3001 npm run dev`. Dùng tiến trình server mới sau khi khởi động lại môi trường; tiến trình đang chạy không phải dữ liệu lưu của game.

## Đăng nhập và tài khoản admin

1. Bấm **Đăng nhập → Đăng ký** trong game. Chọn tên đăng nhập, tên hiển thị và mật khẩu từ 8 đến 128 ký tự. Không gửi mật khẩu trong chat hay đưa vào mã nguồn.
2. Để cấp quyền admin cho tài khoản đã đăng ký, chạy lệnh này **trên máy chủ**, cùng thư mục và `GAME_DATA_DIR` với tiến trình game:

   ```sh
   npm run admin:grant -- ten_dang_nhap
   ```

3. Tải lại game rồi mở **Quản trị** ở thanh điều hướng. Cũng có thể đăng nhập tài khoản admin trên thiết bị khác cùng kết nối máy chủ đó.

Không có mật khẩu mặc định hoặc đường API tự cấp quyền admin. Tài khoản đăng ký từ trình duyệt luôn có vai trò người chơi; lệnh cấp quyền yêu cầu quyền truy cập máy chủ. Mật khẩu được băm bằng scrypt và muối ngẫu nhiên; phiên đăng nhập dùng cookie HttpOnly, SameSite=Strict, hết hạn sau 7 ngày.

Admin có thể tìm người chơi, xem vàng/thẻ/thành tích, cộng hoặc trừ vàng, cấp một loại thẻ hoặc cả 96 loại, khóa/mở khóa tài khoản, hủy trận đang chơi và đặt lại tiến trình. Các thao tác được kiểm tra quyền trên máy chủ và ghi nhật ký cùng người thực hiện, đối tượng và thời điểm. Khóa tài khoản thu hồi mọi phiên đăng nhập; không cho phép admin tự khóa mình.

Người chơi online được lưu vàng, pack, bộ bài, kỹ năng/trận đấu và phần thưởng ở máy chủ. Client không được tự ghi số vàng hay quyền tài khoản; hai lần nhận quà cùng ngày hoặc gửi lại yêu cầu nhận thưởng không cộng thưởng hai lần. Trang người chơi cập nhật thay đổi từ máy chủ định kỳ. Tiến trình khách không tự nhập vào tài khoản online; tài khoản mới có bộ khởi đầu riêng.

## Lưu dữ liệu và đưa game lên mạng

- Mặc định dữ liệu nằm trong `.data/linh-thu.sqlite`, được loại khỏi Git. `GAME_DATA_DIR` chọn thư mục lưu khác. Cần giữ thư mục này trên ổ đĩa bền vững khi khởi động lại hoặc triển khai phiên bản mới.
- Để sao lưu đơn giản, dừng tiến trình game rồi sao chép toàn bộ thư mục dữ liệu, gồm các file SQLite/WAL nếu có. Không đưa cơ sở dữ liệu hoặc bản sao lưu chứa tài khoản lên GitHub.
- Khi triển khai public, dùng dịch vụ chạy Node.js với HTTPS và đặt `COOKIE_SECURE=true`. Giá trị này dùng cookie Secure, không phù hợp với kết nối HTTP thuần để phát triển cục bộ. GitHub lưu mã nguồn; đăng nhập và admin cần máy chủ Node chạy thực tế, không chạy bằng GitHub Pages thuần static.
- Hai chế độ chiến đấu hiện có là đấu máy và hai người luân phiên cùng thiết bị. Tài khoản và admin online chưa bổ sung đối kháng trực tiếp giữa hai thiết bị.

## Có gì để chơi?

- **96 thẻ bài:** 84 linh thú và 12 phép, thuộc 6 hệ Hỏa, Thủy, Mộc, Lôi, Quang, Ám. Có 4 độ hiếm và 8 kiểu hình minh họa SVG.
- **4 loại pack:** mỗi pack mở 5 thẻ, bảo đảm ít nhất 1 thẻ Hiếm; pack Thiên Giới bảo đảm Sử thi. Tỉ lệ được hiển thị trong game. Thẻ trùng được giữ lại.
- **Bộ sưu tập:** tìm kiếm không dấu, lọc theo hệ, độ hiếm và quyền sở hữu; xem kỹ năng từng lá.
- **Xây bộ bài:** 20 thẻ, tối đa 2 bản sao mỗi loại, phải sở hữu đủ số lượng. Có bộ khởi đầu để chơi ngay.
- **Đấu máy:** máy tự triệu hồi, dùng phép, tiến hóa và chọn mục tiêu. Thắng nhận 100 vàng, thua 40.
- **Đấu 2 người tại chỗ:** luân phiên trên cùng thiết bị, có màn hình chuyển lượt che tay bài. Người 2 dùng bộ khởi đầu. Nhận 60 vàng khi kết thúc. Đây là chơi cục bộ, chưa có đấu online giữa các thiết bị.
- **Chiến đấu:** 24 sinh lực, năng lượng tăng từng lượt, tối đa 4 thú và 9 lá trên tay, phản công đồng thời, khiên, hồi máu, đóng băng, hút hồn, cạn bài và tiến hóa (+2 công, +3 sinh lực, tốn 2 năng lượng).
- **Hiệu ứng:** lật thẻ 3D, ánh sáng theo hệ, vòng triệu hồi, chém và số sát thương, tiến hóa, hạt chúc mừng và âm thanh tổng hợp có thể bật/tắt. Tôn trọng chế độ giảm chuyển động.
- **Tiến trình:** khởi đầu với 1.200 vàng và 20 thẻ; quà mỗi ngày 300 vàng. Tài khoản online lưu ở máy chủ và dùng được trên nhiều thiết bị. Chế độ khách lưu riêng bằng `localStorage`; xóa dữ liệu trình duyệt sẽ xóa tiến trình khách.

## Kiểm thử

```sh
npm test
```

31 bài kiểm tra luật, dữ liệu và API: gồm 2.000 lần mở pack, các kỹ năng/phép, 40 trận mô phỏng có seed, đăng nhập/đăng xuất, mật khẩu băm, phân quyền, giới hạn đăng nhập sai, chặn yêu cầu khác nguồn, khóa tài khoản, dữ liệu SQLite sau khi mở lại, hai thiết bị gửi cùng lượt, tài nguyên được kiểm soát bởi máy chủ và phần thưởng chỉ cấp một lần. Các bài API mở máy chủ tạm trên cổng tự chọn và dùng cơ sở dữ liệu thử nghiệm riêng.

Kiểm tra giao diện bằng Python Playwright và Chromium (đã có trong môi trường cloud):

```sh
# Giữ npm run dev đang chạy trong terminal khác.
python3 tests/browser_smoke.py

# Bộ kiểm tra online tự mở máy chủ và SQLite tạm, không dùng dữ liệu thật.
python3 tests/online_browser.py
```

8 kịch bản trình duyệt chơi khách và 4 kịch bản nhiều tài khoản/admin kiểm tra desktop/mobile, mở pack, tìm kiếm/bộ bài, chiến đấu/phần thưởng, đăng nhập lại, dữ liệu tách biệt giữa người chơi, cấp vàng/thẻ, nhật ký, khóa/mở khóa và ngăn giả mạo quyền trong localStorage. Ảnh kiểm tra ghi vào `/tmp/linh-thu-screenshots`. Có thể đặt `GAME_URL` cho bộ kiểm tra khách và `CHROMIUM_PATH` cho cả hai bộ khi chạy ở môi trường khác.

## Cấu trúc

- `src/cards.js`: danh mục, bộ khởi đầu và xác suất pack.
- `src/engine.js`: luật chiến đấu và hành động của máy, độc lập giao diện.
- `src/state.js`: dữ liệu lưu, mua pack và kiểm tra bộ bài.
- `src/art.js`: minh họa SVG và icon, không tải ảnh/font từ mạng.
- `src/app.js`: giao diện, tương tác, hiệu ứng và âm thanh.
- `styles.css`: giao diện responsive.
- `src/online.js`: biểu mẫu tài khoản và giao diện quản trị.
- `server.mjs`: máy chủ HTTP/API và tài nguyên frontend.
- `server/api.js`: xác thực, phân quyền, tài nguyên và trận đấu được xử lý ở máy chủ.
- `server/store.js`: SQLite, băm mật khẩu, phiên đăng nhập và nhật ký quản trị.
- `scripts/admin.mjs`: cấp quyền admin từ terminal máy chủ.

Dùng checkout hiện có khi phát triển; mỗi tác vụ cloud đã được cách ly, không cần tạo Git worktree.
