CREATE TABLE IF NOT EXISTS planting_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  cultivar text NOT NULL CHECK (length(trim(cultivar)) BETWEEN 1 AND 120),
  planned_date date NOT NULL,
  irrigation_available boolean NOT NULL DEFAULT false,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planting_plans_user_property_idx
  ON planting_plans (user_id, property_id, planned_date);
