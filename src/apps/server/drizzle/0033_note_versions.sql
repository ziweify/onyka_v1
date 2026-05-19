CREATE TABLE `note_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`note_page_id` text NOT NULL,
	`note_title` text NOT NULL,
	`page_title` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`action` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_page_id`) REFERENCES `note_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `note_versions_page_idx` ON `note_versions` (`note_page_id`);
--> statement-breakpoint
CREATE INDEX `note_versions_page_created_idx` ON `note_versions` (`note_page_id`,`created_at`);
