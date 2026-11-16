import type {
  AudioTrack,
  LiteratureDocument,
  PlaylistItem,
  PresentationDeck,
  VideoItem,
} from '../types/studio.ts';
import { synthesizeWavBytes } from '../utils/studioLogic.ts';

export const COVER_IMAGES = {
  truyenKieu: '/src/assets/images/cover_truyen_kieu_1794840595355.jpg',
  tayTien: '/src/assets/images/cover_tay_tien_1794840596520.jpg',
  acousticStudio: '/src/assets/images/cover_acoustics_studio_1794840597670.jpg',
};

export function createSeedAudioTracks(): AudioTrack[] {
  // Pentatonic traditional zither melody (Đàn tranh - Truyện Kiều)
  const kieuWav = synthesizeWavBytes({
    durationSec: 12,
    sampleRate: 22050,
    notesHz: [
      293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 329.63,
      293.66, 392.0, 440.0, 587.33, 523.25, 440.0, 392.0, 293.66,
    ],
  });
  const kieuBlob = new Blob([kieuWav], { type: 'audio/wav' });

  // Atmospheric mountain chords (Tây Tiến - Quang Dũng)
  const tayTienWav = synthesizeWavBytes({
    durationSec: 14,
    sampleRate: 22050,
    notesHz: [
      220.0, 261.63, 329.63, 440.0, 392.0, 329.63, 293.66, 246.94,
      220.0, 293.66, 349.23, 440.0, 523.25, 440.0, 329.63, 220.0,
    ],
  });
  const tayTienBlob = new Blob([tayTienWav], { type: 'audio/wav' });

  // Warm Cello & Piano reading study piece
  const celloWav = synthesizeWavBytes({
    durationSec: 10,
    sampleRate: 22050,
    notesHz: [
      196.0, 246.94, 293.66, 392.0, 349.23, 293.66, 246.94, 196.0,
      220.0, 261.63, 329.63, 293.66,
    ],
  });
  const celloBlob = new Blob([celloWav], { type: 'audio/wav' });

  return [
    {
      id: 'track-kieu-zither',
      title: 'Nguyệt Cầm Đàn Tranh — Cảm hứng Truyện Kiều',
      artist: 'Literature Studio Ensemble',
      album: 'Âm hưởng Cổ điển Việt Nam',
      duration: 12,
      fileSize: kieuBlob.size,
      format: 'WAV',
      coverUrl: COVER_IMAGES.truyenKieu,
      isFavorite: true,
      createdAt: '2026-11-15T08:00:00.000Z',
      audioBlob: kieuBlob,
    },
    {
      id: 'track-tay-tien-ambient',
      title: 'Sương Lấp Sài Khao — Hòa tấu Đêm Tây Bắc',
      artist: 'Literature Studio Orchestra',
      album: 'Thi Ca Kháng Chiến Giao Hưởng',
      duration: 14,
      fileSize: tayTienBlob.size,
      format: 'WAV',
      coverUrl: COVER_IMAGES.tayTien,
      isFavorite: true,
      createdAt: '2026-11-15T09:30:00.000Z',
      audioBlob: tayTienBlob,
    },
    {
      id: 'track-cello-nocturne',
      title: 'Khúc Dạo Đầu Đọc Sách — Cello & Đèn Vàng',
      artist: 'Hòa Tấu Thính Phòng',
      album: 'Không Gian Đọc Sách Chuyên Sâu',
      duration: 10,
      fileSize: celloBlob.size,
      format: 'WAV',
      coverUrl: COVER_IMAGES.acousticStudio,
      isFavorite: false,
      createdAt: '2026-11-15T10:15:00.000Z',
      audioBlob: celloBlob,
    },
  ];
}

export const SEED_DOCUMENTS: LiteratureDocument[] = [
  {
    id: 'doc-truyen-kieu',
    title: 'Truyện Kiều (Trích đoạn: Trao duyên & Cảnh ngày xuân)',
    author: 'Nguyễn Du',
    category: 'Thơ',
    period: 'Văn học trung đại (Thế kỷ XVIII – XIX)',
    format: 'MD',
    isFavorite: true,
    updatedAt: '2026-11-16T06:00:00.000Z',
    summary:
      'Kiệt tác thơ Nôm lục bát của Đại thi hào Nguyễn Du, kết tinh giá trị hiện thực, giá trị nhân đạo sâu sắc và nghệ thuật miêu tả nội tâm bậc thầy.',
    content: `# Cảnh ngày xuân (Trích Truyện Kiều)

Ngày xuân con én đưa thoi,
Thiều quang chín chục đã ngoài sáu mươi.
Cỏ non xanh tận chân trời,
Cành lê trắng điểm một vài bông hoa.

Thanh minh trong tiết tháng ba,
Lễ là tảo mộ, hội là đạp thanh.
Gần xa nô nức yến anh,
Chị em sắm sửa bộ hành chơi xuân.

Dập dìu tài tử, giai nhân,
Ngựa xe như nước, áo quần như nêm.
Ngổn ngang gò đống kéo lên,
Thoi vàng vó rắc tro tiền giấy bay.

Tà tà bóng ngả về tây,
Chị em thơ thẩn dan tay ra về.
Bước dần theo ngọn tiểu khê,
Lần xem phong cảnh có bề thanh thanh.
Nao nao dòng nước uốn quanh,
Dịp cầu nho nhỏ cuối ghềnh bắc ngang.

---

# Trao duyên (Trích Truyện Kiều)

Cậy em, em có chịu lời,
Ngồi lên cho chị lạy rồi sẽ thưa.
Giữa đường đứt gánh tương tư,
Keo loan chắp mối tơ thừa mặc em!
Kể từ khi gặp chàng Kim,
Khi ngày quạt ước, khi đêm chén thề.
Sự đâu sóng gió bất kỳ,
Hiếu tình khôn lẽ hai bề vẹn hai!`,
    highlights: [
      {
        id: 'hl-kieu-1',
        quote: 'Cỏ non xanh tận chân trời, / Cành lê trắng điểm một vài bông hoa.',
        color: 'amber',
        note: 'Bút pháp chấm phá cổ điển kết hợp đảo ngữ "trắng điểm" tạo sức sống tinh khôi cho bức tranh mùa xuân.',
        createdAt: '2026-11-16T05:00:00.000Z',
      },
      {
        id: 'hl-kieu-2',
        quote: 'Cậy em, em có chịu lời, / Ngồi lên cho chị lạy rồi sẽ thưa.',
        color: 'violet',
        note: 'Cách dùng từ "cậy" (hàm ý tin tưởng, gửi gắm thiết tha) và "chịu lời" thể hiện sự thấu hiểu hoàn cảnh éo le của Thúy Vân.',
        createdAt: '2026-11-16T05:10:00.000Z',
      },
    ],
    bookmarks: ['Cảnh ngày xuân', 'Trao duyên'],
    personalNotes:
      'Chú ý phân tích sự chuyển biến tâm cảnh trong 6 câu cuối Cảnh ngày xuân thông qua các từ láy: tà tà, thơ thẩn, thanh thanh, nao nao, nho nhỏ.',
  },
  {
    id: 'doc-tay-tien',
    title: 'Tây Tiến',
    author: 'Quang Dũng',
    category: 'Thơ',
    period: 'Thơ ca kháng chiến chống Pháp (1948)',
    format: 'MD',
    isFavorite: true,
    updatedAt: '2026-11-16T06:15:00.000Z',
    summary:
      'Bài thơ tiêu biểu cho cảm hứng lãng mạn và tinh thần bi tráng, khắc họa bức tượng đài người lính Tây Tiến hào hoa, kiêu dũng giữa núi rừng Tây Bắc.',
    content: `# Tây Tiến — Quang Dũng (1948)

Sông Mã xa rồi Tây Tiến ơi!
Nhớ về rừng núi, nhớ chơi vơi
Sài Khao sương lấp đoàn quân mỏi
Mường Lát hoa về trong đêm hơi

Dốc lên khúc khuỷu dốc thăm thẳm
Heo hút cồn mây, súng ngửi trời
Ngàn thước lên cao, ngàn thước xuống
Nhà ai Pha Luông mưa xa khơi

Anh bạn dãi dầu không bước nữa
Gục lên súng mũ bỏ quên đời!
Chiều chiều oai linh thác gầm thét
Đêm đêm Mường Hịch cọp trêu người
Nhớ ôi Tây Tiến cơm lên khói
Mai Châu mùa em thơm nếp xôi

Doanh trại bừng lên hội đuốc hoa
Kìa em xiêm áo tự bao giờ
Khèn lên man điệu nàng e ấp
Nhạc về Viên Chăn xây hồn thơ

Tây Tiến đoàn binh không mọc tóc
Quân xanh màu lá dữ oai hùm
Mắt trừng gửi mộng qua biên giới
Đêm mơ Hà Nội dáng kiều thơm
Rải rác biên cương mồ viễn xứ
Chiến trường đi chẳng tiếc đời xanh
Áo bào thay chiếu, anh về đất
Sông Mã gầm lên khúc độc hành`,
    highlights: [
      {
        id: 'hl-tt-1',
        quote: 'Nhớ về rừng núi, nhớ chơi vơi',
        color: 'emerald',
        note: 'Vần "ơi" hiệp vần cùng từ láy "chơi vơi" gợi nỗi nhớ mênh mang, sâu lắng bao trùm toàn bộ mạch thơ.',
        createdAt: '2026-11-16T05:20:00.000Z',
      },
      {
        id: 'hl-tt-2',
        quote: 'Tây Tiến đoàn binh không mọc tóc / Quân xanh màu lá dữ oai hùm',
        color: 'rose',
        note: 'Bút pháp hiện thực kết hợp cảm hứng lãng mạn: ngoại hình ốm sốt rét rừng nhưng tư thế làm chủ chiến trường đầy kiêu hãnh.',
        createdAt: '2026-11-16T05:25:00.000Z',
      },
    ],
    bookmarks: ['Khổ 1: Thiên nhiên miền Tây', 'Khổ 3: Tượng đài người lính Tây Tiến'],
    personalNotes:
      'So sánh vẻ đẹp người lính trong Tây Tiến (Quang Dũng) với Đồng chí (Chính Hữu) để làm nổi bật nét hào hoa, lãng mạn của thanh niên trí thức Hà Nội.',
  },
  {
    id: 'doc-chi-pheo',
    title: 'Chí Phèo (Trích đoạn: Buổi sáng sau cơn say & Khát vọng hoàn lương)',
    author: 'Nam Cao',
    category: 'Truyện ngắn',
    period: 'Văn học hiện thực phê phán (1930 – 1945)',
    format: 'TXT',
    isFavorite: true,
    updatedAt: '2026-11-16T06:20:00.000Z',
    summary:
      'Đỉnh cao của văn xuôi hiện thực phê phán Việt Nam trước 1945, phản ánh bi kịch bị tha hóa và bi kịch bị cự tuyệt quyền làm người của người nông dân lương thiện.',
    content: `Khi Chí Phèo mở mắt thì trời đã sáng từ lâu. Mặt trời chắc đã cao, và nắng bên ngoài chắc là rực rỡ. Cứ nghe chim ríu rít bên ngoài đủ biết. Nhưng trong cái lều ẩm thấp vẫn mới chỉ hơi tờ mờ. Ở đây người ta thấy chiều lúc xế trưa và gặp đêm khi bên ngoài vẫn sáng...

Chí Phèo bâng khuâng. Tỉnh dậy hắn thấy già mà vẫn còn cô độc. Buồn thay cho đời! Có lý nào như thế được? Hắn đã già rồi hay sao? Ngoài bốn mươi tuổi đầu... Dẫu sao, đó không phải tuổi mà người ta mới bắt đầu sửa soạn. Hắn đã tới cái dốc bên kia của đời.

Thị Nở đặt bát cháo hành lên chõng. Hắn ngạc nhiên: từ ngày đẻ ra đến giờ, mới có một người đàn bà cho hắn một bát cháo hành. Hắn nhìn bát cháo bốc khói mà lòng thành trẻ con. Hắn thèm lương thiện, hắn muốn làm hòa với mọi người biết bao! Thị Nở sẽ mở đường cho hắn...`,
    highlights: [
      {
        id: 'hl-cp-1',
        quote: 'Hắn thèm lương thiện, hắn muốn làm hòa với mọi người biết bao!',
        color: 'amber',
        note: 'Câu văn kết tinh tư tưởng nhân đạo sâu sắc của Nam Cao: phát hiện bản chất lương thiện không bao giờ mất đi trong tâm hồn người nông dân bị vùi dập.',
        createdAt: '2026-11-16T05:30:00.000Z',
      },
    ],
    bookmarks: ['Tiếng cuộc sống buổi sáng', 'Chi tiết bát cháo hành'],
    personalNotes:
      'Chi tiết bát cháo hành là bước ngoặt cốt truyện vừa giàu ý nghĩa hiện thực vừa mang giá trị biểu tượng nhân văn.',
  },
  {
    id: 'doc-vo-nhat',
    title: 'Vợ nhặt (Trích đoạn: Bữa cơm ngày đói & Hình ảnh lá cờ đỏ)',
    author: 'Kim Lân',
    category: 'Truyện ngắn',
    period: 'Văn học Việt Nam sau 1945 (Viết năm 1954)',
    format: 'TXT',
    isFavorite: false,
    updatedAt: '2026-11-16T06:22:00.000Z',
    summary:
      'Tác phẩm khắc họa tình cảnh thê thảm của người nông dân trong nạn đói năm Ất Dậu 1945 và ngợi ca khát vọng sống, khát vọng hạnh phúc gia đình bất diệt.',
    content: `Bữa cơm ngày đói trông thật thảm hại. Giữa cái mẹt rách có độc một lùm rau chuối thái rối, và một đĩa muối ăn với cháo, nhưng cả nhà đều ăn rất ngon lành. Bà cụ Tứ vừa ăn vừa kể chuyện làm ăn, gia cảnh với con dâu. Bà lão nói toàn chuyện vui, toàn chuyện sung sướng về sau này...

Bà lão đăm đăm nhìn ra ngoài. Bóng tối trùm lấy hai con mắt. Ngoài xa dòng sông sáng trắng uốn khúc trong cánh đồng tối. Mùi đốt đống rấm ở những nhà có người chết theo gió thoảng vào khét lẹt. Bà lão thở nhẹ ra một tiếng...

Tràng nắm lấy bát cháo cám đắng chát và nghẹn bứ trong cổ. Trong óc Tràng vẫn thấy đám người đói và lá cờ đỏ bay phấp phới...`,
    highlights: [],
    bookmarks: ['Bữa cơm ngày đói', 'Kết thúc mở với hình ảnh lá cờ đỏ'],
    personalNotes:
      'Phân tích nghệ thuật xây dựng tình huống truyện "nhặt vợ" đầy éo le, vừa bi vừa hài.',
  },
  {
    id: 'doc-hon-truong-ba',
    title: 'Hồn Trương Ba, da hàng thịt (Trích đoạn đối thoại Hồn và Xác)',
    author: 'Lưu Quang Vũ',
    category: 'Kịch',
    period: 'Kịch nói hiện đại Việt Nam (1981)',
    format: 'MD',
    isFavorite: false,
    updatedAt: '2026-11-16T06:25:00.000Z',
    summary:
      'Vở kịch triết lý sâu sắc về sự thống nhất giữa tâm hồn thanh cao và thể xác, khẳng định con người chỉ thực sự hạnh phúc khi được sống là chính mình.',
    content: `# Trích đoạn Cảnh VII: Đối thoại giữa Hồn Trương Ba và Đế Thích

**Hồn Trương Ba:** Không! Tôi không thể bên trong một đằng, bên ngoài một nẻo được. Tôi muốn được là tôi toàn vẹn!

**Đế Thích:** Thế ông ngỡ tất cả mọi người đều được là mình toàn vẹn cả ư? Ngay cả tôi đây. Ở bên ngoài, tôi đâu có được sống theo những điều tôi nghĩ bên trong...

**Hồn Trương Ba:** Sống nhờ vào đồ đạc, của cải người khác, đã là chuyện không nên, đằng này đến cái thân tôi cũng phải sống nhờ anh hàng thịt. Ông chỉ nghĩ đơn giản là cho tôi sống, nhưng sống như thế nào thì ông chẳng cần biết!`,
    highlights: [
      {
        id: 'hl-htb-1',
        quote: 'Tôi không thể bên trong một đằng, bên ngoài một nẻo được. Tôi muốn được là tôi toàn vẹn!',
        color: 'violet',
        note: 'Tuyên ngôn triết lý cốt lõi của tác phẩm về nhân cách và sự hòa hợp giữa tâm hồn với thể xác.',
        createdAt: '2026-11-16T05:40:00.000Z',
      },
    ],
    bookmarks: ['Đối thoại Hồn Trương Ba – Đế Thích'],
    personalNotes: 'Chú ý xung đột kịch leo thang qua 3 cuộc đối thoại: với Xác, với người thân và với Đế Thích.',
  },
  {
    id: 'doc-tinh-than-yeu-nuoc',
    title: 'Tinh thần yêu nước của nhân dân ta',
    author: 'Hồ Chí Minh',
    category: 'Nghị luận',
    period: 'Văn chính luận cách mạng (1951)',
    format: 'TXT',
    isFavorite: false,
    updatedAt: '2026-11-16T06:28:00.000Z',
    summary:
      'Mẫu mực của văn chính luận hiện đại với bố cục chặt chẽ, lập luận sắc bén, hình ảnh so sánh sinh động làm sáng tỏ truyền thống yêu nước Việt Nam.',
    content: `Dân ta có một lòng nồng nàn yêu nước. Đó là một truyền thống quý báu của ta. Từ xưa đến nay, mỗi khi Tổ quốc bị xâm lăng, thì tinh thần ấy lại sôi nổi, nó kết thành một làn sóng vô cùng mạnh mẽ, to lớn, nó lướt qua mọi sự nguy hiểm, khó khăn, nó nhấn chìm tất cả lũ bán nước và lũ cướp nước.

Lịch sử ta đã có nhiều cuộc kháng chiến vĩ đại chứng tỏ tinh thần yêu nước của dân ta. Chúng ta có quyền tự hào vì những trang lịch sử vẻ vang thời đại Bà Trưng, Bà Triệu, Trần Hưng Đạo, Lê Lợi, Quang Trung...`,
    highlights: [],
    bookmarks: ['Luận điểm mở đầu', 'Chứng minh trong lịch sử và kháng chiến'],
    personalNotes: 'Nghệ thuật lập luận: câu mở đầu thâu tóm vấn đề, hệ thống động từ mạnh "kết thành – lướt qua – nhấn chìm".',
  },
  {
    id: 'doc-phuong-phap-nghi-luan',
    title: 'Chuyên đề: Phương pháp phân tích hình tượng nhân vật trong tác phẩm tự sự',
    author: 'Tổ Chuyên Môn Literature Studio',
    category: 'Tài liệu học tập',
    period: 'Tài liệu Bồi dưỡng Ngữ văn',
    format: 'MD',
    isFavorite: true,
    updatedAt: '2026-11-16T06:30:00.000Z',
    summary:
      'Cẩm nang hướng dẫn lập dàn ý và triển khai luận điểm khi phân tích nhân vật văn học trong truyện ngắn và tiểu thuyết.',
    content: `# Phương pháp phân tích hình tượng nhân vật tự sự

## 1. Xác định vị trí và hoàn cảnh xuất hiện của nhân vật
- Nhân vật trung tâm hay nhân vật phụ?
- Đặt nhân vật trong bối cảnh xã hội, thời đại và tình huống truyện đặc thù.

## 2. Phân tích các phương diện biểu hiện tính cách và nội tâm
- **Ngoại hình**: Chi tiết khắc họa diện mạo gắn với số phận.
- **Hành động & Ngôn ngữ**: Đối thoại và độc thoại nội tâm.
- **Diễn biến tâm lý**: Sự vận động nội tâm qua từng bước ngoặt tình huống.

## 3. Đánh giá nghệ thuật xây dựng nhân vật & Tư tưởng nhà văn
- Điểm nhìn trần thuật (ngôi thứ nhất hay ngôi thứ ba, điểm nhìn bên ngoài hay điểm nhìn nội tâm).
- Thông điệp nhân sinh và giá trị hiện thực – nhân đạo mà tác giả gửi gắm.`,
    highlights: [],
    bookmarks: ['Cấu trúc 3 bước phân tích nhân vật'],
    personalNotes: 'Áp dụng trực tiếp khi phân tích Chí Phèo, Tràng, bà cụ Tứ hoặc Mị.',
  },
];

export const SEED_PLAYLISTS: PlaylistItem[] = [
  {
    id: 'pl-classical-vietnam',
    name: 'Thi Ca & Đàn Tranh Cổ Điển',
    description: 'Nhạc nền êm dịu dành cho giờ đọc Truyện Kiều và thơ cổ điển Việt Nam.',
    trackIds: ['track-kieu-zither', 'track-cello-nocturne'],
    isFavorite: true,
    createdAt: '2026-11-15T12:00:00.000Z',
  },
  {
    id: 'pl-tay-tien-reading',
    name: 'Không Gian Đọc Thơ Kháng Chiến',
    description: 'Âm hưởng núi rừng Tây Bắc và thính phòng sâu lắng cho buổi thuyết trình.',
    trackIds: ['track-tay-tien-ambient', 'track-cello-nocturne'],
    isFavorite: true,
    createdAt: '2026-11-15T14:00:00.000Z',
  },
];

export const SEED_PRESENTATIONS: PresentationDeck[] = [
  {
    id: 'deck-tay-tien',
    title: 'Vẻ đẹp bi tráng và hào hoa trong bài thơ Tây Tiến',
    topic: 'Quang Dũng — Thơ ca kháng chiến chống Pháp (1948)',
    backgroundTrackId: 'track-tay-tien-ambient',
    updatedAt: '2026-11-16T06:10:00.000Z',
    slides: [
      {
        id: 'slide-tt-1',
        title: 'Tây Tiến — Bức tượng đài bất tử về người lính',
        subtitle: 'Tác giả Quang Dũng (1948) · Tập thơ Mây đầu ô',
        bullets: [
          'Sáng tác tại Phù Lưu Chanh năm 1948 khi Quang Dũng rời đoàn quân Tây Tiến.',
          'Kết hợp nhuần nhuyễn cảm hứng lãng mạn và tinh thần bi tráng.',
          'Khắc họa thiên nhiên Tây Bắc vừa hùng vĩ, dữ dội vừa trữ tình, thơ mộng.',
        ],
        speakerNotes:
          'Mở đầu bài thuyết trình bằng việc giới thiệu hoàn cảnh ra đời bài thơ Tây Tiến năm 1948 và mạch cảm xúc chủ đạo là nỗi nhớ "chơi vơi".',
        imageUrl: COVER_IMAGES.tayTien,
        layout: 'title',
      },
      {
        id: 'slide-tt-2',
        title: 'Thiên nhiên miền Tây Bắc hùng vĩ và mỹ lệ',
        bullets: [
          'Địa danh gợi cảm giác xa xôi, heo hút: Sài Khao, Mường Lát, Pha Luông, Mường Hịch.',
          'Đường hành quân hiểm trở: "Dốc lên khúc khuỷu dốc thăm thẳm / Ngàn thước lên cao, ngàn thước xuống".',
          'Nét vẽ mềm mại, ấm áp: "Mường Lát hoa về trong đêm hơi", "Mai Châu mùa em thơm nếp xôi".',
        ],
        quote: 'Sông Mã xa rồi Tây Tiến ơi! / Nhớ về rừng núi, nhớ chơi vơi',
        speakerNotes:
          'Phân tích sự đối lập tương phản giữa thanh trắc gập ghềnh và thanh bằng êm dịu tạo nên bức tranh Tây Bắc đa chiều.',
        layout: 'quote',
      },
      {
        id: 'slide-tt-3',
        title: 'Chân dung người lính Tây Tiến: Hào hùng & Hào hoa',
        bullets: [
          'Ngoại hình hiện thực khắc nghiệt: "không mọc tóc", "quân xanh màu lá" vì sốt rét rừng.',
          'Khí phách kiêu dũng: "dữ oai hùm", "Mắt trừng gửi mộng qua biên giới".',
          'Tâm hồn lãng mạn Hà thành: "Đêm mơ Hà Nội dáng kiều thơm".',
          'Lý tưởng hiến dâng cao cả: "Chiến trường đi chẳng tiếc đời xanh".',
        ],
        speakerNotes:
          'Nhấn mạnh bút pháp không né tránh hiện thực gian khổ nhưng nâng tầm sự hy sinh lên vẻ đẹp cổ điển với hình ảnh "Áo bào thay chiếu".',
        layout: 'analysis',
      },
      {
        id: 'slide-tt-4',
        title: 'Tổng kết nghệ thuật & Câu hỏi tương tác',
        bullets: [
          'Ngôn từ giàu chất nhạc, chất họa; kết hợp từ Hán Việt trang trọng và khẩu ngữ tự nhiên.',
          'Câu hỏi thảo luận 1: Vì sao nói bức chân dung người lính Tây Tiến mang vẻ đẹp bi tráng chứ không bi lụy?',
          'Câu hỏi thảo luận 2: Hãy so sánh nét tâm hồn người lính trong Tây Tiến và Đồng chí.',
        ],
        speakerNotes:
          'Mời cả lớp cùng thảo luận hai câu hỏi tương tác để củng cố bài học. Có thể bật nhạc nền nhẹ nhàng trong lúc trao đổi.',
        layout: 'split',
      },
    ],
  },
];

export const SEED_VIDEOS: VideoItem[] = [
  {
    id: 'video-tay-tien-canvas',
    title: 'Phim Tư Liệu Thi Ca: Hành Quân Tây Tiến (1948)',
    description:
      'Trình diễn thị giác thơ Quang Dũng kèm phụ đề đồng bộ thời gian thực và nhạc nền giao hưởng.',
    duration: 24,
    fileSize: 2457600,
    format: 'Canvas/WebM',
    createdAt: '2026-11-15T15:00:00.000Z',
    isSynthesized: true,
    poemLines: [
      'Sông Mã xa rồi Tây Tiến ơi!',
      'Nhớ về rừng núi, nhớ chơi vơi',
      'Sài Khao sương lấp đoàn quân mỏi',
      'Mường Lát hoa về trong đêm hơi',
      'Dốc lên khúc khuỷu dốc thăm thẳm',
      'Heo hút cồn mây, súng ngửi trời',
      'Tây Tiến đoàn binh không mọc tóc',
      'Quân xanh màu lá dữ oai hùm',
    ],
    subtitles: [
      { start: 0, end: 6, text: 'Sông Mã xa rồi Tây Tiến ơi! Nhớ về rừng núi, nhớ chơi vơi' },
      { start: 6, end: 12, text: 'Sài Khao sương lấp đoàn quân mỏi · Mường Lát hoa về trong đêm hơi' },
      { start: 12, end: 18, text: 'Dốc lên khúc khuỷu dốc thăm thẳm · Heo hút cồn mây, súng ngửi trời' },
      { start: 18, end: 24, text: 'Tây Tiến đoàn binh không mọc tóc · Quân xanh màu lá dữ oai hùm' },
    ],
  },
  {
    id: 'video-truyen-kieu-canvas',
    title: 'Không Gian Truyện Kiều: Cảnh Ngày Xuân & Tiếng Đàn',
    description:
      'Minh họa nghệ thuật thơ lục bát Nguyễn Du với hiệu ứng ánh trăng và lời bình văn học.',
    duration: 20,
    fileSize: 1984000,
    format: 'Canvas/WebM',
    createdAt: '2026-11-15T16:30:00.000Z',
    isSynthesized: true,
    poemLines: [
      'Ngày xuân con én đưa thoi,',
      'Thiều quang chín chục đã ngoài sáu mươi.',
      'Cỏ non xanh tận chân trời,',
      'Cành lê trắng điểm một vài bông hoa.',
      'Nao nao dòng nước uốn quanh,',
      'Dịp cầu nho nhỏ cuối ghềnh bắc ngang.',
    ],
    subtitles: [
      { start: 0, end: 7, text: 'Ngày xuân con én đưa thoi · Thiều quang chín chục đã ngoài sáu mươi' },
      { start: 7, end: 14, text: 'Cỏ non xanh tận chân trời · Cành lê trắng điểm một vài bông hoa' },
      { start: 14, end: 20, text: 'Nao nao dòng nước uốn quanh · Dịp cầu nho nhỏ cuối ghềnh bắc ngang' },
    ],
  },
];
