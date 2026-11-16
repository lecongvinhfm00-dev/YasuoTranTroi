import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  uid: text('uid').primaryKey(), // Firebase Auth UID
  username: text('username').notNull(),
  email: text('email').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role').default('user').notNull(),
  dailyQuota: integer('daily_quota').default(15).notNull(),
  lastLogin: timestamp('last_login').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => profiles.uid)
    .notNull(),
  title: text('title').notNull(),
  mode: text('mode').default('work_analysis').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => conversations.id)
    .notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const aiUsageDaily = pgTable('ai_usage_daily', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => profiles.uid)
    .notNull(),
  usageDate: text('usage_date').notNull(), // YYYY-MM-DD
  requestCount: integer('request_count').default(0).notNull(),
});

export const playlists = pgTable('playlists', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => profiles.uid)
    .notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  trackIds: text('track_ids').default('[]').notNull(),
  isFavorite: integer('is_favorite').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => profiles.uid),
  theme: text('theme').default('dark').notNull(),
  language: text('language').default('vi').notNull(),
  playerSettings: text('player_settings').default('{}').notNull(),
  aiSettings: text('ai_settings').default('{}').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  conversations: many(conversations),
  aiUsage: many(aiUsageDaily),
  playlists: many(playlists),
  settings: one(userSettings, {
    fields: [profiles.uid],
    references: [userSettings.userId],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  author: one(profiles, {
    fields: [conversations.userId],
    references: [profiles.uid],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
