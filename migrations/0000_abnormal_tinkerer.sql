CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_name_unique` ON `playlists` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `nameIdx` ON `playlists` (`name`);