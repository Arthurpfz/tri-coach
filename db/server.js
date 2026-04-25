const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DB_PATH = process.env.DB_PATH || './tricoach.db';
const API_KEY = process.env.API_KEY;

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
];
const existing = new Set(db.pragma('table_info(sessions)').map(c => c.name));
for (const [col, type] of SESSION_COLUMNS) {
  if (!existing.has(col)) db.exec(`ALTER TABLE sessions ADD COLUMN ${col} ${type}`);
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS sessions_intervals_unique
  ON sessions(athlete_id, intervals_id) WHERE intervals_id IS NOT NULL`);

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
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    'Week Start Date': row.week_start_date,
    Focus: row.focus,
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
  if (!API_KEY) return next();
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
    'fitness_profile', 'constraints', 'strava_access_token', 'strava_refresh_token',
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
  const { athlete_id, week_start_date, focus, monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;
  if (!athlete_id || !week_start_date) return res.status(400).json({ error: 'athlete_id and week_start_date required' });

  db.prepare(`
    INSERT INTO weekly_plans (athlete_id, week_start_date, focus, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
    VALUES (@athlete_id, @week_start_date, @focus, @monday, @tuesday, @wednesday, @thursday, @friday, @saturday, @sunday)
    ON CONFLICT(athlete_id, week_start_date) DO UPDATE SET
      focus = excluded.focus, monday = excluded.monday, tuesday = excluded.tuesday,
      wednesday = excluded.wednesday, thursday = excluded.thursday, friday = excluded.friday,
      saturday = excluded.saturday, sunday = excluded.sunday
  `).run({ athlete_id, week_start_date, focus: focus || null, monday: monday || null, tuesday: tuesday || null,
    wednesday: wednesday || null, thursday: thursday || null, friday: friday || null,
    saturday: saturday || null, sunday: sunday || null });

  const row = db.prepare('SELECT * FROM weekly_plans WHERE athlete_id = ? AND week_start_date = ?')
    .get(athlete_id, week_start_date);
  res.status(201).json(toPlanRow(row));
});

// ── Sessions ──────────────────────────────────────────────────────────────────

app.get('/sessions', (req, res) => {
  const { athlete_id, limit = 50, date_from, wrap, has_analysis } = req.query;
  if (!athlete_id) return res.status(400).json({ error: 'athlete_id required' });

  let sql = 'SELECT * FROM sessions WHERE athlete_id = ?';
  const args = [athlete_id];
  if (date_from) { sql += ' AND date >= ?'; args.push(date_from); }
  if (has_analysis === '1') { sql += ' AND analyzed_at IS NOT NULL'; }
  sql += ' ORDER BY date DESC, analyzed_at DESC LIMIT ?';
  args.push(Number(limit));

  const results = db.prepare(sql).all(...args);
  if (wrap === '1') return res.json({ sessions: results, count: results.length });
  res.json(results);
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
  const updateSet = POST_FIELDS.filter(k => k !== 'athlete_id' && k !== 'intervals_id' && k !== 'strava_id')
    .map(k => `${k} = excluded.${k}`).join(', ');

  // Note: partial unique index on (athlete_id, intervals_id) requires the
  // matching WHERE clause to be repeated in the conflict target.
  let conflictTarget = null;
  if (intervals_id) conflictTarget = '(athlete_id, intervals_id) WHERE intervals_id IS NOT NULL';
  else if (strava_id) conflictTarget = '(strava_id)';

  const sql = conflictTarget
    ? `INSERT INTO sessions (${allCols}) VALUES (${placeholders})
       ON CONFLICT${conflictTarget} DO UPDATE SET ${updateSet}
       RETURNING id`
    : `INSERT INTO sessions (${allCols}) VALUES (${placeholders}) RETURNING id`;

  try {
    const row = db.prepare(sql).get(payload);
    res.status(201).json({ id: row.id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /sessions/:id — used to attach Claude analysis after coaching runs
app.patch('/sessions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  // Only allow these fields to be patched
  const PATCH_FIELDS = ['analysis', 'analyzed_at', 'grade', 'rpe', 'notes', 'user_feedback', 'user_feedback_at'];
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
    res.status(400).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`tricoach-db listening on :${PORT}`));
