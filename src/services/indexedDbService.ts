import type {
  AudioTrack,
  LiteratureDocument,
  PlaylistItem,
  PresentationDeck,
  VideoItem,
} from '../types/studio.ts';
import {
  createSeedAudioTracks,
  SEED_DOCUMENTS,
  SEED_PLAYLISTS,
  SEED_PRESENTATIONS,
  SEED_VIDEOS,
} from '../data/seedLiterature.ts';

const DB_NAME = 'literature_studio_v2_db';
const DB_VERSION = 1;

export interface StudioActivityLog {
  id: string;
  type: 'music' | 'document' | 'ai' | 'presentation';
  title: string;
  subtitle: string;
  timestamp: string;
}

function openStudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('presentations')) {
        db.createObjectStore('presentations', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('activity')) {
        db.createObjectStore('activity', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openStudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openStudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await openStudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function initializeStudioIndexedDb(): Promise<{
  tracks: AudioTrack[];
  videos: VideoItem[];
  documents: LiteratureDocument[];
  playlists: PlaylistItem[];
  presentations: PresentationDeck[];
  activities: StudioActivityLog[];
}> {
  let tracks = await getAllFromStore<AudioTrack>('tracks');
  if (tracks.length === 0) {
    const seedTracks = createSeedAudioTracks();
    for (const t of seedTracks) {
      await putInStore('tracks', t);
    }
    tracks = seedTracks;
  }

  let videos = await getAllFromStore<VideoItem>('videos');
  if (videos.length === 0) {
    for (const v of SEED_VIDEOS) {
      await putInStore('videos', v);
    }
    videos = SEED_VIDEOS;
  }

  let documents = await getAllFromStore<LiteratureDocument>('documents');
  if (documents.length === 0) {
    for (const d of SEED_DOCUMENTS) {
      await putInStore('documents', d);
    }
    documents = SEED_DOCUMENTS;
  }

  let playlists = await getAllFromStore<PlaylistItem>('playlists');
  if (playlists.length === 0) {
    for (const p of SEED_PLAYLISTS) {
      await putInStore('playlists', p);
    }
    playlists = SEED_PLAYLISTS;
  }

  let presentations = await getAllFromStore<PresentationDeck>('presentations');
  if (presentations.length === 0) {
    for (const pr of SEED_PRESENTATIONS) {
      await putInStore('presentations', pr);
    }
    presentations = SEED_PRESENTATIONS;
  }

  let activities = await getAllFromStore<StudioActivityLog>('activity');
  if (activities.length === 0) {
    const initialActivities: StudioActivityLog[] = [
      {
        id: 'act-1',
        type: 'document',
        title: 'Truyện Kiều (Trao duyên & Cảnh ngày xuân)',
        subtitle: 'Đã mở và thêm 2 ghi chú nghệ thuật',
        timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      },
      {
        id: 'act-2',
        type: 'music',
        title: 'Nguyệt Cầm Đàn Tranh — Cảm hứng Truyện Kiều',
        subtitle: 'Phát nhạc nền chế độ đọc văn bản',
        timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
      {
        id: 'act-3',
        type: 'presentation',
        title: 'Vẻ đẹp bi tráng và hào hoa trong bài thơ Tây Tiến',
        subtitle: 'Bộ slide thuyết trình 4 trang',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
    ];
    for (const a of initialActivities) {
      await putInStore('activity', a);
    }
    activities = initialActivities;
  }

  return {
    tracks,
    videos,
    documents,
    playlists,
    presentations,
    activities: activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  };
}

export const studioStorage = {
  saveTrack: (track: AudioTrack) => putInStore('tracks', track),
  deleteTrack: (id: string) => deleteFromStore('tracks', id),
  saveVideo: (video: VideoItem) => putInStore('videos', video),
  deleteVideo: (id: string) => deleteFromStore('videos', id),
  saveDocument: (doc: LiteratureDocument) => putInStore('documents', doc),
  deleteDocument: (id: string) => deleteFromStore('documents', id),
  savePlaylist: (pl: PlaylistItem) => putInStore('playlists', pl),
  deletePlaylist: (id: string) => deleteFromStore('playlists', id),
  savePresentation: (deck: PresentationDeck) => putInStore('presentations', deck),
  deletePresentation: (id: string) => deleteFromStore('presentations', id),
  logActivity: async (entry: Omit<StudioActivityLog, 'id' | 'timestamp'>) => {
    const item: StudioActivityLog = {
      ...entry,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    await putInStore('activity', item);
    return item;
  },
  estimateStorageBytes: async (): Promise<{
    usedBytes: number;
    quotaBytes: number;
    breakdown: { tracksBytes: number; videosBytes: number; docsBytes: number };
  }> => {
    const tracks = await getAllFromStore<AudioTrack>('tracks');
    const videos = await getAllFromStore<VideoItem>('videos');
    const docs = await getAllFromStore<LiteratureDocument>('documents');

    const tracksBytes = tracks.reduce((acc, t) => acc + (t.fileSize || 0), 0);
    const videosBytes = videos.reduce((acc, v) => acc + (v.fileSize || 0), 0);
    const docsBytes = docs.reduce((acc, d) => acc + new Blob([JSON.stringify(d)]).size, 0);
    const totalCalculated = tracksBytes + videosBytes + docsBytes;

    let quotaBytes = 500 * 1024 * 1024; // 500 MB realistic studio local cap
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota) quotaBytes = Math.min(quotaBytes, est.quota);
      } catch {
        // ignore
      }
    }

    return {
      usedBytes: totalCalculated,
      quotaBytes,
      breakdown: { tracksBytes, videosBytes, docsBytes },
    };
  },
  clearAllAndReset: async () => {
    const db = await openStudioDb();
    const stores = ['tracks', 'videos', 'documents', 'playlists', 'presentations', 'activity'];
    for (const s of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(s, 'readwrite');
        tx.objectStore(s).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    return initializeStudioIndexedDb();
  },
};
