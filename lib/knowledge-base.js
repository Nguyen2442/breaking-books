/**
 * =============================================================================
 * BREAKING BOOKS — GLOBAL MULTI-DOMAIN KNOWLEDGE BASE & ONTOLOGY ENGINE
 * =============================================================================
 * Provides comprehensive domain intelligence across 12 major professional
 * fields: Software, Marketing, Finance, Business Strategy, Psychology,
 * Product Design, Sales & Negotiation, Leadership, Economics, Health,
 * Science, and General Life Principles.
 *
 * Powers:
 * 1. Deep Domain Classification with Weighted Keyword & Context Matching
 * 2. Ultra-Realistic Expert Persona Injection for AI Prompting (Zero-Fluff)
 * 3. Authentic Vietnamese Market Case Studies (Biti's, MoMo, Shopee, Highlands, VinFast...)
 * 4. Domain-Adapted Interactive Visual Lab Simulations (SVG Nodes, Sliders, Actions)
 * =============================================================================
 */

export const KNOWLEDGE_BASE = {
  software: {
    id: 'software',
    nameVi: 'Công nghệ Thông tin, Kỹ thuật Phần mềm & Hệ thống Phân tán',
    nameEn: 'Software Engineering, Computer Science & Distributed Systems',
    roleName: 'PRINCIPAL SOFTWARE ARCHITECT & SENIOR ENGINEERING MENTOR HÀNG ĐẦU',
    perspective: 'KIẾN TRÚC PHẦN MỀM CHỊU TẢI CAO & KỸ THUẬT HỆ THỐNG THỰC CHIẾN',
    keywords: [
      'software', 'phần mềm', 'lập trình', 'programming', 'code', 'developer', 'engineer',
      'architecture', 'kiến trúc', 'microservices', 'monolith', 'distributed system', 'hệ thống phân tán',
      'database', 'cơ sở dữ liệu', 'sql', 'nosql', 'postgres', 'mysql', 'mongodb', 'redis', 'kafka',
      'system design', 'thiết kế hệ thống', 'javascript', 'typescript', 'python', 'java', 'golang', 'rust',
      'api', 'rest', 'graphql', 'grpc', 'backend', 'frontend', 'server', 'client', 'http', 'tcp', 'udp',
      'cache', 'caching', 'devops', 'docker', 'kubernetes', 'ci/cd', 'cloud', 'aws', 'gcp', 'azure',
      'latency', 'độ trễ', 'throughput', 'băng thông', 'concurrency', 'đồng thời', 'thread', 'async',
      'algorithm', 'thuật toán', 'data structures', 'cấu trúc dữ liệu', 'ddia', 'kleppmann', 'sam newman',
      'refactoring', 'clean code', 'design pattern', 'solid', 'security', 'bảo mật', 'swe', 'engineering'
    ],
    foundationalPrinciples: [
      'Trade-offs: Không có giải pháp hoàn hảo, chỉ có sự đánh đổi (Latency vs Consistency, Cost vs Availability).',
      'CAP Theorem & PACELC: Lựa chọn giữa Nhất quán (Consistency) và Sẵn sàng (Availability) khi phân vùng mạng.',
      'Fault Tolerance & Resilience: Thiết kế hệ thống với giả định linh kiện chắc chắn sẽ hỏng (Circuit Breaker, Bulkhead, Retry with Backoff).',
      'Scalability: Mở rộng chiều ngang (Horizontal Scaling) bằng Sharding, Partitioning và Read Replicas.',
      'Single Point of Failure (SPOF): Triệt tiêu mọi nút thắt cổ chai đơn lẻ trong luồng dữ liệu.'
    ],
    coreGuidance: `
- Mở đầu mỗi topic bằng bài toán kỹ thuật / kiến trúc thực tế: Vấn đề gì? Giải pháp kỹ thuật nào? Đánh đổi (Trade-offs) ra sao? Khi nào KHÔNG NÊN dùng?
- Phần 'prose' BẮT BUỘC có từ 3-5 đoạn văn phân tích chuyên sâu, có thuật ngữ bọc trong <dfn data-term="...">, có code mẫu ngắn gọn <code> nếu liên quan.
- Triệt tiêu hoàn toàn lời chào rào đón hay dịch máy. Đi thẳng vào bản chất mã nguồn và cơ chế hoạt động tầng sâu (low-level).
`,
    calloutContext: 'BẮT BUỘC là ví dụ thực chiến cụ thể tại các hệ thống lớn ở Việt Nam (Shopee/Tiki/TikTok Shop xử lý bão sale 11.11, MoMo/ZaloPay xử lý đối soát giao dịch thời gian thực, chuỗi Highlands/The Coffee House đồng bộ đơn hàng POS, Grab/XanhSM định vị tài xế, VNG Zing/Zalo tải hàng triệu WebSocket).',
    keyMetrics: ['Latency P99 (ms)', 'Throughput (req/s)', 'Availability (%)', 'Error Rate (%)', 'CPU/RAM Utilization'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Client / Ingress', sub: 'Request Origin', tone: 'accent' },
        { label: 'API Gateway / LB', sub: 'Traffic Routing', tone: 'ok' },
        { label: 'Service Cluster', sub: 'Core Execution', tone: 'violet' },
        { label: 'Primary DB / Cache', sub: 'State & WAL', tone: 'warn' },
      ],
      slider: {
        label: 'Tải lượng request đồng thời',
        min: 100,
        max: 5000,
        step: 50,
        value: 1000,
        unit: 'req/s',
      },
      actions: [
        { label: 'Gửi 1,000 requests', msg: 'Tải lượng phân bổ đều: P50 = 12ms, P99 = 26ms. Hệ thống xử lý 100% thành công không rơi rớt request.' },
        { label: 'Mô phỏng nghẽn mạng / Spike', msg: 'Cảnh báo: P99 vọt lên 850ms do nghẽn kết nối Database Pool! Kích hoạt Rate Limit & Shedding tải.' },
        { label: 'Bật Cache & Replicas', msg: 'Đã định tuyến đọc sang Redis & Read Replicas: Độ trễ hạ xuống 4ms, tải cụm chính giảm 70%.' },
      ],
      stats: [
        { label: 'Độ trễ P99', value: '26ms', tone: 'ok' },
        { label: 'Thông lượng', value: '1,000 req/s', tone: 'accent' },
        { label: 'Tỷ lệ lỗi', value: '0.00%', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi chuẩn phỏng vấn kỹ sư cấp cao (Senior/Staff Level), phân tích tình huống chọn kiến trúc, giải quyết tranh chấp dữ liệu và tối ưu hiệu năng.',
  },

  marketing: {
    id: 'marketing',
    nameVi: 'Tiếp thị, Định vị Thương hiệu & Tăng trưởng Doanh thu',
    nameEn: 'Marketing, Brand Positioning & Growth Strategy',
    roleName: 'CHIEF MARKETING OFFICER (CMO) & CHIẾN LƯỢC GIA THƯƠNG HIỆU THỰC CHIẾN HÀNG ĐẦU',
    perspective: 'TÂM LÝ NGƯỜI TIÊU DÙNG, ĐỊNH VỊ THƯƠNG HIỆU & HIỆU SUẤT TĂNG TRƯỞNG BỀN VỮNG',
    keywords: [
      'marketing', 'tiếp thị', 'brand', 'branding', 'thương hiệu', 'quảng cáo', 'advertising',
      'sales', 'bán hàng', 'khách hàng', 'customer', 'consumer', 'người tiêu dùng', 'funnel', 'phễu bán hàng',
      'conversion', 'chuyển đổi', 'định vị', 'positioning', 'chiến dịch', 'campaign', 'pr', 'truyền thông',
      'growth', 'tăng trưởng', 'growth hacking', 'kotler', 'seth godin', 'al ries', 'inbound', 'outbound',
      'seo', 'sem', 'content', 'nội dung', 'sản phẩm', 'phân khúc', 'segmentation', 'insight', 'insight khách hàng',
      'nhận thức thương hiệu', 'brand equity', 'cac', 'ltv', 'roas', 'ctr', 'cvr', 'churn rate', 'retention',
      'influencer', 'kol', 'koc', 'viral', 'lan truyền', 'social media', 'thị phần', 'market share', 'marcom'
    ],
    foundationalPrinciples: [
      'STP Framework: Phân đoạn thị trường (Segmentation) -> Lựa chọn thị trường mục tiêu (Targeting) -> Định vị khác biệt (Positioning).',
      'Brand Equity & Mental Availability: Thương hiệu mạnh là thương hiệu xuất hiện đầu tiên trong tâm trí khách hàng khi nhu cầu phát sinh (Top-of-Mind).',
      'Phễu Chuyển Đổi AIDA: Nhận biết (Awareness) -> Quan tâm (Interest) -> Khao khát (Desire) -> Hành động mua (Action).',
      'Đơn vị kinh tế học (Unit Economics): Lợi nhuận trọn đời của khách hàng (LTV) phải lớn hơn ít nhất 3 lần chi phí thu hút khách hàng (CAC).',
      'Consumer Insight: Đào sâu vào nỗi đau (Pain Point) và khát khao thầm kín chưa được nói ra của người tiêu dùng.'
    ],
    coreGuidance: `
- Mở đầu mỗi topic bằng bài toán tiếp thị & tăng trưởng thực tế: Doanh nghiệp đang gặp bế tắc gì về nhận thức hay chuyển đổi? Chiến lược định vị là gì? Đánh đổi giữa chạy số ngắn hạn (Performance) vs Xây dựng thương hiệu dài hạn (Brand Building)?
- Tuyệt đối không dùng thuật ngữ IT hay server kỹ thuật. Phân tích rõ hành vi khách hàng, chi phí thu hút (CAC), giá trị trọn đời (LTV) và tâm lý học mua hàng.
- Phần 'prose' có 3-5 đoạn văn giàu chất thực chiến, bọc thuật ngữ trong <dfn data-term="...">.
`,
    calloutContext: 'BẮT BUỘC là case study kinh điển tại thị trường Việt Nam: Chiến dịch Biti’s Hunter "Đi để trở về", Cuộc chiến truyền thông Milo vs Ovaltine ("Không cần nhà vô địch"), Baemin chiếm lĩnh thị trường ngách với "Quán ngon quận mình", Highlands Coffee định vị không gian quán hiện đại, Chiến dịch Shopee bão sale 11.11, Vinamilk khẳng định sữa tươi 100%.',
    keyMetrics: ['Chi phí thu hút CAC', 'Lợi tức quảng cáo ROAS', 'Tỷ lệ chuyển đổi CVR', 'Giá trị trọn đời LTV', 'Điểm chạm thương hiệu'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Khách hàng tiềm năng', sub: 'Nhận biết (Awareness)', tone: 'accent' },
        { label: 'Nội dung & Thông điệp', sub: 'Cân nhắc (Consideration)', tone: 'ok' },
        { label: 'Ưu đãi & Kêu gọi', sub: 'Quyết định (Purchase)', tone: 'violet' },
        { label: 'Chăm sóc & Giữ chân', sub: 'Trung thành (Advocacy)', tone: 'warn' },
      ],
      slider: {
        label: 'Ngân sách chiến dịch tiếp thị',
        min: 10,
        max: 500,
        step: 10,
        value: 100,
        unit: 'triệu VNĐ',
      },
      actions: [
        { label: 'Khởi chạy chiến dịch đa kênh', msg: 'Chiến dịch tiếp cận 450,000 khách mục tiêu. Tỷ lệ click CTR đạt 4.2%, chuyển đổi mua hàng đạt 3.6%, ROAS đạt 3.8x.' },
        { label: 'Giả lập đối thủ cạnh tranh giá thầu', msg: 'Cảnh báo: Đối thủ tăng ngân sách đẩy giá CPC tăng 50%! Chi phí CAC tăng vọt. Cần tối ưu lại thông điệp và tệp đối tượng ngách.' },
        { label: 'Kích hoạt kịch bản Remarketing', msg: 'Nhắm lại nhóm khách bỏ giỏ hàng: Tỷ lệ chuyển đổi phục hồi lên 5.1%, giảm 35% chi phí thu hút khách hàng.' },
      ],
      stats: [
        { label: 'Tỷ lệ chuyển đổi CVR', value: '3.6%', tone: 'ok' },
        { label: 'Chi phí CAC', value: '78,000đ', tone: 'accent' },
        { label: 'Hiệu quả ROAS', value: '3.8x', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi trắc nghiệm tình huống hoạch định chiến dịch, tối ưu hóa phễu chuyển đổi, định vị thương hiệu và phân bổ ngân sách tiếp thị thực tế.',
  },

  finance: {
    id: 'finance',
    nameVi: 'Tài chính Doanh nghiệp, Đầu tư Giá trị & Quản trị Dòng tiền',
    nameEn: 'Corporate Finance, Value Investing & Wealth Management',
    roleName: 'CHIEF FINANCIAL OFFICER (CFO) & CHUYÊN GIA PHÂN TÍCH ĐẦU TƯ CẤP CAO',
    perspective: 'TỐI ƯU CƠ CẤU VỐN, DÒNG TIỀN TỰ DO & ĐỊNH GIÁ TÀI SẢN GIÁ TRỊ',
    keywords: [
      'finance', 'tài chính', 'investing', 'đầu tư', 'tiền tệ', 'cổ phiếu', 'stock', 'bond', 'trái phiếu',
      'chứng khoán', 'dòng tiền', 'cashflow', 'free cash flow', 'lãi suất', 'interest rate', 'lợi nhuận',
      'doanh thu', 'economics', 'kinh tế', 'lạm phát', 'inflation', 'warren buffett', 'charlie munger',
      'cfo', 'định giá', 'valuation', 'dcf', 'báo cáo tài chính', 'bảng cân đối', 'tài sản', 'nợ phải trả',
      'ebitda', 'roe', 'roa', 'roi', 'wacc', 'đòn bẩy', 'leverage', 'margin of safety', 'biên an toàn',
      'cổ tức', 'dividend', 'vốn lưu động', 'working capital', 'rủi ro', 'risk management', 'danh mục đầu tư'
    ],
    foundationalPrinciples: [
      'Tiền mặt là vua (Cash is King): Lợi nhuận chỉ là ý kiến, dòng tiền mới là thực tế. Dòng tiền tự do (FCF) quyết định sự sống còn của doanh nghiệp.',
      'Biên An Toàn (Margin of Safety): Chỉ mua tài sản khi giá thị trường thấp hơn đáng kể so với giá trị nội tại được tính toán cẩn trọng.',
      'Chi phí cơ hội (Opportunity Cost): Mọi đồng vốn bỏ vào một dự án đồng nghĩa với việc từ bỏ lợi nhuận từ dự án tốt nhất tiếp theo.',
      'Cơ cấu vốn & Đòn bẩy nợ: Đòn bẩy khuếch đại lợi nhuận khi kinh doanh thuận lợi, nhưng có thể xóa sổ vốn chủ sở hữu khi chu kỳ suy thoái ập đến.',
      'Lãi kép (Compound Interest): Kỳ quan thứ 8 của thế giới, đòi hỏi thời gian đủ dài và việc hạn chế tối đa các khoản lỗ lớn không thể phục hồi.'
    ],
    coreGuidance: `
- Mở đầu mỗi topic bằng bài toán tài chính & hiệu quả sử dụng vốn: Thách thức dòng tiền là gì? Cơ cấu nguồn vốn ra sao? Đánh đổi giữa Tỷ suất sinh lời (Return) vs Mức độ rủi ro (Risk)?
- Sử dụng chính xác các chỉ số tài chính (ROE, ROA, WACC, FCF, Debt/Equity, P/E, P/B). Phân tích cấu trúc bảng cân đối kế toán và dòng tiền hoạt động.
- Phần 'prose' có từ 3-5 đoạn văn phân tích chuyên sâu các mô hình tài chính, bọc thuật ngữ trong <dfn data-term="...">.
`,
    calloutContext: 'Bối cảnh tài chính và thương vụ đầu tư thực tế: Các tập đoàn lớn tại Việt Nam (Vingroup tái cơ cấu danh mục tài sản, Masan đòn bẩy M&A chuỗi bán lẻ, FPT duy trì lượng tiền mặt ròng dồi dào, Vinamilk chi trả cổ tức cao bền vững), chu kỳ thanh khoản thị trường bất động sản & trái phiếu doanh nghiệp Việt Nam.',
    keyMetrics: ['Tỷ suất hoàn vốn ROI', 'Hệ số đòn bẩy D/E', 'Dòng tiền tự do FCF', 'Biên lợi nhuận ròng', 'Tỷ suất sinh lời ROE'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Vốn tự có & Vay', sub: 'Nguồn vốn (Capital)', tone: 'accent' },
        { label: 'Tài sản & Dự án', sub: 'Đầu tư sinh lời (Assets)', tone: 'ok' },
        { label: 'Doanh thu thuần', sub: 'Dòng tiền vào', tone: 'violet' },
        { label: 'Dòng tiền tự do FCF', sub: 'Lợi nhuận ròng & Cổ tức', tone: 'warn' },
      ],
      slider: {
        label: 'Tỷ lệ đòn bẩy nợ vay (Debt/Equity)',
        min: 0,
        max: 200,
        step: 5,
        value: 50,
        unit: '%',
      },
      actions: [
        { label: 'Giải ngân danh mục chuẩn', msg: 'Phân bổ 60% vốn vào tài sản sinh dòng tiền cốt lõi, 40% phòng hộ rủi ro. Biên an toàn đạt 30%, lợi suất ROI đạt 16.5%.' },
        { label: 'Giả lập lạm phát & Lãi suất tăng', msg: 'Cảnh báo: Chi phí lãi vay tăng cao làm xói mòn biên lợi nhuận ròng! Doanh nghiệp có nguy cơ thiếu hụt dòng tiền thanh toán nợ ngắn hạn.' },
        { label: 'Tái cấu trúc nợ & Thoái vốn', msg: 'Đã chuyển đổi nợ ngắn hạn sang dài hạn và bán bớt tài sản kém hiệu quả: Chỉ số thanh toán phục hồi về mức an toàn.' },
      ],
      stats: [
        { label: 'Tỷ suất hoàn vốn ROI', value: '16.5%', tone: 'ok' },
        { label: 'Hệ số đòn bẩy D/E', value: '0.5x', tone: 'ok' },
        { label: 'Dòng tiền FCF', value: 'Dương dồi dào', tone: 'accent' },
      ],
    },
    quizContext: 'Câu hỏi phân tích tình huống tài chính thực tế, định giá dự án, quản trị rủi ro thanh khoản và ra quyết định phân bổ nguồn vốn.',
  },

  business: {
    id: 'business',
    nameVi: 'Quản trị Kinh doanh, Chiến lược Doanh nghiệp & Vận hành',
    nameEn: 'Business Strategy, Operations & Enterprise Management',
    roleName: 'CHUYÊN GIA TƯ VẤN CHIẾN LƯỢC DOANH NGHIỆP & CỐ VẤN ĐIỀU HÀNH (CEO/COO LEVEL)',
    perspective: 'CHIẾN LƯỢC QUẢN TRỊ CẠNH TRANH, MÔ HÌNH KINH DOANH & TỐI ƯU VẬN HÀNH',
    keywords: [
      'kinh doanh', 'business', 'chiến lược', 'strategy', 'quản trị', 'management', 'khởi nghiệp',
      'startup', 'doanh nghiệp', 'lợi thế cạnh tranh', 'moat', 'chuỗi giá trị', 'value chain',
      'vận hành', 'operations', 'lãnh đạo', 'ceo', 'coo', 'tăng trưởng', 'mô hình kinh doanh', 'business model',
      'swot', 'okr', 'kpi', 'lean startup', 'blue ocean', 'đại dương xanh', 'flywheel', 'bánh đà tăng trưởng',
      'm&a', 'chuỗi cung ứng', 'supply chain', 'logistics', 'nps', 'văn hóa doanh nghiệp', 'scale-up'
    ],
    foundationalPrinciples: [
      'Hào kinh tế (Economic Moat): Xây dựng lợi thế cạnh tranh bền vững để bảo vệ thị phần (Hiệu ứng mạng lưới, Chi phí chuyển đổi, Lợi thế quy mô, Bản quyền).',
      'Chuỗi giá trị Michael Porter: Tối ưu từng mắt xích từ đầu vào, sản xuất, phân phối đến hậu mãi để tạo ra thặng dư giá trị lớn hơn đối thủ.',
      'Mô hình Bánh đà (Flywheel Effect): Mỗi nỗ lực vận hành bổ trợ và thúc đẩy nỗ lực tiếp theo, tạo quán tính tăng trưởng tự duy trì.',
      'Đánh đổi chiến lược (Strategic Trade-offs): Chiến lược là việc quyết định "KHÔNG LÀM GÌ". Doanh nghiệp cố gắng làm hài lòng tất cả khách hàng sẽ thất bại.',
      'Tập trung vào Giá trị cốt lõi: Nâng cao sự hài lòng và trải nghiệm khách hàng để thúc đẩy truyền miệng tự nhiên.'
    ],
    coreGuidance: `
- Mở đầu mỗi topic bằng thách thức quản trị & cạnh tranh thị trường: Lợi thế cạnh tranh (Moat) ở đâu? Chuỗi giá trị được tổ chức ra sao? Đánh đổi giữa Tốc độ tăng trưởng vs Hiệu quả vận hành?
- Phân tích sâu mô hình kinh doanh, cấu trúc chi phí, các rào cản gia nhập thị trường và văn hóa thực thi.
- Bọc thuật ngữ quản trị trong <dfn data-term="...">, dẫn chứng thực tiễn.
`,
    calloutContext: 'Case study quản trị kinh doanh xuất sắc tại Việt Nam: Chuỗi Thế Giới Di Động chuyển mình với Bách Hóa Xanh, Viettel vươn mình ra 10 thị trường quốc tế, VinFast chuyển dịch toàn bộ sang xe điện, Chuỗi cung ứng GHTK/GHN tối ưu hóa chi phí chặng cuối (Last-mile delivery).',
    keyMetrics: ['Biên lợi nhuận gộp', 'Vòng quay vốn lưu động', 'Tỷ lệ giữ chân khách hàng', 'Chi phí vận hành OPEX', 'Điểm hài lòng NPS'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Nguồn lực & Chi phí', sub: 'Đầu vào (Input)', tone: 'accent' },
        { label: 'Vận hành cốt lõi', sub: 'Quy trình tạo giá trị', tone: 'ok' },
        { label: 'Sản phẩm & Dịch vụ', sub: 'Đầu ra thị trường', tone: 'violet' },
        { label: 'Thị phần & Doanh thu', sub: 'Khách hàng & Hào kinh tế', tone: 'warn' },
      ],
      slider: {
        label: 'Quy mô sản lượng / Tháng',
        min: 1000,
        max: 50000,
        step: 1000,
        value: 10000,
        unit: 'sản phẩm',
      },
      actions: [
        { label: 'Vận hành công suất tối ưu', msg: 'Quy trình tinh gọn: Biên lợi nhuận gộp đạt 34%, tỷ lệ sản phẩm lỗi dưới 0.3%, khách hàng hài lòng cao.' },
        { label: 'Mô phỏng đứt gãy chuỗi cung ứng', msg: 'Cảnh báo: Nhà cung ứng chậm giao nguyên vật liệu, tồn kho chạm mức báo động! Chi phí logistics tăng 30%.' },
        { label: 'Kích hoạt phương án Lean dự phòng', msg: 'Chuyển sang nhà cung ứng nội địa thay thế: Dây chuyền khôi phục 95% công suất, tiết kiệm 15% chi phí lưu kho.' },
      ],
      stats: [
        { label: 'Biên lợi nhuận gộp', value: '34.2%', tone: 'ok' },
        { label: 'Tồn kho an toàn', value: '12 ngày', tone: 'ok' },
        { label: 'Sức khỏe chuỗi', value: 'Vững chắc', tone: 'accent' },
      ],
    },
    quizContext: 'Câu hỏi tình huống ra quyết định quản trị chiến lược, giải quyết bài toán xung đột kênh phân phối, quản trị chuỗi cung ứng và mở rộng quy mô.',
  },

  psychology: {
    id: 'psychology',
    nameVi: 'Tâm lý học Ứng dụng, Khoa học Hành vi & Não bộ',
    nameEn: 'Behavioral Science, Cognitive Psychology & Neuroscience',
    roleName: 'CHUYÊN GIA KHOA HỌC HÀNH VI & CỐ VẤN TÂM LÝ ỨNG DỤNG HÀNG ĐẦU',
    perspective: 'TÂM LÝ HỌC HÀNH VI, CƠ CHẾ NÃO BỘ & PHÁT TRIỂN TIỀM NĂNG CON NGƯỜI',
    keywords: [
      'psychology', 'tâm lý', 'thói quen', 'habit', 'habits', 'behavior', 'hành vi', 'mindset', 'tư duy',
      'atomic habits', 'cảm xúc', 'emotion', 'thao túng', 'thuyết phục', 'persuasion', 'giao tiếp',
      'tiềm thức', 'subconscious', 'lãnh đạo', 'động lực', 'motivation', 'cognitive bias', 'thiên kiến nhận thức',
      'kahneman', 'dopamine', 'flow', 'tập trung', 'ý chí', 'willpower', 'nudge', 'cú hích', 'neuroscience',
      'suy nghĩ nhanh và chậm', 'loss aversion', 'sợ mất mát', 'trì hoãn', 'procrastination', 'tự kỷ luật'
    ],
    foundationalPrinciples: [
      'Vòng lặp thói quen 4 bước: Tín hiệu (Cue) -> Khao khát (Craving) -> Phản hồi (Response) -> Phần thưởng (Reward).',
      'Hệ thống 1 & Hệ thống 2 (Daniel Kahneman): Não bộ ưu tiên chế độ trực giác vô thức (Hệ thống 1) để tiết kiệm năng lượng, dẫn đến các thiên kiến nhận thức.',
      'Hiệu ứng Cú hích (Nudge): Thiết kế môi trường xung quanh sao cho hành vi tốt trở nên dễ dàng và hiển nhiên nhất, còn hành vi xấu trở nên khó khăn.',
      'Ác cảm mất mát (Loss Aversion): Nỗi đau khi mất một thứ gì đó luôn lớn gấp đôi niềm vui khi nhận được thứ tương tự.',
      'Khái niệm Identity-based Habits: Thay đổi thói quen bền vững bắt đầu từ việc thay đổi niềm tin về danh tính của chính mình ("Tôi là người chạy bộ" thay vì "Tôi đang cố chạy bộ").'
    ],
    coreGuidance: `
- Mở đầu mỗi topic bằng vấn đề tâm lý & hành vi thực tế: Động lực nào chi phối quyết định? Bẫy nhận thức nào đang ngăn cản? Cơ chế hình thành thói quen ra sao? Làm thế nào để duy trì kỷ luật tự thân?
- Phân tích cơ chế thần kinh học (Dopamine, Cortisol, Prefrontal Cortex) và tác động của môi trường.
- Bọc thuật ngữ chuyên ngành trong <dfn data-term="...">.
`,
    calloutContext: 'Tình huống ứng dụng tâm lý học thực tế trong công việc, giao tiếp và quản trị cuộc sống hàng ngày tại Việt Nam: Tâm lý FOMO lướt mạng xã hội lúc nửa đêm, cơ chế xả stress mua sắm Shopee/TikTok Shop, thói quen trì hoãn công việc văn phòng, tâm lý đám đông trong đầu tư số đông.',
    keyMetrics: ['Tần suất duy trì thói quen', 'Mức tự động hóa hành vi', 'Năng lượng ý chí tiêu hao', 'Mức độ tập trung sâu', 'Chỉ số tự nhận thức'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Tín hiệu (Cue)', sub: 'Bối cảnh khởi phát', tone: 'accent' },
        { label: 'Khao khát (Craving)', sub: 'Động lực Dopamine', tone: 'ok' },
        { label: 'Hành động (Response)', sub: 'Thực thi hành vi', tone: 'violet' },
        { label: 'Phần thưởng (Reward)', sub: 'Thỏa mãn & Củng cố não bộ', tone: 'warn' },
      ],
      slider: {
        label: 'Mức độ động lực hành vi (Motivation)',
        min: 10,
        max: 100,
        step: 5,
        value: 70,
        unit: 'điểm',
      },
      actions: [
        { label: 'Kích hoạt hành vi mục tiêu', msg: 'Vòng lặp thói quen diễn ra trơn tru: Năng lượng ý chí tiêu hao tối thiểu, dopamine tiết ra củng cố hồi hải mã.' },
        { label: 'Mô phỏng yếu tố cản trở & Cám dỗ', msg: 'Cảnh báo: Môi trường xuất hiện yếu tố làm gián đoạn! Não bộ có xu hướng thoái lui về thói quen cũ dễ dàng hơn.' },
        { label: 'Thiết kế lại môi trường (Nudge)', msg: 'Đã loại bỏ tác nhân cám dỗ và đặt tín hiệu tích cực ngay trước mắt: Thói quen mới được củng cố bền vững.' },
      ],
      stats: [
        { label: 'Chuỗi ngày lặp', value: '28 ngày', tone: 'ok' },
        { label: 'Mức tự động hóa', value: '86%', tone: 'accent' },
        { label: 'Năng lượng ý chí', value: 'Tiết kiệm tối đa', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi nhận diện bẫy nhận thức (Cognitive biases), cơ chế hình thành hành vi và kỹ thuật ứng dụng tâm lý học để giải quyết vấn đề cá nhân & đội nhóm.',
  },

  product_design: {
    id: 'product_design',
    nameVi: 'Quản trị Sản phẩm, Thiết kế Trải nghiệm (UI/UX) & Design Thinking',
    nameEn: 'Product Management, UI/UX Design & Human-Centered Innovation',
    roleName: 'CHIEF PRODUCT OFFICER (CPO) & HEAD OF PRODUCT DESIGN CẤP CAO',
    perspective: 'TƯ DUY THIẾT KẾ LẤY NGƯỜI DÙNG LÀM TRUNG TÂM & TỐI ƯU TRẢI NGHIỆM SẢN PHẨM',
    keywords: [
      'product', 'sản phẩm', 'product management', 'quản trị sản phẩm', 'pm', 'ux', 'ui', 'user experience',
      'trải nghiệm người dùng', 'design thinking', 'tư duy thiết kế', 'wireframe', 'prototype', 'nghiên cứu người dùng',
      'user research', 'persona', 'journey map', 'hành trình khách hàng', 'jobs to be done', 'jtbd',
      'product-market fit', 'pmf', 'mvp', 'feature', 'tính năng', 'usability', 'tính khả dụng', 'onboarding',
      'retention', 'time-to-value', 'gamification', 'a/b testing', 'friction', 'điểm ma sát', 'design system'
    ],
    foundationalPrinciples: [
      'Jobs To Be Done (JTBD): Khách hàng không mua sản phẩm của bạn, họ "thuê" sản phẩm để hoàn thành một công việc cụ thể trong cuộc sống.',
      'User-Centered Design (UCD): Thiết kế bắt đầu từ sự thấu cảm sâu sắc nỗi đau của người dùng, không phải từ mong muốn chủ quan của đội ngũ kỹ thuật.',
      'Double Diamond Framework: Khám phá vấn đề đúng (Discover & Define) trước khi tìm kiếm giải pháp đúng (Develop & Deliver).',
      'Giảm thiểu Điểm ma sát (Frictionless): Mỗi cú nhấp chuột dư thừa hoặc thao tác điền form phức tạp đều làm rơi rụng 20-40% người dùng.',
      'Vòng lặp MVP & Build-Measure-Learn: Đưa phiên bản thử nghiệm nhỏ nhất ra thị trường nhanh nhất có thể để đo lường phản hồi thực tế.'
    ],
    coreGuidance: `
- Mở đầu bằng bài toán trải nghiệm người dùng & Product-Market Fit: Nỗi đau chưa được giải quyết là gì? Sản phẩm tạo ra giá trị khác biệt nào? Điểm ma sát lớn nhất nằm ở đâu trong luồng trải nghiệm?
- Phân tích chi tiết quy trình khám phá sản phẩm (Product Discovery), thiết kế tương tác và các chỉ số kích hoạt (Activation/Retention).
- Bọc thuật ngữ chuyên ngành trong <dfn data-term="...">.
`,
    calloutContext: 'Case study sản phẩm công nghệ thực tế tại Việt Nam: Siêu ứng dụng MoMo đơn giản hóa luồng chuyển tiền 1 chạm, Ứng dụng gọi xe Grab/Be tối ưu hóa thời gian đón xe, Zalo chat với giao diện cực kỳ thân thiện với mọi lứa tuổi người Việt, Cake by VPBank mang lại trải nghiệm ngân hàng số tối giản.',
    keyMetrics: ['Tỷ lệ kích hoạt Activation', 'Thời gian đạt giá trị Time-to-Value', 'Tỷ lệ hoàn thành tác vụ', 'Tỷ lệ rời bỏ Churn', 'Điểm hài lòng CSAT'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Người dùng bắt đầu', sub: 'Onboarding & Đăng ký', tone: 'accent' },
        { label: 'Trải nghiệm cốt lõi', sub: 'Khoảnh khắc Aha! Moment', tone: 'ok' },
        { label: 'Tạo giá trị lặp lại', sub: 'Thói quen sử dụng', tone: 'violet' },
        { label: 'Giữ chân lâu dài', sub: 'Retention & Chia sẻ', tone: 'warn' },
      ],
      slider: {
        label: 'Số bước trong luồng Onboarding',
        min: 1,
        max: 8,
        step: 1,
        value: 3,
        unit: 'bước',
      },
      actions: [
        { label: 'Chạy thử nghiệm luồng tinh gọn', msg: 'Luồng 3 bước đạt tỷ lệ kích hoạt 68%, người dùng chạm tới tính năng chính chỉ sau 45 giây.' },
        { label: 'Mô phỏng bổ sung thủ tục phức tạp', msg: 'Cảnh báo: Yêu cầu thêm xác minh thông tin làm rơi rụng 42% người dùng ngay tại màn hình thứ 2!' },
        { label: 'Tối ưu Progressive Profiling', msg: 'Chuyển việc thu thập thông tin về sau khi người dùng đã nhận được giá trị: Tỷ lệ hoàn tất tăng lên 78%.' },
      ],
      stats: [
        { label: 'Tỷ lệ kích hoạt', value: '68%', tone: 'ok' },
        { label: 'Thời gian Onboard', value: '45 giây', tone: 'accent' },
        { label: 'Độ hài lòng CSAT', value: '4.8/5.0', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi tình huống giải quyết xung đột ưu tiên tính năng sản phẩm (Feature Prioritization), xử lý điểm nghẽn trải nghiệm người dùng và kiểm chứng giả thuyết sản phẩm.',
  },

  sales: {
    id: 'sales',
    nameVi: 'Nghệ thuật Bán hàng, Bậc thầy Đàm phán & Phát triển Quan hệ Đối tác',
    nameEn: 'Sales Mastery, High-Stakes Negotiation & Enterprise Dealmaking',
    roleName: 'GIÁM ĐỐC KINH DOANH TOÀN QUỐC (CSO) & BẬC THẦY ĐÀM PHÁN THƯƠNG MẠI',
    perspective: 'TÂM LÝ BÁN HÀNG TƯ VẤN, NGHỆ THUẬT ĐÀM PHÁN & ĐỐI TÁC CHIẾN LƯỢC',
    keywords: [
      'sales', 'bán hàng', 'đàm phán', 'negotiation', 'chốt sale', 'closing', 'khách hàng tiềm năng',
      'lead', 'prospect', 'spin selling', 'challenger sale', 'batna', 'xử lý từ chối', 'objection handling',
      'pipeline', 'phễu bán hàng', 'b2b sales', 'b2c', 'deal', 'hợp đồng', 'thương lượng', 'giá trị đơn hàng',
      'win-win', 'giá cả', 'định giá', 'thuyết phục', 'trình bày giải pháp', 'pitch', 'quota', 'doanh số'
    ],
    foundationalPrinciples: [
      'Bán hàng tư vấn (Consultative Selling): Người bán hàng xuất sắc không phải là người nói hay, mà là người biết đặt những câu hỏi chạm đúng nỗi đau sâu nhất của khách hàng.',
      'Nguyên lý BATNA (Best Alternative to a Negotiated Agreement): Sức mạnh trong đàm phán thuộc về người có phương án dự phòng tốt nhất và sẵn sàng đứng dậy rời bàn đàm phán.',
      'Tập trung vào Giá trị thay vì Giảm giá: Đàm phán thành công là đàm phán dựa trên giá trị mà giải pháp mang lại, không phải là cuộc đua giảm giá làm xói mòn lợi nhuận.',
      'Xử lý lời từ chối (Objection Handling): Lời từ chối thực chất là tín hiệu khách hàng muốn tìm hiểu thêm thông tin để cảm thấy an tâm trước khi ra quyết định.',
      'Xây dựng niềm tin & Sự chân thành: Khách hàng mua sự tự tin và uy tín của bạn trước khi họ mua giải pháp của công ty bạn.'
    ],
    coreGuidance: `
- Mở đầu bằng tình huống bán hàng hoặc đàm phán căng thẳng: Điểm bế tắc ở đâu? Tâm lý đối phương đang lo ngại điều gì? Đòn bẩy thương lượng nằm ở đâu?
- Phân tích chi tiết kỹ năng đặt câu hỏi gợi mở, kỹ thuật neo giá (Anchoring) và các chiến thuật chốt giao dịch Win-Win.
- Bọc thuật ngữ chuyên ngành trong <dfn data-term="...">.
`,
    calloutContext: 'Bối cảnh đàm phán và bán hàng thực tế tại Việt Nam: Đàm phán hợp đồng cung ứng hàng vào hệ thống siêu thị lớn (Co.opmart, WinMart), thương thảo thuê mặt bằng kinh doanh chuỗi F&B tại các vị trí đắc địa, thương vụ chốt hợp đồng phần mềm B2B cho khối Ngân hàng/Bảo hiểm.',
    keyMetrics: ['Tỷ lệ chốt giao dịch Win Rate', 'Chu kỳ bán hàng trung bình', 'Quy mô hợp đồng bình quân', 'Tỷ lệ hoàn thành chỉ tiêu Quota', 'Tỷ lệ giữ chân tài khoản'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Tiếp cận & Đặt câu hỏi', sub: 'Thấu hiểu nỗi đau', tone: 'accent' },
        { label: 'Trình bày giải pháp', sub: 'Chứng minh giá trị', tone: 'ok' },
        { label: 'Xử lý phản đối & Neo giá', sub: 'Đàm phán điều khoản', tone: 'violet' },
        { label: 'Chốt hợp đồng Win-Win', sub: 'Ký kết & Đồng hành', tone: 'warn' },
      ],
      slider: {
        label: 'Tỷ lệ chiết khấu đề xuất',
        min: 0,
        max: 30,
        step: 2,
        value: 10,
        unit: '%',
      },
      actions: [
        { label: 'Thương thảo theo giá trị gia tăng', msg: 'Khách hàng chấp nhận mức giá chuẩn mà không cần chiết khấu nhờ gói dịch vụ hỗ trợ kỹ thuật 24/7 đi kèm.' },
        { label: 'Mô phỏng khách hàng ép giá gắt gao', msg: 'Cảnh báo: Khách hàng dùng báo giá đối thủ để ép giá giảm 25%! Kích hoạt phương án chứng minh ROI vượt trội.' },
        { label: 'Áp dụng BATNA & Nhượng bộ có điều kiện', msg: 'Chỉ đồng ý giảm 5% nếu khách hàng cam kết thanh toán sớm 100% và ký hợp đồng thời hạn 2 năm: Thỏa thuận thành công.' },
      ],
      stats: [
        { label: 'Tỷ lệ chốt deal', value: '42%', tone: 'ok' },
        { label: 'Biên lợi nhuận hợp đồng', value: '28%', tone: 'accent' },
        { label: 'Trạng thái đàm phán', value: 'Win-Win', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi phân tích tình huống đàm phán căng thẳng, nghệ thuật ứng biến khi bị ép giá và phương pháp xử lý lời từ chối phức tạp từ khách hàng doanh nghiệp.',
  },

  leadership: {
    id: 'leadership',
    nameVi: 'Lãnh đạo, Quản trị Nhân sự & Xây dựng Đội ngũ Vô địch',
    nameEn: 'Executive Leadership, People Management & High-Performing Teams',
    roleName: 'CHUYÊN GIA PHÁT TRIỂN NĂNG LỰC LÃNH ĐẠO & CỐ VẤN TỔ CHỨC CẤP CAO',
    perspective: 'TƯ DUY LÃNH ĐẠO PHỤC VỤ, TÂM LÝ TỔ CHỨC & VĂN HÓA DOANH NGHIỆP XUẤT SẮC',
    keywords: [
      'lãnh đạo', 'leadership', 'nhân sự', 'human resources', 'hr', 'quản lý', 'manager', 'đội ngũ',
      'team', 'văn hóa doanh nghiệp', 'corporate culture', 'giao việc', 'delegation', 'động lực',
      'motivation', 'huấn luyện', 'coaching', 'phản hồi', 'feedback', 'truyền cảm hứng', 'empowerment',
      'tuyển dụng', 'recruitment', 'giữ chân nhân tài', 'talent retention', 'tâm lý an toàn', 'psychological safety',
      'xung đột', 'conflict resolution', 'okr', 'kpi', 'hiệu suất đội ngũ', 'high-performing team'
    ],
    foundationalPrinciples: [
      'Lãnh đạo phục vụ (Servant Leadership): Vai trò của nhà lãnh đạo không phải là người ra lệnh, mà là người dọn dẹp các chướng ngại vật để đội ngũ có thể tỏa sáng.',
      'An toàn tâm lý (Psychological Safety): Đội ngũ chỉ có thể đổi mới và sáng tạo khi các thành viên cảm thấy an toàn để nêu ý kiến, thừa nhận sai lầm mà không sợ bị trừng phạt.',
      'Văn hóa phản hồi cấp tiến (Radical Candor): Kết hợp giữa sự quan tâm sâu sắc đến con người (Care Personally) và sự thẳng thắn trực diện trong công việc (Challenge Directly).',
      'Nguyên lý Trao quyền (Empowerment): Giao mục tiêu và bối cảnh (Context), không giao vi mô từng thao tác (Micromanagement).',
      'Nhân tài & Văn hóa: Tuyển dụng dựa trên thái độ và sự tương thích văn hóa, đào tạo dựa trên kỹ năng.'
    ],
    coreGuidance: `
- Mở đầu bằng tình huống lãnh đạo & xung đột nội bộ thực tế: Điểm nghẽn giao tiếp ở đâu? Đội ngũ đang mất động lực vì lý do gì? Làm sao để xây dựng văn hóa cam kết và trách nhiệm giải trình?
- Phân tích sâu tâm lý học quản trị, kỹ năng huấn luyện nhân viên (Coaching) và nghệ thuật giao tiếp tạo động lực.
- Bọc thuật ngữ chuyên ngành trong <dfn data-term="...">.
`,
    calloutContext: 'Tình huống lãnh đạo và quản trị con người thực tế tại doanh nghiệp Việt Nam: Chuyển đổi từ mô hình quản lý gia đình sang chuyên nghiệp hóa, giải quyết xung đột thế hệ giữa Gen X quản lý và Gen Z năng động, duy trì văn hóa đồng lòng khi công ty tăng trưởng nóng từ 50 lên 500 nhân sự.',
    keyMetrics: ['Chỉ số gắn kết nhân viên eNPS', 'Tỷ lệ nghỉ việc Turnover Rate', 'Hiệu suất hoàn thành mục tiêu OKR', 'Thời gian tuyển dụng bình quân', 'Mức độ an toàn tâm lý'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Tầm nhìn & Bối cảnh', sub: 'Mục tiêu rõ ràng', tone: 'accent' },
        { label: 'An toàn tâm lý', sub: 'Lắng nghe & Khích lệ', tone: 'ok' },
        { label: 'Trao quyền thực thi', sub: 'Tin tưởng & Hỗ trợ', tone: 'violet' },
        { label: 'Kết quả vượt trội', sub: 'Công nhận & Tưởng thưởng', tone: 'warn' },
      ],
      slider: {
        label: 'Mức độ trao quyền cho đội ngũ',
        min: 10,
        max: 100,
        step: 5,
        value: 75,
        unit: '%',
      },
      actions: [
        { label: 'Kích hoạt buổi 1-on-1 Coaching', msg: 'Nhân viên cởi mở chia sẻ vướng mắc: Mức độ cam kết công việc tăng vọt, tìm ra giải pháp đột phá cho dự án.' },
        { label: 'Mô phỏng áp lực quản lý vi mô (Micromanage)', msg: 'Cảnh báo: Kiểm soát quá đà làm giảm 60% tính chủ động của nhân sự, xuất hiện tâm lý đối phó và làm việc cầm chừng!' },
        { label: 'Tái thiết lập văn hóa thẳng thắn & Tôn trọng', msg: 'Đã phân định rõ ranh giới trách nhiệm và khích lệ phản hồi đa chiều: Hiệu suất đội ngũ tăng 45%.' },
      ],
      stats: [
        { label: 'Chỉ số gắn kết eNPS', value: '+58', tone: 'ok' },
        { label: 'Tính chủ động', value: 'Rất cao', tone: 'accent' },
        { label: 'Tỷ lệ hoàn thành OKR', value: '92%', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi phân tích tình huống xử lý khủng hoảng nhân sự, dung hòa xung đột đội ngũ, phương pháp phản hồi hiệu quả và ra quyết định bổ nhiệm lãnh đạo.',
  },

  economics: {
    id: 'economics',
    nameVi: 'Kinh tế học, Lý thuyết Trò chơi & Tư duy Đa ngành',
    nameEn: 'Macroeconomics, Game Theory & Multi-Disciplinary Mental Models',
    roleName: 'NHÀ KINH TẾ HỌC TRƯỞNG & CỐ VẤN CHIẾN LƯỢC KINH TẾ VĨ MÔ',
    perspective: 'QUY LUẬT CUNG CẦU, CƠ CHẾ ĐỘNG LỰC & CHU KỲ KINH TẾ THỰC CHIẾN',
    keywords: [
      'economics', 'kinh tế', 'kinh tế học', 'vĩ mô', 'macroeconomics', 'vi mô', 'microeconomics',
      'cung cầu', 'supply demand', 'lạm phát', 'lãi suất', 'tăng trưởng gdp', 'tiền tệ', 'ngân hàng trung ương',
      'chính sách tiền tệ', 'game theory', 'lý thuyết trò chơi', 'nash equilibrium', 'cân bằng nash',
      'chi phí cơ hội', 'opportunity cost', 'ngoại ứng', 'externality', 'động lực', 'incentives',
      'tự do thương mại', 'chu kỳ kinh tế', 'suy thoái', 'recession', 'khủng hoảng tài chính', 'thao túng giá'
    ],
    foundationalPrinciples: [
      'Con người phản ứng với các động lực (People respond to incentives): Muốn thay đổi hành vi xã hội hay tổ chức, hãy thay đổi cấu trúc phần thưởng và chi phí.',
      'Chi phí cơ hội: Giá trị thực sự của bất cứ thứ gì là cái bạn phải từ bỏ để có được nó.',
      'Quy luật Cung - Cầu và Giá cả: Giá cả là tín hiệu thị trường hiệu quả nhất để phân bổ nguồn lực khan hiếm.',
      'Lý thuyết trò chơi & Cân bằng Nash: Kết quả tối ưu cho từng cá nhân khi hành động ích kỷ có thể dẫn đến kết quả tồi tệ nhất cho toàn thể cộng đồng (Thế lưỡng nan của tù nhân).',
      'Chu kỳ tín dụng & Nợ: Sự mở rộng và thu hẹp của tín dụng thúc đẩy các chu kỳ bùng nổ và suy thoái kinh tế theo quy luật.'
    ],
    coreGuidance: `
- Mở đầu bằng hiện tượng kinh tế vĩ mô hoặc bài toán phân bổ nguồn lực: Cơ chế động lực ngầm định ở đâu? Ai là người hưởng lợi và ai gánh chịu chi phí? Đánh đổi chính sách là gì?
- Phân tích cơ chế cung cầu, tác động của lãi suất, lạm phát và các mô hình lý thuyết trò chơi.
- Bọc thuật ngữ chuyên ngành trong <dfn data-term="...">.
`,
    calloutContext: 'Bối cảnh kinh tế Việt Nam trong dòng chảy toàn cầu: Tác động của chính sách lãi suất Fed đến tỷ giá VND/USD, chiến lược dịch chuyển chuỗi cung ứng FDI toàn cầu về Việt Nam, kiểm soát lạm phát và điều hành tăng trưởng tín dụng của Ngân hàng Nhà nước Việt Nam.',
    keyMetrics: ['Tốc độ tăng trưởng GDP (%)', 'Tỷ lệ lạm phát CPI (%)', 'Lãi suất tái cấp vốn', 'Cán cân thương mại', 'Tỷ giá hối đoái'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Cung & Cầu thị trường', sub: 'Tín hiệu giá cả', tone: 'accent' },
        { label: 'Chính sách tiền tệ & Lãi suất', sub: 'Điều tiết tín dụng', tone: 'ok' },
        { label: 'Sản xuất & Tiêu dùng', sub: 'Hoạt động thực tế', tone: 'violet' },
        { label: 'Tăng trưởng & Ổn định', sub: 'Cân bằng kinh tế vĩ mô', tone: 'warn' },
      ],
      slider: {
        label: 'Mức lãi suất điều hành',
        min: 2,
        max: 15,
        step: 0.25,
        value: 5.5,
        unit: '%',
      },
      actions: [
        { label: 'Điều chỉnh lãi suất cân bằng', msg: 'Tín dụng tăng trưởng lành mạnh, lạm phát duy trì dưới 4%, sản xuất công nghiệp và tiêu dùng tăng trưởng ổn định.' },
        { label: 'Giả lập cú sốc giá hàng hóa nhập khẩu', msg: 'Cảnh báo: Giá nguyên liệu đầu vào tăng sốc gây lạm phát chi phí đẩy! Cần phối hợp giữa chính sách tiền tệ và tài khóa.' },
        { label: 'Bơm thanh khoản hỗ trợ phục hồi', msg: 'Đã tháo gỡ điểm nghẽn thanh khoản cho nền kinh tế: Hoạt động đầu tư sản xuất kinh doanh phục hồi tích cực.' },
      ],
      stats: [
        { label: 'Lạm phát CPI', value: '3.4%', tone: 'ok' },
        { label: 'Tăng trưởng GDP', value: '6.8%', tone: 'accent' },
        { label: 'Trạng thái vĩ mô', value: 'Ổn định', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi phân tích chính sách kinh tế, dự đoán phản ứng thị trường trước các biến số vĩ mô và ứng dụng lý thuyết trò chơi vào đàm phán cạnh tranh.',
  },

  health: {
    id: 'health',
    nameVi: 'Sức khỏe, Y học Chức năng, Dinh dưỡng & Tối ưu Thể chất',
    nameEn: 'Functional Medicine, Nutrition, Fitness Science & Biohacking',
    roleName: 'BÁC SĨ Y HỌC CHỨC NĂNG & CHUYÊN GIA TỐI ƯU HÓA THỂ CHẤT TOÀN DIỆN',
    perspective: 'Y HỌC DỰ PHÒNG, CƠ CHẾ SINH HỌC TẾ BÀO & NĂNG LƯỢNG SỐNG TỐI ƯU',
    keywords: [
      'sức khỏe', 'health', 'y học', 'medicine', 'dinh dưỡng', 'nutrition', 'tập luyện', 'fitness',
      'giấc ngủ', 'sleep', 'circadian rhythm', 'nhịp sinh học', 'biohacking', 'metabolism', 'trao đổi chất',
      'insulin', 'cortisol', 'hormone', 'miễn dịch', 'immune', 'tim mạch', 'cardiovascular', 'vo2 max',
      'strength training', 'hypertrophy', 'fasting', 'nhịn ăn gián đoạn', 'longevity', 'trường thọ',
      'microbiome', 'hệ vi sinh đường ruột', 'stress', 'phục hồi', 'recovery', 'dopamine detox'
    ],
    foundationalPrinciples: [
      'Y học Dự phòng (Prevention over Cure): 80% bệnh mạn tính thời hiện đại (tiểu đường, tim mạch, mỡ máu) có thể phòng ngừa hoàn toàn bằng lối sống.',
      'Nhịp sinh học (Circadian Rhythm): Đồng bộ hóa ánh sáng tự nhiên, bữa ăn và giấc ngủ với đồng hồ sinh học của cơ thể giúp tối ưu hóa hormone và phục hồi tế bào.',
      'Độ nhạy Insulin (Insulin Sensitivity): Nền tảng của sức khỏe chuyển hóa và kiểm soát cân nặng bền vững.',
      'Sức mạnh cơ bắp & VO2 Max: Hai chỉ số khoa học dự báo chính xác nhất về tuổi thọ khỏe mạnh (Healthspan) ở người trưởng thành.',
      'Hệ trục Ruột - Não (Gut-Brain Axis): Hệ vi sinh vật đường ruột chi phối trực tiếp đến tâm trạng, năng lượng và khả năng miễn dịch.'
    ],
    coreGuidance: `
- Mở đầu bằng bài toán sức khỏe & năng lượng thể chất thực tế: Cơ thể đang phát ra tín hiệu cảnh báo gì? Nguyên nhân gốc rễ sinh học tế bào là gì? Làm thế nào để đảo ngược tình trạng suy kiệt?
- Phân tích cơ chế sinh hóa (Insulin, Melatonin, Cortisol, Mitochondria), chế độ dinh dưỡng và phác đồ tập luyện khoa học.
- Bọc thuật ngữ chuyên ngành trong <dfn data-term="...">.
`,
    calloutContext: 'Thói quen sức khỏe thực tế tại Việt Nam: Hội chứng suy nhược dân văn phòng (ngồi lâu, thiếu ánh sáng mặt trời, phụ thuộc trà sữa/cà phê), cách lựa chọn thực phẩm truyền thống lành mạnh tại chợ Việt, kỹ thuật phục hồi năng lượng giữa các giờ làm việc áp lực cao.',
    keyMetrics: ['VO2 Max', 'Chỉ số HRV (Biến thiên nhịp tim)', 'Thời lượng ngủ sâu Deep Sleep', 'Chỉ số đường huyết đói', 'Tỷ lệ cơ/mỡ cơ thể'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Dinh dưỡng & Nước', sub: 'Nhiên liệu tế bào', tone: 'accent' },
        { label: 'Vận động & Kháng lực', sub: 'Kích hoạt cơ bắp & Ty thể', tone: 'ok' },
        { label: 'Phục hồi & Giấc ngủ sâu', sub: 'Thanh lọc độc tố não bộ', tone: 'violet' },
        { label: 'Năng lượng bền bỉ', sub: 'Trường thọ & Minh mẫn', tone: 'warn' },
      ],
      slider: {
        label: 'Thời lượng ngủ chất lượng mỗi đêm',
        min: 4,
        max: 10,
        step: 0.5,
        value: 7.5,
        unit: 'giờ',
      },
      actions: [
        { label: 'Thiết lập phác đồ sinh học tối ưu', msg: 'Tiếp xúc ánh nắng sáng sớm, tập kháng lực 4 buổi/tuần: Chỉ số HRV tăng 25%, năng lượng minh mẫn cả ngày.' },
        { label: 'Mô phỏng thiếu ngủ & Lạm dụng đường', msg: 'Cảnh báo: Cortisol tăng vọt, kháng insulin xuất hiện, năng lượng sụt giảm nghiêm trọng vào buổi chiều!' },
        { label: 'Kích hoạt nhịn ăn gián đoạn & Vận động', msg: 'Độ nhạy insulin phục hồi, quá trình thực bào tế bào (Autophagy) được kích hoạt: Cơ thể nhẹ nhõm, tập trung cao độ.' },
      ],
      stats: [
        { label: 'Điểm phục hồi HRV', value: '72ms', tone: 'ok' },
        { label: 'Thời lượng Deep Sleep', value: '1h45m', tone: 'accent' },
        { label: 'Mức năng lượng', value: 'Đỉnh cao', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi phân tích tình huống tối ưu hóa sức khỏe chuyển hóa, dinh dưỡng thể thao, quản lý giấc ngủ và kỹ thuật phòng ngừa bệnh mạn tính.',
  },

  science: {
    id: 'science',
    nameVi: 'Khoa học Tự nhiên, Vật lý, Toán học & Tư duy Nguyên lý Thứ nhất',
    nameEn: 'Natural Sciences, Physics, Mathematics & First Principles Thinking',
    roleName: 'NHÀ KHOA HỌC NGHIÊN CỨU & GIẢNG VIÊN TƯ DUY NGUYÊN LÝ THỨ NHẤT',
    perspective: 'TƯ DUY KHOA HỌC, ĐỊNH LUẬT TỰ NHIÊN & BẢN CHẤT VẬT LÝ NGUYÊN BẢN',
    keywords: [
      'science', 'khoa học', 'vật lý', 'physics', 'toán học', 'math', 'toán', 'first principles',
      'nguyên lý thứ nhất', 'entropy', 'nhiệt động lực học', 'thermodynamics', 'cơ học', 'mechanics',
      'lượng tử', 'quantum', 'xác suất', 'probability', 'thống kê', 'statistics', 'định lý', 'theorem',
      'chaos theory', 'lý thuyết hỗn loạn', 'feynman', 'einstein', 'newton', 'bayes', 'định luật',
      'phản biện', 'scientific method', 'phương pháp khoa học', 'giả thuyết', 'mô hình toán học'
    ],
    foundationalPrinciples: [
      'Tư duy Nguyên lý Thứ nhất (First Principles Thinking): Bóc tách vấn đề về những chân lý cơ bản nhất không thể phủ nhận và suy luận giải pháp từ đó lên, thay vì suy luận theo phép loại suy (Analogy).',
      'Định luật thứ hai của Nhiệt động lực học: Mọi hệ thống khép kín đều có xu hướng suy thoái và hỗn loạn theo thời gian (Entropy tăng dần) trừ khi có năng lượng nạp vào liên tục.',
      'Tư duy Xác suất & Định lý Bayes: Luôn cập nhật niềm tin và xác suất dự đoán của bạn khi có thêm dữ liệu thực nghiệm mới.',
      'Quy luật Nhân Quả & Sự tương quan: Hai hiện tượng xảy ra đồng thời không đồng nghĩa với việc hiện tượng này là nguyên nhân của hiện tượng kia (Correlation != Causation).',
      'Phương pháp Khoa học: Quan sát -> Đặt giả thuyết -> Làm thí nghiệm đối chứng -> Bác bỏ hoặc xác nhận giả thuyết.'
    ],
    coreGuidance: `
- Mở đầu bằng nghịch lý tự nhiên hoặc câu hỏi bản chất vật lý: Hiện tượng này thực sự hoạt động như thế nào ở mức độ nền tảng nhất? Những giả định sai lầm phổ biến là gì?
- Hướng dẫn người đọc phương pháp tư duy Nguyên lý Thứ nhất để phá vỡ các rào cản nhận thức truyền thống.
- Bọc thuật ngữ chuyên ngành trong <dfn data-term="...">.
`,
    calloutContext: 'Ứng dụng tư duy khoa học và nguyên lý vật lý vào cuộc sống và kỹ thuật thực tế: Cách Elon Musk tính toán chi phí chế tạo tên lửa SpaceX từ giá kim loại thô, ứng dụng định lý Bayes để ra quyết định dưới điều kiện thiếu thông tin, cách chống lại định luật Entropy suy thoái trong tổ chức doanh nghiệp.',
    keyMetrics: ['Độ chính xác mô hình', 'Mức độ tin cậy thống kê (p-value)', 'Năng lượng tiêu hao', 'Mức giảm Entropy', 'Hệ số tương quan'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Dữ liệu thực nghiệm', sub: 'Quan sát ban đầu', tone: 'accent' },
        { label: 'Mô hình giả thuyết', sub: 'Nguyên lý thứ nhất', tone: 'ok' },
        { label: 'Thí nghiệm đối chứng', sub: 'Kiểm tra giả thuyết', tone: 'violet' },
        { label: 'Định luật & Kết luận', sub: 'Chân lý kiểm chứng', tone: 'warn' },
      ],
      slider: {
        label: 'Số lượng mẫu quan sát thực nghiệm',
        min: 100,
        max: 10000,
        step: 100,
        value: 1000,
        unit: 'mẫu',
      },
      actions: [
        { label: 'Chạy kiểm định thống kê', msg: 'Kết quả đạt độ tin cậy p < 0.01: Giả thuyết khoa học được chứng minh vững chắc, loại bỏ hoàn toàn yếu tố may rủi ngẫu nhiên.' },
        { label: 'Mô phỏng sai lệch chọn mẫu (Sampling Bias)', msg: 'Cảnh báo: Dữ liệu bị sai lệch nghiêm trọng do phương pháp chọn mẫu phi khách quan! Kết luận mất giá trị.' },
        { label: 'Cập nhật xác suất Bayes với dữ liệu mới', msg: 'Xác suất hậu nghiệm được hiệu chỉnh chuẩn xác: Tìm ra nguyên nhân gốc rễ chi phối hiện tượng.' },
      ],
      stats: [
        { label: 'Mức ý nghĩa p-value', value: '0.001', tone: 'ok' },
        { label: 'Độ tin cậy', value: '99.9%', tone: 'accent' },
        { label: 'Trạng thái chứng minh', value: 'Chính xác', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi kiểm tra tư duy logic khoa học, khả năng phân biệt tương quan vs nhân quả và phương pháp áp dụng Nguyên lý Thứ nhất để giải quyết vấn đề nan giải.',
  },

  general: {
    id: 'general',
    nameVi: 'Kỹ năng Đời sống, Tư duy Đa chiều & Tri thức Khái quát',
    nameEn: 'General Life Skills, Multidisciplinary Thinking & Wisdom',
    roleName: 'CỐ VẤN TRI THỨC VÀ TƯ DUY ĐA NGÀNH HÀNG ĐẦU',
    perspective: 'TƯ DUY ĐA NGUYÊN LÝ, ỨNG DỤNG THỰC TIỄN & PHÁT TRIỂN NĂNG LỰC TOÀN DIỆN',
    keywords: [
      'kỹ năng', 'skills', 'tư duy', 'thinking', 'cuộc sống', 'life', 'thành công', 'success',
      'phát triển bản thân', 'self development', 'năng suất', 'productivity', 'thời gian', 'time management',
      'giao tiếp', 'communication', 'đọc sách', 'học tập', 'learning', 'ghi nhớ', 'memory', 'active recall'
    ],
    foundationalPrinciples: [
      'Nguyên lý Pareto 80/20: 80% kết quả xuất phát từ 20% nguyên nhân cốt lõi nhất.',
      'Vòng tròn Năng lực (Circle of Competence): Biết rõ mình giỏi điều gì và quan trọng hơn cả là biết rõ mình KHÔNG BIẾT điều gì.',
      'Active Recall & Spaced Repetition: Kỹ thuật ghi nhớ và học tập khoa học nhất thế giới đã được kiểm chứng.',
      'Tư duy Ngược (Inversion): Muốn thành công, trước hết hãy tìm hiểu cách người ta thất bại và tránh xa nó.',
      'Sự tập trung sâu (Deep Work): Kỹ năng hiếm hoi và giá trị nhất trong kỷ nguyên số đầy xao nhãng.'
    ],
    coreGuidance: `
- Mở đầu bằng vấn đề thực tế người đọc đang đối mặt: Nguyên nhân gốc rễ là gì? Giải pháp hành động cụ thể là gì? Đâu là đòn bẩy 20% mang lại 80% hiệu quả?
- Đi thẳng vào thực hành, tránh lý thuyết suông và lời rào đón rườm rà.
- Bọc thuật ngữ quan trọng trong <dfn data-term="...">.
`,
    calloutContext: 'Tình huống ứng dụng thực tiễn trong công việc và cuộc sống hàng ngày tại Việt Nam, nâng cao năng suất và giải quyết khó khăn thường nhật.',
    keyMetrics: ['Hiệu suất hành động', 'Thời gian tiết kiệm', 'Độ rõ ràng mục tiêu', 'Mức độ tập trung', 'Chỉ số tiến bộ'],
    widgetLabBlueprint: {
      defaultNodes: [
        { label: 'Thực trạng hiện tại', sub: 'Nhận diện điểm nghẽn', tone: 'accent' },
        { label: 'Giải pháp đòn bẩy 20%', sub: 'Hành động trọng tâm', tone: 'ok' },
        { label: 'Thực thi nhất quán', sub: 'Kiểm soát tiến độ', tone: 'violet' },
        { label: 'Đột phá kết quả 80%', sub: 'Mục tiêu hoàn thành', tone: 'warn' },
      ],
      slider: {
        label: 'Mức độ cam kết thực thi hàng ngày',
        min: 10,
        max: 100,
        step: 5,
        value: 80,
        unit: '%',
      },
      actions: [
        { label: 'Thực hiện hành động đòn bẩy', msg: 'Tập trung 100% vào việc quan trọng nhất: Hoàn thành 80% kết quả chỉ trong nửa ngày làm việc.' },
        { label: 'Mô phỏng sự xao nhãng đa nhiệm (Multitask)', msg: 'Cảnh báo: Làm nhiều việc cùng lúc gây kiệt sức và giảm 50% chất lượng công việc!' },
        { label: 'Bật chế độ tập trung sâu (Deep Work)', msg: 'Đã tắt thông báo và tập trung chuyên sâu: Năng suất phục hồi ở mức tối đa.' },
      ],
      stats: [
        { label: 'Hiệu suất công việc', value: '+45%', tone: 'ok' },
        { label: 'Thời gian tiết kiệm', value: '3.5 giờ/ngày', tone: 'accent' },
        { label: 'Mức độ tập trung', value: 'Tuyệt đối', tone: 'ok' },
      ],
    },
    quizContext: 'Câu hỏi trắc nghiệm kiểm tra khả năng áp dụng các nguyên lý tư duy vào việc giải quyết bài toán thực tế trong công việc và cuộc sống.',
  },
};

/**
 * High-Precision Multi-Domain Classifier
 * Evaluates Title (10x), Subtitle (5x), Chapters (3x), and Body Text (1x)
 * Returns { primaryDomain, confidence, secondaryDomain, domainMeta }
 */
export function classifyBookDomain({
  title = '',
  subtitle = '',
  rawText = '',
  chapters = [],
}) {
  const titleSample = (title || '').toLowerCase();
  const subtitleSample = (subtitle || '').toLowerCase();
  const chaptersSample = (Array.isArray(chapters) ? chapters.map((c) => c.title || c.en || c.vi || '').join(' ') : '').toLowerCase();
  const textSample = (rawText || '').slice(0, 20000).toLowerCase();

  const domainScores = {};
  for (const domainKey of Object.keys(KNOWLEDGE_BASE)) {
    domainScores[domainKey] = 0;
  }

  for (const [domainKey, domainData] of Object.entries(KNOWLEDGE_BASE)) {
    if (domainKey === 'general') continue; // Don't give general free points
    const keywords = domainData.keywords || [];

    for (const kw of keywords) {
      const lowerKw = kw.toLowerCase();
      // 1. Title match: 10 points
      if (titleSample.includes(lowerKw)) {
        domainScores[domainKey] += 10;
      }
      // 2. Subtitle match: 5 points
      if (subtitleSample.includes(lowerKw)) {
        domainScores[domainKey] += 5;
      }
      // 3. Chapters match: 3 points
      if (chaptersSample.includes(lowerKw)) {
        domainScores[domainKey] += 3;
      }
      // 4. Body text match: 1 point
      if (textSample.includes(lowerKw)) {
        domainScores[domainKey] += 1;
      }
    }
  }

  // Sort domains by highest score
  const sortedDomains = Object.entries(domainScores).sort((a, b) => b[1] - a[1]);
  const [topDomain, topScore] = sortedDomains[0] || ['general', 0];
  const [secondDomain, secondScore] = sortedDomains[1] || ['general', 0];

  const primaryDomain = topScore >= 4 ? topDomain : 'general';
  const secondaryDomain = secondScore >= 4 && secondDomain !== primaryDomain ? secondDomain : null;
  const confidence = Math.min(100, Math.round((topScore / 25) * 100));

  return {
    primaryDomain,
    confidence,
    secondaryDomain,
    domainMeta: KNOWLEDGE_BASE[primaryDomain] || KNOWLEDGE_BASE.general,
  };
}

/**
 * Generates Domain-Adapted Prompt Configuration for Gemini AI
 */
export function getDomainPromptConfig(domainId, context = {}) {
  const domain = KNOWLEDGE_BASE[domainId] || KNOWLEDGE_BASE.general;
  const { bookTitle = '', targetCh = 1, chTitle = '' } = context;

  return {
    roleName: domain.roleName,
    perspective: domain.perspective,
    coreGuidance: domain.coreGuidance,
    calloutContext: domain.calloutContext,
    widgetLabGuidance: `
- Đa dạng hóa hình thức trực quan (Visual Lab) theo lĩnh vực và bản chất nội dung bài học — BẮT BUỘC KHÔNG ĐƯỢC 1 CHIỀU:
  * Với chủ đề Pod, Container, Tài nguyên, Node, Cgroups: Dùng 'type': 'resource_isolation' (mô phỏng phân bổ & tranh chấp CPU/RAM giữa các container trên cùng Node).
  * Với sách Quản trị, Tâm lý, Kỹ năng mềm: Dùng 'type': 'mindmap' (sơ đồ tư duy tương tác phân nhánh) hoặc 'matrix' (ma trận quyết định 2x2).
  * Với sách Tài chính, Kinh tế, Tiếp thị: Dùng 'type': 'chart' (biểu đồ động so sánh chỉ số CAC/LTV, ROI, đòn bẩy vốn, dòng tiền).
  * Với sách Quy trình, Vòng đời, Trạng thái: Dùng 'type': 'state_machine' (chuỗi máy trạng thái có rollback bù trừ).
  * Với sách Công nghệ, Kỹ thuật, Hạ tầng: Dùng 'type': 'pipeline' (luồng dữ liệu qua API Gateway, Microservices, DB và Circuit Breaker).
- QUY TẮC BẮT BUỘC CHO NÚT BẤM (SCENARIO BUTTONS) — TUYỆT ĐỐI KHÔNG DÙNG NÚT VÔ NGHĨA:
  * Mỗi nút bấm PHẢI là một Kịch bản (Scenario) cụ thể thể hiện rõ luồng khái niệm của bài:
    + Kịch bản 1: Kịch bản cơ sở hoặc khi chưa áp dụng giải pháp (thấy rõ lỗi, tranh chấp, hoặc điểm nghẽn).
    + Kịch bản 2: Kịch bản áp dụng nguyên lý cốt lõi của bài học (thấy rõ cơ chế giải quyết, tối ưu, hoặc cô lập).
    + Kịch bản 3: Kịch bản kiểm thử tình huống ngoại lệ (Stress test, quá tải bộ nhớ, hoặc ngắt mạch sự cố).
  * Trong mỗi kịch bản, BẮT BUỘC cung cấp:
    + "label": Tên kịch bản ngắn gọn, có icon (ví dụ: "🔴 1. Không giới hạn (No Limits)", "🟢 2. Bật cgroups Limits", "⚠️ 3. Thử nghiệm OOMKilled").
    + "msg": Hiện tượng quan sát được ngay lập tức.
    + "insight": Giải thích cơ chế tầng sâu (tại sao xảy ra điều này theo lý thuyết của sách) và bài học thực chiến rút ra.
- Các "nodes" trong widget PHẢI đại diện cho các thực thể cụ thể của bài học:
  (Gợi ý nodes mặc định: ${domain.widgetLabBlueprint.defaultNodes.map((n) => n.label).join(' -> ')}).
- Slider / Điều khiển: ${domain.widgetLabBlueprint.slider.label} (${domain.widgetLabBlueprint.slider.unit}).
- Stats: 3 chỉ số đo lường hiệu quả đặc thù ngành (${domain.keyMetrics.slice(0, 3).join(', ')}).
`,
    quizContext: domain.quizContext,
    foundationalPrinciples: domain.foundationalPrinciples,
  };
}

/**
 * Returns Domain-Adapted Interactive Lab Blueprint for Dynamic JS Synthesis
 */
export function getDomainWidgetBlueprint(domainId, topicShort = '') {
  const domain = KNOWLEDGE_BASE[domainId] || KNOWLEDGE_BASE.general;
  const blueprint = domain.widgetLabBlueprint;

  // Clone nodes and dynamically inject topic short name into the 2nd node
  const nodes = blueprint.defaultNodes.map((node, idx) => {
    if (idx === 1 && topicShort) {
      return {
        ...node,
        label: topicShort.slice(0, 24),
      };
    }
    return { ...node };
  });

  return {
    nodes,
    slider: blueprint.slider,
    actions: blueprint.actions,
    stats: blueprint.stats,
  };
}
