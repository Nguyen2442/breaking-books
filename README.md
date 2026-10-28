# Breaking Books 📚⚡

> Nền tảng bóc tách tri thức sách chuyên sâu, trực quan hóa kiến thức kỹ thuật phức tạp với **Interactive SVG Widgets**, hệ thống ghi chú & highlight thông minh, và pipeline xử lý AI tự động bằng **Google Gemini 3.5**.

---

## ✨ Điểm Nổi Bật

- 📖 **Giao diện đọc Mintlify 3 cột hiện đại**: Tối ưu trải nghiệm đọc sách kỹ thuật dài hàng trăm trang mà không mỏi mắt (phông chữ Inter 17px, line-height 1.88, layout thoáng đãng).
- 🎨 **220+ Interactive SVG Widgets**: Trực quan hóa các khái niệm trừu tượng (LSM-Tree, B-Tree, 2PC, Consensus Raft, Saga Pattern, Event-driven architecture, Sharding...).
- 🧠 **Bộ công cụ đọc chủ động (Active Reading Suite)**:
  - 🖍️ **Highlight & Color Tags**: Tô màu đánh dấu văn bản chuẩn xác theo ngữ cảnh.
  - 📝 **Margin Notes**: Ghi chép tức thì bên lề từng đoạn văn.
  - 🔖 **Bookmarks & Reading Progress**: Tự động lưu tiến độ đọc vào LocalStorage.
  - 🧩 **Spaced Repetition Quizzes & Glossary**: Hơn 150 câu hỏi trắc nghiệm kiểm tra kiến thức tức thì và từ điển thuật ngữ giải thích nhanh.
- ⚡ **Google Gemini 3.5 AI Engine**: Tự động bóc tách PDF/EPUB, chia chương và sinh nội dung bài giảng kèm code tương tác tự động.
- 🏛️ **AuraMind Enterprise Core ([`auramind-core/`](./auramind-core))**:
  - NestJS 10 + TypeScript
  - PostgreSQL 16 + `pgvector` (Semantic Vector Search) + `JSONB` (GIN Index)
  - Redis 7 + BullMQ (Asynchronous Task Queue & Rate Limit Backoff)
  - Global Caching Layer với SHA-256 (Giảm thiểu 100% chi phí AI cho nội dung trùng lặp)

---

## 📚 Sách Hiện Có Trong Thư Viện

1. **Designing Data-Intensive Applications (2nd Edition - Martin Kleppmann)**
   - Trọn vẹn **13/13 chương** (213 topics, 226 interactive SVG widgets, 97 quizzes, 399 glossary terms).
2. **Building Microservices (2nd Edition - Sam Newman)**
   - Trọn vẹn **7/7 chương** (104 topics, 108 interactive SVG widgets, 56 quizzes, 87 glossary terms).

---

## 🚀 Khởi Chạy Nhanh (Local Development)

### 1. Cài đặt Dependencies
```bash
npm install
```

### 2. Cấu hình Biến Môi Trường
Tạo file `.env.local` từ mẫu:
```bash
cp .env.example .env.local
```
Điền Google Gemini API Key của bạn vào `.env.local`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

### 3. Khởi chạy Next.js App
```bash
npm run dev
```
Mở trình duyệt tại [http://localhost:3456](http://localhost:3456).

---

## 🐳 Khởi Chạy AuraMind Backend (Docker Compose)

Hệ thống backend xử lý ngầm và lưu trữ cơ sở dữ liệu vector nằm trong thư mục `auramind-core`:

```bash
cd auramind-core
docker-compose up -d --build
```
Dịch vụ sẽ tự động kích hoạt:
- PostgreSQL 16 + pgvector trên cổng `5432`
- Redis 7 trên cổng `6379`
- NestJS API trên cổng `4000`

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons, Framer Motion
- **AI & LLM**: Google Gemini 3.5 Flash / Flash-Lite API, Structured Outputs JSON Schema
- **Vector DB & Search**: PostgreSQL 16, pgvector (HNSW Index), Gemini text-embedding-004
- **Queue & Cache**: Redis 7, BullMQ, SHA-256 Deduplication

---

## 📄 Bản Quyền & Giấy Phép

Phát hành dưới giấy phép [MIT License](./LICENSE).
