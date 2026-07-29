CREATE TABLE `media_assets` (
	`track_id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text DEFAULT 'audio/flac' NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
