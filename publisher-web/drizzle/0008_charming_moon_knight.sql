CREATE TABLE `publication_sets` (
	`id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`accounts` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `id`)
);
