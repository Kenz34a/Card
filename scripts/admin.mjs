import { Store } from '../server/store.js';
const username = process.argv[2]?.trim().toLowerCase();
if (!username || !/^[a-z0-9_]{3,24}$/.test(username)) {
  console.error('Cách dùng: npm run admin:grant -- ten_dang_nhap');
  console.error('Đăng ký tài khoản trong game trước. Lệnh này chỉ chạy trên máy chủ.');
  process.exitCode = 1;
} else {
  const store = new Store();
  try { const user = store.grantAdmin(username); console.log(`Đã cấp quyền quản trị cho ${user.username}. Tải lại game để mở mục Quản trị.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { store.close(); }
}
