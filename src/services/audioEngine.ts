import type { AudioTrack, DuckingConfig } from '../types/studio.ts';
import { calculateDuckedVolume } from '../utils/studioLogic.ts';

export type RepeatMode = 'off' | 'all' | 'one';

export interface AudioEngineState {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isDucked: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
  duckingConfig: DuckingConfig;
  ttsActive: boolean;
  ttsPaused: boolean;
  ttsVoiceName: string;
  ttsRate: number;
  availableVoices: SpeechSynthesisVoice[];
  hasVietnameseVoice: boolean;
}

type Listener = (state: AudioEngineState) => void;

class MasterAudioEngine {
  private audioEl: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private currentObjectUrl: string | null = null;
  private listeners: Set<Listener> = new Set();

  private state: AudioEngineState = {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isDucked: false,
    repeatMode: 'off',
    shuffle: false,
    duckingConfig: {
      enabled: true,
      duckingLevelPercent: 22,
      fadeDurationMs: 450,
      restoreDurationMs: 650,
    },
    ttsActive: false,
    ttsPaused: false,
    ttsVoiceName: '',
    ttsRate: 1.0,
    availableVoices: [],
    hasVietnameseVoice: false,
  };

  constructor() {
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.audioEl.crossOrigin = 'anonymous';

    this.audioEl.addEventListener('timeupdate', () => {
      this.state.currentTime = this.audioEl.currentTime || 0;
      this.emit();
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
        this.state.duration = this.audioEl.duration;
      }
      this.emit();
    });

    this.audioEl.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.emit();
    });

    this.audioEl.addEventListener('pause', () => {
      this.state.isPlaying = false;
      this.emit();
    });

    this.audioEl.addEventListener('ended', () => {
      this.handleTrackEnded();
    });

    this.initSpeechVoices();
  }

  private initSpeechVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
      this.state.availableVoices = voices;
      this.state.hasVietnameseVoice = Boolean(viVoice);
      if (!this.state.ttsVoiceName && (viVoice || voices[0])) {
        this.state.ttsVoiceName = (viVoice || voices[0]).name;
      }
      this.emit();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  private ensureWebAudioGraph() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
      this.gainNode = this.audioCtx.createGain();
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.82;

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
      this.applyEffectiveVolume(0);
    } catch (err) {
      console.warn('Web Audio API initialization fallback:', err);
    }
  }

  private applyEffectiveVolume(rampMs = 150) {
    const effective = this.state.isMuted
      ? 0
      : calculateDuckedVolume(
          this.state.volume,
          this.state.duckingConfig.duckingLevelPercent,
          this.state.isDucked,
          this.state.duckingConfig.enabled
        );

    if (this.gainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      if (rampMs > 0) {
        this.gainNode.gain.linearRampToValueAtTime(effective, now + rampMs / 1000);
      } else {
        this.gainNode.gain.setValueAtTime(effective, now);
      }
      this.audioEl.volume = 1;
    } else {
      this.audioEl.volume = effective;
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snapshot = { ...this.state };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  public getState(): AudioEngineState {
    return { ...this.state };
  }

  public setQueue(tracks: AudioTrack[], autoLoadFirst = false) {
    this.state.queue = tracks;
    if (autoLoadFirst && tracks.length > 0 && !this.state.currentTrack) {
      this.loadTrack(tracks[0], false);
    }
    this.emit();
  }

  public loadTrack(track: AudioTrack, autoPlay = true) {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    this.state.currentTrack = track;
    this.state.duration = track.duration || 0;
    this.state.currentTime = 0;

    if (track.audioBlob) {
      this.currentObjectUrl = URL.createObjectURL(track.audioBlob);
      this.audioEl.src = this.currentObjectUrl;
    }

    if (autoPlay) {
      this.play();
    } else {
      this.emit();
    }
  }

  public async play() {
    if (!this.state.currentTrack && this.state.queue.length > 0) {
      this.loadTrack(this.state.queue[0], false);
    }
    if (!this.state.currentTrack) return;

    this.ensureWebAudioGraph();
    try {
      await this.audioEl.play();
      this.state.isPlaying = true;
    } catch (err) {
      console.warn('Audio playback requires user interaction:', err);
      this.state.isPlaying = false;
    }
    this.emit();
  }

  public pause() {
    this.audioEl.pause();
    this.state.isPlaying = false;
    this.emit();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public stop() {
    this.audioEl.pause();
    this.audioEl.currentTime = 0;
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.emit();
  }

  public seek(seconds: number) {
    const target = Math.max(0, Math.min(this.state.duration || 0, seconds));
    this.audioEl.currentTime = target;
    this.state.currentTime = target;
    this.emit();
  }

  public setVolume(vol: number) {
    this.state.volume = Math.max(0, Math.min(1, vol));
    if (this.state.volume > 0) {
      this.state.isMuted = false;
    }
    this.applyEffectiveVolume(80);
    this.emit();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    this.applyEffectiveVolume(80);
    this.emit();
  }

  public nextTrack() {
    const { queue, currentTrack, shuffle } = this.state;
    if (queue.length === 0) return;

    if (shuffle && queue.length > 1) {
      const others = queue.filter((t) => t.id !== currentTrack?.id);
      const randomNext = others[Math.floor(Math.random() * others.length)];
      this.loadTrack(randomNext, true);
      return;
    }

    const idx = queue.findIndex((t) => t.id === currentTrack?.id);
    const nextIdx = idx >= 0 ? (idx + 1) % queue.length : 0;
    this.loadTrack(queue[nextIdx], true);
  }

  public previousTrack() {
    if (this.audioEl.currentTime > 3) {
      this.seek(0);
      return;
    }
    const { queue, currentTrack } = this.state;
    if (queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack?.id);
    const prevIdx = idx > 0 ? idx - 1 : queue.length - 1;
    this.loadTrack(queue[prevIdx], true);
  }

  private handleTrackEnded() {
    if (this.state.repeatMode === 'one' && this.state.currentTrack) {
      this.seek(0);
      this.play();
      return;
    }
    const { queue, currentTrack, repeatMode } = this.state;
    const idx = queue.findIndex((t) => t.id === currentTrack?.id);
    if (idx === queue.length - 1 && repeatMode === 'off' && !this.state.shuffle) {
      this.state.isPlaying = false;
      this.state.currentTime = 0;
      this.emit();
      return;
    }
    this.nextTrack();
  }

  public cycleRepeatMode() {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(this.state.repeatMode) + 1) % order.length];
    this.state.repeatMode = next;
    this.emit();
  }

  public toggleShuffle() {
    this.state.shuffle = !this.state.shuffle;
    this.emit();
  }

  public updateDuckingConfig(partial: Partial<DuckingConfig>) {
    this.state.duckingConfig = {
      ...this.state.duckingConfig,
      ...partial,
    };
    this.applyEffectiveVolume(this.state.duckingConfig.fadeDurationMs);
    this.emit();
  }

  /**
   * Engages Audio Ducking (lowers background music volume smoothly when TTS or priority narration plays).
   */
  public engageDucking() {
    this.state.isDucked = true;
    this.applyEffectiveVolume(this.state.duckingConfig.fadeDurationMs);
    this.emit();
  }

  /**
   * Restores background music volume smoothly after TTS or priority narration ends.
   */
  public releaseDucking() {
    this.state.isDucked = false;
    this.applyEffectiveVolume(this.state.duckingConfig.restoreDurationMs);
    this.emit();
  }

  /**
   * Reads real-time frequency & waveform data from the Web Audio API AnalyserNode.
   */
  public getVisualizerData(): { frequencyData: Uint8Array; waveformData: Uint8Array } {
    if (this.analyserNode && this.state.isPlaying) {
      const bufferLength = this.analyserNode.frequencyBinCount;
      const frequencyData = new Uint8Array(bufferLength);
      const waveformData = new Uint8Array(bufferLength);
      this.analyserNode.getByteFrequencyData(frequencyData);
      this.analyserNode.getByteTimeDomainData(waveformData);
      return { frequencyData, waveformData };
    }
    const emptyFreq = new Uint8Array(64);
    const flatWave = new Uint8Array(64).fill(128);
    return { frequencyData: emptyFreq, waveformData: flatWave };
  }

  /**
   * Text-to-Speech (Web Speech API) integrated with Master Bot Player Audio Ducking.
   */
  public speakText(text: string, onEndCallback?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const chosenVoice = this.state.availableVoices.find(
      (v) => v.name === this.state.ttsVoiceName
    );
    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    } else {
      utterance.lang = 'vi-VN';
    }
    utterance.rate = this.state.ttsRate;

    utterance.onstart = () => {
      this.state.ttsActive = true;
      this.state.ttsPaused = false;
      this.engageDucking();
    };

    utterance.onend = () => {
      this.state.ttsActive = false;
      this.state.ttsPaused = false;
      this.releaseDucking();
      onEndCallback?.();
    };

    utterance.onerror = () => {
      this.state.ttsActive = false;
      this.state.ttsPaused = false;
      this.releaseDucking();
    };

    this.state.ttsActive = true;
    this.engageDucking();
    window.speechSynthesis.speak(utterance);
  }

  public pauseTts() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      this.state.ttsPaused = true;
      this.releaseDucking();
    }
  }

  public resumeTts() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      this.state.ttsPaused = false;
      this.engageDucking();
    }
  }

  public stopTts() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.state.ttsActive = false;
      this.state.ttsPaused = false;
      this.releaseDucking();
    }
  }

  public setTtsVoice(voiceName: string) {
    this.state.ttsVoiceName = voiceName;
    this.emit();
  }

  public setTtsRate(rate: number) {
    this.state.ttsRate = Math.max(0.5, Math.min(2.0, rate));
    this.emit();
  }
}

export const masterAudioEngine = new MasterAudioEngine();
