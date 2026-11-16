import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  aiUsageDaily,
  conversations,
  messages,
  playlists,
  profiles,
  userSettings,
} from './schema.ts';

export async function checkDatabaseReady(): Promise<boolean> {
  try {
    await db.select().from(profiles).limit(1);
    return true;
  } catch (error) {
    console.error('Database health query failed:', error);
    return false;
  }
}

export async function getOrCreateProfile(params: {
  uid: string;
  email: string;
  username: string;
  avatarUrl?: string;
  role?: 'guest' | 'user' | 'admin';
}) {
  try {
    const result = await db
      .insert(profiles)
      .values({
        uid: params.uid,
        email: params.email,
        username: params.username,
        avatarUrl: params.avatarUrl ?? null,
        role: params.role ?? 'user',
        dailyQuota: 15,
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: params.email,
          username: params.username,
          avatarUrl: params.avatarUrl ?? null,
          lastLogin: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateProfile:', error);
    throw new Error('Không thể đồng bộ hồ sơ người dùng với cơ sở dữ liệu.', {
      cause: error,
    });
  }
}

export async function getDailyUsageCount(uid: string, usageDate: string): Promise<number> {
  try {
    const rows = await db
      .select()
      .from(aiUsageDaily)
      .where(and(eq(aiUsageDaily.userId, uid), eq(aiUsageDaily.usageDate, usageDate)))
      .limit(1);

    return rows[0]?.requestCount ?? 0;
  } catch (error) {
    console.error('Database query failed in getDailyUsageCount:', error);
    throw new Error('Không thể kiểm tra hạn mức sử dụng AI trong ngày.', {
      cause: error,
    });
  }
}

export async function incrementDailyUsageCount(uid: string, usageDate: string): Promise<number> {
  try {
    const existing = await db
      .select()
      .from(aiUsageDaily)
      .where(and(eq(aiUsageDaily.userId, uid), eq(aiUsageDaily.usageDate, usageDate)))
      .limit(1);

    if (existing.length > 0) {
      const nextCount = existing[0].requestCount + 1;
      await db
        .update(aiUsageDaily)
        .set({ requestCount: nextCount })
        .where(eq(aiUsageDaily.id, existing[0].id));
      return nextCount;
    } else {
      const inserted = await db
        .insert(aiUsageDaily)
        .values({
          userId: uid,
          usageDate,
          requestCount: 1,
        })
        .returning();
      return inserted[0]?.requestCount ?? 1;
    }
  } catch (error) {
    console.error('Database query failed in incrementDailyUsageCount:', error);
    throw new Error('Không thể cập nhật thống kê lượt sử dụng AI.', {
      cause: error,
    });
  }
}

export async function listUserConversations(uid: string) {
  try {
    const convs = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, uid))
      .orderBy(desc(conversations.updatedAt));

    const result = [];
    for (const conv of convs) {
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id));
      result.push({
        id: conv.id,
        title: conv.title,
        mode: conv.mode,
        updatedAt: conv.updatedAt?.toISOString() ?? new Date().toISOString(),
        messages: msgs.map((m) => ({
          id: String(m.id),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
        })),
      });
    }
    return result;
  } catch (error) {
    console.error('Database query failed in listUserConversations:', error);
    throw new Error('Không thể tải lịch sử hội thoại từ cơ sở dữ liệu.', {
      cause: error,
    });
  }
}

export async function saveConversationTurn(params: {
  uid: string;
  conversationId?: number;
  title: string;
  mode: string;
  userPrompt: string;
  assistantReply: string;
}) {
  try {
    let targetConvId = params.conversationId;

    if (targetConvId) {
      const existing = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, targetConvId), eq(conversations.userId, params.uid)))
        .limit(1);
      if (existing.length === 0) {
        targetConvId = undefined;
      } else {
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, targetConvId));
      }
    }

    if (!targetConvId) {
      const created = await db
        .insert(conversations)
        .values({
          userId: params.uid,
          title: params.title.slice(0, 100),
          mode: params.mode,
        })
        .returning();
      targetConvId = created[0].id;
    }

    await db.insert(messages).values([
      {
        conversationId: targetConvId,
        role: 'user',
        content: params.userPrompt,
      },
      {
        conversationId: targetConvId,
        role: 'assistant',
        content: params.assistantReply,
      },
    ]);

    return targetConvId;
  } catch (error) {
    console.error('Database query failed in saveConversationTurn:', error);
    throw new Error('Không thể lưu nội dung hội thoại.', { cause: error });
  }
}

export async function deleteUserConversation(uid: string, conversationId: number) {
  try {
    const existing = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, uid)))
      .limit(1);

    if (existing.length === 0) {
      return false;
    }

    await db.delete(messages).where(eq(messages.conversationId, conversationId));
    await db
      .delete(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, uid)));
    return true;
  } catch (error) {
    console.error('Database query failed in deleteUserConversation:', error);
    throw new Error('Không thể xóa hội thoại.', { cause: error });
  }
}

export async function clearAllUserConversations(uid: string) {
  try {
    const userConvs = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, uid));

    for (const c of userConvs) {
      await db.delete(messages).where(eq(messages.conversationId, c.id));
    }
    await db.delete(conversations).where(eq(conversations.userId, uid));
    return true;
  } catch (error) {
    console.error('Database query failed in clearAllUserConversations:', error);
    throw new Error('Không thể xóa toàn bộ lịch sử hội thoại.', { cause: error });
  }
}

export async function getUserSettingsRecord(uid: string) {
  try {
    const rows = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, uid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserSettingsRecord:', error);
    throw new Error('Không thể tải cài đặt người dùng.', { cause: error });
  }
}

export async function upsertUserSettingsRecord(params: {
  uid: string;
  theme: string;
  language: string;
  playerSettings: string;
  aiSettings: string;
}) {
  try {
    const rows = await db
      .insert(userSettings)
      .values({
        userId: params.uid,
        theme: params.theme,
        language: params.language,
        playerSettings: params.playerSettings,
        aiSettings: params.aiSettings,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          theme: params.theme,
          language: params.language,
          playerSettings: params.playerSettings,
          aiSettings: params.aiSettings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in upsertUserSettingsRecord:', error);
    throw new Error('Không thể lưu cài đặt người dùng.', { cause: error });
  }
}
