CREATE TABLE IF NOT EXISTS "uploaded_files" (
  "id" serial PRIMARY KEY,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "kind" varchar(30) NOT NULL,
  "pathname" text NOT NULL,
  "blob_url" text NOT NULL,
  "original_name" varchar(255),
  "content_type" varchar(100),
  "size" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "uploaded_files_team_id_idx" ON "uploaded_files" ("team_id");
CREATE INDEX IF NOT EXISTS "uploaded_files_team_kind_idx" ON "uploaded_files" ("team_id","kind");


