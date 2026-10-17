CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  birth_year INTEGER,
  birth_month INTEGER,
  birth_day INTEGER,
  birth_hour INTEGER,
  birth_minute INTEGER,
  birth_city TEXT,
  gender TEXT,
  bazi_profile_json TEXT,
  final_red_dots_json TEXT
);

CREATE TABLE IF NOT EXISTS exploration_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT NOT NULL,
  evidence_tags_json TEXT NOT NULL,
  confirmed_red_dots_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS diagnosis_drafts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS odyssey_plans (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  top_red_dots_json TEXT NOT NULL,
  direction TEXT NOT NULL,
  plans_json TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
