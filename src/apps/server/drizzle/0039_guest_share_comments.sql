ALTER TABLE `note_share_links` ADD `allow_guest_comments` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `note_comments` ADD `guest_name` text;
--> statement-breakpoint
ALTER TABLE `note_comments` ADD `share_link_id` text;
--> statement-breakpoint
CREATE INDEX `note_comments_share_link_idx` ON `note_comments` (`share_link_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `users` (
  `id`,
  `username`,
  `password_hash`,
  `name`,
  `email_verified`,
  `avatar_color`,
  `role`,
  `is_disabled`,
  `disabled_reason`,
  `two_factor_enabled`,
  `tracking_enabled`,
  `language`,
  `theme`,
  `dark_theme_base`,
  `light_theme_base`,
  `accent_color`,
  `auto_folder_colors`,
  `editor_font_size`,
  `editor_font_family`,
  `sidebar_collapsed`,
  `sidebar_width`,
  `tags_collapsed`,
  `tags_section_height`,
  `shared_collapsed`,
  `shared_section_height`,
  `focus_editor_width`,
  `onboarding_completed`,
  `created_at`,
  `updated_at`
) VALUES (
  '__onyka_share_guest__',
  '__onyka_share_guest__',
  '!',
  'Guest',
  0,
  'blue',
  'user',
  1,
  'system share guest — cannot log in',
  0,
  0,
  'zh',
  'dark',
  'default',
  'default',
  'amber',
  0,
  'S',
  'plus-jakarta-sans',
  0,
  288,
  0,
  120,
  0,
  150,
  70,
  1,
  1778800000,
  1778800000
);
