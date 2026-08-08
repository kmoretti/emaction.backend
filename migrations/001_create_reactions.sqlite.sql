CREATE TABLE IF NOT EXISTS reactions (
  target_id TEXT NOT NULL CHECK (length(target_id) <= 255),
  reaction_name TEXT NOT NULL CHECK (length(reaction_name) <= 100),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (target_id, reaction_name)
);
CREATE INDEX IF NOT EXISTS idx_reactions_target_id ON reactions (target_id);
