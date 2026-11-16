export type NavigationModule =
  | 'dashboard'
  | 'music'
  | 'video'
  | 'literature'
  | 'ai'
  | 'reader'
  | 'playlist'
  | 'notes'
  | 'history'
  | 'presentation'
  | 'settings';

export type SyncStatusState = 'syncing' | 'synced' | 'error' | 'local';

export type LiteratureCategory =
  | 'Thơ'
  | 'Truyện ngắn'
  | 'Tiểu thuyết'
  | 'Kịch'
  | 'Nghị luận'
  | 'Tài liệu học tập'
  | 'Tài liệu thuyết trình'
  | 'Tài liệu cá nhân';

export type AIModeId =
  | 'work_analysis'
  | 'character_analysis'
  | 'poetry_analysis'
  | 'study_support'
  | 'literary_comparison'
  | 'presentation_assistant';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  fileSize: number; // bytes
  format: string; // MP3, WAV, OGG, M4A, FLAC
  coverUrl: string;
  isFavorite: boolean;
  createdAt: string;
  audioBlob?: Blob;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  duration: number;
  fileSize: number;
  format: string;
  createdAt: string;
  subtitles?: { start: number; end: number; text: string }[];
  videoBlob?: Blob;
  isSynthesized?: boolean;
  poemLines?: string[];
}

export interface DocumentHighlight {
  id: string;
  quote: string;
  color: 'amber' | 'violet' | 'emerald' | 'rose';
  note: string;
  createdAt: string;
}

export interface LiteratureDocument {
  id: string;
  title: string;
  author: string;
  category: LiteratureCategory;
  period: string;
  format: 'TXT' | 'MD' | 'PDF' | 'DOCX';
  content: string;
  summary: string;
  highlights: DocumentHighlight[];
  bookmarks: string[];
  personalNotes: string;
  isFavorite: boolean;
  updatedAt: string;
}

export type AIMode = AIModeId;

export interface PersonalNoteItem {
  id: string;
  title: string;
  documentId?: string;
  documentTitle?: string;
  content: string;
  tags: string[];
  isFavorite?: boolean;
  updatedAt: string;
}

export interface ReadingHistoryItem {
  id: string;
  documentId: string;
  documentTitle: string;
  author: string;
  segmentIndex: number;
  totalSegments: number;
  progressPercent: number;
  updatedAt: string;
  timestamp?: string;
}

export interface TTSSettingsConfig {
  uiLanguage?: 'vi';
  readingLanguage?: 'vi-VN';
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  autoNextSegment: boolean;
  autoAdvance?: boolean;
  autoScroll: boolean;
  highlightActive: boolean;
  highlightCurrentSegment?: boolean;
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  fontSizePx?: number;
}

export interface StudioSettings {
  theme: 'dark' | 'light';
  language: 'vi' | 'en';
  startupModule: NavigationModule;
}

export interface PlaylistItem {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  isFavorite: boolean;
  createdAt: string;
}

export interface SlideItem {
  id: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  quote?: string;
  speakerNotes: string;
  imageUrl?: string;
  audioTrackId?: string;
  layout: 'title' | 'split' | 'quote' | 'analysis';
}

export interface PresentationDeck {
  id: string;
  title: string;
  topic: string;
  slides: SlideItem[];
  backgroundTrackId?: string;
  updatedAt: string;
}

export interface DuckingConfig {
  enabled: boolean;
  duckingLevelPercent: number;
  fadeDurationMs: number;
  restoreDurationMs: number;
}

export interface AISettingsConfig {
  model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  responseLength: 'concise' | 'balanced' | 'deep';
  saveHistory: boolean;
  streaming: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  mode?: AIModeId;
}

export interface ConversationItem {
  id: number | string;
  title: string;
  mode: AIModeId;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role: 'guest' | 'user' | 'admin';
  dailyQuota: number;
  isAuthenticated: boolean;
  authProvider?: 'supabase_anonymous' | 'cloud_anonymous' | 'google';
}
