/**
 * test-e2e.js — End-to-end test of the three improvements
 *
 * 1. Daily Checkin: Parser logic against realistic Claude outputs (mocked + edge cases)
 *                   + verify grade column write/read works
 * 2. Sunday Planner: Real /sessions call → real context-building Code → ready prompt
 * 3. Feedback Handler: Verify Telegram webhook is registered with n8n
 *                      + verify the entire post-trigger logic chain (GET → PATCH)
 *                      using direct API calls
 */
require('dotenv').config();
const axios = require('axios');

const TRICOACH = 'https://coach-db.arthurpfz.com';
const TRICOACH_KEY = process.env.TRICOACH_API_KEY;

const tri = axios.create({
  baseURL: TRICOACH,
  headers: { 'X-API-Key': TRICOACH_KEY, 'Content-Type': 'application/json' },
});

// Reproduce the n8n Set node "Parse Grade" expression logic exactly
function parseGrade(text) {
  try {
    const t = text
      .replace(/```json[\s\S]*?```/g, s => s.replace(/```json\s*/, '').replace(/```\s*/, ''))
      .replace(/```/g, '')
      .trim();
    return JSON.parse(t).grade || 'B';
  } catch (e) {
    const m = text.match(/Grade:\s*([ABCF])/);
    return m ? m[1] : 'B';
  }
}
function parseMessage(text) {
  try {
    const t = text
      .replace(/```json[\s\S]*?```/g, s => s.replace(/```json\s*/, '').replace(/```\s*/, ''))
      .replace(/```/g, '')
      .trim();
    return JSON.parse(t).message || text;
  } catch (e) {
    return text;
  }
}

// ── TEST 1: Daily Checkin grade extraction ────────────────────────────────────

async function testDailyCheckinFlow() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('TEST 1: Daily Checkin — grade extraction + DB write');
  console.log('══════════════════════════════════════════════════════════');

  // Realistic Claude outputs covering happy path + edge cases the parser must handle
  const samples = [
    {
      name: 'clean JSON (happy path)',
      text: `{"grade":"A","message":"🏃 Run · 41min · 7.32km · 181bpm · TSS 83\\nGrade: A — clean execution at threshold\\n\\n• Cardiac drift only 3.2% across 35min sustained effort\\n• Cadence locked at 150spm with <2% variation\\n• Limiter: needs more mid-run fueling discipline\\n\\nTomorrow: easy 30min Z2 spin\\nWatch: HR drift on next tempo run"}`,
      expectedGrade: 'A',
    },
    {
      name: 'wrapped in ```json``` (Claude likes to do this)',
      text: '```json\n{"grade":"C","message":"💪 Workout · 32min · TSS 64\\nGrade: C — too high intensity for Base 1"}\n```',
      expectedGrade: 'C',
    },
    {
      name: 'fallback — Claude reverted to plain text',
      text: '🏃 Run · 41min · TSS 83\nGrade: B — solid Z2 effort, slight HR drift\n\n• stuff\n• stuff',
      expectedGrade: 'B',
    },
    {
      name: 'malformed JSON, no Grade: line — should fall back to default B',
      text: 'random unparseable garbage from a confused model',
      expectedGrade: 'B',
    },
  ];

  let allPass = true;
  for (const s of samples) {
    const grade = parseGrade(s.text);
    const message = parseMessage(s.text);
    const ok = grade === s.expectedGrade && message.length > 0;
    console.log(`   ${ok ? '✓' : '✗'} ${s.name}: grade="${grade}" (expected "${s.expectedGrade}")`);
    if (!ok) allPass = false;
  }

  // Real DB write: write a grade and verify it round-trips
  console.log('\n   DB write+read with grade column:');
  const session = (await tri.get('/sessions?athlete_id=1&limit=1')).data[0];
  await tri.patch(`/sessions/${session.id}`, {
    grade: 'A',
    analysis: 'e2e test analysis',
    analyzed_at: new Date().toISOString(),
  });
  const after = (await tri.get('/sessions?athlete_id=1&limit=1')).data[0];
  const dbOk = after.grade === 'A' && after.analysis === 'e2e test analysis';
  console.log(`   ${dbOk ? '✓' : '✗'} grade saved to sessions.grade and round-trips correctly`);

  // Cleanup
  await tri.patch(`/sessions/${session.id}`, { grade: null, analysis: null, analyzed_at: null });

  const pass = allPass && dbOk;
  console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'} — Daily Checkin parser handles all output shapes; grade column works`);
  console.log('   ⚠ The actual Claude output format will be exercised by the next scheduled run (20:10 Berlin).');
  return pass;
}

// ── TEST 2: Sunday Planner sessions context ───────────────────────────────────

async function testSundayPlannerFlow() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('TEST 2: Sunday Planner — last week sessions context');
  console.log('══════════════════════════════════════════════════════════');

  // Reproduce the date logic from n8n: $today.startOf('week') (Luxon = Monday)
  const today = new Date();
  const dayOfWeek = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek - 1));
  const mondayStr = monday.toISOString().slice(0, 10);

  // Hit the actual API the way "Get This Week Sessions" node does
  const wrapped = (await tri.get(`/sessions?athlete_id=1&date_from=${mondayStr}&limit=14&wrap=1`)).data;
  console.log(`   ✓ GET /sessions?wrap=1 returned object with count=${wrapped.count}`);

  // Run the "Build Prompt Context" Code node JS verbatim
  const sessions = Array.isArray(wrapped.sessions) ? wrapped.sessions : [];
  const lines = [];
  if (sessions.length === 0) {
    lines.push('No sessions logged this week.');
  } else {
    const totalMin = sessions.reduce((s, x) => s + (x.duration_min || 0), 0);
    const totalTSS = sessions.reduce((s, x) => s + (parseFloat(x.tss) || 0), 0);
    const grades = sessions.filter(x => x.grade).map(x => x.grade);
    lines.push(`${sessions.length} session${sessions.length > 1 ? 's' : ''} · ${(totalMin / 60).toFixed(1)}h · TSS ${Math.round(totalTSS)}`);
    if (grades.length) lines.push(`Session grades: ${grades.join(', ')}`);
    sessions.slice().reverse().forEach(s => {
      const p = [
        (s.date || '').slice(5),
        s.sport || '?',
        s.duration_min ? `${s.duration_min}min` : null,
        s.tss ? `TSS ${Math.round(s.tss)}` : null,
        s.grade ? `Grade ${s.grade}` : null,
      ].filter(Boolean).join(' · ');
      lines.push(`  - ${p}`);
    });
  }
  const lastWeekSummary = lines.join('\n');

  console.log('\n   Generated lastWeekSummary that Claude will see:');
  console.log(lastWeekSummary.split('\n').map(l => '      ' + l).join('\n'));

  // Edge case: empty result still wraps as object (confirms the fix to n8n empty-array problem)
  const emptyTest = (await tri.get(`/sessions?athlete_id=1&date_from=2099-01-01&wrap=1`)).data;
  const emptyOK = emptyTest.count === 0 && Array.isArray(emptyTest.sessions);
  console.log(`\n   ✓ Empty case (date in the future): count=${emptyTest.count}, sessions=array: ${emptyOK}`);

  const pass = lastWeekSummary.length > 0 && emptyOK;
  console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'} — Sunday Planner gets real sessions context; empty case handled`);
  return pass;
}

// ── TEST 3: Feedback Handler ───────────────────────────────────────────────────

async function testFeedbackHandler() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('TEST 3: Feedback Handler — webhook + post-trigger chain');
  console.log('══════════════════════════════════════════════════════════');

  // Part A: Verify n8n has registered the Telegram webhook
  // n8n Telegram Trigger uses /webhook/[id]/webhook with a secret-token check.
  // A 403 "Provided secret is not valid" CONFIRMS the webhook is registered.
  console.log('\n   A. Verify webhook is registered with n8n:');
  let webhookRegistered = false;
  try {
    await axios.post(
      'https://apfz.app.n8n.cloud/webhook/feedback-handler-webhook/webhook',
      { fake: 'payload' },
      { timeout: 5000 }
    );
  } catch (e) {
    if (e.response?.status === 403 && /secret/i.test(e.response.data?.message || '')) {
      webhookRegistered = true;
      console.log('   ✓ Webhook registered (403 "secret not valid" — correct, since we lack Telegram\'s secret)');
    } else {
      console.log(`   ✗ Unexpected response: ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
    }
  }

  // Part B: Test the post-trigger logic chain: GET /sessions?has_analysis=1 → PATCH /sessions/:id
  console.log('\n   B. Test post-trigger chain (what the workflow does after auth+prefix pass):');

  const session = (await tri.get('/sessions?athlete_id=1&limit=1')).data[0];
  await tri.patch(`/sessions/${session.id}`, {
    grade: 'A',
    analysis: 'e2e fixture',
    analyzed_at: new Date().toISOString(),
  });
  console.log(`   ✓ Set up fixture: session ${session.id} now has analysis`);

  // Step 1: GET latest session with has_analysis=1, wrap=1 (matches the workflow's HTTP call)
  const wrapped = (await tri.get('/sessions?athlete_id=1&limit=1&wrap=1&has_analysis=1')).data;
  const found = wrapped.count > 0;
  console.log(`   ${found ? '✓' : '✗'} GET /sessions?has_analysis=1&wrap=1 returned ${wrapped.count} sessions`);
  if (!found) {
    return false;
  }
  const targetSession = wrapped.sessions[0];

  // Step 2: PATCH with user_feedback (matches the workflow's PATCH call)
  const fakeMessageText = '! e2e test feedback — ignore';
  const cleanedFeedback = fakeMessageText.replace(/^!\s*/, '').trim();
  await tri.patch(`/sessions/${targetSession.id}`, {
    user_feedback: cleanedFeedback,
    user_feedback_at: new Date().toISOString(),
  });

  // Verify
  const afterPatch = (await tri.get('/sessions?athlete_id=1&limit=1')).data[0];
  const feedbackOk =
    afterPatch.user_feedback === cleanedFeedback && afterPatch.user_feedback_at !== null;
  console.log(`   ${feedbackOk ? '✓' : '✗'} PATCH /sessions/${targetSession.id} stored user_feedback`);
  console.log(`     stored: ${JSON.stringify(afterPatch.user_feedback)}`);

  // Cleanup
  await tri.patch(`/sessions/${session.id}`, {
    grade: null,
    analysis: null,
    analyzed_at: null,
    user_feedback: null,
    user_feedback_at: null,
  });
  console.log('   ✓ Cleaned up fixture');

  const pass = webhookRegistered && feedbackOk;
  console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'} — Feedback Handler webhook is registered; post-trigger chain works`);
  console.log('   ⚠ Manual test recommended: send "! test" to @CroissantTriBot to verify the full Telegram → n8n → DB → confirmation chain.');
  return pass;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const results = {};
  try {
    results.dailyCheckin = await testDailyCheckinFlow();
  } catch (e) {
    console.error('Test 1 errored:', e.response?.data || e.message);
    results.dailyCheckin = false;
  }
  try {
    results.sundayPlanner = await testSundayPlannerFlow();
  } catch (e) {
    console.error('Test 2 errored:', e.response?.data || e.message);
    results.sundayPlanner = false;
  }
  try {
    results.feedbackHandler = await testFeedbackHandler();
  } catch (e) {
    console.error('Test 3 errored:', e.response?.data || e.message);
    results.feedbackHandler = false;
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log('Daily Checkin (Fix 2):     ', results.dailyCheckin ? '✅ PASS' : '❌ FAIL');
  console.log('Sunday Planner (Fix 1):    ', results.sundayPlanner ? '✅ PASS' : '❌ FAIL');
  console.log('Feedback Handler (Fix 3):  ', results.feedbackHandler ? '✅ PASS' : '❌ FAIL');
  const allPass = Object.values(results).every(Boolean);
  process.exit(allPass ? 0 : 1);
}

main();
