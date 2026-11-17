CREATE TABLE `note_share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`note_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`permission` text DEFAULT 'view' NOT NULL,
	`password_hash` text,
	`expires_at` integer,
	`max_views` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`label` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_accessed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `note_share_links_token_unique` ON `note_share_links` (`token`);
--> statement-breakpoint
CREATE INDEX `note_share_links_note_idx` ON `note_share_links` (`note_id`);
--> statement-breakpoint
CREATE INDEX `note_share_links_owner_idx` ON `note_share_links` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `note_share_links_token_idx` ON `note_share_links` (`token`);
