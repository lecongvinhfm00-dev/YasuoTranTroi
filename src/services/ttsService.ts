import { splitTextIntoSegments } from '../utils/studioLogic';
import { masterAudioEngine } from './audioEngine';
import { VI } from '../i18n/vi';

export interface VietnameseVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  genderHint: 'Nữ' | 'Nam' | 'Tự nhiên';
  regionHint: string;
  rawVoice: SpeechSynthesisVoice;
}

export interface TTSReaderSnapshot {
  isSupported: boolean;
  hasVietnameseVoice: boolean;
  voices: VietnameseVoiceOption[];
  selectedVoiceURI: string;
  status: 'idle' | 'reading' | 'paused' | 'stopped' | 'error';
  segments: string[];
  currentSegmentIndex: number;
  activeCharIndex: number;
  activeCharLength: number;
  rate: number;
  pitch: number;
  volume: number;
  autoNextSegment: boolean;
  autoScroll: boolean;
  highlightActive: boolean;
  warningMessage: string | null;
  errorMessage: string | null;
}

type TTSListener = (snapshot: TTSReaderSnapshot) => void;

function classifyVoiceMeta(voice: SpeechSynthesisVoice): {
  genderHint: 'Nữ' | 'Nam' | 'Tự nhiên';
  regionHint: string;
} {
  const lower = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let genderHint: 'Nữ' | 'Nam' | 'Tự nhiên' = 'Tự nhiên';
  if (lower.includes('female') || lower.includes('hoaimy') || lower.includes('linh') || lower.includes('nữ') || lower.includes('nu')) {
    genderHint = 'Nữ';
  } else if (lower.includes('male') || lower.includes('namminh') || lower.includes('an') || lower.includes('nam')) {
    genderHint = 'Nam';
  }

  let regionHint = 'Tiếng Việt chuẩn (vi-VN)';
  if (lower.includes('north') || lower.includes('bac') || lower.includes('hanoi')) {
    regionHint = 'Giọng miền Bắc';
  } else if (lower.includes('south') || lower.includes('nam') || lower.includes('saigon') || lower.includes('hcm')) {
    regionHint = 'Giọng miền Nam';
  }

  return { genderHint, regionHint };
}

class VietnameseTTSService {
  private listeners: Set<TTSListener> = new Set();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isInternalCancel = false;

  private state: TTSReaderSnapshot = {
    isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    hasVietnameseVoice: false,
    voices: [],
    selectedVoiceURI: '',
    status: 'idle',
    segments: [],
    currentSegmentIndex: 0,
    activeCharIndex: 0,
    activeCharLength: 0,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    autoNextSegment: true,
    autoScroll: true,
    highlightActive: true,
    warningMessage: null,
    errorMessage: null,
  };

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.refreshVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.refreshVoices();
      };
    } else {
      this.state.warningMessage = VI.tts.noVoiceWarning;
    }
  }

  public refreshVoices(): void {
    if (!this.state.isSupported || typeof window === 'undefined') return;

    const allVoices = window.speechSynthesis.getVoices() || [];
    // Chỉ lọc các giọng đọc thực sự hỗ trợ tiếng Việt (vi, vi-VN, hoặc tên có Vietnamese / Tiếng Việt)
    // Tuyệt đối không lấy giọng tiếng Anh để đọc văn bản tiếng Việt!
    const viVoices = allVoices
      .filter((v) => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.startsWith('vi') || name.includes('vietnam') || name.includes('tiếng việt') || name.includes('tieng viet');
      })
      .map((v): VietnameseVoiceOption => {
        const meta = classifyVoiceMeta(v);
        return {
          voiceURI: v.voiceURI,
          name: v.name,
          lang: v.lang || 'vi-VN',
          localService: v.localService,
          genderHint: meta.genderHint,
          regionHint: meta.regionHint,
          rawVoice: v,
        };
      });

    this.state.voices = viVoices;
    this.state.hasVietnameseVoice = viVoices.length > 0;

    if (viVoices.length > 0) {
      const stillExists = viVoices.some((v) => v.voiceURI === this.state.selectedVoiceURI);
      if (!stillExists) {
        // Ưu tiên giọng Google Tiếng Việt hoặc Microsoft HoaiMy/NamMinh nếu có
        const preferred =
          viVoices.find((v) => v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural')) ||
          viVoices[0];
        this.state.selectedVoiceURI = preferred.voiceURI;
      }
      this.state.warningMessage = null;
    } else {
      this.state.selectedVoiceURI = '';
      this.state.warningMessage = VI.tts.noVoiceWarning;
    }

    this.emit();
  }

  public loadDocumentText(text: string, initialSegmentIndex = 0): void {
    this.stop();
    const rawSegments = splitTextIntoSegments(text);
    const segments = rawSegments.map((s) => s.text);
    const safeIdx = Math.max(0, Math.min(initialSegmentIndex, Math.max(0, segments.length - 1)));
    this.state.segments = segments;
    this.state.currentSegmentIndex = safeIdx;
    this.state.activeCharIndex = 0;
    this.state.activeCharLength = 0;
    this.state.errorMessage = null;
    this.emit();
  }

  public setVoice(voiceURI: string): void {
    if (this.state.voices.some((v) => v.voiceURI === voiceURI)) {
      this.state.selectedVoiceURI = voiceURI;
      this.emit();
      if (this.state.status === 'reading') {
        this.speakSegment(this.state.currentSegmentIndex);
      }
    }
  }

  public setRate(rate: number): void {
    this.state.rate = Math.max(0.5, Math.min(2.0, Number(rate.toFixed(2))));
    this.emit();
    if (this.state.status === 'reading') {
      this.speakSegment(this.state.currentSegmentIndex);
    }
  }

  public setPitch(pitch: number): void {
    this.state.pitch = Math.max(0.5, Math.min(1.5, Number(pitch.toFixed(2))));
    this.emit();
    if (this.state.status === 'reading') {
      this.speakSegment(this.state.currentSegmentIndex);
    }
  }

  public setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, Number(volume.toFixed(2))));
    this.emit();
  }

  public setPreferences(prefs: {
    autoNextSegment?: boolean;
    autoScroll?: boolean;
    highlightActive?: boolean;
    rate?: number;
    pitch?: number;
    volume?: number;
    voiceURI?: string;
  }): void {
    if (prefs.autoNextSegment !== undefined) this.state.autoNextSegment = prefs.autoNextSegment;
    if (prefs.autoScroll !== undefined) this.state.autoScroll = prefs.autoScroll;
    if (prefs.highlightActive !== undefined) this.state.highlightActive = prefs.highlightActive;
    if (prefs.rate !== undefined) this.state.rate = prefs.rate;
    if (prefs.pitch !== undefined) this.state.pitch = prefs.pitch;
    if (prefs.volume !== undefined) this.state.volume = prefs.volume;
    if (prefs.voiceURI && this.state.voices.some((v) => v.voiceURI === prefs.voiceURI)) {
      this.state.selectedVoiceURI = prefs.voiceURI;
    }
    this.emit();
  }

  public selectSegment(index: number, autoPlay = false): void {
    if (index < 0 || index >= this.state.segments.length) return;
    const wasReading = this.state.status === 'reading';
    this.cancelSynthesisOnly();
    this.state.currentSegmentIndex = index;
    this.state.activeCharIndex = 0;
    this.state.activeCharLength = 0;
    if (autoPlay || wasReading) {
      this.speakSegment(index);
    } else {
      this.state.status = 'idle';
      this.emit();
    }
  }

  public play(segmentIndex?: number): void {
    this.refreshVoices();
    const targetIdx =
      typeof segmentIndex === 'number'
        ? Math.max(0, Math.min(segmentIndex, Math.max(0, this.state.segments.length - 1)))
        : this.state.currentSegmentIndex;

    if (this.state.segments.length === 0) {
      this.state.errorMessage = 'Chưa có nội dung văn bản để đọc.';
      this.emit();
      return;
    }

    // Kiểm tra nghiêm ngặt: Không bao giờ tự chọn giọng tiếng Anh để đọc văn bản tiếng Việt
    if (!this.state.hasVietnameseVoice) {
      this.state.status = 'error';
      this.state.warningMessage = VI.tts.noVoiceWarning;
      this.state.errorMessage = `${VI.tts.noVoiceWarning} ${VI.tts.noVoiceGuide}`;
      this.emit();
      return;
    }

    this.speakSegment(targetIdx);
  }

  private speakSegment(index: number): void {
    if (!this.state.isSupported || typeof window === 'undefined') return;
    if (!this.state.hasVietnameseVoice) {
      this.state.status = 'error';
      this.state.warningMessage = VI.tts.noVoiceWarning;
      this.state.errorMessage = `${VI.tts.noVoiceWarning} ${VI.tts.noVoiceGuide}`;
      this.emit();
      return;
    }

    const segmentText = this.state.segments[index];
    if (!segmentText) {
      this.stop();
      return;
    }

    this.cancelSynthesisOnly();

    const utterance = new SpeechSynthesisUtterance(segmentText);
    utterance.lang = 'vi-VN';
    utterance.rate = this.state.rate;
    utterance.pitch = this.state.pitch;
    utterance.volume = this.state.volume;

    const chosenVoice =
      this.state.voices.find((v) => v.voiceURI === this.state.selectedVoiceURI) || this.state.voices[0];
    if (chosenVoice?.rawVoice) {
      utterance.voice = chosenVoice.rawVoice;
    }

    this.state.currentSegmentIndex = index;
    this.state.activeCharIndex = 0;
    this.state.activeCharLength = 0;
    this.state.errorMessage = null;

    utterance.onstart = () => {
      this.state.status = 'reading';
      masterAudioEngine.engageDucking();
      this.emit();
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (typeof event.charIndex === 'number') {
        this.state.activeCharIndex = event.charIndex;
        this.state.activeCharLength = event.charLength || 6;
        this.emit();
      }
    };

    utterance.onend = () => {
      if (this.isInternalCancel) return;
      const nextIndex = index + 1;
      if (this.state.autoNextSegment && nextIndex < this.state.segments.length) {
        this.speakSegment(nextIndex);
      } else {
        this.state.status = 'idle';
        this.state.activeCharIndex = 0;
        this.state.activeCharLength = 0;
        masterAudioEngine.releaseDucking();
        this.emit();
      }
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      if (this.isInternalCancel || event.error === 'canceled' || event.error === 'interrupted') {
        return;
      }
      this.state.status = 'error';
      this.state.errorMessage = 'Không thể phát giọng đọc cho đoạn văn bản này. Vui lòng thử lại.';
      masterAudioEngine.releaseDucking();
      this.emit();
    };

    this.currentUtterance = utterance;
    this.state.status = 'reading';
    masterAudioEngine.engageDucking();
    this.emit();
    window.speechSynthesis.speak(utterance);
  }

  public pause(): void {
    if (!this.state.isSupported || typeof window === 'undefined') return;
    if (this.state.status === 'reading') {
      window.speechSynthesis.pause();
      this.state.status = 'paused';
      masterAudioEngine.releaseDucking();
      this.emit();
    }
  }

  public resume(): void {
    if (!this.state.isSupported || typeof window === 'undefined') return;
    if (this.state.status === 'paused') {
      window.speechSynthesis.resume();
      this.state.status = 'reading';
      masterAudioEngine.engageDucking();
      this.emit();
    } else if (this.state.status === 'idle' || this.state.status === 'stopped') {
      this.play(this.state.currentSegmentIndex);
    }
  }

  public replayCurrentSegment(): void {
    this.play(this.state.currentSegmentIndex);
  }

  public stop(): void {
    this.cancelSynthesisOnly();
    this.state.status = 'stopped';
    this.state.activeCharIndex = 0;
    this.state.activeCharLength = 0;
    masterAudioEngine.releaseDucking();
    this.emit();
  }

  private cancelSynthesisOnly(): void {
    if (!this.state.isSupported || typeof window === 'undefined') return;
    this.isInternalCancel = true;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors
    }
    this.currentUtterance = null;
    this.isInternalCancel = false;
  }

  public getSnapshot(): TTSReaderSnapshot {
    return {
      ...this.state,
      voices: [...this.state.voices],
      segments: [...this.state.segments],
    };
  }

  public subscribe(listener: TTSListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}

export const vietnameseTTS = new VietnameseTTSService();
