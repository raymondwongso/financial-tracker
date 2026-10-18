CREATE TYPE "public"."chat_card_kind" AS ENUM('account_created', 'transaction_recorded', 'transactions_listed', 'monthly_summary');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "chat_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"kind" "chat_card_kind" NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_cards_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
ALTER TABLE "chat_cards" ADD CONSTRAINT "chat_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_cards" ADD CONSTRAINT "chat_cards_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_cards_user_id_seq_idx" ON "chat_cards" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "chat_cards_message_id_idx" ON "chat_cards" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_messages_user_id_seq_idx" ON "chat_messages" USING btree ("user_id","seq");