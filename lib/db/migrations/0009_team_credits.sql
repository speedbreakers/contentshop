-- Credit allocations per billing period
CREATE TABLE team_credits (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  stripe_subscription_id TEXT,
  
  image_credits_included INTEGER NOT NULL DEFAULT 0,
  text_credits_included INTEGER NOT NULL DEFAULT 0,
  image_credits_used INTEGER NOT NULL DEFAULT 0,
  text_credits_used INTEGER NOT NULL DEFAULT 0,
  image_overage_used INTEGER NOT NULL DEFAULT 0,
  text_overage_used INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX team_credits_team_idx ON team_credits(team_id);
CREATE INDEX team_credits_period_idx ON team_credits(team_id, period_start);

-- Usage records for audit trail
CREATE TABLE usage_records (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  user_id INTEGER REFERENCES users(id),
  team_credits_id INTEGER REFERENCES team_credits(id),
  
  usage_type VARCHAR(20) NOT NULL,
  reference_type VARCHAR(30),
  reference_id INTEGER,
  
  credits_used INTEGER NOT NULL DEFAULT 1,
  is_overage BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_usage_record_id TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX usage_records_team_idx ON usage_records(team_id);
CREATE INDEX usage_records_credits_idx ON usage_records(team_credits_id);

-- Extend teams table
ALTER TABLE teams ADD COLUMN plan_tier VARCHAR(20);
ALTER TABLE teams ADD COLUMN overage_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE teams ADD COLUMN overage_limit_cents INTEGER;
ALTER TABLE teams ADD COLUMN stripe_image_meter_id TEXT;
ALTER TABLE teams ADD COLUMN stripe_text_meter_id TEXT;

