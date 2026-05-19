CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`home_note_id` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`home_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_home_note_idx` ON `attachments` (`home_note_id`);--> statement-breakpoint
CREATE INDEX `attachments_owner_idx` ON `attachments` (`owner_id`);--> statement-breakpoint
CREATE TABLE `note_attachments` (
	`note_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `note_attachments_pk` ON `note_attachments` (`note_id`,`attachment_id`);--> statement-breakpoint
CREATE INDEX `note_attachments_attachment_idx` ON `note_attachments` (`attachment_id`);--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`attachment_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`home_note_id` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`total_size` integer NOT NULL,
	`received_bytes` integer DEFAULT 0 NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `upload_sessions_attachment_idx` ON `upload_sessions` (`attachment_id`);--> statement-breakpoint
CREATE INDEX `upload_sessions_owner_idx` ON `upload_sessions` (`owner_id`);
