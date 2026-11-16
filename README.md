# LITERATURE STUDIO v2.0
## AI Music, Literature & Presentation Assistant

**Literature Studio** là nền tảng không gian làm việc hợp nhất dành cho giáo viên, học sinh – sinh viên và người yêu văn học, kết hợp:
- **Music Library & Master Bot Player**: Quản lý âm nhạc cục bộ qua IndexedDB, phát nhạc bằng Web Audio API với Spectrum Analyzer, Waveform và cơ chế **Audio Ducking** tự động giảm âm lượng nhạc nền khi đọc văn bản.
- **Video Player**: Trình phát video hỗ trợ MP4/WebM, phụ đề văn học, điều chỉnh tốc độ, Picture-in-Picture và chế độ tạo video minh họa thơ bằng Canvas.
- **Literature Library & Workspace**: Quản lý tác phẩm theo 8 phân loại (Thơ, Truyện ngắn, Tiểu thuyết, Kịch, Nghị luận, Tài liệu học tập, Tài liệu thuyết trình, Tài liệu cá nhân), hỗ trợ Highlight, Annotation, Bookmark, Ghi chú và **Text-to-Speech (Web Speech API)** ưu tiên giọng đọc tiếng Việt.
- **AI Literature Assistant**: Trợ lý Ngữ văn chuyên sâu sử dụng **Google Gemini API (`@google/genai`)** thông qua Backend, hỗ trợ 6 chế độ chuyên biệt, lưu lịch sử hội thoại theo tài khoản và quản lý hạn mức (15 lượt/ngày/tài khoản).
- **Presentation Mode & Meeting Integration**: Công cụ thiết kế slide văn học, tạo dàn ý thuyết trình bằng AI, trình chiếu toàn màn hình kèm Speaker Notes, đồng hồ bấm giờ, nhạc nền và hỗ trợ chia sẻ âm thanh qua Google Meet / Zoom / Discord.

---

## Kiến trúc hệ thống

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Web Audio API, Web Speech API, IndexedDB.
- **Backend**: Node.js / Express (`server.ts`) tương thích cấu trúc API endpoints (`/api/ai`, `/api/health`, `/api/usage`, `/api/conversations`, `/api/settings`).
- **Database & Auth**: Google Cloud SQL for PostgreSQL + Drizzle ORM (`src/db/schema.ts`) & Firebase Authentication (Google Sign-In) + SQL schema/RLS tương thích Supabase (`database/schema.sql`, `database/policies.sql`).
- **AI SDK**: `@google/genai` gọi trực tiếp từ tầng Backend (`GEMINI_API_KEY` được bảo vệ hoàn toàn ở phía server).

---

## Cài đặt & Chạy ứng dụng

1. Sao chép `.env.example` sang `.env` và cấu hình biến môi trường:
   ```bash
   cp .env.example .env
   ```
2. Cài đặt dependencies:
   ```bash
   npm install
   ```
3. Khởi chạy server phát triển (Port 3000):
   ```bash
   npm run dev
   ```
4. Kiểm thử logic bằng Unit Test:
   ```bash
   npx --yes tsx --test src/utils/studioLogic.test.ts
   ```
