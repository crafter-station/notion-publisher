CREATE TABLE `media_upload_parts` (
	`upload_id` text NOT NULL,
	`part_number` integer NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`etag` text,
	PRIMARY KEY(`upload_id`, `part_number`),
	FOREIGN KEY (`upload_id`) REFERENCES `media_uploads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`file_name` text NOT NULL,
	`size` integer NOT NULL,
	`declared_type` text NOT NULL,
	`upload_id` text,
	`state` text NOT NULL,
	`etag` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_upload_idempotency` ON `media_uploads` (`workspace_id`,`idempotency_key`);