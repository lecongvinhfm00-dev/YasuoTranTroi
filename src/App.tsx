import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Menu, Sparkles } from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
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
  PlaylistItem,
  PresentationDeck,
  UserProfile,
  VideoItem,
} from './types/studio.ts';
import { parseMarkdownToSlides } from './utils/studioLogic.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { BottomPlayer } from './components/BottomPlayer.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { MusicLibraryView } from './components/MusicLibraryView.tsx';
import { VideoPlayerView } from './components/VideoPlayerView.tsx';
import { LiteratureLibraryView } from './components/LiteratureLibraryView.tsx';
import { AIAssistantView } from './components/AIAssistantView.tsx';
import { PlaylistView } from './components/PlaylistView.tsx';
import { PresentationView } from './components/PresentationView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

export default function App() {
  const [activeModule, setActiveModule] = useState<NavigationModule>('dashboard');
  const [startupModule, setStartupModule] = useState<NavigationModule>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Studio Data State (IndexedDB)
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

  // Audio Engine State
  const [engineState, setEngineState] = useState<AudioEngineState>(
    masterAudioEngine.getState()
  );

  // Cloud / Backend / AI State
  const [user, setUser] = useState<UserProfile>({
    uid: 'guest_studio',
    username: 'Khách trải nghiệm',
    email: 'guest@literature.studio',
    role: 'guest',
    dailyQuota: 15,
    isAuthenticated: false,
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

  // Sync theme with <html class="dark">
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Subscribe to Master Bot Player
  useEffect(() => {
    return masterAudioEngine.subscribe((nextState) => {
      setEngineState(nextState);
    });
  }, []);

  const refreshStorageStats = async () => {
    const est = await studioStorage.estimateStorageBytes();
    setStorageInfo(est);
  };

  // Initialize IndexedDB data
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
        isAuthenticated: usage.user.isAuthenticated,
      });
      setQuotaUsed(usage.studioQuota.used);
      setQuotaLimit(usage.studioQuota.limit);
      setConversations(convs);
    } catch {
      // Backend fallback when offline
    }
  };

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const token = await fbUser.getIdToken();
        setMemoryAuthToken(token);
      } else {
        setMemoryAuthToken(null);
      }
      await refreshBackendData();
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setMemoryAuthToken(token);
      await refreshBackendData();
      showToast(`Đã đăng nhập thành công: ${cred.user.displayName || cred.user.email}`);
    } catch (err: any) {
      showToast(
        err?.message || 'Đăng nhập Google bị hủy hoặc không khả dụng trong khung xem trước.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setMemoryAuthToken(null);
    await refreshBackendData();
    showToast('Đã đăng xuất về phiên Khách.');
  };

  // Handlers for Music Library
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
    showToast(`Đã xóa ${ids.length} bài nhạc khỏi IndexedDB.`);
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

  // Handlers for Literature Documents
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
    showToast('Đã chuyển nội dung AI thành bộ Slide thuyết trình!');
  };

  const handleExportFullStudioData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      documents,
      playlists,
      presentations,
      aiSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Literature_Studio_Backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* Main Upper Area: Left Sidebar + Center Workspace + Right Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          user={user}
          quotaRemaining={quotaRemaining}
          quotaLimit={quotaLimit}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Center Main Workspace */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Top Bar Contract: 3 Zones */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 sm:gap-8 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 px-3 sm:px-6">
            {/* Zone 1: Single-line Brand / Mobile Menu Trigger */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Mở menu điều hướng"
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)] lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="truncate text-xs sm:text-sm font-bold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                Literature Studio Workspace
              </span>
            </div>

            {/* Zone 2: 5 concise single-line navigation links */}
            <nav
              aria-label="Điều hướng nhanh trên thanh tiêu đề"
              className="hidden md:flex items-center gap-6 text-xs font-medium text-[var(--text-muted)]"
            >
              <button
                type="button"
                onClick={() => setActiveModule('dashboard')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'dashboard' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Tổng quan
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('literature')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'literature' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Tác phẩm
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('music')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'music' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Âm nhạc
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('presentation')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'presentation' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Thuyết trình
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('settings')}
                className={`hover:text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'settings' ? 'text-[var(--text-main)] underline underline-offset-4' : ''
                }`}
              >
                Cài đặt
              </button>
            </nav>

            {/* Zone 3: 1 Primary Action */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setActiveModule('ai')}
                className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Hỏi Trợ lý Văn học</span>
              </button>
            </div>
          </header>

          {/* Toast Notification */}
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

          {/* Active Module Viewport */}
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
                  setActiveModule('literature');
                }}
                onTriggerMediaImport={() => setActiveModule('music')}
                onTriggerCreatePlaylist={() => setActiveModule('playlist')}
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
                engineState={engineState}
                aiSettings={aiSettings}
                healthStatus={healthStatus}
                quotaUsed={quotaUsed}
                quotaLimit={quotaLimit}
                storageInfo={storageInfo}
                onToggleTheme={setTheme}
                onChangeLanguage={setLanguage}
                onChangeStartupModule={setStartupModule}
                onUpdateAiSettings={setAiSettings}
                onSignIn={handleGoogleSignIn}
                onSignOut={handleSignOut}
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
                  showToast('Đã xóa cache và khôi phục dữ liệu mẫu mặc định.');
                }}
                onExportFullStudioData={handleExportFullStudioData}
              />
            )}
          </main>
        </div>

        {/* Right Context Panel */}
        <RightPanel
          engineState={engineState}
          activeDocument={activeDocument}
          activeModule={activeModule}
          onQuickAiSubmit={handleQuickAiSubmit}
          onSelectModule={setActiveModule}
        />
      </div>

      {/* Fixed Bottom Master Bot Player */}
      <BottomPlayer engineState={engineState} />
    </div>
  );
}
