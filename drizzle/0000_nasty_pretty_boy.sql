CREATE TABLE "actuator_status" (
	"id" text PRIMARY KEY NOT NULL,
	"servo1" text NOT NULL,
	"servo2" text NOT NULL,
	"servo3" text NOT NULL,
	"servo4" text NOT NULL,
	"pump1" boolean DEFAULT false NOT NULL,
	"pump2" boolean DEFAULT false NOT NULL,
	"lcd_message" text DEFAULT 'SYSTEM READY' NOT NULL,
	"buzzer" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"date" text PRIMARY KEY NOT NULL,
	"large" integer DEFAULT 0 NOT NULL,
	"fine" integer DEFAULT 0 NOT NULL,
	"liquid" integer DEFAULT 0 NOT NULL,
	"cycles" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_monthly" (
	"month" text PRIMARY KEY NOT NULL,
	"large" integer DEFAULT 0 NOT NULL,
	"fine" integer DEFAULT 0 NOT NULL,
	"liquid" integer DEFAULT 0 NOT NULL,
	"cycles" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_weekly" (
	"week" text PRIMARY KEY NOT NULL,
	"large" integer DEFAULT 0 NOT NULL,
	"fine" integer DEFAULT 0 NOT NULL,
	"liquid" integer DEFAULT 0 NOT NULL,
	"cycles" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bins_status" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"level" integer NOT NULL,
	"capacity" integer NOT NULL,
	"distance" integer NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "process_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"stage" text NOT NULL,
	"action" text NOT NULL,
	"operator" text NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensor_readings" (
	"sensor_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"distance" integer NOT NULL,
	"fill_percentage" integer NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'Operator' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
