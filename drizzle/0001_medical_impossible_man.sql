CREATE TABLE `gateway_users` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`marketing_consent` integer DEFAULT 0 NOT NULL,
	`consent_updated_at` text
);
