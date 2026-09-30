import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

export const members = sqliteTable(
  'members',
  {
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    role: text('role', {
      enum: ['administrator', 'editor', 'approver'],
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

export const drafts = sqliteTable(
  'drafts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    versions: text('versions').notNull().default('{}'),
    channelSettings: text('channel_settings').notNull().default('{}'),
    mediaIds: text('media_ids').notNull().default('[]'),
    publicationSet: text('publication_set').notNull().default('null'),
    status: text('status', { enum: ['draft', 'in_review', 'approved'] })
      .notNull()
      .default('draft'),
    revision: integer('revision').notNull().default(1),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('drafts_workspace_updated').on(table.workspaceId, table.updatedAt),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    workspaceId: text('workspace_id').notNull(),
    email: text('email').notNull(),
    role: text('role', { enum: ['editor', 'approver'] }).notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.email] })],
);

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    access: text('access', { enum: ['read', 'write'] }).notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (t) => [index('tokens_workspace_user').on(t.workspaceId, t.userId)],
);

export const notionLinks = sqliteTable(
  'notion_links',
  {
    workspaceId: text('workspace_id').notNull(),
    pageId: text('page_id').notNull(),
    draftId: text('draft_id')
      .notNull()
      .references(() => drafts.id),
    notionUrl: text('notion_url').notNull(),
    remoteEditedAt: text('remote_edited_at').notNull(),
    remoteSnapshot: text('remote_snapshot').notNull(),
    importedAt: text('imported_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.pageId] })],
);

export const typefullyDrafts = sqliteTable(
  'typefully_drafts',
  {
    workspaceId: text('workspace_id').notNull(),
    draftId: text('draft_id')
      .notNull()
      .references(() => drafts.id),
    socialSetId: integer('social_set_id').notNull(),
    revision: integer('revision').notNull(),
    state: text('state', { enum: ['creating', 'created'] }).notNull(),
    receipt: text('receipt'),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.draftId, t.socialSetId] })],
);

export const notionWrites = sqliteTable(
  'notion_writes',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    pageId: text('page_id').notNull(),
    draftId: text('draft_id')
      .notNull()
      .references(() => drafts.id),
    revision: integer('revision').notNull(),
    state: text('state', {
      enum: ['writing', 'uncertain', 'confirmed', 'cancelled'],
    }).notNull(),
    beforeSnapshot: text('before_snapshot').notNull(),
    desiredContent: text('desired_content').notNull(),
    patch: text('patch').notNull(),
    receipt: text('receipt'),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('notion_writes_active_page')
      .on(t.workspaceId, t.pageId)
      .where(sql`${t.state} IN ('writing', 'uncertain')`),
  ],
);

export const mediaUploads = sqliteTable('media_uploads', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  draftId: text('draft_id').notNull().references(() => drafts.id),
  idempotencyKey: text('idempotency_key').notNull(),
  fileName: text('file_name').notNull(),
  size: integer('size').notNull(),
  declaredType: text('declared_type').notNull(),
  uploadId: text('upload_id'),
  state: text('state', { enum: ['creating', 'uploading', 'completing', 'ready', 'aborted'] }).notNull(),
  etag: text('etag'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
}, t => [uniqueIndex('media_upload_idempotency').on(t.workspaceId, t.idempotencyKey)]);

export const mediaUploadParts = sqliteTable('media_upload_parts', {
  uploadId: text('upload_id').notNull().references(() => mediaUploads.id),
  partNumber: integer('part_number').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  etag: text('etag'),
}, t => [primaryKey({ columns: [t.uploadId, t.partNumber] })]);

export const publicationSets = sqliteTable('publication_sets', {
  id: text('id').notNull(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  accounts: text('accounts').notNull().default('[]'),
  revision: integer('revision').notNull().default(1),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({ columns: [t.workspaceId, t.id] })]);
