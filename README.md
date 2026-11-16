# LITERATURE STUDIO — ẤN BẢN TIẾNG VIỆT (VIETNAMESE EDITION)

**Nền tảng Văn học Số, Đọc văn bản Tiếng Việt (TTS), Âm thanh Học thuật & Trợ lý Ngữ văn Google Gemini AI**

---

## 1. Giới thiệu tổng quan

**Literature Studio (Vietnamese Edition)** là không gian làm việc văn học số toàn diện được thiết kế dành riêng cho độc giả, học sinh, sinh viên và giáo viên Ngữ văn:

- **100% Giao diện Tiếng Việt chuẩn mực**: Toàn bộ thanh điều hướng, nút bấm, thông báo, công cụ và hướng dẫn đều sử dụng tiếng Việt tự nhiên, giữ nguyên bản sắc thuật ngữ văn học.
- **Tài khoản ẩn danh tự động (Không cần đăng ký / đăng nhập)**: Ngay khi mở ứng dụng lần đầu, hệ thống tự động khởi tạo phiên người dùng ẩn danh qua **Supabase Anonymous Sign-Ins** (`supabase.auth.signInAnonymously()`) hoặc cơ chế phiên ẩn danh bền vững trên **Cloud SQL PostgreSQL** (`/api/auth/anonymous`). Khi tải lại trang, phiên cũ được giữ nguyên để không tạo tài khoản trùng lặp.
- **Đồng bộ dữ liệu cá nhân hóa theo từng người dùng**: Danh sách phát, ghi chú văn học cá nhân, tiến độ đọc văn bản (`lastDocumentId`, `lastSegmentIndex`), lịch sử hỏi đáp AI và cấu hình giọng đọc được đồng bộ riêng biệt theo `user_id`.
- **Trình đọc văn bản Tiếng Việt chuyên sâu (`ReaderView` & `ttsService`)**:
  - Tự động kiểm tra và lọc danh sách giọng đọc `vi-VN` từ `window.speechSynthesis.getVoices()`.
  - **Nguyên tắc nghiêm ngặt**: Tuyệt đối không tự chọn giọng tiếng Anh để đọc tác phẩm tiếng Việt. Nếu thiết bị chưa cài giọng `vi-VN`, hệ thống hiển thị cảnh báo rõ ràng: *"Thiết bị hoặc trình duyệt chưa cung cấp giọng đọc tiếng Việt."* kèm hướng dẫn cài đặt.
  - Tự động chia tác phẩm dài thành từng đoạn/khổ thơ tuần tự, tô sáng câu/từ đang đọc, tự động cuộn màn hình, đọc từ vị trí con trỏ và tự động giảm âm lượng nhạc nền (**Audio Ducking**) khi giọng đọc phát.
- **Trợ lý Văn học Gemini AI qua Backend (`/api/ai`)**: Khóa `GEMINI_API_KEY` được bảo mật tuyệt đối ở phía máy chủ, hỗ trợ 6 chế độ phân tích tác phẩm, nhân vật, thơ, lập dàn ý, so sánh văn học và biên soạn trang chiếu thuyết trình.

---

## 2. Hướng dẫn cài đặt và chạy trên máy cục bộ (Local)

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Tạo tệp biến môi trường từ tệp mẫu
cp .env.example .env

# 3. Chạy máy chủ phát triển (Express + Vite trên cổng 3000)
npm run dev
```

Mở trình duyệt tại địa chỉ `http://localhost:3000`.

---

## 3. Hướng dẫn cấu hình Supabase (Anonymous Sign-Ins & RLS)

1. Tạo dự án mới trên [Supabase Dashboard](https://supabase.com/dashboard).
2. Vào mục **Authentication → Providers → Anonymous Sign-Ins** và bật tùy chọn **Enable Anonymous Sign-Ins**.
3. Mở **SQL Editor** trên Supabase, sao chép toàn bộ nội dung tệp [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) và nhấn **Run** để khởi tạo các bảng cùng chính sách **Row Level Security (`auth.uid() = user_id`)**.
4. Sao chép `Project URL` và `anon / publishable key` vào tệp `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
   ```

---

## 4. Hướng dẫn cấu hình Gemini API Key

1. Lấy khóa API tại [Google AI Studio](https://aistudio.google.com/).
2. Khai báo biến môi trường phía máy chủ trong tệp `.env` hoặc trong phần **Environment Variables** của Vercel:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```
   *(Lưu ý: Không bao giờ đặt tiền tố `VITE_` trước `GEMINI_API_KEY` để tránh lộ khóa API ra trình duyệt).*

---

## 5. Hướng dẫn triển khai lên GitHub và Vercel

1. Đẩy mã nguồn lên kho lưu trữ GitHub của bạn.
2. Truy cập [Vercel Dashboard](https://vercel.com/new) và chọn **Import Git Repository**.
3. Cấu hình các biến môi trường trong **Project Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `GEMINI_API_KEY`
4. Nhấn **Deploy**. Tệp `vercel.json` và các hàm Serverless trong thư mục `/api` (`api/ai.js`, `api/health.js`, `api/config.js`) sẽ tự động định tuyến Backend và Frontend SPA.
