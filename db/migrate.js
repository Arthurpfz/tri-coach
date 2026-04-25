/**
 * One-time migration: Airtable → SQLite
 * Usage: AIRTABLE_PAT=xxx DB_PATH=/data/tricoach.db node migrate.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appw0Xd3T54okfaXa';
const USERS_TABLE = 'tblK8jxVIxuFi9H8Z';
const PLANS_TABLE = 'tblJ0UHyJ1drXv97F';
const DB_PATH = process.env.DB_PATH || './tricoach.db';

if (!PAT) {
  console.error('AIRTABLE_PAT env var required');
  process.exit(1);
}

async function airtableFetch(tableId, params = '') {
  const records = [];
  let offset = '';
  do {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
    if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset || '';
  } while (offset);
  return records;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // ── Migrate Athletes ────────────────────────────────────────────────────────
  console.log('Fetching athletes from Airtable...');
  const userRecords = await airtableFetch(USERS_TABLE);
  console.log(`Found ${userRecords.length} athletes`);

  // Map: airtable record ID → sqlite integer id (for plan linking)
  const athleteIdMap = {};

  const insertAthlete = db.prepare(`
    INSERT OR REPLACE INTO athletes (
      name, phone, telegram_chat_id, race_name, race_date, training_phase,
      fitness_profile, constraints, strava_access_token, strava_refresh_token,
      token_expires_at, last_activity_sync, intervals_athlete_id, intervals_api_key,
      intervals_last_sync, last_coaching_date
    ) VALUES (
      @name, @phone, @telegram_chat_id, @race_name, @race_date, @training_phase,
      @fitness_profile, @constraints, @strava_access_token, @strava_refresh_token,
      @token_expires_at, @last_activity_sync, @intervals_athlete_id, @intervals_api_key,
      @intervals_last_sync, @last_coaching_date
    )
  `);

  for (const rec of userRecords) {
    const f = rec.fields;
    const result = insertAthlete.run({
      name: f['Name'] || '',
      phone: f['Phone'] || null,
      telegram_chat_id: null,
      race_name: f['Race Name'] || null,
      race_date: f['Race Date'] || null,
      training_phase: f['Training Phase'] || null,
      fitness_profile: f['Fitness Profile'] || null,
      constraints: f['Constraints'] || null,
      strava_access_token: f['Strava Access Token'] || null,
      strava_refresh_token: f['Strava Refresh Token'] || null,
      token_expires_at: f['Token Expires At'] || null,
      last_activity_sync: f['Last Activity Sync'] || null,
      intervals_athlete_id: f['Intervals.icu Athlete ID'] || null,
      intervals_api_key: f['Intervals.icu API Key'] || null,
      intervals_last_sync: f['Intervals.icu Last Sync'] || null,
      last_coaching_date: f['Last Coaching Date'] || null,
    });
    athleteIdMap[rec.id] = result.lastInsertRowid;
    console.log(`  Athlete: ${f['Name']} → id ${result.lastInsertRowid}`);
  }

  // ── Migrate Weekly Plans ────────────────────────────────────────────────────
  console.log('\nFetching weekly plans from Airtable...');
  const planRecords = await airtableFetch(PLANS_TABLE, '&sort[0][field]=Week%20Start%20Date&sort[0][direction]=asc');
  console.log(`Found ${planRecords.length} plans`);

  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO weekly_plans (
      athlete_id, week_start_date, focus, monday, tuesday, wednesday,
      thursday, friday, saturday, sunday
    ) VALUES (
      @athlete_id, @week_start_date, @focus, @monday, @tuesday, @wednesday,
      @thursday, @friday, @saturday, @sunday
    )
  `);

  let plansInserted = 0;
  for (const rec of planRecords) {
    const f = rec.fields;
    // Athlete is a linked record array in Airtable
    const airtableAthleteId = Array.isArray(f['Athlete']) ? f['Athlete'][0] : f['Athlete'];
    const sqliteAthleteId = athleteIdMap[airtableAthleteId];

    if (!sqliteAthleteId) {
      console.warn(`  Skipping plan ${rec.id}: athlete ${airtableAthleteId} not found`);
      continue;
    }

    // Week Start Date comes as full ISO datetime, normalize to YYYY-MM-DD
    const weekDate = f['Week Start Date'] ? f['Week Start Date'].slice(0, 10) : null;
    if (!weekDate) { console.warn(`  Skipping plan ${rec.id}: no week start date`); continue; }

    insertPlan.run({
      athlete_id: sqliteAthleteId,
      week_start_date: weekDate,
      focus: f['Focus'] || null,
      monday: f['Monday'] || null,
      tuesday: f['Tuesday'] || null,
      wednesday: f['Wednesday'] || null,
      thursday: f['Thursday'] || null,
      friday: f['Friday'] || null,
      saturday: f['Saturday'] || null,
      sunday: f['Sunday'] || null,
    });
    plansInserted++;
    console.log(`  Plan: ${weekDate} → athlete ${sqliteAthleteId}`);
  }

  console.log(`\nMigration complete: ${userRecords.length} athletes, ${plansInserted} plans`);
  db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
