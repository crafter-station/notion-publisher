CREATE TABLE `notion_links` (
	`workspace_id` text NOT NULL,
	`page_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`notion_url` text NOT NULL,
	`remote_edited_at` text NOT NULL,
	`remote_snapshot` text NOT NULL,
	`imported_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `page_id`),
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
