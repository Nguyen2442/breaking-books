# TÀI LIỆU TOÀN DIỆN VỀ KIẾN TRÚC, CÔNG NGHỆ & TÍNH NĂNG HỆ THỐNG
## NỀN TẢNG ĐỌC SÁCH KỸ THUẬT TƯƠNG TÁC — BREAKING BOOKS (AURAMIND)

> **Phiên bản tài liệu:** 2.0 (Cập nhật tháng 10/2026)  
> **Phong cách sản phẩm:** Mintlify & Stripe Docs (Sạch sẽ, hiện đại, tối ưu trải nghiệm học sâu)  
> **Tông màu chủ đạo:** Bright White / Slate Dark với điểm nhấn Cam rực rỡ (Orange 600 & Warm Amber)

---

## MỤC LỤC
1. [Tổng quan hệ thống (System Overview)](#1-tổng-quan-hệ-thống)
2. [Ngăn xếp công nghệ (Technology Stack)](#2-ngăn-xếp-công-nghệ)
3. [Kiến trúc cơ sở dữ liệu (Database Architecture)](#3-kiến-trúc-cơ-sở-dữ-liệu)
4. [Chi tiết các tính năng cốt lõi (Core Features)](#4-chi-tiết-các-tính-năng-cốt-lõi)
   - 4.1. Giao diện đọc sách tương tác & Mini-Lab SVG
   - 4.2. Thanh công cụ Bôi đen (Highlight), Ghi chú & Đánh dấu
   - 4.3. Chế độ đọc trước văn bản gốc khi chờ AI bóc tách
   - 4.4. Bộ máy bóc tách AI song song đa Key (Multi-Key Pool)
   - 4.5. Hệ thống Prompt động & Tri thức 12 ngành (Domain Knowledge Engine)
   - 4.6. Kiến trúc Cache 4 tầng (0ms Instant Load & $0 AI Cache)
5. [Quy trình xử lý & Luồng chạy (Execution Flows with Mermaid)](#5-quy-trình-xử-lý--luồng-chạy)
   - Luồng 1: Tải lên PDF và bóc tách sách bằng AI
   - Luồng 2: Điều hướng chương sách & Render giao diện
   - Luồng 3: Bôi đen chữ, Tạo ghi chú & Xuất Markdown
   - Luồng 4: Quản lý Multi-Key Pool & Tự động phục hồi lỗi (Circuit Breaker)
6. [Cấu hình môi trường & Vận hành (Deployment Guide)](#6-cấu-hình-môi-trường--vận-hành)

---

## 1. TỔNG QUAN HỆ THỐNG

**Breaking Books** là nền tảng đọc và học sách chuyên ngành kỹ thuật thế hệ mới. Thay vì đọc các file PDF hàng trăm trang khô khan và thụ động, hệ thống sử dụng **Trí tuệ nhân tạo (AI)** để bóc tách từng chương sách thành:
* **Lý thuyết cô đọng (Prose):** Đoạn văn ngắn 2-3 câu, thuật ngữ có tooltip tra cứu (`<dfn>`), danh sách gạch đầu dòng trực quan.
* **Phòng thử nghiệm tương tác (SVG Mini-Labs):** Mô phỏng trực quan các thuật toán phân tán, luồng gói tin, sự cố sập node, phân vùng dữ liệu với thanh trượt và nút tương tác thực tế.
* **Ghi nhớ chủ động (Active Recall):** Bộ flashcard và câu hỏi trắc nghiệm kiểm tra hiểu bài ngay tại chỗ.
* **Sổ tay cá nhân:** Bôi đen đổi màu, gắn ghi chú trực tiếp, đánh dấu bài học và xuất Markdown.

```mermaid
graph TD
    User["Người dùng (Web / Mobile)"] --> NextApp["Next.js 15 (App Router)"]
    
    subgraph Frontend["Giao diện Đọc & Studio (Client)"]
        Reader["Reader Suite (Mintlify Style)"]
        Highlighter["Floating Highlight & Note Suite"]
        RawReader["Smart Raw Text Fallback Reader"]
        LabEngine["DDIA SVG Mini-Lab Runtime"]
    end
    
    subgraph Backend["Tầng Xử lý & Hàng đợi (Server)"]
        API["Next.js Route Handlers (/api/...)"]
        Queue["Background Processing Queue (Concurrency: 4)"]
        KeyPool["Gemini Multi-Key Pool (Round-Robin)"]
        TextParser["Smart PDF Text Unwrapper & Formatter"]
    end
    
    subgraph Storage["Tầng Lưu trữ & Cache"]
        ClientCache["Client Map & SessionStorage (0ms)"]
        RamCache["Server Memory TTL Cache (30s)"]
        PG["PostgreSQL 16 + Prisma ORM + pgvector"]
        Disk["Static Disk Assets (HTML/JS/CSS)"]
    end
    
    NextApp --> Frontend
    NextApp --> Backend
    Backend --> Storage
```

---

## 2. NGĂN XẾP CÔNG NGHỆ (TECHNOLOGY STACK)

| Phân tầng | Công nghệ | Phiên bản | Vai trò & Lý do lựa chọn |
| :--- | :--- | :--- | :--- |
| **Framework** | **Next.js (App Router)** | 15.5.x | Hỗ trợ Server Components, Streaming SSR, API Routes, tối ưu bundle và SEO hoàn hảo. |
| **Giao diện** | **React** | 19.x | Quản lý state mượt mà, render hiệu năng cao. |
| **Styling** | **Tailwind CSS v4** | 4.x | Hệ thống utility hiện đại, tốc độ build siêu nhanh, tích hợp CSS Variables. |
| **Animation** | **Framer Motion** | 12.x | Tạo hiệu ứng xuất hiện, trượt mượt mà (0.15s) cho modal, popover và drawer. |
| **Icons** | **Lucide React** | Mới nhất | Hệ thống biểu tượng vector chuẩn UI thiết kế. |
| **Cơ sở dữ liệu** | **PostgreSQL** | 16.x | Lưu trữ toàn vẹn dữ liệu sách, chương, JSONB cấu trúc, và vector ngữ nghĩa. |
| **ORM** | **Prisma** | 5.22.x | Type-safe database client, quản lý migration và schema nhất quán. |
| **Vector DB** | **pgvector** | Extension | Lưu trữ vector 768 chiều phục vụ tìm kiếm ngữ nghĩa (Semantic Search). |
| **AI Engine** | **Hệ thống AI Engine** | REST API | Bóc tách lý thuyết, sinh mã HTML, SVG tương tác và câu hỏi trắc nghiệm. |
| **Xử lý PDF** | **pdf-parse** | 1.1.x | Trích xuất text từ PDF không cần phần mềm ngoài, khử lỗi null byte `0x00`. |
| **Môi trường chạy** | **Node.js** | 20.x LTS | Đảm bảo tương thích cao nhất trên macOS, Linux và Render.com. |

---

## 3. KIẾN TRÚC CƠ SỞ DỮ LIỆU (DATABASE ARCHITECTURE)

Hệ thống sử dụng PostgreSQL kết hợp tính năng **JSONB** (lưu trữ linh hoạt không giới hạn cấu trúc bài học) và **pgvector** (tìm kiếm tương đồng ngữ nghĩa):

```mermaid
erDiagram
    Book ||--o{ Chapter : "contains"
    Chapter ||--o{ ChapterEmbedding : "has vectors"
    DomainKnowledge ||--o{ PromptTemplate : "uses"
    DomainKnowledge ||--o{ CrawledTerm : "collects"

    Book {
        string id PK
        string title
        string author
        string coverUrl
        int pageCount
        int totalWords
        enum status
        string sourceFile
        datetime createdAt
    }

    Chapter {
        string id PK
        string bookId FK
        int chapterNumber
        string title
        string contentHash "SHA-256 (Global Cache)"
        text rawText
        json content "JSONB cấu trúc"
        enum status
        boolean isCached
        string aiModelUsed
    }

    ChapterEmbedding {
        string id PK
        string chapterId FK
        int chunkIndex
        text chunkText
        vector embedding "768 dimensions"
    }

    DomainKnowledge {
        string id PK
        string domainKey UK "software, marketing, finance..."
        string nameVi
        string roleName
        json keywords
        text coreGuidance
        json widgetLabBlueprint
    }

    PromptTemplate {
        string id PK
        string key "chapter-break, mindmap..."
        string domainKey FK
        int version
        text systemInstruction
        text promptTemplate
        json parameters
    }

    CrawledTerm {
        string id PK
        string domainKey FK
        string term
        string viTranslation
        text definition
        string source
    }
```

### Điểm nhấn thiết kế Schema:
1. **Mã băm toàn cục `contentHash` (SHA-256):** Mỗi khi một chương sách được xử lý, mã băm nội dung thô được tính toán. Nếu cùng một chương được upload lại (hoặc upload ở cuốn sách khác), hệ thống tái sử dụng ngay bài học cũ mà không tốn 1 đồng chi phí gọi AI Gemini.
2. **Dynamic Knowledge & Prompt Engine (`domain_knowledge` & `prompt_templates`):** Hệ thống không hard-code bất kỳ câu prompt hay từ khóa nào trong mã nguồn. Toàn bộ logic chuyên gia (phần mềm, marketing, tài chính, tâm lý học...) được cấu hình trong bảng dữ liệu, sẵn sàng nạp thêm từ khóa thu thập tự động.
3. **Trích xuất tối ưu (Query Projection):** Các truy vấn lấy danh sách sách trên trang chủ luôn loại bỏ cột `rawText` (chiếm 98% dung lượng payload), giúp thời gian phản hồi API giảm từ **5,000ms xuống 4ms**.

---

## 4. CHI TIẾT CÁC TÍNH NĂNG CỐT LÕI (CORE FEATURES)

### 4.1. Giao diện đọc sách tương tác & Mini-Lab SVG
* **Bố cục 3 cột phong cách Mintlify:**
  * Cột trái: Mục lục sách (TOC) phân cấp rõ ràng theo chương và bài học.
  * Cột giữa: Khung nội dung chính với tỷ lệ typography chuẩn mực (cỡ chữ 17px, line-height 1.88).
  * Cột phải: Dàn ý bài học theo thời gian thực (On This Page), tự động cuộn sáng theo vị trí đọc.
* **Mini-Lab trực quan thao tác trực tiếp:**
  * Các widget nhúng độc lập (`data-widget="..."`) cho phép mô phỏng trực tiếp trên trình duyệt.
  * Ví dụ: Bấm vào một Node trong cụm phân tán để làm nó "chết", quan sát hệ thống chuyển giao Leader sang Follower và thuật toán bầu cử diễn ra tức thì.
* **Active Recall Quiz & Flashcards:**
  * Cuối mỗi bài học có các câu hỏi trắc nghiệm 4 đáp án kiểm tra ngay mức độ hiểu bài.
  * Phản hồi thị giác lập tức: Xanh lá nếu đúng kèm giải thích tại sao; Đỏ nếu sai kèm gợi ý đọc lại phần nào.

---

### 4.2. Thanh công cụ Bôi đen (Highlight), Ghi chú & Đánh dấu
Được thiết kế khắc phục hoàn toàn tình trạng chập chờn ("lúc được lúc không"):

```mermaid
flowchart TD
    Select["Người dùng bôi đen đoạn văn bản (Mouse / Trackpad / Touch)"] --> Detect["Lắng nghe pointerup / touchend / keyup"]
    Detect --> Check{"Vùng chọn hợp lệ?\n(Độ dài >= 2 ký tự & nằm trong bài học)"}
    Check -- Không --> Dismiss["Ẩn thanh công cụ"]
    Check -- Có --> ViewportMath["Tính toạ độ Viewport (BoundingClientRect)\nÁp dụng bộ kẹp biên màn hình (Clamping)"]
    ViewportMath --> RenderToolbar["Hiển thị Floating Toolbar ghim trên đoạn text"]
    
    RenderToolbar --> ActionChoice{"Người dùng bấm thao tác nào?"}
    ActionChoice -- "Chọn màu (1-5)" --> ApplyHl["Tạo thẻ mark.bb-highlight-{color}\nLưu vào LocalStorage & Cập nhật DOM"]
    ActionChoice -- "Bấm Ghi chú" --> ExpandNote["Mở ô textarea\nGõ ghi chú & bấm ⌘+Enter để lưu"]
    ActionChoice -- "Copy trích dẫn" --> CopyText["Copy text kèm nguồn trích dẫn"]
    ActionChoice -- "Cuộn trang" --> AutoTrack["Auto-tracking theo vị trí văn bản hoặc tự ẩn khi trượt khỏi màn hình"]
```

* **Toạ độ Viewport thuần túy (Fixed Positioning):** Không cộng dồn `window.scrollY` vào phần tử `position: fixed`, đảm bảo thanh công cụ luôn nằm sát phía trên đoạn văn được chọn dù người dùng đã cuộn trang sâu tới đâu.
* **Phím tắt tiện dụng:** 
  * `1` đến `5`: Chọn nhanh màu highlight.
  * `Esc`: Đóng thanh công cụ hoặc popover.
  * `⌘ + Enter` (hoặc `Ctrl + Enter`): Lưu nhanh ghi chú mà không cần nhấp chuột.
* **Ngăn quản lý toàn diện (Drawer):** Tìm kiếm toàn bộ trích dẫn đã lưu, lọc theo màu, và một cú nhấp chuột để xuất ra file Markdown (`.md`).

---

### 4.3. Chế độ đọc trước văn bản gốc khi chờ AI bóc tách
Khi người dùng tải lên sách mới, trong lúc AI đang xử lý ngầm, hệ thống cho phép đọc trước bản trích xuất chất lượng cao thay vì bắt người dùng chờ đợi:
* **Khử lặp tiêu đề:** Nếu phụ đề chương trùng tiêu đề, hệ thống thay bằng lời dẫn nhập tinh tế.
* **Smart Text Unwrapper (`lib/formatRawText.js`):**
  * Tự động nối các câu bị gãy dòng 60 ký tự của PDF.
  * Nhận diện lời nhận xét của chuyên gia (`—Chris Riccomini...`) và tự động đóng khung thành **Pull-quote block** viền cam.
  * Nhận diện các tiêu đề mục và danh sách gạch đầu dòng trực quan.
* **Hỗ trợ đầy đủ tương tác:** Mọi tính năng bôi đen highlight, ghi chú và đánh dấu hoạt động bình thường trên văn bản đọc trước này.

---

### 4.4. Bộ máy bóc tách AI song song đa Key (Multi-Key Pool)
Để tối ưu hóa chi phí và vượt qua giới hạn Rate-limit (RPM/TPM) của các gói Gemini API miễn phí, hệ thống tích hợp bộ điều phối Multi-Key thông minh:

```mermaid
sequenceDiagram
    participant Worker as Background Worker
    participant Pool as Multi-Key Pool (gemini.js)
    participant Key1 as Gemini Key 1 (...RpMQ)
    participant Key2 as Gemini Key 2 (...3wow)
    
    Worker->>Pool: callGemini(Prompt)
    Pool->>Pool: Chọn Key kế tiếp (Round-Robin)
    Pool->>Key1: Gửi Request (HTTP POST)
    alt Trả về HTTP 200 OK
        Key1-->>Pool: Trả về JSON bóc tách bài học
        Pool-->>Worker: Hoàn thành bài học
    else Gặp HTTP 429 Quota Exceeded
        Key1-->>Pool: HTTP 429 Rate Limit
        Pool->>Pool: Đánh dấu Key 1 Cooldown (60 giây)
        Pool->>Key2: Tự động chuyển vùng gọi Key 2 (Failover)
        Key2-->>Pool: Trả về HTTP 200 OK
        Pool-->>Worker: Hoàn thành bài học
    end
```

* **Xoay vòng Round-Robin:** Phân bổ đều lưu lượng giữa các Key trong mảng cấu hình `GEMINI_API_KEYS`.
* **Cơ chế Circuit Breaker:** Khi một Key bị HTTP 429, hệ thống tự động cách ly Key đó trong 60 giây và chuyển tiếp ngay lập tức sang Key còn hạn mức mà tiến trình không bị gián đoạn.
* **Xử lý song song:** Cấu hình mặc định xử lý đồng thời 4 chương sách (`QUEUE_CONCURRENCY = 4`), rút ngắn thời gian bóc tách toàn bộ cuốn sách xuống chỉ còn vài phút.

---

### 4.5. Hệ thống Prompt động & Tri thức 12 ngành (Domain Knowledge Engine)
Hệ thống sở hữu bộ tri thức chuyên gia cho 12 lĩnh vực:
1. **Software Architecture & Distributed Systems** (Kiến trúc phần mềm & Hệ phân tán)
2. **Marketing & Growth** (Nghiên cứu thị trường, Phân khúc, Phễu chuyển đổi)
3. **Finance & Investment** (Đầu tư, Báo cáo tài chính, Dòng tiền)
4. **Business & Management** (Quản trị doanh nghiệp, Vận hành)
5. **Psychology & Human Behavior** (Tâm lý học hành vi, Thiên kiến nhận thức)
6. **Data Science & Analytics** (Khoa học dữ liệu, Thống kê)
7. **AI & Machine Learning** (Trí tuệ nhân tạo, Mô hình ngôn ngữ lớn)
8. **Product Management** (Quản lý sản phẩm, UI/UX)
9. **Operations & Supply Chain** (Chuỗi cung ứng, Tối ưu vận hành)
10. **Blockchain & Web3** (Công nghệ chuỗi khối, Đồng thuận)
11. **Cybersecurity** (An toàn thông tin, Mật mã học)
12. **General Science** (Khoa học tự nhiên & Phương pháp luận)

#### Quy tắc định dạng Scan-friendly (Chống mỏi mắt):
Prompt hệ thống nghiêm cấm việc liệt kê các hệ thống hay tiêu chí bằng câu văn dài dằng dặc nối bởi dấu chấm phẩy (`;`) và dấu phẩy (`,`). Bắt buộc phải chuyển thành danh sách gạch đầu dòng rõ ràng:
* **Ví dụ trước đây:**  
  *Cùng một khái niệm nhưng mỗi hệ thống gọi một tên: shard trong MongoDB, Elasticsearch, SolrCloud; region trong HBase; tablet trong Bigtable; vnode trong Cassandra và Riak; vBucket trong Couchbase.*
* **Định dạng mới bắt buộc:**  
  *Cùng một khái niệm phân mảnh dữ liệu, nhưng mỗi hệ thống có một cách đặt tên riêng:*
  * **Shard:** MongoDB, Elasticsearch, SolrCloud
  * **Region:** Apache HBase
  * **Tablet:** Google Bigtable
  * **vNode:** Apache Cassandra, Riak
  * **vBucket:** Couchbase

---

### 4.6. Kiến trúc Cache 4 tầng (0ms Instant Load & $0 AI Cache)

| Tầng Cache | Vị trí lưu | Cơ chế & Thời gian sống (TTL) | Lợi ích |
| :--- | :--- | :--- | :--- |
| **Tầng 1 (Client RAM)** | Javascript `Map` | Tồn tại trong phiên mở tab | Chuyển đổi giữa các chương diễn ra trong **0 mili-giây** không giật lag. |
| **Tầng 2 (Session Storage)** | Trình duyệt người dùng | Tồn tại đến khi đóng tab | Khi bấm "Quay lại trang chủ", trang hiện ngay lập tức không có loading flash. |
| **Tầng 3 (Server RAM)** | Bộ nhớ Node.js server | TTL 30 giây + Cache `mtime` file | Giảm tải 99% I/O đĩa và truy vấn DB; phản hồi API `/overview` chỉ mất **4ms**. |
| **Tầng 4 (DB Global Cache)** | PostgreSQL `contentHash` | Vĩnh viễn (Permanent) | Nhận diện chương sách đã từng bóc tách; chi phí AI = **$0**. |

---

## 5. QUY TRÌNH XỬ LÝ & LUỒNG CHẠY (EXECUTION FLOWS)

### Luồng 1: Tải lên PDF và bóc tách sách bằng AI

```mermaid
sequenceDiagram
    autonumber
    actor User as Quản trị viên / Độc giả
    participant Studio as Studio UI (/studio)
    participant API as Upload API (/api/books/upload-pdf)
    participant DB as PostgreSQL
    participant Worker as Background Processing Queue
    participant Gemini as Multi-Key Gemini Engine
    participant Disk as Local File Storage

    User->>Studio: Kéo thả file sách PDF
    Studio->>API: HTTP POST Multipart Form Data
    API->>API: pdf-parse trích xuất mục lục & văn bản thô
    API->>API: Khử sạch ký tự lỗi Null Byte (0x00)
    API->>DB: Tạo bản ghi Book & Chapters (Trạng thái: PENDING)
    API-->>Studio: Trả về Book ID & Danh sách chương (Phản hồi < 2s)
    
    User->>Studio: Bấm "Bắt đầu bóc tách AI"
    Studio->>Worker: Kích hoạt hàng đợi bóc tách
    
    loop Mỗi chương trong hàng đợi (Concurrency = 4)
        Worker->>DB: Kiểm tra SHA-256 contentHash
        alt Đã có bản bóc tách trong DB
            DB-->>Worker: Tái sử dụng nội dung (isCached = true, Phí = $0)
        else Chưa có bản bóc tách
            Worker->>Gemini: Gửi Prompt chuyên ngành + Văn bản chương
            Gemini-->>Worker: Trả về JSON (Lý thuyết, SVG Lab, Quiz)
            Worker->>DB: Cập nhật Chapter (Trạng thái: COMPLETED)
            Worker->>Disk: Ghi dự phòng file static ch{N}.html & ch{N}.js
        end
        Worker-->>Studio: Phát tín hiệu Server-Sent Events (SSE) cập nhật tiến độ %
    end
```

---

### Luồng 2: Điều hướng chương sách & Render giao diện

```mermaid
sequenceDiagram
    autonumber
    actor Reader as Độc giả
    participant Client as Trình duyệt (Page /ch/[chNum])
    participant Cache as Client Cache (RAM / Session)
    participant API as Chapter API (/api/books/.../chapters)
    participant Runtime as DDIA Interactive Script Runner

    Reader->>Client: Bấm chọn "Chương 7: Phân vùng dữ liệu"
    Client->>Cache: Kiểm tra ch_ddia-2e_7
    alt Có trong Client Cache
        Cache-->>Client: Trả về dữ liệu chương ngay lập tức (0ms)
    else Chưa có trong Cache
        Client->>API: HTTP GET /api/books/ddia-2e/chapters/7
        API-->>Client: Trả về JSON { html, js, sourceText, quizzes }
        Client->>Cache: Ghi nhớ vào Client Cache
    end
    
    Client->>Client: Render DOM bài học
    Client->>Runtime: Thực thi mã Javascript phòng thử nghiệm (ch7.js)
    Runtime->>Client: Kích hoạt SVG Lab + Bắt sự kiện Slider / Click
    Client->>Client: Tự động cuộn mượt đến #topic nếu URL có hash
```

---

## 6. CẤU HÌNH MÔI TRƯỜNG & VẬN HÀNH (DEPLOYMENT GUIDE)

### Các biến môi trường bắt buộc (`.env`):
```bash
# 1. Cấu hình cơ sở dữ liệu PostgreSQL (Render / Supabase / Neon / Local)
DATABASE_URL="postgresql://postgres:password@localhost:5432/breaking_books?schema=public"

# 2. Khóa API Gemini chính
GEMINI_API_KEY="AIzaSyYourPrimaryGeminiApiKeyHere"

# 3. Danh sách đa khóa API Gemini chạy song song (Cách nhau bởi dấu phẩy)
GEMINI_API_KEYS="AIzaSyKey1...,AIzaSyKey2..."

# 4. Cấu hình cổng ứng dụng
PORT=3456
NODE_ENV="production"
```

### Lệnh vận hành hệ thống:
* **Cài đặt thư viện:** `npm install`
* **Đồng bộ Schema Database:** `npx prisma db push`
* **Sinh Prisma Client:** `npx prisma generate`
* **Build bản phát hành:** `npm run build`
* **Khởi chạy máy chủ production:** `npm run start` (hoặc chạy nền daemon trên port 3456)
* **Mở đường hầm truy cập công khai:** `npx localtunnel --port 3456 --subdomain breaking-books-demo`

---

> [!TIP]
> **Cam kết chất lượng mã nguồn:** Toàn bộ hệ thống được xây dựng theo tiêu chuẩn phòng thủ (defensive programming), tự động fallback an toàn giữa Database và Disk, đảm bảo tính liên tục 100% cho trải nghiệm người dùng ngay cả khi mất kết nối mạng bên ngoài.
