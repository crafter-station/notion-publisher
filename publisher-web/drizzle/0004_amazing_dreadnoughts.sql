CREATE TABLE `notion_writes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`page_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`before_snapshot` text NOT NULL,
	`desired_content` text NOT NULL,
	`patch` text NOT NULL,
	`receipt` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notion_writes_active_page` ON `notion_writes` (`workspace_id`,`page_id`) WHERE "notion_writes"."state" IN ('writing', 'uncertain');