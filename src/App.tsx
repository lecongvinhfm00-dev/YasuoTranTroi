import { useEffect, useState } from 'react';
import { Menu, Sparkles, CloudCheck, RefreshCw, AlertCircle, BookOpenCheck } from 'lucide-react';
import {
  HealthStatusResponse,
  setMemoryAuthToken,
  studioApiClient,
} from './services/apiClient.ts';
import {
  AudioEngineState,
  masterAudioEngine,
} from './services/audioEngine.ts';
import {
  initializeStudioIndexedDb,
  StudioActivityLog,
  studioStorage,
} from './services/indexedDbService.ts';
import type {
  AIModeId,
  AISettingsConfig,
  AudioTrack,
  ConversationItem,
  LiteratureDocument,
  NavigationModule,
  PersonalNoteItem,
  PlaylistItem,
  PresentationDeck,
  ReadingHistoryItem,
  SyncStatusState,
  TTSSettingsConfig,
  UserProfile,
  VideoItem,
} from './types/studio.ts';
import { parseMarkdownToSlides } from './utils/studioLogic.ts';
import { useAuth } from './context/AuthContext.tsx';
import { fetchUserWorkspaceData, syncUserWorkspaceData } from './lib/userData.ts';
import { VI } from './i18n/vi.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { BottomPlayer } from './components/BottomPlayer.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ReaderView } from './components/ReaderView.tsx';
import { MusicLibraryView } from './components/MusicLibraryView.tsx';
import { VideoPlayerView } from './components/VideoPlayerView.tsx';
import { LiteratureLibraryView } from './components/LiteratureLibraryView.tsx';
import { AIAssistantView } from './components/AIAssistantView.tsx';
import { PlaylistView } from './components/PlaylistView.tsx';
import { NotesView } from './components/NotesView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { PresentationView } from './components/PresentationView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

const DEFAULT_NOTES: PersonalNoteItem[] = [
  {
    id: 'note-seed-1',
    title: 'Nghệ thuật tả cảnh ngụ tình trong Truyện Kiều',
    content:
      'Tám câu cuối đoạn Cảnh ngày xuân và đoạn Kiều ở lầu Ngưng Bích thể hiện bút pháp lấy ngoại cảnh để soi chiếu tâm cảnh của đại thi hào Nguyễn Du.',
    documentId: 'doc-truyen-kieu',
    documentTitle: 'Truyện Kiều (Đoạn trích Trao duyên & Cảnh ngày xuân)',
    tags: ['Truyện Kiều', 'Tả cảnh ngụ tình', 'Trọng tâm'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'note-seed-2',
    title: 'Cảm hứng lãng mạn và bi tráng trong Tây Tiến',
    content:
      'Hình tượng người lính Tây Tiến vừa mang nét hào hoa của thanh niên Hà Nội ("Đêm mơ Hà Nội dáng kiều thơm") vừa mang vẻ đẹp bi tráng bất tử ("Áo bào thay chiếu anh về đất").',
    documentId: 'doc-tay-tien',
    documentTitle: 'Tây Tiến — Quang Dũng',
    tags: ['Tây Tiến', 'Quang Dũng', 'Thơ kháng chiến'],
    updatedAt: new Date().toISOString(),
  },
];

export default function App() {
  const auth = useAuth();
  const [activeModule, setActiveModule] = useState<NavigationModule>('dashboard');
  const [startupModule, setStartupModule] = useState<NavigationModule>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dữ liệu thư viện cục bộ (IndexedDB)
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [documents, setDocuments] = useState<LiteratureDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<LiteratureDocument | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [presentations, setPresentations] = useState<PresentationDeck[]>([]);
  const [activities, setActivities] = useState<StudioActivityLog[]>([]);
  const [storageInfo, setStorageInfo] = useState({
    usedBytes: 0,
    quotaBytes: 500 * 1024 * 1024,
    breakdown: { tracksBytes: 0, videosBytes: 0, docsBytes: 0 },
  });

  // Trạng thái đọc văn bản, ghi chú cá nhân & đồng bộ theo tài khoản ẩn danh
  const [lastDocumentId, setLastDocumentId] = useState<string>('doc-truyen-kieu');
  const [lastSegmentIndex, setLastSegmentIndex] = useState<number>(0);
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteItem[]>(DEFAULT_NOTES);
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem[]>([]);
  const [ttsSettings, setTtsSettings] = useState<TTSSettingsConfig>({
    voiceURI: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    autoNextSegment: true,
    autoScroll: true,
    highlightActive: true,
    fontSize: 'base',
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>('syncing');
  const [sessionToken, setSessionToken] = useState<string>('');

  // Trạng thái bộ xử lý âm thanh
  const [engineState, setEngineState] = useState<AudioEngineState>(
    masterAudioEngine.getState()
  );

  // Tài khoản ẩn danh tự động & AI
  const [user, setUser] = useState<UserProfile>({
    uid: 'anon_initializing',
    username: 'Độc giả Ẩn danh',
    email: 'anonymous@literature.studio',
    role: 'user',
    dailyQuota: 15,
    isAuthenticated: true,
  });
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(15);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [healthStatus, setHealthStatus] = useState<HealthStatusResponse | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettingsConfig>({
    model: 'gemini-4-hydrogen',
    responseLength: 'balanced',
    saveHistory: true,
    streaming: false,
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    return masterAudioEngine.subscribe((nextState) => {
      setEngineState(nextState);
    });
  }, []);

  const refreshStorageStats = async () => {
    const est = await studioStorage.estimateStorageBytes();
    setStorageInfo(est);
  };

  // Khởi tạo IndexedDB
  useEffect(() => {
    let mounted = true;
    initializeStudioIndexedDb().then(async (data) => {
      if (!mounted) return;
      setTracks(data.tracks);
      setVideos(data.videos);
      setDocuments(data.documents);
      setActiveDocument(data.documents[0] || null);
      setPlaylists(data.playlists);
      setPresentations(data.presentations);
      setActivities(data.activities);
      masterAudioEngine.setQueue(data.tracks, true);
      await refreshStorageStats();
    });
    return () => {
      mounted = false;
    };
  }, []);

  const refreshBackendData = async () => {
    try {
      const [health, usage, convs] = await Promise.all([
        studioApiClient.checkHealth(),
        studioApiClient.fetchUsage(),
        studioApiClient.fetchConversations(),
      ]);
      setHealthStatus(health);
      setUser({
        uid: usage.user.uid,
        username: usage.user.username,
        email: usage.user.email,
        role: usage.user.role,
        dailyQuota: usage.studioQuota.limit,
        isAuthenticated: true,
      });
      setQuotaUsed(usage.studioQuota.used);
      setQuotaLimit(usage.studioQuota.limit);
      setConversations(convs);
    } catch {
      // Giữ trạng thái cục bộ khi ngoại tuyến
    }
  };

  // Đồng bộ dữ liệu cá nhân ngay khi AuthContext xác thực thành công session.user.id (UUID)
  useEffect(() => {
    if (!auth.userId) return;
    let mounted = true;
    const activeToken = auth.session?.access_token || `anon_tok_${auth.userId}`;

    (async () => {
      setSyncStatus('syncing');
      setSessionToken(activeToken);
      setMemoryAuthToken(activeToken);
      setUser((prev) => ({
        ...prev,
        uid: auth.userId!,
        username: auth.displayName,
        // Yêu cầu 9: Không cấp quyền Admin hoặc Teacher cho tài khoản ẩn danh
        role: 'user',
        isAuthenticated: true,
      }));

      await refreshBackendData();

      const { data: syncedWorkspace, source } = await fetchUserWorkspaceData(
        auth.userId!,
        activeToken
      );
      if (!mounted) return;

      if (syncedWorkspace) {
        if (syncedWorkspace.lastDocumentId) {
          setLastDocumentId(syncedWorkspace.lastDocumentId);
        }
        if (typeof syncedWorkspace.lastSegmentIndex === 'number') {
          setLastSegmentIndex(syncedWorkspace.lastSegmentIndex);
        }
        if (syncedWorkspace.ttsSettings) {
          setTtsSettings((prev) => ({ ...prev, ...syncedWorkspace.ttsSettings }));
        }
        if (
          Array.isArray(syncedWorkspace.personalNotes) &&
          syncedWorkspace.personalNotes.length > 0
        ) {
          setPersonalNotes(syncedWorkspace.personalNotes);
        }
        if (Array.isArray(syncedWorkspace.readingHistory)) {
          setReadingHistory(syncedWorkspace.readingHistory);
        }
      } else {
        await syncUserWorkspaceData(auth.userId!, activeToken, {
          lastDocumentId: 'doc-truyen-kieu',
          lastSegmentIndex: 0,
          ttsSettings,
          personalNotes: DEFAULT_NOTES,
          readingHistory: [],
        });
      }

      setSyncStatus(source === 'local' ? 'local' : 'synced');
    })();

    return () => {
      mounted = false;
    };
  }, [auth.userId, auth.session?.access_token, auth.displayName]);

  // Hàm đồng bộ dữ liệu cá nhân của người dùng ẩn danh lên máy chủ
  const persistUserWorkspace = async (patch: {
    lastDocumentId?: string;
    lastSegmentIndex?: number;
    ttsSettings?: TTSSettingsConfig;
    personalNotes?: PersonalNoteItem[];
    readingHistory?: ReadingHistoryItem[];
  }) => {
    if (!user.uid || user.uid === 'anon_initializing') return;
    setSyncStatus('syncing');
    const result = await syncUserWorkspaceData(user.uid, sessionToken, {
      lastDocumentId: patch.lastDocumentId ?? lastDocumentId,
      lastSegmentIndex: patch.lastSegmentIndex ?? lastSegmentIndex,
      ttsSettings: patch.ttsSettings ?? ttsSettings,
      personalNotes: patch.personalNotes ?? personalNotes,
      readingHistory: patch.readingHistory ?? readingHistory,
    });
    setSyncStatus(result.ok ? 'synced' : 'error');
  };

  // Cập nhật vị trí đọc văn bản gần nhất & lịch sử đọc
  const handleUpdateReadingPosition = (
    docId: string,
    segmentIndex: number,
    totalSegments: number
  ) => {
    setLastDocumentId(docId);
    setLastSegmentIndex(segmentIndex);
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    const progressPercent = Math.round(((segmentIndex + 1) / Math.max(1, totalSegments)) * 100);
    setReadingHistory((prev) => {
      const existingIdx = prev.findIndex((item) => item.documentId === docId);
      const entry: ReadingHistoryItem = {
        id: `hist-${docId}`,
        documentId: docId,
        documentTitle: doc.title,
        author: doc.author,
        segmentIndex,
        totalSegments,
        progressPercent,
        updatedAt: new Date().toISOString(),
      };
      const next =
        existingIdx >= 0
          ? [entry, ...prev.filter((_, i) => i !== existingIdx)]
          : [entry, ...prev.slice(0, 19)];
      void persistUserWorkspace({
        lastDocumentId: docId,
        lastSegmentIndex: segmentIndex,
        readingHistory: next,
      });
      return next;
    });
  };

  const handleUpdateTTSSettings = (partial: Partial<TTSSettingsConfig>) => {
    setTtsSettings((prev) => {
      const next = { ...prev, ...partial };
      void persistUserWorkspace({ ttsSettings: next });
      return next;
    });
  };

  const handleSavePersonalNote = (note: PersonalNoteItem) => {
    setPersonalNotes((prev) => {
      const exists = prev.some((n) => n.id === note.id);
      const next = exists
        ? prev.map((n) => (n.id === note.id ? note : n))
        : [note, ...prev];
      void persistUserWorkspace({ personalNotes: next });
      return next;
    });
    showToast('Đã lưu và đồng bộ ghi chú cá nhân.');
  };

  const handleDeletePersonalNote = (id: string) => {
    setPersonalNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      void persistUserWorkspace({ personalNotes: next });
      return next;
    });
    showToast('Đã xóa ghi chú cá nhân.');
  };

  // Quản lý Âm nhạc
  const handleAddTrack = async (track: AudioTrack) => {
    await studioStorage.saveTrack(track);
    const next = [track, ...tracks];
    setTracks(next);
    masterAudioEngine.setQueue(next, false);
    const log = await studioStorage.logActivity({
      type: 'music',
      title: track.title,
      subtitle: `Đã thêm bài nhạc (${track.format})`,
    });
    setActivities((prev) => [log, ...prev]);
    await refreshStorageStats();
  };

  const handleUpdateTrack = async (track: AudioTrack) => {
    await studioStorage.saveTrack(track);
    const next = tracks.map((t) => (t.id === track.id ? track : t));
    setTracks(next);
    masterAudioEngine.setQueue(next, false);
    await refreshStorageStats();
  };

  const handleDeleteTracks = async (ids: string[]) => {
    for (const id of ids) {
      await studioStorage.deleteTrack(id);
    }
    const next = tracks.filter((t) => !ids.includes(t.id));
    setTracks(next);
    masterAudioEngine.setQueue(next, false);
    await refreshStorageStats();
    showToast(`Đã xóa ${ids.length} bài nhạc khỏi thư viện.`);
  };

  const handleCreatePlaylistFromTracks = async (name: string, trackIds: string[]) => {
    const newPl: PlaylistItem = {
      id: `pl-${Date.now()}`,
      name,
      description: `Danh sách phát gồm ${trackIds.length} bài nhạc.`,
      trackIds,
      isFavorite: true,
      createdAt: new Date().toISOString(),
    };
    await studioStorage.savePlaylist(newPl);
    setPlaylists((prev) => [newPl, ...prev]);
  };

  // Quản lý Tài liệu Văn học
  const handleSaveDocument = async (doc: LiteratureDocument) => {
    await studioStorage.saveDocument(doc);
    setDocuments((prev) => {
      const exists = prev.some((d) => d.id === doc.id);
      return exists ? prev.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...prev];
    });
    await refreshStorageStats();
  };

  const handleDeleteDocument = async (id: string) => {
    await studioStorage.deleteDocument(id);
    const next = documents.filter((d) => d.id !== id);
    setDocuments(next);
    if (activeDocument?.id === id) {
      setActiveDocument(next[0] || null);
    }
    await refreshStorageStats();
    showToast('Đã xóa tài liệu khỏi thư viện.');
  };

  const handleSendDocumentToAi = async (
    doc: LiteratureDocument,
    promptText: string,
    mode: AIModeId
  ) => {
    setActiveDocument(doc);
    setActiveModule('ai');
    try {
      const res = await studioApiClient.askLiteratureAI({
        prompt: promptText,
        documentContext: doc.content,
        mode,
        model: aiSettings.model,
        responseLength: aiSettings.responseLength,
        saveHistory: true,
      });
      await refreshBackendData();
      showToast(`Đã phân tích "${doc.title}" bằng Gemini (${res.model}).`);
    } catch (err: any) {
      showToast(err?.message || 'Không thể gửi văn bản tới AI.');
    }
  };

  const handleQuickAiSubmit = async (prompt: string) => {
    setActiveModule('ai');
    try {
      await studioApiClient.askLiteratureAI({
        prompt,
        documentContext: activeDocument ? activeDocument.content : undefined,
        mode: 'work_analysis',
        model: aiSettings.model,
        responseLength: aiSettings.responseLength,
        saveHistory: true,
      });
      await refreshBackendData();
      showToast('Đã nhận phản hồi từ Trợ lý Văn học AI.');
    } catch (err: any) {
      showToast(err?.message || 'Yêu cầu AI nhanh không thành công.');
    }
  };

  const handleImportSlidesFromAi = async (markdown: string, title: string) => {
    const slides = parseMarkdownToSlides(markdown, title);
    const newDeck: PresentationDeck = {
      id: `deck-ai-${Date.now()}`,
      title,
      topic: 'Tạo từ hội thoại Trợ lý Văn học AI',
      backgroundTrackId: tracks[0]?.id,
      slides,
      updatedAt: new Date().toISOString(),
    };
    await studioStorage.savePresentation(newDeck);
    setPresentations((prev) => [newDeck, ...prev]);
    setActiveModule('presentation');
    showToast('Đã chuyển nội dung AI thành bộ trang chiếu thuyết trình!');
  };

  const handleExportFullStudioData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: { uid: user.uid, username: user.username },
      documents,
      personalNotes,
      readingHistory,
      playlists,
      presentations,
      ttsSettings,
      aiSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Literature_Studio_Sao_luu_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* Không gian chính: Thanh bên trái + Không gian làm việc trung tâm + Bảng công cụ phải */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          user={user}
          syncStatus={syncStatus}
          quotaRemaining={quotaRemaining}
          quotaLimit={quotaLimit}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Không gian làm việc trung tâm */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Thanh tiêu đề trên cùng */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 sm:gap-6 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 px-3 sm:px-6">
            {/* Khu vực 1: Tên ứng dụng & Nút mở bảng chọn di động */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Mở bảng điều hướng"
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)] lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-xs sm:text-sm font-bold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                {VI.nav[activeModule as keyof typeof VI.nav] || 'Không gian Văn học Số'}
              </span>
            </div>

            {/* Khu vực 2: Liên kết điều hướng nhanh */}
            <nav
              aria-label="Điều hướng nhanh trên thanh tiêu đề"
              className="hidden 2xl:flex items-center gap-4 text-xs font-medium text-[var(--text-muted)]"
            >
              <button
                type="button"
                onClick={() => setActiveModule('dashboard')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeModule === 'dashboard' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Tổng quan
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('reader')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeModule === 'reader' ? 'text-[#E9C878] font-semibold underline underline-offset-4' : ''
                }`}
              >
                Trình đọc văn bản
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('literature')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeModule === 'literature' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Thư viện
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('notes')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeModule === 'notes' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Ghi chú
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('settings')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeModule === 'settings' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Cài đặt
              </button>
            </nav>

            {/* Khu vực 3: Trạng thái đồng bộ & Nút hành động chính */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                data-testid="header-sync-badge"
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] border border-[var(--border-subtle)]"
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="h-3 w-3 text-[#E9C878] animate-spin" />
                    <span className="text-[#E9C878]">{VI.sync.syncing}</span>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <AlertCircle className="h-3 w-3 text-[#F16C78]" />
                    <span className="text-[#F16C78]">{VI.sync.failed}</span>
                  </>
                ) : (
                  <>
                    <CloudCheck className="h-3.5 w-3.5 text-[#36C98F]" />
                    <span className="text-[#36C98F]">{VI.sync.synced}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveModule('reader')}
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-[#E9C878]/15 border border-[#E9C878]/35 px-3 py-2 text-xs font-semibold text-[#E9C878] hover:bg-[#E9C878]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                <span>Đọc văn bản</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('ai')}
                className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Hỏi Trợ lý Văn học</span>
              </button>
            </div>
          </header>

          {/* Thông báo nhanh */}
          {toastMsg && (
            <div className="mx-6 mt-3 rounded-lg bg-[#8275F5]/20 border border-[#8275F5]/40 px-4 py-2 text-xs font-medium text-[var(--text-main)] flex items-center justify-between">
              <span>{toastMsg}</span>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Khung hiển thị chức năng đang chọn */}
          <main className="flex-1 overflow-y-auto p-6">
            {activeModule === 'dashboard' && (
              <DashboardView
                user={user}
                tracks={tracks}
                documents={documents}
                playlists={playlists}
                conversations={conversations}
                activities={activities}
                storageInfo={storageInfo}
                quotaUsed={quotaUsed}
                quotaLimit={quotaLimit}
                geminiHealthy={Boolean(healthStatus?.services.geminiConfigured)}
                onSelectModule={setActiveModule}
                onOpenDocument={(doc) => {
                  setActiveDocument(doc);
                  setLastDocumentId(doc.id);
                  setLastSegmentIndex(0);
                  setActiveModule('reader');
                }}
                onTriggerMediaImport={() => setActiveModule('music')}
                onTriggerCreatePlaylist={() => setActiveModule('playlist')}
              />
            )}

            {activeModule === 'reader' && (
              <ReaderView
                documents={documents}
                selectedDocId={activeDocument?.id || lastDocumentId || documents[0]?.id || ''}
                initialSegmentIndex={lastSegmentIndex}
                ttsSettings={ttsSettings}
                onSelectDoc={(docId) => {
                  const found = documents.find((d) => d.id === docId);
                  if (found) setActiveDocument(found);
                  setLastDocumentId(docId);
                  setLastSegmentIndex(0);
                }}
                onUpdateReadingPosition={handleUpdateReadingPosition}
                onUpdateTTSSettings={handleUpdateTTSSettings}
                onSendToAI={(doc, excerpt) => {
                  const prompt = excerpt
                    ? `Hãy phân tích sâu sắc đoạn trích sau trong tác phẩm "${doc.title}" của ${doc.author}:\n\n"${excerpt}"`
                    : `Hãy phân tích giá trị nội dung và nghệ thuật của tác phẩm "${doc.title}" (${doc.author}).`;
                  void handleSendDocumentToAi(doc, prompt, 'work_analysis');
                }}
                onQuickSaveNote={(title, content, docId) => {
                  const doc = documents.find((d) => d.id === docId);
                  handleSavePersonalNote({
                    id: `note-${Date.now()}`,
                    title,
                    content,
                    documentId: docId,
                    documentTitle: doc?.title,
                    tags: ['Trích đoạn đọc', doc?.category || 'Văn học'],
                    updatedAt: new Date().toISOString(),
                  });
                }}
              />
            )}

            {activeModule === 'music' && (
              <MusicLibraryView
                tracks={tracks}
                engineState={engineState}
                onAddTrack={handleAddTrack}
                onUpdateTrack={handleUpdateTrack}
                onDeleteTracks={handleDeleteTracks}
                onCreatePlaylistFromTracks={handleCreatePlaylistFromTracks}
              />
            )}

            {activeModule === 'video' && (
              <VideoPlayerView
                videos={videos}
                onAddVideo={async (vid) => {
                  await studioStorage.saveVideo(vid);
                  setVideos((prev) => [vid, ...prev]);
                  await refreshStorageStats();
                }}
                onDeleteVideo={async (id) => {
                  await studioStorage.deleteVideo(id);
                  setVideos((prev) => prev.filter((v) => v.id !== id));
                  await refreshStorageStats();
                }}
              />
            )}

            {activeModule === 'literature' && (
              <LiteratureLibraryView
                documents={documents}
                activeDocument={activeDocument}
                engineState={engineState}
                onSelectDocument={setActiveDocument}
                onSaveDocument={handleSaveDocument}
                onDeleteDocument={handleDeleteDocument}
                onSendDocumentToAi={handleSendDocumentToAi}
                onOpenInDedicatedReader={(doc) => {
                  setActiveDocument(doc);
                  setLastDocumentId(doc.id);
                  setLastSegmentIndex(0);
                  setActiveModule('reader');
                }}
              />
            )}

            {activeModule === 'ai' && (
              <AIAssistantView
                conversations={conversations}
                activeDocument={activeDocument}
                aiSettings={aiSettings}
                quotaUsed={quotaUsed}
                quotaLimit={quotaLimit}
                onUpdateAiSettings={setAiSettings}
                onRefreshConversationsAndQuota={refreshBackendData}
                onImportSlidesFromAi={handleImportSlidesFromAi}
              />
            )}

            {activeModule === 'playlist' && (
              <PlaylistView
                playlists={playlists}
                tracks={tracks}
                engineState={engineState}
                onSavePlaylist={async (pl) => {
                  await studioStorage.savePlaylist(pl);
                  setPlaylists((prev) => {
                    const exists = prev.some((p) => p.id === pl.id);
                    return exists
                      ? prev.map((p) => (p.id === pl.id ? pl : p))
                      : [pl, ...prev];
                  });
                }}
                onDeletePlaylist={async (id) => {
                  await studioStorage.deletePlaylist(id);
                  setPlaylists((prev) => prev.filter((p) => p.id !== id));
                }}
              />
            )}

            {activeModule === 'notes' && (
              <NotesView
                notes={personalNotes}
                documents={documents}
                onSaveNote={handleSavePersonalNote}
                onDeleteNote={handleDeletePersonalNote}
                onOpenDocumentInReader={(docId) => {
                  const found = documents.find((d) => d.id === docId);
                  if (found) setActiveDocument(found);
                  setLastDocumentId(docId);
                  setActiveModule('reader');
                }}
              />
            )}

            {activeModule === 'history' && (
              <HistoryView
                readingHistory={readingHistory}
                conversations={conversations}
                recentTracks={tracks}
                onContinueReading={(docId, segIdx) => {
                  const found = documents.find((d) => d.id === docId);
                  if (found) setActiveDocument(found);
                  setLastDocumentId(docId);
                  setLastSegmentIndex(segIdx);
                  setActiveModule('reader');
                }}
                onClearReadingHistory={() => {
                  setReadingHistory([]);
                  void persistUserWorkspace({ readingHistory: [] });
                  showToast('Đã xóa lịch sử đọc văn bản.');
                }}
                onOpenConversation={() => {
                  setActiveModule('ai');
                }}
                onPlayTrack={(track) => {
                  masterAudioEngine.loadTrack(track, true);
                }}
              />
            )}

            {activeModule === 'presentation' && (
              <PresentationView
                presentations={presentations}
                tracks={tracks}
                activeDocument={activeDocument}
                onSavePresentation={async (deck) => {
                  await studioStorage.savePresentation(deck);
                  setPresentations((prev) => {
                    const exists = prev.some((d) => d.id === deck.id);
                    return exists
                      ? prev.map((d) => (d.id === deck.id ? deck : d))
                      : [deck, ...prev];
                  });
                }}
                onDeletePresentation={async (id) => {
                  await studioStorage.deletePresentation(id);
                  setPresentations((prev) => prev.filter((d) => d.id !== id));
                }}
                onRefreshQuota={refreshBackendData}
              />
            )}

            {activeModule === 'settings' && (
              <SettingsView
                theme={theme}
                language={language}
                startupModule={startupModule}
                user={user}
                syncStatus={syncStatus}
                engineState={engineState}
                aiSettings={aiSettings}
                ttsSettings={ttsSettings}
                healthStatus={healthStatus}
                quotaUsed={quotaUsed}
                quotaLimit={quotaLimit}
                storageInfo={storageInfo}
                onToggleTheme={setTheme}
                onChangeLanguage={setLanguage}
                onChangeStartupModule={setStartupModule}
                onUpdateAiSettings={setAiSettings}
                onUpdateTTSSettings={handleUpdateTTSSettings}
                onRefreshHealth={refreshBackendData}
                onResetLocalCache={async () => {
                  const fresh = await studioStorage.clearAllAndReset();
                  setTracks(fresh.tracks);
                  setVideos(fresh.videos);
                  setDocuments(fresh.documents);
                  setPlaylists(fresh.playlists);
                  setPresentations(fresh.presentations);
                  setActivities(fresh.activities);
                  await refreshStorageStats();
                  showToast('Đã xóa bộ nhớ đệm và khôi phục dữ liệu mẫu mặc định.');
                }}
                onExportFullStudioData={handleExportFullStudioData}
                onForceSyncNow={() => persistUserWorkspace({})}
              />
            )}
          </main>
        </div>

        {/* Bảng công cụ ngữ cảnh bên phải */}
        <RightPanel
          engineState={engineState}
          activeDocument={activeDocument}
          activeModule={activeModule}
          onQuickAiSubmit={handleQuickAiSubmit}
          onSelectModule={setActiveModule}
        />
      </div>

      {/* Trình điều khiển âm thanh cố định dưới đáy */}
      <BottomPlayer engineState={engineState} />
    </div>
  );
}
