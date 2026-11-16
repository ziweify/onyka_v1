-- Preference: auto-assign folder colors from name semantics
ALTER TABLE users ADD COLUMN auto_folder_colors INTEGER NOT NULL DEFAULT 0;
