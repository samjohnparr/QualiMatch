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

function suggestDesignFromRQ(text){
  const t = (text||"").toLowerCase();

  const has = (re)=> re.test(t);

  // narrative inquiry: life story / journey / over time
  if(has(/\b(journey|life story|narrative|story of|over time|since)\b/)) return "narrative_inquiry";

  // ethnography: culture / norms / traditions / group practices
  if(has(/\b(culture|norms|tradition|ritual|shared practices|community|club|group identity)\b/)) return "ethnography";

  // case study: bounded program/class/school, specific case
  if(has(/\b(case|program|intervention|project|section|class\b|school\b|implementation)\b/)) return "case_study";

  // grounded theory: process / stages / explain how it develops
  if(has(/\b(process|stages|how.*develops|how.*forms|model|theory)\b/)) return "grounded_theory";

  // phenomenology: lived experience / meaning / feelings
  if(has(/\b(lived experience|experience of|meaning of|how.*feel|perceptions?|sense of)\b/)) return "phenomenology";

  return "";
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

    const suggested = suggestDesignFromRQ(rq);
    const chosen = ($("#b_design").value||"").trim();

    let flag = "ok";
    let label = "Try to be more specific";
    let fb = "Your RQ is a bit general. Add clues like lived experience, culture/norms, a bounded program/class, a process, or a story over time.";

    if(suggested){
      const sugLabel = b.DESIGN_LABELS[suggested];
      if(!chosen){
        flag = "ok";
        label = `Suggested: ${sugLabel}`;
        fb = `Your RQ wording looks most similar to ${sugLabel}. Select a design, then check again.`;
      } else if(chosen === suggested){
        flag = "good";
        label = "Aligned";
        fb = "Your chosen design matches your RQ intent. Next, pick a data source that you can realistically collect within one week.";
      } else {
        flag = "mismatch";
        label = `Mismatch (suggested: ${sugLabel})`;
        fb = `Your RQ wording suggests ${sugLabel}, but you selected a different design. Either revise the RQ wording or change your design choice so they match.`;
      }
    }

    $("#alignBadge").style.display = "inline-flex";
    $("#alignBadge").className = "badge " + (flag==="good" ? "good" : (flag==="mismatch" ? "bad" : "warn"));
    $("#alignBadge").innerHTML = `<strong>${label}</strong>`;
    $("#alignText").style.display = "block";
    $("#alignText").className = "callout " + (flag==="good" ? "good" : (flag==="mismatch" ? "bad" : "warn"));
    $("#alignText").textContent = fb;

    window.__BUILD_ALIGN__ = { suggested_design_id: suggested, alignment_flag: flag, feedback_text: fb };
  });

  $("#saveBuildBtn").addEventListener("click", ()=>{
    const pidNow = getPid() || "__anon__";
    if(pidNow === "__anon__"){ toast("Enter your participant code first."); $("#pidInput")?.focus(); return; }

    const topic = ($("#b_topic").value||"").trim();
    const rq = ($("#b_rq").value||"").trim();
    const d = ($("#b_design").value||"").trim();
    const s = ($("#b_source").value||"").trim();
    if(!rq || !d || !s){ toast("Fill in your RQ, Design, and Data source."); return; }

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
