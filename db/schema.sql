CREATE TABLE IF NOT EXISTS athletes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  telegram_chat_id TEXT,
  race_name TEXT,
  race_date TEXT,
  training_phase TEXT,
  fitness_profile TEXT,
  constraints TEXT,
  strava_access_token TEXT,
  strava_refresh_token TEXT,
  token_expires_at INTEGER,
  last_activity_sync INTEGER,
  intervals_athlete_id TEXT,
  intervals_api_key TEXT,
  intervals_last_sync INTEGER,
  last_coaching_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL REFERENCES athletes(id),
  week_start_date TEXT NOT NULL,
  focus TEXT,
  monday TEXT,
  tuesday TEXT,
  wednesday TEXT,
  thursday TEXT,
  friday TEXT,
  saturday TEXT,
  sunday TEXT,
  sessions TEXT,           -- JSON array of {id, label, sport, duration_min, pinned_day, description}
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(athlete_id, week_start_date)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER REFERENCES athletes(id),
  date TEXT NOT NULL,
  sport TEXT,
  duration_min INTEGER,
  distance_km REAL,
  avg_hr INTEGER,
  rpe INTEGER,
  notes TEXT,
  strava_id TEXT UNIQUE,
  intervals_id TEXT,
  -- Identity
  name TEXT,
  source TEXT,             -- 'intervals' | 'strava'
  device_name TEXT,
  start_local TEXT,        -- ISO datetime, local TZ
  -- Time
  elapsed_sec INTEGER,
  moving_sec INTEGER,
  -- Distance / speed (raw units for precision)
  distance_m REAL,
  avg_speed_ms REAL,
  max_speed_ms REAL,
  -- HR
  max_hr INTEGER,
  lthr INTEGER,
  resting_hr INTEGER,
  -- Power (cycling)
  avg_power INTEGER,
  normalized_power INTEGER,
  variability_index REAL,
  efficiency_factor REAL,
  decoupling REAL,
  power_load REAL,
  strain_score REAL,
  ftp_at_time INTEGER,
  -- Load
  tss REAL,
  trimp REAL,
  intensity_factor REAL,
  polarization_index REAL,
  atl REAL,
  ctl REAL,
  hr_load REAL,
  pace_load REAL,
  -- Elevation
  elevation_gain_m REAL,
  elevation_loss_m REAL,
  -- Sport-specific
  avg_cadence INTEGER,
  avg_stride REAL,
  pool_length_m REAL,
  lengths INTEGER,
  gap_sec_per_km REAL,
  -- Misc
  calories INTEGER,
  weight_kg REAL,
  -- Analysis
  analysis TEXT,
  analyzed_at TEXT,
  grade TEXT,              -- A/B/C/F coaching grade
  plan_session_id TEXT,    -- matched session id within weekly_plans.sessions for this activity's week
  user_feedback TEXT,      -- Athlete's reply feedback
  user_feedback_at TEXT,   -- When feedback was submitted
  -- Catch-all for any upstream field not promoted to a column
  raw_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Composite unique on intervals_id (strava_id already UNIQUE on its own column)
CREATE UNIQUE INDEX IF NOT EXISTS sessions_intervals_unique
  ON sessions(athlete_id, intervals_id)
  WHERE intervals_id IS NOT NULL;
