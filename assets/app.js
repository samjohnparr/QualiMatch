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

/* ---------- QUIZ (Pre / Post) ---------- */
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

  // deterministic item order
  const ordered = shuffle(items, rngFrom(`${seed}|${phase}|order`));

  ensureTimerStarted(phase, seed);

  const progK = keyProgress(phase, pid, seed);
  const prog = readJSON(progK, {}); // item_id -> {d,s}

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

  // if last submission exists, show it (so learners can still download after refresh)
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

  // validate
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

  // Store last submission (so it doesn't “disappear”)
  writeJSON(keyLast(phase, pid, seed), {rows: perRows, summary});

  // UI
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
  lines.push(""); // spacer
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

/* ---------- PRACTICE ---------- */
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
          <select data-role="d">
            <option value="">Select…</option>
            ${Object.keys(b.DESIGN_LABELS).map(id=>`<option value="${id}">${b.DESIGN_LABELS[id]}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Data source</label>
          <select data-role="s">
            <option value="">Select…</option>
            ${Object.keys(b.SOURCE_LABELS).map(id=>`<option value="${id}">${b.SOURCE_LABELS[id]}</option>`).join("")}
          </select>
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

    // shuffle options deterministically per card
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

/* ---------- BUILD ---------- */
const BUILD_HEADERS = [
  "pid","phase","topic","rq_text","chosen_design_id","chosen_source_id",
  "suggested_design_id","alignment_flag","feedback_text","timestamp_iso","seed"
];

// ---------- Build: keyword-based alignment engine (v2) ----------
const BUILD_V2 = {
  designCues: {
    phenomenology: {
      label: "Phenomenology",
      // lived experience / meaning / feelings / perceptions
      patterns: [
        /\b(lived experience|lived experiences)\b/,
        /\b(experience|experiences)\b/,
        /\b(meaning|means to|what .* means)\b/,
        /\b(feel|feels|feeling|feelings|emotions?)\b/,
        /\b(perception|perceptions|perspective|perspectives|view|views)\b/,
        /\b(challenges?|struggles?|stress|anxiety|pressure)\b/,
        /\b(coping|cope|deal with|manage)\b/,
        /\b(what is it like)\b/
      ],
      reason: "Words about experience/meaning/feelings usually fit phenomenology."
    },
    case_study: {
      label: "Case Study",
      // bounded case: one class/section/school/program
      patterns: [
        /\b(case study|case of)\b/,
        /\b(this school|our school|in (our|this) school)\b/,
        /\b(section|class|advisory|strand)\b/,
        /\b(program|project|intervention|initiative|policy)\b/,
        /\b(implementation|rollout|pilot)\b/,
        /\b(bounded|specific group)\b/
      ],
      reason: "Mentioning one specific class/school/program signals a bounded case (case study)."
    },
    ethnography: {
      label: "Ethnography",
      // culture / norms / traditions / group ways
      patterns: [
        /\b(culture|subculture)\b/,
        /\b(norms?|unwritten rules|shared rules)\b/,
        /\b(tradition|traditions|rituals?)\b/,
        /\b(values|beliefs)\b/,
        /\b(group identity|identity)\b/,
        /\b(community|club|organization)\b/,
        /\b(shared practices|common practices|ways of)\b/
      ],
      reason: "Culture/norms/traditions of a group commonly point to ethnography."
    },
    grounded_theory: {
      label: "Grounded Theory",
      // process / stages / how something develops
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
      reason: "If your RQ is about building an explanation of a process, it fits grounded theory."
    },
    narrative_inquiry: {
      label: "Narrative Inquiry",
      // story over time / journey / life story
      patterns: [
        /\b(narrative|narratives)\b/,
        /\b(story|stories|life story)\b/,
        /\b(journey)\b/,
        /\b(turning point|milestone)\b/,
        /\b(over time|through time|across time)\b/,
        /\b(since|from .* to)\b/,
        /\b(before and after)\b/
      ],
      reason: "Story/journey over time fits narrative inquiry."
    }
  },

  // optional: data source hints per design
  sourceHints: {
    phenomenology: ["interview", "focus_group"],
    case_study: ["interview", "observation", "document_analysis", "artifact_analysis"],
    ethnography: ["observation", "interview", "artifact_analysis", "document_analysis"],
    grounded_theory: ["interview", "focus_group", "document_analysis"],
    narrative_inquiry: ["interview", "document_analysis", "artifact_analysis"]
  }
};

function buildInferDesignV2(text){
  const t = (text || "").toLowerCase();
  const scores = {};
  const hits = {};

  for(const [id, rule] of Object.entries(BUILD_V2.designCues)){
    let s = 0;
    const matched = [];
    for(const re of rule.patterns){
      if(re.test(t)){ s += 1; matched.push(re.source); }
    }
    scores[id] = s;
    hits[id] = matched;
  }

  // pick top
  const ranked = Object.keys(scores).sort((a,b)=> scores[b] - scores[a]);
  const top = ranked[0];
  const second = ranked[1];
  const topScore = scores[top] || 0;
  const secondScore = scores[second] || 0;

  // confidence heuristic
  // - strong: >=3 and beats second by >=1
  // - medium: >=2
  // - weak: 1
  let confidence = "none";
  if(topScore >= 3 && topScore >= secondScore + 1) confidence = "strong";
  else if(topScore >= 2) confidence = "medium";
  else if(topScore === 1) confidence = "weak";

  const suggested = (confidence === "none") ? "" : top;

  // compact reason
  let reason = "";
  if(suggested){
    const rule = BUILD_V2.designCues[suggested];
    reason = rule?.reason || "";
  }

  return {
    suggested, confidence,
    topScore, secondScore,
    scores, hits,
    reason
  };
}

function buildAlignmentFeedbackV2({topic, rq, chosenDesign, chosenSource, bankRef}){
  const joined = `${topic || ""} ${rq || ""}`.trim();
  const inf = buildInferDesignV2(joined);

  const suggested = inf.suggested;
  const sugLabel = suggested ? (bankRef.DESIGN_LABELS[suggested] || suggested) : "";
  const chosenLabel = chosenDesign ? (bankRef.DESIGN_LABELS[chosenDesign] || chosenDesign) : "";

  // default (general)
  let alignment_flag = "ok";
  let badgeLabel = "Needs more clue";
  let feedback = "Your RQ is still broad. Add clearer clues: lived experience/meaning, culture/norms, a bounded class/program, a process/steps, or a story over time.";

  // If we have a suggestion
  if(suggested){
    // Start with WHY
    const whyLine = inf.reason ? `Why: ${inf.reason} ` : "";

    if(!chosenDesign){
      alignment_flag = "ok";
      badgeLabel = `Suggested: ${sugLabel}`;
      feedback = `${whyLine}Suggested design: ${sugLabel}. Now select a design and check again to see if it aligns.`;
    } else if(chosenDesign === suggested){
      // aligned, but we can scale by confidence
      alignment_flag = (inf.confidence === "weak") ? "ok" : "good";
      badgeLabel = (alignment_flag === "good") ? "Aligned" : "Likely aligned";
      feedback = `${whyLine}Your chosen design (${chosenLabel}) matches what your RQ is asking. Next, choose a data source you can collect within one week.`;
    } else {
      // mismatch severity depends on confidence
      if(inf.confidence === "strong"){
        alignment_flag = "mismatch";
        badgeLabel = `Mismatch (suggested: ${sugLabel})`;
        feedback = `${whyLine}Your RQ wording leans strongly toward ${sugLabel}, but you selected ${chosenLabel}. Either revise the RQ to fit ${chosenLabel} or switch your design to ${sugLabel}.`;
      } else {
        alignment_flag = "ok";
        badgeLabel = `Check fit (suggested: ${sugLabel})`;
        feedback = `${whyLine}Your RQ could fit more than one design. It slightly leans toward ${sugLabel}, but you chose ${chosenLabel}. Make your wording more specific so the design choice is clear.`;
      }
    }

    // Add optional data source hint (if a source is chosen)
    if(chosenSource){
      const recommended = BUILD_V2.sourceHints[suggested] || [];
      if(recommended.length && !recommended.includes(chosenSource)){
        const recLabels = recommended.map(id=> bankRef.SOURCE_LABELS[id]).filter(Boolean).join(" or ");
        feedback += ` Data source tip: For ${sugLabel}, students usually use ${recLabels}.`;
      }
    }
  }

  return {
    suggested_design_id: suggested,
    alignment_flag,
    badgeLabel,
    feedback_text: feedback
  };
}


function suggestDesignFromRQ(text){
  // keep function for compatibility, but use v2 inference
  const inf = buildInferDesignV2(text || "");
  return inf.suggested || "";
}


function initBuild(b){
  const seed = getSeed();
  const pid = getPid() || "__anon__";

  // populate dropdowns
  const dSel = $("#b_design");
  const sSel = $("#b_source");
  dSel.innerHTML = `<option value="">Select…</option>` +
    Object.keys(b.DESIGN_LABELS).map(id=>`<option value="${id}">${b.DESIGN_LABELS[id]}</option>`).join("");
  sSel.innerHTML = `<option value="">Select…</option>` +
    Object.keys(b.SOURCE_LABELS).map(id=>`<option value="${id}">${b.SOURCE_LABELS[id]}</option>`).join("");

  // restore draft
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

  $("#alignBadge").style.display = "inline-flex";
  $("#alignBadge").className = "badge " + (out.alignment_flag==="good" ? "good" : (out.alignment_flag==="mismatch" ? "bad" : "warn"));
  $("#alignBadge").innerHTML = `<strong>${out.badgeLabel}</strong>`;

  $("#alignText").style.display = "block";
  $("#alignText").className = "callout " + (out.alignment_flag==="good" ? "good" : (out.alignment_flag==="mismatch" ? "bad" : "warn"));
  $("#alignText").textContent = out.feedback_text;

  // store for CSV
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

    // If learner didn't click "Check alignment", run it once automatically
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
