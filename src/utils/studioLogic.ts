import type { SlideItem } from '../types/studio.ts';

/**
 * Calculates the target gain volume when Audio Ducking is active or inactive.
 */
export function calculateDuckedVolume(
  baseVolume: number,
  duckingLevelPercent: number,
  isDucked: boolean,
  duckingEnabled: boolean
): number {
  const clampedBase = Math.max(0, Math.min(1, baseVolume));
  if (!isDucked || !duckingEnabled) {
    return Number(clampedBase.toFixed(4));
  }
  const clampedDuckPercent = Math.max(5, Math.min(90, duckingLevelPercent));
  const target = clampedBase * (clampedDuckPercent / 100);
  return Number(Math.max(0, Math.min(1, target)).toFixed(4));
}

/**
 * Evaluates user daily AI request quota.
 */
export function evaluateQuotaState(usedToday: number, dailyLimit = 15): {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  usagePercent: number;
  isExhausted: boolean;
} {
  const safeLimit = Math.max(1, dailyLimit);
  const safeUsed = Math.max(0, usedToday);
  const remaining = Math.max(0, safeLimit - safeUsed);
  const usagePercent = Math.min(100, Math.round((safeUsed / safeLimit) * 100));
  return {
    used: safeUsed,
    limit: safeLimit,
    remaining,
    allowed: safeUsed < safeLimit,
    usagePercent,
    isExhausted: remaining === 0,
  };
}

/**
 * Formats a Date into YYYY-MM-DD in UTC/local format for daily quota tracking.
 */
export function formatDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes literary metrics for prose or poetry documents.
 */
export function analyzeLiteraryMetrics(content: string): {
  wordCount: number;
  charCount: number;
  stanzaOrParagraphCount: number;
  lineCount: number;
  estimatedReadingMinutes: number;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      wordCount: 0,
      charCount: 0,
      stanzaOrParagraphCount: 0,
      lineCount: 0,
      estimatedReadingMinutes: 0,
    };
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lines = trimmed.split(/\r?\n/);
  const stanzas = trimmed
    .split(/\r?\n\s*\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    wordCount: words.length,
    charCount: trimmed.length,
    stanzaOrParagraphCount: stanzas.length,
    lineCount: lines.length,
    estimatedReadingMinutes: Math.max(1, Math.ceil(words.length / 180)),
  };
}

export interface TextReadingSegment {
  index: number;
  text: string;
  startCharOffset: number;
  endCharOffset: number;
  isHeading: boolean;
}

/**
 * Splits a long literary text into sequential reading segments (stanzas/paragraphs/sentences <= 360 chars)
 * so Web Speech API never chokes on a single massive utterance and preserves exact original text.
 */
export function splitTextIntoSegments(content: string): TextReadingSegment[] {
  if (!content || !content.trim()) return [];

  const blocks = content.split(/\n\s*\n/);
  const segments: TextReadingSegment[] = [];
  let runningOffset = 0;

  for (const rawBlock of blocks) {
    const trimmed = rawBlock.trim();
    if (!trimmed) {
      runningOffset += rawBlock.length + 2;
      continue;
    }

    const blockStart = content.indexOf(trimmed, runningOffset);
    const actualStart = blockStart >= 0 ? blockStart : runningOffset;
    const isHeading = /^#+\s+/.test(trimmed);
    const displayBlock = trimmed.replace(/^#+\s+/, '').trim();

    if (displayBlock.length <= 360) {
      segments.push({
        index: segments.length,
        text: displayBlock,
        startCharOffset: actualStart,
        endCharOffset: actualStart + trimmed.length,
        isHeading,
      });
    } else {
      // Split very long prose paragraphs on sentence boundaries while keeping text intact
      const sentences = displayBlock.match(/[^.!?]+[.!?]*\s*/g) || [displayBlock];
      let chunk = '';
      let chunkOffset = actualStart;

      for (const sentence of sentences) {
        if ((chunk + sentence).length > 340 && chunk.trim()) {
          segments.push({
            index: segments.length,
            text: chunk.trim(),
            startCharOffset: chunkOffset,
            endCharOffset: chunkOffset + chunk.length,
            isHeading: false,
          });
          chunkOffset += chunk.length;
          chunk = sentence;
        } else {
          chunk += sentence;
        }
      }
      if (chunk.trim()) {
        segments.push({
          index: segments.length,
          text: chunk.trim(),
          startCharOffset: chunkOffset,
          endCharOffset: chunkOffset + chunk.length,
          isHeading: false,
        });
      }
    }

    runningOffset = actualStart + trimmed.length;
  }

  return segments;
}

/**
 * Finds which reading segment corresponds to a character cursor offset in the document.
 */
export function findSegmentIndexAtOffset(
  segments: TextReadingSegment[],
  cursorOffset: number
): number {
  if (segments.length === 0) return 0;
  for (let i = 0; i < segments.length; i++) {
    if (cursorOffset >= segments[i].startCharOffset && cursorOffset <= segments[i].endCharOffset) {
      return i;
    }
  }
  for (let i = segments.length - 1; i >= 0; i--) {
    if (cursorOffset >= segments[i].startCharOffset) {
      return i;
    }
  }
  return 0;
}

/**
 * Parses structured Markdown or AI output into presentation slides.
 */
export function parseMarkdownToSlides(markdown: string, fallbackTitle = 'Bài thuyết trình Văn học'): SlideItem[] {
  const rawSections = markdown
    .split(/(?:^|\n)(?:##+|Trang\s+\d+[:.-]?|Slide\s+\d+[:.-]?)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSections.length === 0) {
    return [
      {
        id: 'slide-1',
        title: fallbackTitle,
        bullets: ['Nội dung thuyết trình đang được cập nhật.'],
        speakerNotes: 'Giới thiệu mở đầu bài thuyết trình.',
        layout: 'title',
      },
    ];
  }

  return rawSections.map((section, idx) => {
    const lines = section
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const rawTitle = (lines[0] || `${fallbackTitle} - Phần ${idx + 1}`).replace(/^[#*-]+\s*/, '');
    const bullets: string[] = [];
    const notesParts: string[] = [];
    let quote = '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^>\s*/.test(line)) {
        quote = line.replace(/^>\s*/, '').replace(/^["“]|["”]$/g, '');
      } else if (/^(?:Ghi chú|Lời dẫn|Speaker Notes)[:：]/i.test(line)) {
        notesParts.push(line.replace(/^(?:Ghi chú|Lời dẫn|Speaker Notes)[:：]\s*/i, ''));
      } else {
        const cleaned = line.replace(/^[-*•\d.)]+\s*/, '');
        if (cleaned) {
          bullets.push(cleaned);
        }
      }
    }

    if (bullets.length === 0) {
      bullets.push(rawTitle);
    }

    const layouts: SlideItem['layout'][] = ['title', 'analysis', 'quote', 'split'];
    const layout = quote ? 'quote' : layouts[idx % layouts.length];

    return {
      id: `slide-${Date.now()}-${idx}`,
      title: rawTitle,
      bullets: bullets.slice(0, 5),
      quote: quote || undefined,
      speakerNotes:
        notesParts.join(' ') ||
        `Trình bày chi tiết về "${rawTitle}". Nhấn mạnh các dẫn chứng nghệ thuật và giá trị tư tưởng.`,
      layout,
    };
  });
}

/**
 * Generates a valid 16-bit PCM RIFF WAVE byte array with warm polyphonic harmonics
 * so the studio has real playable audio files stored in IndexedDB immediately.
 */
export function synthesizeWavBytes(options: {
  durationSec: number;
  sampleRate?: number;
  notesHz: number[];
}): Uint8Array<ArrayBuffer> {
  const sampleRate = options.sampleRate ?? 22050;
  const durationSec = Math.max(0.5, Math.min(30, options.durationSec));
  const numSamples = Math.floor(sampleRate * durationSec);
  const bytesPerSample = 2; // 16-bit mono
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, 1, true); // Mono = 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // 16 bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  const notes = options.notesHz.length > 0 ? options.notesHz : [261.63, 329.63, 392.0];
  const segmentLen = Math.max(1, Math.floor(numSamples / notes.length));

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor(i / segmentLen));
    const freq = notes[noteIdx];
    const localSample = i % segmentLen;
    const localProgress = localSample / segmentLen;

    // Gentle acoustic pluck / warm pad envelope
    const attack = Math.min(1, localSample / (sampleRate * 0.04));
    const decay = Math.exp(-2.6 * localProgress);
    const env = attack * decay;

    // Fundamental + warm octave & fifth harmonics
    const wave =
      0.62 * Math.sin(2 * Math.PI * freq * t) +
      0.24 * Math.sin(2 * Math.PI * (freq * 2) * t) +
      0.14 * Math.sin(2 * Math.PI * (freq * 1.5) * t);

    const sampleVal = Math.max(-1, Math.min(1, wave * env * 0.75));
    view.setInt16(44 + i * 2, Math.floor(sampleVal * 32767), true);
  }

  return new Uint8Array(buffer);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Kiểm tra UUID lấy từ `session.user.id` của Supabase Anonymous Auth (chuẩn RFC 4122).
 */
export function validateSessionUserUuid(uuid: string | null | undefined): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid.trim()
  );
}

/**
 * Đảm bảo tài khoản ẩn danh luôn bị khóa ở quyền 'user' và không bao giờ có quyền Admin hay Teacher.
 */
export function resolveAnonymousPermissions(input: {
  sessionUserId?: string | null;
  isAnonymous?: boolean;
  requestedRole?: string | null;
}): {
  validUuid: boolean;
  role: 'user' | 'teacher' | 'admin';
  canAccessAdmin: boolean;
  canAccessTeacher: boolean;
} {
  const validUuid = validateSessionUserUuid(input.sessionUserId);
  const isAnon = input.isAnonymous !== false;

  if (isAnon) {
    return {
      validUuid,
      role: 'user',
      canAccessAdmin: false,
      canAccessTeacher: false,
    };
  }

  const normalizedRole =
    input.requestedRole === 'admin'
      ? 'admin'
      : input.requestedRole === 'teacher'
      ? 'teacher'
      : 'user';

  return {
    validUuid,
    role: normalizedRole,
    canAccessAdmin: normalizedRole === 'admin',
    canAccessTeacher: normalizedRole === 'admin' || normalizedRole === 'teacher',
  };
}

