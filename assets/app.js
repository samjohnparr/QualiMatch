/* assets/app.js — QualiMatch (no backend, offline)
   Works on GitHub Pages and also when opened locally (file://).
*/

/* ---------- DOM helpers ---------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const page = document.body?.getAttribute("data-page") || "";

/* ---------- Toast ---------- */
function toast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.__tm);
  toast.__tm = setTimeout(()=> t.classList.remove("show"), 2200);
}

/* ---------- Seeded RNG (string seed) ---------- */
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFrom(seedStr){
  const seedFn = xmur3(seedStr);
  return mulberry32(seedFn());
}
function shuffle(arr, rng){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- URL seed ---------- */
function getSeed(){
  const p = new URLSearchParams(location.search);
  return (p.get("seed") || "default").trim() || "default";
}

/* ---------- Local storage ---------- */
const LS_PID = "qm_pid";
function normPid(s){ return (s||"").trim().replace(/\s+/g,"_").slice(0,64); }

function getPid(){
  return normPid(localStorage.getItem(LS_PID) || "");
}
function setPid(pid){
  localStorage.setItem(LS_PID, normPid(pid));
}

function keyProgress(phase, pid, seed){ return `qm_prog_${phase}_${pid||"__anon__"}_${seed}`; }
function keyTimer(phase, pid, seed){ return `qm_timer_${phase}_${pid||"__anon__"}_${seed}`; }
function keyLast(phase, pid, seed){ return `qm_last_${phase}_${pid||"__anon__"}_${seed}`; }

function readJSON(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
function writeJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}
function delKey(key){ localStorage.removeItem(key); }

function migrateAnonToPid(phase, seed, newPid){
  const anonProgK = keyProgress(phase, "__anon__", seed);
  const anonTimK  = keyTimer(phase, "__anon__", seed);
  const anonLastK = keyLast(phase, "__anon__", seed);

  const pidProgK  = keyProgress(phase, newPid, seed);
  const pidTimK   = keyTimer(phase, newPid, seed);
  const pidLastK  = keyLast(phase, newPid, seed);

  if(localStorage.getItem(anonProgK) && !localStorage.getItem(pidProgK)){
    localStorage.setItem(pidProgK, localStorage.getItem(anonProgK));
  }
  if(localStorage.getItem(anonTimK) && !localStorage.getItem(pidTimK)){
    localStorage.setItem(pidTimK, localStorage.getItem(anonTimK));
  }
  if(localStorage.getItem(anonLastK) && !localStorage.getItem(pidLastK)){
    localStorage.setItem(pidLastK, localStorage.getItem(anonLastK));
  }
}

/* ---------- CSV helpers ---------- */
function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}
function csvLine(headers, row){
  return headers.map(h => csvEscape(row[h])).join(",");
}
function downloadText(filename, text){
  const blob = new Blob([text], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 200);
}

/* ---------- Bank ---------- */
function bank(){
  const b = window.__BANK__;
  if(!b){ toast("Missing item bank (assets/bank_inline.js)."); }
  return b;
}

/* ---------- Shared UI ---------- */
function setActiveNav(){
  const p = page || "";
  $$(".pill").forEach(a=>{
    const id = a.getAttribute("data-nav") || "";
    a.classList.toggle("active", id === p);
  });
}

function mountPid(){
  const input = $("#pidInput");
  if(!input) return;
  input.value = getPid();
  input.addEventListener("input", ()=>{
    const pid = normPid(input.value);
    setPid(pid);
  });
  input.addEventListener("change", ()=>{
    const seed = getSeed();
    const pid = getPid();
    if(pid){
      migrateAnonToPid("pretest", seed, pid);
      migrateAnonToPid("posttest", seed, pid);
      toast("Participant code saved.");
    }
  });
}

function ensureTimerStarted(phase, seed){
  const pid = getPid() || "__anon__";
  const k = keyTimer(phase, pid, seed);
  if(!localStorage.getItem(k)){
    localStorage.setItem(k, String(Date.now()));
  }
}
function getElapsedMs(phase, seed){
  const pid = getPid() || "__anon__";
  const k = keyTimer(phase, pid, seed);
  const start = Number(localStorage.getItem(k) || Date.now());
  return Math.max(0, Date.now() - start);
}
function resetTimer(phase, seed){
  const pid = getPid() || "__anon__";
  delKey(keyTimer(phase, pid, seed));
}

/* ============================================================
   QUIZ (Pre / Post)
   ============================================================ */
const QUIZ_ITEM_HEADERS = [
  "pid","phase","item_id","topic","rq",
  "chosen_design_id","chosen_design_label","chosen_source_id","chosen_source_label",
  "correct_design_id","correct_source_id",
  "design_correct","source_correct","points_0to2",
  "elapsed_ms","timestamp_iso","seed"
];

const QUIZ_SUMMARY_HEADERS = [
  "pid","phase","total_points","max_points","percent","elapsed_ms_total","timestamp_iso","seed"
];

function renderQuiz(phase, items, b){
  const seed = getSeed();
  const pid = getPid() || "__anon__";
  const ordered = shuffle(items, rngFrom(`${seed}|${phase}|order`));

  ensureTimerStarted(phase, seed);

  const progK = keyProgress(phase, pid, seed);
  const prog = readJSON(progK, {});

  const root = $("#quizRoot");
  root.innerHTML = "";

  for(const it of ordered){
    const card = document.createElement("div");
    card.className = "itemCard";

    const head = document.createElement("div");
    head.className = "itemHead";
    head.innerHTML = `
      <div>
        <div class="itemTitle">${it.topic}</div>
        <div class="itemSub">${it.rq}</div>
      </div>
      <div class="itemId">${it.id}</div>
    `;

    const designIds = [it.correct_design_id, ...it.distractor_design_ids];
    const sourceIds = [it.correct_data_source_id, ...it.distractor_source_ids];

    const designOpts = shuffle(designIds, rngFrom(`${seed}|${phase}|${it.id}|design`));
    const sourceOpts = shuffle(sourceIds, rngFrom(`${seed}|${phase}|${it.id}|source`));

    const chosen = prog[it.id] || {d:"", s:""};

    const body = document.createElement("div");
    body.className = "twoCols";
    body.innerHTML = `
      <div>
        <label for="${phase}_${it.id}_d">Design</label>
        <select id="${phase}_${it.id}_d">
          <option value="">Select…</option>
          ${designOpts.map(id=>`<option value="${id}">${b.DESIGN_LABELS[id]}</option>`).join("")}
        </select>
      </div>
      <div>
        <label for="${phase}_${it.id}_s">Data source</label>
        <select id="${phase}_${it.id}_s">
          <option value="">Select…</option>
          ${sourceOpts.map(id=>`<option value="${id}">${b.SOURCE_LABELS[id]}</option>`).join("")}
        </select>
      </div>
    `;

    card.appendChild(head);
    card.appendChild(body);
    root.appendChild(card);

    const dSel = $(`#${phase}_${it.id}_d`);
    const sSel = $(`#${phase}_${it.id}_s`);
    dSel.value = chosen.d || "";
    sSel.value = chosen.s || "";

    const save = ()=>{
      prog[it.id] = {d: dSel.value, s: sSel.value};
      writeJSON(progK, prog);
    };
    dSel.addEventListener("change", save);
    sSel.addEventListener("change", save);
  }

  const last = readJSON(keyLast(phase, pid, seed), null);
  if(last && $("#scoreBox")){
    $("#scoreBox").style.display = "block";
    $("#scoreBadge").className = "badge good";
    $("#scoreBadge").innerHTML = `<strong>Score:</strong> ${last.summary.total_points} / ${last.summary.max_points} (${last.summary.percent}%)`;
    $("#timeBadge").innerHTML = `<strong>Time:</strong> ${Math.round(last.summary.elapsed_ms_total/1000)}s`;
    $("#downloadBtn").disabled = false;
  }
}

function submitQuiz(phase, items, b){
  const seed = getSeed();
  const pid = getPid() || "__anon__";
  if(pid === "__anon__"){
    toast("Enter your participant code first.");
    $("#pidInput")?.focus();
    return;
  }
  migrateAnonToPid(phase, seed, pid);

  const ordered = shuffle(items, rngFrom(`${seed}|${phase}|order`));
  const progK = keyProgress(phase, pid, seed);
  const prog = readJSON(progK, {});

  for(const it of ordered){
    const c = prog[it.id] || {};
    if(!c.d || !c.s){
      toast("Answer all items (Design + Data source).");
      return;
    }
  }

  const ts = new Date().toISOString();
  const elapsed = getElapsedMs(phase, seed);

  let total = 0;
  const perRows = [];

  for(const it of ordered){
    const c = prog[it.id];
    const designCorrect = c.d === it.correct_design_id ? 1 : 0;
    const sourceCorrect = c.s === it.correct_data_source_id ? 1 : 0;
    const points = designCorrect + sourceCorrect;
    total += points;

    perRows.push({
      pid,
      phase,
      item_id: it.id,
      topic: it.topic,
      rq: it.rq,
      chosen_design_id: c.d,
      chosen_design_label: b.DESIGN_LABELS[c.d] || "",
      chosen_source_id: c.s,
      chosen_source_label: b.SOURCE_LABELS[c.s] || "",
      correct_design_id: it.correct_design_id,
      correct_source_id: it.correct_data_source_id,
      design_correct: String(designCorrect),
      source_correct: String(sourceCorrect),
      points_0to2: String(points),
      elapsed_ms: String(elapsed),
      timestamp_iso: ts,
      seed
    });
  }

  const summary = {
    pid,
    phase,
    total_points: String(total),
    max_points: String(ordered.length * 2),
    percent: String(Math.round((total/(ordered.length*2))*100)),
    elapsed_ms_total: String(elapsed),
    timestamp_iso: ts,
    seed
  };

  writeJSON(keyLast(phase, pid, seed), {rows: perRows, summary});

  $("#scoreBox").style.display = "block";
  $("#scoreBadge").className = "badge good";
  $("#scoreBadge").innerHTML = `<strong>Score:</strong> ${summary.total_points} / ${summary.max_points} (${summary.percent}%)`;
  $("#timeBadge").innerHTML = `<strong>Time:</strong> ${Math.round(Number(summary.elapsed_ms_total)/1000)}s`;
  $("#downloadBtn").disabled = false;

  toast("Submitted. Download your CSV.");
}

function downloadQuizCSV(phase){
  const seed = getSeed();
  const pid = getPid();
  const last = readJSON(keyLast(phase, pid, seed), null);
  if(!last){ toast("No submission yet."); return; }

  const lines = [];
  lines.push(QUIZ_ITEM_HEADERS.join(","));
  for(const r of last.rows){
    lines.push(csvLine(QUIZ_ITEM_HEADERS, r));
  }
  lines.push("");
  lines.push(QUIZ_SUMMARY_HEADERS.join(","));
  lines.push(csvLine(QUIZ_SUMMARY_HEADERS, last.summary));

  downloadText(`${phase}_${pid}_${seed}.csv`, lines.join("\n"));
}

function resetQuiz(phase){
  const seed = getSeed();
  const pid = getPid() || "__anon__";
  delKey(keyProgress(phase, pid, seed));
  delKey(keyLast(phase, pid, seed));
  resetTimer(phase, seed);
  $("#scoreBox").style.display = "none";
  $("#downloadBtn").disabled = true;
  toast("Reset done.");
}

/* ============================================================
   PRACTICE
   ============================================================ */
const PRACTICE_HEADERS = [
  "pid","phase","card_id","chosen_design_id","chosen_source_id",
  "design_correct","source_correct","points_0to2","timestamp_iso","seed"
];

function practiceKey(pid, seed){ return `qm_practice_${pid||"__anon__"}_${seed}`; }

function renderPractice(cards, b){
  const seed = getSeed();
  const pid = getPid() || "__anon__";
  const ordered = shuffle(cards, rngFrom(`${seed}|practice|order`));

  const root = $("#practiceRoot");
  root.innerHTML = "";

  for(const c of ordered){
    const wrap = document.createElement("div");
    wrap.className = "itemCard";

    wrap.innerHTML = `
      <div class="itemHead">
        <div>
          <div class="itemTitle">${c.topic}</div>
          <div class="itemSub">${c.rq}</div>
        </div>
        <div class="itemId">${c.id}</div>
      </div>

      <div class="twoCols">
        <div>
          <label>Design</label>
          <select data-role="d"><option value="">Select…</option></select>
        </div>
        <div>
          <label>Data source</label>
          <select data-role="s"><option value="">Select…</option></select>
        </div>
      </div>

      <div class="btnRow" style="margin-top:10px;">
        <button class="btn primary" data-role="check">Check</button>
        <span class="badge" data-role="status" style="display:none;"></span>
      </div>

      <div class="callout" data-role="feedback" style="margin-top:10px; display:none;"></div>
    `;

    const dSel = $('[data-role="d"]', wrap);
    const sSel = $('[data-role="s"]', wrap);
    const checkBtn = $('[data-role="check"]', wrap);
    const status = $('[data-role="status"]', wrap);
    const fb = $('[data-role="feedback"]', wrap);

    const designKeys = shuffle(Object.keys(b.DESIGN_LABELS), rngFrom(`${seed}|practice|${c.id}|design`));
    const sourceKeys = shuffle(Object.keys(b.SOURCE_LABELS), rngFrom(`${seed}|practice|${c.id}|source`));
    dSel.innerHTML = `<option value="">Select…</option>` + designKeys.map(id=>`<option value="${id}">${b.DESIGN_LABELS[id]}</option>`).join("");
    sSel.innerHTML = `<option value="">Select…</option>` + sourceKeys.map(id=>`<option value="${id}">${b.SOURCE_LABELS[id]}</option>`).join("");

    checkBtn.addEventListener("click", ()=>{
      const d = dSel.value;
      const s = sSel.value;
      if(!d || !s){ toast("Pick both Design and Data source."); return; }

      const dc = d === c.correct_design_id ? 1 : 0;
      const sc = s === c.correct_data_source_id ? 1 : 0;
      const pts = dc + sc;

      status.style.display = "inline-flex";
      status.className = "badge " + (pts === 2 ? "good" : (pts === 1 ? "warn" : "bad"));
      status.innerHTML = `<strong>${pts === 2 ? "Correct" : (pts === 1 ? "Half-right" : "Not yet")}</strong>`;

      fb.style.display = "block";
      fb.className = "callout " + (pts === 2 ? "good" : (pts === 1 ? "warn" : "bad"));
      fb.textContent = c.explanation;

      const row = {
        pid: getPid() || "__anon__",
        phase: "practice",
        card_id: c.id,
        chosen_design_id: d,
        chosen_source_id: s,
        design_correct: String(dc),
        source_correct: String(sc),
        points_0to2: String(pts),
        timestamp_iso: new Date().toISOString(),
        seed
      };

      const k = practiceKey(pid, seed);
      const existing = readJSON(k, []);
      existing.push(row);
      writeJSON(k, existing);
    });

    root.appendChild(wrap);
  }
}

function downloadPracticeCSV(){
  const seed = getSeed();
  const pid = getPid();
  if(!pid){ toast("Enter participant code first."); return; }
  const rows = readJSON(practiceKey(pid, seed), []);
  if(!rows.length){ toast("No practice attempts saved yet."); return; }
  const lines = [PRACTICE_HEADERS.join(",")];
  for(const r of rows) lines.push(csvLine(PRACTICE_HEADERS, r));
  downloadText(`practice_${pid}_${seed}.csv`, lines.join("\n"));
}

function resetPractice(){
  const seed = getSeed();
  const pid = getPid() || "__anon__";
  delKey(practiceKey(pid, seed));
  toast("Practice attempts cleared.");
}

/* ============================================================
   BUILD (LLM-like keyword alignment)
   ============================================================ */
const BUILD_HEADERS = [
  "pid","phase","topic","rq_text","chosen_design_id","chosen_source_id",
  "suggested_design_id","alignment_flag","feedback_text","timestamp_iso","seed"
];

/* ---------- Build helpers ---------- */
function _norm(s){
  return String(s || "")
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9\s'/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function _hasAny(text, arr){
  for(const w of arr){
    if(!w) continue;
    if(text.includes(w)) return true;
  }
  return false;
}
function _cap1(s){
  if(!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Detect “too general” RQs (your “short response” behavior) */
const GENERAL_CUES = {
  stems: [
    "what are the challenges",
    "what are the problems",
    "what are the issues",
    "what challenges do",
    "what problems do",
    "what issues do",
    "what is the effect",
    "how does",
    "what factors",
    "what is the relationship"
  ],
  qualifiers: [
    "in ",
    "among ",
    "during ",
    "within ",
    "at ",
    "for ",
    "based on ",
    "in terms of ",
    "with respect to ",
    "from the perspective",
    "as experienced",
    "as perceived",
    "in one section",
    "in our school",
    "at padada",
    "grade 11 eros",
    "strand",
    "semester",
    "quarter",
    "2025",
    "2026",
    "this school year"
  ]
};

/* “LLM-like” micro tips for sources */
const SOURCE_MICRO_TIPS = {
  interview: "Use 6–10 short interviews (10–15 minutes). Prepare 6–8 guide questions and audio-record with consent.",
  focus_group: "Use 1–2 FGDs (6–8 participants). Keep it 30–45 minutes and use clear ground rules.",
  observation: "Use an observation checklist (study routines, use of phone, note-taking). Do 2–3 sessions.",
  document_analysis: "Use existing documents (study planners, modules, reflection journals). Create a simple coding sheet.",
  artifact_analysis: "Use artifacts like notebooks, reviewers, schedules. Compare patterns (frequency, completeness, organization)."
};

/* Rewrite templates to make outputs feel “smart” */
const DESIGN_REWRITE_TEMPLATES = {
  phenomenology: [
    "What are the lived experiences of Grade 11 students regarding their study habits?",
    "How do Grade 11 students describe the meaning of “good study habits” in their daily life?"
  ],
  case_study: [
    "How do Grade 11 students in one section at our school describe the challenges in maintaining study habits during Quarter 3?",
    "How is a study-habit support activity implemented in one Grade 11 class, and what challenges appear during implementation?"
  ],
  ethnography: [
    "What study-culture norms (unwritten rules) shape how Grade 11 students study in this strand/section?",
    "How do peer norms and shared practices influence study habits among Grade 11 students in this group?"
  ],
  grounded_theory: [
    "How do Grade 11 students develop (or fail to develop) consistent study habits over the quarter, and what stages do they go through?",
    "What process explains how Grade 11 students decide whether to study or to delay studying?"
  ],
  narrative_inquiry: [
    "What stories do Grade 11 students tell about how their study habits changed from the start to the end of the quarter?",
    "What turning points do Grade 11 students describe in improving or worsening their study habits?"
  ]
};

/* ---------- Build: keyword-based alignment engine (v2) ---------- */
const BUILD_V2 = {
  designCues: {
    phenomenology: {
      label: "Phenomenology",
      patterns: [
        /\b(lived experience|lived experiences)\b/,
        /\b(what is it like)\b/,
        /\b(experience|experiences)\b/,
        /\b(meaning|means to|what .* means)\b/,
        /\b(feel|feels|feeling|feelings|emotions?)\b/,
        /\b(perception|perceptions|perspective|perspectives|view|views)\b/,
        /\b(challenges?|struggles?|stress|anxiety|pressure)\b/,
        /\b(coping|cope|deal with|manage)\b/
      ],
      reason: "The wording points to lived experience, perceptions, or meaning—typical of phenomenology."
    },
    case_study: {
      label: "Case Study",
      patterns: [
        /\b(case study|case of)\b/,
        /\b(this school|our school)\b/,
        /\b(section|class|advisory|strand)\b/,
        /\b(program|project|intervention|initiative|policy)\b/,
        /\b(implementation|rollout|pilot)\b/,
        /\b(bounded|specific group)\b/
      ],
      reason: "It mentions a bounded setting (one class/school/program), which fits a case study."
    },
    ethnography: {
      label: "Ethnography",
      patterns: [
        /\b(culture|subculture)\b/,
        /\b(norms?|unwritten rules|shared rules)\b/,
        /\b(tradition|traditions|rituals?)\b/,
        /\b(values|beliefs)\b/,
        /\b(group identity|identity)\b/,
        /\b(community|club|organization)\b/,
        /\b(shared practices|common practices|ways of)\b/
      ],
      reason: "It focuses on group culture, norms, and shared practices—typical of ethnography."
    },
    grounded_theory: {
      label: "Grounded Theory",
      patterns: [
        /\b(grounded theory)\b/,
        /\b(process|processes)\b/,
        /\b(stages?|steps?)\b/,
        /\b(develops?|forms?|emerges?)\b/,
        /\b(how .* happens)\b/,
        /\b(model|framework|theory)\b/,
        /\b(mechanism|pathway)\b/,
        /\b(decision[- ]making|how .* decide|how .* choose)\b/
      ],
      reason: "It asks for an explanation of a process (how something develops), which fits grounded theory."
    },
    narrative_inquiry: {
      label: "Narrative Inquiry",
      patterns: [
        /\b(narrative|narratives)\b/,
        /\b(story|stories|life story)\b/,
        /\b(journey)\b/,
        /\b(turning point|milestone)\b/,
        /\b(over time|through time|across time)\b/,
        /\b(since|from .* to)\b/,
        /\b(before and after)\b/
      ],
      reason: "It uses story/journey/time language—typical of narrative inquiry."
    }
  },

  sourceHints: {
    phenomenology: ["interview", "focus_group"],
    case_study: ["interview", "observation", "document_analysis", "artifact_analysis"],
    ethnography: ["observation", "interview", "artifact_analysis", "document_analysis"],
    grounded_theory: ["interview", "focus_group", "document_analysis"],
    narrative_inquiry: ["interview", "document_analysis", "artifact_analysis"]
  }
};

function buildInferDesignV2(text){
  const t = _norm(text || "");
  const scores = {};
  const hits = {};

  for(const [id, rule] of Object.entries(BUILD_V2.designCues)){
    let s = 0;
    const matched = [];
    for(const re of rule.patterns){
      if(re.test(t)){
        const src = re.source || "";
        const strong =
          src.includes("lived experience") ||
          src.includes("what is it like") ||
          src.includes("culture") ||
          src.includes("unwritten rules") ||
          src.includes("process") ||
          src.includes("stages") ||
          src.includes("over time") ||
          src.includes("turning point") ||
          src.includes("intervention") ||
          src.includes("case study");
        s += strong ? 2 : 1;
        matched.push(src);
      }
    }
    scores[id] = s;
    hits[id] = matched;
  }

  const ranked = Object.keys(scores).sort((a,b)=> scores[b] - scores[a]);
  const top = ranked[0];
  const second = ranked[1];
  const topScore = scores[top] || 0;
  const secondScore = scores[second] || 0;

  let confidence = "none";
  if(topScore >= 5 && topScore >= secondScore + 2) confidence = "strong";
  else if(topScore >= 3 && topScore >= secondScore + 1) confidence = "medium";
  else if(topScore >= 2) confidence = "weak";

  const suggested = (confidence === "none") ? "" : top;
  const reason = suggested ? (BUILD_V2.designCues[suggested]?.reason || "") : "";

  return { suggested, confidence, topScore, secondScore, scores, hits, reason };
}

function buildAlignmentFeedbackV2({topic, rq, chosenDesign, chosenSource, bankRef}){
  const joined = _norm(`${topic || ""} ${rq || ""}`);
  const inf = buildInferDesignV2(joined);

  const suggested = inf.suggested;
  const sugLabel = suggested ? (bankRef.DESIGN_LABELS[suggested] || suggested) : "";
  const chosenLabel = chosenDesign ? (bankRef.DESIGN_LABELS[chosenDesign] || chosenDesign) : "";

  const rqNorm = _norm(rq || "");
  const isGenericStem = GENERAL_CUES.stems.some(st => rqNorm.startsWith(st) || rqNorm.includes(st));
  const hasQualifier = _hasAny(rqNorm, GENERAL_CUES.qualifiers);
  const looksGeneral = isGenericStem && !hasQualifier;

  let alignment_flag = "ok";
  let badgeLabel = "Needs more clue";
  let feedback =
    "Your RQ is still broad. Add clearer clues: lived experience/meaning, culture/norms, a bounded class/program, a process/steps, or a story over time.";

  // If very general and no suggestion, give your “short response”
  if(looksGeneral && !suggested){
    badgeLabel = "A bit general";
    feedback =
      "This is a good start, but it’s a bit general. Add a clue so the design becomes obvious (lived experience/meaning, culture/norms, a bounded class/program, a process, or a story over time).";
    // give 2 rewrites (best for “challenges” is usually Phenomenology + Case Study)
    feedback += ` Try rewriting like: “${DESIGN_REWRITE_TEMPLATES.phenomenology[0]}” or “${DESIGN_REWRITE_TEMPLATES.case_study[0]}”`;
    return {
      suggested_design_id: "",
      alignment_flag,
      badgeLabel,
      feedback_text: feedback
    };
  }

  if(suggested){
    const whyLine = inf.reason ? `Why: ${inf.reason}` : "";
    const confidenceTag =
      inf.confidence === "strong" ? "Strong signal." :
      inf.confidence === "medium" ? "Good signal." :
      "Possible signal.";

    if(!chosenDesign){
      badgeLabel = `Suggested: ${sugLabel}`;
      feedback = `${confidenceTag} ${whyLine} Suggested design: ${sugLabel}. Pick a design, then check again.`;
    } else if(chosenDesign === suggested){
      alignment_flag = (inf.confidence === "weak") ? "ok" : "good";
      badgeLabel = (alignment_flag === "good") ? "Aligned" : "Likely aligned";

      if(looksGeneral){
        feedback =
          `Your chosen design (${chosenLabel}) is reasonable, but your RQ is still a bit general. Add a concrete qualifier (timeframe, setting, or specific group) to make the study doable in one week.`;
      } else {
        feedback = `${whyLine} Your chosen design (${chosenLabel}) matches your RQ intent.`;
      }

      if(chosenSource){
        const tip = SOURCE_MICRO_TIPS[chosenSource];
        if(tip) feedback += ` Data source tip: ${tip}`;
      } else {
        const rec = BUILD_V2.sourceHints[suggested] || [];
        if(rec.length){
          const recLabels = rec.map(id=> bankRef.SOURCE_LABELS[id]).filter(Boolean).join(" / ");
          feedback += ` Next: choose a data source (common picks for ${sugLabel}: ${recLabels}).`;
        }
      }
    } else {
      if(inf.confidence === "strong"){
        alignment_flag = "mismatch";
        badgeLabel = `Mismatch (suggested: ${sugLabel})`;
        feedback = `${whyLine} Your wording leans strongly toward ${sugLabel}, but you chose ${chosenLabel}. Either revise your RQ to fit ${chosenLabel}, or switch your design to ${sugLabel}.`;
      } else {
        badgeLabel = `Check fit (suggested: ${sugLabel})`;
        feedback = `${whyLine} Your RQ could fit more than one design. It slightly leans toward ${sugLabel}, but you chose ${chosenLabel}. Make your wording more specific so your choice is clear.`;
      }
    }

    const rewrites = DESIGN_REWRITE_TEMPLATES[suggested] || [];
    if(rewrites.length){
      feedback += ` Try rewriting like: “${rewrites[0]}”`;
      if(rewrites[1]) feedback += ` or “${rewrites[1]}”`;
    }

    if(chosenSource){
      const rec = BUILD_V2.sourceHints[suggested] || [];
      if(rec.length && !rec.includes(chosenSource)){
        const recLabels = rec.map(id=> bankRef.SOURCE_LABELS[id]).filter(Boolean).join(" or ");
        feedback += ` For ${sugLabel}, a more typical data source is ${recLabels}.`;
      }
    }

    return {
      suggested_design_id: suggested,
      alignment_flag,
      badgeLabel,
      feedback_text: feedback
    };
  }

  // No suggestion but not fully generic
  badgeLabel = looksGeneral ? "A bit general" : "Needs more clue";
  feedback = looksGeneral
    ? "This is a good start, but it’s a bit general. Add a clue so the design becomes obvious (lived experience/meaning, culture/norms, a bounded class/program, a process, or a story over time)."
    : "Your RQ is understandable, but it does not clearly signal one design yet. Add wording about experience/meaning, culture/norms, a bounded case, a process, or a story over time.";

  return {
    suggested_design_id: "",
    alignment_flag,
    badgeLabel,
    feedback_text: feedback
  };
}

function suggestDesignFromRQ(text){
  const inf = buildInferDesignV2(text || "");
  return inf.suggested || "";
}

function initBuild(b){
  const seed = getSeed();
  const pid = getPid() || "__anon__";

  const dSel = $("#b_design");
  const sSel = $("#b_source");
  dSel.innerHTML = `<option value="">Select…</option>` +
    Object.keys(b.DESIGN_LABELS).map(id=>`<option value="${id}">${b.DESIGN_LABELS[id]}</option>`).join("");
  sSel.innerHTML = `<option value="">Select…</option>` +
    Object.keys(b.SOURCE_LABELS).map(id=>`<option value="${id}">${b.SOURCE_LABELS[id]}</option>`).join("");

  const draftK = `qm_build_draft_${pid}_${seed}`;
  const draft = readJSON(draftK, null);
  if(draft){
    $("#b_topic").value = draft.topic || "";
    $("#b_rq").value = draft.rq_text || "";
    $("#b_design").value = draft.chosen_design_id || "";
    $("#b_source").value = draft.chosen_source_id || "";
  }

  function saveDraft(){
    const pidNow = getPid() || "__anon__";
    const k = `qm_build_draft_${pidNow}_${seed}`;
    writeJSON(k, {
      topic: $("#b_topic").value || "",
      rq_text: $("#b_rq").value || "",
      chosen_design_id: $("#b_design").value || "",
      chosen_source_id: $("#b_source").value || ""
    });
  }
  ["b_topic","b_rq","b_design","b_source"].forEach(id=>{
    const el = $("#"+id);
    if(!el) return;
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", saveDraft);
  });

  $("#alignBtn").addEventListener("click", ()=>{
    const rq = ($("#b_rq").value||"").trim();
    if(!rq){ toast("Write your research question first."); $("#b_rq").focus(); return; }

    const topic = ($("#b_topic").value||"").trim();
    const chosenDesign = ($("#b_design").value||"").trim();
    const chosenSource = ($("#b_source").value||"").trim();

    const out = buildAlignmentFeedbackV2({
      topic,
      rq,
      chosenDesign,
      chosenSource,
      bankRef: b
    });

    // Optional “LLM-like” auto-fill design when strong/medium and user hasn't chosen yet
    try{
      const inf = buildInferDesignV2(`${topic} ${rq}`);
      if(!chosenDesign && inf.suggested && (inf.confidence === "strong" || inf.confidence === "medium")){
        $("#b_design").value = inf.suggested;
        saveDraft();
      }
    }catch(e){}

    $("#alignBadge").style.display = "inline-flex";
    $("#alignBadge").className = "badge " + (out.alignment_flag==="good" ? "good" : (out.alignment_flag==="mismatch" ? "bad" : "warn"));
    $("#alignBadge").innerHTML = `<strong>${out.badgeLabel}</strong>`;

    $("#alignText").style.display = "block";
    $("#alignText").className = "callout " + (out.alignment_flag==="good" ? "good" : (out.alignment_flag==="mismatch" ? "bad" : "warn"));
    $("#alignText").textContent = out.feedback_text;

    window.__BUILD_ALIGN__ = {
      suggested_design_id: out.suggested_design_id,
      alignment_flag: out.alignment_flag,
      feedback_text: out.feedback_text
    };
  });

  $("#saveBuildBtn").addEventListener("click", ()=>{
    const pidNow = getPid() || "__anon__";
    if(pidNow === "__anon__"){ toast("Enter your participant code first."); $("#pidInput")?.focus(); return; }

    const topic = ($("#b_topic").value||"").trim();
    const rq = ($("#b_rq").value||"").trim();
    const d = ($("#b_design").value||"").trim();
    const s = ($("#b_source").value||"").trim();
    if(!rq || !d || !s){ toast("Fill in your RQ, Design, and Data source."); return; }

    if(!window.__BUILD_ALIGN__){
      const out = buildAlignmentFeedbackV2({
        topic,
        rq,
        chosenDesign: d,
        chosenSource: s,
        bankRef: b
      });
      window.__BUILD_ALIGN__ = {
        suggested_design_id: out.suggested_design_id,
        alignment_flag: out.alignment_flag,
        feedback_text: out.feedback_text
      };
    }
    const align = window.__BUILD_ALIGN__ || {suggested_design_id:"", alignment_flag:"ok", feedback_text:""};

    const row = {
      pid: pidNow,
      phase:"build",
      topic: topic,
      rq_text: rq,
      chosen_design_id: d,
      chosen_source_id: s,
      suggested_design_id: align.suggested_design_id || "",
      alignment_flag: align.alignment_flag || "ok",
      feedback_text: align.feedback_text || "",
      timestamp_iso: new Date().toISOString(),
      seed
    };

    writeJSON(`qm_build_last_${pidNow}_${seed}`, row);
    $("#buildSaved").style.display = "inline-flex";
    toast("Saved. Download your CSV.");
  });

  $("#downloadBuildBtn").addEventListener("click", ()=>{
    const pidNow = getPid() || "__anon__";
    if(pidNow === "__anon__"){ toast("Enter your participant code first."); return; }
    const row = readJSON(`qm_build_last_${pidNow}_${seed}`, null);
    if(!row){ toast("No saved build entry yet."); return; }

    const lines = [BUILD_HEADERS.join(","), csvLine(BUILD_HEADERS, row)];
    downloadText(`build_${pidNow}_${seed}.csv`, lines.join("\n"));
  });

  $("#resetBuildBtn").addEventListener("click", ()=>{
    const pidNow = getPid() || "__anon__";
    delKey(`qm_build_last_${pidNow}_${seed}`);
    delKey(`qm_build_draft_${pidNow}_${seed}`);
    $("#b_topic").value=""; $("#b_rq").value=""; $("#b_design").value=""; $("#b_source").value="";
    $("#alignBadge").style.display = "none";
    $("#alignText").style.display = "none";
    $("#buildSaved").style.display = "none";
    window.__BUILD_ALIGN__ = null;
    toast("Cleared build draft.");
  });
}

/* ---------- Instruction page helpers ---------- */
function wireSeedLinks(){
  const seed = getSeed();
  $$(".seedLink").forEach(a=>{
    const href = a.getAttribute("href") || "";
    if(href.includes("?seed=")) return;
    a.setAttribute("href", href + (href.includes("?") ? "&" : "?") + "seed=" + encodeURIComponent(seed));
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  setActiveNav();
  mountPid();
  wireSeedLinks();
  const seedEl = $("#seedText");
  if(seedEl) seedEl.textContent = getSeed();

  const b = bank();
  if(!b && page !== "instruction" && page !== "index") return;

  if(page === "pretest"){
    renderQuiz("pretest", b.PRETEST_ITEMS, b);
    $("#submitBtn").addEventListener("click", ()=> submitQuiz("pretest", b.PRETEST_ITEMS, b));
    $("#downloadBtn").addEventListener("click", ()=> downloadQuizCSV("pretest"));
    $("#resetBtn").addEventListener("click", ()=> { resetQuiz("pretest"); renderQuiz("pretest", b.PRETEST_ITEMS, b); });
    return;
  }

  if(page === "posttest"){
    renderQuiz("posttest", b.POSTTEST_ITEMS, b);
    $("#submitBtn").addEventListener("click", ()=> submitQuiz("posttest", b.POSTTEST_ITEMS, b));
    $("#downloadBtn").addEventListener("click", ()=> downloadQuizCSV("posttest"));
    $("#resetBtn").addEventListener("click", ()=> { resetQuiz("posttest"); renderQuiz("posttest", b.POSTTEST_ITEMS, b); });
    return;
  }

  if(page === "practice"){
    renderPractice(b.PRACTICE_CARDS, b);
    $("#downloadPracticeBtn").addEventListener("click", downloadPracticeCSV);
    $("#resetPracticeBtn").addEventListener("click", resetPractice);
    return;
  }

  if(page === "build"){
    initBuild(b);
    return;
  }
});
