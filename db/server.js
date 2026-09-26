const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DB_PATH = process.env.DB_PATH || './tricoach.db';
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('API_KEY is not set — refusing to start unauthenticated');
  process.exit(1);
}

// Init DB and run schema
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Idempotently add any new sessions columns introduced after the table was first created.
// SQLite has no `ADD COLUMN IF NOT EXISTS`, so we diff against PRAGMA table_info.
const SESSION_COLUMNS = [
  ['name', 'TEXT'], ['source', 'TEXT'], ['device_name', 'TEXT'], ['start_local', 'TEXT'],
  ['elapsed_sec', 'INTEGER'], ['moving_sec', 'INTEGER'],
  ['distance_m', 'REAL'], ['avg_speed_ms', 'REAL'], ['max_speed_ms', 'REAL'],
  ['max_hr', 'INTEGER'], ['lthr', 'INTEGER'], ['resting_hr', 'INTEGER'],
  ['avg_power', 'INTEGER'], ['normalized_power', 'INTEGER'], ['variability_index', 'REAL'],
  ['efficiency_factor', 'REAL'], ['decoupling', 'REAL'], ['power_load', 'REAL'],
  ['strain_score', 'REAL'], ['ftp_at_time', 'INTEGER'],
  ['tss', 'REAL'], ['trimp', 'REAL'], ['intensity_factor', 'REAL'],
  ['polarization_index', 'REAL'], ['atl', 'REAL'], ['ctl', 'REAL'],
  ['hr_load', 'REAL'], ['pace_load', 'REAL'],
  ['elevation_gain_m', 'REAL'], ['elevation_loss_m', 'REAL'],
  ['avg_cadence', 'INTEGER'], ['avg_stride', 'REAL'],
  ['pool_length_m', 'REAL'], ['lengths', 'INTEGER'], ['gap_sec_per_km', 'REAL'],
  ['calories', 'INTEGER'], ['weight_kg', 'REAL'],
  ['analysis', 'TEXT'], ['analyzed_at', 'TEXT'], ['raw_json', 'TEXT'],
  ['grade', 'TEXT'], ['user_feedback', 'TEXT'], ['user_feedback_at', 'TEXT'],
  ['plan_session_id', 'TEXT'],
];
const existing = new Set(db.pragma('table_info(sessions)').map(c => c.name));
for (const [col, type] of SESSION_COLUMNS) {
  if (!existing.has(col)) db.exec(`ALTER TABLE sessions ADD COLUMN ${col} ${type}`);
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS sessions_intervals_unique
  ON sessions(athlete_id, intervals_id) WHERE intervals_id IS NOT NULL`);

// Idempotently add any new athletes columns introduced after the table was first created.
const ATHLETE_COLUMNS = [
  ['goal', 'TEXT'],
  ['health_status', 'TEXT'],
  ['training_principles', 'TEXT'],
];
const existingAthleteCols = new Set(db.pragma('table_info(athletes)').map(c => c.name));
for (const [col, type] of ATHLETE_COLUMNS) {
  if (!existingAthleteCols.has(col)) db.exec(`ALTER TABLE athletes ADD COLUMN ${col} ${type}`);
}

// Idempotently add new weekly_plans columns.
const PLAN_COLUMNS = [['sessions', 'TEXT']];
const existingPlanCols = new Set(db.pragma('table_info(weekly_plans)').map(c => c.name));
for (const [col, type] of PLAN_COLUMNS) {
  if (!existingPlanCols.has(col)) db.exec(`ALTER TABLE weekly_plans ADD COLUMN ${col} ${type}`);
}

// Map DB rows to Airtable-compatible field names so existing n8n expressions work unchanged
function toAthleteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    Name: row.name,
    Phone: row.phone,
    'Race Name': row.race_name,
    'Race Date': row.race_date,
    'Training Phase': row.training_phase,
    'Fitness Profile': row.fitness_profile,
    Constraints: row.constraints,
    Goal: row.goal,
    'Health Status': row.health_status,
    'Training Principles': row.training_principles,
    'Strava Access Token': row.strava_access_token,
    'Strava Refresh Token': row.strava_refresh_token,
    'Token Expires At': row.token_expires_at,
    'Last Activity Sync': row.last_activity_sync,
    'Intervals.icu Athlete ID': row.intervals_athlete_id,
    'Intervals.icu API Key': row.intervals_api_key,
    'Intervals.icu Last Sync': row.intervals_last_sync,
    'Last Coaching Date': row.last_coaching_date,
  };
}

function toPlanRow(row) {
  if (!row) return null;
  let sessions = null;
  if (row.sessions) {
    try { sessions = JSON.parse(row.sessions); } catch (_) { sessions = null; }
  }
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    'Week Start Date': row.week_start_date,
    Focus: row.focus,
    sessions,
    Monday: row.monday,
    Tuesday: row.tuesday,
    Wednesday: row.wednesday,
    Thursday: row.thursday,
    Friday: row.friday,
    Saturday: row.saturday,
    Sunday: row.sunday,
    created_at: row.created_at,
  };
}

function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.use(auth);

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Athletes ─────────────────────────────────────────────────────────────────

app.get('/athletes', (req, res) => {
  const rows = db.prepare('SELECT * FROM athletes').all();
  res.json(rows.map(toAthleteRow));
});

app.get('/athletes/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM athletes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(toAthleteRow(row));
});

app.put('/athletes/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM athletes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const allowed = [
    'name', 'phone', 'telegram_chat_id', 'race_name', 'race_date', 'training_phase',
    'fitness_profile', 'constraints', 'goal', 'health_status', 'training_principles',
    'strava_access_token', 'strava_refresh_token',
    'token_expires_at', 'last_activity_sync', 'intervals_athlete_id', 'intervals_api_key',
    'intervals_last_sync', 'last_coaching_date'
  ];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });

  updates.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE athletes SET ${sets} WHERE id = @id`).run({ ...updates, id: req.params.id });
  res.json(toAthleteRow(db.prepare('SELECT * FROM athletes WHERE id = ?').get(req.params.id)));
});

// ── Weekly Plans ──────────────────────────────────────────────────────────────

app.get('/weekly-plans/latest', (req, res) => {
  const { athlete_id } = req.query;
  if (!athlete_id) return res.status(400).json({ error: 'athlete_id required' });
  const row = db.prepare(
    'SELECT * FROM weekly_plans WHERE athlete_id = ? ORDER BY week_start_date DESC LIMIT 1'
  ).get(athlete_id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(toPlanRow(row));
});

app.get('/weekly-plans', (req, res) => {
  const { athlete_id, week_start_date } = req.query;
  if (!athlete_id) return res.status(400).json({ error: 'athlete_id required' });

  let stmt, args;
  if (week_start_date) {
    stmt = 'SELECT * FROM weekly_plans WHERE athlete_id = ? AND week_start_date = ?';
    args = [athlete_id, week_start_date];
  } else {
    stmt = 'SELECT * FROM weekly_plans WHERE athlete_id = ? ORDER BY week_start_date DESC';
    args = [athlete_id];
  }
  res.json(db.prepare(stmt).all(...args).map(toPlanRow));
});

app.post('/weekly-plans', (req, res) => {
  const { athlete_id, week_start_date, focus, sessions,
    monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;
  if (!athlete_id || !week_start_date) return res.status(400).json({ error: 'athlete_id and week_start_date required' });

  const sessionsJson = sessions == null ? null
    : (typeof sessions === 'string' ? sessions : JSON.stringify(sessions));

  db.prepare(`
    INSERT INTO weekly_plans (athlete_id, week_start_date, focus, sessions, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
    VALUES (@athlete_id, @week_start_date, @focus, @sessions, @monday, @tuesday, @wednesday, @thursday, @friday, @saturday, @sunday)
    ON CONFLICT(athlete_id, week_start_date) DO UPDATE SET
      focus = excluded.focus, sessions = excluded.sessions,
      monday = excluded.monday, tuesday = excluded.tuesday,
      wednesday = excluded.wednesday, thursday = excluded.thursday, friday = excluded.friday,
      saturday = excluded.saturday, sunday = excluded.sunday
  `).run({ athlete_id, week_start_date,
    focus: focus || null, sessions: sessionsJson,
    monday: monday || null, tuesday: tuesday || null,
    wednesday: wednesday || null, thursday: thursday || null, friday: friday || null,
    saturday: saturday || null, sunday: sunday || null });

  const row = db.prepare('SELECT * FROM weekly_plans WHERE athlete_id = ? AND week_start_date = ?')
    .get(athlete_id, week_start_date);
  res.status(201).json(toPlanRow(row));
});

app.delete('/weekly-plans/:id', (req, res) => {
  const result = db.prepare('DELETE FROM weekly_plans WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── Sessions ──────────────────────────────────────────────────────────────────

app.get('/sessions', (req, res) => {
  const { athlete_id, limit = 50, date_from, date_to, wrap, has_analysis } = req.query;
  if (!athlete_id) return res.status(400).json({ error: 'athlete_id required' });

  let sql = 'SELECT * FROM sessions WHERE athlete_id = ?';
  const args = [athlete_id];
  if (date_from) { sql += ' AND date >= ?'; args.push(date_from); }
  if (date_to) { sql += ' AND date <= ?'; args.push(date_to); }
  if (has_analysis === '1') { sql += ' AND analyzed_at IS NOT NULL'; }
  sql += ' ORDER BY date DESC, analyzed_at DESC LIMIT ?';
  args.push(Math.min(Math.max(Number(limit) || 50, 1), 1000));

  const results = db.prepare(sql).all(...args);
  if (wrap === '1') return res.json({ sessions: results, count: results.length });
  res.json(results);
});

// GET /sessions/:id — single session (used by the 🎓 Explain callback branch)
app.get('/sessions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

// Columns settable via POST /sessions (everything except id and created_at).
const POST_FIELDS = [
  'athlete_id', 'date', 'sport', 'duration_min', 'distance_km', 'avg_hr', 'rpe', 'notes',
  'strava_id', 'intervals_id',
  'name', 'source', 'device_name', 'start_local',
  'elapsed_sec', 'moving_sec',
  'distance_m', 'avg_speed_ms', 'max_speed_ms',
  'max_hr', 'lthr', 'resting_hr',
  'avg_power', 'normalized_power', 'variability_index',
  'efficiency_factor', 'decoupling', 'power_load', 'strain_score', 'ftp_at_time',
  'tss', 'trimp', 'intensity_factor', 'polarization_index', 'atl', 'ctl',
  'hr_load', 'pace_load',
  'elevation_gain_m', 'elevation_loss_m',
  'avg_cadence', 'avg_stride', 'pool_length_m', 'lengths', 'gap_sec_per_km',
  'calories', 'weight_kg',
  'analysis', 'analyzed_at', 'raw_json',
  'grade', 'user_feedback', 'user_feedback_at',
];

app.post('/sessions', (req, res) => {
  const { athlete_id, date, intervals_id, strava_id } = req.body;
  if (!athlete_id || !date) return res.status(400).json({ error: 'athlete_id and date required' });

  // Build payload from allowed fields, defaulting missing to null
  const payload = {};
  for (const k of POST_FIELDS) payload[k] = req.body[k] ?? null;

  // Upsert path: prefer matching by intervals_id (most activities), else strava_id.
  // Composite unique on (athlete_id, intervals_id) handles the intervals case.
  const allCols = POST_FIELDS.join(', ');
  const placeholders = POST_FIELDS.map(k => '@' + k).join(', ');
  // Don't clobber LLM/user-generated fields on re-upsert — only the analysis flow
  // (PATCH /sessions/:id) is allowed to write these.
  const PRESERVE_ON_UPSERT = new Set([
    'athlete_id', 'intervals_id', 'strava_id',
    'analysis', 'analyzed_at', 'grade',
    'rpe', 'notes', 'user_feedback', 'user_feedback_at',
  ]);
  const updateSet = POST_FIELDS.filter(k => !PRESERVE_ON_UPSERT.has(k))
    .map(k => `${k} = excluded.${k}`).join(', ');

  // Note: partial unique index on (athlete_id, intervals_id) requires the
  // matching WHERE clause to be repeated in the conflict target.
  let conflictTarget = null;
  if (intervals_id) conflictTarget = '(athlete_id, intervals_id) WHERE intervals_id IS NOT NULL';
  else if (strava_id) conflictTarget = '(strava_id)';

  const sql = conflictTarget
    ? `INSERT INTO sessions (${allCols}) VALUES (${placeholders})
       ON CONFLICT${conflictTarget} DO UPDATE SET ${updateSet}
       RETURNING id, analyzed_at`
    : `INSERT INTO sessions (${allCols}) VALUES (${placeholders}) RETURNING id, analyzed_at`;

  try {
    const row = db.prepare(sql).get(payload);
    res.status(201).json({ id: row.id, analyzed_at: row.analyzed_at });
  } catch (e) {
    console.error('POST /sessions failed:', e.message);
    res.status(400).json({ error: 'invalid request' });
  }
});

// PATCH /sessions/:id — used to attach Claude analysis after coaching runs
app.patch('/sessions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  // Only allow these fields to be patched
  const PATCH_FIELDS = ['analysis', 'analyzed_at', 'grade', 'rpe', 'notes', 'user_feedback', 'user_feedback_at', 'plan_session_id'];
  const sets = [];
  const args = { id };
  for (const k of PATCH_FIELDS) {
    if (k in req.body) {
      sets.push(`${k} = @${k}`);
      args[k] = req.body[k];
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'no patchable fields supplied' });

  try {
    const result = db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = @id`).run(args);
    if (result.changes === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /sessions failed:', e.message);
    res.status(400).json({ error: 'invalid request' });
  }
});

// ── Races ─────────────────────────────────────────────────────────────────────

const RACE_FIELDS = [
  'race_name', 'race_date', 'distance', 'bib', 'category', 'start_time',
  'finish_sec', 'goal_sec', 'swim_sec', 't1_sec', 'bike_sec', 't2_sec', 'run_sec',
  'swim_distance_m', 'bike_distance_m', 'run_distance_m',
  'overall_rank', 'overall_field', 'gender_rank', 'gender_field',
  'category_rank', 'category_field',
  'swim_rank_category', 'bike_rank_category', 'run_rank_category', 'notes',
];

const hms = (sec) => {
  if (sec == null) return null;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
};

function toRaceRow(row) {
  if (!row) return null;
  let splits = null;
  if (row.splits) {
    try { splits = JSON.parse(row.splits); } catch (_) { splits = null; }
  }
  return {
    ...row,
    splits,
    finish_time: hms(row.finish_sec),
    swim_time: hms(row.swim_sec),
    bike_time: hms(row.bike_sec),
    run_time: hms(row.run_sec),
    vs_goal_sec: (row.finish_sec != null && row.goal_sec != null) ? row.finish_sec - row.goal_sec : null,
  };
}

app.get('/races', (req, res) => {
  const { athlete_id, limit = 50 } = req.query;
  if (!athlete_id) return res.status(400).json({ error: 'athlete_id required' });
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 1000);
  const rows = db.prepare('SELECT * FROM races WHERE athlete_id = ? ORDER BY race_date DESC LIMIT ?')
    .all(athlete_id, lim);
  res.json(rows.map(toRaceRow));
});

app.get('/races/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM races WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(toRaceRow(row));
});

app.post('/races', (req, res) => {
  const { athlete_id, race_name, race_date, splits } = req.body;
  if (!athlete_id || !race_name || !race_date) {
    return res.status(400).json({ error: 'athlete_id, race_name and race_date required' });
  }

  const args = { athlete_id, splits: splits == null ? null
    : (typeof splits === 'string' ? splits : JSON.stringify(splits)) };
  for (const f of RACE_FIELDS) args[f] = req.body[f] ?? null;

  const cols = ['athlete_id', ...RACE_FIELDS, 'splits'];
  const updatable = cols.filter(c => !['athlete_id', 'race_name', 'race_date'].includes(c));

  try {
    db.prepare(`
      INSERT INTO races (${cols.join(', ')})
      VALUES (${cols.map(c => '@' + c).join(', ')})
      ON CONFLICT(athlete_id, race_name, race_date) DO UPDATE SET
        ${updatable.map(c => `${c} = excluded.${c}`).join(', ')}
    `).run(args);
  } catch (e) {
    console.error('POST /races failed:', e.message);
    return res.status(400).json({ error: 'invalid request' });
  }

  const row = db.prepare('SELECT * FROM races WHERE athlete_id = ? AND race_name = ? AND race_date = ?')
    .get(athlete_id, race_name, race_date);
  res.status(201).json(toRaceRow(row));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`tricoach-db listening on :${PORT}`));
