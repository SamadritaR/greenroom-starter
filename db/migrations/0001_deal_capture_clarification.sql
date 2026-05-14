CREATE TABLE `deal_capture` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`pasted_email` text DEFAULT '' NOT NULL,
	`extraction_json` text,
	`confirmed_at` integer,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deal_capture_show_id_idx` ON `deal_capture` (`show_id`);--> statement-breakpoint
CREATE TABLE `clarification` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_capture_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`outbound_body` text NOT NULL,
	`mock_inbound_reply` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deal_capture_id`) REFERENCES `deal_capture`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clarification_capture_id_sequence_unique` ON `clarification` (`deal_capture_id`,`sequence`);
