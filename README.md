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

## Quản trị toàn bộ game

Trong **Quản trị** có các mục Người chơi, Thẻ bài, Pack, Cấu hình và Nhật ký:

- **Tài khoản:** tạo người chơi hoặc admin, sửa tên hiển thị, cấp/hạ quyền, đặt lại mật khẩu, khóa/mở khóa và xóa tài khoản. Không cho phép xóa, khóa hoặc hạ quyền chính mình; luôn giữ một admin hoạt động. Xóa tài khoản cần nhập đúng tên đăng nhập. Đổi mật khẩu của bản thân trong menu tài khoản; các thiết bị khác sẽ bị đăng xuất.
- **Thẻ và bộ bài của người chơi:** cấp thẻ, đặt số lượng chính xác hoặc thu hồi về 0; bộ bài tự bỏ bản sao không còn sở hữu. Admin cũng có thể chọn lại bộ bài 20 thẻ từ các bản sao người chơi sở hữu.
- **Danh mục thẻ:** thêm linh thú/phép thuật, sửa tên, mô tả, hệ, độ hiếm, năng lượng, công/sinh lực, hình SVG và kỹ năng; ngừng phát hành khi cần. Có thể mở rộng từ 96 lên tối đa 500 thẻ. Mã và loại thẻ đã phát hành được giữ ổn định để bảo toàn bộ sưu tập.
- **Pack:** thêm/sửa tối đa 30 pack, tên, giá, nhãn, hệ ưu tiên, tỉ lệ bốn độ hiếm (tổng 100%), độ hiếm bảo đảm ở lá thứ 5 và trạng thái phát hành. Tỉ lệ công khai trong game lấy trực tiếp từ cấu hình. Giao diện mua pack phát hiện giá đã thay đổi để người chơi xem lại trước khi trả vàng.
- **Cấu hình game:** vàng khởi đầu, quà hằng ngày, thưởng thắng/thua/hai người, đóng/mở đăng ký, thông báo toàn game và bảo trì. Bảo trì chặn thao tác game của người chơi nhưng admin vẫn có thể thử nghiệm. Tài khoản mới dùng mức vàng mới; không tự sửa vàng của tài khoản cũ.
- **Hàng loạt:** chọn từng tài khoản, chọn cả trang hoặc áp dụng cho toàn bộ tài khoản vai trò người chơi (không gồm admin). Hỗ trợ cộng/trừ vàng, cấp thẻ, khóa/mở khóa, hủy trận và đặt lại tiến trình, tối đa 1.000 tài khoản mỗi lần. Phải nhập `XÁC NHẬN`; toàn bộ thay đổi cùng thành công hoặc cùng hủy khi có lỗi.
- **Thống kê, nhật ký và xuất dữ liệu:** xem số người chơi, hoạt động gần đây, tài khoản khóa, tổng vàng, pack và trận đang chơi; xem lịch sử người thực hiện và đối tượng. Tải/nhập cấu hình JSON tối đa 1 MB. Không được nhập bản cấu hình làm mất mã thẻ/pack đã phát hành; cần giữ các mục đó và tắt phát hành. Xuất dữ liệu người chơi dạng JSON không chứa mật khẩu hay phiên đăng nhập; đây không phải bản sao lưu tài khoản SQLite đầy đủ.

Mỗi lần lưu cấu hình có số phiên bản: nếu admin khác đã sửa trước đó, máy chủ yêu cầu tải lại thay vì ghi đè. Trận đấu giữ ảnh chụp chỉ số thẻ và mức thưởng lúc bắt đầu; chỉnh cân bằng không làm thay đổi trận đang diễn ra. Cấu hình được lưu trong SQLite và được giao diện chơi cập nhật định kỳ.

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

47 bài kiểm tra luật, dữ liệu và API: gồm 2.000 lần mở pack, 40 trận mô phỏng, đăng nhập/đăng xuất, mật khẩu băm, phân quyền và thu hồi quyền khi yêu cầu đang gửi, khóa tài khoản, SQLite, hai thiết bị gửi cùng lượt, thẻ tự tạo dùng được trong trận, giá/tỉ lệ pack thực tế, ảnh chụp cân bằng/thưởng, cấu hình xung đột, bảo trì, CRUD tài khoản, thu hồi thẻ/bộ bài, hàng loạt thành công hoặc hủy toàn bộ, xuất dữ liệu không có thông tin xác thực và danh mục 500 thẻ với mô tả tiếng Việt dài. Các bài API mở máy chủ tạm trên cổng tự chọn và dùng cơ sở dữ liệu thử nghiệm riêng.

Kiểm tra giao diện bằng Python Playwright và Chromium (đã có trong môi trường cloud):

```sh
# Giữ npm run dev đang chạy trong terminal khác.
python3 tests/browser_smoke.py

# Bộ kiểm tra online tự mở máy chủ và SQLite tạm, không dùng dữ liệu thật.
python3 tests/management_browser.py
```

8 kịch bản trình duyệt chơi khách và 9 kịch bản online/quản trị kiểm tra desktop/mobile, mở pack, tìm kiếm/bộ bài, chiến đấu/phần thưởng, đăng nhập lại, tách dữ liệu giữa người chơi, cấp vàng/thẻ, nhật ký, khóa/mở khóa, ngăn giả mạo quyền, tạo thẻ/pack, giá/tỉ lệ thực tế, cấu hình/bảo trì/đăng ký, hàng loạt, thu hồi thẻ, phân quyền/xóa tài khoản, mật khẩu và xuất/nhập cấu hình. Bộ quản trị kế thừa 4 kiểm tra online cơ bản trong `tests/online_browser.py`. Ảnh kiểm tra ghi vào `/tmp/linh-thu-screenshots`. Có thể đặt `GAME_URL` cho bộ kiểm tra khách và `CHROMIUM_PATH` cho cả hai bộ khi chạy ở môi trường khác.

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
- `server/config.js`: mặc định, kiểm tra cấu hình và giới hạn danh mục.
- `server/management.js`: quản lý danh mục, tài khoản, hàng loạt và xuất dữ liệu.
- `src/management.js`: giao diện và biểu mẫu quản trị toàn bộ.
- `scripts/admin.mjs`: cấp quyền admin từ terminal máy chủ.

Dùng checkout hiện có khi phát triển; mỗi tác vụ cloud đã được cách ly, không cần tạo Git worktree.
