import { GoogleGenAI } from '@google/genai';

const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const DEFAULT_MODEL = 'gemini-4-hydrogen';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ. Vui lòng sử dụng POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return res.status(503).json({
      error: 'Chưa cấu hình GEMINI_API_KEY trên môi trường máy chủ Vercel.',
    });
  }

  try {
    const {
      prompt,
      documentContext = '',
      mode = 'work_analysis',
      model = DEFAULT_MODEL,
      responseLength = 'balanced',
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        error: 'Vui lòng nhập câu hỏi hoặc nội dung văn học cần phân tích.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const selectedModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;

    const systemInstruction = [
      'Bạn là Giáo viên Ngữ văn kiêm Chuyên gia Nghiên cứu Văn học của nền tảng LITERATURE STUDIO.',
      'Hãy trả lời hoàn toàn bằng tiếng Việt chuẩn mực, giàu cảm xúc thẩm mỹ, có luận điểm rõ ràng.',
      'Tuyệt đối không tự bịa dẫn chứng văn học không có thật.',
      `Chế độ: ${mode} | Độ dài phản hồi: ${responseLength}`,
    ].join('\n');

    const fullPrompt = documentContext
      ? `Văn bản tài liệu đính kèm:\n"""\n${String(documentContext).slice(0, 15000)}\n"""\n\nYêu cầu của độc giả:\n${prompt.trim()}`
      : prompt.trim();

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: fullPrompt,
      config: { systemInstruction },
    });

    return res.status(200).json({
      reply: response.text || '',
      model: selectedModel,
      mode,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Không thể xử lý yêu cầu AI lúc này: ' + (error?.message || 'Lỗi dịch vụ AI'),
    });
  }
}
