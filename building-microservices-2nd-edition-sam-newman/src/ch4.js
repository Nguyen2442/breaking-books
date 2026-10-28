/* Chương 4 — Implementing Microservice Communication: widgets + glossary */
(function () {
  const { h, s, clear, fmt, pct, rng, clamp, sleep,
          slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary } = window.DDIA;

  // ---------- small shared helpers ----------
  const enc = new TextEncoder();
  const byteLen = (str) => enc.encode(str).length;
  const pill = (tone, text) => h('span', { class: 'pill ' + (tone || '') }, text);
  const verdict = (tone, title, text) => h('div', { class: 'ch4-verdict ' + (tone || '') }, h('b', title), text ? h('span', text) : null);
  const ctlGroup = (label, el) => h('div', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), el);
  function table(headers, rows) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', h('tr', headers.map((x) => h('th', x)))),
      h('tbody', rows.map((r) => h('tr', { class: r.hit ? 'hit' : null }, (r.cells || r).map((c) => (c && c.num) ? h('td', { class: 'num' }, c.v) : h('td', c)))))));
  }
  /** lines: [{t:'text', c:'add'|'del'|'mark'|''}] */
  function codeLines(lines) {
    const pre = h('pre', { class: 'ch4-code' });
    lines.forEach((l, i) => {
      const txt = (typeof l === 'string') ? l : l.t;
      const cls = (typeof l === 'string') ? '' : (l.c || '');
      if (cls === 'mark') pre.appendChild(h('mark', txt));
      else if (cls) pre.appendChild(h('span', { class: cls }, txt));
      else pre.appendChild(document.createTextNode(txt));
      if (i < lines.length - 1) pre.appendChild(document.createTextNode('\n'));
    });
    return pre;
  }
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // =====================================================================
  // 4.1 — Five criteria scorecard
  // =====================================================================
  widget('ch4-criteria', (root) => {
    const CRIT = [
      { k: 'compat', label: 'Tương thích ngược' },
      { k: 'explicit', label: 'Giao diện tường minh' },
      { k: 'agnostic', label: 'Trung lập công nghệ' },
      { k: 'simple', label: 'Dễ dùng cho consumer' },
      { k: 'hide', label: 'Che giấu nội bộ' },
    ];
    const TECH = [
      { id: 'rmi', name: 'Java RMI', s: { compat: 0, explicit: 2, agnostic: 0, simple: 1, hide: 0 }, why: {
        compat: 'Thêm phương thức phải sinh lại stub; xoá một trường không ai dùng vẫn làm gãy giải tuần tự hoá.',
        explicit: 'Interface Java chính là hợp đồng, rõ ràng với cả hai phía.',
        agnostic: 'Trói cả client lẫn server vào JVM.',
        simple: 'Gọi như phương thức cục bộ — nhưng chỉ dành cho client trên JVM.',
        hide: 'Lớp Serializable nội bộ đi thẳng qua dây: lộ chi tiết cài đặt.' } },
      { id: 'soap', name: 'SOAP', s: { compat: 1, explicit: 2, agnostic: 2, simple: 0, hide: 1 }, why: {
        compat: 'Có WSDL để đối chiếu, nhưng vẫn phụ thuộc stub sinh mã.',
        explicit: 'WSDL là bắt buộc.',
        agnostic: 'Server Java, client .NET sinh mã từ WSDL — ví dụ chính trong sách.',
        simple: 'Khá nặng nề với lập trình viên so với lựa chọn hiện đại.',
        hide: 'Tuỳ cách thiết kế WSDL; dễ ánh xạ thẳng lớp nội bộ.' } },
      { id: 'grpc', name: 'gRPC', s: { compat: 2, explicit: 2, agnostic: 2, simple: 1, hide: 1 }, why: {
        compat: 'Field number giúp thêm trường không làm client cũ gãy; có Protolock để bắt thay đổi phá vỡ.',
        explicit: 'Đặc tả protocol buffer là bắt buộc.',
        agnostic: 'Sinh mã cho rất nhiều ngôn ngữ.',
        simple: 'Rất dễ khi bạn kiểm soát cả hai đầu; client phải biên dịch theo schema của server.',
        hide: 'Message tách khỏi lớp nội bộ nếu được thiết kế có chủ đích.' } },
      { id: 'rest', name: 'REST/HTTP', s: { compat: 2, explicit: 1, agnostic: 2, simple: 2, hide: 2 }, why: {
        compat: 'Thêm trường dễ dàng; consumer viết theo kiểu tolerant reader.',
        explicit: 'Schema là tuỳ chọn và hiếm gặp; OpenAPI, JSON Schema đang dần phổ biến.',
        agnostic: 'Mọi stack đều nói HTTP.',
        simple: 'Tương tác với đa dạng client nhất, tận dụng cache và công cụ HTTP.',
        hide: 'Representation tách hẳn khỏi cách tài nguyên được lưu bên trong.' } },
      { id: 'gql', name: 'GraphQL', s: { compat: 2, explicit: 2, agnostic: 2, simple: 2, hide: 0 }, why: {
        compat: 'Client chỉ chọn trường mình cần, nên thêm trường mới không ảnh hưởng.',
        explicit: 'Endpoint công bố schema các kiểu dữ liệu cho client.',
        agnostic: 'Ban đầu chỉ có JavaScript; nay mọi công nghệ lớn đều hỗ trợ.',
        simple: 'Một truy vấn lấy đúng thứ cần — rất hợp với thiết bị di động.',
        hide: 'Dễ trượt thành lớp vỏ bọc database, giống OData.' } },
      { id: 'mb', name: 'Message broker', s: { compat: 1, explicit: 0, agnostic: 2, simple: 1, hide: 1 }, why: {
        compat: 'Tuỳ định dạng payload; Avro gửi kèm schema giúp nhiều.',
        explicit: 'Schema cho payload thì có; mô tả “service phát ra event nào” (AsyncAPI, CloudEvents) còn non trẻ.',
        agnostic: 'Producer và consumer chỉ cần client của broker, viết bằng gì cũng được.',
        simple: 'Bên gửi bớt lo nhờ guaranteed delivery; consumer phải lo message trùng và sai thứ tự.',
        hide: 'Tuỳ nội dung message: event mô tả sự thật nghiệp vụ thì kín đáo, dump bản ghi nội bộ thì không.' } },
    ];
    const RATE = [['Kém', 'bad'], ['Tạm được', 'warn'], ['Tốt', 'ok']];
    let cur = 'grpc';
    const on = new Set(CRIT.map((c) => c.k));
    const techSeg = seg({ label: 'Công nghệ', options: TECH.map((t) => ({ value: t.id, label: t.name })), value: cur, onChange: (v) => { cur = v; render(); } });
    const checks = h('div', { class: 'ch4-row' }, CRIT.map((c) => checkbox(c.label, true, (v) => { v ? on.add(c.k) : on.delete(c.k); render(); }).el));
    const tableBox = h('div');
    const viz = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'controls' }, ctlGroup('Công nghệ đang xem', techSeg.el)),
      h('div', h('p', { class: 'lab-note' }, 'Tiêu chí được tính vào điểm tổng:'), checks),
      tableBox, viz);

    function render() {
      const t = TECH.find((x) => x.id === cur);
      clear(tableBox).appendChild(table(['Tiêu chí', 'Đánh giá', 'Lý do'], CRIT.map((c) => ({
        hit: on.has(c.k),
        cells: [c.label, pill(RATE[t.s[c.k]][1], RATE[t.s[c.k]][0]), t.why[c.k]],
      }))));
      // bar chart of totals
      const max = Math.max(1, on.size * 2);
      const W = 440, rowH = 28, top = 26, H = top + TECH.length * rowH + 26, x0 = 112, x1 = W - 40;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Điểm tổng theo tiêu chí đã chọn' });
      svg.appendChild(s('text', { x: x0, y: 14, class: 'lbl-strong' }, `Điểm tổng (tối đa ${max})`));
      for (let g = 0; g <= max; g += (max > 6 ? 2 : 1)) {
        const x = x0 + (g / max) * (x1 - x0);
        svg.appendChild(s('line', { x1: x, x2: x, y1: top - 4, y2: H - 22, class: 'grid' }));
        svg.appendChild(s('text', { x, y: H - 8, 'text-anchor': 'middle' }, String(g)));
      }
      const ranked = TECH.map((x) => ({ x, total: CRIT.filter((c) => on.has(c.k)).reduce((a, c) => a + x.s[c.k], 0) }));
      ranked.forEach(({ x, total }, i) => {
        const y = top + i * rowH;
        const w = (total / max) * (x1 - x0);
        const sel = x.id === cur;
        svg.appendChild(s('text', { x: x0 - 8, y: y + 16, 'text-anchor': 'end', class: sel ? 'lbl-strong' : '' }, x.name));
        svg.appendChild(s('rect', { x: x0, y: y + 4, width: Math.max(1, w), height: rowH - 10, rx: 3, class: sel ? 'f-accent' : 'f-accent-soft' }));
        svg.appendChild(s('text', { x: x0 + w + 6, y: y + 16, class: sel ? 'lbl-strong' : '' }, String(total)));
      });
      clear(viz).appendChild(svg);
    }
    render();
  });

  // =====================================================================
  // 4.2 — RPC technology coupling matrix
  // =====================================================================
  widget('ch4-rpc-coupling', (root) => {
    const LANGS = [
      { value: 'java', label: 'Java' }, { value: 'cs', label: '.NET (C#)' }, { value: 'go', label: 'Go' },
      { value: 'py', label: 'Python' }, { value: 'node', label: 'Node.js' },
    ];
    const FW = {
      rmi: { name: 'Java RMI', jvmOnly: true, schema: 'Không có IDL riêng — chính interface Java là hợp đồng', stub: 'Sinh tự động từ interface Remote (cần cùng JVM)', ser: 'Java Object Serialization (nhị phân)', transport: 'JRMP trên TCP',
        idl: ['public interface CustomerRemote extends Remote {', '  Customer findCustomer(String id) throws RemoteException;', '}'],
        call: { java: 'CustomerRemote c = (CustomerRemote) registry.lookup("customer");\nCustomer cu = c.findCustomer("1234");' } },
      soap: { name: 'SOAP', schema: 'WSDL (XML), lấy out of band trước khi gọi', stub: 'Sinh từ WSDL bằng công cụ của từng stack', ser: 'XML trong SOAP envelope', transport: 'HTTP “trên danh nghĩa” — mọi thứ là POST, bỏ qua mã lỗi',
        idl: ['<wsdl:operation name="findCustomer">', '  <wsdl:input message="tns:findCustomerRequest"/>', '  <wsdl:output message="tns:findCustomerResponse"/>', '</wsdl:operation>'],
        call: { java: 'CustomerPort port = new CustomerService().getCustomerPort();\nCustomer cu = port.findCustomer("1234");', cs: 'var client = new CustomerServiceClient();\nvar cu = client.FindCustomer("1234");', go: 'port := customer.NewCustomerPort(soapClient)\ncu, err := port.FindCustomer(&customer.FindCustomer{Id: "1234"})', py: 'client = zeep.Client("customer.wsdl")\ncu = client.service.findCustomer("1234")', node: 'const client = await soap.createClientAsync("customer.wsdl");\nconst [cu] = await client.findCustomerAsync({ id: "1234" });' } },
      grpc: { name: 'gRPC', schema: 'File .proto (protocol buffers), lấy out of band', stub: 'protoc + plugin cho từng ngôn ngữ', ser: 'Protocol Buffers (nhị phân, định danh trường bằng số)', transport: 'HTTP/2 — nhiều stream request-response trên một kết nối',
        idl: ['service CustomerService {', '  rpc FindCustomer (FindCustomerRequest) returns (Customer);', '}', 'message FindCustomerRequest { string id = 1; }'],
        call: { java: 'var stub = CustomerServiceGrpc.newBlockingStub(channel);\nCustomer cu = stub.findCustomer(FindCustomerRequest.newBuilder().setId("1234").build());', cs: 'var client = new CustomerService.CustomerServiceClient(channel);\nvar cu = client.FindCustomer(new FindCustomerRequest { Id = "1234" });', go: 'client := pb.NewCustomerServiceClient(conn)\ncu, err := client.FindCustomer(ctx, &pb.FindCustomerRequest{Id: "1234"})', py: 'stub = customer_pb2_grpc.CustomerServiceStub(channel)\ncu = stub.FindCustomer(customer_pb2.FindCustomerRequest(id="1234"))', node: 'const client = new CustomerService("customer:50051", creds);\nclient.findCustomer({ id: "1234" }, (err, cu) => { /* ... */ });' } },
      thrift: { name: 'Thrift', schema: 'File .thrift (IDL), lấy out of band', stub: 'thrift --gen <ngôn ngữ>', ser: 'Thrift binary / compact (nhị phân)', transport: 'Socket TCP hoặc HTTP — chọn được transport',
        idl: ['service CustomerService {', '  Customer findCustomer(1: string id)', '}'],
        call: { java: 'var client = new CustomerService.Client(protocol);\nCustomer cu = client.findCustomer("1234");', cs: 'var client = new CustomerService.Client(protocol);\nvar cu = await client.findCustomer("1234");', go: 'client := customer.NewCustomerServiceClientFactory(transport, protoFactory)\ncu, err := client.FindCustomer(ctx, "1234")', py: 'client = CustomerService.Client(protocol)\ncu = client.findCustomer("1234")', node: 'const client = thrift.createClient(CustomerService, connection);\nconst cu = await client.findCustomer("1234");' } },
      avro: { name: 'Avro RPC', schema: 'Avro protocol (JSON) — có thể gửi kèm toàn bộ schema trong payload', stub: 'Tuỳ chọn: sinh mã, hoặc diễn giải động từ schema nhận được', ser: 'Avro binary (không gắn tag trường — cần schema để đọc)', transport: 'HTTP hoặc socket',
        idl: ['{ "protocol": "CustomerProtocol",', '  "messages": { "findCustomer": {', '    "request": [{"name": "id", "type": "string"}],', '    "response": "Customer" } } }'],
        call: { java: 'var proxy = SpecificRequestor.getClient(CustomerProtocol.class, transceiver);\nCustomer cu = proxy.findCustomer("1234");', cs: 'var requestor = new GenericRequestor(transceiver, protocol);\nvar cu = requestor.Request("findCustomer", new { id = "1234" });', go: 'cu, err := requestor.Call("findCustomer", map[string]any{"id": "1234"})', py: 'requestor = ipc.Requestor(protocol, transceiver)\ncu = requestor.request("findCustomer", {"id": "1234"})', node: 'const cu = await client.emitMessage("findCustomer", { id: "1234" });' } },
    };
    let fw = 'soap', server = 'java', client = 'cs';
    const fwSeg = seg({ options: Object.entries(FW).map(([value, f]) => ({ value, label: f.name })), value: fw, onChange: (v) => { fw = v; render(); } });
    const srvSeg = seg({ options: LANGS, value: server, onChange: (v) => { server = v; render(); } });
    const cliSeg = seg({ options: LANGS, value: client, onChange: (v) => { client = v; render(); } });
    const out = h('div');
    root.append(h('div', { class: 'ch4-qa' }, ctlGroup('Framework RPC', fwSeg.el), ctlGroup('Stack của server', srvSeg.el), ctlGroup('Stack của client', cliSeg.el)), out);
    const langName = (v) => LANGS.find((l) => l.value === v).label;

    function render() {
      const f = FW[fw];
      const okSrv = !f.jvmOnly || server === 'java';
      const okCli = !f.jvmOnly || client === 'java';
      const ok = okSrv && okCli;
      const v = ok
        ? verdict('ok', `Tương tác được: server ${langName(server)} ↔ client ${langName(client)}`, fw === 'avro' ? 'Client có thể sinh mã trước, hoặc nhận schema kèm payload và diễn giải động.' : 'Client tự sinh stub từ schema — không cần thư viện client do nhóm server viết.')
        : verdict('bad', 'Không tương tác được', `Java RMI đòi hỏi cả hai đầu cùng chạy trên JVM. ${!okSrv ? 'Server' : 'Client'} viết bằng ${langName(!okSrv ? server : client)} không dùng được — ghép nối công nghệ làm lộ chi tiết cài đặt nội bộ.`);
      const callTxt = ok ? (f.call[client] || f.call.java) : '// Không có stub cho ' + langName(client) + ' — RMI chỉ chạy trên JVM';
      clear(out).append(
        v,
        h('div', { class: 'stats' },
          stat('Hợp đồng / schema', f.schema.split(' — ')[0].split(',')[0], 'accent', f.schema.includes(' — ') ? f.schema.split(' — ')[1] : ''),
          stat('Tuần tự hoá', f.ser.split(' (')[0], null, f.ser.includes('(') ? '(' + f.ser.split(' (')[1] : ''),
          stat('Giao thức mạng', f.transport.split(' — ')[0], null, f.transport.split(' — ')[1] || '')),
        h('div', { class: 'lab-split' },
          h('div', { class: 'box' }, h('h5', 'Định nghĩa giao diện'), codeLines(f.idl)),
          h('div', { class: 'box' }, h('h5', `Lời gọi phía client (${langName(client)})`), codeLines(callTxt.split('\n').map((t) => ({ t, c: ok ? '' : 'del' }))))),
        h('p', { class: 'lab-note' }, 'Cách lấy stub: ' + f.stub + '. Đoạn mã chỉ để minh hoạ hình dạng API, tên lớp cụ thể tuỳ phiên bản thư viện.'));
    }
    render();
  });

  // =====================================================================
  // 4.3 — RMI brittleness vs protobuf field numbers
  // =====================================================================
  widget('ch4-rmi-brittleness', (root) => {
    const CONSUMERS = [
      { id: 'helpdesk', name: 'Helpdesk', uses: 'Muốn dùng createCustomer(email); hiển thị họ tên', names: true, wantsNew: true },
      { id: 'email', name: 'Email', uses: 'Chỉ gọi findCustomer; đọc firstName, emailAddress', names: true },
      { id: 'loyalty', name: 'Loyalty', uses: 'Chỉ gọi findCustomer; đọc emailAddress', names: false },
    ];
    let change = 'removeAge', tech = 'rmi';
    const chSeg = seg({ options: [
      { value: 'none', label: 'Không đổi' }, { value: 'addMethod', label: 'Thêm createCustomer(email)' },
      { value: 'removeAge', label: 'Xoá trường age' }, { value: 'naming', label: 'Gom tên vào kiểu Naming' }], value: change, onChange: (v) => { change = v; render(); } });
    const techSeg = seg({ options: [{ value: 'rmi', label: 'Binary stub (Java RMI)' }, { value: 'proto', label: 'Protocol buffers (gRPC)' }], value: tech, onChange: (v) => { tech = v; render(); } });
    const out = h('div');
    root.append(h('div', { class: 'ch4-qa' }, ctlGroup('Thay đổi phía server', chSeg.el), ctlGroup('Công nghệ tuần tự hoá', techSeg.el)), out);

    function code() {
      if (tech === 'rmi') {
        const L = [];
        if (change === 'naming') L.push({ t: 'public class Naming implements Serializable {', c: 'add' }, { t: '  private String firstName;', c: 'add' }, { t: '  private String surname;', c: 'add' }, { t: '}', c: 'add' });
        L.push('public class Customer implements Serializable {');
        if (change === 'naming') L.push({ t: '  private String firstName;', c: 'del' }, { t: '  private String surname;', c: 'del' }, { t: '  private Naming naming;', c: 'add' });
        else L.push('  private String firstName;', '  private String surname;');
        L.push('  private String emailAddress;');
        L.push(change === 'removeAge' ? { t: '  private String age;', c: 'del' } : '  private String age;');
        L.push('}');
        if (change === 'addMethod') L.push('', '// CustomerRemote', { t: 'public Customer createCustomer(String emailAddress) throws RemoteException;', c: 'add' });
        return L;
      }
      const L = [];
      if (change === 'naming') L.push({ t: 'message Naming { string first_name = 1; string surname = 2; }', c: 'add' });
      L.push('message Customer {');
      if (change === 'naming') L.push({ t: '  string first_name = 1;', c: 'del' }, { t: '  string surname = 2;', c: 'del' }, { t: '  reserved 1, 2;', c: 'add' });
      else L.push('  string first_name = 1;', '  string surname = 2;');
      L.push('  string email_address = 3;');
      if (change === 'removeAge') L.push({ t: '  string age = 4;', c: 'del' }, { t: '  reserved 4;', c: 'add' });
      else L.push('  string age = 4;');
      if (change === 'naming') L.push({ t: '  Naming naming = 5;', c: 'add' });
      L.push('}');
      if (change === 'addMethod') L.push('', '// service CustomerService', { t: 'rpc CreateCustomerByEmail (EmailRequest) returns (Customer);', c: 'add' });
      return L;
    }
    function outcome(c) {
      if (change === 'none') return ['ok', 'Không ảnh hưởng', false];
      if (tech === 'rmi') {
        if (change === 'addMethod') return c.wantsNew ? ['warn', 'Phải sinh lại stub để dùng phương thức mới', true] : ['warn', 'Có thể phải nâng cấp stub dù không dùng phương thức mới', true];
        return ['bad', 'Gãy khi giải tuần tự hoá Customer', true];
      }
      if (change === 'addMethod') return c.wantsNew ? ['ok', 'Sinh lại stub khi nào muốn dùng', false] : ['ok', 'Không ảnh hưởng', false];
      if (change === 'removeAge') return ['ok', 'Trường 4 vắng mặt → giá trị mặc định; không ai đọc nên không sao', false];
      return c.names ? ['bad', 'Không crash nhưng first_name/surname đọc ra rỗng', true] : ['ok', 'Chỉ đọc trường 3 — không ảnh hưởng', false];
    }
    function render() {
      const res = CONSUMERS.map((c) => ({ c, o: outcome(c) }));
      const broken = res.filter((r) => r.o[0] === 'bad').length;
      const mustDeploy = res.filter((r) => r.o[2]).length;
      let v;
      if (change === 'none') v = verdict('ok', 'Không có thay đổi', 'Mọi consumer chạy như cũ.');
      else if (tech === 'rmi' && change === 'addMethod') v = verdict('warn', 'Sinh lại stub hàng loạt', 'Quản lý được — nhưng thay đổi kiểu này rất thường gặp, và endpoint RPC dần phình ra hàng loạt phương thức tạo/sửa đối tượng.');
      else if (tech === 'rmi') v = verdict('bad', 'Lock-step release', `Phải deploy server mới cùng lúc với cả ${mustDeploy} consumer. Đây là lý do kiểu dữ liệu đi qua binary serialization thành “expand-only”: không dám xoá trường nào.`);
      else if (change === 'naming') v = verdict('warn', 'Vẫn là breaking change', 'Field number không cứu được việc tái cấu trúc. Cách đúng: thêm trường naming nhưng giữ first_name/surname (thay đổi mở rộng), gỡ trường cũ khi mọi consumer đã chuyển.');
      else v = verdict('ok', 'Triển khai độc lập được', 'Protocol buffers định danh trường bằng số: thêm hay bỏ trường không ai dùng không làm client cũ gãy. Dùng “reserved” để số trường cũ không bị tái sử dụng.');
      clear(out).append(
        h('div', { class: 'lab-split' },
          h('div', { class: 'box' }, h('h5', tech === 'rmi' ? 'Customer.java (server)' : 'customer.proto (server)'), codeLines(code())),
          h('div', { class: 'stats' },
            stat('Consumer gãy', `${broken}/${CONSUMERS.length}`, broken ? 'bad' : 'ok'),
            stat('Phải deploy cùng server', String(mustDeploy), mustDeploy ? 'warn' : 'ok', 'consumer'),
            stat('Triển khai độc lập', mustDeploy ? 'Không' : 'Có', mustDeploy ? 'bad' : 'ok'))),
        table(['Consumer (minh hoạ)', 'Dùng gì', 'Kết quả'], res.map(({ c, o }) => [c.name, c.uses, pill(o[0], o[1])])),
        v);
    }
    render();
  });

  // =====================================================================
  // 4.4 — REST console
  // =====================================================================
  widget('ch4-rest-console', (root) => {
    const seed = () => ({ '1234': { id: '1234', firstname: 'Sam', lastname: 'Newman', email: 'sam@magpiebrain.com' } });
    let store = seed(), nextId = 1235, verb = 'GET', fmtType = 'json';
    const RPC = { GET: 'findCustomer(id)', POST: 'createCustomer(firstname, surname, email)', PUT: 'editCustomer(id, ...)', DELETE: 'deleteCustomer(id)' };
    const PROPS = { GET: [true, true, true], POST: [false, false, false], PUT: [false, true, false], DELETE: [false, true, false] };
    const verbSeg = seg({ options: ['GET', 'POST', 'PUT', 'DELETE'].map((v) => ({ value: v, label: v })), value: verb, onChange: (v) => { verb = v; preview(); } });
    const fmtSeg = seg({ options: [{ value: 'json', label: 'application/json' }, { value: 'xml', label: 'application/xml' }], value: fmtType, onChange: (v) => { fmtType = v; preview(); } });
    const sendBtn = button('Gửi request', () => { lg.reset(); send(); show(); });
    const tripleBtn = button('Gửi 3 lần liên tiếp', () => { lg.reset(); for (let i = 0; i < 3; i++) send(); show(); }, 'ghost');
    const resetBtn = button('Khôi phục dữ liệu', () => { store = seed(); nextId = 1235; lg.reset(); lg.add('Đã khôi phục: chỉ còn khách hàng 1234.', 't'); preview(); }, 'ghost');
    const reqBox = h('pre', { class: 'ch4-code' }), resBox = h('pre', { class: 'ch4-code' });
    const st = h('div', { class: 'stats' });
    const lg = log();
    root.append(
      h('div', { class: 'ch4-qa' }, ctlGroup('Động từ HTTP', verbSeg.el), ctlGroup('Header Accept (representation)', fmtSeg.el)),
      h('div', { class: 'btn-row' }, sendBtn, tripleBtn, resetBtn),
      h('div', { class: 'lab-split' }, h('div', { class: 'box' }, h('h5', 'Request'), reqBox), h('div', { class: 'box' }, h('h5', 'Response gần nhất'), resBox)),
      st, lg);

    const repr = (c) => fmtType === 'json' ? JSON.stringify(c, null, 2)
      : `<customer>\n  <id>${c.id}</id>\n  <firstname>${esc(c.firstname)}</firstname>\n  <lastname>${esc(c.lastname)}</lastname>\n  <email>${esc(c.email)}</email>\n</customer>`;
    const ctype = () => fmtType === 'json' ? 'application/json' : 'application/xml';
    function reqText() {
      const body = verb === 'POST' ? { firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' }
        : verb === 'PUT' ? { id: '1234', firstname: 'Sam', lastname: 'Newman', email: 'sam@samnewman.io' } : null;
      const path = verb === 'POST' ? '/customer' : '/customer/1234';
      let t = `${verb} ${path} HTTP/1.1\nHost: customer.musiccorp\nAccept: ${ctype()}`;
      if (body) t += `\nContent-Type: ${ctype()}\n\n${repr(body)}`;
      return { t, body };
    }
    let last = null;
    function send() {
      const { body } = reqText();
      let status, headers = [], out = '';
      if (verb === 'GET') {
        const c = store['1234'];
        if (c) { status = '200 OK'; headers = [`Content-Type: ${ctype()}`, 'Cache-Control: public, max-age=60', 'ETag: "' + c.email.length + c.firstname.length + '"']; out = repr(c); }
        else { status = '404 Not Found'; }
      } else if (verb === 'POST') {
        const id = String(nextId++);
        store[id] = { ...body, id };
        status = '201 Created'; headers = [`Location: /customer/${id}`, `Content-Type: ${ctype()}`]; out = repr(store[id]);
      } else if (verb === 'PUT') {
        const existed = !!store['1234'];
        store['1234'] = { ...body };
        status = existed ? '200 OK' : '201 Created'; headers = [`Content-Type: ${ctype()}`]; out = repr(store['1234']);
      } else {
        if (store['1234']) { delete store['1234']; status = '204 No Content'; } else status = '404 Not Found';
      }
      last = `HTTP/1.1 ${status}` + (headers.length ? '\n' + headers.join('\n') : '') + (out ? '\n\n' + out : '');
      const tone = /^2/.test(status) ? 'ok' : 'warn';
      lg.add(`${verb} ${verb === 'POST' ? '/customer' : '/customer/1234'} → ${status}  ·  store có ${Object.keys(store).length} khách hàng`, tone);
    }
    function show() {
      reqBox.textContent = reqText().t;
      resBox.textContent = last || '(chưa gửi)';
      const [safe, idem, cache] = PROPS[verb];
      clear(st).append(
        stat('An toàn (không đổi state)', safe ? 'Có' : 'Không', safe ? 'ok' : 'warn'),
        stat('Idempotent', idem ? 'Có' : 'Không', idem ? 'ok' : 'warn', idem ? 'gửi lại n lần = 1 lần' : 'mỗi lần tạo tài nguyên mới'),
        stat('Varnish cache được', cache ? 'Có' : 'Không', cache ? 'accent' : null),
        stat('Tương đương RPC', RPC[verb].split('(')[0], null, 'một phương thức riêng cho mỗi thao tác'));
    }
    function preview() { reqBox.textContent = reqText().t; show(); }
    send(); show();
  });

  // =====================================================================
  // 4.5 — HATEOAS: hard-coded URI client vs hypermedia client
  // =====================================================================
  widget('ch4-hateoas', (root) => {
    const VERS = {
      v1: { label: 'Ban đầu', href: '/instantPurchase/1234', extra: null, note: 'Như Ví dụ 4-2.' },
      add: { label: 'Thêm control mới', href: '/instantPurchase/1234', extra: '/wishlist', note: 'Thêm control /wishlist — một chuyển trạng thái mới.' },
      move: { label: 'Đổi URI', href: '/checkout/express/1234', extra: null, note: 'Server tổ chức lại URI; /instantPurchase không còn tồn tại.' },
      other: { label: 'Chuyển sang service khác', href: 'https://payments.musiccorp/buy/1234', extra: null, note: 'Việc mua được chuyển hẳn sang một service thanh toán khác.' },
      remove: { label: 'Xoá control mua', href: null, extra: null, note: 'Thay đổi ngữ nghĩa: album không còn mua ngay được từ đây.' },
    };
    let ver = 'move', busy = false;
    const vSeg = seg({ options: Object.entries(VERS).map(([value, v]) => ({ value, label: v.label })), value: ver, onChange: (v) => { ver = v; doc(); resetRun(); } });
    const runBtn = button('Mua album', run);
    const docBox = h('div', { class: 'box' });
    const mk = (title) => { const l = log(); const st = stat('Kết quả', '—'); const rt = stat('Round trip', '0', null, 'request qua mạng'); return { l, st, rt, el: h('div', { class: 'box' }, h('h5', title), h('div', { class: 'stats' }, st, rt), l) }; };
    const hard = mk('Client gán cứng URI'), hyper = mk('Client đi theo hypermedia');
    root.append(h('div', { class: 'ch4-qa' }, ctlGroup('Phiên bản server', vSeg.el)), h('div', { class: 'btn-row' }, runBtn), docBox, h('div', { class: 'lab-split' }, hard.el, hyper.el));

    function albumXml(v) {
      const L = ['<album>', '  <name>Give Blood</name>', { t: '  <link rel="/artist" href="/artist/theBrakes" />', c: 'mark' },
        '  <description>Awesome, short, brutish, funny and loud. Must buy!</description>'];
      if (v.href) L.push({ t: `  <link rel="/instantpurchase" href="${v.href}" />`, c: 'mark' });
      if (v.extra) L.push({ t: `  <link rel="/wishlist" href="${v.extra}/1234" />`, c: 'add' });
      L.push('</album>');
      return L;
    }
    function doc() { const v = VERS[ver]; clear(docBox).append(h('h5', 'GET /album/give-blood  ·  ' + v.note), codeLines(albumXml(v))); }
    function resetRun() {
      [hard, hyper].forEach((c) => { c.l.reset(); c.l.add('Bấm “Mua album” để chạy.', 't'); c.st.update('—', null); c.rt.update('0', null); });
    }
    async function run() {
      if (busy) return; busy = true; runBtn.disabled = true;
      const v = VERS[ver];
      [hard, hyper].forEach((c) => { c.l.reset(); c.st.update('đang chạy…', null); c.rt.update('0', null); });
      // hard-coded
      const h1 = (async () => {
        hard.l.add('POST /instantPurchase/1234', 'acc'); await sleep(350);
        hard.rt.update('1', null);
        const ok = v.href === '/instantPurchase/1234';
        hard.l.add(ok ? '← 201 Created: đã đặt mua' : '← 404 Not Found', ok ? 'ok' : 'bad');
        hard.st.update(ok ? 'Mua được' : 'Gãy', ok ? 'ok' : 'bad', ok ? '' : 'URI đã đổi mà client không biết');
      })();
      const h2 = (async () => {
        hyper.l.add('GET /album/give-blood', 'acc'); await sleep(350);
        hyper.rt.update('1', null);
        hyper.l.add('← 200 OK: tìm control rel="/instantpurchase"…', 't'); await sleep(300);
        if (!v.href) {
          hyper.l.add('Không có control mua trong tài nguyên', 'warn');
          hyper.st.update('Không mua được', 'warn', 'nhưng biết rõ lý do: control đã bị xoá');
          return;
        }
        hyper.l.add(`POST ${v.href}`, 'acc'); await sleep(350);
        hyper.rt.update('2', 'warn', 'nhiều hơn client gán cứng');
        hyper.l.add('← 201 Created: đã đặt mua', 'ok');
        hyper.st.update('Mua được', 'ok', ver === 'other' ? 'dù đã sang service khác' : '');
      })();
      await Promise.all([h1, h2]);
      busy = false; runBtn.disabled = false;
    }
    doc(); resetRun(); run();
  });

  // =====================================================================
  // 4.6 — GraphQL vs REST for mobile "latest orders" screen
  // =====================================================================
  widget('ch4-graphql', (root) => {
    const CUSTOMER = { id: '1234', firstname: 'Sam', lastname: 'Newman', email: 'sam@magpiebrain.com', telephoneNumber: '555-1234-5678',
      loyaltyTier: 'Gold', address: { line1: '1 Example Street', city: 'London', postcode: 'N1 0AA', country: 'UK' },
      marketingPreferences: { email: true, sms: false, post: false }, createdAt: '2015-03-02T10:11:12Z' };
    const r = rng(4);
    const TITLES = [['Give Blood', 'The Brakes'], ['Kid A', 'Radiohead'], ['Blue Lines', 'Massive Attack'], ['Dummy', 'Portishead'], ['Homogenic', 'Björk']];
    const ORDERS = TITLES.map(([title, artist], i) => ({
      id: 'ord-' + (9001 + i), date: `2020-0${5 - i}-1${i}`, value: +(9.99 + Math.round(r() * 3000) / 100).toFixed(2), currency: 'GBP',
      shipped: i > 0, status: i > 0 ? 'SHIPPED' : 'PAID',
      shippingAddress: { line1: '1 Example Street', city: 'London', postcode: 'N1 0AA', country: 'UK' },
      items: [{ sku: 'CD-' + (500 + i), title, artist, qty: 1, price: 9.99 }],
      payment: { method: 'CARD', last4: '4242' },
    }));
    const FIELDS = [
      { k: 'firstname', of: 'c', label: 'Tên', on: true }, { k: 'lastname', of: 'c', label: 'Họ', on: true },
      { k: 'email', of: 'c', label: 'Email', on: false }, { k: 'loyaltyTier', of: 'c', label: 'Hạng thành viên', on: false },
      { k: 'date', of: 'o', label: 'Ngày đặt', on: true }, { k: 'value', of: 'o', label: 'Giá trị', on: true },
      { k: 'shipped', of: 'o', label: 'Đã giao?', on: true }, { k: 'items', of: 'o', label: 'Tên album', on: false },
    ];
    const sel = new Set(FIELDS.filter((f) => f.on).map((f) => f.k));
    const boxC = h('div', { class: 'ch4-row' }), boxO = h('div', { class: 'ch4-row' });
    FIELDS.forEach((f) => (f.of === 'c' ? boxC : boxO).appendChild(checkbox(f.label, f.on, (v) => { v ? sel.add(f.k) : sel.delete(f.k); render(); }).el));
    const st = h('div', { class: 'stats' });
    const qBox = h('div', { class: 'box' }), rBox = h('div', { class: 'box' }), viz = h('div', { class: 'viz' });
    root.append(
      h('div', { class: 'lab-split' }, h('div', h('p', { class: 'lab-note' }, 'Trường khách hàng màn hình cần:'), boxC), h('div', h('p', { class: 'lab-note' }, 'Trường của mỗi đơn hàng (5 đơn gần nhất):'), boxO)),
      st, viz, h('div', { class: 'lab-split' }, qBox, rBox));

    function render() {
      const cF = FIELDS.filter((f) => f.of === 'c' && sel.has(f.k)).map((f) => f.k);
      const oF = FIELDS.filter((f) => f.of === 'o' && sel.has(f.k)).map((f) => f.k);
      const q = ['query {', '  customer(id: "1234") {', ...cF.map((k) => '    ' + k)];
      if (oF.length) {
        q.push('    orders(last: 5) {');
        oF.forEach((k) => q.push(k === 'items' ? '      items { title }' : '      ' + k));
        q.push('    }');
      }
      q.push('  }', '}');
      const data = { customer: {} };
      cF.forEach((k) => (data.customer[k] = CUSTOMER[k]));
      if (oF.length) data.customer.orders = ORDERS.map((o) => { const x = {}; oF.forEach((k) => (x[k] = k === 'items' ? o.items.map((it) => ({ title: it.title })) : o[k])); return x; });
      const gqlRes = { data };
      const gqlBytes = byteLen(JSON.stringify(gqlRes)) + byteLen(JSON.stringify({ query: q.join('\n') }));
      const restC = byteLen(JSON.stringify(CUSTOMER));
      const restO = byteLen(JSON.stringify(ORDERS));
      const restBytes = restC + restO;
      const restReq = oF.length ? 2 : 1;
      const restTotal = oF.length ? restBytes : restC;
      clear(st).append(
        stat('REST: số request', String(restReq), restReq > 1 ? 'warn' : null, 'GET /customer/1234' + (oF.length ? ' + GET /orders?customer=1234&limit=5' : '')),
        stat('GraphQL: số request', '1', 'ok', 'POST /graphql'),
        stat('REST: byte body', fmt(restTotal), null, 'trả về mọi trường'),
        stat('GraphQL: byte body', fmt(gqlBytes), 'ok', 'tiết kiệm ' + pct(1 - gqlBytes / restTotal, 0) + ' (gồm cả truy vấn gửi đi)'),
        stat('CDN cache được?', 'REST: Có · GraphQL: Khó', 'warn', 'GraphQL thường là POST tới một endpoint; cần cache theo ID ở client'));
      // bar chart
      const W = 440, H = 96, x0 = 80, x1 = W - 60, max = Math.max(restTotal, gqlBytes);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'So sánh số byte REST và GraphQL' });
      [['REST', restTotal, 'f-warn'], ['GraphQL', gqlBytes, 'f-ok']].forEach(([lbl, v, cls], i) => {
        const y = 12 + i * 34, w = (v / max) * (x1 - x0);
        svg.append(s('text', { x: x0 - 8, y: y + 16, 'text-anchor': 'end', class: 'lbl-strong' }, lbl),
          s('rect', { x: x0, y, width: Math.max(1, w), height: 22, rx: 3, class: cls }),
          s('text', { x: x0 + w + 6, y: y + 16 }, fmt(v) + ' B'));
      });
      svg.append(s('line', { x1: x0, x2: x0, y1: 6, y2: H - 18, class: 'axis' }), s('text', { x: x0, y: H - 4 }, 'byte body JSON (không tính header HTTP)'));
      clear(viz).appendChild(svg);
      clear(qBox).append(h('h5', 'Truy vấn GraphQL được dựng'), codeLines(q));
      clear(rBox).append(h('h5', 'Response GraphQL'), h('pre', { class: 'json', html: jsonHTML(gqlRes) }));
    }
    render();
  });

  // =====================================================================
  // 4.7 — Queue vs topic animation
  // =====================================================================
  widget('ch4-queue-topic', (root) => {
    let mode = 'queue', loyalty = false, busy = false, sent = 0, copies = 0;
    let groups = [];
    const W = 460;
    function build() {
      groups = mode === 'queue'
        ? [{ name: 'Order Processor', n: 3 }]
        : [{ name: 'Warehouse', n: 2 }, { name: 'Notifications', n: 2 }].concat(loyalty ? [{ name: 'Loyalty', n: 2 }] : []);
      groups.forEach((g) => { g.counts = Array(g.n).fill(0); g.rr = 0; });
      sent = 0; copies = 0;
    }
    const modeSeg = seg({ options: [{ value: 'queue', label: 'Queue (Hình 4-1)' }, { value: 'topic', label: 'Topic Order Status (Hình 4-2)' }], value: mode, onChange: (v) => { mode = v; loyaltyCb.input.disabled = v === 'queue'; build(); draw(); lg.reset(); } });
    const loyaltyCb = checkbox('Thêm consumer group Loyalty', false, (v) => { loyalty = v; build(); draw(); lg.reset(); lg.add('Bên gửi không đổi một dòng mã nào — nó không biết có thêm người nghe.', 't'); });
    loyaltyCb.input.disabled = true;
    const sendBtn = button('Gửi message', () => fire(1));
    const send6 = button('Gửi 6 message', () => fire(6), 'ghost');
    const resetBtn = button('Đặt lại', () => { build(); draw(); lg.reset(); }, 'ghost');
    const viz = h('div', { class: 'viz' });
    const st = h('div', { class: 'stats' });
    const lg = log();
    root.append(h('div', { class: 'controls' }, ctlGroup('Chế độ', modeSeg.el), loyaltyCb.el), h('div', { class: 'btn-row' }, sendBtn, send6, resetBtn), viz, st, lg);

    let geo = null;
    function draw(dot) {
      const instH = 24, gap = 6, head = 22;
      let y = 14;
      const gl = groups.map((g) => { const top = y; const hgt = head + g.n * (instH + gap) + 2; y += hgt + 10; return { g, top, hgt }; });
      const H = Math.max(200, y + 6);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sơ đồ broker' });
      const midY = H / 2;
      // sender + broker
      svg.append(
        s('rect', { x: 8, y: midY - 22, width: 84, height: 44, rx: 6, class: 'f-surface s-ink3' }),
        s('text', { x: 50, y: midY + 4, 'text-anchor': 'middle', class: 'lbl-strong' }, 'Bên gửi'),
        s('rect', { x: 122, y: midY - 34, width: 112, height: 68, rx: 8, class: mode === 'queue' ? 'f-accent-soft s-accent' : 'f-violet-soft s-violet' }),
        s('text', { x: 178, y: midY - 10, 'text-anchor': 'middle', class: 'lbl-strong' }, mode === 'queue' ? 'Queue' : 'Topic'),
        s('text', { x: 178, y: midY + 8, 'text-anchor': 'middle' }, mode === 'queue' ? 'orders' : 'Order Status'),
        s('text', { x: 178, y: midY + 24, 'text-anchor': 'middle' }, 'message broker'),
        s('line', { x1: 92, y1: midY, x2: 122, y2: midY, class: 's-ink3 f-none' }));
      const targets = [];
      gl.forEach(({ g, top, hgt }, gi) => {
        svg.append(s('rect', { x: 268, y: top, width: 184, height: hgt, rx: 8, class: 'f-none s-line dash' }),
          s('text', { x: 278, y: top + 15, class: 'lbl-strong' }, g.name + ' · consumer group'));
        for (let i = 0; i < g.n; i++) {
          const iy = top + head + i * (instH + gap);
          svg.append(s('rect', { x: 278, y: iy, width: 164, height: instH, rx: 5, class: 'f-surface s-ink3' }),
            s('text', { x: 288, y: iy + 16 }, `instance #${i + 1}`),
            s('text', { x: 432, y: iy + 16, 'text-anchor': 'end', class: g.counts[i] ? 'lbl-strong' : '' }, `${g.counts[i]} msg`));
          targets.push({ gi, i, x: 278, y: iy + instH / 2 });
          svg.append(s('line', { x1: 234, y1: midY, x2: 278, y2: iy + instH / 2, class: 's-line f-none' }));
        }
      });
      if (dot) dot.forEach((d) => svg.appendChild(s('circle', { cx: d.x, cy: d.y, r: 6, class: 'f-mark s-ink' })));
      geo = { midY, targets };
      clear(viz).appendChild(svg);
      clear(st).append(
        stat('Message đã gửi', String(sent), 'accent'),
        stat('Bản sao đã giao', String(copies), null, mode === 'queue' ? '1 bản / message' : `${groups.length} bản / message`),
        stat('Bên gửi biết người nhận?', mode === 'queue' ? 'Có' : 'Không', mode === 'queue' ? null : 'ok', mode === 'queue' ? 'gửi tới queue của Order Processor' : 'chỉ công bố lên topic'));
    }
    async function fire(n) {
      if (busy) return; busy = true; [sendBtn, send6, resetBtn].forEach((b) => (b.disabled = true));
      for (let k = 0; k < n; k++) {
        sent++;
        const picks = groups.map((g, gi) => { const i = g.rr; g.rr = (g.rr + 1) % g.n; return { gi, i }; });
        const steps = 8;
        for (let t = 1; t <= steps; t++) { draw([{ x: 92 + (178 - 92) * t / steps, y: geo.midY }]); await sleep(22); }
        const dest = picks.map((p) => geo.targets.find((x) => x.gi === p.gi && x.i === p.i));
        for (let t = 1; t <= steps; t++) { draw(dest.map((d) => ({ x: 234 + (d.x - 234) * t / steps, y: geo.midY + (d.y - geo.midY) * t / steps }))); await sleep(22); }
        picks.forEach((p) => { groups[p.gi].counts[p.i]++; copies++; });
        draw();
        lg.add(`msg #${sent} → ` + picks.map((p) => `${groups[p.gi].name} #${p.i + 1}`).join(', '), 'acc');
      }
      busy = false; [sendBtn, send6, resetBtn].forEach((b) => (b.disabled = false));
    }
    build(); draw();
    lg.add('Mỗi consumer group nhận một bản; trong group chỉ một instance xử lý (competing consumers).', 't');
  });

  // =====================================================================
  // 4.8 — Guaranteed delivery & duplicates
  // =====================================================================
  widget('ch4-delivery', (root) => {
    let mode = 'broker', runNo = 0;
    const N = 20;
    const modeSeg = seg({ options: [{ value: 'http', label: 'Gọi HTTP trực tiếp' }, { value: 'broker', label: 'Qua message broker' }], value: mode, onChange: (v) => { mode = v; run(); } });
    const down = slider({ label: 'Warehouse ngừng hoạt động trong', min: 0, max: 10, value: 4, format: (v) => v + ' event', onInput: () => run() });
    const loss = slider({ label: 'Xác suất mất ACK / response', min: 0, max: 50, value: 15, format: (v) => v + '%', onInput: () => run() });
    const idem = checkbox('Consumer kiểm tra message ID (idempotent)', false, () => run());
    const again = button('Chạy lại với dữ liệu ngẫu nhiên khác', () => { runNo++; run(); }, 'ghost');
    const viz = h('div', { class: 'viz' }), st = h('div', { class: 'stats' }), lg = log(60);
    root.append(h('div', { class: 'controls' }, ctlGroup('Cách gửi', modeSeg.el), down.el, loss.el), h('div', { class: 'btn-row' }, idem.el, again), viz, st, lg);

    function run() {
      const r = rng(77 + runNo * 13);
      const downFrom = 6, downTo = 6 + down.value; // events [downFrom, downTo) arrive while down
      const pLoss = loss.value / 100;
      const seen = new Set();
      const res = []; let lost = 0, dupProc = 0, dupSkip = 0, delayed = 0, processedUnique = 0;
      lg.reset();
      for (let i = 0; i < N; i++) {
        const id = 'evt-' + (101 + i);
        const isDown = i >= downFrom && i < downTo;
        let outc = 'ok';
        if (isDown) {
          if (mode === 'http') { lost++; res.push('lost'); lg.add(`${id}: kết nối thất bại — bên gọi phải tự quyết thử lại hay bỏ; ở đây bỏ cuộc → mất`, 'bad'); continue; }
          delayed++; outc = 'delayed';
          lg.add(`${id}: Warehouse không sẵn sàng — broker lưu bền, giao lại khi Warehouse lên`, 'acc');
        }
        // first delivery processed
        seen.add(id); processedUnique++;
        // ack lost → redelivery (broker) or client retry (http)
        if (r() < pLoss) {
          if (idem.value && seen.has(id)) { dupSkip++; outc = outc === 'delayed' ? 'delayed' : 'dupskip'; lg.add(`${id}: ${mode === 'http' ? 'response mất, client thử lại' : 'ACK mất, broker gửi lại'} → đã thấy ID này, bỏ qua`, 'ok'); }
          else { dupProc++; outc = 'dup'; lg.add(`${id}: ${mode === 'http' ? 'response mất, client thử lại' : 'ACK mất, broker gửi lại'} → xử lý lần 2: trừ kho hai lần!`, 'warn'); }
        }
        res.push(outc);
      }
      // strip
      const W = 450, cw = 20, gap = 2, x0 = 5;
      const svg = s('svg', { viewBox: `0 0 ${W} 74`, role: 'img', 'aria-label': 'Kết quả từng event' });
      const CLS = { ok: 'f-ok', lost: 'f-bad', dup: 'f-warn', dupskip: 'f-accent-soft', delayed: 'f-accent' };
      res.forEach((o, i) => {
        const x = x0 + i * (cw + gap);
        svg.append(s('rect', { x, y: 18, width: cw, height: 26, rx: 3, class: CLS[o] }), s('text', { x: x + cw / 2, y: 58, 'text-anchor': 'middle' }, String(i + 1)));
      });
      if (down.value) {
        const xa = x0 + downFrom * (cw + gap), xb = x0 + Math.min(N, downTo) * (cw + gap) - gap;
        svg.append(s('line', { x1: xa, x2: xb, y1: 10, y2: 10, class: 's-bad f-none' }), s('text', { x: xa, y: 8 }, 'Warehouse down'));
      }
      svg.append(s('text', { x: x0, y: 72 }, 'Thứ tự event (1–20)'));
      clear(viz).append(svg, h('div', { class: 'ch4-row' }, pill('ok', 'xử lý 1 lần'), pill('accent', 'trễ nhưng không mất'), pill('bad', 'mất'), pill('warn', 'xử lý trùng'), pill('', 'trùng bị bỏ qua (ô nhạt)')));
      clear(st).append(
        stat('Event gửi', String(N), 'accent'),
        stat('Warehouse đã xử lý', `${processedUnique}/${N}`, processedUnique === N ? 'ok' : 'bad'),
        stat('Mất', String(lost), lost ? 'bad' : 'ok', mode === 'http' ? 'bên gọi phải tự lo retry' : 'broker giữ hộ'),
        stat('Xử lý trùng', String(dupProc), dupProc ? 'warn' : 'ok', idem.value ? `bỏ qua ${dupSkip} bản trùng` : 'consumer không kiểm tra ID'),
        stat('Bị trễ', String(delayed), delayed ? 'accent' : null, 'chờ Warehouse lên lại'));
    }
    run();
  });

  // =====================================================================
  // 4.9 — Kafka log: per-partition order, retention, replay
  // =====================================================================
  widget('ch4-kafka-log', (root) => {
    const SCRIPT = [['1001', 'Created'], ['1002', 'Created'], ['1001', 'Paid'], ['1003', 'Created'], ['1002', 'Paid'], ['1001', 'Shipped'], ['1003', 'Paid'], ['1002', 'Shipped'], ['1003', 'Shipped']];
    const partOf = (k) => (k === '1002' ? 1 : 0);
    let mode = 'kafka', P, consumers, gseq, busy = false;
    const modeSeg = seg({ options: [{ value: 'classic', label: 'Broker truyền thống (xoá khi đã giao)' }, { value: 'kafka', label: 'Kafka (giữ theo retention)' }], value: mode, onChange: (v) => { mode = v; init(); } });
    const writeBtn = button('Ghi event tiếp theo', () => { write(); draw(); });
    const wRead = button('Warehouse đọc hết', () => readAll('W'), 'ghost');
    const newBtn = button('Triển khai consumer mới (Analytics)', deploy, 'ghost');
    const aRead = button('Analytics đọc hết', () => readAll('A'), 'ghost');
    const resetBtn = button('Đặt lại', () => init(), 'ghost');
    const viz = h('div', { class: 'viz' }), st = h('div', { class: 'stats' }), lg = log(80);
    root.append(h('div', { class: 'controls' }, ctlGroup('Kiểu lưu message', modeSeg.el)), h('div', { class: 'btn-row' }, writeBtn, wRead, newBtn, aRead, resetBtn), viz, st, lg);

    function init() {
      P = [[], []]; gseq = 0;
      consumers = { W: { name: 'Warehouse', off: [0, 0], order: [] } };
      lg.reset();
      for (let i = 0; i < 6; i++) write(true);
      readAll('W', true);
      lg.add('Đã ghi 6 event, Warehouse đã đọc hết. Thử triển khai consumer mới.', 't');
      draw();
    }
    function write(quiet) {
      if (gseq >= SCRIPT.length) { lg.add('Đã hết kịch bản (9 event). Bấm “Đặt lại” để chạy lại.', 't'); return; }
      const [key, ev] = SCRIPT[gseq];
      const p = partOf(key);
      P[p].push({ g: ++gseq, key, ev, subs: new Set(Object.keys(consumers)), readBy: new Set(), deleted: false });
      if (!quiet) lg.add(`Ghi g${gseq} #${key} ${ev} → partition ${p}, offset ${P[p].length - 1}`, 'acc');
    }
    function gc() {
      if (mode !== 'classic') return;
      P.forEach((part) => part.forEach((m) => { if (!m.deleted && [...m.subs].every((c) => m.readBy.has(c))) m.deleted = true; }));
    }
    function readAll(cid, quiet) {
      const c = consumers[cid];
      if (!c) { lg.add('Chưa triển khai consumer Analytics.', 'warn'); return; }
      const got = [];
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (let p = 0; p < 2; p++) {
          while (c.off[p] < P[p].length) {
            const m = P[p][c.off[p]]; c.off[p]++;
            if (m.deleted || !m.subs.has(cid)) continue;
            m.readBy.add(cid); got.push(m); c.order.push(m); progressed = true;
            break; // round-robin across partitions
          }
        }
      }
      gc();
      if (!quiet) {
        if (!got.length) lg.add(`${c.name}: không có gì mới để đọc.`, 't');
        else lg.add(`${c.name} đọc: ` + got.map((m) => `g${m.g}(#${m.key} ${m.ev})`).join(', '), cid === 'A' ? 'ok' : 'acc');
      }
      draw();
    }
    function deploy() {
      if (consumers.A) { lg.add('Analytics đã được triển khai.', 't'); return; }
      const off = mode === 'kafka' ? [0, 0] : [P[0].length, P[1].length];
      consumers.A = { name: 'Analytics', off, order: [] };
      // new subscriber: in kafka every retained message is readable
      if (mode === 'kafka') P.forEach((part) => part.forEach((m) => m.subs.add('A')));
      lg.add(mode === 'kafka' ? 'Analytics bắt đầu từ offset 0 — có thể đọc lại toàn bộ lịch sử.' : 'Analytics chỉ nhận message mới: message cũ đã bị xoá sau khi giao cho Warehouse.', mode === 'kafka' ? 'ok' : 'warn');
      draw();
    }
    function draw() {
      const cw = 52, x0 = 74, top = 34, rowH = 64;
      const maxLen = Math.max(6, P[0].length, P[1].length);
      const W = Math.max(440, x0 + maxLen * (cw + 4) + 10), H = top + 2 * rowH + 10;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Log của topic' });
      svg.appendChild(s('text', { x: x0, y: 14, class: 'lbl-strong' }, 'Topic orders · key = mã đơn hàng'));
      for (let p = 0; p < 2; p++) {
        const y = top + p * rowH;
        svg.appendChild(s('text', { x: 6, y: y + 20, class: 'lbl-strong' }, 'Partition ' + p));
        P[p].forEach((m, i) => {
          const x = x0 + i * (cw + 4);
          svg.append(
            s('rect', { x, y, width: cw, height: 32, rx: 4, class: m.deleted ? 'f-none s-ink3 dash' : (m.key === '1001' ? 'f-accent-soft s-accent' : m.key === '1002' ? 'f-violet-soft s-violet' : 'f-mark-soft s-mark') }),
            s('text', { x: x + cw / 2, y: y + 13, 'text-anchor': 'middle', class: m.deleted ? '' : 'lbl-strong' }, '#' + m.key),
            s('text', { x: x + cw / 2, y: y + 26, 'text-anchor': 'middle' }, m.deleted ? 'đã xoá' : m.ev),
            s('text', { x: x + 3, y: y - 3 }, `${i}·g${m.g}`));
        });
        Object.entries(consumers).forEach(([cid, c], k) => {
          const x = x0 + c.off[p] * (cw + 4);
          svg.append(s('path', { d: `M${x} ${y + 36} l-5 9 h10 z`, class: cid === 'A' ? 'f-violet' : 'f-accent' }),
            s('text', { x: x + 7 + k * 0, y: y + 46 + k * 11 }, cid === 'A' ? 'Analytics' : 'Warehouse'));
        });
      }
      clear(viz).appendChild(svg);
      const A = consumers.A;
      const keyOrderOk = (arr) => ['1001', '1002', '1003'].every((k) => { const g = arr.filter((m) => m.key === k).map((m) => m.g); return g.every((v, i) => !i || v > g[i - 1]); });
      const globalOk = (arr) => arr.every((m, i) => !i || m.g > arr[i - 1].g);
      const ref = A && A.order.length ? A.order : consumers.W.order;
      const stored = P[0].concat(P[1]).filter((m) => !m.deleted).length;
      clear(st).append(
        stat('Message còn lưu', `${stored}/${gseq}`, stored === gseq ? 'ok' : 'warn', mode === 'kafka' ? 'giữ theo retention' : 'xoá khi mọi subscriber đã nhận'),
        stat('Analytics đã đọc', A ? String(A.order.length) : 'chưa triển khai', A ? (A.order.length ? 'ok' : 'warn') : null),
        stat('Thứ tự trong mỗi đơn', keyOrderOk(ref) ? 'Giữ nguyên' : 'Sai', keyOrderOk(ref) ? 'ok' : 'bad', 'cùng key → cùng partition'),
        stat('Thứ tự toàn cục', globalOk(ref) ? 'Trùng thứ tự ghi' : 'Khác thứ tự ghi', globalOk(ref) ? null : 'warn', 'chỉ đảm bảo trong một partition'));
      writeBtn.disabled = gseq >= SCRIPT.length;
    }
    init();
  });

  // =====================================================================
  // 4.10 — Serialization formats with real encodings
  // =====================================================================
  widget('ch4-serialization', (root) => {
    const KEYS = ['firstname', 'lastname', 'email', 'telephoneNumber'];
    const SAM = { firstname: 'Sam', lastname: 'Newman', email: 'sam@magpiebrain.com', telephoneNumber: '555-1234-5678' };
    const FN = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken', 'Margaret', 'Dennis', 'Frances', 'Alan', 'Radia'];
    const LN = ['Lovelace', 'Hopper', 'Torvalds', 'Liskov', 'Thompson', 'Hamilton', 'Ritchie', 'Allen', 'Kay', 'Perlman'];
    function records(n) {
      const r = rng(9), out = [SAM];
      for (let i = 1; i < n; i++) {
        const f = FN[Math.floor(r() * FN.length)], l = LN[Math.floor(r() * LN.length)];
        out.push({ firstname: f, lastname: l, email: `${f.toLowerCase()}.${l.toLowerCase()}${i}@example.com`, telephoneNumber: `555-${1000 + Math.floor(r() * 9000)}-${1000 + Math.floor(r() * 9000)}` });
      }
      return out;
    }
    const varint = (n) => { const o = []; while (n > 127) { o.push((n & 127) | 128); n = Math.floor(n / 128); } o.push(n); return o; };
    const pbSegs = (c) => KEYS.flatMap((k, i) => { const b = [...enc.encode(c[k])]; return [{ k: 'tag', b: [((i + 1) << 3) | 2] }, { k: 'len', b: varint(b.length) }, { k: 'dat', b }]; });
    const avSegs = (c) => KEYS.flatMap((k) => { const b = [...enc.encode(c[k])]; return [{ k: 'len', b: varint(b.length * 2) }, { k: 'dat', b }]; });
    const flat = (segs) => segs.flatMap((x) => x.b);
    const xmlOne = (c, ind = '') => `${ind}<customer>\n` + KEYS.map((k) => `${ind}  <${k}>${esc(c[k])}</${k}>`).join('\n') + `\n${ind}</customer>`;
    const FMTS = {
      json: { label: 'JSON (gọn)', text: true, enc: (rs) => rs.length === 1 ? JSON.stringify(rs[0]) : JSON.stringify(rs) },
      jsonp: { label: 'JSON (thụt lề)', text: true, enc: (rs) => JSON.stringify(rs.length === 1 ? rs[0] : rs, null, 2) },
      xml: { label: 'XML', text: true, enc: (rs) => rs.length === 1 ? xmlOne(rs[0]) : '<customers>\n' + rs.map((c) => xmlOne(c, '  ')).join('\n') + '\n</customers>' },
      pb: { label: 'Protocol Buffers', text: false, enc: (rs) => rs.length === 1 ? flat(pbSegs(rs[0])) : rs.flatMap((c) => { const b = flat(pbSegs(c)); return [0x0a, ...varint(b.length), ...b]; }) },
      avro: { label: 'Avro', text: false, enc: (rs) => rs.length === 1 ? flat(avSegs(rs[0])) : [...varint(rs.length * 2), ...rs.flatMap((c) => flat(avSegs(c))), 0] },
    };
    let cur = 'pb', token = 0;
    const fSeg = seg({ options: Object.entries(FMTS).map(([value, f]) => ({ value, label: f.label })), value: cur, onChange: (v) => { cur = v; render(); } });
    const nSl = slider({ label: 'Số bản ghi trong payload', min: 1, max: 1000, value: 100, format: (v) => fmt(v), onInput: () => render() });
    const showBox = h('div', { class: 'box' }), schemaBox = h('div', { class: 'box' }), tbl = h('div'), viz = h('div', { class: 'viz' });
    root.append(h('div', { class: 'controls' }, ctlGroup('Định dạng đang xem', fSeg.el), nSl.el), h('div', { class: 'lab-split' }, showBox, schemaBox), tbl, viz);

    const SCHEMA = {
      json: ['// Không bắt buộc schema — có thể dùng JSON Schema:', '{ "type": "object",', '  "required": ["firstname", "lastname", "email"],', '  "properties": { "firstname": {"type": "string"}, ... } }'],
      jsonp: ['// Giống JSON gọn; khoảng trắng chỉ để người đọc dễ nhìn', '// nhưng vẫn tốn byte trên dây.'],
      xml: ['<!-- Có thể kèm XSD; trích trường bằng XPath: -->', '//customer/firstname', '//customer/email'],
      pb: ['message Customer {', '  string firstname = 1;       // tag 0x0A', '  string lastname = 2;        // tag 0x12', '  string email = 3;           // tag 0x1A', '  string telephoneNumber = 4; // tag 0x22', '}'],
      avro: ['{ "type": "record", "name": "Customer", "fields": [', '  {"name": "firstname", "type": "string"},', '  {"name": "lastname", "type": "string"},', '  {"name": "email", "type": "string"},', '  {"name": "telephoneNumber", "type": "string"} ] }', '// Không có tag trường: thiếu schema thì không đọc được'],
    };
    const hex = (n) => n.toString(16).padStart(2, '0');
    function showOne() {
      const f = FMTS[cur];
      clear(showBox).appendChild(h('h5', `Một bản ghi (Ví dụ 4-3) · ${f.label}`));
      if (f.text) { const t = f.enc([SAM]); showBox.append(h('pre', { class: 'ch4-code' }, t), h('p', { class: 'lab-note' }, fmt(byteLen(t)) + ' byte')); return; }
      const segs = cur === 'pb' ? pbSegs(SAM) : avSegs(SAM);
      const div = h('div', { class: 'ch4-hex' });
      segs.forEach((sg) => div.appendChild(h('span', { class: sg.k }, sg.b.map(hex).join(' ') + ' ')));
      showBox.append(div, h('div', { class: 'ch4-row' }, cur === 'pb' ? pill('accent', 'tag = số trường + kiểu') : null, pill('violet', cur === 'pb' ? 'độ dài (varint)' : 'độ dài (zigzag varint)'), pill('', 'dữ liệu UTF-8')),
        h('p', { class: 'lab-note' }, fmt(flat(segs).length) + ' byte'));
    }
    async function gz(data) {
      if (typeof CompressionStream === 'undefined') return null;
      const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)]);
      const buf = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      return buf.byteLength;
    }
    async function render() {
      const my = ++token;
      showOne();
      clear(schemaBox).append(h('h5', 'Schema / ghi chú'), codeLines(SCHEMA[cur]));
      const rs = records(nSl.value);
      const rows = Object.entries(FMTS).map(([k, f]) => { const d = f.enc(rs); return { k, f, d, raw: f.text ? byteLen(d) : d.length, gz: null }; });
      const paint = () => {
        const base = rows.find((x) => x.k === 'json').raw;
        clear(tbl).appendChild(table(['Định dạng', 'Byte (thô)', 'So với JSON gọn', 'Byte sau gzip'], rows.map((x) => ({
          hit: x.k === cur,
          cells: [x.f.label, { num: true, v: fmt(x.raw) }, { num: true, v: (x.raw >= base ? '+' : '') + pct(x.raw / base - 1, 0) }, { num: true, v: x.gz == null ? '…' : fmt(x.gz) }],
        }))));
        const W = 440, rowH = 24, x0 = 112, x1 = W - 64, H = rows.length * rowH + 30, max = Math.max(...rows.map((x) => x.raw));
        const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Byte theo định dạng' });
        rows.forEach((x, i) => {
          const y = 6 + i * rowH, w = (x.raw / max) * (x1 - x0), wg = x.gz ? (x.gz / max) * (x1 - x0) : 0;
          svg.append(s('text', { x: x0 - 8, y: y + 14, 'text-anchor': 'end', class: x.k === cur ? 'lbl-strong' : '' }, x.f.label),
            s('rect', { x: x0, y: y + 2, width: Math.max(1, w), height: 16, rx: 2, class: x.k === cur ? 'f-accent' : 'f-accent-soft' }),
            wg ? s('rect', { x: x0, y: y + 7, width: Math.max(1, wg), height: 6, rx: 1, class: 'f-ink2' }) : null,
            s('text', { x: x0 + w + 6, y: y + 14 }, fmtKB(x.raw)));
        });
        svg.append(s('text', { x: x0, y: H - 4 }, `${fmt(nSl.value)} bản ghi · thanh mảnh = sau gzip`));
        clear(viz).appendChild(svg);
      };
      paint();
      for (const x of rows) { x.gz = await gz(x.d); if (my !== token) return; }
      if (rows.some((x) => x.gz == null)) rows.forEach((x) => (x.gz = null));
      paint();
    }
    const fmtKB = (b) => b >= 1024 ? fmt(b / 1024, 1) + ' KB' : fmt(b) + ' B';
    render();
  });

  // =====================================================================
  // 4.11 — Structural vs semantic breakage: Hard Calculations
  // =====================================================================
  widget('ch4-schema-breaks', (root) => {
    const CH = {
      opt: { label: 'Thêm tham số tuỳ chọn c', kind: 'none', props: { a: 'integer', b: 'integer', c: 'integer' }, req: ['a', 'b'], impl: (a, b) => a + b, diff: [{ t: '+ properties.c: integer (tuỳ chọn)', c: 'add' }] },
      drop: { label: 'Chỉ nhận một số nguyên', kind: 'structural', props: { a: 'integer' }, req: ['a'], impl: (a) => a, diff: [{ t: '- properties.b (đã xoá)', c: 'del' }, { t: '- required: b', c: 'del' }] },
      required: { label: 'Thêm tham số bắt buộc c', kind: 'structural', props: { a: 'integer', b: 'integer', c: 'integer' }, req: ['a', 'b', 'c'], impl: (a, b, c) => a + b + c, diff: [{ t: '+ properties.c: integer', c: 'add' }, { t: '+ required: c   ← client cũ không gửi c', c: 'del' }] },
      type: { label: 'Đổi kiểu a sang string', kind: 'structural', props: { a: 'string', b: 'integer' }, req: ['a', 'b'], impl: (a, b) => a + b, diff: [{ t: '~ properties.a: integer → string', c: 'del' }] },
      mul: { label: 'Đổi cộng thành nhân', kind: 'semantic', props: { a: 'integer', b: 'integer' }, req: ['a', 'b'], impl: (a, b) => a * b, diff: [{ t: '(không có khác biệt nào về cấu trúc)', c: '' }] },
    };
    let ch = 'mul';
    const chSeg = seg({ options: Object.entries(CH).map(([value, c]) => ({ value, label: c.label })), value: ch, onChange: (v) => { ch = v; render(); } });
    const ci = checkbox('So sánh schema trong CI (Protolock, json-schema-diff-validator, openapi-diff)', true, () => render());
    const ct = checkbox('Consumer-driven contract test', false, () => render());
    const out = h('div');
    root.append(h('div', { class: 'ch4-qa' }, ctlGroup('Thay đổi trên calculate()', chSeg.el), ci.el, ct.el), out);
    const schemaOf = (props, req) => ({ type: 'object', required: req, properties: Object.fromEntries(Object.entries(props).map(([k, t]) => [k, { type: t }])) });

    function render() {
      const c = CH[ch];
      const structural = c.kind === 'structural';
      // contract test: consumer sends {a:2, b:3} and expects 5
      let actual, accepted = true;
      if (ch === 'drop' || ch === 'required' || ch === 'type') { accepted = false; actual = '400 Bad Request'; }
      else actual = String(c.impl(2, 3, 0));
      const testPass = accepted && actual === '5';
      const caughtCI = ci.value && structural;
      const caughtTest = ct.value && !testPass;
      const broken = !testPass;
      let v;
      if (!broken) v = verdict('ok', 'An toàn để deploy', 'Thay đổi mở rộng: consumer cũ vẫn gửi a, b và nhận 5. Schema diff báo “tương thích”.');
      else if (caughtCI) v = verdict('ok', 'Bị chặn ở CI — schema không tương thích', 'Build fail trước khi microservice được deploy. Phá vỡ cấu trúc dễ phát hiện bằng công cụ.');
      else if (caughtTest) v = verdict('ok', 'Bị chặn bởi kiểm thử hợp đồng', structural ? 'Không có schema diff, kiểm thử phải gánh cả phá vỡ cấu trúc.' : 'Chỉ kiểm thử mới bắt được phá vỡ ngữ nghĩa: cấu trúc giữ nguyên nhưng hành vi đổi.');
      else v = verdict('bad', 'Lọt ra production — consumer gãy', structural ? 'Không có lưới an toàn nào chạy. Bật so sánh schema trong CI.' : 'Schema diff báo “không đổi gì”. Cần consumer-driven contract test để bắt phá vỡ ngữ nghĩa.');
      clear(out).append(
        h('div', { class: 'lab-split' },
          h('div', { class: 'box' }, h('h5', 'Schema mới của request (JSON Schema)'), h('pre', { class: 'json', html: jsonHTML(schemaOf(c.props, c.req)) })),
          h('div', { class: 'box' }, h('h5', 'So với phiên bản cũ {a: integer, b: integer}'), codeLines(c.diff),
            h('p', { class: 'lab-note' }, 'Loại thay đổi: ', pill(c.kind === 'none' ? 'ok' : c.kind === 'structural' ? 'bad' : 'violet', c.kind === 'none' ? 'mở rộng (an toàn)' : c.kind === 'structural' ? 'phá vỡ cấu trúc' : 'phá vỡ ngữ nghĩa')))),
        h('div', { class: 'stats' },
          stat('Schema diff trong CI', !ci.value ? 'Tắt' : structural ? 'FAIL' : 'PASS', !ci.value ? null : structural ? 'bad' : 'ok', !ci.value ? 'không chạy' : structural ? 'không tương thích' : (ch === 'mul' ? 'không thấy gì thay đổi' : 'tương thích')),
          stat('Contract test calculate(2, 3) = 5', !ct.value ? 'Tắt' : testPass ? 'PASS' : 'FAIL', !ct.value ? null : testPass ? 'ok' : 'bad', 'thực tế: ' + actual),
          stat('Consumer ở production', broken && !caughtCI && !caughtTest ? 'Gãy' : 'Ổn', broken && !caughtCI && !caughtTest ? 'bad' : 'ok')),
        v);
    }
    render();
  });

  // =====================================================================
  // 4.12 — Tolerant reader (real XPath) + semantic versioning
  // =====================================================================
  widget('ch4-tolerant-reader', (root) => {
    const V1 = '<customer>\n  <firstname>Sam</firstname>\n  <lastname>Newman</lastname>\n  <email>sam@magpiebrain.com</email>\n  <telephoneNumber>555-1234-5678</telephoneNumber>\n</customer>';
    const VERS = {
      v1: { label: 'v1 · Ví dụ 4-3', xml: V1 },
      v2: { label: 'v2 · thêm dob', xml: V1.replace('</customer>', '  <dob>1970-01-01</dob>\n</customer>') },
      v3: { label: 'v3 · tái cấu trúc (Ví dụ 4-4)', xml: '<customer>\n  <naming>\n    <firstname>Sam</firstname>\n    <lastname>Newman</lastname>\n    <nickname>Magpiebrain</nickname>\n    <fullname>Sam "Magpiebrain" Newman</fullname>\n  </naming>\n  <email>sam@magpiebrain.com</email>\n</customer>' },
      v4: { label: 'v4 · bỏ telephoneNumber', xml: V1.replace('  <telephoneNumber>555-1234-5678</telephoneNumber>\n', '') },
    };
    const NEED = ['firstname', 'lastname', 'email'];
    const ALL = ['firstname', 'lastname', 'email', 'telephoneNumber'];
    let mode = 'reader', ver = 'v3';
    const modeSeg = seg({ options: [{ value: 'reader', label: 'Tolerant Reader' }, { value: 'semver', label: 'Semantic Versioning' }], value: mode, onChange: (v) => { mode = v; render(); } });
    const body = h('div');
    root.append(h('div', { class: 'controls' }, ctlGroup('Chế độ', modeSeg.el)), body);

    function xp(doc, expr) {
      try {
        if (doc.evaluate) return doc.evaluate(`string(${expr})`, doc, null, 2 /* STRING_TYPE */, null).stringValue;
      } catch (e) { /* fall through */ }
      const parts = expr.replace(/^\/+/, '').split('/');
      const el = expr.startsWith('//') ? doc.getElementsByTagName(parts[parts.length - 1])[0]
        : parts.reduce((n, p) => n && [...n.children].find((c) => c.tagName === p), { children: [doc.documentElement] });
      return el ? el.textContent : '';
    }
    let vSeg = null;
    function renderReader() {
      const doc = new DOMParser().parseFromString(VERS[ver].xml, 'application/xml');
      const kids = [...doc.documentElement.children].map((c) => c.tagName);
      const unknown = kids.filter((k) => !ALL.includes(k));
      const missing = ALL.filter((k) => !kids.includes(k));
      const readers = [
        { name: 'Binder chặt (gắn mọi trường)', how: 'ánh xạ toàn bộ phần tử con vào lớp Customer cố định', run: () => {
          if (unknown.length || missing.length) return { err: (unknown.length ? 'trường lạ <' + unknown.join('>, <') + '>' : '') + (unknown.length && missing.length ? '; ' : '') + (missing.length ? 'thiếu ' + missing.join(', ') : '') };
          return Object.fromEntries(NEED.map((k) => [k, xp(doc, '/customer/' + k)]));
        } },
        { name: 'Đường dẫn cố định', how: 'XPath /customer/firstname …', run: () => Object.fromEntries(NEED.map((k) => [k, xp(doc, '/customer/' + k)])) },
        { name: 'Tolerant Reader', how: 'XPath //firstname … (tìm ở bất cứ đâu)', run: () => Object.fromEntries(NEED.map((k) => [k, xp(doc, '//' + k)])) },
      ];
      const rows = readers.map((r) => {
        const res = r.run();
        if (res.err) return { r, ok: false, cells: [h('b', r.name), h('span', { class: 'lab-note' }, r.how), pill('bad', 'Lỗi bind: ' + res.err), '—'] };
        const ok = NEED.every((k) => res[k]);
        return { r, ok, cells: [h('b', r.name), h('span', { class: 'lab-note' }, r.how), h('div', { class: 'ch4-row' }, NEED.map((k) => pill(res[k] ? 'ok' : 'bad', k + ': ' + (res[k] || 'không thấy')))),
          ok ? `Chào ${res.firstname} ${res.lastname}, đơn hàng của bạn đã được giao → ${res.email}` : 'Không gửi được email'] };
      });
      const okN = rows.filter((x) => x.ok).length;
      clear(body).append(
        ctlGroup('Phiên bản payload từ customer service', vSeg.el),
        h('div', { class: 'lab-split' },
          h('div', { class: 'box' }, h('h5', 'GET /customer/1234 · ' + VERS[ver].label), h('pre', { class: 'ch4-code' }, VERS[ver].xml)),
          h('div', { class: 'stats' },
            stat('Reader gửi được email', `${okN}/3`, okN === 3 ? 'ok' : okN ? 'warn' : 'bad'),
            stat('Microservice email cần', NEED.join(', '), null, 'không cần telephoneNumber'))),
        table(['Reader', 'Cách đọc', 'Trường trích được', 'Email gửi đi'], rows.map((x) => x.cells)),
        h('p', { class: 'lab-note' }, 'XPath chạy thật bằng document.evaluate của trình duyệt. Giá trị dob là số liệu minh hoạ.'));
    }
    vSeg = seg({ options: Object.entries(VERS).map(([value, v]) => ({ value, label: v.label })), value: ver, onChange: (v) => { ver = v; renderReader(); } });

    // semver
    let running = '1.3.0', change = 'addField';
    const CHANGES = {
      bug: { label: 'Sửa lỗi tính thuế', bump: 'PATCH' }, addField: { label: 'Thêm trường dob', bump: 'MINOR' },
      removeField: { label: 'Xoá telephoneNumber', bump: 'MAJOR' }, semantic: { label: 'Đổi ý nghĩa một trường', bump: 'MAJOR' },
    };
    const runSeg = seg({ options: ['1.1.0', '1.2.0', '1.2.7', '1.3.0', '2.0.0'].map((v) => ({ value: v, label: v })), value: running, onChange: (v) => { running = v; renderSemver(); } });
    const chSeg = seg({ options: Object.entries(CHANGES).map(([value, c]) => ({ value, label: c.label })), value: change, onChange: (v) => { change = v; renderSemver(); } });
    function compat(built, run) {
      const [bM, bm] = built.split('.').map(Number), [rM, rm, rp] = run.split('.').map(Number);
      if (rM !== bM) return ['bad', 'Không tương thích', `MAJOR khác (${bM} → ${rM}): có thay đổi không tương thích ngược — helpdesk phải chuẩn bị sửa.`];
      if (rm < bm) return ['warn', 'Không đảm bảo', `MINOR thấp hơn (${run} < ${built}): có thể thiếu chức năng helpdesk dựa vào, được thêm ở ${built}.`];
      if (rm > bm) return ['ok', 'Tương thích', 'MINOR cao hơn: chỉ thêm chức năng tương thích ngược; helpdesk không cần đổi gì.'];
      return ['ok', 'Tương thích', rp ? 'Chỉ PATCH khác: sửa lỗi trên chức năng sẵn có.' : 'Đúng phiên bản helpdesk được xây.'];
    }
    function bumpOf(v, b) { const [M, m, p] = v.split('.').map(Number); return b === 'MAJOR' ? `${M + 1}.0.0` : b === 'MINOR' ? `${M}.${m + 1}.0` : `${M}.${m}.${p + 1}`; }
    function renderSemver() {
      const [tone, title, why] = compat('1.2.0', running);
      const c = CHANGES[change];
      const next = bumpOf('1.2.0', c.bump);
      const [t2, ti2] = compat('1.2.0', next);
      clear(body).append(
        ctlGroup('Customer service đang chạy phiên bản', runSeg.el),
        verdict(tone, `Helpdesk (xây cho 1.2.0) với ${running}: ${title}`, why),
        ctlGroup('Thay đổi sắp phát hành từ 1.2.0', chSeg.el),
        h('div', { class: 'stats' },
          stat('Phần cần tăng', c.bump, c.bump === 'MAJOR' ? 'bad' : c.bump === 'MINOR' ? 'accent' : 'ok'),
          stat('Phiên bản mới', next, null, 'MAJOR.MINOR.PATCH'),
          stat('Helpdesk', ti2, t2)),
        h('p', { class: 'lab-note' }, change === 'semantic' ? 'Không công cụ so sánh schema nào tự đề xuất MAJOR cho thay đổi ngữ nghĩa — người phát hành phải tự nhận ra.' : 'Ba con số gói rất nhiều kỳ vọng — nhưng chỉ đúng khi người phát hành tuân thủ quy ước.'));
    }
    function render() { mode === 'reader' ? renderReader() : renderSemver(); }
    render();
  });

  // =====================================================================
  // 4.13 — Breaking change strategies over time
  // =====================================================================
  widget('ch4-breaking-strategy', (root) => {
    const NAMES = ['Helpdesk', 'Email', 'Loyalty', 'Web shop', 'Mobile app', 'Reporting', 'Partner API', 'Set-top box'];
    let strat = 'emulate';
    const sSeg = seg({ options: [{ value: 'lockstep', label: 'Lock-step deployment' }, { value: 'coexist', label: 'Chạy song song hai phiên bản' }, { value: 'emulate', label: 'Giả lập giao diện cũ' }], value: strat, onChange: (v) => { strat = v; render(); } });
    const nSl = slider({ label: 'Số consumer', min: 2, max: 8, value: 6, onInput: () => render() });
    const mSl = slider({ label: 'Consumer chậm nhất cần', min: 1, max: 30, value: 16, format: (v) => v + ' tuần', onInput: () => render() });
    const dSl = slider({ label: 'Hạn chót đã thống nhất', min: 4, max: 52, value: 12, format: (v) => v + ' tuần', onInput: () => render() });
    const track = checkbox('Theo dõi định danh client (User-Agent / API key)', true, () => render());
    const viz = h('div', { class: 'viz' }), st = h('div', { class: 'stats' }), note = h('div');
    root.append(h('div', { class: 'controls' }, ctlGroup('Chiến lược', sSeg.el), nSl.el, mSl.el, dSl.el), track.el, viz, st, note);

    function render() {
      const n = nSl.value, maxW = mSl.value, dl = dSl.value;
      const r = rng(31 + n);
      const mig = NAMES.slice(0, n).map((name, i) => ({ name, w: i === n - 1 ? maxW : Math.max(1, Math.ceil(r() * maxW)) }));
      const lock = strat === 'lockstep';
      if (lock) mig.forEach((m) => (m.w = 0));
      const last = Math.max(...mig.map((m) => m.w));
      let removal;
      if (lock) removal = 0;
      else if (track.value) removal = last;
      else removal = dl;
      const broken = mig.filter((m) => m.w > removal);
      const extended = !lock && track.value && last > dl;
      const span = Math.max(dl, maxW, removal) + 2;
      const W = 460, x0 = 92, x1 = W - 12, rowH = 20, top = 30;
      const rows = n + 1;
      const H = top + rows * rowH + 34;
      const X = (w) => x0 + (w / span) * (x1 - x0);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Dòng thời gian chuyển đổi' });
      for (let w = 0; w <= span; w += span > 30 ? 10 : 4) {
        svg.append(s('line', { x1: X(w), x2: X(w), y1: top - 6, y2: top + rows * rowH, class: 'grid' }), s('text', { x: X(w), y: top + rows * rowH + 14, 'text-anchor': 'middle' }, String(w)));
      }
      svg.append(s('text', { x: x1, y: H - 4, 'text-anchor': 'end' }, 'tuần kể từ khi phát hành v2'));
      // service row
      const sy = top;
      svg.append(s('text', { x: x0 - 6, y: sy + 13, 'text-anchor': 'end', class: 'lbl-strong' }, 'Service'));
      if (lock) svg.append(s('rect', { x: X(0), y: sy + 3, width: X(span) - X(0), height: 12, rx: 2, class: 'f-ok' }), s('text', { x: X(0) + 4, y: sy + 13, class: 'lbl-strong' }, 'chỉ v2'));
      else if (strat === 'coexist') {
        svg.append(s('rect', { x: X(0), y: sy + 2, width: Math.max(1, X(removal) - X(0)), height: 7, rx: 2, class: 'f-warn' }),
          s('rect', { x: X(0), y: sy + 10, width: X(span) - X(0), height: 7, rx: 2, class: 'f-ok' }));
      } else {
        svg.append(s('rect', { x: X(0), y: sy + 3, width: X(span) - X(0), height: 12, rx: 2, class: 'f-ok' }),
          s('rect', { x: X(0), y: sy + 6, width: Math.max(1, X(removal) - X(0)), height: 6, rx: 1, class: 'f-warn' }));
      }
      mig.forEach((m, i) => {
        const y = top + (i + 1) * rowH;
        const bad = m.w > removal;
        svg.append(s('text', { x: x0 - 6, y: y + 13, 'text-anchor': 'end' }, m.name));
        if (m.w > 0) svg.append(s('rect', { x: X(0), y: y + 4, width: Math.max(1, X(Math.min(m.w, removal)) - X(0)), height: 10, rx: 2, class: 'f-warn' }));
        if (bad) svg.append(s('rect', { x: X(removal), y: y + 4, width: Math.max(1, X(m.w) - X(removal)), height: 10, rx: 2, class: 'f-bad' }));
        svg.append(s('rect', { x: X(m.w), y: y + 4, width: Math.max(1, X(span) - X(m.w)), height: 10, rx: 2, class: 'f-ok' }));
      });
      svg.append(s('line', { x1: X(dl), x2: X(dl), y1: top - 10, y2: top + rows * rowH, class: 's-ink3 dash f-none' }), s('text', { x: X(dl) + 3, y: top - 12 }, 'hạn chót'));
      if (!lock) svg.append(s('line', { x1: X(removal), x2: X(removal), y1: top - 2, y2: top + rows * rowH, class: 's-bad f-none' }), s('text', { x: X(removal) - 3, y: top - 2, 'text-anchor': 'end', class: 'lbl-strong' }, 'gỡ v1'));
      clear(viz).append(svg, h('div', { class: 'ch4-row' }, pill('warn', 'đang dùng v1'), pill('ok', 'đã dùng v2'), pill('bad', 'gãy vì v1 bị gỡ')));
      clear(st).append(
        stat('Deploy cùng một lúc', lock ? `${n + 1} service` : '1 service', lock ? 'bad' : 'ok', lock ? 'service + mọi consumer' : 'consumer tự chuyển theo nhịp riêng'),
        stat('Bản mã phải vá khi có bug', strat === 'coexist' ? '2 nhánh' : '1', strat === 'coexist' ? 'bad' : 'ok', strat === 'coexist' ? `trong ${removal} tuần` : ''),
        stat('Gỡ giao diện cũ ở tuần', lock ? '—' : String(removal), extended ? 'warn' : null, lock ? 'không có giao diện cũ' : extended ? 'gia hạn sau khi trao đổi với consumer chậm' : track.value ? 'ngay khi consumer cuối đã chuyển' : 'đúng hạn chót, không biết ai còn dùng'),
        stat('Consumer bị gãy', String(broken.length), broken.length ? 'bad' : 'ok', broken.map((b) => b.name).join(', ')),
        stat('Triển khai độc lập', lock ? 'Mất' : 'Giữ được', lock ? 'bad' : 'ok'));
      const NOTES = {
        lockstep: ['bad', 'Đi ngược khả năng triển khai độc lập', 'Chỉ chấp nhận được khi một nhóm sở hữu cả service lẫn consumer và đây thật sự là chuyện một lần. Dùng thường xuyên → distributed monolith.'],
        coexist: ['warn', 'Hai bộ service, định tuyến ở middleware, dữ liệu dùng chung', 'Mỗi bug phải sửa và deploy hai lần; logic định tuyến nằm trong middleware hoặc script nginx; khách hàng tạo ở phiên bản nào cũng phải hiển thị cho mọi service. Hợp với blue/green, canary — vài phút đến vài giờ, không phải nhiều tuần.'],
        emulate: ['ok', 'Expand and contract trong cùng một service', 'Cung cấp /v1/customer và /v2/customer song song; biến đổi nội bộ request V1 thành V2 để biết rõ đoạn mã nào sẽ gỡ. Lựa chọn tác giả ưu tiên.'],
      };
      const [t, ti, tx] = NOTES[strat];
      clear(note).append(verdict(t, ti, tx), !lock && !track.value && broken.length ? h('p', { class: 'lab-note' }, 'Giống công ty cho hẳn một năm rồi tắt: consumer gãy bị coi là lỗi của consumer — nhưng cũng không thể gỡ sớm hơn hạn chót dù mọi người đã chuyển.') : null);
    }
    render();
  });

  // =====================================================================
  // 4.14 — Shared code: what must redeploy when v2 ships
  // =====================================================================
  widget('ch4-shared-lib', (root) => {
    const SVC = ['Order', 'Payment', 'Warehouse', 'Notifications', 'Loyalty'];
    const KIND = {
      logging: { label: 'Thư viện logging', },
      domain: { label: 'Thư viện domain object (Customer)' },
      client: { label: 'Client library của Customer service' },
      mesh: { label: 'Proxy trong service mesh' },
    };
    let kind = 'domain', released = false, busy = false;
    const kSeg = seg({ options: Object.entries(KIND).map(([value, k]) => ({ value, label: k.label })), value: kind, onChange: (v) => { kind = v; released = false; transportOnly.input.disabled = v !== 'client'; render(); } });
    const transportOnly = checkbox('Client library chỉ chứa phần transport (discovery, retry); logic nằm ở server', false, () => render());
    transportOnly.input.disabled = true;
    const relBtn = button('Phát hành v2', release);
    const resetBtn = button('Đặt lại', () => { released = false; render(); }, 'ghost');
    const out = h('div'), st = h('div', { class: 'stats' });
    root.append(h('div', { class: 'ch4-qa' }, ctlGroup('Thứ được chia sẻ giữa 5 microservice', kSeg.el), transportOnly.el), h('div', { class: 'btn-row' }, relBtn, resetBtn), st, out);
    const ver = SVC.map((_, i) => i);

    function plan() {
      // returns per-service [version, mustNow, note, tone]
      const r = rng(5);
      return SVC.map((name) => {
        if (!released) return ['v1', false, 'đang chạy', ''];
        if (kind === 'logging') { const up = r() < 0.4; return [up ? 'v2' : 'v1', false, up ? 'đã nâng cấp khi tiện' : 'nâng cấp khi muốn — chạy v1 vẫn ổn', 'ok']; }
        if (kind === 'domain') return ['v2', true, 'phải deploy ngay, cùng lúc với mọi service khác', 'bad'];
        if (kind === 'client') {
          if (transportOnly.value) return ['v1', false, 'bản sửa nằm ở server; nâng cấp client khi muốn', 'ok'];
          return ['v2', true, 'logic đã rò sang client: phải deploy lại để nhận bản sửa', 'bad'];
        }
        return ['—', false, 'không phải deploy; proxy mới áp dụng cho mọi lưu lượng', 'ok'];
      });
    }
    async function release() {
      if (busy) return; busy = true; relBtn.disabled = true;
      released = true; render();
      await sleep(200);
      busy = false; relBtn.disabled = false;
    }
    function render() {
      const p = plan();
      const forced = p.filter((x) => x[1]).length;
      const invalidMsgs = released && kind === 'domain' ? 4 : 0;
      clear(st).append(
        stat('Service bị buộc deploy ngay', `${forced}/5`, forced ? 'bad' : 'ok'),
        stat('Message trong queue không hợp lệ', String(invalidMsgs), invalidMsgs ? 'bad' : 'ok', invalidMsgs ? 'phải xả queue trước khi deploy' : 'queue Order → Warehouse'),
        stat('Số phiên bản cùng tồn tại', released ? (kind === 'logging' ? '2' : kind === 'client' && transportOnly.value ? '2' : '1') : '1', null, kind === 'logging' || (kind === 'client' && transportOnly.value) ? 'chấp nhận được' : ''));
      const NOTE = {
        logging: ['ok', 'Ổn: khái niệm nội bộ, vô hình với bên ngoài', 'Mỗi service đóng gói thư viện vào bản deploy riêng, nâng cấp theo nhịp của mình. Nhiều phiên bản cùng tồn tại là bình thường.'],
        domain: ['bad', 'Ghép nối rò rỉ ra ngoài ranh giới service', 'Giống câu chuyện trong sách: đổi một domain object là mọi service phải cập nhật, queue phải xả hết message giờ đã không hợp lệ — quên làm thì khốn khổ.'],
        client: transportOnly.value ? ['ok', 'Mô hình AWS SDK', 'Client library chỉ lo transport và client tự quyết khi nào nâng cấp; bản sửa logic chỉ cần deploy server.'] : ['bad', 'Logic server rò sang client', 'Cohesion vỡ: để sửa server, bạn phải đổi và deploy lại nhiều client — mất khả năng phát hành độc lập.'],
        mesh: ['ok', 'Chia sẻ hành vi chung mà không cần thư viện', 'Proxy lo service discovery, logging… cho mọi service. Điều kiện: hành vi hoàn toàn chung chung, không dính nghiệp vụ của service nào.'],
      };
      const [t, ti, tx] = NOTE[kind];
      clear(out).append(
        table(['Microservice', 'Phiên bản', 'Ghi chú'], p.map((x, i) => ({ hit: x[1], cells: [SVC[i], x[0], x[3] ? pill(x[3], x[2]) : x[2]] }))),
        released ? verdict(t, ti, tx) : h('p', { class: 'lab-note' }, 'Bấm “Phát hành v2” để xem hệ quả.'));
    }
    render(); release();
    void ver;
  });

  // =====================================================================
  // 4.★ — Technology chooser
  // =====================================================================
  widget('ch4-tech-chooser', (root) => {
    const A = { collab: 'rr', exec: 'sync', who: 'internal', pri: 'latency' };
    const mk = (key, label, options) => ctlGroup(label, seg({ options, value: A[key], onChange: (v) => { A[key] = v; render(); } }).el);
    const out = h('div');
    root.append(h('div', { class: 'ch4-qa' },
      mk('collab', '1. Kiểu cộng tác', [{ value: 'rr', label: 'Request-response' }, { value: 'event', label: 'Event-driven' }]),
      mk('exec', '2. Bên gọi có chờ kết quả không?', [{ value: 'sync', label: 'Đồng bộ chặn' }, { value: 'async', label: 'Bất đồng bộ không chặn' }]),
      mk('who', '3. Ai là consumer?', [{ value: 'internal', label: 'Microservice nội bộ, bạn kiểm soát cả hai đầu' }, { value: 'wide', label: 'Nhiều loại client / bên ngoài' }, { value: 'mobile', label: 'GUI, di động cần gom dữ liệu' }]),
      mk('pri', '4. Ưu tiên', [{ value: 'latency', label: 'Hiệu năng, độ trễ thấp' }, { value: 'cache', label: 'Cache quy mô lớn' }, { value: 'none', label: 'Không có gì đặc biệt' }])), out);

    function decide() {
      if (A.collab === 'event') return { tech: 'Message broker — topic', tone: 'violet', why: ['Topic hợp với cộng tác dựa trên event: bên phát không biết ai nghe.', 'Event-driven vốn bất đồng bộ; broker cho guaranteed delivery.', 'Dùng Avro hoặc chuẩn CloudEvents/AsyncAPI để giao diện event tường minh.'], warn: 'Consumer phải chịu được message trùng và sai thứ tự (Kafka chỉ đảm bảo thứ tự trong một partition).', note: A.who === 'mobile' ? 'GraphQL là cơ chế gộp lời gọi ở vành đai, không dùng cho phát sự kiện.' : null };
      if (A.exec === 'async') return { tech: 'Message broker — queue (request + reply queue)', tone: 'accent', why: ['Queue hợp với request/response: bên gửi biết yêu cầu đi tới đâu.', 'Broker giữ message khi đích chưa sẵn sàng.', 'Lưu trạng thái và dùng correlation ID để ghép response (Chương 3).'], warn: 'REST có thể dựng giao tiếp bất đồng bộ, nhưng không hợp bằng broker.' };
      if (A.who === 'mobile') return { tech: 'GraphQL ở vành đai (hoặc BFF)', tone: 'ok', why: ['Một truy vấn thay cho nhiều request, chỉ lấy trường cần — hợp với di động.', 'Phía sau GraphQL, các microservice vẫn nói chuyện bằng REST/gRPC.'], warn: A.pri === 'cache' ? 'Cần cache mạnh? Cân nhắc giữ các request chung trên REST để CDN cache được — cache là điểm yếu của GraphQL.' : 'Theo dõi tải phía server vì client tự viết truy vấn; ghi dữ liệu có thể vẫn đi REST.' };
      if (A.who === 'wide' || A.pri === 'cache') return { tech: 'REST over HTTP', tone: 'ok', why: ['Tương tác với đa dạng client nhất; lựa chọn hiển nhiên cho API công khai.', 'Dựa trên khả năng của HTTP nên cache ở quy mô lớn rất hiệu quả (Varnish, CDN).', 'Thêm OpenAPI để có schema tường minh và sinh mã client.'], warn: 'Bỏ qua HATEOAS trừ khi bạn thật sự xây hệ hypermedia phân tán.' };
      return { tech: 'gRPC', tone: 'ok', why: ['Bạn kiểm soát cả client và server — đúng hoàn cảnh tác giả xếp gRPC lên đầu.', 'Xây trên HTTP/2, hiệu năng ấn tượng, protocol buffers giúp tương thích ngược qua field number.', 'Hệ sinh thái tốt: Protolock bắt thay đổi schema phá vỡ trong CI.'], warn: A.pri === 'none' ? 'REST over HTTP cũng là lựa chọn mặc định hợp lý nếu đội đã quen.' : 'Đừng che kín mạng: client phải biết mình đang gọi từ xa.' };
    }
    function render() {
      const d = decide();
      clear(out).append(
        h('div', { class: 'ch4-verdict ok' }, h('b', 'Đề xuất: ' + d.tech), h('ul', d.why.map((w) => h('li', w)))),
        verdict('warn', 'Cần nhớ', d.warn),
        d.note ? h('p', { class: 'lab-note' }, d.note) : null,
        A.collab === 'event' && A.exec === 'sync' ? h('p', { class: 'lab-note' }, 'Lưu ý: cộng tác hướng sự kiện về bản chất là bất đồng bộ — câu hỏi 2 không áp dụng.') : null);
    }
    render();
  });

  // =====================================================================
  // Glossary
  // =====================================================================
  const T = (key, term, vi, topic, def) => ({ key, term, vi, ch: 4, topic, def });
  glossary.add([
    T('backwards-compatibility', 'Backwards compatibility', 'tương thích ngược', 'ch4-criteria', 'Thay đổi một microservice mà consumer hiện có vẫn chạy bình thường, không cần sửa hay deploy lại. Điều kiện tiên quyết cho triển khai độc lập.'),
    T('explicit-interface', 'Explicit interface', 'giao diện tường minh', 'ch4-criteria', 'Những gì microservice cung cấp ra ngoài được mô tả rõ ràng (thường bằng schema), để consumer biết dùng gì và người phát triển biết phần nào không được tuỳ tiện đổi.'),
    T('technology-agnostic', 'Technology-agnostic API', 'API trung lập công nghệ', 'ch4-criteria', 'API không áp đặt stack công nghệ cho bên cài đặt hay bên gọi, giữ tự do chọn ngôn ngữ và framework cho từng microservice.'),
    T('client-library', 'Client library', 'thư viện client', 'ch4-dry', 'Thư viện giúp consumer gọi một service dễ hơn. Tiện lợi nhưng dễ gây ghép nối nếu chứa logic của server hoặc bắt buộc phải dùng; client nên tự quyết thời điểm nâng cấp.'),
    T('rpc', 'RPC (Remote Procedure Call)', 'lời gọi thủ tục từ xa', 'ch4-rpc', 'Kỹ thuật thực hiện một lời gọi trông như cục bộ nhưng thực thi trên service ở xa. Ví dụ: SOAP, gRPC, Thrift, Java RMI.'),
    T('client-stub', 'Client stub', 'stub phía client', 'ch4-rpc', 'Mã được sinh từ schema/giao diện, đóng vai đối tượng cục bộ và lo việc tuần tự hoá, gửi request qua mạng tới server.'),
    T('protocol-buffers', 'Protocol Buffers', 'protocol buffers', 'ch4-rpc', 'Định dạng tuần tự hoá nhị phân của Google, dùng bởi gRPC. Mỗi trường có field number nên thêm trường mới không làm client cũ gãy.'),
    T('wsdl', 'WSDL (Web Service Definition Language)', 'ngôn ngữ mô tả web service', 'ch4-rpc', 'Đặc tả schema dạng XML của SOAP; từ WSDL có thể sinh stub cho nhiều stack, ví dụ server Java và client .NET.'),
    T('java-rmi', 'Java RMI', 'Java Remote Method Invocation', 'ch4-rpc', 'Cơ chế RPC của Java, trói cả client và server vào JVM; nổi tiếng giòn: xoá một trường không ai dùng cũng buộc phát hành đồng loạt.'),
    T('avro', 'Avro', 'định dạng Avro', 'ch4-serialization', 'Định dạng tuần tự hoá dựa trên schema viết bằng JSON; có thể gửi schema kèm payload để client diễn giải động. Phổ biến cho payload message.'),
    T('fallacies-of-distributed-computing', 'Fallacies of distributed computing', 'các ngộ nhận về tính toán phân tán', 'ch4-rpc', 'Danh sách giả định sai về hệ phân tán; ngộ nhận đầu tiên là “mạng thì tin cậy được”. Mạng có thể hỏng nhanh, hỏng chậm hoặc làm méo gói tin.'),
    T('lock-step-release', 'Lock-step release / deployment', 'phát hành đồng loạt', 'ch4-managing-breaking', 'Buộc deploy microservice và mọi consumer của nó cùng lúc vì thay đổi không tương thích. Đi ngược triển khai độc lập; lạm dụng dẫn tới distributed monolith.'),
    T('expand-only-type', 'Expand-only type', 'kiểu chỉ được nở ra', 'ch4-rpc-brittleness', 'Kiểu dữ liệu đi qua binary serialization mà không thể xoá trường an toàn, nên chỉ ngày càng phình ra với những trường không ai dùng.'),
    T('grpc', 'gRPC', 'gRPC', 'ch4-rpc-brittleness', 'Framework RPC hiện đại xây trên HTTP/2 và protocol buffers. Lựa chọn hàng đầu của tác giả khi kiểm soát được cả client lẫn server.'),
    T('rest', 'REST (Representational State Transfer)', 'phong cách kiến trúc REST', 'ch4-rest', 'Phong cách kiến trúc lấy cảm hứng từ Web: phơi bày tài nguyên và thao tác lên chúng bằng tập động từ chung (GET, POST…), thường chạy trên HTTP.'),
    T('resource', 'Resource', 'tài nguyên', 'ch4-rest', 'Thứ mà service biết về, như Customer hay Order. Cách tài nguyên được biểu diễn bên ngoài tách hẳn khỏi cách nó được lưu bên trong.'),
    T('idempotent', 'Idempotent', 'tính luỹ đẳng', 'ch4-rest', 'Thực hiện một thao tác nhiều lần cho kết quả như một lần. GET, PUT, DELETE idempotent; POST tạo tài nguyên mới mỗi lần thì không.'),
    T('openapi', 'OpenAPI', 'đặc tả OpenAPI', 'ch4-rest', 'Đặc tả phát triển từ Swagger, mô tả endpoint REST đủ chi tiết để sinh mã client và so sánh tương thích (ví dụ bằng openapi-diff).'),
    T('hateoas', 'HATEOAS', 'hypermedia là động cơ trạng thái ứng dụng', 'ch4-hateoas', 'Nguyên tắc REST: client tương tác với server bằng cách đi theo liên kết trong tài nguyên thay vì biết trước URI. Tách rời mạnh nhưng dễ “lắm lời” và hiếm được áp dụng.'),
    T('hypermedia-control', 'Hypermedia control', 'điều khiển hypermedia', 'ch4-hateoas', 'Liên kết trong tài nguyên kèm quan hệ ngữ nghĩa (ví dụ rel="/instantpurchase") cho client biết có thể làm gì tiếp theo.'),
    T('graphql', 'GraphQL', 'GraphQL', 'ch4-graphql', 'Giao thức cho client tự định nghĩa truy vấn lấy đúng dữ liệu cần từ nhiều microservice trong một request. Mạnh ở vành đai hệ thống; yếu ở cache và kiểm soát tải.'),
    T('bff', 'Backend For Frontend (BFF)', 'backend riêng cho từng frontend', 'ch4-graphql', 'Mẫu dựng một backend riêng cho từng loại giao diện để gộp lời gọi tới các microservice; phương án thay thế cho GraphQL.'),
    T('message-broker', 'Message broker', 'trung gian thông điệp', 'ch4-brokers', 'Middleware đứng giữa các tiến trình, nhận message và giao theo queue hoặc topic; thường cung cấp guaranteed delivery.'),
    T('queue', 'Queue', 'hàng đợi', 'ch4-brokers', 'Kênh điểm-điểm: bên gửi biết message đi tới đâu, mỗi message được một consumer xử lý. Hợp với request/response.'),
    T('topic', 'Topic', 'chủ đề', 'ch4-brokers', 'Kênh phát sóng: mỗi consumer group đăng ký nhận một bản sao; bên gửi không biết ai nhận. Hợp với cộng tác dựa trên event.'),
    T('consumer-group', 'Consumer group', 'nhóm consumer', 'ch4-brokers', 'Tập instance của một microservice cùng đọc một queue/topic; mỗi message chỉ tới một thành viên trong group.'),
    T('competing-consumers', 'Competing Consumers', 'các consumer cạnh tranh', 'ch4-brokers', 'Mẫu nhiều worker cùng đọc một hàng đợi để phân phối tải; mỗi message chỉ được một worker nhận.'),
    T('guaranteed-delivery', 'Guaranteed delivery', 'đảm bảo giao nhận', 'ch4-delivery', 'Cam kết của broker rằng message sẽ được giao, kể cả khi đích tạm thời không sẵn sàng. Cần lưu bền, chạy cluster và cấu hình đúng.'),
    T('exactly-once-delivery', 'Exactly once delivery', 'giao đúng một lần', 'ch4-delivery', 'Tuyên bố mỗi message được giao đúng một lần. Gây tranh cãi; an toàn hơn là thiết kế consumer chịu được message trùng.'),
    T('kafka', 'Apache Kafka', 'Kafka', 'ch4-kafka', 'Broker dạng log phân tán do LinkedIn xây cho quy mô rất lớn; giữ message theo retention, đảm bảo thứ tự trong partition, có xử lý luồng tích hợp (KSQL).'),
    T('message-permanence', 'Message permanence', 'lưu giữ message lâu dài', 'ch4-kafka', 'Khả năng của Kafka giữ message trong thời gian cấu hình được (kể cả mãi mãi) để consumer đọc lại hoặc consumer mới xử lý lịch sử.'),
    T('xpath', 'XPath', 'ngôn ngữ truy vấn XPath', 'ch4-serialization', 'Chuẩn truy vấn để trích phần tử trong tài liệu XML, ví dụ //firstname tìm firstname ở bất kỳ đâu — công cụ tốt cho tolerant reader.'),
    T('schema', 'Schema', 'lược đồ', 'ch4-schemas', 'Mô tả tường minh cấu trúc dữ liệu endpoint nhận và trả (XSD, JSON Schema, WSDL, .proto). Giúp giao tiếp giữa các nhóm và bắt phá vỡ cấu trúc.'),
    T('structural-breakage', 'Structural breakage', 'phá vỡ cấu trúc', 'ch4-schemas', 'Thay đổi cấu trúc endpoint làm consumer không còn tương thích: xoá trường/phương thức, thêm trường bắt buộc. Bắt được bằng so sánh schema.'),
    T('semantic-breakage', 'Semantic breakage', 'phá vỡ ngữ nghĩa', 'ch4-schemas', 'Cấu trúc giữ nguyên nhưng hành vi đổi làm sai kỳ vọng của consumer, như calculate chuyển từ cộng sang nhân. Chỉ kiểm thử mới bắt được.'),
    T('expansion-change', 'Expansion change', 'thay đổi mở rộng', 'ch4-avoid-breaking', 'Chỉ thêm vào hợp đồng (trường mới, endpoint mới), không xoá gì. Cách dễ nhất để tránh breaking change.'),
    T('tolerant-reader', 'Tolerant Reader', 'reader khoan dung', 'ch4-avoid-breaking', 'Mẫu (tên do Martin Fowler đặt) viết consumer chỉ đọc những gì cần và bỏ qua thay đổi không liên quan, ví dụ dùng XPath thay vì gắn mọi trường.'),
    T('postels-law', "Postel's Law", 'nguyên tắc vững chắc (robustness principle)', 'ch4-avoid-breaking', '“Hãy bảo thủ với những gì bạn làm, phóng khoáng với những gì bạn nhận từ người khác.” Nền tảng của tolerant reader.'),
    T('semantic-versioning', 'Semantic versioning', 'đánh số phiên bản theo ngữ nghĩa', 'ch4-avoid-breaking', 'Quy ước MAJOR.MINOR.PATCH: MAJOR cho thay đổi không tương thích ngược, MINOR cho chức năng mới tương thích, PATCH cho sửa lỗi.'),
    T('consumer-driven-contracts', 'Consumer-driven contract testing', 'kiểm thử hợp đồng hướng consumer', 'ch4-avoid-breaking', 'Consumer mô tả kỳ vọng của mình thành bài kiểm thử chạy với service; bắt được cả phá vỡ ngữ nghĩa trước khi deploy.'),
    T('distributed-monolith', 'Distributed monolith', 'monolith phân tán', 'ch4-managing-breaking', 'Hệ thống tách thành nhiều service nhưng vẫn phải deploy cùng nhau — mang mọi phức tạp của hệ phân tán mà không có triển khai độc lập.'),
    T('expand-and-contract', 'Expand and contract', 'mở rộng rồi thu hẹp', 'ch4-managing-breaking', 'Mẫu đưa breaking change vào theo pha: mở rộng để hỗ trợ cả cách cũ lẫn mới, rồi thu hẹp, gỡ cách cũ khi mọi consumer đã chuyển.'),
    T('dry', "DRY (Don't Repeat Yourself)", 'đừng lặp lại chính mình', 'ch4-dry', 'Tránh trùng lặp hành vi và tri thức của hệ thống. Áp dụng máy móc qua thư viện dùng chung giữa các microservice có thể sinh ghép nối.'),
    T('service-mesh', 'Service mesh', 'lưới dịch vụ', 'ch4-dry', 'Lớp proxy đứng giữa các microservice, thực hiện hành vi chung như service discovery, logging mà không cần thư viện trong từng service.'),
    T('api-gateway', 'API gateway', 'cổng API', 'ch4-dry', 'Proxy ở lối vào hệ thống, có thể xác thực client bằng key, định tuyến và theo dõi ai đang gọi endpoint nào.'),
  ]);
})();
