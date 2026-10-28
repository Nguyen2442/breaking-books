# Breaking Books — Tài liệu Kiến trúc, Kế hoạch & Lộ trình Phát triển (Product & Engineering Roadmap)

> **Tầm nhìn (Vision):** Biến những cuốn sách kỹ thuật, giáo trình và tài liệu chuyên sâu dày hàng trăm trang (như *Designing Data-Intensive Applications*, *System Design*, *Database Internals*, tài liệu Onboarding Engineering...) thành **Hệ thống Học tập Tương tác (Interactive Visual Book)** — nơi mỗi chương được bóc tách thành các chủ đề ngắn gọn, đi kèm ví dụ thực tế, sơ đồ SVG thao tác trực tiếp (interactive mini-labs), chú giải thuật ngữ song ngữ và câu hỏi kiểm tra hiểu bài (Active Recall Quiz).

---

## 1. Định vị Sản phẩm & Khác biệt Cốt lõi (So với ChatWithPDF / NotebookLM)

| Tiêu chí | ChatWithPDF / AI Q&A truyền thống | Breaking Books (Interactive Book Deconstruction) |
| :--- | :--- | :--- |
| **Mô hình tương tác** | **Reactive (Bị động):** Người dùng phải tự nghĩ ra câu hỏi để hỏi khung chat. Khi mới đọc sách khó, người đọc thường *"không biết mình không biết gì"* để hỏi. | **Proactive & Structured (Chủ động dẫn dắt):** Giữ nguyên mạch tư duy hệ thống của tác giả nhưng bóc tách sẵn từng mục (`1.1`, `1.2`...) thành bài học hoàn chỉnh. |
| **Cách truyền đạt khái niệm khó** | Trả lời bằng các đoạn văn bản thuần tuý (text wall) dễ gây buồn ngủ. | **Visual & Manipulable (Trực quan & Thao tác được):** Mỗi khái niệm đi kèm sơ đồ SVG động, thanh trượt (slider), bộ chuyển trạng thái (stepper) để tự tay thử các kịch bản đánh đổi (trade-offs). |
| **Độ sâu kiến thức** | Thường tóm tắt bề nổi thông qua RAG (chỉ lấy vài đoạn văn liên quan), dễ bỏ sót chi tiết quan trọng của chương. | **Bám sát 100% chương sách gốc:** Xử lý toàn bộ văn bản chương (`text/chN.txt`) kết hợp quy ước biên soạn nghiêm ngặt (`CONTRACT.md`). |
| **Khả năng ghi nhớ (Retention)** | Đọc xong cuộc hội thoại là quên, khó tra cứu lại theo cấu trúc chương mục. | Có **TL;DR**, **Callout bẫy thực tế**, **Tooltip thuật ngữ Anh–Việt**, **Quiz cuối chương** và **Theo dõi tiến độ đọc (`localStorage`)**. |

---

## 2. Các Use Case Thực tế & Tệp Người dùng Mục tiêu

1. **Kỹ sư Phần mềm & Sinh viên CNTT (B2C / Prosumer):**
   - Đọc các sách "kinh điển nhưng khó nuốt": *DDIA (1e/2e)*, *Operating Systems: Three Easy Pieces*, *Database Internals*, *Designing Distributed Systems*.
   - Ôn luyện phỏng vấn **System Design** thông qua các mini-lab mô phỏng thực tế (OLTP vs OLAP, LSM-Tree vs B-Tree, Replication Lag, Raft Consensus, Partitioning...).
2. **Đội ngũ Engineering tại Doanh nghiệp (B2B Internal Training):**
   - Chuyển đổi tài liệu kiến trúc hệ thống nội bộ (RFCs, Architecture Docs, Runbooks) thành cẩm nang tương tác để **Onboarding kỹ sư mới** nhanh gấp 3 lần.
3. **Tác giả Sách kỹ thuật, Giảng viên & EdTech Creators (B2B2C):**
   - Cung cấp công cụ "Studio" giúp tác giả biến bản thảo PDF/Markdown của mình thành **Interactive Web Book** bán kèm sách giấy hoặc khoá học.

---

## 3. Kiến trúc Kỹ thuật Hiện tại (Next.js App Router Architecture)

Dự án đã được nâng cấp lên **Next.js 15 (App Router) + React 19 + Tailwind CSS v4 + Framer Motion** để giải quyết triệt để bài toán hiệu năng cuộn trang (120fps) và trải nghiệm UX đơn giản, tinh gọn.

### 3.1. Sơ đồ Luồng hoạt động (System Pipeline)

```
[File PDF Sách gốc]
       │
       ▼ (1) PyMuPDF Extractor (tools/pdf_extract.py)
[Thư mục sách: <bookId>/text/ch1.txt ... chN.txt + book.json]
       │
       ▼ (2) AI Deconstruction Engine (Claude Code CLI hoặc VS Code Claude Extension + CONTRACT.md)
[Mã nguồn từng chương: <bookId>/src/chN.html (Lý thuyết + Quiz) & <bookId>/src/chN.js (Interactive SVG Labs)]
       │
       ▼ (3) Next.js Per-Chapter Route (/books/[bookId]/ch/[chNum])
[Trình đọc tương tác tốc độ cao: Chỉ nạp đúng 1 chương (~60KB) vào DOM + kích hoạt window.DDIA.mountChapter()]
```

### 3.2. Cấu trúc Thư mục Dự án

```text
breaking-books/
├── app/                                      # Next.js 15 App Router
│   ├── layout.jsx                            # Root layout (Font Be Vietnam Pro, Literata, JetBrains Mono + /ddia-runtime.js)
│   ├── globals.css                           # Hệ thống Design Tokens (Warm Paper Light / Obsidian Dark) & Card styles
│   ├── page.jsx                              # Trang chủ Studio: Quản lý kho sách, Card các chương, tạo sách PDF, Claude CLI Drawer
│   ├── books/[bookId]/
│   │   ├── layout.jsx                        # Layout Đọc sách: DUY NHẤT 1 Sidebar Mục lục + 1 Topbar + Thanh tiến độ đọc
│   │   ├── page.jsx                          # Tự động điều hướng /books/[bookId] -> /books/[bookId]/ch/1
│   │   └── ch/[chNum]/page.jsx               # Trang Đọc từng chương: Nạp động HTML/JS của đúng 1 chương, kích hoạt SVG & Quiz
│   └── api/                                  # Backend API Routes
│       ├── overview/route.js                 # Trả về thống kê toàn bộ sách, tiến độ từng chương, trạng thái Claude CLI
│       ├── books/[bookId]/chapters/[chNum]/  # Trả về nội dung HTML + JS của 1 chương cụ thể
│       ├── books/upload-pdf/route.js         # Upload file PDF sách mới vào thư mục books/
│       ├── books/create/route.js             # Tạo sách mới & gọi PyMuPDF tự động tách chương
│       └── jobs/                             # Quản lý tiến trình Claude CLI chạy ngầm (start, stop, SSE stream)
├── lib/
│   └── books.js                              # Core Backend Library: Quét metadata chương, đếm SVG/Quiz, spawn Claude CLI
├── public/
│   └── ddia-runtime.js                       # Bộ thư viện UI/SVG tương tác (window.DDIA: slider, seg, svg, quiz, glossary)
├── tools/
│   ├── pdf_extract.py                        # Script Python (PyMuPDF) trích xuất Mục lục & tách văn bản từng chương từ PDF
│   └── smoke.mjs                             # Script kiểm thử tự động bằng Playwright
└── ddia-2e/                                  # Kho dữ liệu cuốn "Designing Data-Intensive Applications (2e + 1e)"
    ├── book.json                             # Metadata 13 chương
    ├── CONTRACT.md                           # Quy chuẩn thiết kế bài học & viết SVG widget cho AI Agent
    ├── text/                                 # Văn bản thô từng chương (ch1.txt -> ch13.txt)
    └── src/                                  # Nội dung đã bóc tách (ch1.html, ch1.js ... ch13.html, ch13.js)
```

---

## 4. Lộ trình Phát triển theo Giai đoạn (Project Phases)

### ✅ Phase 1: Nền tảng Core & Chuẩn hoá Cấu trúc Sách mẫu (Đã hoàn thành)
- **Mục tiêu:** Xây dựng bộ khung bóc tách sách kỹ thuật đầu tiên với cuốn *Designing Data-Intensive Applications (DDIA 2e/1e)*.
- **Kết quả đạt được:**
  - Trích xuất đầy đủ văn bản gốc 13 chương (`ddia-2e/text/ch1.txt` – `ch13.txt`).
  - Thiết lập quy chuẩn biên soạn [`CONTRACT.md`](file:///Users/elysion/Developments/breaking-books/ddia-2e/CONTRACT.md) và thư viện runtime [`ddia-runtime.js`](file:///Users/elysion/Developments/breaking-books/public/ddia-runtime.js) hỗ trợ vẽ sơ đồ SVG, thanh trượt, bộ tạo số ngẫu nhiên có seed, chú giải thuật ngữ và trắc nghiệm.
  - Hoàn thiện 100% cả lý thuyết (`html`) lẫn mô phỏng tương tác (`js`) cho **6 chương lớn** (Chương 1, 2, 3, 4, 5, 10) và hoàn thành phần nội dung cho các chương còn lại.

### ✅ Phase 2: Nâng cấp Kiến trúc Next.js App Router & Tối ưu UX/Performance (Đã hoàn thành)
- **Mục tiêu:** Khắc phục triệt để hiện tượng giật lag khi cuộn trang và lỗi lặp 2 thanh mục lục.
- **Kết quả đạt được:**
  - Chuyển đổi sang **Next.js App Router** chạy tại `http://localhost:3456`.
  - Tách mỗi chương thành một route độc lập (`/books/[bookId]/ch/[chNum]`), giảm dung lượng DOM mỗi trang từ **1.3 MB (13 chương)** xuống chỉ còn **~60 KB (1 chương)**.
  - Loại bỏ hoàn toàn cơ chế chiếm quyền cuộn chuột (`Lenis` wheel-hijacking) và `backdrop-filter` nặng GPU, trả lại tốc độ cuộn **120fps nguyên bản của macOS**.
  - Thiết kế lại UI theo phong cách **Readwise / Notion / Linear** tối giản: nền giấy ấm (`#FAF9F5`), thẻ Card bo góc thoáng đãng, viền mảnh `1px`, chuyển trang mượt với Framer Motion.
  - Tích hợp **2 chế độ AI Breaking**:
    1. Chạy trực tiếp **Claude Code CLI** (`/opt/homebrew/bin/claude`) dưới nền và xem log thời gian thực.
    2. Nút **Copy Prompt 1-click** để dán trực tiếp vào **VS Code Claude Extension**.

---

### ✅ Phase 3: Hoàn thiện 100% Sơ đồ Tương tác cho DDIA & Tự động hoá Kiểm định (Đã hoàn thành)
- **Mục tiêu:** Đưa toàn bộ 13/13 chương của *DDIA 2e* đạt trạng thái **Hoàn chỉnh (Complete)** và chuẩn hoá công cụ kiểm định tự động.
- **Kết quả đạt được:**
  1. **13/13 chương đạt `status: complete` (0 lỗi runtime/console):**
     - **213 chủ đề bài giảng (`article.topic`)** bằng tiếng Việt rõ ràng kèm TL;DR và Callout thực tế.
     - **228 mô phỏng SVG tương tác (`figure.lab[data-ready="1"]`)** phủ kín từ Chương 1 đến Chương 13 ([ddia-2e/src/](file:///Users/elysion/Developments/breaking-books/ddia-2e/src)).
     - **97 câu hỏi trắc nghiệm (Quiz)** và **399 thuật ngữ song ngữ Anh–Việt (`<dfn data-term>`)**.
  2. **Công cụ Kiểm định Tự động ([tools/validate-book.mjs](file:///Users/elysion/Developments/breaking-books/tools/validate-book.mjs)):**
     - Tự động kiểm tra cú pháp JS (`node --check`), đối chiếu mọi `data-widget` giữa `.html` và `.js`, và thống kê độ phủ thuật ngữ.

---

### ✅ Phase 4: Không gian Học tập Cá nhân Thông minh (Personal Learning Workspace — Đã hoàn thành)
- **Mục tiêu:** Biến trình đọc sách thành không gian học tập cá nhân hoá sâu sắc.
- **Kết quả đạt được:**
  1. **Tìm kiếm Toàn văn tức thì (`Cmd + K` / `Ctrl + K`):**
     - API lập chỉ mục toàn sách ([app/api/books/[bookId]/search-index/route.js](file:///Users/elysion/Developments/breaking-books/app/api/books/%5BbookId%5D/search-index/route.js)) và hộp thoại `CommandSearchModal` ([components/LearningWorkspaceModals.jsx](file:///Users/elysion/Developments/breaking-books/components/LearningWorkspaceModals.jsx)) cho phép tìm kiếm xuyên suốt 213 chủ đề, 228 mô phỏng SVG và 399 thuật ngữ.
  2. **Ghi chú Cá nhân trực tiếp trên từng Topic (`+ Ghi chú`):**
     - Tích hợp trình soạn ghi chú ngay cuối mỗi bài học trong [public/ddia-runtime.js](file:///Users/elysion/Developments/breaking-books/public/ddia-runtime.js), tự động lưu trữ bền vững và cho phép tải xuống thành file Markdown (`.md`).
  3. **Flashcards Thuật ngữ Song ngữ & Xuất bộ thẻ Anki (`.tsv`):**
     - Chế độ ôn tập ngắt quãng (`FlashcardsModal`) lọc theo từng chương, đánh dấu *"Đã thuộc"* / *"Cần ôn"* và xuất trực tiếp sang định dạng Anki TSV.

---

### ✅ Phase 5: Đóng gói & Xuất bản Đa định dạng (Publisher & Export Engine — Đã hoàn thành)
- **Mục tiêu:** Đóng gói sách theo mô hình *"Generate Once, Read Many"* để chia sẻ hoặc đọc offline không cần server.
- **Kết quả đạt được:**
  - Xây dựng API xuất bản [app/api/books/[bookId]/export/route.js](file:///Users/elysion/Developments/breaking-books/app/api/books/%5BbookId%5D/export/route.js) và giao diện **Ghi chú & Xuất bản** hỗ trợ tải xuống 3 định dạng chỉ với 1 cú nhấp chuột:
    1. **Standalone Web Book (`.html`):** 1 file HTML độc lập duy nhất (`ddia-2e/dist/index.html`) chứa trọn bộ 13 chương và 228 mô phỏng SVG chạy offline.
    2. **Complete Study Guide (`.md`):** Tài liệu tóm tắt toàn bộ TL;DR, lưu ý thực tế và từ điển 399 thuật ngữ (`ddia-2e/dist/study-guide.md`).
    3. **Anki Flashcards Deck (`.tsv`):** Bộ 399 thẻ thuật ngữ song ngữ (`ddia-2e/dist/flashcards-anki.tsv`).

---

## 5. Hướng dẫn Vận hành Nhanh cho Developer

### Khởi chạy ứng dụng Next.js
```bash
npm run dev
# Truy cập Studio tại: http://localhost:3456
# Truy cập thẳng trình đọc Chương 1 tại: http://localhost:3456/books/ddia-2e/ch/1
```

### Quy trình hoàn thiện thêm 1 chương mới (bằng VS Code Claude hoặc Claude CLI)
1. Mở trang Studio tại `http://localhost:3456` hoặc vào thẳng chương cần hoàn thiện (ví dụ `/books/ddia-2e/ch/6`).
2. **Cách 1 (Khuyên dùng với VS Code Claude Extension):** Bấm nút **"Copy Prompt VS Code"** trên thẻ chương $\rightarrow$ Dán vào khung chat Claude trong VS Code.
3. **Cách 2 (Tự động chạy ngầm):** Bấm nút **"Chạy Claude CLI"** $\rightarrow$ Mở ngăn **Claude CLI** ở góc phải trên để xem tiến trình viết code trực tiếp.
4. Sau khi AI lưu file vào `ddia-2e/src/chN.html` hoặc `ddia-2e/src/chN.js`, chỉ cần tải lại trang chương đó trên trình duyệt để trải nghiệm ngay mà không cần build lại cả dự án.
