import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDuckedVolume,
  evaluateQuotaState,
  analyzeLiteraryMetrics,
  parseMarkdownToSlides,
  splitTextIntoSegments,
  findSegmentIndexAtOffset,
  synthesizeWavBytes,
  formatBytes,
  formatDuration,
  validateSessionUserUuid,
  resolveAnonymousPermissions,
} from './studioLogic';

test('calculateDuckedVolume reduces volume accurately when ducking is active', () => {
  assert.equal(calculateDuckedVolume(0.8, 25, true, true), 0.2);
  assert.equal(calculateDuckedVolume(0.8, 25, false, true), 0.8);
  assert.equal(calculateDuckedVolume(0.8, 25, true, false), 0.8);
});

test('evaluateQuotaState enforces 15 daily requests limit accurately', () => {
  const active = evaluateQuotaState(6, 15);
  assert.equal(active.remaining, 9);
  assert.equal(active.allowed, true);
  assert.equal(active.usagePercent, 40);
  assert.equal(active.isExhausted, false);

  const exhausted = evaluateQuotaState(15, 15);
  assert.equal(exhausted.remaining, 0);
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.isExhausted, true);
});

test('analyzeLiteraryMetrics counts words, stanzas, and lines in Vietnamese poetry', () => {
  const poem = `Sông Mã xa rồi Tây Tiến ơi!\nNhớ về rừng núi, nhớ chơi vơi\n\nSài Khao sương lấp đoàn quân mỏi\nMường Lát hoa về trong đêm hơi`;
  const metrics = analyzeLiteraryMetrics(poem);
  assert.equal(metrics.stanzaOrParagraphCount, 2);
  assert.equal(metrics.lineCount, 5);
  assert.equal(metrics.wordCount, 28);
});

test('splitTextIntoSegments and findSegmentIndexAtOffset segment Vietnamese poetry and map cursor offsets', () => {
  const text = `# Cảnh ngày xuân\n\nNgày xuân con én đưa thoi,\nThiều quang chín chục đã ngoài sáu mươi.\n\nCỏ non xanh tận chân trời,\nCành lê trắng điểm một vài bông hoa.`;
  const segments = splitTextIntoSegments(text);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].isHeading, true);
  assert.equal(segments[0].text, 'Cảnh ngày xuân');
  assert.ok(segments[1].text.includes('Ngày xuân con én đưa thoi'));
  assert.ok(segments[2].text.includes('Cỏ non xanh tận chân trời'));

  const offsetInThird = text.indexOf('Cành lê trắng điểm');
  assert.equal(findSegmentIndexAtOffset(segments, offsetInThird), 2);
});

test('parseMarkdownToSlides transforms markdown headings and quotes into slide objects', () => {
  const md = `## Mở đầu: Hoàn cảnh sáng tác Tây Tiến\n- Sáng tác năm 1948 tại Phù Lưu Chanh\n- In trong tập Mây đầu ô\nGhi chú: Nhấn mạnh nỗi nhớ da diết của Quang Dũng.\n\n## Vẻ đẹp thiên nhiên miền Tây\n> Sông Mã xa rồi Tây Tiến ơi\n- Hùng vĩ, dữ dội nhưng thơ mộng`;
  const slides = parseMarkdownToSlides(md, 'Tây Tiến');
  assert.equal(slides.length, 2);
  assert.equal(slides[0].title, 'Mở đầu: Hoàn cảnh sáng tác Tây Tiến');
  assert.equal(slides[0].bullets.length, 2);
  assert.equal(slides[0].speakerNotes, 'Nhấn mạnh nỗi nhớ da diết của Quang Dũng.');
  assert.equal(slides[1].quote, 'Sông Mã xa rồi Tây Tiến ơi');
  assert.equal(slides[1].layout, 'quote');
});

test('synthesizeWavBytes generates valid RIFF WAVE header and PCM payload', () => {
  const wav = synthesizeWavBytes({ durationSec: 1, sampleRate: 8000, notesHz: [440, 554.37] });
  assert.equal(wav.byteLength, 44 + 8000 * 2);
  const header = String.fromCharCode(wav[0], wav[1], wav[2], wav[3]);
  assert.equal(header, 'RIFF');
  const format = String.fromCharCode(wav[8], wav[9], wav[10], wav[11]);
  assert.equal(format, 'WAVE');
});

test('formatBytes and formatDuration format numbers cleanly', () => {
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatDuration(125), '02:05');
});

test('validateSessionUserUuid and resolveAnonymousPermissions enforce UUID v4 and prevent anonymous role escalation', () => {
  const validUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  assert.equal(validateSessionUserUuid(validUuid), true);
  assert.equal(validateSessionUserUuid('not-a-uuid'), false);

  // Anonymous account trying to escalate to admin or teacher is strictly locked to user
  const anonAttemptAdmin = resolveAnonymousPermissions({
    sessionUserId: validUuid,
    isAnonymous: true,
    requestedRole: 'admin',
  });
  assert.equal(anonAttemptAdmin.validUuid, true);
  assert.equal(anonAttemptAdmin.role, 'user');
  assert.equal(anonAttemptAdmin.canAccessAdmin, false);
  assert.equal(anonAttemptAdmin.canAccessTeacher, false);

  const anonAttemptTeacher = resolveAnonymousPermissions({
    sessionUserId: validUuid,
    isAnonymous: true,
    requestedRole: 'teacher',
  });
  assert.equal(anonAttemptTeacher.role, 'user');
  assert.equal(anonAttemptTeacher.canAccessTeacher, false);
});

