alter table "public"."candidates" add column "provisioning_token" text;

create index "candidates_provisioning_token_idx" on "public"."candidates" using btree ("provisioning_token");
