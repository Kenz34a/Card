# Linh Thú — Đấu trường thẻ bài

Game thẻ bài tiếng Việt chạy trực tiếp trên trình duyệt, lấy cảm hứng từ trò chơi triệu hồi và sưu tầm quái thú. Tên, hình SVG và thế giới thẻ bài được thiết kế riêng. Không cần tài khoản, khóa API, cơ sở dữ liệu hay dịch vụ bên ngoài.

## Chạy game

Cần **Node.js 20 trở lên**. Không có thư viện cần cài và không cần bước build.

```sh
cd /workspace/Card
npm run dev
```

Máy chủ chạy ở cổng **3000**, lắng nghe trên `0.0.0.0`. Có thể chọn cổng khác bằng `PORT=3001 npm run dev`. Dùng tiến trình server mới sau khi khởi động lại môi trường; tiến trình đang chạy không phải dữ liệu lưu của game.

## Có gì để chơi?

- **96 thẻ bài:** 84 linh thú và 12 phép, thuộc 6 hệ Hỏa, Thủy, Mộc, Lôi, Quang, Ám. Có 4 độ hiếm và 8 kiểu hình minh họa SVG.
- **4 loại pack:** mỗi pack mở 5 thẻ, bảo đảm ít nhất 1 thẻ Hiếm; pack Thiên Giới bảo đảm Sử thi. Tỉ lệ được hiển thị trong game. Thẻ trùng được giữ lại.
- **Bộ sưu tập:** tìm kiếm không dấu, lọc theo hệ, độ hiếm và quyền sở hữu; xem kỹ năng từng lá.
- **Xây bộ bài:** 20 thẻ, tối đa 2 bản sao mỗi loại, phải sở hữu đủ số lượng. Có bộ khởi đầu để chơi ngay.
- **Đấu máy:** máy tự triệu hồi, dùng phép, tiến hóa và chọn mục tiêu. Thắng nhận 100 vàng, thua 40.
- **Đấu 2 người tại chỗ:** luân phiên trên cùng thiết bị, có màn hình chuyển lượt che tay bài. Người 2 dùng bộ khởi đầu. Nhận 60 vàng khi kết thúc. Đây là chơi cục bộ, chưa có đấu online giữa các thiết bị.
- **Chiến đấu:** 24 sinh lực, năng lượng tăng từng lượt, tối đa 4 thú và 9 lá trên tay, phản công đồng thời, khiên, hồi máu, đóng băng, hút hồn, cạn bài và tiến hóa (+2 công, +3 sinh lực, tốn 2 năng lượng).
- **Hiệu ứng:** lật thẻ 3D, ánh sáng theo hệ, vòng triệu hồi, chém và số sát thương, tiến hóa, hạt chúc mừng và âm thanh tổng hợp có thể bật/tắt. Tôn trọng chế độ giảm chuyển động.
- **Tiến trình:** khởi đầu với 1.200 vàng và 20 thẻ; quà mỗi ngày 300 vàng. Thẻ, vàng, bộ bài, tùy chọn và trận đang chơi lưu bằng `localStorage` trên trình duyệt hiện tại. Xóa dữ liệu trình duyệt sẽ xóa tiến trình; các thiết bị không đồng bộ.

## Kiểm thử

```sh
npm test
```

18 bài kiểm tra luật và dữ liệu, gồm 2.000 lần mở pack, các kỹ năng/phép, giới hạn bộ bài, lưu dữ liệu, lượt đấu, tiến hóa, cạn bài và 40 trận mô phỏng có seed.

Kiểm tra giao diện bằng Python Playwright và Chromium (đã có trong môi trường cloud):

```sh
# Giữ npm run dev đang chạy trong terminal khác.
python3 tests/browser_smoke.py
```

8 kịch bản trình duyệt kiểm tra desktop/mobile, mở pack và lưu thẻ, quà mỗi ngày, tìm kiếm và bộ bài, lượt máy/chiến đấu/phần thưởng, chuyển lượt hai người, khôi phục trận đã lưu và đòn kết liễu giành chiến thắng. Ảnh kiểm tra ghi vào `/tmp/linh-thu-screenshots`. Có thể đặt `GAME_URL` và `CHROMIUM_PATH` khi chạy ở môi trường khác.

## Cấu trúc

- `src/cards.js`: danh mục, bộ khởi đầu và xác suất pack.
- `src/engine.js`: luật chiến đấu và hành động của máy, độc lập giao diện.
- `src/state.js`: dữ liệu lưu, mua pack và kiểm tra bộ bài.
- `src/art.js`: minh họa SVG và icon, không tải ảnh/font từ mạng.
- `src/app.js`: giao diện, tương tác, hiệu ứng và âm thanh.
- `styles.css`: giao diện responsive.
- `server.mjs`: máy chủ static không có dependency.

Dùng checkout hiện có khi phát triển; mỗi tác vụ cloud đã được cách ly, không cần tạo Git worktree.
