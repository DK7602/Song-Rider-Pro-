/* app.js (FULL REPLACE MAIN v44) */
(() => {

"use strict";

/***********************
FORCE-NUKE OLD SERVICE WORKER CACHE
***********************/
try{
  if("serviceWorker" in navigator){
    navigator.serviceWorker.getRegistrations()
      .then(rs => rs.forEach(r => r.unregister()))
      .catch(()=>{});
  }
}catch{}

/***********************
Utils
***********************/
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const now = () => Date.now();
function clampToViewport(el, pad=12){
  if(!el) return;

  el.style.position = "fixed";
  el.style.maxWidth  = `calc(100vw - ${pad*2}px)`;
  el.style.maxHeight = `calc(100vh - ${pad*2}px)`;
  el.style.overflow  = "auto";

  const r = el.getBoundingClientRect();
  let left = r.left;
  let top  = r.top;

  if(r.right > window.innerWidth - pad) left -= (r.right - (window.innerWidth - pad));
  if(r.left  < pad)                    left += (pad - r.left);

  if(r.bottom > window.innerHeight - pad) top -= (r.bottom - (window.innerHeight - pad));
  if(r.top    < pad)                      top += (pad - r.top);

  el.style.left = `${left}px`;
  el.style.top  = `${top}px`;
}
function uuid(){
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

/***********************
DOM
***********************/
const el = {
horseWrap: $("horseWrap"),
horseRight: $("horseRight"),
horseLeft: $("horseLeft"),

   uploadAudioBtn: $("uploadAudioBtn"),
  beat1Btn: $("beat1Btn"),
  nowPlaying: $("nowPlaying"),

  
  togglePanelBtn: $("togglePanelBtn"),
  panelBody: $("panelBody"),
  miniBar: $("miniBar"),

 undoBtn: $("undoBtn"),
redoBtn: $("redoBtn"),
saveBtn: $("saveBtn"),
  bpmInput: $("bpmInput"),
  capoInput: $("capoInput"),
  keyOutput: $("keyOutput"),

  instAcoustic: $("instAcoustic"),
  instElectric: $("instElectric"),
  instPiano: $("instPiano"),

  // note-length buttons
  instDots: $("instDots"),
  instTieBar: $("instTieBar"),

  exportBtn: $("exportBtn"),

  drumRock: $("drumRock"),
  drumHardRock: $("drumHardRock"),
  drumPop: $("drumPop"),
  drumRap: $("drumRap"),

  mRock: $("mRock"),
  mHardRock: $("mHardRock"),
  mPop: $("mPop"),
  mRap: $("mRap"),

  autoPlayBtn: $("autoPlayBtn"),
  mScrollBtn: $("mScrollBtn"),

  recordBtn: $("recordBtn"),
  mRecordBtn: $("mRecordBtn"),

  sortSelect: $("sortSelect"),
  projectSelect: $("projectSelect"),
  newProjectBtn: $("newProjectBtn"),
  renameProjectBtn: $("renameProjectBtn"),
  deleteProjectBtn: $("deleteProjectBtn"),

  recordingsList: $("recordingsList"),

  tabs: $("tabs"),
  sheetTitle: $("sheetTitle"),
  sheetHint: $("sheetHint"),
  sheetBody: $("sheetBody"),
  sheetActions: $("sheetActions"),

  rBtn: $("rBtn"),
  rhymeDock: $("rhymeDock"),
  hideRhymeBtn: $("hideRhymeBtn"),
  rhymeWords: $("rhymeWords"),
  rhymeTitle: $("rhymeTitle")
};
/***********************
SRP -> BSP CARD SIZE + FONT MATCH (CSS OVERRIDES)
- Bigger cards like Beat Sheet Pro
- Bigger + bolder lyric + beat fonts
- Keeps your existing colors
***********************/
function injectBspCardLook(){
  // prevent duplicates on hot reload
  const old = document.getElementById("srpBspCardLook");
  if(old) old.remove();

  const style = document.createElement("style");
  style.id = "srpBspCardLook";
  style.textContent = `
    /* ===== REEL-IN CARD LOOK (2 cards visible, smaller text) ===== */

    .cards{
      padding-bottom: 18px;
    }

    .card{
      position: relative !important;      /* needed for + / × positioning */
      margin: 10px 0 !important;          /* tighter so 2 cards fit */
      padding: 12px !important;
      border-radius: 16px !important;
      padding-top: 44px !important;       /* room for + / × */
    }

    /* Top row (number + syllables pill) smaller */
    .cardTop{
      gap: 10px !important;
      margin-bottom: 8px !important;
      align-items: center !important;
    }
    .cardNum{
      width: 34px !important;
      height: 34px !important;
      font-size: 16px !important;
      font-weight: 800 !important;
      display:flex !important;
      align-items:center !important;
      justify-content:center !important;
    }
    .syllPill{
      font-size: 14px !important;
      font-weight: 700 !important;
      padding: 7px 10px !important;
      border-radius: 14px !important;
    }

    /* Notes row tighter + smaller */
    .notesRow{
      gap: 8px !important;
      margin-bottom: 10px !important;
    }
    input.noteCell{
      height: 40px !important;
      min-height: 40px !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      border-radius: 12px !important;
      text-align: center !important;
    }

    /* LYRICS: smaller + shorter so 2 cards show */
    textarea.lyrics{
      font-size: 17px !important;
      font-weight: 600 !important;
      line-height: 1.18 !important;
      padding: 9px !important;
      border-radius: 12px !important;
      min-height: 70px !important;
    }

    /* Beat boxes: smaller + shorter */
    textarea.beatCell{
      font-size: 13px !important;
      font-weight: 600 !important;
      line-height: 1.15 !important;
      padding: 7px !important;
      border-radius: 12px !important;
      min-height: 44px !important;
    }

    /* ===== FIX: + and × spacing ===== */
    .cardAdd, .cardDel{
      position: absolute !important;
      top: 10px !important;
      width: 34px !important;
      height: 34px !important;
      font-size: 18px !important;
      border-radius: 12px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
      line-height: 1 !important;
    }

    .cardDel{ right: 10px !important; }
    .cardAdd{ right: 52px !important; }
  `;

  document.head.appendChild(style);
}
function injectHeaderMiniIconBtnStyle(){
  const old = document.getElementById("srpMiniIconBtnStyle");
  if(old) old.remove();

  const style = document.createElement("style");
  style.id = "srpMiniIconBtnStyle";
  style.textContent = `
    .miniIconBtn{
      width:34px;
      height:34px;
      border-radius:999px;
      border:1px solid rgba(0,0,0,.18);
      background:#fff;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-weight:900;
      line-height:1;
      cursor:pointer;
      box-shadow: 0 6px 14px rgba(0,0,0,.08);
      user-select:none;
      -webkit-tap-highlight-color: transparent;
    }
    .miniIconBtn:active{ transform: translateY(1px); }
    .miniIconBtn[disabled]{
      opacity:.35;
      cursor:default;
      transform:none;
    }
    .miniIconBtn.savedFlash{
      outline: 3px solid rgba(34,197,94,.40);
      box-shadow: 0 0 0 6px rgba(34,197,94,.18);
    }
  `;
  document.head.appendChild(style);
}
function injectHeaderControlTightStyle(){
  const old = document.getElementById("srpHeaderControlTightStyle");
  if(old) old.remove();

  const style = document.createElement("style");
  style.id = "srpHeaderControlTightStyle";
style.textContent = `
  /* ===== TOP CONTROLS ROW: FIT — NO HORIZONTAL SCROLL ===== */
  #topControlsRow{
    display:flex !important;
    flex-wrap:nowrap !important;
    align-items:center !important;
    gap:6px !important;
    overflow:hidden !important;              /* ✅ no scroll */
  }
  #topControlsRow > *{
    flex:0 0 auto !important;
    min-width:0 !important;
  }

  /* ===== BPM: compact ===== */
  #bpmInput{
    width:40px !important;
    min-width:40px !important;
    max-width:40px !important;
    padding:6px 4px !important;
    text-align:center !important;
    font-weight:900 !important;
  }

  /* ===== CAPO/STEP input: slightly tighter ===== */
  #capoInput{
    width:52px !important;
    min-width:52px !important;
    max-width:52px !important;
    padding:6px 6px !important;
    text-align:center !important;
    font-weight:900 !important;
  }

  /* ===== KEY output: slightly tighter ===== */
  #keyOutput{
    width:52px !important;
    min-width:52px !important;
    max-width:52px !important;
    text-align:center !important;
    font-weight:900 !important;
  }

  /* ===== CAPO/STEP vertical pill ===== */
  #capoStepToggle{
    display:inline-flex !important;
    flex:0 0 auto !important;

    width:26px !important;
    height:34px !important;
    padding:0 !important;
    margin-left:0 !important;

    border-radius:999px !important;
    border:1px solid rgba(0,0,0,.18) !important;
    background:#fff !important;

    align-items:center !important;
    justify-content:center !important;

    writing-mode:vertical-rl !important;
    transform:rotate(180deg) !important;

    font-size:11px !important;
    font-weight:900 !important;
    letter-spacing:1px !important;
    line-height:1 !important;

    white-space:nowrap !important;
    overflow:hidden !important;
  }
  #capoStepToggle.on{ background:#111 !important; color:#fff !important; }
`;
  document.head.appendChild(style);
}

/***********************
Active card + active lyrics
***********************/
let lastLyricsTextarea = null;
let lastActiveCardEl = null;

document.addEventListener("focusin", (e) => {
  const t = e.target;

  // ✅ Track BOTH card lyrics textarea AND Full textarea
  if(t && t.tagName === "TEXTAREA" && (t.classList.contains("lyrics") || t.classList.contains("fullBox"))){
    lastLyricsTextarea = t;

    // Only set active card when it's a card textarea
    if(t.classList.contains("lyrics")){
      const card = t.closest(".card");
      if(card) lastActiveCardEl = card;
    }

    refreshRhymesFromActive();
    return;
  }

  if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")){
    const card = t.closest(".card");
    if(card) lastActiveCardEl = card;
  }
});


document.addEventListener("pointerdown", (e) => {
  const card = e.target && e.target.closest ? e.target.closest(".card") : null;
  if(card) lastActiveCardEl = card;

  if(e.target && e.target.tagName === "TEXTAREA" && e.target.classList.contains("lyrics")){
    lastLyricsTextarea = e.target;
    refreshRhymesFromActive();
  }
}, { passive:true });

document.addEventListener("selectionchange", () => {
  if(!lastLyricsTextarea) return;
  if(document.activeElement !== lastLyricsTextarea) return;
  refreshRhymesFromActive();
});

/***********************
Sections (ORDER LOCKED)
***********************/
const SECTIONS = ["Full","VERSE 1","CHORUS 1","VERSE 2","CHORUS 2","VERSE 3","BRIDGE","CHORUS 3"];
const MIN_LINES_PER_SECTION = 1;
/***********************
FULL PAGE (Beat Sheet Pro style)
- User types under headings in one big textarea (Full)
- Blank line = new card
- Auto-fills cards in each section
- DOES NOT change export format (export still prints from cards)
***********************/
const FULL_EDIT_SECTIONS = SECTIONS.filter(s => s !== "Full");

// match headings like "VERSE 1" or "VERSE 1:" (case-insensitive)
function normalizeLineBreaks(s){
  return String(s || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isSectionHeadingLine(line){
  const t = String(line || "").trim().replace(/:$/, "").toUpperCase();
  return FULL_EDIT_SECTIONS.includes(t) ? t : null;
}

// Parse fullText -> { sections: { "VERSE 1":[lyrics1, lyrics2...], ... } }
function parseFullTextToSectionCards(fullText){
  const text = normalizeLineBreaks(fullText);
  const lines = text.split("\n");

  // default start section if user types without heading
  let cur = "VERSE 1";

  const buckets = {};
  FULL_EDIT_SECTIONS.forEach(s => buckets[s] = []);

  let acc = []; // lines accumulating for current card block

  function flushCard(){
    // blank-line ends a card
    const blockLines = acc
  .map(x => String(x || "").trim())
  .filter(Boolean); // ✅ trims whitespace-only lines so they never become “blank cards”
    acc = [];
    if(!blockLines.length) return;

    // IMPORTANT: join with SPACE so we don’t create "\n" inside a card
    // (your card textarea treats "\n" as “split into new card”)
    const lyric = blockLines.join(" ").trim();
    if(lyric) buckets[cur].push(lyric);
  }

  for(const rawLine of lines){
    const line = String(rawLine ?? "");

    const heading = isSectionHeadingLine(line);
    if(heading){
      // finish any pending card in previous section
      flushCard();
      cur = heading;
      continue;
    }

    if(line.trim() === ""){
      flushCard();
      continue;
    }

    acc.push(line);
  }
  flushCard();

  return buckets;
}

// Merge parsed lyrics into existing project.sections
// - preserves existing notes when possible (by index)
// - updates lyrics
// - (optional) auto-splits beats from lyrics when AutoSplit is ON
function applyFullTextToProjectSections(fullText){
  if(!state.project || !state.project.sections) return;

  const parsed = parseFullTextToSectionCards(fullText);

  FULL_EDIT_SECTIONS.forEach(sec => {
    const want = parsed[sec] || [];
    const have = Array.isArray(state.project.sections[sec]) ? state.project.sections[sec] : [];

    const next = [];

    // Build up to want.length cards, reusing existing card objects to preserve notes
    for(let i=0; i<want.length; i++){
      const base = have[i] && typeof have[i] === "object" ? have[i] : newLine();
      base.lyrics = want[i] || "";

      // keep notes; update beats if autosplit is on
      if(state.autoSplit){
        base.beats = autosplitBeatsFromLyrics(base.lyrics);
      }

      next.push(base);
    }

    // SAFETY: if user typed fewer lines than existing, keep any extra cards
    // that contain NOTES/BEATS so we don’t accidentally wipe chords.
    for(let i=want.length; i<have.length; i++){
      const L = have[i];
      if(lineHasContent(L)){ // your existing “has notes or beats or lyrics” check
        next.push(L);
      }
    }

    // ensure at least 1 card
    if(next.length < MIN_LINES_PER_SECTION) next.push(newLine());

    // also trim trailing fully blank cards (but keep 1)
    while(next.length > 1 && !lineHasContent(next[next.length - 1])) next.pop();

    state.project.sections[sec] = next;
  });
}

/***********************
Project storage (MAIN)
***********************/
function newLine(){
  return {
    id: uuid(),
    notes: Array(8).fill(""),
    lyrics: "",
    beats: Array(4).fill("")
  };
}
  const LS_KEY = "songrider_v25_projects";
const LS_CUR = "songrider_v25_currentProjectId";

function lineHasContent(line){
  if(!line || typeof line !== "object") return false;

  const lyr = String(line.lyrics || "").trim();
  if(lyr) return true;

  const notes = Array.isArray(line.notes) ? line.notes : [];
  for(const n of notes){
    if(String(n || "").trim()) return true;
  }

  const beats = Array.isArray(line.beats) ? line.beats : [];
  for(const b of beats){
    if(String(b || "").trim()) return true;
  }

  return false;
}

function defaultProject(name="New Song"){
  const sections = {};
  SECTIONS.filter(s=>s!=="Full").forEach(sec => {
    sections[sec] = [ newLine() ]; // ✅ start with ONE card
  });
 return {
  id: uuid(),
  name,
  createdAt: now(),
  updatedAt: now(),
   transposeMode: "capo",
steps: 0,
  bpm: 95,
  capo: 0,
  fullText: "",
  fullSeeded: false,   // ✅ NEW
  sections
};
}

function loadAllProjects(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch{
    return [];
  }
}

function saveAllProjects(projects){
  localStorage.setItem(LS_KEY, JSON.stringify(projects));
}

function upsertProject(p){
  const all = loadAllProjects();
  const i = all.findIndex(x => x.id === p.id);
  p.updatedAt = now();
  if(i >= 0) all[i] = p;
  else all.unshift(p);
  saveAllProjects(all);
  localStorage.setItem(LS_CUR, p.id);
}

function deleteProjectById(id){
  const all = loadAllProjects().filter(p => p.id !== id);
  saveAllProjects(all);
  localStorage.removeItem(LS_CUR);
}

function normalizeProject(p){
  if(!p || typeof p !== "object") return null;

  if(typeof p.fullText !== "string") p.fullText = "";
  if(typeof p.fullSeeded !== "boolean") p.fullSeeded = false; // ✅ NEW
  if(!p.sections || typeof p.sections !== "object") p.sections = {};
  if(!Number.isFinite(p.bpm)) p.bpm = 95;
  if(!Number.isFinite(p.capo)) p.capo = 0;
  if(p.transposeMode !== "capo" && p.transposeMode !== "step") p.transposeMode = "capo";
  if(!Number.isFinite(p.steps)) p.steps = 0;

  SECTIONS.filter(s=>s!=="Full").forEach(sec => {
    if(!Array.isArray(p.sections[sec])) p.sections[sec] = [];

    p.sections[sec] = p.sections[sec].map(line => {
      const L = (line && typeof line === "object") ? line : {};
      if(typeof L.id !== "string") L.id = uuid();
      if(!Array.isArray(L.notes)) L.notes = Array(8).fill("");
      if(typeof L.lyrics !== "string") L.lyrics = "";
      if(!Array.isArray(L.beats)) L.beats = Array(4).fill("");

      L.notes = Array.from({length:8}, (_,i)=> String(L.notes[i] ?? "").trim());
      L.beats = Array.from({length:4}, (_,i)=> String(L.beats[i] ?? "").trim());
      return L;
    });

    // ✅ trim trailing blank cards, but keep at least 1
    while(p.sections[sec].length > 1 && !lineHasContent(p.sections[sec][p.sections[sec].length - 1])){
      p.sections[sec].pop();
    }

    // ✅ ensure minimum 1 card
    if(p.sections[sec].length < MIN_LINES_PER_SECTION){
      p.sections[sec].push(newLine());
    }
  });

  return p;
}

function getCurrentProject(){
  const all = loadAllProjects().map(normalizeProject).filter(Boolean);
  if(all.length === 0){
    const p = defaultProject("New Song");
    upsertProject(p);
    return p;
  }
  const curId = localStorage.getItem(LS_CUR);
  return (curId && all.find(p => p.id === curId)) || all[0];
}

/***********************
IndexedDB (Recordings) MAIN
***********************/
const DB_NAME = "songrider_db_v25";
const DB_VER = 1;
const STORE = "recordings";

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(rec){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll(){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/***********************
State
***********************/
const state = {
  project: null,
  currentSection: "Full",
  bpm: 95,
  capo: 0,
  autoSplit: true,
  transposeMode: "capo", // "capo" | "step"
  steps: 0,              // semitone transpose when in STEP mode

  instrument: "piano",
  instrumentOn: false,
lastChordRaw: "",

  // modes:
  //   "half"  = DEFAULT (4/8ths OR next note OR end-of-bar)
  //   "eighth"= fixed 1/8 ( ... )
  //   "bar"   = tie-to-next across cards ( _ )
  noteLenMode: "half",

  drumStyle: "rap",
  drumsOn: false,

  autoScrollOn: false,
  playCardIndex: null,
  
lastAutoBar: -1,

  ctx: null,
  masterGain: null,
  masterComp: null,
  masterLimiter: null,
  masterPost: null,

  recDest: null,
  recWired: false,

  drumTimer: null,

  isRecording: false,
  rec: null,
  recChunks: [],

  recMicStream: null,
  recMicSource: null,

  beatTimer: null,
  tick8: 0,
  eighthMs: 315,


  // NEW: kills pending strum timeouts instantly when toggling instruments
  audioToken: 0,

    // ✅ AUDIO SYNC (MP3 master clock)
  audioSyncOn: false,
  audioSyncRaf: null,
  audioSyncAudio: null,
  audioSyncUrl: null,
  audioSyncRecId: null,
  audioSyncOffsetSec: 0,   // where Beat 1 starts in the audio
  lastAudioTick8: -1,
  tapTimes: [],
   audioSyncSource: null,   // ✅ WebAudio node for the MP3
  audioSyncGain: null,     // ✅ optional gain for MP3 level
  recMix: null,
  recMixWired: false,
  recKeepAlive: null,
};
function roundToHalf(n){
  n = Number(n);
  if(!Number.isFinite(n)) return 0;
  return Math.round(n * 2) / 2;
}

function getTransposeSemis(){
  // capo is always integer semis, step can be .5
  if(state.transposeMode === "step") return roundToHalf(state.steps);
  return Math.round(Number(state.capo) || 0);
}
function commitCapoStepFromInput(fromToggle=false){
  if(!el.capoInput || !state.project) return;

  // normalize decimal comma just in case
  const rawStr = String(el.capoInput.value ?? "").trim().replace(",", ".");
  const rawNum = Number(rawStr);

  if(state.transposeMode === "step"){
    const steps = clamp(roundToHalf(rawNum), -24, 24);

    editProject("steps", () => {
      state.steps = steps;
      state.project.steps = steps;
    });

    // keep UI stable (no “snap to int then back”)
    el.capoInput.step = "0.5";
    el.capoInput.inputMode = "decimal";
    el.capoInput.value = String(steps);
  }else{
    const capo = clamp(Math.round(Number.isFinite(rawNum) ? rawNum : 0), 0, 12);

    editProject("capo", () => {
      state.capo = capo;
      state.project.capo = capo;
    });

    el.capoInput.step = "1";
    el.capoInput.inputMode = "numeric";
    el.capoInput.value = String(capo);
  }

  // update displays
  refreshDisplayedNoteCells();
  updateKeyFromAllNotes();
}

// Helper: split into integer semis (for chord-name math) + fractional semis (for detune)
function splitTranspose(semisFloat){
  const s = Number(semisFloat) || 0;
  const intSemis = Math.trunc(s);          // toward 0
  const fracSemis = s - intSemis;          // -0.5..+0.5 possible
  return { intSemis, fracSemis };
} 

/***********************
UNDO / REDO (Project History)
- Tracks meaningful edits to the current project
- Ctrl/Cmd+Z = undo
- Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = redo
***********************/
const history = {
  past: [],
  future: [],
  lastSig: "",
  lock: false,
  max: 80
};

function deepClone(o){
  try{ return structuredClone(o); }catch{
    return JSON.parse(JSON.stringify(o));
  }
}

function projectSignature(p){
  // small + stable: prevents pushing duplicates constantly
  try{
    return JSON.stringify({
      id: p?.id || "",
      name: p?.name || "",
      bpm: p?.bpm || 0,
      capo: p?.capo || 0,
            transposeMode: p?.transposeMode || "capo",
      steps: p?.steps || 0,

      fullText: p?.fullText || "",
      sections: p?.sections || {}
    });
  }catch{
    return String(Math.random());
  }
}

function pushHistory(reason=""){
  if(history.lock) return;
  if(!state.project) return;

  const sig = projectSignature(state.project);
  if(sig === history.lastSig) return;

  history.past.push(deepClone(state.project));
  if(history.past.length > history.max) history.past.shift();

  history.future = [];
  history.lastSig = sig;

  updateUndoRedoUI();
}

function applySnapshot(snapshot){
  if(!snapshot) return;

  history.lock = true;
  try{
    state.project = normalizeProject(deepClone(snapshot));
    upsertProject(state.project);

    // keep UI in sync
    applyProjectSettingsToUI();
    renderAll();
  }finally{
    history.lock = false;
  }

  history.lastSig = projectSignature(state.project);
  updateUndoRedoUI();
}

function undo(){
  if(history.lock) return;
  if(history.past.length === 0) return;

  history.future.push(deepClone(state.project));
  const prev = history.past.pop();
  applySnapshot(prev);
}

function redo(){
  if(history.lock) return;
  if(history.future.length === 0) return;

  history.past.push(deepClone(state.project));
  const next = history.future.pop();
  applySnapshot(next);
}

function updateUndoRedoUI(){
  if(el.undoBtn) el.undoBtn.disabled = history.past.length === 0;
  if(el.redoBtn) el.redoBtn.disabled = history.future.length === 0;
}
/***********************
✅ HISTORY COMMIT HELPERS (correct “before” snapshots)
- editProject(reason, fn) snapshots BEFORE fn runs
- commits snapshot only if project actually changed
***********************/
function historyCommitBeforeSnapshot(beforeSnap){
  if(history.lock) return;
  if(!beforeSnap) return;

  history.past.push(deepClone(beforeSnap));
  if(history.past.length > history.max) history.past.shift();

  history.future = [];
  history.lastSig = projectSignature(state.project);
  updateUndoRedoUI();
}

// Use this whenever you want Undo/Redo to work reliably
function editProject(reason, mutatorFn){
  if(!state.project) return;
  if(history.lock){
    // while applying undo/redo snapshots, do not create history
    mutatorFn();
    return;
  }

  const before = deepClone(state.project);
  const beforeSig = projectSignature(before);

  mutatorFn();

  const afterSig = projectSignature(state.project);
  if(afterSig !== beforeSig){
    historyCommitBeforeSnapshot(before);
  }

  upsertProject(state.project);
}
/***********************
HORSE RUNNER (BPM-synced)
- Runs across screen once per BAR (every 8 eighth-notes)
- Alternates direction each bar
- Triggers for: drums, instrument, MP3 sync
***********************/
state.horseDir = 1;        // 1 = right, -1 = left
state.lastHorseBar = -1;   // prevents double-fires

function stopHorse(){
  if(!el.horseRight || !el.horseLeft) return;
  [el.horseRight, el.horseLeft].forEach(img => {
    try{
      img.style.display = "none";
      img.classList.remove("horseRunRight","horseRunLeft");
      img.style.animationDuration = "";
      img.style.animation = "none";
      // force reset
      void img.offsetHeight;
      img.style.animation = "";
    }catch{}
  });
  const parked = document.getElementById("horseParked");
if(parked) parked.style.visibility = "visible";
}

function horseShouldRun(){
  // “as the mp3 / instrument / drums play…”
  return !!(state.drumsOn || state.instrumentOn || state.audioSyncOn);
}

function triggerHorseRun(){
  const parked = document.getElementById("horseParked");
if(parked) parked.style.visibility = "hidden";

  if(!horseShouldRun()) return;
  if(!el.horseRight || !el.horseLeft) return;

  const bpm = clamp(state.bpm || 95, 40, 220);
  const barMs = Math.round((240000 / bpm)); // 4 beats per bar

  // alternate direction each bar
  state.horseDir = (state.horseDir === 1) ? -1 : 1;

  const img = (state.horseDir === 1) ? el.horseRight : el.horseLeft;
  const cls = (state.horseDir === 1) ? "horseRunRight" : "horseRunLeft";

  // hide the other one
  const other = (img === el.horseRight) ? el.horseLeft : el.horseRight;
  try{
    other.style.display = "none";
    other.classList.remove("horseRunRight","horseRunLeft");
    other.style.animationDuration = "";
  }catch{}

  // restart animation cleanly
  try{
    img.style.display = "block";
    img.classList.remove("horseRunRight","horseRunLeft");
    img.style.animationDuration = "0ms";
    img.style.animation = "none";
    void img.offsetHeight; // reflow
    img.style.animation = "";
    img.style.animationDuration = barMs + "ms";
    img.classList.add(cls);

    img.onanimationend = () => {
      try{
        img.style.display = "none";
        img.classList.remove("horseRunRight","horseRunLeft");
        img.style.animationDuration = "";
      }catch{}
    };
  }catch{}
}

/***********************
Tick UI (stable + can tick all visible cards)
***********************/
function clearTick(){
  (state.lastTickEls || []).forEach(elm => {
    try{ elm.classList.remove("tick"); }catch{}
  });
  state.lastTickEls = [];
}

// During MP3 sync: only show tick when AutoScroll is ON
function shouldTickRun(){
  if(state.audioSyncOn) return true; // ✅ show tick during MP3 sync too
  return !!(state.drumsOn || state.instrumentOn || state.autoScrollOn);
}


function getVisibleCards(){
  const cards = getCards();
  if(cards.length === 0) return [];

  const topLine = getHeaderBottomY() - 18;
  const bottomLine = window.innerHeight + 18;

  const vis = [];
  for(const c of cards){
    const r = c.getBoundingClientRect();
    if(r.bottom < topLine) continue;
    if(r.top > bottomLine) continue;
    vis.push(c);
  }
  return vis.length ? vis : [cards[0]];
}

function applyTick(){
  if(!el.sheetBody) return;
  if(state.currentSection === "Full") return;
  if(!shouldTickRun()) return;

  const nIdx = ((state.tick8 % 8) + 8) % 8;
  const bIdx = Math.floor(nIdx / 2);

  const touched = [];

  // ✅ Always guarantee at least 1 card to tick
  let cards = [];
  if(state.autoScrollOn){
    const one = getPlaybackCard() || getCardAtPlayLine() || getNearestVisibleCard();
    if(one) cards = [one];
  }
  if(!cards.length){
    cards = getVisibleCards();
  }
  if(!cards.length){
    const all = getCards();
    if(all.length) cards = [all[0]];
  }

  for(const card of cards){
    const notes = card.querySelectorAll(".noteCell");
    const beats = card.querySelectorAll(".beatCell");

    if(notes && notes[nIdx]){
      notes[nIdx].classList.add("tick");
      touched.push(notes[nIdx]);
    }
    if(beats && beats[bIdx]){
      beats[bIdx].classList.add("tick");
      touched.push(beats[bIdx]);
    }
  }

  state.lastTickEls = touched;
}

/***********************
Audio (routed through master bus)
***********************/
function ensureCtx(){
  if(!state.ctx){
    state.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // safer master levels (prevents harsh “screech” perception on phones)
    state.masterGain = state.ctx.createGain();
    state.masterGain.gain.value = 0.90;

    state.masterComp = state.ctx.createDynamicsCompressor();
    state.masterComp.threshold.value = -22;
    state.masterComp.knee.value = 18;
    state.masterComp.ratio.value = 2.8;
    state.masterComp.attack.value = 0.008;
    state.masterComp.release.value = 0.20;

    // safety limiter (hard stop)
    state.masterLimiter = state.ctx.createDynamicsCompressor();
    state.masterLimiter.threshold.value = -10;
    state.masterLimiter.knee.value = 0;
    state.masterLimiter.ratio.value = 20;
    state.masterLimiter.attack.value = 0.002;
    state.masterLimiter.release.value = 0.09;

    state.masterPost = state.ctx.createGain();
    state.masterPost.gain.value = 1.0;

    state.masterGain.connect(state.masterComp);
    state.masterComp.connect(state.masterLimiter);
    state.masterLimiter.connect(state.masterPost);
    state.masterPost.connect(state.ctx.destination);
  }

  if(state.ctx.state === "suspended"){
    state.ctx.resume().catch(()=>{});
  }
  return state.ctx;
}

function getOutNode(){
  ensureCtx();
  return state.masterGain || state.ctx.destination;
}

function safeDisconnect(node){
  try{ node.disconnect(); }catch{}
}

function scheduleCleanup(nodes, ms){
  setTimeout(() => {
    (nodes || []).forEach(n => safeDisconnect(n));
  }, Math.max(60, ms|0));
}

/***********************
REALISTIC DRUM SYNTH (NO SAMPLES)
- Kick: pitch drop + click
- Snare: filtered noise + body tone
- Hat: bright filtered noise + metallic partials
***********************/

function drumBus(){
  // Optional: a tiny bit of shaping just for drums
  const ctx = ensureCtx();
  if(state._drumBus) return state._drumBus;

  const g = ctx.createGain();
  g.gain.value = 0.95;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 28; // remove sub-rumble

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 14;
  comp.ratio.value = 3.2;
  comp.attack.value = 0.004;
  comp.release.value = 0.12;

  g.connect(hp);
  hp.connect(comp);
  comp.connect(getOutNode()); // into your master chain

  state._drumBus = { in: g, nodes:[g,hp,comp] };
  return state._drumBus;
}

function drumKick(vel=1){
  const ctx = ensureCtx();
  const t0 = ctx.currentTime;
  const v = clamp(vel, 0.15, 1.0);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.95 * v, t0 + 0.004);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);

  // punch EQ
  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 85;
  body.Q.value = 0.9;
  body.gain.value = 3.5;

  // lowpass to keep it round
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.Q.value = 0.7;

  // main sine with pitch drop
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t0);
  o.frequency.exponentialRampToValueAtTime(52, t0 + 0.06);
  o.frequency.exponentialRampToValueAtTime(45, t0 + 0.16);

  // tiny click (short filtered noise)
  const nLen = 0.010;
  const bs = Math.max(256, Math.floor(ctx.sampleRate * nLen));
  const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    data[i] = (Math.random()*2-1) * (1 - i/data.length);
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buf;

  const clickHP = ctx.createBiquadFilter();
  clickHP.type = "highpass";
  clickHP.frequency.value = 1800;
  clickHP.Q.value = 0.8;

  const clickG = ctx.createGain();
  clickG.gain.setValueAtTime(0.0001, t0);
  clickG.gain.exponentialRampToValueAtTime(0.18 * v, t0 + 0.0015);
  clickG.gain.exponentialRampToValueAtTime(0.0001, t0 + nLen);

  // route
  o.connect(out);
  ns.connect(clickHP);
  clickHP.connect(clickG);
  clickG.connect(out);

  out.connect(body);
  body.connect(lp);

  lp.connect(drumBus().in);

  o.start(t0);
  o.stop(t0 + 0.24);

  ns.start(t0);
  ns.stop(t0 + nLen + 0.02);

  scheduleCleanup([o,out,body,lp,ns,clickHP,clickG], 420);
}

function drumSnare(vel=1){
  const ctx = ensureCtx();
  const t0 = ctx.currentTime;
  const v = clamp(vel, 0.15, 1.0);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.55 * v, t0 + 0.003);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);

  // noise burst
  const nLen = 0.11;
  const bs = Math.max(256, Math.floor(ctx.sampleRate * nLen));
  const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    const fade = 1 - (i/data.length);
    data[i] = (Math.random()*2-1) * fade;
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buf;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  hp.Q.value = 0.7;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2100;
  bp.Q.value = 0.9;

  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.0001, t0);
  noiseG.gain.exponentialRampToValueAtTime(0.60 * v, t0 + 0.003);
  noiseG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);

  // body tone
  const bodyO = ctx.createOscillator();
  bodyO.type = "triangle";
  bodyO.frequency.setValueAtTime(190, t0);
  bodyO.frequency.exponentialRampToValueAtTime(155, t0 + 0.06);

  const bodyG = ctx.createGain();
  bodyG.gain.setValueAtTime(0.0001, t0);
  bodyG.gain.exponentialRampToValueAtTime(0.18 * v, t0 + 0.003);
  bodyG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

  // snap EQ
  const snap = ctx.createBiquadFilter();
  snap.type = "peaking";
  snap.frequency.value = 3400;
  snap.Q.value = 0.8;
  snap.gain.value = 3.0;

  // route
  ns.connect(hp);
  hp.connect(bp);
  bp.connect(noiseG);
  noiseG.connect(out);

  bodyO.connect(bodyG);
  bodyG.connect(out);

  out.connect(snap);
  snap.connect(drumBus().in);

  ns.start(t0);
  ns.stop(t0 + nLen + 0.02);

  bodyO.start(t0);
  bodyO.stop(t0 + 0.16);

  scheduleCleanup([out,ns,hp,bp,noiseG,bodyO,bodyG,snap], 520);
}

function drumHatClosed(vel=1){
  const ctx = ensureCtx();
  const t0 = ctx.currentTime;
  const v = clamp(vel, 0.12, 1.0);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.22 * v, t0 + 0.0018);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

  // noise
  const nLen = 0.040;
  const bs = Math.max(256, Math.floor(ctx.sampleRate * nLen));
  const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    data[i] = (Math.random()*2-1) * (1 - i/data.length);
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buf;

  // metallic partials (6 square oscillators)
  const freqs = [4100, 5200, 6300, 7400, 8600, 9800];
  const oscMix = ctx.createGain();
  oscMix.gain.value = 0.06 * v;

  const oscs = [];
  for(const f of freqs){
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(f * (1 + (Math.random()*2-1)*0.002), t0);
    oscs.push(o);
    o.connect(oscMix);
    o.start(t0);
    o.stop(t0 + 0.05);
  }

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6500;
  hp.Q.value = 0.7;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 12000;
  lp.Q.value = 0.7;

  const nG = ctx.createGain();
  nG.gain.setValueAtTime(0.0001, t0);
  nG.gain.exponentialRampToValueAtTime(0.20 * v, t0 + 0.0018);
  nG.gain.exponentialRampToValueAtTime(0.0001, t0 + nLen);

  ns.connect(hp);
  hp.connect(nG);
  nG.connect(out);

  oscMix.connect(out);

  out.connect(lp);
  lp.connect(drumBus().in);

  ns.start(t0);
  ns.stop(t0 + nLen + 0.02);

  scheduleCleanup([out,ns,hp,lp,nG,oscMix, ...oscs], 260);
}

function drumHit(kind, vel=1){
  // small humanization (keeps it from sounding like a video game grid)
  const v = clamp(vel * (0.92 + Math.random()*0.16), 0.12, 1.0);

  if(kind === "kick") return drumKick(v);
  if(kind === "snare") return drumSnare(v);
  if(kind === "hat") return drumHatClosed(v);
}


/***********************
NOTE / CHORD PARSERS
***********************/
function parseNoteToken(v){
  const s0 = String(v||"").trim();
  if(!s0) return null;

  const s = s0
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .trim();

  const m = s.match(/^([A-Ga-g])\s*([#b])?/);
  if(!m) return null;

  const letter = m[1].toUpperCase();
  const acc = (m[2] || "").toLowerCase();

  const key =
    acc === "#"
      ? (letter + "#")
      : acc === "b"
        ? (letter + "B")
        : letter;

  return { key, letter, acc };
}

const NOTE_TO_PC = {
  "C":0,"C#":1,"DB":1,
  "D":2,"D#":3,"EB":3,
  "E":4,
  "F":5,"F#":6,"GB":6,
  "G":7,"G#":8,"AB":8,
  "A":9,"A#":10,"BB":10,
  "B":11
};
const PC_TO_NAME = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function noteToPC(n){
  const p = parseNoteToken(n);
  if(!p) return null;
  return NOTE_TO_PC[p.key] ?? null;
}

function transposeNoteName(note, semitones){
  const pc = noteToPC(note);
  if(pc === null) return String(note||"").trim();
  const t = ((pc + (semitones|0)) % 12 + 12) % 12;
  return PC_TO_NAME[t];
}

// transpose chord root only, preserve suffix
function transposeChordName(chord, semis){
  const s0 = String(chord||"").trim();
  if(!s0) return "";
  const s = s0.replace(/♯/g,"#").replace(/♭/g,"b").trim();
  const m = s.match(/^([A-Ga-g])\s*([#b])?(.*)$/);
  if(!m) return s0;
  const root = (m[1].toUpperCase() + (m[2]||""));
  const rest = String(m[3]||"");
  const tRoot = transposeNoteName(root, semis);
  return (tRoot + rest).trim();
}

/***********************
CHORD → INTERVALS → MIDIs
Supports: maj, m, dim, aug, sus2/sus4, 6, 7, maj7, m7, add9, 9, maj9, m9
Also supports slash bass: D/F#
***********************/
function parseChordToken(raw){
  const s0 = String(raw||"").trim();
  if(!s0) return null;

  const s = s0
    .replace(/♯/g,"#")
    .replace(/♭/g,"b")
    .replace(/\s+/g,"")
    .trim();

  const parts = s.split("/");
  const main = parts[0] || "";
  const bassTok = parts[1] || "";

  const m = main.match(/^([A-Ga-g])([#b]?)(.*)$/);
  if(!m) return null;

  const rootName = (m[1].toUpperCase() + (m[2]||""));
  const rootPC = noteToPC(rootName);
  if(rootPC === null) return null;

  let qual = (m[3]||"");

  qual = qual
    .replace(/^maj/i,"maj")
    .replace(/^min/i,"m")
    .replace(/^-/,"m")
    .replace(/^M7/,"maj7")
    .replace(/Δ7/i,"maj7");

  const bassPC = bassTok ? noteToPC(bassTok) : null;

  let triad = "maj";
  if(/^m(?!aj)/i.test(qual)) triad = "min";
  if(/dim|o/i.test(qual)) triad = "dim";
  if(/aug|\+/i.test(qual)) triad = "aug";
  if(/sus2/i.test(qual)) triad = "sus2";
  if(/sus4|sus/i.test(qual)) triad = "sus4";

  let intervals = [];
  if(triad === "maj") intervals = [0,4,7];
  if(triad === "min") intervals = [0,3,7];
  if(triad === "dim") intervals = [0,3,6];
  if(triad === "aug") intervals = [0,4,8];
  if(triad === "sus2") intervals = [0,2,7];
  if(triad === "sus4") intervals = [0,5,7];

  const hasMaj7 = /maj7/i.test(qual);
  const has7 = /7/.test(qual) && !hasMaj7;
  const hasM7minor = /m7/i.test(qual) && !hasMaj7;

  const has6 = /6/.test(qual) && !/16/.test(qual);
  const hasAdd9 = /add9/i.test(qual);
  const has9 = /(maj9|m9|[^a-z]9|9$)/i.test(qual);
  const isMaj9 = /maj9/i.test(qual);
  const isMin9 = /m9/i.test(qual) && !isMaj9;

  if(hasMaj7) intervals.push(11);
  else if(hasM7minor || (triad==="min" && has7)) intervals.push(10);
  else if(has7) intervals.push(10);

  if(has6) intervals.push(9);

  if(hasAdd9 || has9){
    if(isMaj9) { if(!intervals.includes(11)) intervals.push(11); intervals.push(14); }
    else if(isMin9) { if(!intervals.includes(10)) intervals.push(10); intervals.push(14); }
    else intervals.push(14);
  }

  intervals = Array.from(new Set(intervals)).sort((a,b)=>a-b);

  return {
    raw: s0,
    rootName,
    rootPC,
    bassPC,
    triad,
    intervals
  };
}

function midiToFreq(m){
  return 440 * Math.pow(2, (m - 69)/12);
}

function nearestMidiForPC(pc, targetMidi){
  const t = Math.round(targetMidi);
  const candidates = [];
  for(let k=-4;k<=4;k++){
    const m = t + k;
    if(((m % 12) + 12) % 12 === pc) candidates.push(m);
  }
  if(candidates.length === 0) return t;
  let best = candidates[0], bd = Math.abs(best - t);
  for(const c of candidates){
    const d = Math.abs(c - t);
    if(d < bd){ bd = d; best = c; }
  }
  return best;
}

/***********************
Voicing builders
***********************/
function buildPianoVoicing(ch){
  const root = ch.rootPC;
  const tones = ch.intervals.map(iv => (root + iv) % 12);

  const bassPC = (ch.bassPC !== null) ? ch.bassPC : root;
  const bass = nearestMidiForPC(bassPC, 48); // ~C3

  const target = 64; // ~E4
  const mids = [];

  const want = [];
  const has = (pc)=> tones.includes(pc);

  const thirdPC = (root + (ch.triad==="min"?3:(ch.triad==="sus2"?2:(ch.triad==="sus4"?5:4)))) % 12;
  const fifthPC = (root + (ch.triad==="dim"?6:(ch.triad==="aug"?8:7))) % 12;
  const seventhPC = has((root+11)%12) ? (root+11)%12 : (has((root+10)%12) ? (root+10)%12 : null);
  const ninthPC = has((root+2)%12) ? (root+2)%12 : null;

  if(has(thirdPC)) want.push(thirdPC);
  if(seventhPC!==null) want.push(seventhPC);
  if(has(fifthPC)) want.push(fifthPC);
  if(ninthPC!==null) want.push(ninthPC);
  want.push(root);

  for(const pc of want){
    const m = nearestMidiForPC(pc, target + mids.length*3);
    if(!mids.includes(m)) mids.push(m);
    if(mids.length >= 4) break;
  }

  while(mids.length < 3){
    const pc = tones[mids.length % tones.length];
    const m = nearestMidiForPC(pc, target + mids.length*3);
    if(!mids.includes(m)) mids.push(m);
  }

  return [bass, ...mids].sort((a,b)=>a-b);
}

function buildGuitarStrumVoicing(ch){
  const root = ch.rootPC;
  const tones = ch.intervals.map(iv => (root + iv) % 12);
  const bassPC = (ch.bassPC !== null) ? ch.bassPC : root;

  const bass = nearestMidiForPC(bassPC, 43); // ~G2/A2
  const mids = [];
  const targets = [52, 55, 59, 64, 67]; // E3..G4

  for(let i=0;i<targets.length;i++){
    const pc = tones[i % tones.length];
    mids.push(nearestMidiForPC(pc, targets[i]));
  }

  return [bass, ...mids].sort((a,b)=>a-b);
}

/***********************
FX helpers
***********************/
function makeSoftRoom(ctx){
  const inG = ctx.createGain();
  const d = ctx.createDelay(0.25);
  d.delayTime.value = 0.085;

  const fb = ctx.createGain();
  fb.gain.value = 0.18;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3000;
  lp.Q.value = 0.25;

  inG.connect(d);
  d.connect(lp);
  lp.connect(fb);
  fb.connect(d);

  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  lp.connect(wet);

  return { in: inG, wet, nodes:[inG,d,fb,lp,wet] };
}

function makeCabinet(ctx){
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 105;
  hp.Q.value = 0.7;

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1450;
  mid.Q.value = 0.9;
  mid.gain.value = 2.0;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4200;
  lp.Q.value = 0.8;

  hp.connect(mid);
  mid.connect(lp);

  return { in: hp, out: lp, nodes:[hp,mid,lp] };
}

function makeWaveshaper(ctx, drive=1.0){
  const sh = ctx.createWaveShaper();
  const n = 2048;
  const curve = new Float32Array(n);
  const k = clamp(drive, 0.2, 6.0);
  for(let i=0;i<n;i++){
    const x = (i/(n-1))*2 - 1;
    curve[i] = Math.tanh(k * x);
  }
  sh.curve = curve;
  sh.oversample = "4x";
  return sh;
}

/***********************
NEW ACOUSTIC STRING (SAFE)
Noise-excited resonator (no feedback), filtered + warm body
***********************/
/***********************
ACOUSTIC STRING (MOBILE-PROOF)
Karplus–Strong pluck: noise burst -> delay+feedback loop -> damping -> body EQ
This is extremely reliable on phones (no “silent acoustic”).
***********************/
/***********************
ACOUSTIC (NO-FEEDBACK, MOBILE-SAFE)
Noise-burst pluck + light pitched tone, shaped by body EQ.
No delay feedback loops anywhere (prevents squeal/whine).
***********************/
function acousticPluckSafe(ctx, freq, durMs, vel=0.9){
  const t0 = ctx.currentTime;
  const dur = Math.max(0.10, durMs / 1000);
  const f = clamp(freq, 70, 1400);
  const v = clamp(vel, 0.15, 1.0);

  // Main envelope
  const env = ctx.createGain();
  const peak = 0.38 * v;

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  env.gain.setValueAtTime(peak * 0.78, t0 + 0.045);
  // release
  const rel = clamp(0.22 + dur * 0.50, 0.45, 2.20);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + rel);

  // --- Noise burst (pluck)
  const nLen = 0.012; // 12ms
  const bs = Math.max(256, Math.floor(ctx.sampleRate * nLen));
  const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    const fade = 1 - (i / data.length);
    data[i] = (Math.random()*2 - 1) * fade;
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buf;

  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.0001, t0);
  nGain.gain.exponentialRampToValueAtTime(0.65 * v, t0 + 0.002);
  nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + nLen);

  // “String” bandpass (focuses the noise into a pitched pluck)
  const bp1 = ctx.createBiquadFilter();
  bp1.type = "bandpass";
  bp1.frequency.setValueAtTime(f, t0);
  bp1.Q.value = 10;

  // A little brightness from a higher band (still safe)
  const bp2 = ctx.createBiquadFilter();
  bp2.type = "bandpass";
  bp2.frequency.setValueAtTime(clamp(f * 2.0, 180, 4200), t0);
  bp2.Q.value = 6;

  const noiseMix = ctx.createGain();
  noiseMix.gain.value = 0.55;

  ns.connect(nGain);
  nGain.connect(bp1);
  nGain.connect(bp2);
  bp1.connect(noiseMix);
  bp2.connect(noiseMix);

  // --- Tiny pitched tone (adds definition, decays fast)
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(f, t0);
  o.detune.value = (Math.random()*2-1) * 4;

  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.0001, t0);
  oGain.gain.exponentialRampToValueAtTime(0.10 * v, t0 + 0.006);
  oGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);

  o.connect(oGain);

  // --- Body shaping (warmth + tame top)
// --- Body shaping (PHONE SPEAKER FRIENDLY)
const hp = ctx.createBiquadFilter();
hp.type = "highpass";
// push up the highpass so tiny speakers don't waste energy on sub lows
hp.frequency.value = 150;
hp.Q.value = 0.7;

// reduce the boomy body bump a bit
const body = ctx.createBiquadFilter();
body.type = "peaking";
body.frequency.value = 260;
body.Q.value = 0.9;
body.gain.value = 1.4;

// add presence so it cuts on phone speaker
const presence = ctx.createBiquadFilter();
presence.type = "peaking";
presence.frequency.value = 2400;
presence.Q.value = 0.9;
presence.gain.value = 5.0;

// tame any harshness
const notch = ctx.createBiquadFilter();
notch.type = "notch";
notch.frequency.value = 3200;
notch.Q.value = 2.0;

// let a bit more top through
const lp = ctx.createBiquadFilter();
lp.type = "lowpass";
lp.frequency.value = 6800;
lp.Q.value = 0.7;


  // route: (noiseMix + oGain) -> env -> EQ chain -> lp (returned out)
  const sum = ctx.createGain();
  sum.gain.value = 1.0;

  noiseMix.connect(sum);
  oGain.connect(sum);

  sum.connect(env);
 env.connect(hp);
hp.connect(body);
body.connect(presence);
presence.connect(notch);
notch.connect(lp);
// makeup gain so phone speakers can actually hear it
const makeup = ctx.createGain();
makeup.gain.value = 2.2;
lp.connect(makeup);


  // start/stop
  ns.start(t0);
  ns.stop(t0 + nLen + 0.02);

  o.start(t0);
  o.stop(t0 + dur + rel + 0.10);

 scheduleCleanup([ns,nGain,bp1,bp2,noiseMix,o,oGain,sum,env,hp,body,presence,notch,lp,makeup], (durMs + rel*1000 + 1200));
return { out: makeup, nodes:[ns,nGain,bp1,bp2,noiseMix,o,oGain,sum,env,hp,body,presence,notch,lp,makeup] };

}



/***********************
PIANO NOTE (make "_" ties hold LONGER)
***********************/
function pianoNote(ctx, freq, durMs, vel=0.9){
  const t0 = ctx.currentTime;
  const dur = Math.max(0.12, durMs/1000);

  const out = ctx.createGain();
  const peak = 0.18 * clamp(vel, 0.2, 1.0);

  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);

  const hold = Math.min(0.34, 0.07 + dur * 0.22);
  out.gain.setValueAtTime(peak * 0.92, t0 + hold);

  const endTime = t0 + dur;
  out.gain.setValueAtTime(peak * 0.85, endTime);

  const longFactor = clamp((dur - 0.8) / 2.6, 0, 1);
  const tail = clamp(1.2 + dur * 1.05 + longFactor * 3.1, 1.4, 9.0);
  out.gain.exponentialRampToValueAtTime(0.0001, endTime + tail);

  const nodes = [out];

  const partials = [
    {h:1, a:1.00},
    {h:2, a:0.32},
    {h:3, a:0.18},
    {h:4, a:0.10},
    {h:5, a:0.06}
  ];

  for(const p of partials){
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    const inharm = 1 + (p.h>=3 ? 0.0018 : 0.0008);
    o.type = "sine";
    o.frequency.value = freq * p.h * inharm;
    o.detune.value = (Math.random()*2-1) * 5;

    const a = (0.16 * clamp(vel,0.2,1.0)) * p.a;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(a, t0 + 0.006);
    g.gain.setValueAtTime(a * 0.70, endTime);
    g.gain.exponentialRampToValueAtTime(0.0001, endTime + Math.min(9.0, tail));

    o.connect(g);
    g.connect(out);

    o.start(t0);
    o.stop(endTime + Math.min(9.2, tail) + 0.15);

    nodes.push(o,g);
  }

  // hammer noise
  const nLen = 0.018;
  const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * nLen));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){
    data[i] = (Math.random()*2-1) * (1 - i/data.length);
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buffer;

  const nf = ctx.createBiquadFilter();
  nf.type = "highpass";
  nf.frequency.value = 900;
  nf.Q.value = 0.7;

  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.07 * clamp(vel,0.2,1.0), t0 + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + nLen);

  ns.connect(nf);
  nf.connect(ng);
  ng.connect(out);

  ns.start(t0);
  ns.stop(t0 + nLen + 0.01);

  nodes.push(ns,nf,ng);

  // soundboard/body EQ
  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 280;
  body.Q.value = 0.8;
  body.gain.value = 2.0;

  out.connect(body);

  scheduleCleanup([...nodes, body], (durMs + (tail*1000) + 1200));
  return { out: body, nodes:[...nodes, body] };
}

/***********************
NEW ELECTRIC (SAFE)
Triangle+saw blend -> lowpass -> light drive -> cabinet -> notch -> envelope
No harsh “constant squeal” peaks.
***********************/
function electricGuitarSafe(ctx, freq, durMs, vel=0.85){
  const t0 = ctx.currentTime;
  const dur = Math.max(0.08, durMs/1000);

  const pre = ctx.createGain();
  pre.gain.value = 1.0;

  const o1 = ctx.createOscillator();
  o1.type = "sawtooth";
  o1.frequency.value = clamp(freq, 70, 1600);
  o1.detune.value = (Math.random()*2-1) * 3;

  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = clamp(freq, 70, 1600);
  o2.detune.value = 7 + (Math.random()*2-1) * 3;

  const g1 = ctx.createGain(); g1.gain.value = 0.60;
  const g2 = ctx.createGain(); g2.gain.value = 0.40;

  // pick click (short noise)
  const pickLen = 0.010;
  const bs = Math.max(256, Math.floor(ctx.sampleRate * pickLen));
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for(let i=0;i<d.length;i++){
    d[i] = (Math.random()*2-1) * (1 - i/d.length);
  }
  const pick = ctx.createBufferSource();
  pick.buffer = b;

  const pickBP = ctx.createBiquadFilter();
  pickBP.type = "bandpass";
  pickBP.frequency.value = 1800;
  pickBP.Q.value = 1.2;

  const pickG = ctx.createGain();
  pickG.gain.setValueAtTime(0.0001, t0);
  pickG.gain.exponentialRampToValueAtTime(0.04 * clamp(vel,0.2,1.0), t0 + 0.002);
  pickG.gain.exponentialRampToValueAtTime(0.0001, t0 + pickLen);

  // fizz control
  const lp1 = ctx.createBiquadFilter();
  lp1.type = "lowpass";
  lp1.frequency.value = 3600;
  lp1.Q.value = 0.8;

  const sh = makeWaveshaper(ctx, 1.9);

  const cab = makeCabinet(ctx);

  // anti-squeal notch
  const notch = ctx.createBiquadFilter();
  notch.type = "notch";
  notch.frequency.value = 3200;
  notch.Q.value = 2.0;

  // envelope at the end
  const env = ctx.createGain();
  const peak = 0.08 * clamp(vel, 0.2, 1.0);

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  env.gain.setValueAtTime(peak * 0.86, t0 + 0.06);

  const rel = clamp(0.12 + dur*0.18, 0.22, 1.0);
  env.gain.setValueAtTime(peak * 0.78, t0 + Math.max(0.05, dur - rel));
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  // route
  o1.connect(g1); g1.connect(pre);
  o2.connect(g2); g2.connect(pre);

  pick.connect(pickBP);
  pickBP.connect(pickG);
  pickG.connect(pre);

  pre.connect(lp1);
  lp1.connect(sh);
  sh.connect(cab.in);
  cab.out.connect(notch);
notch.connect(env);

// ✅ FINAL VOLUME TRIM (guaranteed)
const outTrim = ctx.createGain();
outTrim.gain.value = 0.22;   // try 0.15 if still loud
env.connect(outTrim);

  o1.start(t0);
  o2.start(t0);

  pick.start(t0);
  pick.stop(t0 + pickLen + 0.01);

  const stopAt = t0 + dur + 0.10;
  o1.stop(stopAt);
  o2.stop(stopAt);

  scheduleCleanup([pre,o1,o2,g1,g2,pick,pickBP,pickG,lp1,sh,notch,env,outTrim, ...cab.nodes], durMs + 1200);
return { out: outTrim, nodes:[pre,o1,o2,g1,g2,pick,pickBP,pickG,lp1,sh,notch,env,outTrim, ...cab.nodes] };
}
/***********************
CHORD PLAYERS
***********************/
function playSingleNoteForInstrument(rawChord, durMs){
  const ch0 = parseChordToken(rawChord);
  if(!ch0) return;

const tr = splitTranspose(getTransposeSemis());
const capoInt = ((tr.intSemis % 12) + 12) % 12;

const ch = {
  ...ch0,
  rootPC: (ch0.rootPC + capoInt + 12) % 12,
  bassPC: (ch0.bassPC === null) ? null : ((ch0.bassPC + capoInt + 12) % 12)
};

// fractional semis applied as freq multiplier later
const fracMul = Math.pow(2, (tr.fracSemis / 12));

  const ctx = ensureCtx();

  // pick a mid/upper note so phone speakers hear it
  let freqs = [];
  if(state.instrument === "piano") freqs = buildPianoVoicing(ch).map(midiToFreq);
  else freqs = buildGuitarStrumVoicing(ch).map(midiToFreq);

  const f = (freqs[Math.min(freqs.length-1, 3)] || freqs[0] || 440) * fracMul;

  if(state.instrument === "acoustic"){
    const n = acousticPluckSafe(ctx, f, durMs, 0.95);
    n.out.connect(getOutNode());
    scheduleCleanup(n.nodes, durMs + 2200);
  }else if(state.instrument === "electric"){
    const n = electricGuitarSafe(ctx, f, durMs, 0.90);
    n.out.connect(getOutNode());
    scheduleCleanup([n.out], durMs + 1400);
  }else{
    const n = pianoNote(ctx, f, durMs, 0.95);
    n.out.connect(getOutNode());
    scheduleCleanup([n.out], durMs + 6000);
  }
}

 function playAcousticChord(ch, durMs, fracMul=1){
  const ctx = ensureCtx();
  const token = state.audioToken;

  // softer overall (prevents harshness on phones)
  const bus = ctx.createGain();
  bus.gain.value = 1.25;

  // small “air” delay (NO FEEDBACK)
  const dly = ctx.createDelay(0.25);
  dly.delayTime.value = 0.065;

  const dlyGain = ctx.createGain();
  dlyGain.gain.value = 0.10;

  // dry + delay to output
  bus.connect(getOutNode());
  bus.connect(dly);
  dly.connect(dlyGain);
  dlyGain.connect(getOutNode());

  // strum
  const midi = buildGuitarStrumVoicing(ch);
 const freqs = midi.map(midiToFreq).map(f => f * (fracMul || 1));


  const bpm = clamp(state.bpm||95, 40, 220);
  const strumMs = clamp(Math.round(24_000 / bpm), 12, 28);

  for(let i=0;i<freqs.length;i++){
    const f = freqs[i];
    const delayMs = i * strumMs;

    setTimeout(() => {
      if(token !== state.audioToken) return;
      if(!state.instrumentOn) return;

      const vel = clamp(0.95 - i*0.10, 0.55, 0.98);
      const n = acousticPluckSafe(ctx, f, durMs, vel);
      n.out.connect(bus);
      scheduleCleanup(n.nodes, durMs + 2200);
    }, delayMs);
  }

  scheduleCleanup([bus,dly,dlyGain], durMs + 2600);
}



function playElectricChord(ch, durMs, fracMul=1){
  const ctx = ensureCtx();
  const token = state.audioToken;

  const room = makeSoftRoom(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.10;
  room.wet.connect(wet);
  wet.connect(getOutNode());

  const dryBus = ctx.createGain();
  dryBus.gain.value = 0.4;
  dryBus.connect(getOutNode());
  dryBus.connect(room.in);

  const midi = buildGuitarStrumVoicing(ch);
 const freqs = midi.map(midiToFreq).map(f => f * (fracMul || 1));


  const bpm = clamp(state.bpm||95, 40, 220);
  const strumMs = clamp(Math.round(20_000 / bpm), 10, 22);

  for(let i=0;i<freqs.length;i++){
    const f = freqs[i];
    const delayMs = i * strumMs;

    setTimeout(() => {
      if(token !== state.audioToken) return;
      if(!state.instrumentOn) return;
      const vel = clamp(0.95 - i*0.08, 0.55, 0.98);
      const n = electricGuitarSafe(ctx, f, durMs, vel);
      n.out.connect(dryBus);
      scheduleCleanup([n.out], durMs + 1100);
    }, delayMs);
  }

  scheduleCleanup([dryBus,wet, ...room.nodes], durMs + 2200);
}

function playPianoChord(ch, durMs, fracMul=1){
  const ctx = ensureCtx();
  const room = makeSoftRoom(ctx);

  const dryBus = ctx.createGain();
  dryBus.gain.value = 0.95;

  const wet = ctx.createGain();
  wet.gain.value = 0.26;

  dryBus.connect(getOutNode());
  dryBus.connect(room.in);
  room.wet.connect(wet);
  wet.connect(getOutNode());

  const midi = buildPianoVoicing(ch);
 const freqs = midi.map(midiToFreq).map(f => f * (fracMul || 1));

  const bpm = clamp(state.bpm||95, 40, 220);
  const rollMs = clamp(Math.round(16_000 / bpm), 6, 18);

  for(let i=0;i<freqs.length;i++){
    const f = freqs[i];
    const delayMs = i * rollMs;

    setTimeout(() => {
      const vel = clamp(0.90 - i*0.06, 0.55, 0.98);
      const n = pianoNote(ctx, f, durMs, vel);
      n.out.connect(dryBus);
      scheduleCleanup([n.out], durMs + 11_000);
    }, delayMs);
  }

  scheduleCleanup([dryBus,wet, ...room.nodes], durMs + 12_000);
}

function playChordForInstrument(rawChord, durMs){
  const ch0 = parseChordToken(rawChord);
  if(!ch0) return;

  const tr = splitTranspose(getTransposeSemis());
const capoInt = ((tr.intSemis % 12) + 12) % 12;

const ch = {
  ...ch0,
  rootPC: (ch0.rootPC + capoInt + 12) % 12,
  bassPC: (ch0.bassPC === null) ? null : ((ch0.bassPC + capoInt + 12) % 12)
};

// store multiplier so chord players can use it
const fracMul = Math.pow(2, (tr.fracSemis / 12));

  if(state.instrument === "acoustic") playAcousticChord(ch, durMs, fracMul);
else if(state.instrument === "electric") playElectricChord(ch, durMs, fracMul);
else playPianoChord(ch, durMs, fracMul);
}

/***********************
Transpose display (now chord-aware)
***********************/
function refreshDisplayedNoteCells(){
  // chord-name transpose must be integer semis (round for display)
  const semis = Math.round(getTransposeSemis()) % 12;

  document.querySelectorAll(".noteCell").forEach(inp => {
    const raw = inp.dataset.raw || inp.value || "";
    inp.value = (semis ? transposeChordName(raw, semis) : raw);
  });
}

/***********************
ACTIVE CARD selection (scroll-container aware)
***********************/
// ✅ Scroll container support (sheetBody scrolls, not window)
function getScrollContainer(){
  return el.sheetBody || document.scrollingElement || document.documentElement;
}

// “play line” = top of the scrollable sheet area (not the sticky header)
function getPlayLineY(){
  const sb = el.sheetBody;
  if(!sb) return getHeaderBottomY();
  const r = sb.getBoundingClientRect();
  return r.top + 12; // a little padding inside the sheet
}

function scrollToTopOfSheet(){
  const sb = el.sheetBody;
  if(sb){
    sb.scrollTop = 0;
    return;
  }
  try{ window.scrollTo({ top:0, behavior:"auto" }); }
  catch{ window.scrollTo(0,0); }
}
/***********************
Playback card helper (used by AutoScroll + tick + instrument)
***********************/
function getPlaybackCard(){
  const cards = getCards();
  if(!cards.length) return null;

  if(state.playCardIndex === null || state.playCardIndex === undefined) return null;

  const i = clamp(state.playCardIndex|0, 0, cards.length - 1);
  return cards[i] || null;
}

// Returns the scrolling viewport element for cards (your #sheetBody)
function getScrollViewport(){
  // #sheetBody is now the scroll container (overflow:auto)
  if(el.sheetBody){
    try{
      const cs = getComputedStyle(el.sheetBody);
      if(cs && cs.overflowY && cs.overflowY !== "visible") return el.sheetBody;
    }catch{}
    // even if computedStyle fails, still use it
    return el.sheetBody;
  }
  return null;
}

// Where the "play line" should be (top of the card viewport)
function getHeaderBottomY(){
  const vp = getScrollViewport();
  if(vp){
    const r = vp.getBoundingClientRect();
    // play line = just inside the card scroller (not the sticky header)
    return Math.round(r.top + 10);
  }

  // fallback: old behavior (window scroll)
  const hdr = document.querySelector("header");
  if(!hdr) return 86;
  const r = hdr.getBoundingClientRect();
  return Math.max(0, Math.min(window.innerHeight, r.bottom)) + 8;
}

function getCards(){
  return Array.from(el.sheetBody.querySelectorAll(".card"));
}

function getVisibleCards(){
  const cards = getCards();
  if(cards.length === 0) return [];

  const vp = getScrollViewport();
  if(!vp){
    // fallback: window-based visibility
    const topLine = getHeaderBottomY() - 18;
    const bottomLine = window.innerHeight + 18;

    const vis = [];
    for(const c of cards){
      const r = c.getBoundingClientRect();
      if(r.bottom < topLine) continue;
      if(r.top > bottomLine) continue;
      vis.push(c);
    }
    return vis.length ? vis : [cards[0]];
  }

  // container-based visibility
  const vpr = vp.getBoundingClientRect();
  const topLine = vpr.top - 6;
  const bottomLine = vpr.bottom + 6;

  const vis = [];
  for(const c of cards){
    const r = c.getBoundingClientRect();
    if(r.bottom < topLine) continue;
    if(r.top > bottomLine) continue;
    vis.push(c);
  }
  return vis.length ? vis : [cards[0]];
}

function getNearestVisibleCard(){
  const cards = getCards();
  if(cards.length === 0) return null;

  const yLine = getPlayLineY();
  const sb = el.sheetBody;
  const sbRect = sb ? sb.getBoundingClientRect() : null;

  let best = null;
  let bestDist = Infinity;

  for(const c of cards){
    const r = c.getBoundingClientRect();

    // only consider cards visible inside the sheetBody viewport
    if(sbRect){
      if(r.bottom < sbRect.top) continue;
      if(r.top > sbRect.bottom) continue;
    }else{
      if(r.bottom < yLine || r.top > window.innerHeight) continue;
    }

    const dist = Math.abs(r.top - yLine);
    if(dist < bestDist){
      bestDist = dist;
      best = c;
    }
  }
  return best || cards[0];
}


/**
 * Choose the card the play-line is actually on.
 */
function getCardAtPlayLine(){
  const cards = getCards();
  if(cards.length === 0) return null;

  const yLine = getPlayLineY();
  const tol = 24;

  for(const c of cards){
    const r = c.getBoundingClientRect();
    if(r.top <= (yLine + tol) && r.bottom > (yLine - tol)) return c;
  }

  return getNearestVisibleCard() || cards[0];
}


function scrollCardIntoView(card){
  if(!card) return;

  const sb = el.sheetBody;

  // If sheetBody is the scroller, scroll inside it (NOT window)
  if(sb){
    const sbRect = sb.getBoundingClientRect();
    const r = card.getBoundingClientRect();

    // how far the card is from the top of the scroll viewport
    const delta = (r.top - sbRect.top);

    // target = current scrollTop + delta - padding
    const pad = 12;
    const target = Math.max(0, Math.round(sb.scrollTop + delta - pad));

    sb.scrollTop = target;
    return;
  }

  // fallback
  const yLine = getHeaderBottomY();
  const r = card.getBoundingClientRect();
  const cardTopDoc = r.top + window.scrollY;
  const targetY = Math.max(0, Math.round(cardTopDoc - yLine));
  try{ window.scrollTo({ top: targetY, behavior:"auto" }); }
  catch{ window.scrollTo(0, targetY); }
}



/***********************
Tie utilities (across cards)
***********************/
function getNoteRawFromCell(cell){
  if(!cell) return "";
  return String(cell.dataset?.raw || cell.value || "").trim();
}
function isDotsToken(s){
  const t = String(s || "").trim();
  return (t === "..." || t === "…");
}
function isRepeatToken(s){
  const t = String(s || "").trim();
  return (t === "_");
}
function isTieToken(s){
  return isDotsToken(s) || isRepeatToken(s);
}

function findNextNoteForwardFrom(cardEl, startCellIndexPlus1){
  const cards = getCards();
  if(cards.length === 0) return null;
  const startCardIdx = cards.indexOf(cardEl);
  if(startCardIdx < 0) return null;

  const MAX_BARS_SCAN = 6;
  for(let barOffset = 0; barOffset <= MAX_BARS_SCAN; barOffset++){
    const card = cards[startCardIdx + barOffset];
    if(!card) break;
    const cells = card.querySelectorAll(".noteCell");
    const startIdx = (barOffset === 0) ? startCellIndexPlus1 : 0;
    for(let j = startIdx; j < 8; j++){
      const raw = getNoteRawFromCell(cells[j]);
      if(raw) return { barsAhead: barOffset, cellIndex: j, raw };
    }
  }
  return null;
}

/***********************
NOTE DURATION (your rules)
"eighth": 1/8
"half"  : 4/8 (half-bar) OR next note OR end-of-bar
"bar"   : tie-to-next across cards, else end-of-bar
***********************/
function computeNoteDurEighths(cardEl, cells, nIdx){
  const mode = state.noteLenMode;

  if(mode === "eighth") return 1;

  // Find next NON-empty note cell in SAME bar
  let next = -1;
  for(let j=nIdx+1;j<8;j++){
  const raw = getNoteRawFromCell(cells[j]);
  if(!raw) continue;
  if(isTieToken(raw)) continue;        // skip "_" and "..."
  if(!parseChordToken(raw)) continue;  // skip random text
  next = j;
  break;
}


  if(mode === "half"){
    const blockEnd = (nIdx < 4) ? 4 : 8;
    if(next !== -1 && next < blockEnd){
      return Math.max(1, next - nIdx);
    }
    return Math.max(1, blockEnd - nIdx);
  }

  // mode === "bar"
  if(next !== -1){
    return Math.max(1, next - nIdx);
  }

  const forward = findNextNoteForwardFrom(cardEl, nIdx + 1);
  if(forward){
    const toEndThisBar = 8 - nIdx;
    const fullBarsBetween = Math.max(0, forward.barsAhead - 1) * 8;
    const intoThatBar = (forward.barsAhead >= 1) ? forward.cellIndex : 0;
    const dur = toEndThisBar + fullBarsBetween + intoThatBar;
    return Math.max(1, dur);
  }

  return Math.max(1, 8 - nIdx);
}

/***********************
Instrument playback (CHORD-AWARE)
***********************/
function playInstrumentStep(){
  if(!state.instrumentOn) return;
  if(state.currentSection === "Full") return;

  // ✅ AutoScroll ON: follow playCardIndex
  // ✅ AutoScroll OFF: play the card currently in view (play-line / nearest visible)
  const card = state.autoScrollOn
    ? (getPlaybackCard() || getCardAtPlayLine() || getNearestVisibleCard())
    : (getCardAtPlayLine() || getNearestVisibleCard());

  if(!card) return;

  const nIdx = state.tick8 % 8;
  const cells = card.querySelectorAll(".noteCell");
  if(!cells[nIdx]) return;

  const raw = getNoteRawFromCell(cells[nIdx]);
  if(!raw) return;

  const eighthMs = Math.max(80, (state.eighthMs || 300));

  // "..." = single pluck note using LAST chord
  if(isDotsToken(raw)){
    if(state.lastChordRaw && parseChordToken(state.lastChordRaw)){
      playSingleNoteForInstrument(state.lastChordRaw, eighthMs);
    }
    return;
  }

  // "_" = repeat strum using LAST chord
  if(isRepeatToken(raw)){
    if(state.lastChordRaw && parseChordToken(state.lastChordRaw)){
      playChordForInstrument(state.lastChordRaw, eighthMs);
    }
    return;
  }

  // default chord cell = normal strum
  if(!parseChordToken(raw)) return;

  state.lastChordRaw = raw; // remember it for "_" and "..."

  const durEighths = computeNoteDurEighths(card, cells, nIdx);
  const durMs = Math.max(80, durEighths * (state.eighthMs || 300));

  playChordForInstrument(raw, durMs);
}



/***********************
AutoScroll
***********************/
  // ---------- AutoScroll: skip blanks + page (section) advance ----------

const AUTO_SECTIONS = SECTIONS.filter(s => s !== "Full");

function nextAutoSectionName(cur){
  const i = AUTO_SECTIONS.indexOf(cur);
  if(i === -1) return "VERSE 1";
  return AUTO_SECTIONS[(i + 1) % AUTO_SECTIONS.length];
}

// A "blank card" = NO lyrics AND ALL note cells empty
function cardIsBlank(card){
  if(!card) return true;

  const lyr = card.querySelector("textarea.lyrics");
  const hasLyrics = !!(lyr && String(lyr.value || "").trim());

  const noteCells = card.querySelectorAll("input.noteCell");
  let hasNotes = false;
  noteCells.forEach(inp => {
    const raw = String(inp?.dataset?.raw ?? inp?.value ?? "").trim();
    if(raw) hasNotes = true;
  });

  return !(hasLyrics || hasNotes);
}

function firstNonBlankCardIndexInDOM(){
  const cards = getCards();
  for(let i=0;i<cards.length;i++){
    if(!cardIsBlank(cards[i])) return i;
  }
  return null;
}

function nextNonBlankCardIndexAfter(currentIdx){
  const cards = getCards();
  for(let i=(currentIdx+1); i<cards.length; i++){
    if(!cardIsBlank(cards[i])) return i;
  }
  return null; // none after in this section
}

// Check project DATA (not DOM) so we can decide next section without rendering
function lineHasContentData(line){
  if(!line || typeof line !== "object") return false;

  const lyr = String(line.lyrics || "").trim();
  if(lyr) return true;

  const notes = Array.isArray(line.notes) ? line.notes : [];
  for(const n of notes){
    if(String(n || "").trim()) return true;
  }

  const beats = Array.isArray(line.beats) ? line.beats : [];
  for(const b of beats){
    if(String(b || "").trim()) return true;
  }

  return false;
}

function firstContentLineIndexInSection(sec){
  const arr = (state.project && state.project.sections && state.project.sections[sec]) ? state.project.sections[sec] : [];
  for(let i=0;i<arr.length;i++){
    if(lineHasContentData(arr[i])) return i;
  }
  return null;
}

function switchToSectionForAuto(sec){
  // switch tab + rerender, but do NOT kill clock
  state.currentSection = sec;
  state.playCardIndex = null;

  renderTabs();
  renderSheet();
  clearTick();
  applyTick();

  lastActiveCardEl = null;
  lastLyricsTextarea = null;
  refreshRhymesFromActive();
  refreshDisplayedNoteCells();
}


function autoAdvanceOnBar(){
  if(!state.autoScrollOn) return;
  if(state.currentSection === "Full") return;

  // only on bar boundary (every 8 eighth-notes)
  if(state.tick8 === 0) return;
  if(state.tick8 % 8 !== 0) return;

  const bar = Math.floor(state.tick8 / 8);
  if(state.lastAutoBar === bar) return;
  state.lastAutoBar = bar;

  // --- 1) Try next non-blank card in CURRENT section (DOM)
  let cards = getCards();
  if(cards.length === 0) return;

  // Ensure playCardIndex is sane
  if(state.playCardIndex === null || state.playCardIndex < 0 || state.playCardIndex >= cards.length){
    const cur = getCardAtPlayLine() || getNearestVisibleCard() || cards[0];
    state.playCardIndex = Math.max(0, cards.indexOf(cur));
  }

  // If current card is blank, jump to first non-blank in this section
  if(cards[state.playCardIndex] && cardIsBlank(cards[state.playCardIndex])){
    const firstIdx = firstNonBlankCardIndexInDOM();
    if(firstIdx !== null){
      state.playCardIndex = firstIdx;
      const next = cards[state.playCardIndex];
      lastActiveCardEl = next;
      scrollCardIntoView(next);
      return;
    }
    // no content in this section at all -> go to next section with content
  }else{
    const nextIdx = nextNonBlankCardIndexAfter(state.playCardIndex);
    if(nextIdx !== null){
      state.playCardIndex = nextIdx;
      const next = cards[state.playCardIndex];
      lastActiveCardEl = next;
      scrollCardIntoView(next);
      return;
    }
    // else: we've reached the end of content in this section -> advance section
  }

  // --- 2) Advance to next SECTION ("page to the right"), loop back to VERSE 1
  // Find next section (cyclic) that has any content
  let sec = nextAutoSectionName(state.currentSection);
  const startSec = sec;

  let foundSec = null;
  let foundIdx = null;

  while(true){
    const idx = firstContentLineIndexInSection(sec);
    if(idx !== null){
      foundSec = sec;
      foundIdx = idx;
      break;
    }
    sec = nextAutoSectionName(sec);
    if(sec === startSec) break; // scanned all
  }

  if(foundSec === null){
    // nothing anywhere — stay put
    return;
  }

  // Switch section + render, then scroll to first content card
  switchToSectionForAuto(foundSec);

  // after render, select the correct card index
  cards = getCards();
  state.playCardIndex = clamp(foundIdx, 0, Math.max(0, cards.length - 1));

  // if for some reason that target card became blank in DOM (rare), fallback to first non-blank
  if(cards[state.playCardIndex] && cardIsBlank(cards[state.playCardIndex])){
    const firstIdx = firstNonBlankCardIndexInDOM();
    if(firstIdx !== null) state.playCardIndex = firstIdx;
  }

  const next = cards[state.playCardIndex];
  if(next && !cardIsBlank(next)){
    lastActiveCardEl = next;
    scrollCardIntoView(next);
  }
}



/***********************
DRUMS + CLOCK (decoupled)
***********************/
function stopBeatClock(){
  if(state.beatTimer){
    clearInterval(state.beatTimer);
    state.beatTimer = null;
  }
if(!state.audioSyncOn) stopHorse();


  if(!state.audioSyncOn) clearTick();
}


function shouldClockRun(){
  return !!(state.drumsOn || state.instrumentOn || state.autoScrollOn);
}

/***********************
AUDIO SYNC CLOCK (MP3 is master)
- Beat position comes from audio.currentTime
- tick8 = floor( ( (t - offsetSec) * BPM / 60 ) * 2 )
***********************/
function audioSyncStopInternal(){
  state.audioSyncOn = false;
  stopHorse();

  // ✅ disconnect MP3-from-WebAudio routing
  try{
    if(state.audioSyncSource) state.audioSyncSource.disconnect();
  }catch{}
  try{
    if(state.audioSyncGain) state.audioSyncGain.disconnect();
  }catch{}
  state.audioSyncSource = null;
  state.audioSyncGain = null;

  if(state.audioSyncRaf){
    cancelAnimationFrame(state.audioSyncRaf);
    state.audioSyncRaf = null;
  }

  try{
    if(state.audioSyncAudio){
      state.audioSyncAudio.pause();
      state.audioSyncAudio.currentTime = 0;
    }
  }catch{}

  if(state.audioSyncUrl){
    try{ URL.revokeObjectURL(state.audioSyncUrl); }catch{}
  }

  state.audioSyncAudio = null;
  state.audioSyncUrl = null;
  state.audioSyncRecId = null;
  state.lastAudioTick8 = -1;

  clearTick();
  if(el.nowPlaying) el.nowPlaying.textContent = "—";
updateAudioButtonsUI();

  // if nothing else running, stop internal clock too
  updateClock();
}

function audioTickFromTimeSec(tSec){
  const bpm = clamp(state.bpm || 95, 40, 220);
  const rel = (tSec - (state.audioSyncOffsetSec || 0));
  if(rel < 0) return -1;
  const beatPos = (rel * bpm) / 60; // quarter-note beats
  const tick8 = Math.floor(beatPos * 2); // 8th notes
  return tick8;
}

function audioSyncFrame(){
  if(!state.audioSyncOn || !state.audioSyncAudio) return;

  const a = state.audioSyncAudio;
  const t = a.currentTime || 0;

  const tick8 = audioTickFromTimeSec(t);

  if(tick8 !== state.lastAudioTick8){
    state.lastAudioTick8 = tick8;
    state.tick8 = Math.max(0, tick8);
// Horse runs once per BAR during MP3 sync
if(state.tick8 % 8 === 0){
  const bar = Math.floor(state.tick8 / 8);
  if(bar !== state.lastHorseBar){
    state.lastHorseBar = bar;
    triggerHorseRun();
  }
}

    // ✅ same UI pipeline as your internal clock
    try{
      autoAdvanceOnBar();

      // only update tick highlight when allowed
      if(shouldTickRun()){
        clearTick();
        applyTick();
      }

      // We do NOT force drums/instrument on here.
      // If you want them to follow MP3 later, we can add that.
    }catch(err){
      console.error("Audio sync frame error:", err);
    }
  }

  state.audioSyncRaf = requestAnimationFrame(audioSyncFrame);

}


function stopAudioSync(){
  audioSyncStopInternal();
}

/***********************
Tap BPM (sets project BPM from taps)
***********************/
function tapBpm(){
  const t = performance.now();
  state.tapTimes = (state.tapTimes || []).filter(x => (t - x) < 2500);
  state.tapTimes.push(t);

  if(state.tapTimes.length >= 4){
    const first = state.tapTimes[0];
    const last = state.tapTimes[state.tapTimes.length - 1];
    const beats = state.tapTimes.length - 1;
    const sec = (last - first) / 1000;
    if(sec > 0.2){
      const bpm = clamp(Math.round((beats * 60) / sec), 40, 220);
      state.bpm = bpm;
      if(el.bpmInput) el.bpmInput.value = String(bpm);
      if(state.project){
        state.project.bpm = bpm;
        upsertProject(state.project);
      }
    }
    // keep last tap as new start (feels better)
    state.tapTimes = [state.tapTimes[state.tapTimes.length - 1]];
  }
}

/***********************
Mark Beat 1 at current playback time (offset)
- While audio playing, hit this exactly on beat 1.
- Stores offsetSec into the rec in IndexedDB.
***********************/
async function markBeat1Now(){
  if(!state.audioSyncOn || !state.audioSyncAudio || !state.audioSyncRecId) return;
  const t = state.audioSyncAudio.currentTime || 0;
  state.audioSyncOffsetSec = t;
// ✅ Force immediate re-sync visual + tick baseline
state.tick8 = 0;
state.lastAudioTick8 = -1;
state.lastHorseBar = -1; // ✅ reset horse bar lock
clearTick();
applyTick();

  // save into the rec
  try{
    const all = await dbGetAll();
    const rec = all.find(r => r.id === state.audioSyncRecId);
    if(rec){
      rec.offsetSec = t;
      await dbPut(rec);
      renderRecordings();
    }
  }catch{}
}

function startBeatClock(){

  if(state.audioSyncOn) return;
  stopBeatClock();
  const bpm = clamp(state.bpm || 95, 40, 220);
  const eighthMs = Math.round((60000 / bpm) / 2);
  state.eighthMs = eighthMs;

state.tick8 = 0;
state.lastAutoBar = -1;
state.lastHorseBar = -1; // ✅ reset so horse runs again
clearTick();


 state.beatTimer = setInterval(() => {
  try{
    // move scroll FIRST at bar boundary so audio+screen match
    autoAdvanceOnBar();

    clearTick();
    applyTick();

    // Horse runs once per BAR
if(state.tick8 % 8 === 0){
  const bar = Math.floor(state.tick8 / 8);
  if(bar !== state.lastHorseBar){
    state.lastHorseBar = bar;
    triggerHorseRun();
  }
}

    playInstrumentStep();

    state.tick8++;
  }catch(err){
    console.error("Beat clock error:", err);
    // keep clock alive even if audio fails
    state.tick8++;
  }
}, eighthMs);


}

function updateClock(){
  if(state.audioSyncOn){
  stopBeatClock();
  return;
}
  if(shouldClockRun()){
    if(!state.beatTimer) startBeatClock();
  }else{
    stopBeatClock();
  }
}


function stopDrums(){
  if(state.drumTimer){
    clearInterval(state.drumTimer);
    state.drumTimer = null;
  }
  state.drumsOn = false;
 updateClock();
}

function startDrums(){
  stopDrums();
  state.drumsOn = true;
  updateClock();

  const bpm = clamp(state.bpm || 95, 40, 220);
  const stepMs = Math.round((60000 / bpm) / 4);
  let step = 0;

  state.drumTimer = setInterval(() => {
    if(!state.drumsOn) return;
    const s = step % 16;

    if(state.drumStyle === "rap"){
      if(s === 0 || s === 8) drumHit("kick");
      if(s === 4 || s === 12) drumHit("snare");
      drumHit("hat");
    } else if(state.drumStyle === "rock"){
      if(s === 0 || s === 8) drumHit("kick");
      if(s === 4 || s === 12) drumHit("snare");
      if(s % 2 === 0) drumHit("hat");
    } else if(state.drumStyle === "hardrock"){
      if(s === 4 || s === 12) drumHit("snare");
      if(s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) drumHit("kick");
      drumHit("hat");
    } else {
      if(s === 0 || s === 7 || s === 8) drumHit("kick");
      if(s === 4 || s === 12) drumHit("snare");
      if(s % 2 === 0) drumHit("hat");
    }

    step++;
  }, stepMs);
}

function stopInstrument(){
  state.instrumentOn = false;
  state.audioToken++; // cancels pending strum timeouts
  updateClock();
}

function startInstrument(){
  state.instrumentOn = true;
  ensureCtx();
  state.audioToken++; // new generation
  updateClock();
}
function stopAllMusic(){
  // stops drum sequencer + instrument clocked playback
  stopDrums();
  stopInstrument();

  // stop MP3 sync (horse/tick)
  stopAudioSync();

  // ✅ reset drum pills (remove green)
  document.querySelectorAll(
    "#drumRock, #drumHardRock, #drumPop, #drumRap"
  ).forEach(btn => btn.classList.remove("active"));

  // ✅ reset instrument pills (remove green)
  document.querySelectorAll(
    "#instAcoustic, #instElectric, #instPiano"
  ).forEach(btn => btn.classList.remove("active"));

  // clear running modes in state
  state.drumMode = null;
  state.instrumentMode = null;
}
/***********************
UI helpers
***********************/
function setActive(ids, activeId){
  ids.forEach(id => {
    const b = $(id);
    if(!b) return;
    b.classList.toggle("active", id === activeId);
  });
}
function ensureCapoStepToggle(){
  if(!el.capoInput) return;

  // Wrap input + pill together (side-by-side)
  let wrap = document.getElementById("capoStepWrap");
  if(!wrap){
    wrap = document.createElement("span");
    wrap.id = "capoStepWrap";
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "6px";

    const parent = el.capoInput.parentNode;
    parent.insertBefore(wrap, el.capoInput);
    wrap.appendChild(el.capoInput);
  }else{
    if(el.capoInput.parentNode !== wrap) wrap.appendChild(el.capoInput);
  }

  // Create the single pill button if missing
  let btn = document.getElementById("capoStepToggle");
  if(!btn){
    btn = document.createElement("button");
    btn.id = "capoStepToggle";
    btn.type = "button";
    btn.className = "miniIconBtn";
    wrap.appendChild(btn);
  }else{
    if(btn.parentNode !== wrap) wrap.appendChild(btn);
  }

  // Paint pill + input based on mode
  function repaint(){
    const mode = (state.transposeMode === "step") ? "step" : "capo";
    btn.textContent = (mode === "step") ? "STEP" : "CAPO";
    btn.setAttribute("aria-label", btn.textContent);

    // visual
    btn.classList.toggle("on", mode === "step");

    // input behavior
    if(mode === "capo"){
      el.capoInput.step = "1";
      el.capoInput.inputMode = "numeric";
      el.capoInput.value = String(Number.isFinite(state.capo) ? state.capo : 0);
    }else{
      el.capoInput.step = "0.5";
      el.capoInput.inputMode = "decimal";
      el.capoInput.value = String(Number.isFinite(state.steps) ? state.steps : 0);
    }
  }

  // Always wire once (even if button already existed)
  if(!btn.dataset.wired){
    btn.dataset.wired = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      editProject("transposeMode", () => {
        state.transposeMode = (state.transposeMode === "capo") ? "step" : "capo";
        if(state.project) state.project.transposeMode = state.transposeMode;
      });

      repaint();
      refreshDisplayedNoteCells();
      updateKeyFromAllNotes();
      updateFullIfVisible?.();
    });
  }

  repaint();
}
function renderNoteLenUI(){
  if(el.instDots) el.instDots.classList.toggle("active", state.noteLenMode === "eighth");
  if(el.instTieBar) el.instTieBar.classList.toggle("active", state.noteLenMode === "bar");
}

function renderInstrumentUI(){
  const map = { acoustic:"instAcoustic", electric:"instElectric", piano:"instPiano" };
  const active = state.instrumentOn ? map[state.instrument] : null;
  setActive(Object.values(map), active);
  renderNoteLenUI();
}

function renderDrumUI(){
  const map = { rock:"drumRock", hardrock:"drumHardRock", pop:"drumPop", rap:"drumRap" };
  const mapMini = { rock:"mRock", hardrock:"mHardRock", pop:"mPop", rap:"mRap" };
  const active = state.drumsOn ? map[state.drumStyle] : null;
  setActive(Object.values(map), active);
  const activeMini = state.drumsOn ? mapMini[state.drumStyle] : null;
  setActive(Object.values(mapMini), activeMini);
}

function setAutoScroll(on){
  state.autoScrollOn = !!on;

  $("autoPlayBtn")?.classList.toggle("on", state.autoScrollOn);
  $("mScrollBtn")?.classList.toggle("on", state.autoScrollOn);

  if(state.autoScrollOn){
    // If user is on Full, start from VERSE 1 automatically
    if(state.currentSection === "Full"){
      switchToSectionForAuto("VERSE 1");
    }

    // reset section-advance guard so the first bar advance is clean
    state.lastAutoBar = -1;

    // Try to anchor to the current playline card
    const cards = getCards();
    if(cards.length){
      let cur = getCardAtPlayLine() || getNearestVisibleCard() || cards[0];
      let idx = Math.max(0, cards.indexOf(cur));

      // If current is blank, jump to first non-blank in this section
      if(cardIsBlank(cards[idx])){
        const firstIdx = firstNonBlankCardIndexInDOM();
        if(firstIdx !== null) idx = firstIdx;
      }

      state.playCardIndex = idx;
      const tgt = cards[state.playCardIndex];
      if(tgt && !cardIsBlank(tgt)) scrollCardIntoView(tgt);
    }else{
      state.playCardIndex = null;
    }

    // show an immediate tick (then the clock keeps it moving)
    clearTick();
    applyTick();

  }else{
    state.playCardIndex = null;

    // If MP3 sync is playing, stop the highlight immediately when AutoScroll OFF
    if(state.audioSyncOn){
      clearTick();
    }
  }

  // ✅ THIS IS THE MISSING PIECE: start/stop the beat clock based on AutoScroll
  updateClock();
}



function setPanelHidden(hidden){
  el.panelBody.classList.toggle("hidden", hidden);
  el.togglePanelBtn.textContent = hidden ? "Show" : "Hide";
  el.miniBar.classList.toggle("show", hidden);
}

function setRecordUI(){
  // Mini bar stays as text
  if(el.mRecordBtn) el.mRecordBtn.textContent = state.isRecording ? "Stop" : "Record";

  // Big record button is ICON-ONLY (CSS draws dot/square)
  if(el.recordBtn){
  el.recordBtn.classList.toggle("recording", state.isRecording);
  el.recordBtn.textContent = ""; // ✅ never overwrite icon
    el.recordBtn.title = state.isRecording ? "Stop Recording" : "Record";
    el.recordBtn.setAttribute("aria-label", el.recordBtn.title);
  }
}


/***********************
Tabs + editor
***********************/
function ensureSectionArray(sec){
  if(sec === "Full") return [];
  if(!state.project.sections[sec]) state.project.sections[sec] = [];

  // ✅ keep at least 1 card
  while(state.project.sections[sec].length < MIN_LINES_PER_SECTION){
    state.project.sections[sec].push(newLine());
  }
  return state.project.sections[sec];
}

function renderTabs(){
  // ✅ Tabs are removed (Beat Sheet Pro style)
  if(el.tabs){
    el.tabs.innerHTML = "";
    el.tabs.classList.add("hidden");
  }
}

function countSyllablesInline(text){
  const s = String(text||"").toLowerCase().replace(/[^a-z\s']/g," ").trim();
  if(!s) return 0;
  const words = s.split(/\s+/).filter(Boolean);
  let total = 0;
  for(const w0 of words){
    let w = w0.replace(/'s$/,"").replace(/'$/,"");
    if(!w) continue;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,"");
    w = w.replace(/^y/,"");
    const m = w.match(/[aeiouy]{1,2}/g);
    total += m ? m.length : 1;
  }
  return total;
}
/***********************
MANUAL SPLIT OVERRIDE ("/")
- If the lyrics contains "/", that line uses manual split into 4 beat boxes.
- AutoSplit stays active, but manual overrides that one line.
Examples:
  "I was / made for / more than / this"
  "/ intro / hook /"  (leading/trailing slashes OK)
***********************/
function manualBeatsFromSlashes(lyrics){
  const s = String(lyrics || "");
  if(!s.includes("/")) return null;

  // split by "/" and trim; keep meaningful parts
  let parts = s.split("/").map(x => String(x || "").trim());

  // If user does "a / b / c / d" you get 4 parts.
  // If they do "a/b/c/d" also fine.
  // Remove empty chunks at ends (from leading/trailing slashes)
  while(parts.length && !parts[0]) parts.shift();
  while(parts.length && !parts[parts.length-1]) parts.pop();

  // If nothing meaningful, treat as "no manual"
  if(!parts.length) return null;

  // Force exactly 4 boxes
  if(parts.length > 4){
    // join extras into box 4
    const head = parts.slice(0, 3);
    const tail = parts.slice(3).join(" ").trim();
    parts = [...head, tail];
  }else if(parts.length < 4){
    while(parts.length < 4) parts.push("");
  }

  return parts.map(x => String(x || "").trim());
}

function syllToneClass(n){
  n = n|0;

  // Red: 1–5 & 16+
  if(n >= 16 || (n >= 1 && n <= 5)) return "sylRed";

  // Yellow: 6–7 & 14–15
  if((n >= 6 && n <= 7) || (n >= 14 && n <= 15)) return "sylYellow";

  // Green: 8–13 (also covers 0 gracefully)
  return "sylGreen";
}

function updateSyllPill(pillEl, lyrics){
  if(!pillEl) return;
  const n = countSyllablesInline(lyrics || "");
  pillEl.textContent = "Syllables: " + n;

  pillEl.classList.remove("sylRed","sylYellow","sylGreen");
  pillEl.classList.add(syllToneClass(n));
}

function applyBeatsFromLyrics(lineObj){
  if(!lineObj) return;
  if(!state.autoSplit) return;

  const lyric = String(lineObj.lyrics || "");
  const manual = manualBeatsFromSlashes(lyric);

  // Manual override if "/" is present, otherwise normal autosplit
  lineObj.beats = manual ? manual : autosplitBeatsFromLyrics(lyric);
}

/***********************
AutoSplit
***********************/
function tokenizeWords(text){
  return String(text||"")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}
function estimateSyllablesWord(w){
  return Math.max(1, countSyllablesInline(w));
}

function autosplitBeatsFromLyrics(lyrics){
  const words = tokenizeWords(lyrics);
  if(words.length === 0) return ["","","",""];

  const sylCounts = words.map(estimateSyllablesWord);
  const totalSyl = sylCounts.reduce((a,b)=>a+b,0);
  const target = Math.max(1, Math.ceil(totalSyl / 4));

  const boxes = [[],[],[],[]];
  let bi = 0;
  let acc = 0;

  for(let i=0;i<words.length;i++){
    const w = words[i];
    const s = sylCounts[i];

    const remainingWords = words.length - i;
    const remainingBoxes = 4 - bi;

    if(bi < 3 && remainingWords === remainingBoxes && boxes[bi].length > 0){
      bi++;
      acc = 0;
    }

    if(bi < 3 && acc >= target && boxes[bi].length > 0){
      bi++;
      acc = 0;
    }

    boxes[bi].push(w);
    acc += s;
  }

  return boxes.map(arr => arr.join(" ").trim());
}

/***********************
Key display (uses chord roots)
***********************/
const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
function dot(a,b){ let s=0; for(let i=0;i<12;i++) s += (a[i]||0) * (b[i]||0); return s; }
function norm(v){ return Math.sqrt(v.reduce((a,x)=>a+(x*x),0)) || 1; }
function rotate(arr, t){
  const out = Array(12).fill(0);
  for(let i=0;i<12;i++) out[(i+t)%12] = arr[i];
  return out;
}
function keyFromHistogram(hist){
  const hn = norm(hist);
  let best = { score:-1e9, pc:0, mode:"maj" };
  for(let t=0;t<12;t++){
    const maj = rotate(MAJOR_PROFILE, t);
    const min = rotate(MINOR_PROFILE, t);
    const sMaj = dot(hist, maj)/hn/norm(maj);
    const sMin = dot(hist, min)/hn/norm(min);
    if(sMaj > best.score) best = { score:sMaj, pc:t, mode:"maj" };
    if(sMin > best.score) best = { score:sMin, pc:t, mode:"min" };
  }
  return best;
}

function updateKeyFromAllNotes(){
  const hist = Array(12).fill(0);
  SECTIONS.filter(s => s !== "Full").forEach(sec => {
    (state.project.sections[sec] || []).forEach(line => {
      (Array.isArray(line.notes) ? line.notes : []).forEach(tok => {
        const pc = noteToPC(tok);
        if(pc !== null) hist[pc] += 1;
      });
    });
  });

  const k = keyFromHistogram(hist);
  const semisInt = Math.round(getTransposeSemis()) % 12;   // ✅ key name must be integer semis
  const transposedPC = ((k.pc + semisInt) % 12 + 12) % 12; // ✅ always 0..11
  el.keyOutput.value = `${PC_TO_NAME[transposedPC]} ${k.mode}`;
}

/***********************
Full preview helpers (chord-aware transpose)
***********************/
function safeTok(s){
  const t = String(s ?? "").trim();
  return t ? t : "-";
}
function beatTok(s){
  return String(s ?? "").trim();
}

function buildAlignedLine(line, semis=0){
  const notes = Array.isArray(line?.notes) ? line.notes : Array(8).fill("");
  const beats = Array.isArray(line?.beats) ? line.beats : Array(4).fill("");
  const lyric = String(line?.lyrics ?? "").trim();

  const n = Array.from({length:8}, (_,i)=>{
    const raw = String(notes[i] ?? "").trim();
    if(!raw) return "-";
    return semis ? transposeChordName(raw, semis) : raw;
  });

  const b = Array.from({length:4}, (_,i)=> beatTok(beats[i] ?? ""));

  const anyBeats = b.some(x => x.trim().length);
  const beatRow = anyBeats ? b : (lyric ? autosplitBeatsFromLyrics(lyric) : ["","","",""]);

  const noteGroups = [
    `${safeTok(n[0])} ${safeTok(n[1])}`,
    `${safeTok(n[2])} ${safeTok(n[3])}`,
    `${safeTok(n[4])} ${safeTok(n[5])}`,
    `${safeTok(n[6])} ${safeTok(n[7])}`
  ];

  const widths = [0,1,2,3].map(i => {
    const w = Math.max(noteGroups[i].length, String(beatRow[i]||"").length);
    return Math.max(6, w) + 2;
  });

  const pad = (s, w) => String(s||"").padEnd(w, " ");

  const notesLine =
    pad(noteGroups[0], widths[0]) + "| " +
    pad(noteGroups[1], widths[1]) + "| " +
    pad(noteGroups[2], widths[2]) + "| " +
    pad(noteGroups[3], widths[3]);

  const beatsLine =
    pad(beatRow[0], widths[0]) + "| " +
    pad(beatRow[1], widths[1]) + "| " +
    pad(beatRow[2], widths[2]) + "| " +
    pad(beatRow[3], widths[3]);

  return { notesLine: notesLine.trimEnd(), beatsLine: beatsLine.trimEnd() };
}

function buildFullPreviewText(){
  const out = [];
  let any = false;

  SECTIONS.filter(s => s !== "Full").forEach(sec => {
    const arr = state.project.sections[sec] || [];

    const hasAny = arr.some(line => {
      const lyr = String(line?.lyrics || "").trim();
      const notes = Array.isArray(line?.notes) ? line.notes : [];
      const beats = Array.isArray(line?.beats) ? line.beats : [];
      const hasNotes = notes.some(n => String(n||"").trim());
      const hasBeats = beats.some(b => String(b||"").trim());
      return !!lyr || hasNotes || hasBeats;
    });
    if(!hasAny) return;

    any = true;
    out.push(sec.toUpperCase());
    out.push("");

    arr.forEach((line, idx) => {
      const lyr = String(line?.lyrics || "").trim();
      const notes = Array.isArray(line?.notes) ? line.notes : [];
      const beats = Array.isArray(line?.beats) ? line.beats : [];

      const hasNotes = notes.some(n => String(n||"").trim());
      const hasBeats = beats.some(b => String(b||"").trim());
      const hasLyrics = !!lyr;

      if(!hasNotes && !hasBeats && !hasLyrics) return;

      const aligned = buildAlignedLine(line, getTransposeSemis() || 0);

      out.push(`(${idx+1})`);
      out.push(`    ${aligned.notesLine}`);
      out.push(`    ${aligned.beatsLine}`);
      out.push("");
    });

    out.push("");
  });

  return any ? out.join("\n").trim() : "(No lyrics/notes yet - start typing in a section)";
}

function buildFullPreviewHtmlDoc(title){
  const lines = [];
  SECTIONS.filter(s => s !== "Full").forEach(sec => {
    const arr = state.project.sections[sec] || [];

    const hasAny = arr.some(line => {
      const lyr = String(line?.lyrics || "").trim();
      const notes = Array.isArray(line?.notes) ? line.notes : [];
      const beats = Array.isArray(line?.beats) ? line.beats : [];
      const hasNotes = notes.some(n => String(n||"").trim());
      const hasBeats = beats.some(b => String(b||"").trim());
      return !!lyr || hasNotes || hasBeats;
    });
    if(!hasAny) return;

    lines.push({ kind:"section", text: sec.toUpperCase() });
    lines.push({ kind:"blank", text:"" });

    arr.forEach((line, idx) => {
      const lyr = String(line?.lyrics || "").trim();
      const notes = Array.isArray(line?.notes) ? line.notes : [];
      const beats = Array.isArray(line?.beats) ? line.beats : [];

      const hasNotes = notes.some(n => String(n||"").trim());
      const hasBeats = beats.some(b => String(b||"").trim());
      const hasLyrics = !!lyr;
      if(!hasNotes && !hasBeats && !hasLyrics) return;

      const aligned = buildAlignedLine(line,getTransposeSemis() || 0);

      lines.push({ kind:"idx", text:`(${idx+1})` });
      lines.push({ kind:"notes", text:`    ${aligned.notesLine}` });
      lines.push({ kind:"lyrics", text:`    ${aligned.beatsLine}` });
      lines.push({ kind:"blank", text:"" });
    });

    lines.push({ kind:"blank", text:"" });
  });

  const safeTitle = escapeHtml(title || "Song Rider Pro - Full Preview");

  const bodyHtml = lines.length
    ? lines.map(L => {
        if(L.kind === "section") return `<div class="section">${escapeHtml(L.text)}</div>`;
        if(L.kind === "idx") return `<div class="idx">${escapeHtml(L.text)}</div>`;
        if(L.kind === "notes") return `<div class="notes">${escapeHtml(L.text)}</div>`;
        if(L.kind === "lyrics") return `<div class="lyrics">${escapeHtml(L.text)}</div>`;
        return `<div class="blank">${escapeHtml(L.text)}</div>`;
      }).join("\n")
    : `<div class="lyrics">(No lyrics/notes yet - start typing in a section)</div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
  :root{ --noteRed:#7f1d1d; }
  body{
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    margin:24px;
    color:#111;
  }
  .section{
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif;
    font-weight:900;
    margin-top:20px;
    margin-bottom:8px;
    letter-spacing:.3px;
  }
  .idx{ font-weight:900; margin:8px 0 2px; }
  .notes{ color: var(--noteRed); font-weight:900; white-space:pre; }
  .lyrics{ color:#111; white-space:pre; }
  .blank{ white-space:pre; height:10px; }
  @media print{ body{ margin:0.5in; } }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function updateFullIfVisible(){
  // Full Preview UI removed by design.
  // Export still works from cards, so nothing to update here.
  return;
}

/***********************
EXPORT
***********************/
async function exportFullPreview(){
  try{
    const plain = buildFullPreviewText();
    if(!plain || !String(plain).trim()){
      alert("Nothing to export yet.");
      return;
    }

    const safeName = String(state.project?.name || "Song Rider Pro")
      .replace(/[/:*?"<>|]+/g, "")
      .trim() || "Song Rider Pro";

    const htmlName = `${safeName} - Full Preview (Print).html`;
    const htmlDoc = buildFullPreviewHtmlDoc(`${safeName} - Full Preview`);
    const htmlBlob = new Blob([htmlDoc], { type:"text/html;charset=utf-8" });
    const htmlFile = new File([htmlBlob], htmlName, { type:"text/html" });

    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files:[htmlFile] })){
        await navigator.share({ title: safeName, files: [htmlFile] });
        return;
      }
    }catch{}

    const url = URL.createObjectURL(htmlBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = htmlName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);

  }catch{
    alert("Export failed on this device/browser.");
  }
}

/***********************
Sheet rendering
***********************/
function renderSheetActions(){
  // ✅ no "+ Line" in the header anymore
  el.sheetActions.innerHTML = "";
  if(state.currentSection === "Full") return;
}
function buildFullTemplate(){
  return `VERSE 1
Type your lyrics here (line 1)
Type your lyrics here (line 2)

CHORUS 1
Type your chorus here

VERSE 2

CHORUS 2

VERSE 3

BRIDGE

CHORUS 3
`;
}
  function buildFullScaffold(){
  // headings only, spaced for “type under heading”
  return FULL_EDIT_SECTIONS.map(h => `${h}\n`).join("\n");
}

// Adds any missing headings back in (does NOT reorder your content)
function ensureFullHeadingsPresent(fullText){
  const text = normalizeLineBreaks(fullText || "");
  const lines = text.split("\n");

  const present = new Set();
  for(const line of lines){
    const h = isSectionHeadingLine(line);
    if(h) present.add(h);
  }

  const missing = FULL_EDIT_SECTIONS.filter(h => !present.has(h));
  if(!missing.length) return text;

  const suffix =
    (text.trim().length ? "\n\n" : "") +
    missing.map(h => `${h}\n`).join("\n");

  return text.replace(/\s*$/, "") + suffix;
}
  /***********************
Cards -> FullText sync
- Rebuild fullText from current section card lyrics
- Used when cards are added/deleted/split so Full stays accurate
***********************/
let _fullSyncLock = false;

function syncFullTextFromSections(){
  if(_fullSyncLock) return;
  if(!state.project) return;

  _fullSyncLock = true;
  try{
    const out = [];

    // Build headings + lyrics (blank line between cards)
    FULL_EDIT_SECTIONS.forEach(sec => {
      out.push(sec);

      const arr = (state.project.sections && state.project.sections[sec]) ? state.project.sections[sec] : [];

      let wroteAny = false;
      for(const line of arr){
        const lyr = String(line?.lyrics || "").trim();
        if(!lyr) continue;
        wroteAny = true;
        out.push(lyr);
        out.push(""); // blank line = next card
      }

      // Keep at least one empty line under heading so user can type later
      if(!wroteAny) out.push("");

      // Extra spacing between sections
      out.push("");
    });

    // Clean trailing blank lines (keep file neat)
    while(out.length && out[out.length - 1] === "") out.pop();

    let text = out.join("\n") + "\n";
    text = ensureFullHeadingsPresent(text);

    state.project.fullText = text;
// ✅ do NOT save here — caller decides when to save/commit history

    // If Full page is currently open, update the textarea too
    if(state.currentSection === "Full"){
      const ta = document.querySelector("textarea.fullBox");
      if(ta){
        const s = ta.selectionStart, e = ta.selectionEnd;
        ta.value = state.project.fullText || "";
        try{ ta.selectionStart = s; ta.selectionEnd = e; }catch{}
      }
    }
  } finally {
    _fullSyncLock = false;
  }
}

function renderSheet(){
  el.sheetTitle.textContent = state.currentSection;
  renderSheetActions();

  state.playCardIndex = null;

if(state.currentSection === "Full"){
  el.sheetHint.textContent = 'Paste + edit. Use headings: VERSE 1, CHORUS 1, VERSE 2, CHORUS 2, VERSE 3, BRIDGE, CHORUS 3. Blank line = next card.';
  el.sheetBody.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "fullBoxWrap";

  const ta = document.createElement("textarea");
  ta.className = "fullBox";
  ta.addEventListener("focus", () => {
  lastLyricsTextarea = ta;     // ✅ so rhyme taps insert into Full view
  refreshRhymesFromActive();
});
ta.addEventListener("click", () => {
  lastLyricsTextarea = ta;     // ✅ cursor moves, seed word changes
  refreshRhymesFromActive();
});
  ta.readOnly = false;
  ta.placeholder =
`VERSE 1
Line 1
Line 2

(blank line = new card)

CHORUS 1
...`;

  // ✅ STOP AUTO-POPULATING FULL TEXT
// (No template gets inserted anymore)

// ✅ OPTIONAL CLEANUP:
// If a project already has the old template text, wipe it once automatically.
const _tpl = buildFullTemplate();
if(String(state.project.fullText || "") === _tpl){
  state.project.fullText = "";
  // keep flag true so it never tries to seed again (even if other code remains)
  state.project.fullSeeded = true;
  upsertProject(state.project);
}

// ✅ Seed headings scaffold if empty
if(!String(state.project.fullText || "").trim()){
  const scaffold = buildFullScaffold();
  state.project.fullText = scaffold;
  upsertProject(state.project);
}
ta.value = state.project.fullText || "";


  // Fill the available space better (no index.html edits required)
  ta.style.width = "100%";
  ta.style.minHeight = "calc(100vh - 220px)";
  ta.style.resize = "none";

  let tmr = null;
  ta.addEventListener("input", () => {
  // keep live text in memory immediately (no history yet)
  state.project.fullText = ta.value;

  // debounce so it doesn’t lag while typing
  if(tmr) clearTimeout(tmr);
  tmr = setTimeout(() => {
    // ✅ snapshot BEFORE changes (Undo works)
    editProject("fullText", () => {
      state.project.fullText = ta.value;
      applyFullTextToProjectSections(state.project.fullText || "");
    });

    updateKeyFromAllNotes();
    // don’t renderSheet() here (would move cursor)
  }, 180);
});

  // On first open, make sure cards match the full text once
  applyFullTextToProjectSections(state.project.fullText || "");
upsertProject(state.project); // ok to keep (no history needed on first open)

  wrap.appendChild(ta);
  el.sheetBody.appendChild(wrap);
  return;
}

  el.sheetHint.textContent = "";
  const cardsWrap = document.createElement("div");
  cardsWrap.className = "cards";

  const arr = ensureSectionArray(state.currentSection);

  arr.forEach((line, idx) => {
    if(!Array.isArray(line.notes)) line.notes = Array(8).fill("");
    if(!Array.isArray(line.beats)) line.beats = Array(4).fill("");
    line.notes = Array.from({length:8}, (_,i)=> String(line.notes[i] ?? "").trim());
    line.beats = Array.from({length:4}, (_,i)=> String(line.beats[i] ?? "").trim());

const card = document.createElement("div");
card.className = "card";

/* ✅ Add button (top-right, left of X) */
const addBtn = document.createElement("button");
addBtn.className = "cardAdd";
addBtn.type = "button";
addBtn.textContent = "+";
addBtn.title = "Add a new card below";

addBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const insertAt = idx + 1;
  const nl = newLine();
  editProject("addCard", () => {
  arr.splice(insertAt, 0, nl);
  // ✅ keep Full in sync
  syncFullTextFromSections();
});
  renderSheet();
  updateFullIfVisible();
  updateKeyFromAllNotes();
  clearTick(); applyTick();
  refreshDisplayedNoteCells();
  refreshRhymesFromActive();

  // ✅ after re-render, scroll to the new card
  setTimeout(() => {
    const cards = getCards();
    const target = cards[insertAt] || cards[cards.length - 1];
    if(target) scrollCardIntoView(target);
  }, 0);
});

card.appendChild(addBtn);

/* ✅ Delete button (top-right) */
const delBtn = document.createElement("button");
delBtn.className = "cardDel";
delBtn.type = "button";
delBtn.textContent = "×";
delBtn.title = "Delete this card";

delBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if(arr.length <= 1){
    if(!confirm("Clear this card?")) return;
    arr[0] = newLine();
  }else{
    if(!confirm(`Delete card ${idx+1} from ${state.currentSection}?`)) return;
    arr.splice(idx, 1);
  }

  editProject("deleteCard", () => {
  syncFullTextFromSections();
});
  renderSheet();
  updateFullIfVisible();
  updateKeyFromAllNotes();
  clearTick(); applyTick();
  refreshDisplayedNoteCells();
  refreshRhymesFromActive();
});

card.appendChild(delBtn);


    const top = document.createElement("div");
    top.className = "cardTop";

    const num = document.createElement("div");
    num.className = "cardNum";
    num.textContent = String(idx + 1);
    

    const syll = document.createElement("div");
    syll.className = "syllPill";
 updateSyllPill(syll, line.lyrics || "");


    top.appendChild(num);
    top.appendChild(syll);

    const notesRow = document.createElement("div");
    notesRow.className = "notesRow";

    for(let i=0;i<8;i++){
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "noteCell";

      const raw = String(line.notes[i] || "").trim();
      inp.dataset.raw = raw;

      inp.value = (state.capo ? transposeChordName(raw, state.capo) : raw);

      inp.autocomplete = "off";
      inp.autocapitalize = "characters";
      inp.spellcheck = false;

      inp.addEventListener("pointerdown", (e)=>{ e.stopPropagation(); });

      inp.addEventListener("focus", () => {
        lastActiveCardEl = card;
        inp.value = inp.dataset.raw || "";
      });

      inp.addEventListener("input", () => {
        const rawNow = String(inp.value || "").trim();
        inp.dataset.raw = rawNow;
        line.notes[i] = rawNow;

        upsertProject(state.project);
        updateKeyFromAllNotes();
        updateFullIfVisible();
      });

      inp.addEventListener("blur", () => {
        const rawNow = String(inp.value || "").trim();
        inp.dataset.raw = rawNow;
        line.notes[i] = rawNow;

      editProject("note", () => {
  // line.notes[i] already set above — just commit snapshot + save
});
        updateKeyFromAllNotes();
        updateFullIfVisible();

        inp.value = (state.capo ? transposeChordName(rawNow, state.capo) : rawNow);
      });

      notesRow.appendChild(inp);
    }

    const lyr = document.createElement("textarea");
    lyr.className = "lyrics";
    lyr.placeholder = "Type lyrics (AutoSplit on)…";
    lyr.value = line.lyrics || "";

    lyr.addEventListener("focus", () => {
      lastLyricsTextarea = lyr;
      lastActiveCardEl = card;
      refreshRhymesFromActive();
    });

    const beatsRow = document.createElement("div");
    beatsRow.className = "beatsRow";

    const beatInputs = [];
    for(let i=0;i<4;i++){
      const inp = document.createElement("textarea");
      inp.className = "beatCell";
      inp.value = String(line.beats[i] || "");
      inp.spellcheck = false;

      inp.addEventListener("pointerdown", (e)=>{ e.stopPropagation(); });

      inp.addEventListener("focus", () => {
        lastActiveCardEl = card;
      });

      inp.addEventListener("input", () => {
        line.beats[i] = String(inp.value || "").trim();
        editProject("beat", () => {
  // line.beats[i] already set above
});
        updateFullIfVisible();
      });

      beatInputs.push(inp);
      beatsRow.appendChild(inp);
    }

   lyr.addEventListener("input", () => {
  editProject("lyrics", () => {
    // 1) set lyrics
    line.lyrics = lyr.value;

    // 2) autosplit beats / manual slash override
    if(state.autoSplit){
      applyBeatsFromLyrics(line);
    }

    // 3) If user pasted multiple lines, split into new card(s)
    if(state.autoSplit && String(line.lyrics || "").includes("\n")){
      const parts = String(line.lyrics || "").split("\n");
      const first = parts.shift() || "";
      line.lyrics = first;

      // update beats for trimmed first line
      if(state.autoSplit) applyBeatsFromLyrics(line);

      const rest = parts.join("\n").trim();
      if(rest){
        const nl = newLine();
        nl.lyrics = rest;
        if(state.autoSplit) applyBeatsFromLyrics(nl);
        arr.splice(idx+1, 0, nl);
      }
    }

    // ✅ THE FIX: keep Full view text accurate for every card edit
    syncFullTextFromSections();
  });

  // UI updates (no saving needed here; editProject already saves)
  updateSyllPill(syll, line.lyrics || "");

  // refresh beat boxes from model (in case autosplit/manual changed)
  if(state.autoSplit){
    for(let k=0;k<4;k++){
      beatInputs[k].value = line.beats[k] || "";
    }
  }

  refreshRhymesFromActive();

  // If we split into new cards, rerender so you see them immediately
  if(String(lyr.value || "").includes("\n")){
    renderSheet();
    updateKeyFromAllNotes();
    clearTick(); applyTick();
    refreshDisplayedNoteCells();
    refreshRhymesFromActive();
  }
});

    card.appendChild(top);
    card.appendChild(notesRow);
    card.appendChild(lyr);
    card.appendChild(beatsRow);
    cardsWrap.appendChild(card);
  });

  el.sheetBody.innerHTML = "";
  el.sheetBody.appendChild(cardsWrap);

  lastActiveCardEl = getNearestVisibleCard();
  clearTick(); applyTick();

  refreshDisplayedNoteCells();
}
async function uploadAudioFile(){
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "audio/*"; // mp3, wav, m4a (browser dependent)
  inp.click();

  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if(!file) return;

    const item = {
      id: uuid(),
      projectId: state.project?.id || "",
      kind: "upload",
      createdAt: now(),
      title: file.name || "Audio",
      blob: file,          // File is a Blob
      offsetSec: 0         // you’ll want a Beat-1 marker button for this
    };

    await dbPut(item);
    await renderRecordings();

    // optional: auto-start sync immediately after upload
    await startAudioSyncFromRec(item);
  };
}

/***********************
Recordings UI
***********************/
function fmtDate(ms){
  try{ return new Date(ms).toLocaleString(); }catch{ return String(ms); }
}

async function renderRecordings(){
  const all = await dbGetAll();

  const pid = state.project?.id || "";
  const mine = all
    .filter(r => String(r.projectId || "") === pid)   // ✅ ONLY this project
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  el.recordingsList.innerHTML = "";

  if(mine.length === 0){
    const d = document.createElement("div");
    d.style.color="#666";
    d.style.fontWeight="900";
    d.textContent = "No recordings yet.";
    el.recordingsList.appendChild(d);
    return;
  }

  mine.forEach(rec => {
    const row = document.createElement("div");
    row.style.display="flex";
    row.style.gap="8px";
    row.style.alignItems="center";
    row.style.flexWrap="nowrap";
    row.style.overflow="hidden";
    row.style.whiteSpace="nowrap";
    row.style.border="1px solid rgba(0,0,0,.10)";
    row.style.borderRadius="14px";
    row.style.padding="10px";

    const title = document.createElement("div");
    title.style.flex="1 1 0";
    title.style.minWidth="0";
    title.style.overflow="hidden";
    title.style.textOverflow="ellipsis";
    title.style.whiteSpace="nowrap";
    title.style.fontWeight="1100";
    title.textContent = (rec.title && rec.title.trim() ? rec.title.trim() + " - " : "") + fmtDate(rec.createdAt || now());

    const edit = document.createElement("button");
    edit.className="btn secondary";
    edit.textContent="✏️";
    edit.title="Rename recording";
    edit.addEventListener("click", async () => {
      const name = prompt("Recording title:", rec.title || "");
      if(name === null) return;
      rec.title = (name.trim() || "");
      await dbPut(rec);
      renderRecordings();
    });

    const play = document.createElement("button");
    play.className="btn secondary";
    play.textContent="▶";
    play.title="Play";
    const stop = document.createElement("button");
stop.className="btn secondary";
stop.textContent="⏹";
stop.title="Stop (and stop sync)";
stop.addEventListener("click", () => {
  stopAudioSync();
});

  play.addEventListener("click", async () => {
  if(!rec.blob) return;

  // If something is already driving sync, stop it first
  if(state.audioSyncOn) stopAudioSync();

  // Start audio + tick/scroll sync from this recording
  await startAudioSyncFromRec(rec);
});



    const download = document.createElement("button");
    download.className="btn secondary";
    download.textContent="↓";
    download.title="Download";
    download.addEventListener("click", () => {
  if(!rec.blob) return;

  const blob = rec.blob;
  const type = String(blob.type || "").toLowerCase();

  // try extension from uploaded File name first
  let ext = "";
  if(blob instanceof File && blob.name){
    const m = blob.name.match(/\.([a-z0-9]+)$/i);
    if(m) ext = "." + m[1].toLowerCase();
  }

  // fallback by mime type
  if(!ext){
    if(type.includes("mpeg")) ext = ".mp3";
    else if(type.includes("mp3")) ext = ".mp3";
    else if(type.includes("wav")) ext = ".wav";
    else if(type.includes("mp4") || type.includes("m4a")) ext = ".m4a";
    else if(type.includes("ogg")) ext = ".ogg";
    else if(type.includes("webm")) ext = ".webm";
    else ext = ".audio";
  }

  const safeBase = (rec.title && rec.title.trim() ? rec.title.trim() : "recording")
    .replace(/[\\/:*?"<>|]+/g,"")
    .trim() || "recording";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeBase + ext;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
});


    const del = document.createElement("button");
    del.className="btn secondary";
    del.textContent="🗑️";
    del.title="Delete recording";
    del.addEventListener("click", async () => {
      if(!confirm("Delete this recording?")) return;
      await dbDelete(rec.id);
      renderRecordings();
    });

  row.appendChild(title);
row.appendChild(edit);
row.appendChild(play);
row.appendChild(stop);
row.appendChild(download);
row.appendChild(del);

    el.recordingsList.appendChild(row);
  });
}

/***********************
Recording bus (taps masterPost)
***********************/
function ensureRecordingBus(){
  const ctx = ensureCtx();

  if(!state.recDest){
    state.recDest = ctx.createMediaStreamDestination();
  }

  if(!state.recMix){
    state.recMix = ctx.createGain();
    state.recMix.gain.value = 1.0;
    state.recMix.connect(state.recDest);
  }

  if(!state.recWired && state.masterPost){
    try{
      state.masterPost.connect(state.recMix);
      state.recWired = true;
    }catch{}
  }

  if(state.audioSyncOn && state.audioSyncGain){
    try{
      state.audioSyncGain.connect(state.recMix);
    }catch{}
  }
}

async function startAudioSyncFromRec(rec){
  if(!rec || !rec.blob) return;

  // stop internal beat clock (mp3 becomes the clock)
  stopBeatClock();

  // stop drums/instrument to prevent “double audio chaos”
  if(state.drumsOn) stopDrums();
  if(state.instrumentOn) stopInstrument();

  // stop any current audio sync FIRST
  audioSyncStopInternal();

  // now enable sync
  state.audioSyncOn = true;
  state.audioSyncRecId = rec.id;
  state.audioSyncOffsetSec = Number(rec.offsetSec || 0) || 0;
  updateAudioButtonsUI();

  const url = URL.createObjectURL(rec.blob);
  state.audioSyncUrl = url;

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.playsInline = true;
  audio.muted = false;
  audio.volume = 1;

  state.audioSyncAudio = audio;

  const ctx = ensureCtx();

  // ALWAYS route MP3 through WebAudio so it can be recorded (and so levels are consistent)
  try{ if(state.audioSyncSource) state.audioSyncSource.disconnect(); }catch{}
  try{ if(state.audioSyncGain) state.audioSyncGain.disconnect(); }catch{}
  state.audioSyncSource = null;
  state.audioSyncGain = null;

  try{
    state.audioSyncSource = ctx.createMediaElementSource(audio);
    state.audioSyncGain = ctx.createGain();
    state.audioSyncGain.gain.value = 1.0;

    // To speakers via your master chain
    state.audioSyncSource.connect(state.audioSyncGain);
    state.audioSyncGain.connect(getOutNode());

    // If recorder bus exists (or once created), also feed into recorder mix
    if(state.recDest || state.recMix){
      ensureRecordingBus();
      try{ state.audioSyncGain.connect(state.recMix); }catch{}
    }
  }catch(e){
    console.warn("MP3->WebAudio routing failed:", e);
    // Fallback: let audio element play normally (still hear it, may not record it)
  }

  if(el.nowPlaying){
    const label = (rec.title && rec.title.trim()) ? rec.title.trim() : "Audio";
    el.nowPlaying.textContent = "Now playing: " + label;
  }

  audio.onended = () => {
    audioSyncStopInternal();
  };

  try{
    await audio.play();
  }catch(e){
    alert("Couldn't play audio. (Browser blocked playback.) Tap a button again to allow audio.");
    state.audioSyncOn = false;
    updateAudioButtonsUI();
    return;
  }

  state.lastAudioTick8 = -1;
  state.lastHorseBar = -1; // ✅ reset for MP3 sync too
  state.audioSyncRaf = requestAnimationFrame(audioSyncFrame);

} // ✅ CLOSE startAudioSyncFromRec
/***********************
MP3 AUTO-CONVERT (WebM/Opus -> MP3 using lamejs)
- converts immediately after recording stops
- stores MP3 blob into IndexedDB so in-app playback + download are MP3
***********************/
function hasLame(){
  return !!(window.lamejs && window.lamejs.Mp3Encoder);
}

function blobToArrayBuffer(blob){
  if(blob.arrayBuffer) return blob.arrayBuffer();
  return new Response(blob).arrayBuffer();
}

// Decode audio blob (webm/ogg/wav/etc) -> { sampleRate, channels:[Float32Array,...] }
async function decodeToPCM(blob){
  const ctx = ensureCtx();
  const ab = await blobToArrayBuffer(blob);

  // Some browsers need a copy for decodeAudioData
  const abCopy = ab.slice(0);

  const audioBuf = await new Promise((resolve, reject) => {
    try{
      ctx.decodeAudioData(
        abCopy,
        (buf)=>resolve(buf),
        (err)=>reject(err || new Error("decodeAudioData failed"))
      );
    }catch(e){
      reject(e);
    }
  });

  const ch = audioBuf.numberOfChannels || 1;
  const channels = [];
  for(let i=0;i<ch;i++){
    channels.push(audioBuf.getChannelData(i));
  }
  return { sampleRate: audioBuf.sampleRate, channels };
}

function floatTo16BitPCM(float32){
  const out = new Int16Array(float32.length);
  for(let i=0;i<float32.length;i++){
    let s = float32[i];
    s = Math.max(-1, Math.min(1, s));
    out[i] = (s < 0) ? (s * 0x8000) : (s * 0x7FFF);
  }
  return out;
}

// Encode PCM -> MP3 Blob
async function encodeMp3FromBlob(inputBlob, opts={}){
  const kbps = opts.kbps || 128; // good default
  const { sampleRate, channels } = await decodeToPCM(inputBlob);

  const numCh = Math.min(2, channels.length || 1);
  const left = channels[0];
  const right = (numCh > 1) ? channels[1] : null;

  // If sampleRate is weird, lamejs still works fine
  const enc = new window.lamejs.Mp3Encoder(numCh, sampleRate, kbps);

  const mp3Chunks = [];
  const blockSize = 1152;

  let i = 0;
  while(i < left.length){
    const l = floatTo16BitPCM(left.subarray(i, i + blockSize));
    let mp3buf;

    if(numCh === 2 && right){
      const r = floatTo16BitPCM(right.subarray(i, i + blockSize));
      mp3buf = enc.encodeBuffer(l, r);
    }else{
      mp3buf = enc.encodeBuffer(l);
    }

    if(mp3buf && mp3buf.length){
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
    i += blockSize;
  }

  const end = enc.flush();
  if(end && end.length){
    mp3Chunks.push(new Uint8Array(end));
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

// High-level: try convert -> if fails, return original blob
async function convertRecordingBlobToMp3(blob){
  // If lame isn't loaded, we cannot encode
  if(!hasLame()) return blob;

  try{
    const mp3 = await encodeMp3FromBlob(blob, { kbps: 192 });
    // sanity check (tiny files can happen if decode fails)
    if(mp3 && mp3.size > 800) return mp3;
    return blob;
  }catch(e){
    console.warn("MP3 convert failed, keeping original:", e);
    return blob;
  }
}

function pickBestMimeType(){
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg"
  ];
  for(const t of types){
    try{
      if(window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
    }catch{}
  }
  return "";
}
/***********************
MIC "MUSIC MODE" (Android fix)
- disables phone-call processing (AEC/NS/AGC)
***********************/
const MUSIC_MODE_CONSTRAINTS = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,

    // optional but helpful requests:
    channelCount: 2,
    sampleRate: 48000,
    sampleSize: 16,

    // legacy Chrome/Android flags (still often honored)
    googEchoCancellation: false,
    googNoiseSuppression: false,
    googAutoGainControl: false,
    googHighpassFilter: false,
    googTypingNoiseDetection: false
  }
};

// Keep 1 mic stream at a time (prevents Android getting "stuck" in call mode)
async function getMicStreamMusicMode(){
  try{
    if(state.recMicStream){
      state.recMicStream.getTracks().forEach(t => t.stop());
    }
  }catch{}
  state.recMicStream = null;

  const s = await navigator.mediaDevices.getUserMedia(MUSIC_MODE_CONSTRAINTS);
  state.recMicStream = s;
  return s;
}

async function startRecording(){
  ensureCtx();
  ensureRecordingBus();

  // Get mic (✅ MUSIC MODE: avoids phone-call processing on Android)
  const micStream = await getMicStreamMusicMode();

  state.recChunks = [];

  const ctx = ensureCtx();

  // Mic -> recorder mix (NOT directly to recDest)
  const micSource = ctx.createMediaStreamSource(micStream);
  state.recMicSource = micSource;

  const micGain = ctx.createGain();
  micGain.gain.value = 0.55;
const micCompressor = ctx.createDynamicsCompressor();
micCompressor.threshold.value = -24;  // start compressing earlier
micCompressor.knee.value = 30;
micCompressor.ratio.value = 5.5;
micCompressor.attack.value = 0.01;
micCompressor.release.value = 0.3;

 micSource.connect(micGain);
micGain.connect(micCompressor);
micCompressor.connect(state.recMix);


  const options = {};
  const mt = pickBestMimeType();
  if(mt) options.mimeType = mt;

  const rec = new MediaRecorder(state.recDest.stream, options);
  state.rec = rec;

  rec.ondataavailable = (e) => {
    if(e.data && e.data.size) state.recChunks.push(e.data);
  };

  rec.onstop = async () => {
    // cleanup mic nodes
    try{ micSource.disconnect(); }catch{}
    try{ micGain.disconnect(); }catch{}

    try{
      if(state.recMicStream){
        state.recMicStream.getTracks().forEach(t => t.stop());
      }
    }catch{}

  const mime = (mt && mt.includes("ogg")) ? "audio/ogg" : "audio/webm";
const rawBlob = new Blob(state.recChunks, { type: mime });

// ✅ auto convert to MP3 immediately (and store/play MP3)
const finalBlob = await convertRecordingBlobToMp3(rawBlob);

// Optional: make it obvious if conversion failed
const convertedOk = (finalBlob && String(finalBlob.type).includes("mpeg"));

const item = {
  id: uuid(),
  projectId: state.project?.id || "",
  kind: "mix",
  createdAt: now(),
  title: convertedOk ? "" : "(webm)",
  blob: finalBlob,
  offsetSec: 0
};

await dbPut(item);
await renderRecordings();


    state.rec = null;
    state.recChunks = [];
    state.recMicStream = null;
    state.recMicSource = null;
  };

  rec.start(250); // small timeslice helps some Android devices
  state.isRecording = true;
  setRecordUI();
}
async function stopRecording(){
  // ✅ PANIC STOP: kill drums + instrument + mp3-sync immediately
  stopAllMusic();

  if(!state.rec) return;
  try{ state.rec.stop(); }catch{}
  state.isRecording = false;
  setRecordUI();
}
async function toggleRecording(){
  try{
    if(state.isRecording) await stopRecording();
    else await startRecording();
  }catch(e){
    state.isRecording = false;
    setRecordUI();
    alert("Recording failed. Make sure mic permission is allowed for this site.");
  }
}


/***********************
Projects dropdown
***********************/
function renderProjectsDropdown(){
  const all = loadAllProjects().map(normalizeProject).filter(Boolean);
  const sort = el.sortSelect.value;

  let list = [...all];
  if(sort === "az") list.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  else list.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));

  el.projectSelect.innerHTML = "";
  list.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name || "Untitled";
    if(state.project && p.id === state.project.id) opt.selected = true;
    el.projectSelect.appendChild(opt);
  });

  if(el.projectSelect.options.length === 0){
    const p = defaultProject("New Song");
    upsertProject(p);
    state.project = p;
    renderProjectsDropdown();
  }
}

function applyProjectSettingsToUI(){
  if(!state.project) return;

  state.bpm = clamp(parseInt(state.project.bpm,10) || 95, 40, 220);
  state.capo = clamp(parseInt(state.project.capo,10) || 0, 0, 12);
  state.transposeMode = state.project.transposeMode || "capo";
state.steps = clamp(roundToHalf(parseFloat(state.project.steps) || 0), -24, 24);


  if(el.bpmInput) el.bpmInput.value = String(state.bpm);
if(el.bpmInput) el.bpmInput.value = String(state.bpm);

if(el.capoInput){
  el.capoInput.value = String(
    state.transposeMode === "capo"
      ? state.capo
      : state.steps
  );
}

ensureCapoStepToggle();

  updateKeyFromAllNotes();
  refreshDisplayedNoteCells();
}

function loadProjectById(id){
   // ✅ prevent “wrong project audio” weirdness
  if(state.audioSyncOn) stopAudioSync();
  const all = loadAllProjects().map(normalizeProject).filter(Boolean);
  const p = all.find(x => x.id === id);
  if(!p) return;
  state.project = p;
  localStorage.setItem(LS_CUR, p.id);

  applyProjectSettingsToUI();
  renderAll();
}

/***********************
RHYMES
***********************/
function normalizeWord(w){
  return String(w||"").toLowerCase().replace(/[^a-z']/g,"").trim();
}

function getLastWord(text){
  const words = String(text||"").match(/[A-Za-z']+/g) || [];
  return words.length ? words[words.length - 1] : "";
}

function getSeedFromTextarea(ta){
  if(!ta) return "";

  // ✅ FULL view: seed from text before cursor (last word)
  if(ta.classList && ta.classList.contains("fullBox")){
    const pos = (typeof ta.selectionStart === "number") ? ta.selectionStart : (ta.value || "").length;
    const before = String(ta.value || "").slice(0, pos);
    return getLastWord(before) || "";
  }

  // CARD view: prefer previous card's last word, else current last word
  const card = ta.closest(".card");
  if(card){
    const allCards = Array.from(el.sheetBody.querySelectorAll(".card"));
    const idx = allCards.indexOf(card);
    const prev = allCards[idx - 1];
    if(prev){
      const prevTa = prev.querySelector("textarea.lyrics");
      const prevLast = getLastWord(prevTa ? prevTa.value : "");
      if(prevLast) return prevLast;
    }
  }

  const currentLast = getLastWord(String(ta.value||""));
  return currentLast || "";
}

async function fetchDatamuseRhymes(word, max = 24){
  const w = normalizeWord(word);
  if(!w) return [];
  const url = `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(w)}&max=${max}`;
  try{
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) return [];
    const data = await res.json();
    return (data || []).map(x => x.word).filter(Boolean).slice(0, max);
  }catch{
    return [];
  }
}

async function fetchDatamuseNearRhymes(word, max = 24){
  const w = normalizeWord(word);
  if(!w) return [];
  const url = `https://api.datamuse.com/words?rel_nry=${encodeURIComponent(w)}&max=${max}`;
  try{
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) return [];
    const data = await res.json();
    return (data || []).map(x => x.word).filter(Boolean).slice(0, max);
  }catch{
    return [];
  }
}

function insertWordIntoLyrics(word){
  // ✅ Use the currently active textarea if it’s lyrics or fullBox
  const active = document.activeElement;
  if(active && active.tagName === "TEXTAREA" && (active.classList.contains("lyrics") || active.classList.contains("fullBox"))){
    lastLyricsTextarea = active;
  }

  if(!lastLyricsTextarea){
    const first = el.sheetBody.querySelector("textarea.lyrics") || el.sheetBody.querySelector("textarea.fullBox");
    if(first) lastLyricsTextarea = first;
  }
  if(!lastLyricsTextarea) return;

  const ta = lastLyricsTextarea;
  ta.focus();

  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;

  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);

  const needsSpaceBefore = before.length && !/\s$/.test(before);
  const needsSpaceAfter = after.length && !/^\s/.test(after);

  const insert = (needsSpaceBefore ? " " : "") + word + (needsSpaceAfter ? " " : "");
  ta.value = before + insert + after;

  const newPos = (before + insert).length;
  try{ ta.selectionStart = ta.selectionEnd = newPos; }catch{}

  // ✅ Trigger normal input pipeline (cards OR full view)
  ta.dispatchEvent(new Event("input", { bubbles:true }));
}


async function renderRhymes(seed){
  const word = normalizeWord(seed);

  el.rhymeWords.innerHTML = "";
  el.rhymeTitle.textContent = word ? `Rhymes: ${word}` : "Rhymes";

  const status = document.createElement("div");
  status.style.color = "#666";
  status.style.fontWeight = "900";
  status.textContent = word ? "Loading…" : "Tap a lyrics box and type a line.";
  el.rhymeWords.appendChild(status);

  if(!word) return;

  let list = await fetchDatamuseRhymes(word, 24);
  if(!list || list.length === 0){
    list = await fetchDatamuseNearRhymes(word, 24);
  }
  list = (list || []).filter(Boolean);

  el.rhymeWords.innerHTML = "";

  if(list.length === 0){
    status.textContent = "No good rhymes found (try another word).";
    el.rhymeWords.appendChild(status);
    return;
  }

  list.forEach(w => {
    const b = document.createElement("div");
    b.className = "rWord";
    b.textContent = w;
    b.addEventListener("click", () => insertWordIntoLyrics(w));
    el.rhymeWords.appendChild(b);
  });
}

function refreshRhymesFromActive(){
  if(el.rhymeDock.style.display !== "block") return;
  const seed = getSeedFromTextarea(lastLyricsTextarea);
  renderRhymes(seed);
}

function toggleRhymeDock(show){
  el.rhymeDock.style.display = show ? "block" : "none";
  if(show) refreshRhymesFromActive();
}

/***********************
Render all
***********************/
function updateAudioButtonsUI(){
  // ✅ Beat 1 button should ONLY show while MP3 sync is active
  if(el.beat1Btn){
    el.beat1Btn.style.display = state.audioSyncOn ? "inline-flex" : "none";
    // optional: change label so it’s not a confusing “1”
    if(state.audioSyncOn) el.beat1Btn.textContent = "Beat 1";
  }

  // ✅ Upload button becomes STOP while syncing
  if(el.uploadAudioBtn){
   el.uploadAudioBtn.textContent = state.audioSyncOn ? "⏹" : "⬆️";

  }
}
  function renderAll(){
  renderProjectsDropdown();
  renderTabs();
  renderSheet();
  renderRecordings();
  renderInstrumentUI();
  renderDrumUI();
  updateKeyFromAllNotes();
  setRecordUI();
  
  clearTick();
  applyTick();
  updateFullIfVisible();
  refreshRhymesFromActive();
  refreshDisplayedNoteCells();
  
  updateAudioButtonsUI();
    ensureCapoStepToggle();
    injectHeaderControlTightStyle();
}
/***********************
SECTION paging (swipe left/right)
Order loops back to Full after CHORUS 3
***********************/
const SECTION_PAGES = SECTIONS.slice(); // includes "Full" first

function isEditableEl(target){
  if(!target) return false;
  const tag = (target.tagName || "").toUpperCase();
  if(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return true;
  if(target.isContentEditable) return true;
  return false;
}

function goToSection(sec){
  if(!sec || sec === state.currentSection) return;

  state.currentSection = sec;
  state.playCardIndex = null;
  state.lastAutoBar = -1;

  renderTabs();
  renderSheet();
  clearTick();
  applyTick();

  lastActiveCardEl = null;
  lastLyricsTextarea = null;
  refreshRhymesFromActive();
  refreshDisplayedNoteCells();
  updateFullIfVisible();

scrollToTopOfSheet();
}

function nextSection(){
  const i = SECTION_PAGES.indexOf(state.currentSection);
  const next = SECTION_PAGES[(i + 1) % SECTION_PAGES.length];
  goToSection(next);
}

function prevSection(){
  const i = SECTION_PAGES.indexOf(state.currentSection);
  const prev = SECTION_PAGES[(i - 1 + SECTION_PAGES.length) % SECTION_PAGES.length];
  goToSection(prev);
}

/***********************
Swipe detection (horizontal)
***********************/
function installSectionSwipe(){
  let sx=0, sy=0, t0=0, tracking=false, locked=false;
  let lastFire = 0;

  const MIN_X = 60;
  const MAX_MS = 800;
  const DOMINANCE = 1.35;

  function onStart(e){
    if(el.rhymeDock && el.rhymeDock.style.display === "block") return;

    const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const target = e.target;

    // don’t page-switch when starting on controls or inside the panel
    if(isEditableEl(target) || (target && target.closest && target.closest("#panelBody"))) return;

    sx = pt.clientX; sy = pt.clientY; t0 = performance.now();
    tracking = true;
    locked = false;
  }

  function onMove(e){
    if(!tracking) return;
    const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;

    const dx = pt.clientX - sx;
    const dy = pt.clientY - sy;

    if(!locked){
      if(Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * DOMINANCE){
        locked = true;
      }else if(Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)){
        tracking = false;
        return;
      }
    }
  }

  function onEnd(e){
    if(!tracking) return;
    tracking = false;

    const pt = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
    const dx = pt.clientX - sx;
    const dy = pt.clientY - sy;
    const dt = performance.now() - t0;

    if(dt > MAX_MS) return;
    if(Math.abs(dx) < MIN_X) return;
    if(Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;

    const nowMs = performance.now();
    if(nowMs - lastFire < 250) return;
    lastFire = nowMs;

    if(dx < 0) nextSection();
    else prevSection();
  }

  document.addEventListener("touchstart", onStart, { passive:true });
  document.addEventListener("touchmove", onMove, { passive:true });
  document.addEventListener("touchend", onEnd, { passive:true });

  document.addEventListener("pointerdown", onStart, { passive:true });
  document.addEventListener("pointermove", onMove, { passive:true });
  document.addEventListener("pointerup", onEnd, { passive:true });

  // Desktop arrow keys (when not typing)
  document.addEventListener("keydown", (e)=>{
    if(isEditableEl(document.activeElement)) return;
    if(e.key === "ArrowLeft") prevSection();
    if(e.key === "ArrowRight") nextSection();
  });
}

/***********************
Wiring
***********************/
function wire(){
  el.togglePanelBtn.addEventListener("click", () => {
    const hidden = !el.panelBody.classList.contains("hidden");
    setPanelHidden(hidden);
  });

  // ✅ AutoSplit is always ON (manual "/" overrides per-line)
  // If the old button still exists in HTML, hide it.
  const oldAuto = $("autoSplitBtn");
  if(oldAuto) oldAuto.style.display = "none";

  if(el.undoBtn) el.undoBtn.addEventListener("click", () => undo());
  if(el.redoBtn) el.redoBtn.addEventListener("click", () => redo());

  if(el.saveBtn) el.saveBtn.addEventListener("click", () => {
    if(!state.project) return;
    // force commit + visual feedback
    upsertProject(state.project);
    updateUndoRedoUI();

    try{
      el.saveBtn.classList.add("savedFlash");
      setTimeout(()=> el.saveBtn && el.saveBtn.classList.remove("savedFlash"), 220);
    }catch{}
  });
  // ✅ create the CAPO/STEP pill + force inline wrap
  ensureCapoStepToggle();
  injectHeaderControlTightStyle();
  // ✅ CAPTURE commit: prevents any other blur/change handlers from snapping .5 to int
if(el.capoInput){
  const commitCapoStep_CAPTURE = (e) => {
    e.stopImmediatePropagation();

    const mode = (state.transposeMode === "step") ? "step" : "capo";
    let v = parseFloat(el.capoInput.value);
    if(!Number.isFinite(v)) v = 0;

    if(mode === "capo"){
      v = clamp(Math.round(v), 0, 12);
      state.capo = v;
      if(state.project) state.project.capo = v;
      el.capoInput.value = String(v);
    }else{
      v = clamp(Math.round(v * 2) / 2, -24, 24);
      state.steps = v;
      if(state.project) state.project.steps = v;
      el.capoInput.value = String(v);
    }

    if(state.project) upsertProject(state.project);

    // keep UI synced
    ensureCapoStepToggle();
    refreshDisplayedNoteCells();
    updateKeyFromAllNotes();
    updateFullIfVisible?.();
  };

  el.capoInput.addEventListener("change", commitCapoStep_CAPTURE, true);
  el.capoInput.addEventListener("blur", commitCapoStep_CAPTURE, true);
}
// ===== CAPO / STEP input (mode-aware, supports .5 in STEP) =====
function roundToHalf(n){
  return Math.round(n * 2) / 2;
}

function commitCapoOrStepFromInput(){
  const mode = state.transposeMode || "capo";
  const raw = parseFloat(el.capoInput.value);
  let v = Number.isFinite(raw) ? raw : 0;

  if(mode === "capo"){
    v = clamp(Math.round(v), 0, 12);
    state.capo = v;
    if(state.project) state.project.capo = v;
    el.capoInput.step = "1";
    el.capoInput.inputMode = "numeric";
    el.capoInput.value = String(v);
  }else{
    v = clamp(roundToHalf(v), -24, 24);
    state.steps = v;
    if(state.project) state.project.steps = v;
    el.capoInput.step = "0.5";
    el.capoInput.inputMode = "decimal";
    el.capoInput.value = String(v);
  }

  if(state.project) upsertProject(state.project);
  refreshDisplayedNoteCells();
  updateKeyFromAllNotes();
  updateFullIfVisible();
  ensureCapoStepToggle(); // ✅ re-paint label CAPO/STEP every commit
}
if(el.capoInput){
  el.capoInput.addEventListener("keydown", (e) => {
    if(e.key === "Enter"){
      e.preventDefault();
      e.stopPropagation();
      el.capoInput.blur();
    }
  });

  el.capoInput.addEventListener("input", () => {
    const mode = state.transposeMode || "capo";
    const raw = parseFloat(el.capoInput.value);
    const v = Number.isFinite(raw) ? raw : 0;

    editProject("transposeAmount", () => {
      if(mode === "capo"){
        state.capo = clamp(v, 0, 12);
        if(state.project) state.project.capo = state.capo;
      }else{
        state.steps = clamp(v, -24, 24);
        if(state.project) state.project.steps = state.steps;
      }
    });

    refreshDisplayedNoteCells();
    updateKeyFromAllNotes();
  });

  el.capoInput.addEventListener("change", () => {
    editProject("capoOrStep", () => commitCapoOrStepFromInput());
  });

  el.capoInput.addEventListener("blur", () => {
    editProject("capoOrStep", () => commitCapoOrStepFromInput());
  });
}
  // Keyboard shortcuts (don’t trigger while typing in inputs/textareas)
  document.addEventListener("keydown", (e) => {
    const a = document.activeElement;
    const tag = (a && a.tagName) ? a.tagName.toUpperCase() : "";
    const typing = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || (a && a.isContentEditable));
    if(typing) return;

    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if(!mod) return;

    const k = (e.key || "").toLowerCase();

    // Undo: Ctrl/Cmd+Z
    if(k === "z" && !e.shiftKey){
      e.preventDefault();
      undo();
      return;
    }

    // Redo: Ctrl/Cmd+Y OR Ctrl/Cmd+Shift+Z
    if(k === "y" || (k === "z" && e.shiftKey)){
      e.preventDefault();
      redo();
      return;
    }
  }, { capture:true });


  if(el.exportBtn){
    el.exportBtn.addEventListener("click", exportFullPreview);
  }

  function restartClockIfRunning(){
    if(shouldClockRun()){
      startBeatClock();
    }
  }

  function commitBpm(){
    let n = parseInt(el.bpmInput.value, 10);
    if(!Number.isFinite(n)) n = state.bpm || 95;
    n = clamp(n, 40, 220);

    state.bpm = n;
    el.bpmInput.value = String(n);

    if(state.project){
      state.project.bpm = n;
      upsertProject(state.project);
    }

    if(state.drumsOn) startDrums();
    restartClockIfRunning();
  }

  el.bpmInput.addEventListener("input", () => {
    const raw = el.bpmInput.value;
    if(raw === "") return;

    const n = parseInt(raw, 10);
    if(Number.isFinite(n) && n >= 40 && n <= 220){
      state.bpm = n;
      if(state.project){
        state.project.bpm = n;
        upsertProject(state.project);
      }
      if(state.drumsOn) startDrums();
      restartClockIfRunning();
    }
  });

  el.bpmInput.addEventListener("change", commitBpm);
  el.bpmInput.addEventListener("blur", commitBpm);

  function commitCapo(){
    let n = parseInt(el.capoInput.value, 10);
    if(!Number.isFinite(n)) n = 0;
    n = clamp(n, 0, 12);

    state.capo = n;
    el.capoInput.value = String(n);

    if(state.project){
      state.project.capo = n;
      upsertProject(state.project);
    }

    updateKeyFromAllNotes();
    updateFullIfVisible();
    refreshDisplayedNoteCells();
  }

 el.capoInput.addEventListener("input", () => {
   
  const mode = state.transposeMode || "capo";
   
 const raw = parseFloat(el.capoInput.value);
const v = Number.isFinite(raw) ? raw : 0; 

  editProject("transposeAmount", () => {
    if(mode === "capo"){
      state.capo = clamp(v, 0, 12);
      if(state.project) state.project.capo = state.capo;
    }else{
      state.steps = clamp(v, -24, 24);
      if(state.project) state.project.steps = state.steps;
    }
  });

  refreshDisplayedNoteCells();
  updateKeyFromAllNotes();
}); 

  el.capoInput.addEventListener("change", commitCapo);
  el.capoInput.addEventListener("blur", commitCapo);

  function handleInstrument(which){
    ensureCtx();
    if(state.instrument === which && state.instrumentOn){
      stopInstrument();
    }else{
      state.instrument = which;
      startInstrument();
    }
    renderInstrumentUI();
  }

  el.instAcoustic.addEventListener("click", () => handleInstrument("acoustic"));
  el.instElectric.addEventListener("click", () => handleInstrument("electric"));
  el.instPiano.addEventListener("click", () => handleInstrument("piano"));

  if(el.instDots){
    el.instDots.addEventListener("click", () => {
      state.noteLenMode = (state.noteLenMode === "eighth") ? "half" : "eighth";
      renderNoteLenUI();
    });
  }

  if(el.instTieBar){
    el.instTieBar.addEventListener("click", () => {
      state.noteLenMode = (state.noteLenMode === "bar") ? "half" : "bar";
      renderNoteLenUI();
    });
  }

  function handleDrums(which){
    ensureCtx();
    if(state.drumStyle === which && state.drumsOn){
      stopDrums();
    }else{
      state.drumStyle = which;
      startDrums();
    }
    renderDrumUI();
  }

  el.drumRock.addEventListener("click", () => handleDrums("rock"));
  el.drumHardRock.addEventListener("click", () => handleDrums("hardrock"));
  el.drumPop.addEventListener("click", () => handleDrums("pop"));
  el.drumRap.addEventListener("click", () => handleDrums("rap"));

  el.mRock.addEventListener("click", () => handleDrums("rock"));
  el.mHardRock.addEventListener("click", () => handleDrums("hardrock"));
  el.mPop.addEventListener("click", () => handleDrums("pop"));
  el.mRap.addEventListener("click", () => handleDrums("rap"));

  el.autoPlayBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));
  el.mScrollBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));

  el.recordBtn.addEventListener("click", toggleRecording);
  el.mRecordBtn.addEventListener("click", toggleRecording);

  el.sortSelect.addEventListener("change", renderProjectsDropdown);
  el.projectSelect.addEventListener("change", () => loadProjectById(el.projectSelect.value));

  el.newProjectBtn.addEventListener("click", () => {
    const name = prompt("New project name:", "New Song");
    if(name === null) return;
    const p = defaultProject(name.trim() || "New Song");
    upsertProject(p);
    state.project = p;
    state.currentSection = "Full";
    applyProjectSettingsToUI();
    renderAll();
  });

  el.renameProjectBtn.addEventListener("click", () => {
    if(!state.project) return;
    const name = prompt("Project name:", state.project.name || "");
    if(name === null) return;
    state.project.name = name.trim() || "Untitled";
    upsertProject(state.project);
    renderProjectsDropdown();
  });

  el.deleteProjectBtn.addEventListener("click", () => {
    if(!state.project) return;
    if(!confirm(`Delete project "${state.project.name}"?`)) return;
    deleteProjectById(state.project.id);
    state.project = getCurrentProject();
    state.currentSection = "Full";
    applyProjectSettingsToUI();
    renderAll();
  });
if(el.uploadAudioBtn){
  el.uploadAudioBtn.addEventListener("click", async () => {
    // If audio is currently syncing, this button becomes STOP
    if(state.audioSyncOn){
      stopAudioSync();
      return;
    }
    // Otherwise it uploads and can auto-play/sync
    await uploadAudioFile();
  });
}

if(el.beat1Btn){
  el.beat1Btn.addEventListener("click", () => {
    markBeat1Now();
  });
}


  el.rBtn.addEventListener("click", () => {
    const showing = el.rhymeDock.style.display === "block";
    toggleRhymeDock(!showing);
  });
  el.hideRhymeBtn.addEventListener("click", () => toggleRhymeDock(false));
}

/***********************
Init
***********************/
function init(){
  state.project = getCurrentProject();

    injectBspCardLook(); // ✅ ADD THIS LINE
injectHeaderMiniIconBtnStyle();

  applyProjectSettingsToUI();

  setPanelHidden(false);
  setAutoScroll(false);

  state.instrumentOn = false;
  state.drumsOn = false;

  renderNoteLenUI();
  setRecordUI();
  wire();
  renderAll();
  pushHistory("init"); // seed the first snapshot
updateUndoRedoUI();
  installSectionSwipe();

  stopBeatClock();
}

init();
})();
