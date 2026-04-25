/**
 * Backfill sessions table from Intervals.icu over a date range.
 * Mirrors the Save Session node in workflow hrSGUqoAwkWQ4gKl, so the
 * upsert on (athlete_id, intervals_id) means re-running is safe.
 *
 * Usage:
 *   node backfill-sessions.js                        # last 2 months
 *   node backfill-sessions.js 2026-01-01 2026-04-25  # custom range
 */

require('dotenv').config();
const axios = require('axios');

const ICU_BASE = 'https://intervals.icu/api/v1';
const ICU_KEY = process.env.INTERVALS_API_KEY;
if (!ICU_KEY) { console.error('INTERVALS_API_KEY missing in .env'); process.exit(1); }
const ICU_ATHLETE = process.env.INTERVALS_ATHLETE_ID || 'i492254';
const DB_URL = process.env.TRICOACH_DB_URL || 'https://coach-db.arthurpfz.com';
const DB_KEY = process.env.TRICOACH_API_KEY;
const ATHLETE_ID = 1;

if (!DB_KEY) { console.error('TRICOACH_API_KEY missing in .env'); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const twoMonthsAgo = (() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d.toISOString().slice(0, 10); })();
const oldest = process.argv[2] || twoMonthsAgo;
const newest = process.argv[3] || today;

const icu = axios.create({ baseURL: ICU_BASE, auth: { username: 'API_KEY', password: ICU_KEY } });
const db = axios.create({ baseURL: DB_URL, headers: { 'X-API-Key': DB_KEY } });

// Mirror the n8n Save Session bodyParameters mapping verbatim.
function toPayload(a) {
  return {
    athlete_id: ATHLETE_ID,
    intervals_id: a.id,
    date: (a.start_date_local || '').slice(0, 10),
    sport: a.type,
    name: a.name,
    source: 'intervals',
    device_name: a.device_name,
    start_local: a.start_date_local,
    elapsed_sec: a.elapsed_time,
    moving_sec: a.moving_time,
    duration_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
    distance_m: a.distance,
    distance_km: a.distance ? +(a.distance / 1000).toFixed(2) : null,
    avg_speed_ms: a.average_speed,
    max_speed_ms: a.max_speed,
    avg_hr: a.average_heartrate,
    max_hr: a.max_heartrate,
    lthr: a.icu_lthr,
    resting_hr: a.icu_resting_hr,
    avg_power: a.icu_average_watts ?? a.average_watts,
    normalized_power: a.icu_weighted_avg_watts,
    variability_index: a.icu_variability_index,
    efficiency_factor: a.icu_efficiency_factor,
    decoupling: a.decoupling,
    power_load: a.icu_power_load,
    strain_score: a.icu_strain,
    ftp_at_time: a.icu_ftp,
    tss: a.icu_training_load,
    trimp: a.trimp,
    intensity_factor: a.icu_intensity,
    polarization_index: a.polarization_index,
    atl: a.icu_atl,
    ctl: a.icu_ctl,
    hr_load: a.icu_hr_load,
    pace_load: a.icu_pace_load,
    elevation_gain_m: a.total_elevation_gain,
    elevation_loss_m: a.icu_elevation_loss ?? a.total_elevation_loss,
    avg_cadence: a.average_cadence,
    avg_stride: a.icu_average_stride,
    pool_length_m: a.pool_length,
    lengths: a.icu_pool_lengths,
    gap_sec_per_km: a.gap,
    calories: a.calories,
    weight_kg: a.icu_weight,
    raw_json: JSON.stringify(a),
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`Fetching activities ${oldest} → ${newest} for athlete ${ICU_ATHLETE}`);
  const rawList = (await icu.get(`/athlete/${ICU_ATHLETE}/activities`, { params: { oldest, newest } })).data;
  // Same as Daily Checkin Filter Activities: ZEPP excluded entirely from analysis.
  const list = rawList.filter(a => a.source !== 'ZEPP');
  console.log(`Found ${rawList.length} activities (${rawList.length - list.length} ZEPP dropped). Fetching details + upserting...\n`);

  let ok = 0, fail = 0;
  for (const stub of list) {
    try {
      const detail = (await icu.get(`/activity/${stub.id}`)).data;
      const res = await db.post('/sessions', toPayload(detail));
      console.log(`  ✓ ${stub.start_date_local.slice(0,10)} ${stub.type.padEnd(10)} ${stub.name?.slice(0,40) || ''} → session id ${res.data.id}`);
      ok++;
      await sleep(150); // gentle rate limit on Intervals.icu
    } catch (e) {
      const msg = e.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message;
      console.error(`  ✗ ${stub.id} (${stub.start_date_local}): ${msg}`);
      fail++;
    }
  }
  console.log(`\nDone. ${ok} ok, ${fail} failed.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
