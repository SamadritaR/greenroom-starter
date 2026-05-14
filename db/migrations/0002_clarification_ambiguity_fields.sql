ALTER TABLE `clarification` ADD `ambiguity_index` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clarification` ADD `ambiguity_summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clarification` ADD `resolved_at` integer;--> statement-breakpoint
ALTER TABLE `clarification` ADD `resolution_note` text;