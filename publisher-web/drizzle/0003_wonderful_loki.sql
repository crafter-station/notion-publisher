CREATE TABLE `typefully_drafts` (
	`workspace_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`social_set_id` integer NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`receipt` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `draft_id`, `social_set_id`),
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
