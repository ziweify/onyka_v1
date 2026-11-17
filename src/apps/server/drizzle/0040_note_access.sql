ALTER TABLE `notes` ADD `last_accessed_at` integer;--> statement-breakpoint
CREATE TABLE `note_access_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`accessed_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_access_logs_note_idx` ON `note_access_logs` (`note_id`);--> statement-breakpoint
CREATE INDEX `note_access_logs_note_time_idx` ON `note_access_logs` (`note_id`,`accessed_at`);--> statement-breakpoint
CREATE INDEX `note_access_logs_user_idx` ON `note_access_logs` (`user_id`);
