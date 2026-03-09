/* app.js (FULL REPLACE MAIN v46_unfrozen_pdfHeadings) */
(() => {

"use strict";

// ✅ prevents heavy full-text auto-apply from running on every render
let didInitialFullApply = false;
let sheetHeaderBtnLock = false;

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

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const nextTick = () => new Promise(r => setTimeout(r, 0));

/***********************
Textarea autosize (Full page blocks)
- Makes each section body expand to fit content
- Prevents inner scrolling between headings
***********************/
function autosizeTextarea(ta){
  if(!ta) return;
  // Reset then expand to scrollHeight
  ta.style.height = "auto";
  ta.style.overflowY = "hidden";
  // Use scrollHeight; add a tiny buffer to avoid jitter on Android
  const h = (ta.scrollHeight || 0) + 2;
  if(h > 0) ta.style.height = h + "px";
}
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
  notesBtn: $("notesBtn"),
  notesModal: $("notesModal"),
  notesEditor: $("notesEditor"),
  notesCloseBtn: $("notesCloseBtn"),
  notesToolbar: $("notesToolbar"),
  notesUndoBtn: $("notesUndoBtn"),
  notesRedoBtn: $("notesRedoBtn"),
  notesFontSize: $("notesFontSize"),
  notesTextColor: $("notesTextColor"),

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
sheetInner: $("sheetInner"),
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
  /* ✅ enough runway for last card without giant slack */
  padding-bottom: calc(clamp(140px, 35vh, 260px) + env(safe-area-inset-bottom));
}

    .card{
      position: relative !important;      /* needed for + / × positioning */
      margin: 10px 0 !important;          /* tighter so 2 cards fit */
      padding: 12px !important;
      border-radius: 16px !important;
      padding-top: 12px !important;       /* top bar is in-flow now */
    }

    /* Top row (number + syllables pill) smaller */
    .cardTop{
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 10px !important;
      margin-bottom: 8px !important;
    }
    .cardTopLeft{
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      flex: 1 1 auto !important;
      min-width: 0 !important;
    }
    .cardTopRight{
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      flex: 0 0 auto !important;
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
      font-weight: 900 !important;
      border-radius: 12px !important;
      text-align: center !important;
    }

    /* LYRICS: smaller + shorter so 2 cards show */
    textarea.lyrics{
      font-size: 17px !important;
      font-weight: 900 !important;
      line-height: 1.18 !important;
      padding: 9px !important;
      border-radius: 12px !important;
      min-height: 70px !important;
    }

    /* Beat boxes: smaller + shorter */
    textarea.beatCell{
      font-size: 13px !important;
      font-weight: 900 !important;
      line-height: 1.15 !important;
      padding: 7px !important;
      border-radius: 12px !important;
      min-height: 70px !important;
    }

    /* ===== Card top right buttons (in-flow) ===== */
    .cardAdd, .cardDel{
      position: static !important;
      width: 38px !important;
      height: 34px !important;
      font-size: 18px !important;
      border-radius: 999px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
      line-height: 1 !important;
      border: 1px solid rgba(0,0,0,.16) !important;
      background: rgba(255,255,255,.92) !important;
      flex: 0 0 auto !important;
    }
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

// Persist caret positions for rhyme seeding (mobile safe)
function _rememberCaret(ta){
  try{
    if(!ta || ta.tagName !== "TEXTAREA") return;
    if(typeof ta.selectionStart === "number") ta.__lastSelStart = ta.selectionStart;
    if(typeof ta.selectionEnd === "number") ta.__lastSelEnd = ta.selectionEnd;
  }catch{}
}
function _attachCaretRemember(ta){
  if(!ta || ta.__caretRememberAttached) return;
  ta.__caretRememberAttached = true;
  const fn = () => _rememberCaret(ta);
  ta.addEventListener("keyup", fn, {passive:true});
  ta.addEventListener("click", fn, {passive:true});
  ta.addEventListener("touchend", fn, {passive:true});
  ta.addEventListener("input", fn, {passive:true});
  ta.addEventListener("select", fn, {passive:true});
}

// ✅ Capture caret position BEFORE clicking the rhyme button (mobile blur can move caret to end)
function _captureRhymeCaret(){
  try{
    const a = document.activeElement;
    if(a && a === el.notesEditor){
      cacheNotesSelection();
      placeNotesRhymeMarker();
      return;
    }
    if(a && a.tagName === "TEXTAREA" && (a.classList.contains("lyrics") || a.classList.contains("fullBox") || a.classList.contains("fullSectionText"))){
      _rememberCaret(a);
      // store a short-lived "rhyme-open" caret snapshot
      a.__rhymeSelStart = (typeof a.selectionStart === "number") ? a.selectionStart : a.__lastSelStart;
      a.__rhymeSelTs = Date.now();
      lastLyricsTextarea = a;
    }else if(lastLyricsTextarea && lastLyricsTextarea.tagName === "TEXTAREA") {
      // IMPORTANT: if the textarea is not focused, do NOT call _rememberCaret() here.
      // On Android, blur can make selectionStart jump to end, and _rememberCaret would overwrite __lastSelStart.
      const focused = (document.activeElement === lastLyricsTextarea);
      if(focused) _rememberCaret(lastLyricsTextarea);
      const snap = (focused && (typeof lastLyricsTextarea.selectionStart === "number")) ? lastLyricsTextarea.selectionStart : lastLyricsTextarea.__lastSelStart;
      if(typeof snap === "number") lastLyricsTextarea.__rhymeSelStart = snap;
      lastLyricsTextarea.__rhymeSelTs = Date.now();
    }
  }catch{}
}



let lastActiveCardEl = null;

document.addEventListener("focusin", (e) => {
  const t = e.target;

  // ✅ Track BOTH card lyrics textarea AND Full textarea
  if(t && t.tagName === "TEXTAREA" && (t.classList.contains("lyrics") || t.classList.contains("fullBox"))){
    lastLyricsTextarea = t;
    _attachCaretRemember(t);
    _rememberCaret(t);

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
    _attachCaretRemember(e.target);
    _rememberCaret(e.target);
    refreshRhymesFromActive();
  }
}, { passive:true });

document.addEventListener("selectionchange", () => {
  if(!lastLyricsTextarea) return;
  // ✅ Only update stored caret when the textarea is actually focused.
  // Mobile can blur the textarea when you tap the Rhyme button, which can make selectionStart jump to the end.
  if(document.activeElement !== lastLyricsTextarea) return;
  _rememberCaret(lastLyricsTextarea);
  refreshRhymesFromActive();
});

/***********************
Sections (PAGES)
- No preset titles.
- 10 base pages always exist.
- Extra pages can be added after Page 10.
***********************/
const BASE_PAGES = Array.from({length:10}, (_,i)=>`PAGE ${i+1}`);
const SECTIONS = ["Full", ...BASE_PAGES];
const MIN_LINES_PER_SECTION = 1;

/***********************
FULL PAGE (Break-Line sections)
- Full view uses "__________" as the section break line
- Optional title line appears right after a break line
- Upload/copy-paste can still use headings like INTRO / VERSE / CHORUS / BRIDGE / OUTRO / INTERLUDE, etc.
***********************/
const BREAK_LINE = "__________"; // 10 underscores
const FULL_EDIT_SECTIONS = BASE_PAGES.slice(); // all non-Full pages

// Global break-line parser
// Used by both the legacy full-text parser and the newer Full-page block editor.
// A "break" is either the raw BREAK_LINE, a single underscore "_", or underscore(s)
// followed by a title (ex: "________VERSE 1" or "_VERSE 1").
function _parseBreakLine(line){
  const t = String(line || "").trim();
  if(!t) return null;
  if(t === BREAK_LINE) return { title: "" };
  if(t === "_") return { title: "" };
  if(t[0] === "_"){
    const m = t.match(/^_{1,}\s*(.+)$/);
    if(m){
      const title = String(m[1] || "").trim();
      return { title };
    }
  }
  return null;
}

// match headings like "VERSE 1" or "VERSE 1:" (case-insensitive)
function normalizeLineBreaks(s){
  return String(s || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isSectionHeadingLine(line){
  // Accept: VERSE 4, [Verse 4], (Verse4), "Verse 4:" etc.
  let t = String(line || "").trim();
  if(!t) return null;
  t = t.replace(/:$/, "");
  t = t.replace(/^[\[\(\{]+\s*/, "").replace(/\s*[\]\)\}]+$/, "");
  t = t.toUpperCase().replace(/\s+/g," ").trim();
  t = t.replace(/^(VERSE|CHORUS)\s*(\d+)$/, "$1 $2");

  // 1) direct match on known section keys
  if(FULL_EDIT_SECTIONS.includes(t)) return t;

  // 2) allow custom titles (EXTRA pages) to act as headings in Full page
  //    If the line matches a stored custom title, map it back to the real section key.
  try{
    const titles = state?.project?.sectionTitles;
    if(titles && typeof titles === "object"){
      for(const k of Object.keys(titles)){
        const v = String(titles[k] || "").trim();
        if(!v) continue;
        const vNorm = v.toUpperCase().replace(/\s+/g," ").trim();
        if(vNorm === t){
          const key = String(k || "").toUpperCase().replace(/\s+/g," ").trim();
          return FULL_EDIT_SECTIONS.includes(key) ? key : null;
        }
      }
    }
  }catch{}

  
  // 3) headings that are NOT base pages (VERSE 4+, CHORUS 4+, OUTRO) -> auto EXTRA page
  const mVC = t.match(/^(VERSE|CHORUS)\s+(\d+)$/);
  if(mVC){
    const n = parseInt(mVC[2],10);
    if(n >= 4){
      const extra = getOrCreateExtraSectionForTitle(`${mVC[1]} ${n}`);
      if(extra) return extra;
    }
  }
  if(t === "OUTRO"){
    const extra = getOrCreateExtraSectionForTitle("OUTRO");
    if(extra) return extra;
  }
return null;
}

// Parse fullText -> { sections: { "VERSE 1":[{lyrics,chords?}...], ... } }
// ✅ chord-aware:
//   - supports "chords line above lyric line" blocks
//   - supports inline chords like: [G]Amazing [D]Grace  OR  (G)Amazing (D)Grace
//   - supports simple chord-only lines like: G   D/F#   Em7
function parseFullTextToSectionCards(fullText){
  const text = normalizeLineBreaks(fullText);
  const lines = text.split("\n");

  // Decide mode:
  // - If we see break lines, we parse by breaks -> PAGE 1..10 (+extras)
  // - Otherwise, we parse by headings (INTRO/VERSE/CHORUS/BRIDGE/OUTRO/INTERLUDE/etc.) into pages sequentially
  const hasBreaks = lines.some(l => !!_parseBreakLine(l));


  const buckets = {};
  const titles = {};

  // Ensure base buckets exist
  FULL_EDIT_SECTIONS.forEach(s => buckets[s] = []);

  function ensureBucket(sec){
    if(!sec) return;
    if(!buckets[sec]) buckets[sec] = [];
  }

  const CHORD_TOKEN_RE = /^([A-G](?:#|b)?)(?:(?:maj|min|m|dim|aug|\+|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:maj7|M7|m7|m9|m11|m13|sus2|sus4|add9|add11|add13|dim7|hdim7|m7b5)?(?:b5|#5|b9|#9|b11|#11|b13|#13)?)?(?:\/[A-G](?:#|b)?)?$|^N\.?C\.?$/i;

  function isChordToken(tok){
    let t = String(tok || "").trim();
    if(!t) return false;
    t = t.replace(/^[\[\(\{]+/,"").replace(/[\]\)\}]+$/,"").trim();
    t = t.replace(/♯/g,"#").replace(/♭/g,"b");
    t = t.replace(/[\.,;:]+$/,"").trim();
    t = t.replace(/\s+/g,"");
    return CHORD_TOKEN_RE.test(t);
  }

  // ✅ Positional chord tokens:
  // A leading digit 1-8 sets the target chord box, e.g. "1Am 5Dm" -> slot0=Am, slot4=Dm
  // IMPORTANT: chord-internal numbers like "E7" are NOT positions (no leading digit).
  function parsePositionalChordToken(tok){
    let t = String(tok || "").trim();
    if(!t) return null;

    // strip surrounding bracket wrappers, keep inner
    t = t.replace(/^[\[\(\{]+/,"").replace(/[\]\)\}]+$/,"").trim();
    t = t.replace(/♯/g,"#").replace(/♭/g,"b");
    t = t.replace(/[\.,;:]+$/,"").trim();
    t = t.replace(/\s+/g,"");

    const m = t.match(/^([1-8])(.+)$/);
    if(!m) return null;
    const slot = clamp(parseInt(m[1],10) - 1, 0, 7);
    const chord = String(m[2] || "").trim();

    // chord part must be a valid chord token
    if(!isChordToken(chord)) return null;
    return { slot, chord };
  }

  function isChordishToken(tok){
    return isChordToken(tok) || !!parsePositionalChordToken(tok);
  }

  function extractInlineChords(line){
    const chords = [];
    let cleaned = String(line || "");
    cleaned = cleaned.replace(/[\[\(\{]\s*([^\]\)\}]+?)\s*[\]\)\}]/g, (m, inner) => {
      const tok = String(inner || "").trim()
        .replace(/[|]+/g,"")
        .replace(/[\.,;:]+$/,"")
        .trim()
        .replace(/\s+/g,"")
        .replace(/♯/g,"#").replace(/♭/g,"b");
      if(isChordToken(tok)) chords.push(tok);
      return " ";
    });
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return { cleaned, chords };
  }

    function lineIsMostlyChords(line){
    const raw = String(line || "").replace(/\u00A0/g," ").trim();
    if(!raw) return false;

    // Split on whitespace / bars / commas to catch common chord charts like:
    // "Am | G | F"  or  "Am, G, F"  or  "Am    G    F"
    const toks0 = raw.split(/[\s|,]+/).map(s=>s.trim()).filter(Boolean);
    if(!toks0.length) return false;

    const normTok = (t) => String(t || "")
      .trim()
      .replace(/^[\[\(\{]+/,"").replace(/[\]\)\}]+$/,"")
      .replace(/^[^A-Za-z0-9#b\/\.]+/,"")
      .replace(/[^A-Za-z0-9#b\/\.]+$/,"")
      .replace(/[\.,;:]+$/,"")
      .replace(/♯/g,"#").replace(/♭/g,"b")
      .trim()
      .replace(/\s+/g,"");

    let chordCount = 0;
    let otherCount = 0;

    for(const t0 of toks0){
      const t = normTok(t0);
      if(!t) continue;

      // ignore common repeat markers
      const up = t.toUpperCase();
      if(up === "REPEAT" || up === "REP" || up === "RPT") continue;
      if(/^\(?X?\d+\)?$/.test(up)) continue;        // (2)  x2  4  etc
      if(/^\d+X$/.test(up)) continue;                // 2X, 4X

      if(isChordishToken(t)) chordCount++; else otherCount++;
    }

    const total = chordCount + otherCount;
    if(chordCount === 0) return false;
    if(total === 1) return chordCount === 1;

    // chord lines should be overwhelmingly chord tokens.
    // allow 1 small "extra" token like "(x2)" or a stray symbol.
    if(chordCount >= 2 && otherCount <= 1) return true;

    // be a little forgiving for messy copy/paste (still mostly chords)
    if(chordCount >= 3 && (chordCount / total) >= 0.65 && otherCount <= 2) return true;

    return false;
  }

    
  function buildSlotsFromAlignedChordLine(chordLineRaw, lyricLineRaw){
    const chordLine = String(chordLineRaw || "").replace(/\u00A0/g," ").replace(/\t/g," ");
    const lyricLine = String(lyricLineRaw || "");
    const slots = Array(8).fill("");

    const toks = [];
    let i = 0;
    while(i < chordLine.length){
      while(i < chordLine.length && chordLine[i] === " ") i++;
      if(i >= chordLine.length) break;
      const start = i;
      while(i < chordLine.length && chordLine[i] !== " ") i++;
      let tok = chordLine.slice(start, i).trim();
      tok = tok
        .replace(/^[^A-Za-z0-9#b\/\.]+/,"")
        .replace(/[^A-Za-z0-9#b\/\.]+$/,"")
        .replace(/[|]+/g,"")
        .replace(/[\.,;:]+$/,"")
        .trim()
        .replace(/\s+/g,"")
        .replace(/♯/g,"#").replace(/♭/g,"b");
      const pos = parsePositionalChordToken(tok);
      if(pos){
        const s = pos.slot;
        const chord = pos.chord;
        if(!slots[s]) slots[s] = chord;
        else slots[s] = (slots[s] + " " + chord).trim();
      }else if(isChordToken(tok)){
        toks.push({ tok, col: start });
      }
    }
    if(!toks.length) return slots;

    let looksCollapsed = !/  +/.test(chordLine) && toks.length >= 2;

    const denom = Math.max(1, chordLine.length - 1);
    const n = toks.length;

    let wordStarts = [];
    if(looksCollapsed){
      const reWord = /\S+/g;
      let m;
      while((m = reWord.exec(String(lyricLine || "")))){
        wordStarts.push(m.index);
      }
      if(!wordStarts.length) looksCollapsed = false;
    }

    toks.forEach((item, idx) => {
      let slot;
      if(looksCollapsed){
        const wIdx = (n === 1) ? 0 : Math.round(idx * (wordStarts.length - 1) / (n - 1));
        const col = wordStarts[clamp(wIdx, 0, wordStarts.length - 1)] || 0;
        const denomL = Math.max(1, lyricLine.length - 1);
        slot = clamp(Math.round((col / denomL) * 7), 0, 7);
      }else{
        slot = n > 8
          ? clamp(Math.floor(idx * 8 / n), 0, 7)
          : clamp(Math.round((item.col / denom) * 7), 0, 7);
      }
      if(!slots[slot]) slots[slot] = item.tok;
      else slots[slot] = (slots[slot] + " " + item.tok).trim();
    });

    return slots;
  }

  function pushCard(sec, lyricsRaw, slots){
    const lyrics = String(lyricsRaw || "").replace(/\s+/g," ").trim();
    if(!lyrics && (!slots || !slots.some(x=>String(x||"").trim()))) return;

    const chords = Array.isArray(slots) ? slots.slice(0,8) : Array(8).fill("");
    while(chords.length < 8) chords.push("");

    ensureBucket(sec);
    buckets[sec].push({ lyrics, chords });
  }

  // Recognize common headings in pasted/uploaded text
  function headingTitleFromLine(line){
    let raw = String(line || "").trim();
    if(!raw) return null;

    raw = raw.replace(/^[\[\(\{]+/,"").replace(/[\]\)\}]+$/,"").trim();
    raw = raw.replace(/(?:\b[A-Za-z]\s){2,}[A-Za-z]\b/g, (m)=>m.replace(/\s+/g,""));
    raw = raw.replace(/\s*:\s*$/,"").trim();

    const t = raw.toUpperCase()
      .replace(/[^\w\s\/-]+/g," ")
      .replace(/\s+/g," ")
      .trim();

    // Basic buckets we care about:
    // INTRO, VERSE 1/2/3..., CHORUS 1/2/3..., BRIDGE, OUTRO, INTERLUDE, PRE-CHORUS, TAG
    const mVC = t.match(/^(VERSE|CHORUS)\s*([0-9]+)?$/);
    if(mVC){
      const num = mVC[2] ? String(mVC[2]) : "";
      return num ? `${mVC[1]} ${num}` : mVC[1];
    }
    if(t === "INTRO" || t === "INTRODUCTION") return "INTRO";
    if(t === "BRIDGE") return "BRIDGE";
    if(t === "OUTRO" || t === "CODA") return "OUTRO";
    if(t === "INTERLUDE") return "INTERLUDE";
    if(t === "PRECHORUS" || t === "PRE-CHORUS" || t === "PRE CHORUS") return "PRE-CHORUS";
    if(t === "TAG") return "TAG";
    return null;
  }

  // Allocate a section in order (PAGE 1..PAGE 10 then extras)
  // opts.enable:
  //   - true  => make the created EXTRA visible immediately (enabledSections)
  //   - false => create the EXTRA but keep it hidden until it has content or user adds via +
  let nextPageIdx = 0;
  function allocateNextSection(optionalTitle, opts={}){
    ensurePageMeta();

    // base first
    const base = FULL_EDIT_SECTIONS;
    if(nextPageIdx < base.length){
      const sec = base[nextPageIdx++];
      if(optionalTitle) titles[sec] = String(optionalTitle || "").trim();
      return sec;
    }

    // extras
    // If we have a title (e.g., OUTRO / VERSE 4) we assume the user intended this page.
    // Otherwise (no title) keep it hidden unless explicitly requested.
    const enable = (typeof opts.enable === "boolean") ? opts.enable : !!String(optionalTitle||"").trim();
    const sec = createExtraSection({ enable });
    if(optionalTitle && sec){
      titles[sec] = String(optionalTitle || "").trim();
    }
    return sec || base[base.length - 1];
  }

  // Mode state
  let cur = hasBreaks ? FULL_EDIT_SECTIONS[0] : allocateNextSection(null);
  ensureBucket(cur);

  let pendingChordLine = null;

  function maybeConsumeTitleLine(i){
    // After a break line, the very next non-empty line can be treated as the page title
    let k = i;
    while(k < lines.length && String(lines[k] || "").trim() === "") k++;
    if(k >= lines.length) return { nextIndex: k, title: "" };

    const cand = String(lines[k] || "").trim();
    if(!cand) return { nextIndex: k, title: "" };
    if(_parseBreakLine(cand)) return { nextIndex: k, title: "" };
    if(lineIsMostlyChords(cand)) return { nextIndex: k, title: "" };

    // If it looks like a heading, we still allow it to be a title line (this is what the user wants)
    return { nextIndex: k + 1, title: cand };
  }

  if(hasBreaks){
    // Walk through break sections in order
    let pageIdx = -1;

    for(let i=0; i<lines.length; i++){
      const line = String(lines[i] ?? "");

      const _br = _parseBreakLine(line);
      if(_br){
        // flush any dangling chord line
        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
        }
        pendingChordLine = null;

         pageIdx++;
         // A break line is an explicit "new page" action.
         cur = (pageIdx < FULL_EDIT_SECTIONS.length)
           ? FULL_EDIT_SECTIONS[pageIdx]
           : allocateNextSection(null, { enable:true });
        ensureBucket(cur);

        // ✅ Title can be inline on the same break line: ________Verse 1
        if(_br && _br.title){
          titles[cur] = _br.title;
          continue;
        }
        // Back-compat: title on the NEXT non-empty line
        const info = maybeConsumeTitleLine(i+1);
        if(info.title) titles[cur] = info.title;
        i = info.nextIndex - 1;
        continue;
      }

      if(line.trim() === ""){
        // allow chord-line + lyric-line pairing across blanks
        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          let k = i + 1;
          while(k < lines.length && String(lines[k] || "").trim() === "") k++;
          const nxt = k < lines.length ? String(lines[k] || "") : "";
          if(nxt && !_parseBreakLine(nxt) && !lineIsMostlyChords(nxt)){
            continue;
          }
        }

        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
        }
        pendingChordLine = null;
        continue;
      }

      if(lineIsMostlyChords(line)){
        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
        }
        pendingChordLine = line;
        continue;
      }

      const { cleaned, chords: inlineChords } = extractInlineChords(line);

      let slots = Array(8).fill("");
      if(pendingChordLine){
        slots = buildSlotsFromAlignedChordLine(pendingChordLine, cleaned);
        pendingChordLine = null;
      }else if(inlineChords.length){
        const n = inlineChords.length;
        for(let k=0;k<n;k++){
          const slot = clamp(Math.floor((k / Math.max(1,n-1)) * 7), 0, 7);
          if(!slots[slot]) slots[slot] = inlineChords[k];
          else slots[slot] = (slots[slot] + " " + inlineChords[k]).trim();
        }
      }

      pushCard(cur, cleaned, slots);
    }

    if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
      pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
    }
  }else{
    // Heading-driven parsing
    // NOTE: "cur" is already initialized above for no-break mode.
    // Do NOT allocate again, or we'll consume an extra page and can accidentally
    // create a trailing blank page later.
    ensureBucket(cur);

    for(let i=0; i<lines.length; i++){
      const line = String(lines[i] ?? "");

      const heading = headingTitleFromLine(line);
      if(heading){
        // flush any dangling chord line
        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
        }
        pendingChordLine = null;

         cur = allocateNextSection(heading, { enable:true });
        ensureBucket(cur);
        continue;
      }

      if(line.trim() === ""){
        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          let k = i + 1;
          while(k < lines.length && String(lines[k] || "").trim() === "") k++;
          const nxt = k < lines.length ? String(lines[k] || "") : "";
          const nxtHeading = headingTitleFromLine(nxt);
          if(nxt && !nxtHeading && !lineIsMostlyChords(nxt)){
            continue;
          }
        }

        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
        }
        pendingChordLine = null;
        continue;
      }

      if(lineIsMostlyChords(line)){
        if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
          pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
        }
        pendingChordLine = line;
        continue;
      }

      const { cleaned, chords: inlineChords } = extractInlineChords(line);

      let slots = Array(8).fill("");
      if(pendingChordLine){
        slots = buildSlotsFromAlignedChordLine(pendingChordLine, cleaned);
        pendingChordLine = null;
      }else if(inlineChords.length){
        const n = inlineChords.length;
        for(let k=0;k<n;k++){
          const slot = clamp(Math.floor((k / Math.max(1,n-1)) * 7), 0, 7);
          if(!slots[slot]) slots[slot] = inlineChords[k];
          else slots[slot] = (slots[slot] + " " + inlineChords[k]).trim();
        }
      }

      pushCard(cur, cleaned, slots);
    }

    if(pendingChordLine && lineIsMostlyChords(pendingChordLine)){
      pushCard(cur, "", buildSlotsFromAlignedChordLine(pendingChordLine, ""));
    }
  }

  buckets.__titles = titles;
  return buckets;
}
function reconcileDeletedBaseSections(){
  if(!state.project) return;
  ensurePageMeta();
  const del = state.project.deletedBaseSections || [];
  if(!del.length) return;
  state.project.deletedBaseSections = del.filter(sec => !sectionHasAnyContent(sec));
}

// Back-compat alias: older code calls cleanupDeletedBaseSections()
function cleanupDeletedBaseSections(){
  try{ reconcileDeletedBaseSections(); }catch{}
}

function applyFullTextToProjectSections(fullText){
  if(!state.project || !state.project.sections) return;

  const parsed = parseFullTextToSectionCards(fullText);

  // pull @@TITLE metadata (optional)
  if(parsed && parsed.__titles){
    if(!state.project.sectionTitles || typeof state.project.sectionTitles !== "object") state.project.sectionTitles = {};
    for(const k of Object.keys(parsed.__titles || {})){
      state.project.sectionTitles[k] = String(parsed.__titles[k] || "").trim();
    }
  }

  const secsToApply = [...FULL_EDIT_SECTIONS, ...((state.project.extraSections)||[])];
  secsToApply.forEach(sec => {
    const want = parsed[sec] || [];
    const have = Array.isArray(state.project.sections[sec]) ? state.project.sections[sec] : [];

    const next = [];

    for(let i=0; i<want.length; i++){
      const base = have[i] && typeof have[i] === "object" ? have[i] : newLine();

      const w = want[i] || {};
      base.lyrics = String(w.lyrics || "");

      if(Array.isArray(w.chords) && w.chords.length){
        if(!Array.isArray(base.notes)) base.notes = Array(8).fill("");
        for(let k=0;k<8;k++){
          const c = String(w.chords[k] || "").trim();
          base.notes[k] = c || (base.notes[k] || "");
        }
      }

      if(state.autoSplit){
        base.beats = autosplitBeatsFromLyrics(base.lyrics);
      }

      next.push(base);
    }

    for(let i=want.length; i<have.length; i++){
      const L = have[i];
      if(lineHasContent(L)){
        next.push(L);
      }
    }

    if(next.length < MIN_LINES_PER_SECTION) next.push(newLine());
    while(next.length > 1 && !lineHasContent(next[next.length - 1])) next.pop();

    state.project.sections[sec] = next;
  });
  reconcileDeletedBaseSections();
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
  sections,
  enabledSections: ["PAGE 1"],
  sectionTitles: {},
  extraSections: [],
  deletedBaseSections: [],
  notesDoc: ""
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

// Some newer UI paths call this helper.
// Keep it simple and reliable: persist the current project snapshot.
function saveCurrentProject(){
  try{
    if(state && state.project) upsertProject(state.project);
  }catch(err){
    console.error(err);
  }
}

function deleteProjectById(id){
  const all = loadAllProjects().filter(p => p.id !== id);
  saveAllProjects(all);
  localStorage.removeItem(LS_CUR);
}

function normalizeProject(p){
  if(!p || typeof p !== "object") return null;

  if(typeof p.fullText !== "string") p.fullText = "";
  if(typeof p.notesDoc !== "string") p.notesDoc = "";
  if(typeof p.notesColor !== "string" || !p.notesColor) p.notesColor = "#151515";
  if(typeof p.fullSeeded !== "boolean") p.fullSeeded = false; // ✅ NEW
  if(!p.sections || typeof p.sections !== "object") p.sections = {};
  // ✅ Pages-only model: enabledSections must be a subset of BASE_PAGES
  if(!Array.isArray(p.enabledSections)) p.enabledSections = [];
  if(!p.sectionTitles || typeof p.sectionTitles !== "object") p.sectionTitles = {};
  if(!Array.isArray(p.deletedBaseSections)) p.deletedBaseSections = [];
  if(!Array.isArray(p.extraSections)) p.extraSections = [];

  // --- Migration from old titled-sections (INTRO/VERSE/CHORUS/...) to PAGE 1..10
  // Any section keys that are not base pages get copied into the next available page
  // and the old section name becomes the page title.
  try{
    const used = new Set(Object.keys(p.sections||{}));
    const avail = [
      ...BASE_PAGES.filter(pg => !used.has(pg))
    ];
    const keys = Object.keys(p.sections||{}).filter(k => k && k !== "Full" && !BASE_PAGES.includes(k));
    for(const oldKey of keys){
      const pg = avail.shift() || null;
      if(!pg) break;
      // move cards
      p.sections[pg] = Array.isArray(p.sections[oldKey]) ? p.sections[oldKey] : [];
      delete p.sections[oldKey];
      // keep a readable title
      if(!p.sectionTitles[pg]) p.sectionTitles[pg] = String(oldKey);
    }

    // migrate enabledSections too
    const migratedEnabled = [];
    for(const s of (Array.isArray(p.enabledSections) ? p.enabledSections : [])){
      if(BASE_PAGES.includes(s)) migratedEnabled.push(s);
      else{
        // try to find a page whose title matches the old section
        const match = BASE_PAGES.find(pg => String(p.sectionTitles?.[pg]||"") === String(s));
        if(match) migratedEnabled.push(match);
      }
    }
    p.enabledSections = migratedEnabled;
  }catch{}

  // sanitize enabledSections to valid pages (base + extras)
  {
    const allowed = new Set([...(BASE_PAGES||[]), ...((Array.isArray(p.extraSections)?p.extraSections:[]))]);
    p.enabledSections = (Array.isArray(p.enabledSections) ? p.enabledSections : []).filter(s => allowed.has(s));
  }

  // Always have at least PAGE 1 enabled
  if(p.enabledSections.length === 0) p.enabledSections = [BASE_PAGES[0]];
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

  // ✅ Full Song View (BSP-style) AutoScroll state
  fullPerfMode: false,          // when true, Full view renders performance layout
  fullPerfItems: [],            // [{rowEl, boxes:[el0..el3]}]
  fullPerfLineIndex: 0,
  fullPerfLastBeat4: -1,
  fullPerfLastEls: [],
  fullPerfProgramScrollUntil: 0,
  fullPerfUserScrollUntil: 0,
  fullPerfInitPending: false,
  fullPerfClockStartMs: 0,
  fullPerfBeatMs: 0,
  fullPerfFirstBeat: false,
  
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



  // AutoScroll can re-base the *visual* beat without restarting playback
  autoScrollTickOffset: 0,
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
  notesOpen: false,
  notesLastRange: null,
  notesHistory: [],
  notesHistoryIndex: -1,
  notesApplyingHistory: false,
  notesDefaultColor: "#151515",
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
  // ✅ In "step" mode, 1.0 = 1 WHOLE STEP = 2 semitones (like a guitarist thinking in steps),
  // so .5 = 1 semitone. In "capo" mode, the number is already semitones.
  if(state.transposeMode === "step") return Math.round(roundToHalf(state.steps) * 2);
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
  // Run horse when ANY time-based playback is happening:
  // drums, instrument, mp3 sync, OR autoscroll-only
  return !!(state.autoScrollOn || state.drumsOn || state.instrumentOn || state.audioSyncOn);
}

function triggerHorseRun(){
  if(!horseShouldRun()) return;

  const parked = document.getElementById("horseParked");
  if(parked) parked.style.visibility = "hidden";

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
    try{
      elm.classList.remove("tick");
      elm.classList.remove("tickFlash");
    }catch{}
  });
  state.lastTickEls = [];
  if(state._tickFlashTimers){
    state._tickFlashTimers.forEach(t => { try{ clearTimeout(t); }catch{} });
  }
  state._tickFlashTimers = [];
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

function uiTick8(){
  // When AutoScroll is turned ON mid-playback, we want the UI to start at beat 1
  // without touching the underlying playback clock.
  if(state.autoScrollOn){
    const off = Number(state.autoScrollTickOffset) || 0;
    return state.tick8 - off;
  }
  return state.tick8;
}

function applyTick(){
  if(!el.sheetBody) return;
  if(!shouldTickRun()) return;

  // ✅ Full Song View BSP-style highlight
  if(state.currentSection === "Full"){
    try{ applyFullPerfTick(); }catch(e){ console.error(e); }
    return;
  }

  const t8 = uiTick8();
  const nIdx = ((t8 % 8) + 8) % 8;
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

  // Flash helper (Beat Sheet Pro style: yellow pop inside the box)
  function pulse(elm){
    try{
      // re-trigger the CSS animation every tick
      elm.classList.remove("tickFlash");
      // force reflow so the animation restarts
      void elm.offsetWidth;
      elm.classList.add("tickFlash");

      const timers = state._tickFlashTimers || (state._tickFlashTimers = []);
      timers.push(setTimeout(() => {
        try{ elm.classList.remove("tickFlash"); }catch{}
      }, 140));
    }catch{}
  }

  for(const card of cards){
    const notes = card.querySelectorAll(".noteCell");
    const beats = card.querySelectorAll(".beatCell");

    if(notes && notes[nIdx]){
      notes[nIdx].classList.add("tick");
      pulse(notes[nIdx]);
      touched.push(notes[nIdx]);
    }
    if(beats && beats[bIdx]){
      beats[bIdx].classList.add("tick");
      pulse(beats[bIdx]);
      touched.push(beats[bIdx]);
    }
  }

  state.lastTickEls = touched;
}

// ===============================
// Full Song View (BSP-style) AutoScroll + highlight
// - Renders 4 quadrant boxes per lyric line (manual “/” overrides AutoSplit)
// - Highlights & flashes the active quadrant on each beat
// - Advances to next line every 4 beats and scrolls it into view
// ===============================
function clearFullPerfTick(){
  (state.fullPerfLastEls || []).forEach(elm => {
    try{ elm.classList.remove("tick","tickFlash","fullPerfActive"); }catch{}
  });
  state.fullPerfLastEls = [];
}

// Dedicated animation-frame driver for Full Song View performance mode.
// Guarantees highlight + autoscroll even when the main beat clock isn't running
// (e.g. MP3 sync loaded/paused, or silent practice with AutoScroll only).
function startFullPerfDriver(){
  try{
    if(state._fullPerfRaf) return;
    const step = () => {
      state._fullPerfRaf = requestAnimationFrame(step);
      if(!state.autoScrollOn || !state.fullPerfMode) return;
      try{ applyFullPerfTick(); }catch(e){ console.error(e); }
    };
    state._fullPerfRaf = requestAnimationFrame(step);
  }catch{}
}

function stopFullPerfDriver(){
  try{
    if(state._fullPerfRaf){
      cancelAnimationFrame(state._fullPerfRaf);
      state._fullPerfRaf = null;
    }
  }catch{}
}

function getFullPerfScrollHost(){
  // In SRP, the main scroll container is #sheetBody.
  // Full Perf should scroll in the same container (BSP-style),
  // so we can preserve position when toggling AutoScroll and
  // avoid landscape clipping issues.
  return el?.sheetBody || document.getElementById("sheetBody") || document.scrollingElement || document.documentElement;
}

function findFirstVisibleFullPerfLineIndex(){
  const host = getFullPerfScrollHost();
  const items = Array.isArray(state.fullPerfItems) ? state.fullPerfItems : [];
  if(!host || !items.length) return 0;

  // We want the line that is actually at the TOP of what the user can read.
  // If the very top row is partially clipped, start on the NEXT row (BSP feel).
  const hostRect = host.getBoundingClientRect();
  const viewTopScroll = host.scrollTop;
  const viewBottomScroll = viewTopScroll + (host.clientHeight || (hostRect.bottom - hostRect.top) || 0);

  const pad = 6; // small tolerance so we don't pick a barely-visible previous line

  const rowTopInHost = (rowEl) => {
    const r = rowEl.getBoundingClientRect();
    return (r.top - hostRect.top) + viewTopScroll;
  };

  for(let i=0;i<items.length;i++){
    const row = items[i]?.rowEl;
    if(!row) continue;

    const top = rowTopInHost(row);
    const h = row.offsetHeight || row.getBoundingClientRect().height || 0;
    const bottom = top + h;

    // completely above viewport
    if(bottom <= viewTopScroll + pad) continue;
    // completely below viewport
    if(top >= viewBottomScroll - pad) return i;

    // Row intersects the top edge (partially clipped) — start on the next row.
    if(top < viewTopScroll + pad && bottom > viewTopScroll + pad){
      return Math.min(i + 1, items.length - 1);
    }

    // First fully-visible (or nearly fully-visible) row.
    if(top >= viewTopScroll + pad){
      return i;
    }

    // Fallback: if we got here, it’s visible and not clipped.
    return i;
  }

  

  return 0;
}

function findStartFullPerfLineIndexFromViewport(){
  const host = getFullPerfScrollHost();
  const items = Array.isArray(state.fullPerfItems) ? state.fullPerfItems : [];
  if(!host || !items.length) return 0;

  // Use elementFromPoint inside the scroll host to pick the row the user is ACTUALLY seeing at the top.
  // This avoids "starting one line above" caused by tiny visible slivers / smooth-scroll jitter.
  const hr = host.getBoundingClientRect();

  // Pick a point a bit below the top of the visible area (and away from edges).
  // NOTE: host is below fixed headers; hr.top is already viewport-correct.
  const x = clamp(Math.round(hr.left + Math.min(40, (hr.width||1)/4)), 0, window.innerWidth - 1);
  const y = clamp(Math.round(hr.top  + 14), 0, window.innerHeight - 1);

  let el = document.elementFromPoint(x, y);
  if(el){
    // walk up to row
    while(el && el !== document.body){
      if(el.classList && el.classList.contains("fullPerfRow")) break;
      el = el.parentElement;
    }
    if(el && el.classList && el.classList.contains("fullPerfRow")){
      const idx = items.findIndex(it => it && it.rowEl === el);
      if(idx >= 0) return idx;
    }
  }

  // Fallback to rect-based scan
  return findFirstVisibleFullPerfLineIndex();
}

function scrollFullPerfRowIntoView(rowEl){
  const host = getFullPerfScrollHost();
  if(!host || !rowEl) return;

  try{
    const hr = host.getBoundingClientRect();
    const r  = rowEl.getBoundingClientRect();

    // Keep a safe margin so the highlighted text is never clipped
    // (especially in landscape).
    const marginTop = 80;
    const marginBot = 120;

    let delta = 0;
    if(r.top < hr.top + marginTop){
      delta = (r.top - (hr.top + marginTop));
    }else if(r.bottom > hr.bottom - marginBot){
      delta = (r.bottom - (hr.bottom - marginBot));
    }

    if(Math.abs(delta) > 2){
      state.fullPerfProgramScrollUntil = Date.now() + 650;
      host.scrollTo({ top: Math.max(0, host.scrollTop + delta), behavior: "smooth" });
    }
  }catch{
    try{ rowEl.scrollIntoView({ block:"center", behavior:"smooth" }); }catch{}
  }
}

function advanceFullPerfLine(){
  const items = Array.isArray(state.fullPerfItems) ? state.fullPerfItems : [];
  if(!items.length){ state.fullPerfLineIndex = 0; return; }
  state.fullPerfLineIndex = (Number(state.fullPerfLineIndex)||0) + 1;
  if(state.fullPerfLineIndex >= items.length) state.fullPerfLineIndex = 0;
}

function applyFullPerfTick(){
  if(!state.autoScrollOn) return;
  if(!state.fullPerfMode) return;
  if(state.fullPerfInitPending) return;

  const items = Array.isArray(state.fullPerfItems) ? state.fullPerfItems : [];
  if(!items.length) return;

  // ✅ BSP-style: use a dedicated time-based quarter-note clock in Full Perf mode.
  // This prevents quadrant skips if the UI tick timer lags/drops frames, and guarantees
  // AutoScroll always starts at beat 1 (quadrant 1) of the starting line.
  const bpm = clamp(Number(state.bpm)||95, 40, 260);
  const beatMs = Math.round((60 / bpm) * 1000);

  if(!state.fullPerfClockStartMs || state.fullPerfBeatMs !== beatMs){
    state.fullPerfClockStartMs = performance.now();
    state.fullPerfBeatMs = beatMs;
    state.fullPerfLastBeat4 = -1;
  }

  const elapsed = Math.max(0, performance.now() - state.fullPerfClockStartMs);
  const beat4 = Math.floor(elapsed / beatMs) % 4;

  const prevBeat4 = state.fullPerfLastBeat4;
  if(beat4 === prevBeat4) return;
  state.fullPerfLastBeat4 = beat4;

  // Initialize line index from current scroll position when turning on
  if(!Number.isFinite(state.fullPerfLineIndex) || state.fullPerfLineIndex < 0 || state.fullPerfLineIndex >= items.length){
    state.fullPerfLineIndex = findFirstVisibleFullPerfLineIndex();
  }

  // New line every 4 beats (when beat cycles back to 0)
  if(beat4 === 0 && prevBeat4 !== -1){
    // Only advance if we already highlighted something previously
    // (prevents skipping first line on engage)
    if(state.fullPerfLastEls && state.fullPerfLastEls.length){
      advanceFullPerfLine();
    }
  }

  const item = items[state.fullPerfLineIndex];
  if(!item || !item.boxes || item.boxes.length < 4) return;

  // Clear previous tick visuals
  clearFullPerfTick();

  const row = item.rowEl;
  const box = item.boxes[beat4];
  if(row) row.classList.add("fullPerfActive");
  if(box){
    box.classList.add("tick");

    // ✅ 16th-note style flash (4 pulses per beat)
    // We only have an 8th-note clock, so we simulate 16ths with a CSS animation
    // whose duration matches ONE quarter note.
    const beatSec = 60 / bpm;
    try{ box.style.setProperty("--beatSec", beatSec + "s"); }catch{}

    // restart flash
    box.classList.remove("tickFlash", "tickFlash16");
    void box.offsetWidth;
    box.classList.add("tickFlash16");

    try{
      clearTimeout(state._fullPerfFlashTimer);
      state._fullPerfFlashTimer = setTimeout(()=>{
        try{ box.classList.remove("tickFlash16"); }catch{}
      }, Math.round(beatSec*1000));
    }catch{}

    state.fullPerfLastEls = [box, row].filter(Boolean);
  }

  // Keep the active line visible
  if(beat4 === 0) scrollFullPerfRowIntoView(row);

  // After we render the very first visual beat, return to normal clock-driven beats.
  if(state.fullPerfFirstBeat) state.fullPerfFirstBeat = false;
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

/* =========================
   CHORD -> PITCH CLASSES (for key detection)
   - We used to detect key from chord ROOTS only, which biases toward Major
     (e.g. Am,Am,Am => A Maj).
   - This adds chord tones (3rd/5th/7th/etc) so minor keys resolve correctly.
========================= */
function cleanChordToken(tok){
  return String(tok||"")
    .trim()
    .replace(/^[\[\(\{]+/,"").replace(/[\]\)\}]+$/,"")
    .replace(/♯/g,"#").replace(/♭/g,"b")
    .replace(/[\.,;:]+$/,"")
    .replace(/\s+/g,"");
}

function chordQuality(main){
  // main = "Am7", "Cmaj7", "F#m7b5", "E7#9", "Gsus4", "A", etc.
  const s = String(main||"");
  const lower = s.toLowerCase();

  // priority: explicit maj/min words
  if(lower.includes("maj") || /(^|[^a-z])m7a?j/.test(lower)) return "maj";
  if(lower.includes("min")) return "min";

  // diminished / half-diminished
  if(lower.includes("dim") || lower.includes("o") || lower.includes("m7b5") || lower.includes("hdim")) return "dim";

  // augmented
  if(lower.includes("aug") || /(^|[^a-z])\+/.test(lower)) return "aug";

  // suspended
  if(lower.includes("sus2")) return "sus2";
  if(lower.includes("sus4") || lower.includes("sus")) return "sus4";

  // shorthand: "m" after root means minor, but avoid catching "maj" / "M"
  // Examples: Am, F#m7, Bm7b5
  if(/^[A-Ga-g](?:#|b)?m(?!a)/.test(s)) return "min";

  return "maj";
}

function chordTokenToPCs(tok){
  // returns array of {pc, w}
  const t = cleanChordToken(tok);
  if(!t) return [];

  // ignore N.C.
  if(/^n\.?c\.?$/i.test(t)) return [];

  const parts = t.split("/");
  const main = parts[0] || "";
  const bass = parts[1] || "";

  const rootPC = noteToPC(main);
  if(rootPC === null) return [];

  const q = chordQuality(main);

  // default triad intervals
  let third = 4; // maj 3rd
  let fifth = 7; // perfect 5th
  if(q === "min"){ third = 3; fifth = 7; }
  else if(q === "dim"){ third = 3; fifth = 6; }
  else if(q === "aug"){ third = 4; fifth = 8; }
  else if(q === "sus2"){ third = 2; fifth = 7; }
  else if(q === "sus4"){ third = 5; fifth = 7; }

  const out = [];
  const add = (pc, w)=> out.push({ pc: ((pc%12)+12)%12, w });

  // weights (root strongest, then 3rd, etc.)
  add(rootPC, 2.0);
  add(rootPC + third, 1.5);
  add(rootPC + fifth, 1.0);

  const lower = main.toLowerCase();

  // 6ths
  if(/(^|[^0-9])6([^0-9]|$)/.test(lower) && !lower.includes("16")){
    add(rootPC + 9, 0.8);
  }

  // 7ths
  if(lower.includes("maj7") || lower.includes("mmaj7") || lower.includes("m7maj") || lower.includes("m7+")){
    add(rootPC + 11, 1.0);
  }else if(/7/.test(lower)){
    add(rootPC + 10, 1.0);
  }

  // extensions (very light)
  if(/(^|[^0-9])9([^0-9]|$)/.test(lower)) add(rootPC + 14, 0.5);
  if(/11/.test(lower)) add(rootPC + 17, 0.4);
  if(/13/.test(lower)) add(rootPC + 21, 0.35);

  // alterations (override/add)
  if(lower.includes("b9")) add(rootPC + 13, 0.45);
  if(lower.includes("#9")) add(rootPC + 15, 0.45);
  if(lower.includes("b5")) add(rootPC + 6, 0.35);
  if(lower.includes("#5")) add(rootPC + 8, 0.35);
  if(lower.includes("b13")) add(rootPC + 20, 0.25);
  if(lower.includes("#11")) add(rootPC + 18, 0.25);

  // slash bass
  const bassPC = bass ? noteToPC(bass) : null;
  if(bassPC !== null) add(bassPC, 1.2);

  return out;
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

// Backwards-compat alias (older code calls transposeChordLabel)
function transposeChordLabel(label, semis){
  return transposeChordName(label, semis);
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

  // chord pitch-classes from parsed intervals (literal chord tones)
  let pcs = Array.from(new Set((ch.intervals || []).map(iv => (root + iv) % 12)));

  // ensure root is included
  if(!pcs.includes(root)) pcs.unshift(root);

  // sort pcs by distance above root (0..11)
  pcs.sort((a,b)=>(((a-root+12)%12) - ((b-root+12)%12)));

  // left-hand bass: honor slash chords, otherwise root
  const bassPC = (ch.bassPC !== null && ch.bassPC !== undefined) ? ch.bassPC : root;
  const bass = nearestMidiForPC(bassPC, 46); // a little lower so keyboard chords feel grounded

  // right-hand: keep things in a tighter, warmer keyboard range
  const mids = [];
  let target = 57; // around A3/B3 instead of C4 so chords do not jump too high

  for(const pc of pcs){
    let m = nearestMidiForPC(pc, target);

    // keep everything clearly above bass
    while(m <= bass + 4) m += 12;

    // keep ascending stack
    if(mids.length){
      while(m <= mids[mids.length - 1] + 1) m += 12;
    }

    // avoid piercing upper extensions on phone speakers
    while(m > 69) m -= 12; // keep RH stack at or below A4 when possible
    while(m <= bass + 4) m += 12;
    if(mids.length){
      while(m <= mids[mids.length - 1] + 1) m += 12;
      while(m > 72 && m - 12 > mids[mids.length - 1] + 1) m -= 12;
    }

    mids.push(m);
    target = m + 3;
  }

  // add a top root for fullness, but keep it restrained
  let top = nearestMidiForPC(root, (mids[mids.length - 1] || 60) + 5);
  while(top <= (mids[mids.length - 1] || 60) + 1) top += 12;
  while(top > 72) top -= 12;
  while(top <= bass + 5) top += 12;
  if(!mids.includes(top)) mids.push(top);

  // final sorted unique list
  const all = [bass, ...mids].sort((a,b)=>a-b);
  return Array.from(new Set(all));
}

function buildGuitarStrumVoicing(ch){
  const root = ch.rootPC;
  const ints = Array.isArray(ch.intervals) ? ch.intervals.slice() : [0,4,7];
  const bassPC = (ch.bassPC !== null && ch.bassPC !== undefined) ? ch.bassPC : root;

  const pickFrom = (cands, fallback) => {
    for(const iv of cands){
      if(ints.includes(iv)) return iv;
    }
    return fallback;
  };

  const thirdLike = pickFrom([4,3,5,2], 4);
  const fifthLike = pickFrom([7,6,8], 7);
  const seventhLike = pickFrom([10,11], null);
  const colorLike = pickFrom([14,9], null);

  const upperIntervals = [fifthLike, 0, thirdLike];
  if(seventhLike !== null) upperIntervals.push(seventhLike);
  upperIntervals.push(fifthLike, 0);
  if(colorLike !== null) upperIntervals.push(colorLike);

  const bass = nearestMidiForPC(bassPC, bassPC === root ? 41 : 43);
  const targets = [50, 55, 59, 62, 67, 71];

  const mids = [];
  for(let i=0;i<targets.length && i<upperIntervals.length;i++){
    const pc = (root + upperIntervals[i]) % 12;
    let m = nearestMidiForPC(pc, targets[i]);

    while(m <= bass + 4) m += 12;
    if(mids.length){
      while(m <= mids[mids.length - 1] + 1) m += 12;
    }
    while(m > 76) m -= 12;
    while(mids.length && m <= mids[mids.length - 1] + 1) m += 12;

    mids.push(m);
  }

  return Array.from(new Set([bass, ...mids])).sort((a,b)=>a-b);
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
  o.detune.value = 0;

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
body.gain.value = 0.8; // ✅ less mid boost (helps match electric)

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
  // Smooth electric piano with safe/stable pitch for rap/R&B vibe.
  // Built from the proven working app base to avoid freezing.
  const t0 = ctx.currentTime;
  const dur = Math.max(0.12, durMs/1000);
  const f0 = clamp(freq, 40, 2500);
  const v = clamp(vel, 0.2, 1.0);

  // Main tone
  const o1 = ctx.createOscillator();
  o1.type = "sine";
  o1.frequency.value = f0;

  // Tine/body harmonic
  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = f0 * 2;

  const g1 = ctx.createGain();
  const g2 = ctx.createGain();
  g1.gain.value = 0.80;
  g2.gain.value = 0.20;

  const mix = ctx.createGain();

  // Envelope
  const env = ctx.createGain();
  const peak = 0.048 * v;

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.010);
  env.gain.setValueAtTime(peak * 0.82, t0 + 0.080);

  const endTime = t0 + dur;
  env.gain.setValueAtTime(peak * 0.70, endTime);

  // keep "_" ties and "..." holds feeling smooth/long
  const tail = clamp(1.20 + dur * 0.75, 1.20, 5.00);
  env.gain.exponentialRampToValueAtTime(0.0001, endTime + tail);

  // Soft key attack
  const nLen = 0.010;
  const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * nLen));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){
    data[i] = (Math.random()*2 - 1) * (1 - i/data.length) * 0.22;
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buffer;

  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = Math.min(1800, f0 * 3.0);
  nf.Q.value = 0.8;

  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.010 * v, t0 + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + nLen);

  // Warm shaping
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 75;

  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 420;
  body.Q.value = 0.9;
  body.gain.value = 1.2;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  lp.Q.value = 0.7;

  // Gentle tremolo/chorus vibe without pitch drift
  const trem = ctx.createGain();
  trem.gain.value = 1.0;

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 4.0;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.06; // very subtle amplitude movement

  lfo.connect(lfoGain);
  lfoGain.connect(trem.gain);

  o1.connect(g1); g1.connect(mix);
  o2.connect(g2); g2.connect(mix);

  ns.connect(nf); nf.connect(ng); ng.connect(mix);

  mix.connect(hp);
  hp.connect(body);
  body.connect(lp);
  lp.connect(env);
  env.connect(trem);

  // Final output trim so the R&B piano is clearly louder without altering timing or pitch.
  const outTrim = ctx.createGain();
  outTrim.gain.value = 1.40; // +40%
  trem.connect(outTrim);

  o1.start(t0);
  o2.start(t0);
  ns.start(t0);
  lfo.start(t0);

  const stopAt = endTime + tail + 0.12;
  o1.stop(stopAt);
  o2.stop(stopAt);
  ns.stop(t0 + nLen + 0.01);
  lfo.stop(stopAt);

  scheduleCleanup([o1,o2,g1,g2,mix,ns,nf,ng,hp,body,lp,env,trem,outTrim,lfo,lfoGain], (durMs + tail*1000 + 1200));
  return { out: outTrim, nodes:[o1,o2,g1,g2,mix,ns,nf,ng,hp,body,lp,env,trem,outTrim,lfo,lfoGain] };
}
/***********************
MODERN POP KEYS NOTE (for Acoustic instrument)
Distinct from "Piano" instrument: cleaner, brighter, more polished pop keyboard tone.
***********************/
function grandPianoNote(ctx, freq, durMs, vel=0.9){
  // Modern pop keyboard tone for the first instrument:
  // brighter, punchier, and more synth-key-like than the smooth R&B piano.
  const t0 = ctx.currentTime;
  const dur = Math.max(0.10, durMs/1000);
  const f0 = clamp(freq, 55, 2500);
  const v  = clamp(vel, 0.2, 1.0);

  // Layer stack: pulse-ish body + octave glass + a little sub for weight
  const o1 = ctx.createOscillator();
  o1.type = "square";
  o1.frequency.value = f0;

  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = f0 * 2;

  const o3 = ctx.createOscillator();
  o3.type = "sine";
  o3.frequency.value = Math.max(40, f0 * 0.5);

  const g1 = ctx.createGain(); g1.gain.value = 0.42;
  const g2 = ctx.createGain(); g2.gain.value = 0.24;
  const g3 = ctx.createGain(); g3.gain.value = 0.26;
  const mix = ctx.createGain();

  // Punchier envelope than the smooth piano, but still supports ... and _
  const env = ctx.createGain();
  const peak = 0.074 * v;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  env.gain.setValueAtTime(peak * 0.86, t0 + 0.045);

  const endTime = t0 + dur;
  env.gain.setValueAtTime(peak * 0.70, endTime);
  const tail = clamp(0.72 + dur * 0.46, 0.82, 3.10);
  env.gain.exponentialRampToValueAtTime(0.0001, endTime + tail);

  // Brighter synth-key attack for pop definition
  const nLen = 0.007;
  const bs = Math.max(256, Math.floor(ctx.sampleRate * nLen));
  const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    data[i] = (Math.random()*2 - 1) * (1 - i/data.length) * 0.20;
  }
  const ns = ctx.createBufferSource();
  ns.buffer = buf;

  const clickBP = ctx.createBiquadFilter();
  clickBP.type = "bandpass";
  clickBP.frequency.value = Math.min(2600, f0 * 4.2);
  clickBP.Q.value = 1.0;

  const clickG = ctx.createGain();
  clickG.gain.setValueAtTime(0.0001, t0);
  clickG.gain.exponentialRampToValueAtTime(0.012 * v, t0 + 0.002);
  clickG.gain.exponentialRampToValueAtTime(0.0001, t0 + nLen);

  // Pop-key EQ / polish
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 105;

  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 320;
  body.Q.value = 0.9;
  body.gain.value = 1.7;

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2350;
  presence.Q.value = 0.8;
  presence.gain.value = 2.2;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6200;
  lp.Q.value = 0.7;

  // Width without making it sound like the R&B piano
  const chorus = ctx.createDelay();
  chorus.delayTime.value = 0.009;

  const chorusMix = ctx.createGain();
  chorusMix.gain.value = 0.22;

  const dry = ctx.createGain();
  dry.gain.value = 0.78;

  const lfo = ctx.createOscillator();
  lfo.type = "triangle";
  lfo.frequency.value = 1.15;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.0012;
  lfo.connect(lfoGain);
  lfoGain.connect(chorus.delayTime);

  const outTrim = ctx.createGain();
  outTrim.gain.value = 0.54;

  o1.connect(g1); g1.connect(mix);
  o2.connect(g2); g2.connect(mix);
  o3.connect(g3); g3.connect(mix);
  ns.connect(clickBP); clickBP.connect(clickG); clickG.connect(mix);

  mix.connect(hp);
  hp.connect(body);
  body.connect(env);
  env.connect(presence);

  presence.connect(dry);
  presence.connect(chorus);
  chorus.connect(chorusMix);

  dry.connect(lp);
  chorusMix.connect(lp);
  lp.connect(outTrim);

  o1.start(t0);
  o2.start(t0);
  o3.start(t0);
  ns.start(t0);
  lfo.start(t0);

  const stopAt = endTime + tail + 0.12;
  o1.stop(stopAt);
  o2.stop(stopAt);
  o3.stop(stopAt);
  ns.stop(t0 + nLen + 0.01);
  lfo.stop(stopAt);

  scheduleCleanup([o1,o2,o3,g1,g2,g3,mix,ns,clickBP,clickG,hp,body,env,presence,chorus,chorusMix,dry,lp,outTrim,lfo,lfoGain], (durMs + tail*1000 + 1200));
  return { out: outTrim, nodes:[o1,o2,o3,g1,g2,g3,mix,ns,clickBP,clickG,hp,body,env,presence,chorus,chorusMix,dry,lp,outTrim,lfo,lfoGain] };
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
  o1.detune.value = 0;

  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = clamp(freq, 70, 1600);
  o2.detune.value = 0;

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
outTrim.gain.value = 0.275;   // +25% vs prior 0.22
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
function getHumanizedMs(baseMs, spreadMs=6){
  const base = Number(baseMs) || 0;
  const spread = Math.max(0, Number(spreadMs) || 0);
  return Math.max(0, base + ((Math.random() * 2 - 1) * spread));
}

function getStrumOrder(len){
  const n = Math.max(0, len|0);
  const down = Array.from({length:n}, (_,i) => i);
  const up = Array.from({length:n}, (_,i) => n - 1 - i);
  const eighth = state.tick8 % 8;
  return (eighth % 2 === 0) ? down : up;
}

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

  const fracMul = Math.pow(2, (tr.fracSemis / 12));
  const ctx = ensureCtx();

  // Use the chord root (or slash-bass when present) for single-note plucks.
  // The old code grabbed an arbitrary interior voice from the full chord voicing,
  // which made chords like F sound wrong because the single note could be A/C
  // instead of the actual chord center.
  const singlePc = (ch.bassPC !== null && ch.bassPC !== undefined) ? ch.bassPC : ch.rootPC;
  const targetMidi = 57;
  const singleMidi = nearestMidiForPC(singlePc, targetMidi);
  const f = midiToFreq(singleMidi) * fracMul;

  if(state.instrument === "acoustic"){
    const n = grandPianoNote(ctx, f, durMs, 0.98);
    n.out.connect(getOutNode());
    scheduleCleanup([n.out], durMs + 5200);
  }else if(state.instrument === "electric"){
    const n = electricGuitarSafe(ctx, f, durMs, 0.90);
    n.out.connect(getOutNode());
    scheduleCleanup([n.out], durMs + 1600);
  }else{
    const n = pianoNote(ctx, f, durMs, 0.72);
    n.out.connect(getOutNode());
    scheduleCleanup([n.out], durMs + 6000);
  }
}

function playAcousticChord(ch, durMs, fracMul=1){
  const ctx = ensureCtx();
  const room = makeSoftRoom(ctx);

  const dryBus = ctx.createGain();
  dryBus.gain.value = 0.42;

  const wet = ctx.createGain();
  wet.gain.value = 0.08;

  dryBus.connect(getOutNode());
  dryBus.connect(room.in);
  room.wet.connect(wet);
  wet.connect(getOutNode());

  const midi = buildPianoVoicing(ch);
  const freqs = midi.map(midiToFreq).map(f => f * (fracMul || 1));

  const bpm = clamp(state.bpm||95, 40, 220);
  const rollMs = clamp(Math.round(9_000 / bpm), 4, 10);

  for(let i=0;i<freqs.length;i++){
    const f = freqs[i];
    const delayMs = getHumanizedMs(i * rollMs, 1);

    setTimeout(() => {
      if(!state.instrumentOn) return;
      const vel = clamp(0.91 - i*0.05 + ((Math.random()*2-1)*0.02), 0.58, 0.98);
      const n = grandPianoNote(ctx, f, durMs, vel);
      n.out.connect(dryBus);
      scheduleCleanup([n.out], durMs + 8000);
    }, Math.max(0, delayMs));
  }

  scheduleCleanup([dryBus,wet, ...room.nodes], durMs + 9000);
}

function playElectricChord(ch, durMs, fracMul=1){
  const ctx = ensureCtx();
  const token = state.audioToken;

  const room = makeSoftRoom(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.09;
  room.wet.connect(wet);
  wet.connect(getOutNode());

  const dryBus = ctx.createGain();
  dryBus.gain.value = 0.38;
  dryBus.connect(getOutNode());
  dryBus.connect(room.in);

  const midi = buildGuitarStrumVoicing(ch);
  const freqs = midi.map(midiToFreq).map(f => f * (fracMul || 1));
  const order = getStrumOrder(freqs.length);

  const bpm = clamp(state.bpm||95, 40, 220);
  const strumMs = clamp(Math.round(20_000 / bpm), 10, 24);

  order.forEach((srcIdx, i) => {
    const f = freqs[srcIdx];
    const delayMs = getHumanizedMs(i * strumMs, 3);

    setTimeout(() => {
      if(token !== state.audioToken) return;
      if(!state.instrumentOn) return;
      const vel = clamp(0.95 - i*0.07 + ((Math.random()*2-1)*0.03), 0.55, 0.98);
      const n = electricGuitarSafe(ctx, f, durMs, vel);
      n.out.connect(dryBus);
      scheduleCleanup([n.out], durMs + 1400);
    }, Math.max(0, delayMs));
  });

  scheduleCleanup([dryBus,wet, ...room.nodes], durMs + 2200);
}

function playPianoChord(ch, durMs, fracMul=1){
  const ctx = ensureCtx();
  const room = makeSoftRoom(ctx);

  const dryBus = ctx.createGain();
  dryBus.gain.value = 0.25;

  const wet = ctx.createGain();
  wet.gain.value = 0.065;

  dryBus.connect(getOutNode());
  dryBus.connect(room.in);
  room.wet.connect(wet);
  wet.connect(getOutNode());

  const midi = buildPianoVoicing(ch);
  const freqs = midi.map(midiToFreq).map(f => f * (fracMul || 1));

  const bpm = clamp(state.bpm||95, 40, 220);
  const rollMs = clamp(Math.round(8_000 / bpm), 4, 10);

  for(let i=0;i<freqs.length;i++){
    const f = freqs[i];
    const delayMs = getHumanizedMs(i * rollMs, 1);

    setTimeout(() => {
      const vel = clamp(0.93 - i*0.05 + ((Math.random()*2-1)*0.025), 0.58, 0.99);
      const n = pianoNote(ctx, f, durMs, vel);
      n.out.connect(dryBus);
      scheduleCleanup([n.out], durMs + 11_000);
    }, Math.max(0, delayMs));
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

  const fracMul = Math.pow(2, (tr.fracSemis / 12));

  if(state.instrument === "acoustic") playAcousticChord(ch, durMs, fracMul);
  else if(state.instrument === "electric") playElectricChord(ch, durMs, fracMul);
  else playPianoChord(ch, durMs, fracMul);
};


/***********************
Transpose display (now chord-aware)
***********************/
function refreshDisplayedNoteCells(){
  // chord-name transpose must be integer semis (round for display)
  const semis = Math.round(getTransposeSemis()) % 12;

  document.querySelectorAll(".noteCell").forEach(inp => {
    const raw = inp.dataset.raw || "";
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
  const root = el.sheetInner || el.sheetBody;
  return root ? Array.from(root.querySelectorAll(".card")) : [];
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

    // ✅ IMPORTANT: account for the sticky header inside sheetBody
    const stickyHeader = sb.querySelector(".sheetHeader");
    const stickyH = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;

    // how far the card is from the top of the scroll viewport
    const delta = (r.top - sbRect.top);

    // ✅ pad = sticky header height + a little breathing room
    const pad = Math.round(stickyH + 16);

    // target = current scrollTop + delta - pad
    const target = Math.max(0, Math.round(sb.scrollTop + delta - pad));

    const maxScroll = Math.max(0, sb.scrollHeight - sb.clientHeight);
    sb.scrollTop = Math.min(maxScroll, target);
    return;
  }

  // fallback (window scrolling)
  const yLine = getHeaderBottomY();
  const r2 = card.getBoundingClientRect();
  const cardTopDoc = r2.top + window.scrollY;
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

  const raw = cells[nIdx]?.dataset?.raw || getNoteRawFromCell(cells[nIdx]);

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

  // only on bar boundary (every 8 eighth-notes) — use visual tick so AutoScroll can re-base
  const t8 = uiTick8();
  if(t8 === 0) return;
  if(t8 % 8 !== 0) return;

  const bar = Math.floor(t8 / 8);
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
    clearTimeout(state.beatTimer);
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

  const runBeatTick = () => {
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
  };

  // fire immediately so the first note lands on tap, not one 8th-note late
  runBeatTick();

  const startedAt = performance.now();
  let beatCount = 1;
  const scheduleNext = () => {
    if(state.audioSyncOn) return;
    if(!shouldClockRun()) return;
    const target = startedAt + (beatCount * eighthMs);
    const delay = Math.max(0, target - performance.now());
    state.beatTimer = setTimeout(() => {
      runBeatTick();
      beatCount++;
      scheduleNext();
    }, delay);
  };
  scheduleNext();
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

function resetAutoScrollToFirstCardOfActivePage(){
  if(!state.autoScrollOn) return;
  if(state.currentSection === "Full") return;

  const cards = getCards();
  if(!cards.length) return;

  // ✅ User expectation: start at the FIRST card, even if it's blank.
  const idx = 0;

  state.playCardIndex = idx;
  state.lastAutoBar = -1; // restart bar-advance guard

  // ✅ Re-base AutoScroll's *visual* beat at the current playback tick (do NOT restart playback)
  state.autoScrollTickOffset = state.tick8;

  const tgt = cards[idx] || cards[0];
  if(tgt) scrollCardIntoView(tgt);

  clearTick();
  applyTick();
}
function stopDrums(){
  if(state.drumTimer){
    clearTimeout(state.drumTimer);
    state.drumTimer = null;
  }
  state.drumsOn = false;
 updateClock();
}

function startDrums(){
  stopDrums();
  state.drumsOn = true;
  updateClock();

  resetAutoScrollToFirstCardOfActivePage();

  const bpm = clamp(state.bpm || 95, 40, 220);
  const stepMs = Math.round((60000 / bpm) / 4);
  let step = 0;

  const runDrumStep = () => {
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
  };

  runDrumStep();

  const startedAt = performance.now();
  let stepCount = 1;
  const scheduleNext = () => {
    if(!state.drumsOn) return;
    const target = startedAt + (stepCount * stepMs);
    const delay = Math.max(0, target - performance.now());
    state.drumTimer = setTimeout(() => {
      runDrumStep();
      stepCount++;
      scheduleNext();
    }, delay);
  };
  scheduleNext();
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

  resetAutoScrollToFirstCardOfActivePage();
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
    // ✅ If user is on Full, stay on Full (BSP-style Full Song View autoscroll)
    if(state.currentSection === "Full"){
      // ✅ Preserve current scroll position so enabling AutoScroll doesn't jump to the top
      const prevScrollHost =
        getFullPerfScrollHost();
      const prevScrollTop = Number(prevScrollHost?.scrollTop) || 0;

      state.fullPerfMode = true;
      state.fullPerfInitPending = true;
      state.fullPerfLineIndex = NaN; // initialize from visible line AFTER render
      state.fullPerfLastBeat4 = -1;
      state.fullPerfClockStartMs = 0;
      state.fullPerfBeatMs = 0;
      clearFullPerfTick();

      // Re-render to performance layout so we can highlight boxes
      try{ renderSheet(); }catch{}

      // After DOM updates, restore scrollTop and lock start line to TOP-most visible row
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const host = getFullPerfScrollHost();
          if(host){
            host.scrollTop = prevScrollTop;
          }
          // Lock the start line strictly to what is visible at the top of the host right now.
          state.fullPerfUserScrollUntil = 0;
          state.fullPerfLockLineUntil = Date.now() + 650; // prevent scroll handler from overriding during engage
          state.fullPerfProgramScrollUntil = Date.now() + 900; // ignore restore/render scroll events
          state.fullPerfLineIndex = findStartFullPerfLineIndexFromViewport();
          state.fullPerfInitPending = false;
          clearFullPerfTick();

          // ✅ Always start at beat 1 (quadrant 1) of the starting line on engage.
          // This matches BSP: the first highlight on engage is the first quadrant,
          // not wherever the global clock happens to be.
          // ✅ Start Full-perf clock at Beat 1 / Quadrant 1 right now.
          state.fullPerfClockStartMs = performance.now();
          state.fullPerfBeatMs = Math.round((60 / clamp(Number(state.bpm)||95, 40, 260)) * 1000);
          state.fullPerfLastBeat4 = -1;
          state.fullPerfFirstBeat = false;
          // ✅ Ensure Full-view highlight + scroll runs even if the main beat clock is stopped
          // (e.g., MP3 sync is loaded/paused).
          startFullPerfDriver();
          try{ applyFullPerfTick(); }catch{}
        });
      });
    }else{
      state.fullPerfMode = false;
      stopFullPerfDriver();
    }

    // ✅ Do NOT restart playback. We only re-base the *visual* beat + scroll position.
    state.lastAutoBar = -1;
    state.playCardIndex = 0;

    // Re-base visual beat at the CURRENT playback position so UI starts at Beat 1 now
    state.autoScrollTickOffset = state.tick8;

    if(state.currentSection !== "Full") resetAutoScrollToFirstCardOfActivePage();

  }else{
    state.playCardIndex = null;
    state.autoScrollTickOffset = 0;

    // always stop Full perf driver when AutoScroll is OFF
    stopFullPerfDriver();

    // ✅ leaving Full performance mode
    if(state.currentSection === "Full"){
      state.fullPerfMode = false;
      state.fullPerfItems = [];
      state.fullPerfLineIndex = 0;
      state.fullPerfLastBeat4 = -1;
      state.fullPerfClockStartMs = 0;
      state.fullPerfBeatMs = 0;
      clearFullPerfTick();
      stopFullPerfDriver();
      try{ renderSheet(); }catch{}
    }

    // If MP3 sync is playing, stop the highlight immediately when AutoScroll OFF
    if(state.audioSyncOn){
      clearTick();
    }
  }

  // ✅ start/stop the beat clock based on AutoScroll
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

// ===============================
// Full Song View (BSP-match) helpers
// - In Full Song View performance mode we MUST behave like BSP:
//   • Treat paragraph blocks (separated by blank lines) as ONE "bar"
//   • From each bar, pick ONE lyric line (skip headings/chord-only)
//   • Prefer FIRST eligible line that contains "/" (manual split)
//   • Split into 4 beat boxes without splitting words (BSP algorithm)
// ===============================
function _fullPerf_isHeadingLine(line){
  const t = String(line||"").trim();
  if(!t) return false;
  const up = t.toUpperCase();
  return /^(INTRO|VERSE\s*\d+|CHORUS\s*\d+|BRIDGE|PRE\s*-?CHORUS|OUTRO|TAG|HOOK)$/.test(up);
}

function _fullPerf_isChordLine(line){
  const t = String(line||"").trim();
  if(!t) return true;
  if(/^[-_]{3,}$/.test(t)) return true;

  const cleaned = t.replace(/[\[\]\(\)\{\}]/g, "").trim();
  const toks = cleaned.split(/\s+/).filter(Boolean);
  if(!toks.length) return true;

  const chordRe = /^(\d+)?[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?$/i;
  let chordish = 0;
  for(const tok of toks){
    if(tok === "|" || tok === "/"){ chordish++; continue; }
    if(chordRe.test(tok)){ chordish++; continue; }
  }
  return chordish === toks.length;
}

function _fullPerf_pickLyricLineFromBar(barText){
  const lines = String(barText||"").replace(/\r/g, "").split("\n");
  let lastEligible = "";
  let firstEligibleWithSlash = "";

  for(let i=0;i<lines.length;i++){
    const t = String(lines[i]||"").trim();
    if(!t) continue;
    if(_fullPerf_isHeadingLine(t)) continue;
    if(_fullPerf_isChordLine(t)) continue;

    lastEligible = t;
    if(!firstEligibleWithSlash && t.includes("/")) firstEligibleWithSlash = t;
  }

  if(firstEligibleWithSlash) return firstEligibleWithSlash;
  if(lastEligible) return lastEligible;
  for(const raw of lines){
    const t = String(raw||"").trim();
    if(t) return t;
  }
  return "";
}

function _fullPerf_buildTargets(total){
  const base = Math.floor(total / 4);
  const rem = total % 4;
  return [0,1,2,3].map(i => base + (i < rem ? 1 : 0));
}

function _fullPerf_autoSplitSyllablesClean(text){
  const clean = String(text||"").replace(/[\/]/g, " ").trim();
  if(!clean) return ["","","",""];

  const words = clean.split(/\s+/).filter(Boolean);
  const sylls = words.map(w => Math.max(1, countSyllablesInline(w)));
  const total = sylls.reduce((a,b)=>a+b,0);
  if(!total) return ["","","",""];

  const targets = _fullPerf_buildTargets(total);
  const beats = [[],[],[],[]];
  const beatSyll = [0,0,0,0];
  let b = 0;

  for(let i=0;i<words.length;i++){
    const w = words[i];
    const s = sylls[i];

    while(b < 3 && beatSyll[b] >= targets[b]) b++;

    const wouldOvershoot = (beatSyll[b] + s) > targets[b];
    if(wouldOvershoot && beats[b].length > 0 && b < 3){
      b++;
    }

    beats[b].push(w);
    beatSyll[b] += s;
  }

  return beats.map(arr => arr.join(" ").trim());
}

function _fullPerf_computeBeats(text){
  const manual = manualBeatsFromSlashes(text);
  return manual ? manual : _fullPerf_autoSplitSyllablesClean(text);
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
  if(!state.project || !state.project.sections){
    if(el.keyOutput) el.keyOutput.value = "—";
    return;
  }

  const hist = Array(12).fill(0);
  let majVotes = 0;
  let minVotes = 0;

  SECTIONS.filter(s => s !== "Full").forEach(sec => {
    (state.project.sections[sec] || []).forEach(line => {
      (Array.isArray(line.notes) ? line.notes : []).forEach(tok => {
        const pcs = chordTokenToPCs(tok);
        if(!pcs.length) return;

        // vote quality (helps when progression is sparse, e.g. Am Am Am)
        const t = cleanChordToken(tok);
        const main = (t.split("/")[0] || "");
        const q = chordQuality(main);
        if(q === "min" || q === "dim") minVotes++;
        else if(q === "maj" || q === "aug" || q === "sus2" || q === "sus4") majVotes++;

        pcs.forEach(({pc,w}) => { hist[pc] += (w || 1); });
      });
    });
  });

  const total = hist.reduce((a,b)=>a+b,0);
  if(!total){
    if(el.keyOutput) el.keyOutput.value = "—";
    return;
  }

  // profile match (Krumhansl-style) using chord TONES (not just roots)
  const k = keyFromHistogram(hist);

  // If user mostly typed minor chords, prefer minor mode when the profile pick is close / ambiguous.
  // (Example: Am,Am,Am used to show A Maj.)
  let mode = k.mode;
  if(minVotes >= (majVotes + 2)) mode = "min";

  const semisInt = Math.round(getTransposeSemis()) % 12;   // ✅ key name must be integer semis
  const transposedPC = ((k.pc + semisInt) % 12 + 12) % 12; // ✅ always 0..11

  const modeLabel = (mode === "min") ? "min" : "Maj";
  el.keyOutput.value = `${PC_TO_NAME[transposedPC]} ${modeLabel}`;
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


// ✅ left-pad helper used by export alignment
function padTo(str, width){
  const s = String(str ?? "");
  const w = Math.max(0, Number(width) || 0);
  if(s.length >= w) return s;
  return s + " ".repeat(w - s.length);
}


function buildAlignedLine(line, semis=0){
  const notes = Array.isArray(line?.notes) ? line.notes : Array(8).fill("");
  const lyric = String(line?.lyrics ?? "").trim();

  // Use stored beats if present; otherwise auto-split from lyric
  let segs = Array.isArray(line?.beats) ? line.beats.slice(0,4) : [];
  if(!segs.some(s => String(s||"").trim())){
    segs = autosplitBeatsFromLyrics(lyric);
  }
  while(segs.length < 4) segs.push("");

  const n = Array.from({length:8}, (_,i)=>{
    const raw = String(notes[i] ?? "").trim();
    if(!raw) return "";
    // Keep chord spelling consistent with existing transpose functions
    return semis ? (typeof transposeChordName === "function" ? transposeChordName(raw, semis) : raw) : raw;
  });

  const chordGroups = [
    [n[0], n[1]].filter(Boolean).join(" "),
    [n[2], n[3]].filter(Boolean).join(" "),
    [n[4], n[5]].filter(Boolean).join(" "),
    [n[6], n[7]].filter(Boolean).join(" "),
  ];

  const widths = Array(4).fill(0).map((_,i)=>{
    return Math.max(String(segs[i] ?? "").length, String(chordGroups[i] ?? "").length, 1);
  });

  const notesLine  = chordGroups.map((g,i)=> padTo(g || "-", widths[i])).join(" | ");
  const lyricsLine = segs.map((s,i)=> padTo(String(s ?? ""), widths[i])).join(" | ");

  return { notesLine, lyricsLine, beatsLine: lyricsLine };
}

function buildChordSheetLines(noteRows, lyric){
  const L = String(lyric || "");
  const slots = Array.isArray(noteRows) ? noteRows.slice(0,8) : [];
  if(!L.trim() || !slots.some(x => String(x||"").trim())) return { chordLine: "", lyricLine: L };
  const len = Math.max(1, L.length);
  let arr = Array(len).fill(" ");
  for(let i=0;i<8;i++){
    const ch = String(slots[i]||"").trim();
    if(!ch) continue;
    const col = Math.max(0, Math.min(len-1, Math.round(i * (len-1) / 7)));
    for(let k=0;k<ch.length && col+k < len;k++){
      arr[col+k] = ch[k];
    }
  }
  return { chordLine: arr.join(""), lyricLine: L };
}

function buildFullPreviewText(){
  const out = [];
  let any = false;

  SECTIONS.filter(s => s !== "Full").forEach(sec => {
    const arr = state.project.sections[sec] || [];

    const hasAny = arr.some(line => {
      const lyr = String(line?.lyrics || "").trim();
      const notesRaw = Array.isArray(line?.notes) ? line.notes : [];
      const beats = Array.isArray(line?.beats) ? line.beats : [];
      const hasNotes = notesRaw.some(n => String(n||"").trim());
      const hasBeats = beats.some(b => String(b||"").trim());
      return !!lyr || hasNotes || hasBeats;
    });
    if(!hasAny) return;

    any = true;
        const ttl = (state.project.sectionTitles && state.project.sectionTitles[sec]) ? String(state.project.sectionTitles[sec] || "").trim() : "";
    out.push(ttl || sec.toUpperCase());
    out.push("");

    arr.forEach((line, idx) => {
      const lyr = String(line?.lyrics || "").trim();
      const notes = Array.isArray(line?.notes) ? line.notes : [];
      const beats = Array.isArray(line?.beats) ? line.beats : [];

      const hasNotes = notes.some(n => String(n||"").trim());
      const hasBeats = beats.some(b => String(b||"").trim());
      const hasLyrics = !!lyr;

      if(!hasNotes && !hasBeats && !hasLyrics) return;

      const semis = getTransposeSemis() || 0;
      const notesT = (line.notes || []).map(n => transposeChordLabel(n, semis));
      const { chordLine, lyricLine } = buildChordSheetLines(notesT, line.lyrics || "");
      out.push(`(${idx+1})`);
      if(chordLine.trim()) out.push(`    ${chordLine}`);
      out.push(`    ${lyricLine}`);
      out.push("");

    });

    out.push("");
  });

  return any ? out.join("\n").trim() : "(No lyrics/notes yet - start typing in a section)";
}

function buildFullPreviewHtmlDoc(title){
  // ✅ Export HTML that survives Google Docs / Word import:
  // - uses <pre> (preserves spacing)
  // - uses INLINE styles (Docs often strips <style> and class selectors)

  const projectName = String(state.project?.name || "Song Rider Pro").trim() || "Song Rider Pro";
  const bpmVal  = clamp(parseInt(state.bpm ?? el?.bpmInput?.value ?? 0, 10) || 0, 40, 220);
  const capoRaw = parseInt(state.capo ?? el?.capoInput?.value ?? 0, 10);
  const capoVal = isNaN(capoRaw) ? 0 : capoRaw;
  const keyVal  = String(el?.keyOutput?.value || "").trim();

  const metaParts = [];
  if(bpmVal) metaParts.push(`BPM: ${bpmVal}`);
  if(capoVal >= 1) metaParts.push(`Capo: ${capoVal}`);
  if(keyVal) metaParts.push(`Key: ${keyVal}`);
  const metaLine = metaParts.join("   ");

  const blocks = [];

  // ✅ Header: big project name + meta line (same size as lyrics)
  blocks.push(
    `<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:0 0 18px 0;">` +
      `<div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:34px;line-height:1.1;">${escapeHtml(projectName)}</div>` +
      (metaLine ? `<div style="font-family:'Courier New',Courier,monospace;font-weight:400;font-size:16px;line-height:1.2;white-space:pre-wrap;">${escapeHtml(metaLine)}</div>` : ``) +
    `</div>`
  );

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

    // Section heading (use editable page title when available)
    const ttl = (state.project.sectionTitles && state.project.sectionTitles[sec]) ? String(state.project.sectionTitles[sec] || "").trim() : "";
    const headingText = (ttl || sec || "").trim();
    blocks.push(
      `<div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;margin:20px 0 8px;letter-spacing:.3px;">${escapeHtml(headingText)}</div>`
    );
arr.forEach((line, idx) => {
      const lyr = String(line?.lyrics || "").trim();
      const notes = Array.isArray(line?.notes) ? line.notes : [];
      const beats = Array.isArray(line?.beats) ? line.beats : [];

      const hasNotes = notes.some(n => String(n||"").trim());
      const hasBeats = beats.some(b => String(b||"").trim());
      const hasLyrics = !!lyr;
      if(!hasNotes && !hasBeats && !hasLyrics) return;

      const aligned = buildAlignedLine(line, getTransposeSemis() || 0);

      // Index line
      blocks.push(
        `<div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;margin:8px 0 2px;">${escapeHtml(`(${idx+1})`)}</div>`
      );

      // Notes line (red, fixed width, spacing preserved)
      blocks.push(
        `<pre style="margin:0 0 0 0;font-family:'Courier New',Courier,monospace;font-weight:900;color:#7f1d1d;white-space:pre;">${escapeHtml(`    ${aligned.notesLine}`)}</pre>`
      );

      // Lyrics line (fixed width, spacing preserved)
      blocks.push(
        `<pre style="margin:0 0 10px 0;font-family:'Courier New',Courier,monospace;font-weight:400;color:#111;white-space:pre;">${escapeHtml(`    ${aligned.lyricsLine}`)}</pre>`
      );
    });

    // spacer between sections
    blocks.push(`<div style="height:12px;"></div>`);
  });

  const safeTitle = escapeHtml(title || "Song Rider Pro - Full Preview");
  const bodyHtml = blocks.length
    ? blocks.join("\n")
    : `<div style="font-family:Arial,Helvetica,sans-serif;">(No lyrics/notes yet - start typing in a section)</div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
</head>
<body style="margin:24px;color:#111;">
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
  let lastErr = null;
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

       // ✅ Most compatible on Android/PWA: download via <a download>
    try{
      const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      };

      // 2) HTML (printable with red notes)
      downloadBlob(htmlBlob, htmlName);

      return;
    }catch(e){ lastErr = e; }

    // ✅ Next: File System Access API (desktop Chromes + some Android builds)
    try{
      if(window.showSaveFilePicker){
        const handle = await window.showSaveFilePicker({
          suggestedName: htmlName,
          types: [{ description: "HTML", accept: { "text/html": [".html"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(htmlBlob);
        await writable.close();
        return;
      }
    }catch(e){ lastErr = e; /* user cancel or unsupported */ }

    // ✅ Last resort: open in a new tab so user can use Chrome menu → Download / Share
    try{
      const url = URL.createObjectURL(htmlBlob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      alert("Export opened in a new tab. Use Chrome menu → Download / Share to save it.");
      return;
    }catch(e){ lastErr = e; }

    throw lastErr || new Error("Unknown export failure.");
  }catch(e){
    const msg = (e && (e.message || String(e))) || "Unknown export failure.";
    alert("Export failed.\n\n" + msg);
  }
}

/***********************
Sheet rendering
***********************/
function renderSheetActions(){
  // ✅ We moved the page (+ / ✕) controls into the title bar (renderSheetTitleBar).
  // This area used to show duplicate buttons under the title. Keep it empty.
  if(el.sheetActions) el.sheetActions.innerHTML = "";
  return;
}

function buildFullTemplate(){
  // (Kept for legacy comparisons; we no longer seed this template automatically)
  return `${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}

${BREAK_LINE}
`;
}

function buildFullScaffold(){
  // ✅ Start with ONE section by default.
  // Additional sections are created by the user tapping the + button inside Full.
  return `${BREAK_LINE}

`;
}
// Adds any missing headings back in (does NOT reorder your content)
function ensureFullBreaksPresent(fullText){
  const text = normalizeLineBreaks(fullText || "");
  const lines = text.split("\n");

  // ✅ treat ANY valid break (raw BREAK_LINE, "_" or "____Title") as a present break.
  // This prevents a stray blank "Song Part" from being injected at the top when we
  // emit inline-title breaks like:  ________Verse 1
  const hasAnyBreak = lines.some(l => !!_parseBreakLine(l));
  if(hasAnyBreak) return text;

  // If user pasted lyrics with no breaks, insert a single break at the top.
  const prefix = `${BREAK_LINE}\n\n`;
  return prefix + text.replace(/^\s+/, "");
}


// legacy name (older code paths)
function ensureFullHeadingsPresent(fullText){
  return ensureFullBreaksPresent(fullText);
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
    const semis = getTransposeSemis() || 0;

    // Build break-line sections
    // IMPORTANT: Only emit sections that are visible (enabled or have content).
    // Using getAllSectionOrder() here caused Full view to suddenly sprout many
    // empty pages when the user tapped + on a card page.
    getVisibleSectionPages().filter(s => s !== "Full").forEach(sec => {
      const ttl = (state.project.sectionTitles && state.project.sectionTitles[sec])
        ? String(state.project.sectionTitles[sec] || "").trim()
        : "";
      // ✅ Title appears to the RIGHT of the break line:  ________Verse 1
      out.push(BREAK_LINE + (ttl ? ttl : ""));

      // ✅ Always keep at least one blank line under the pill so it never blocks lyrics
      out.push("");

      const arr = (state.project.sections && state.project.sections[sec]) ? state.project.sections[sec] : [];

      let wroteAny = false;

      for(const line of arr){
        const lyrRaw = String(line?.lyrics || "");
        const lyr = lyrRaw.trim();

        const notesRaw = Array.isArray(line?.notes) ? line.notes : [];
        const hasNotes = notesRaw.some(n => String(n || "").trim());

        // If the card has chords but no lyrics, still show chords in Full view (copy/paste use case)
        if(!lyr && hasNotes){
          const notesT = notesRaw.map(n => transposeChordLabel(n, semis)).filter(Boolean).join(" ").trim();
          if(notesT){
            wroteAny = true;
            out.push(notesT);
            out.push(""); // blank line = next card
          }
          continue;
        }

        if(!lyr) continue;

        const notesT = notesRaw.map(n => transposeChordLabel(n, semis));
        const { chordLine, lyricLine } = buildChordSheetLines(notesT, lyrRaw);

        wroteAny = true;
        if(String(chordLine || "").trim()) out.push(chordLine);
        out.push(String(lyricLine || "").trimRight());
        out.push(""); // blank line = next card
      }

      if(!wroteAny) out.push("");

      // spacing between pages
      out.push("");
    });

    while(out.length && out[out.length - 1] === "") out.pop();

    let text = out.join("\n") + "\n";
    text = ensureFullBreaksPresent(text);

    state.project.fullText = text;
  }finally{
    _fullSyncLock = false;
  }
}


function renderSheetTitleBar(){
  if(!el.sheetTitle) return;
  ensurePageMeta();

  // clear
  el.sheetTitle.innerHTML = "";
  el.sheetTitle.style.display = "flex";
  el.sheetTitle.style.width = "100%";
  el.sheetTitle.style.boxSizing = "border-box";
  el.sheetTitle.style.alignItems = "center";
  el.sheetTitle.style.justifyContent = "space-between";
  el.sheetTitle.style.flexWrap = "nowrap";
  el.sheetTitle.style.gap = "10px";

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "10px";
  left.style.flex = "1 1 auto";
  left.style.minWidth = "0";

  // ✅ Keep the Full-page header hint on the LEFT, in the same header row.
  // (We don't rely on #sheetHint, since it's outside the title bar.)
  const leftHint = document.createElement("div");
  leftHint.style.fontSize = "12px";
  leftHint.style.fontWeight = "900";
  leftHint.style.color = "#666";
  leftHint.style.whiteSpace = "nowrap";
  leftHint.style.overflow = "hidden";
  leftHint.style.textOverflow = "ellipsis";
  leftHint.style.lineHeight = "1";

  // Is this an EXTRA page? (internal section key like "EXTRA 1", "EXTRA 2", etc.)
  const isExtraPage = (state.project && Array.isArray(state.project.extraSections) && state.project.extraSections.includes(state.currentSection))
    || /^EXTRA\b/i.test(String(state.currentSection||""));

  const name = document.createElement("div");
  name.style.display = "none"; // no more preset page titles
  left.appendChild(name);

  // Title input for EVERY non-Full page
  let titleInput = null;
  if(state.currentSection !== "Full"){

    titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Title (optional)…";
    titleInput.className = "songPartPill headingPill";
    titleInput.value = (state.project.sectionTitles && state.project.sectionTitles[state.currentSection]) ? String(state.project.sectionTitles[state.currentSection] || "") : "";
    titleInput.style.flex = "1 1 0";
    titleInput.style.minWidth = "90px";
    titleInput.style.maxWidth = "420px";
    titleInput.style.borderRadius = "12px";
    titleInput.style.border = "1px solid rgba(0,0,0,.18)";
    titleInput.style.padding = "6px 10px";
    titleInput.style.background = "var(--hiYellow)";
    titleInput.style.border = "1px solid rgba(0,0,0,.22)";
    titleInput.style.fontWeight = "900";
    titleInput.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){ e.preventDefault(); titleInput.blur(); }
    });

    let tmr = null;
    titleInput.addEventListener("input", () => {
      if(tmr) clearTimeout(tmr);
      tmr = setTimeout(() => {
        const val = String(titleInput.value || "").trim();
        editProject("sectionTitle", () => {
          ensurePageMeta();
          if(val) state.project.sectionTitles[state.currentSection] = val;
          else { try{ delete state.project.sectionTitles[state.currentSection]; }catch{} }
          syncFullTextFromSections();
        });
        updateFullIfVisible();
      }, 220);
    });

    left.appendChild(titleInput);
  }else{
    // ✅ Single-line hint on Full, left-aligned
    leftHint.textContent = "Full Song View";
    left.appendChild(leftHint);
  }

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.alignItems = "center";
  right.style.gap = "8px";
  right.style.flex = "0 0 auto";


  if(state.currentSection === "Full"){
    // ✅ Full page gets + / ✕ to add/remove pages without leaving Full view
    const addBtn = document.createElement("button");
    addBtn.className = "btn secondary";
    addBtn.textContent = "+";
    addBtn.title = "Add next page";
    addBtn.style.width = "38px";
    addBtn.style.height = "34px";
    addBtn.style.borderRadius = "999px";
    addBtn.style.fontWeight = "1100";
    addBtn.addEventListener("click", () => {
      if(sheetHeaderBtnLock) return;
      sheetHeaderBtnLock = true; setTimeout(()=>{sheetHeaderBtnLock=false;}, 220);
      // Add based on the LAST visible page (excluding Full)
      const vis = getVisibleSectionPages().filter(s => s !== "Full");
      const last = vis.length ? vis[vis.length-1] : "PAGE 1";
      const next = findNextSectionToEnable(last);

      let target = null;
      editProject("addPageFull", () => {
        if(next === "__CREATE_EXTRA__"){
          target = createExtraSection();
        }else{
          enableSection(next);
          target = next;
        }
        syncFullTextFromSections();
      });

      if(!target){
        alert("Could not create an extra page.");
        return;
      }
      // stay on Full
      render();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn secondary";
    delBtn.textContent = "✕";
    delBtn.title = "Delete last page";
    delBtn.style.width = "38px";
    delBtn.style.height = "34px";
    delBtn.style.borderRadius = "999px";
    delBtn.style.fontWeight = "1100";

    delBtn.addEventListener("click", () => {
      if(sheetHeaderBtnLock) return;
      sheetHeaderBtnLock = true; setTimeout(()=>{sheetHeaderBtnLock=false;}, 220);
      const pages = getVisibleSectionPages().filter(s => s !== "Full");
      // don't allow deleting the first Verse 1 base page
      const candidates = pages.filter(s => !BASE_PAGES.includes(s));
      const sec = candidates.length ? candidates[candidates.length-1] : null;
      if(!sec){
        alert("Nothing to delete (base pages remain; only extra pages can be removed).");
        return;
      }
      if(!confirm(`Delete page "${sec}"? This clears its cards and hides the page.`)) return;

      editProject("deletePageFull", () => {
        deleteSectionPage(sec);
        syncFullTextFromSections();
      });

      render();
    });

    right.appendChild(addBtn);
    right.appendChild(delBtn);
  }else{
    const addBtn = document.createElement("button");
    addBtn.className = "btn secondary";
    addBtn.textContent = "+";
    addBtn.title = "Add next page";
    addBtn.style.width = "38px";
    addBtn.style.height = "34px";
    addBtn.style.borderRadius = "999px";
    addBtn.style.fontWeight = "1100";
   addBtn.addEventListener("click", () => {
  if(sheetHeaderBtnLock) return;
  sheetHeaderBtnLock = true; setTimeout(()=>{sheetHeaderBtnLock=false;}, 220);
  const next = findNextSectionToEnable(state.currentSection);

  let target = null;

  editProject("addPage", () => {
    if(next === "__CREATE_EXTRA__"){
      target = createExtraSection();     // ✅ makes EXTRA 1 / EXTRA 2 / ...
    }else{
      enableSection(next);               // ✅ base page enable
      target = next;
    }

    // keep Full page synced
    syncFullTextFromSections();
  });

  if(!target){
    alert("Could not create an extra page.");
    return;
  }

  goToSection(target);
});

    const delBtn = document.createElement("button");
    delBtn.className = "btn secondary";
    delBtn.textContent = "✕";
    delBtn.title = "Delete this page";
    delBtn.style.width = "38px";
    delBtn.style.height = "34px";
    delBtn.style.borderRadius = "999px";
    delBtn.style.fontWeight = "1100";
    delBtn.addEventListener("click", () => {
      if(sheetHeaderBtnLock) return;
      sheetHeaderBtnLock = true; setTimeout(()=>{sheetHeaderBtnLock=false;}, 220);
      const sec = state.currentSection;
      if(!confirm(`Delete page "${sec}"? This clears its cards and hides the page.`)) return;

      editProject("deletePage", () => {
        deleteSectionPage(sec);
        syncFullTextFromSections();
      });

      // move somewhere safe
      const pages = getVisibleSectionPages();
      const idx = pages.indexOf(sec);
      const fallback = pages[(idx+1) % pages.length] || "Full";
      goToSection(fallback === sec ? "Full" : fallback);
    });

    right.appendChild(addBtn);
    right.appendChild(delBtn);
  }


  el.sheetTitle.appendChild(left);
  el.sheetTitle.appendChild(right);
}


function renderSheet(){
  renderSheetTitleBar();
  renderSheetActions();

  state.playCardIndex = null;

if(state.currentSection === "Full"){
  // ✅ BSP-style Full Song View performance layout (used when AutoScroll is ON)
  if(state.fullPerfMode){
    if(el.sheetHint) el.sheetHint.textContent = "";
    (el.sheetInner || el.sheetBody).innerHTML = "";

    const fullText = String(state.project?.fullText || "");

    // Parse blocks using the same break-line rules
    const lines = fullText.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
    const blocks = [];
    let cur = null;
    const flush = () => {
      if(!cur) return;
      // trim leading/trailing empties
      while(cur.body.length && String(cur.body[0]||"").trim() === "") cur.body.shift();
      while(cur.body.length && String(cur.body[cur.body.length-1]||"").trim() === "") cur.body.pop();
      blocks.push(cur);
      cur = null;
    };
    for(const raw of lines){
      const br = _parseBreakLine(raw);
      if(br){
        flush();
        cur = { title: String(br.title||"").trim(), body: [] };
        continue;
      }
      if(!cur) continue;
      cur.body.push(String(raw ?? ""));
    }
    flush();
    if(!blocks.length) blocks.push({ title:"", body:[] });

    const host = document.createElement("div");
    host.className = "fullPerf";

    const scroll = document.createElement("div");
    scroll.id = "fullPerfScroll";
    scroll.className = "fullPerfScroll";

    // Build line items for ticking
    const items = [];

    blocks.forEach((b) => {
      const sec = document.createElement("div");
      sec.className = "fullPerfSection";

      const head = document.createElement("div");
      head.className = "fullPerfHead";

      const l1 = document.createElement("div");
      l1.className = "fullPerfLine";
      const pill = document.createElement("div");
      pill.className = "fullPerfPill";
      pill.textContent = String(b.title || "Song Part").trim() || "Song Part";
      const l2 = document.createElement("div");
      l2.className = "fullPerfLine";
      head.appendChild(l1);
      head.appendChild(pill);
      head.appendChild(l2);
      sec.appendChild(head);

      // ✅ BSP-style Full Song View (SRP):
      // Render EVERY eligible lyric line as its own 4-beat row (no missing first lines).
      // - Skips headings + chord-only lines
      // - Manual “/” split overrides AutoSplit
      const body = Array.isArray(b.body) ? b.body : [];

      for(const rawLine of body){
        const t = String(rawLine ?? "").replace(/\s+$/g,"").trim();
        if(!t) continue;
        if(_fullPerf_isHeadingLine(t)) continue;
        if(_fullPerf_isChordLine(t)) continue;

        const beats = _fullPerf_computeBeats(t);
        const row = document.createElement("div");
        row.className = "fullPerfRow";

        const boxes = [];
        for(let i=0;i<4;i++){
          const bx = document.createElement("div");
          bx.className = "fullPerfBox";
          bx.textContent = String(beats[i] || "");
          row.appendChild(bx);
          boxes.push(bx);
        }
        sec.appendChild(row);
        items.push({ rowEl: row, boxes });
      }

      scroll.appendChild(sec);
    });

    host.appendChild(scroll);
    (el.sheetInner || el.sheetBody).appendChild(host);

    // Save items for ticking
    state.fullPerfItems = items;
    // When rendering while AutoScroll is ON, start near the current scroll position
    state.fullPerfLineIndex = clamp(Number(state.fullPerfLineIndex)||0, 0, Math.max(0, items.length - 1));

    // Keep nearest line selection updated ONLY on user manual scroll (prevents "bouncing")
    const hostScroll = getFullPerfScrollHost();
    const markUserScroll = () => { state.fullPerfUserScrollUntil = Date.now() + 900; };
    (hostScroll || scroll).addEventListener("touchstart", markUserScroll, {passive:true});
    (hostScroll || scroll).addEventListener("touchmove", markUserScroll, {passive:true});
    (hostScroll || scroll).addEventListener("wheel", markUserScroll, {passive:true});

    (hostScroll || scroll).addEventListener("scroll", () => {
      if(!state.autoScrollOn) return;
      const now = Date.now();
      // Ignore programmatic smooth-scroll updates
      if(now < (state.fullPerfProgramScrollUntil||0)) return;
      // Only update while user is actively scrolling
      if(now > (state.fullPerfUserScrollUntil||0)) return;
      // During AutoScroll engage, ignore scroll events so we don't snap to a line above.
      if(now < (state.fullPerfLockLineUntil||0)) return;
      state.fullPerfLineIndex = findFirstVisibleFullPerfLineIndex();
    }, { passive:true });

    return;
  }

  // ✅ Full page editor is now SECTION BLOCKS (no overlay), so:
  // - No black break lines are visible
  // - Yellow pill + buttons never overlap lyrics
  if(el.sheetHint) el.sheetHint.textContent = "";
  (el.sheetInner || el.sheetBody).innerHTML = "";

  // Ensure at least one section exists
  if(!String(state.project.fullText || "").trim()){
    state.project.fullText = `${BREAK_LINE}\n\n`;
    upsertProject(state.project);
  }

  function splitBlocks(fullText){
    const lines = String(fullText || "").replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
    const blocks = [];
    let cur = null;
    const flush = () => {
      if(!cur) return;
      while(cur.body.length && String(cur.body[0]||"").trim() === "") cur.body.shift();
      while(cur.body.length && String(cur.body[cur.body.length-1]||"").trim() === "") cur.body.pop();
      blocks.push(cur);
      cur = null;
    };
    for(const raw of lines){
      const br = _parseBreakLine(raw);
      if(br){
        flush();
        cur = { title: String(br.title||"").trim(), body: [] };
        continue;
      }
      if(!cur) continue;
      cur.body.push(String(raw ?? ""));
    }
    flush();
    if(!blocks.length) blocks.push({ title:"", body:[] });
    return blocks;
  }

  function blocksToFullText(blocks){
    const out = [];
    for(const b of blocks){
      const t = String(b.title||"").trim();
      out.push(BREAK_LINE + (t ? t : ""));
      out.push("");
      const body = Array.isArray(b.body) ? b.body : [];
      for(const ln of body) out.push(String(ln ?? ""));
      out.push("");
      out.push("");
    }
    while(out.length && out[out.length-1] === "") out.pop();
    return out.join("\n") + "\n";
  }

  let blocks = splitBlocks(state.project.fullText || "");

  // Ensure we have enough section names for block mapping
  const pageOrder = getAllSectionOrder().filter(s => s !== "Full");
  while(pageOrder.length < blocks.length){
    editProject("ensureExtras", () => {
      createExtraSection({ enable:false });
    });
    pageOrder.splice(0, pageOrder.length, ...getAllSectionOrder().filter(s => s !== "Full"));
  }

  const fullWrap = document.createElement("div");
  fullWrap.className = "fullSectionEditor";

  let commitTimer = null;
  function commitNow(){
    const newText = blocksToFullText(blocks);
    editProject("fullBlocks", () => {
      state.project.fullText = newText;
      applyFullTextToProjectSections(state.project.fullText || "");
      cleanupDeletedBaseSections();
    });
    renderTabs();
    renderSheetTitleBar();
    refreshDisplayedNoteCells();
    updateKeyFromAllNotes();
    saveCurrentProject();
  }
  function commitDebounced(){
    if(commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitNow();
      refreshRhymesFromActive();
    }, 160);
  }

  // ✅ Make + / × feel instant on mobile: update UI immediately, then do heavy sync in the debounce.
  // Also guard against accidental double-taps.
  let pillActionLock = false;
  function withPillActionLock(fn){
    if(pillActionLock) return;
    pillActionLock = true;
    try{ fn(); }finally{ setTimeout(()=>{ pillActionLock = false; }, 320); }
  }

  // ✅ Avoid mobile "double fire" (pointerup + click). Use ONE tap event.
  function bindTap(elm, handler){
    if(!elm) return;
    const hasPointer = typeof window !== "undefined" && !!window.PointerEvent;
    if(hasPointer){
      // On some mobile browsers, a synthetic click can still fire after pointerup.
      // We handle pointerup and explicitly swallow click to prevent double-add/delete.
      elm.addEventListener("pointerup", (e)=>{ e.preventDefault(); e.stopPropagation(); handler(e); }, {passive:false});
      elm.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); }, {capture:true});
    }else{
      elm.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); handler(e); });
    }
  }

  function quickSaveFullText(){
    // Persist immediately so refresh never loses newly added/removed blocks.
    try{
      const newText = blocksToFullText(blocks);
      editProject("quickFullSave", () => { state.project.fullText = newText; });
      saveCurrentProject();
    }catch(err){ console.error(err); }
  }

  blocks.forEach((b, idx) => {
    const sec = pageOrder[idx] || null;

    const card = document.createElement("div");
    card.className = "fullSectionCard";

    const head = document.createElement("div");
    head.className = "fullSectionHead";
    const leftLine = document.createElement("div");
    leftLine.className = "fullBreakLine";
    const rightLine = document.createElement("div");
    rightLine.className = "fullBreakLine";

    const pill = document.createElement("input");
    pill.type = "text";
    pill.className = "songPartPill";
    pill.placeholder = "Song Part";
    pill.value = String(b.title || "");
    pill.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){ e.preventDefault(); pill.blur(); }
    });
    pill.addEventListener("input", () => {
      b.title = String(pill.value || "");
      editProject("pillTitle", () => {
        ensurePageMeta();
        if(!state.project.sectionTitles) state.project.sectionTitles = {};
        if(sec){
          const v = String(b.title||"").trim();
          if(v) state.project.sectionTitles[sec] = v;
          else { try{ delete state.project.sectionTitles[sec]; }catch{} }
        }
      });
      renderTabs();
      renderSheetTitleBar();
      commitDebounced();
    });

    head.appendChild(leftLine);
    head.appendChild(pill);
    head.appendChild(rightLine);

    const ta = document.createElement("textarea");
    ta.className = "fullSectionText";
    _attachCaretRemember(ta);
    ta.placeholder = "Lyrics / chords...";
    ta.value = Array.isArray(b.body) ? b.body.join("\n") : "";
    autosizeTextarea(ta);
    ta.addEventListener("focus", () => { lastLyricsTextarea = ta; refreshRhymesFromActive(); });
    ta.addEventListener("click", () => { lastLyricsTextarea = ta; refreshRhymesFromActive(); });
    ta.addEventListener("input", () => {
      autosizeTextarea(ta);
      b.body = String(ta.value || "").replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
      // ✅ persist immediately so a fast refresh never loses edits
      quickSaveFullText();
      commitDebounced();
    });
    ta.addEventListener("paste", () => setTimeout(() => autosizeTextarea(ta), 0));

    const actions = document.createElement("div");
    actions.className = "fullSectionActions";
    const addBtn = document.createElement("button");
    addBtn.className = "pillBtn";
    addBtn.textContent = "+";
    addBtn.title = "Add song part";
    addBtn.type = "button";
    bindTap(addBtn, () => {
      withPillActionLock(() => {
        blocks.splice(idx + 1, 0, { title:"", body:[] });
        state.project.fullText = blocksToFullText(blocks);
        quickSaveFullText();
        renderSheet();
        commitDebounced();
      });
    });

    const delBtn = document.createElement("button");
    delBtn.className = "pillBtn";
    delBtn.textContent = "×";
    delBtn.title = "Delete this song part";
    delBtn.type = "button";
    const doDelete = () => {
      if(!confirm("Delete this song part section?")) return;
      if(blocks.length <= 1){
        blocks = [{ title:"", body:[] }];
      }else{
        blocks.splice(idx, 1);
      }
      // Remove the corresponding page/card immediately (if it exists)
      if(sec){
        try{ deleteSectionPage(sec); }catch{}
      }
      state.project.fullText = blocksToFullText(blocks);
      quickSaveFullText();
      renderSheet();
      commitDebounced();
    };
    bindTap(delBtn, () => {
      withPillActionLock(doDelete);
    });
    actions.appendChild(addBtn);
    actions.appendChild(delBtn);

    card.appendChild(head);
    card.appendChild(ta);
    card.appendChild(actions);
    fullWrap.appendChild(card);
  });

  (el.sheetInner || el.sheetBody).appendChild(fullWrap);
  requestAnimationFrame(() => {
    try{ fullWrap.querySelectorAll("textarea.fullSectionText").forEach(autosizeTextarea); }catch{}
  });
  return;

  const wrap = document.createElement("div");
  wrap.className = "fullBoxWrap";

  // ✅ Break title pills now live INSIDE the Full textarea at every break line.
  //    We render an overlay that aligns pills to the break-line rows in the textarea.
  const pillPages = getAllSectionOrder().filter(s => s !== "Full");


  const host = document.createElement("div");
  host.className = "fullPillHost";

  const ta = document.createElement("textarea");
  ta.className = "fullBox";
  _attachCaretRemember(ta);
  ta.addEventListener("focus", () => {
  lastLyricsTextarea = ta;     // ✅ so rhyme taps insert into Full view
  refreshRhymesFromActive();
});
ta.addEventListener("click", () => {
  lastLyricsTextarea = ta;     // ✅ cursor moves, seed word changes
  refreshRhymesFromActive();
});
  ta.readOnly = false;
  ta.placeholder = `__________Page name
Line 1
Line 2

(blank line = new card)

__________
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

  const overlay = document.createElement("div");
  overlay.className = "fullPillOverlay";
  host.appendChild(ta);
  host.appendChild(overlay);


  // Fill the available space better (no index.html edits required)
  ta.style.width = "100%";
  ta.style.minHeight = "calc(100vh - 220px)";
  ta.style.resize = "none";

  // ---------- Break-pill overlay helpers ----------
  function parseBreakLinesFromText(text){
    const lines = String(text || "").replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
    const breaks = [];
    for(let i=0;i<lines.length;i++){
      const raw = String(lines[i] ?? "");
      const t = raw.trim();
      if(!t) continue;
      if(t === BREAK_LINE || t === "_"){
        breaks.push({ lineIndex:i, title:"" });
        continue;
      }
      if(t[0] === "_"){
        const m = t.match(/^_{1,}\s*(.+)?$/);
        const title = (m && m[1]) ? String(m[1] || "").trim() : "";
        breaks.push({ lineIndex:i, title });
      }
    }
    return { lines, breaks };
  }

  function setBreakLineTitleByOccurrence(occIdx, title){
    const parsed = parseBreakLinesFromText(ta.value);
    const b = parsed.breaks[occIdx];
    if(!b) return;

    const lines = parsed.lines.slice();
    const t = String(title || "").trim();
    // Force canonical inline title form: ________Title
    lines[b.lineIndex] = BREAK_LINE + (t ? t : "");
    const newText = lines.join("\n");

    if(newText === ta.value) return;

    // Preserve cursor as best we can (keep it close)
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;
    ta.value = newText;
    try{
      ta.selectionStart = clamp(selStart, 0, ta.value.length);
      ta.selectionEnd = clamp(selEnd, 0, ta.value.length);
    }catch{}

    // Commit via the same pipeline used by typing in Full
    onFullTextareaInput();
  }
  function insertSectionAfterOccurrence(occIdx){
    const parsed = parseBreakLinesFromText(ta.value);
    const lines = parsed.lines.slice();
    const breaks = parsed.breaks;

    if(!breaks.length) return;

    // insertion point is right BEFORE the next break, or end of text
    let insertAt = (occIdx + 1 < breaks.length) ? breaks[occIdx + 1].lineIndex : lines.length;

    // Ensure at least one blank line before the new break (so + / × feels "under" the section)
    if(insertAt > 0 && String(lines[insertAt - 1] || "").trim() !== ""){
      lines.splice(insertAt, 0, "");
      insertAt += 1;
    }

    // Insert new break + a blank line for typing
    lines.splice(insertAt, 0, BREAK_LINE, "");

    ta.value = lines.join("\n");
    state.project.fullText = ta.value;

    // Move cursor to the blank line right after the inserted break
    try{
      const targetLine = insertAt + 1; // the blank line after BREAK_LINE
      let idx = 0;
      for(let i=0;i<lines.length;i++){
        if(i === targetLine){ break; }
        idx += lines[i].length + 1;
      }
      ta.focus();
      ta.setSelectionRange(idx, idx);
    }catch{}

    onFullTextareaInput();
    positionOverlayPills();
  }

  function deleteSectionByOccurrence(occIdx){
    const parsed = parseBreakLinesFromText(ta.value);
    const lines = parsed.lines.slice();
    const breaks = parsed.breaks;

    if(!breaks.length) return;

    // If this is the only section, just clear its content (keep one break)
    if(breaks.length <= 1){
      ta.value = `${BREAK_LINE}\n\n`;
      state.project.fullText = ta.value;
      onFullTextareaInput();
      positionOverlayPills();
      return;
    }

    const startLine = breaks[occIdx].lineIndex;
    const endLine = (occIdx + 1 < breaks.length) ? breaks[occIdx + 1].lineIndex : lines.length;

    lines.splice(startLine, Math.max(0, endLine - startLine));

    // Always ensure the text begins with a break line
    if(String(lines[0] || "").trim() !== BREAK_LINE){
      lines.unshift(BREAK_LINE, "");
    }

    ta.value = lines.join("\n");
    state.project.fullText = ta.value;

    onFullTextareaInput();
    positionOverlayPills();
  }


  function positionOverlayPills(){
    overlay.innerHTML = "";

    const parsed = parseBreakLinesFromText(ta.value);
    const breaks = parsed.breaks;
    if(!breaks.length) return;

    const cs = getComputedStyle(ta);
    const lineH = parseFloat(cs.lineHeight) || 18;
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const scrollTop = ta.scrollTop || 0;
    const viewH = ta.clientHeight || 0;

    // Visual sizes for overlay elements
    const pillH = 34;
    const rowH  = Math.max(pillH + 8, lineH + 10); // also masks the raw break-line text

    const pages = pillPages.slice();
    for(let i=0;i<breaks.length;i++){
      const sec = pages[i] || null;
      if(!sec) break;

      const y = padT + (breaks[i].lineIndex * lineH) - scrollTop;

      // Only render if near viewport (small buffer)
      if(y < -80 || y > viewH + 80) continue;

      const row = document.createElement("div");
      row.className = "breakRow";
      // Center the pill over the break-line, and mask the literal "__________TITLE" text behind it
      row.style.top = `${Math.max(0, Math.round(y - ((rowH - lineH) / 2)))}px`;
      row.style.height = `${Math.round(rowH)}px`;
      // Allow editing the pill input (row acts as a mask, input handles the interaction)
      row.style.pointerEvents = "auto";
      row.style.background = "#fff";
      row.style.borderRadius = "16px";

      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "songPartPill";
      inp.placeholder = "Song Part";

      // Two-way: prefer explicit project title, else derive from Full break line
      const stored = (state.project.sectionTitles && state.project.sectionTitles[sec])
        ? String(state.project.sectionTitles[sec] || "").trim()
        : "";
      const derived = String(breaks[i].title || "").trim();
      inp.value = stored || derived;

      inp.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){ e.preventDefault(); inp.blur(); }
      });

      // keep the pill sized so it doesn't block lyrics (lyrics start beneath a blank line)
      inp.style.height = `${pillH}px`;

      let tmrP = null;
      inp.addEventListener("input", () => {
        if(tmrP) clearTimeout(tmrP);
        tmrP = setTimeout(() => {
          const val = String(inp.value || "").trim();
          editProject("fullBreakTitle", () => {
            ensurePageMeta();
            if(val) state.project.sectionTitles[sec] = val;
            else { try{ delete state.project.sectionTitles[sec]; }catch{} }
          });

          // Update the actual break line text for this occurrence so parsing/sync stays correct
          setBreakLineTitleByOccurrence(i, val);

          // Keep pages + Full synced
          editProject("syncAfterFullBreakTitle", () => {
            syncFullTextFromSections();
          });
          updateFullIfVisible();
        }, 180);
      });

      row.appendChild(inp);
      overlay.appendChild(row);

      // + / × action row UNDER this section's text (not on top of lyrics)
      try{
        const endLine = (i + 1 < breaks.length) ? breaks[i + 1].lineIndex : parsed.lines.length;

        // Find last non-empty line within this section (between this break and the next break)
        let last = breaks[i].lineIndex;
        for(let k=endLine-1;k>breaks[i].lineIndex;k--){
          const t = String(parsed.lines[k] || "").trim();
          if(t){ last = k; break; }
        }

        let yBtn = padT + ((last + 1) * lineH) - scrollTop + 6;

        // Keep the controls at least under the pill area
        yBtn = Math.max(y + rowH + 6, yBtn);

        // Clamp above next pill to prevent collisions
        if(i + 1 < breaks.length){
          const yNext = padT + (breaks[i + 1].lineIndex * lineH) - scrollTop;
          yBtn = Math.min(yBtn, yNext - rowH - 8);
        }

        if(yBtn >= -80 && yBtn <= viewH + 80){
          const act = document.createElement("div");
          act.className = "breakActions";
          act.style.top = `${Math.max(0, Math.round(yBtn))}px`;
          act.style.pointerEvents = "auto";

          const bAdd = document.createElement("button");
          bAdd.type = "button";
          bAdd.className = "breakActBtn";
          bAdd.textContent = "+";
          bAdd.addEventListener("click", (e) => {
            e.preventDefault(); e.stopPropagation();
            insertSectionAfterOccurrence(i);
          });

          const bDel = document.createElement("button");
          bDel.type = "button";
          bDel.className = "breakActBtn";
          bDel.textContent = "×";
          bDel.addEventListener("click", (e) => {
            e.preventDefault(); e.stopPropagation();
            deleteSectionByOccurrence(i);
          });

          act.appendChild(bAdd);
          act.appendChild(bDel);
          overlay.appendChild(act);
        }
      }catch{}

    }

    // prevent overlay from blocking textarea bottom taps
    overlay.style.paddingBottom = `${padB}px`;
  }

  // Debounced Full input handler (shared by typing and pill edits)
  let tmr = null;
  function onFullTextareaInput(){
    // keep live text in memory immediately (no history yet)
    state.project.fullText = ta.value;

    if(tmr) clearTimeout(tmr);
    tmr = setTimeout(() => {
      editProject("fullText", () => {
        state.project.fullText = ta.value;
        // Apply changes -> sections/cards
        applyFullTextToProjectSections(state.project.fullText || "");
        // Ensure we keep enough breaks for stable UI
        state.project.fullText = ensureFullBreaksPresent(state.project.fullText || "");
      });
      updateFullIfVisible();
      refreshKeyUI();
      // re-align pills after parsing may normalize break lines
      positionOverlayPills();
    }, 220);
  }

  // Keep overlay aligned while scrolling
  ta.addEventListener("scroll", () => positionOverlayPills(), { passive:true });

  // Rebuild overlay as the user types
  ta.addEventListener("input", () => {
    onFullTextareaInput();
    positionOverlayPills();
  });

  // Initial overlay build
  queueMicrotask(() => positionOverlayPills());

  wrap.appendChild(host);

  // (the rest of the Full-view render continues below)

  // ✅ On first open: optionally seed sections from Full text ONCE (prevents freezes)
  if(!didInitialFullApply){
    didInitialFullApply = true;

    const ft = String(state.project?.fullText || "");
    // Only auto-apply if sections are essentially empty (otherwise preserve existing cards)
    const hasAnyCards = FULL_EDIT_SECTIONS.some(sec => {
      const arr = state.project?.sections?.[sec] || [];
      return Array.isArray(arr) && arr.some(lineHasContent);
    });

    if(ft.trim() && !hasAnyCards){
      // defer so UI can paint first
      setTimeout(()=>{
        try{
          applyFullTextToProjectSections(ft);
          upsertProject(state.project); // ok to keep (no history needed on first open)
          // re-render after seeding
          try{ renderAllSections?.(); }catch{}
          try{ renderAll?.(); }catch{}
        }catch(e){
          console.error("Full->cards seed failed:", e);
        }
      }, 0);
    }
  }

  // textarea is inside `host` (so overlay can sit on top)
(el.sheetInner || el.sheetBody).appendChild(wrap);
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

/* ✅ Card top bar: number + syllables on the SAME top line, with + / × on the right */
const top = document.createElement("div");
top.className = "cardTop";

const topLeft = document.createElement("div");
topLeft.className = "cardTopLeft";

const topRight = document.createElement("div");
topRight.className = "cardTopRight";

/* Card number */
const num = document.createElement("div");
num.className = "cardNum";
num.textContent = String(idx + 1);

/* Syllable pill */
const syll = document.createElement("div");
syll.className = "syllPill";
updateSyllPill(syll, line.lyrics || "");

/* ✅ Add button (right side) */
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

/* ✅ Delete button (right side) */
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

topLeft.appendChild(num);
topLeft.appendChild(syll);
topRight.appendChild(addBtn);
topRight.appendChild(delBtn);

top.appendChild(topLeft);
top.appendChild(topRight);
card.appendChild(top);

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

(el.sheetInner || el.sheetBody).innerHTML = "";
(el.sheetInner || el.sheetBody).appendChild(cardsWrap);

  lastActiveCardEl = getNearestVisibleCard();
  clearTick(); applyTick();

  refreshDisplayedNoteCells();
}
async function uploadAudioFile(){
  // ✅ One button supports:
  // - Audio files (mp3/wav/m4a): same behavior as before (adds to recordings + can sync)
  // - PDF files: extracts text -> drops it into Full -> populates cards + chords
  // - Text files: reads text -> drops it into Full -> populates cards + chords
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "audio/*,application/pdf,text/plain,.pdf,.txt";
  inp.click();

  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if(!file) return;

    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();

    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    const isText = type.startsWith("text/") || name.endsWith(".txt");
    const isAudio = type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(name);

    if(isPdf){
      await importPdfToFull(file);
      return;
    }
    if(isText){
      const txt = await file.text();
      await importTextToFull(txt);
      return;
    }
    if(isAudio){
      const item = {
        id: uuid(),
        projectId: state.project?.id || "",
        kind: "upload",
        createdAt: now(),
        title: file.name || "Audio",
        blob: file,
        offsetSec: 0
      };

      await dbPut(item);
      await renderRecordings();

      // optional: auto-start sync immediately after upload
      await startAudioSyncFromRec(item);
      return;
    }

    alert("Unsupported file. Upload an audio file (.mp3/.wav/.m4a), a .pdf, or a .txt");
  };
}

// ----------------------
// ✅ IMPORT: Text -> Full -> Cards (with chord parsing)
// ----------------------
async function importTextToFull(text){
  if(!state.project) return;

  // Normalize and lightly clean import text
  let cleaned = normalizeLineBreaks(String(text || ""));
  cleaned = fixPdfLetterSpacing(cleaned);
  cleaned = cleaned.trim();
  if(!cleaned){
    alert("No text found to import.");
    return;
  }

  // ✅ Full Song View uses the break-line block editor.
  // If the import has no break-lines, it may still parse into cards,
  // but Full View would look empty. So we:
  //  - convert heading lines (INTRO / VERSE 1 / CHORUS 1 / BRIDGE / OUTRO, etc.) into break blocks
  //  - otherwise, just prefix a break-line at the top.
  function ensureBreakBlocksForFull(raw){
    const s = String(raw || "");
    const lines = s.split("\n");

    // If it already has break-lines, keep it as-is.
    for(const ln of lines){
      const t = String(ln||"").trim();
      if(_parseBreakLine(t)) return s;
    }

    // Try: treat section heading lines as block starts.
    const blocks = [];
    let cur = null;

    const pushCur = () => {
      if(!cur) return;
      // trim leading/trailing blanks
      while(cur.body.length && String(cur.body[0]||"").trim()==="") cur.body.shift();
      while(cur.body.length && String(cur.body[cur.body.length-1]||"").trim()==="") cur.body.pop();
      blocks.push(cur);
      cur = null;
    };

    for(const ln of lines){
      const rawLn = String(ln ?? "");
      const t = rawLn.trim();
      const sec = isSectionHeadingLine(t);
      if(sec){
        pushCur();
        // Use the original trimmed heading as the block title (keeps "Verse 1" etc.)
        cur = { title: t, body: [] };
        continue;
      }
      if(!cur) cur = { title: "", body: [] };
      cur.body.push(rawLn);
    }
    pushCur();

    // If we never found a heading, just wrap everything into one block.
    if(!blocks.length){
      return BREAK_LINE + "\n\n" + s + "\n";
    }

    // Build canonical fullText with break-lines for the block editor.
    const out = [];
    for(const b of blocks){
      const title = String(b.title || "").trim();
      out.push(BREAK_LINE + (title ? title : ""));
      out.push("");
      for(const ln of (b.body || [])) out.push(String(ln ?? ""));
      out.push("");
      out.push("");
    }
    while(out.length && out[out.length-1] === "") out.pop();
    return out.join("\n") + "\n";
  }

  cleaned = ensureBreakBlocksForFull(cleaned);

  editProject("importText", () => {
    state.project.fullText = cleaned;
    applyFullTextToProjectSections(state.project.fullText || "");
    cleanupDeletedBaseSections();
  });

  updateKeyFromAllNotes();
  renderAll();
  goToSection("Full");
}

// ----------------------
// ✅ IMPORT: PDF -> extract text -> Full -> Cards (with chord parsing)
// Requires PDF.js (pdfjsLib global)
// ----------------------
async function importPdfToFull(file){
  try{
    const text = await extractTextFromPdfFile(file);
    if(!String(text||"").trim()){
      alert("PDF imported, but no selectable text was found.\n\nThis usually means the PDF is a scanned image (picture-only). Export a text-based PDF (not scanned), or save as .txt and import that.");
      return;
    }
    await importTextToFull(text);
    // ✅ After PDF import, jump straight to VERSE 1 cards
    try{ goToSection("VERSE 1"); renderTabs(); renderSheet(); }catch{}
}catch(err){
    console.error(err);
    const online = (typeof navigator !== "undefined" && "onLine" in navigator) ? navigator.onLine : "unknown";
    const details = [
      `name: ${err?.name || "?"}`,
      `message: ${err?.message || String(err || "?")}`,
      (err && "code" in err) ? `code: ${err.code}` : null
    ].filter(Boolean).join("\n");

    alert(
      "PDF import failed.\n\n" +
      `Online: ${online}\n\n` +
      "This is NOT a Wi‑Fi issue most of the time.\n" +
      "Common causes:\n" +
      "• PDF.js script blocked by network/caching\n" +
      "• PDF is password-protected\n" +
      "• PDF has no selectable text (scanned image)\n\n" +
      "Error details:\n" + details
    );
  }
}


function fixPdfLetterSpacing(text){
  // Fix common PDF extraction artifact: letters separated by spaces, e.g. "T u r n" -> "Turn"
  // Only merges when it looks like a "spelled out" word (3+ spaced letters in a row).
  return String(text || "").split("\n").map(line => {
    let s = String(line || "");
    // Merge sequences of spaced letters inside the line
    s = s.replace(/(?:\b[A-Za-z]\s){2,}[A-Za-z]\b/g, (m)=>m.replace(/\s+/g,""));
    // Clean up excessive spaces
    s = s.replace(/[ \t]+\n/g,"\n");
    return s.replace(/[ \t]{2,}/g," ").trimEnd();
  }).join("\n");
}

async function extractTextFromPdfFile(file){
  // ✅ Bulletproof PDF import for Android Chrome + GitHub Pages
  // Strategy:
  // 1) Load PDF.js *legacy* build via <script> (best compatibility).
  // 2) Prefer local ./pdf.min.js (recommended), then fall back to CDNs.
  // 3) Always parse with disableWorker:true (workers often fail on mobile/CDN/SW).
  // 4) Handle password-protected PDFs (prompt).
  //
  // NOTE: For best reliability + offline, add these to your repo root:
  //   - pdf.min.js
  //   - pdf.worker.min.js (optional when disableWorker:true, but nice to have)

  const withTimeout = (p, ms, label) => new Promise((res, rej) => {
    const t = setTimeout(()=>rej(new Error(label + " (timeout)")), ms);
    p.then(v=>{ clearTimeout(t); res(v); }).catch(e=>{ clearTimeout(t); rej(e); });
  });

  const fetchOk = async (url) => {
    // Try a quick HEAD/GET to verify the file exists and isn't returning an HTML error page.
    try{
      const r = await fetch(url, { method:"GET", cache:"no-store" });
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      return !!(r.ok && (ct.includes("javascript") || ct.includes("ecmascript") || ct.includes("text/plain") || ct.includes("application/octet-stream")));
    }catch{
      return false;
    }
  };

  const loadScript = (src) => withTimeout(new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => res(true);
    s.onerror = () => rej(new Error("Failed to load script: " + src));
    document.head.appendChild(s);
  }), 15000, "Failed to load script: " + src);

  async function ensurePdfJs(){
    // ✅ Reliable PDF.js loader for GitHub Pages + Android Chrome/PWA
    // We intentionally prefer the CLASSIC build (pdf.min.js + pdf.worker.min.js)
    // because ESM (pdf.mjs) requires a matching pdf.worker.mjs which most repos don't include.
    if(window.pdfjsLib?.getDocument) return;

    const base = document.baseURI || location.href;
    const stamp = String(Date.now());
    const asUrl = (p)=> new URL(p, base).toString();

    const localClassicCandidates = [
      asUrl("pdf.min.js?v="+stamp),
      asUrl("./pdf.min.js?v="+stamp),
      asUrl("../pdf.min.js?v="+stamp),
      // some users keep it in /lib
      asUrl("lib/pdf.min.js?v="+stamp),
      asUrl("./lib/pdf.min.js?v="+stamp),
    ];

    // CDN fallbacks (classic / legacy builds)
    const cdnClassicCandidates = [
      { js:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.js", worker:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js" },
      { js:"https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.js", worker:"https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.js" },
      { js:"https://unpkg.com/pdfjs-dist@4.10.38/legacy/build/pdf.min.js", worker:"https://unpkg.com/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.js" },
    ];

    const fetchOk = async (url) => {
      try{
        const r = await fetch(url, { method:"GET", cache:"no-store" });
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        return !!(r.ok && (ct.includes("javascript") || ct.includes("ecmascript") || ct.includes("text/plain") || ct.includes("application/octet-stream")));
      }catch{
        return false;
      }
    };

    const loadScript = (src) => withTimeout(new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = () => res(true);
      s.onerror = () => rej(new Error("Failed to load script: " + src));
      document.head.appendChild(s);
    }), 15000, "Failed to load script: " + src);

    async function setWorkerSrc(preferred){
      try{
        const lib = window.pdfjsLib;
        if(!lib) return false;
        if(lib.GlobalWorkerOptions && lib.GlobalWorkerOptions.workerSrc) return true;

        const workerCandidates = [
          // repo root
          asUrl("pdf.worker.min.js?v="+stamp),
          asUrl("./pdf.worker.min.js?v="+stamp),
          asUrl("../pdf.worker.min.js?v="+stamp),
          // /lib folder
          asUrl("lib/pdf.worker.min.js?v="+stamp),
          asUrl("./lib/pdf.worker.min.js?v="+stamp),
          // ESM worker (only if you have it)
          asUrl("pdf.worker.mjs?v="+stamp),
          asUrl("./pdf.worker.mjs?v="+stamp),
          asUrl("lib/pdf.worker.mjs?v="+stamp),
        ];

        for(const u of workerCandidates){
          if(await fetchOk(u)){
            lib.GlobalWorkerOptions = lib.GlobalWorkerOptions || {};
            lib.GlobalWorkerOptions.workerSrc = u;
            return true;
          }
        }

        if(preferred){
          lib.GlobalWorkerOptions = lib.GlobalWorkerOptions || {};
          lib.GlobalWorkerOptions.workerSrc = preferred;
          return true;
        }
      }catch(e){}
      return false;
    }

    // 1) Local classic
    for(const jsUrl of localClassicCandidates){
      const ok = await fetchOk(jsUrl);
      if(!ok) continue;
      try{
        await loadScript(jsUrl);
        if(window.pdfjsLib?.getDocument){
          // ensure workerSrc exists (some builds throw if missing)
          await setWorkerSrc(null);
          return;
        }
      }catch(e){}
    }

    // 2) CDN classic with known worker URL pair
    for(const cdn of cdnClassicCandidates){
      const ok = await fetchOk(cdn.js);
      if(!ok) continue;
      try{
        await loadScript(cdn.js);
        if(window.pdfjsLib?.getDocument){
          await setWorkerSrc(cdn.worker);
          return;
        }
      }catch(e){}
    }

    throw new Error("PDF.js failed to load. Ensure `pdf.min.js` + `pdf.worker.min.js` are present in your repo root (recommended).");
  }
await ensurePdfJs();
  const pdfjsLib = window.pdfjsLib;
  if(!pdfjsLib?.getDocument) throw new Error("pdfjsLib.getDocument missing");

  // Always disable worker (most reliable on mobile/PWA/CDN)
  const ab = await file.arrayBuffer();

  // Support password-protected PDFs
  const loadPdf = (password) => pdfjsLib.getDocument({
    data: ab,
    disableWorker: true,
    password
  }).promise;

  let pdf;
  try{
    pdf = await loadPdf(undefined);
  }catch(err){
    // Password protected
    if(err?.name === "PasswordException"){
      const pw = prompt("This PDF is password-protected. Enter password to import:");
      if(pw == null) throw err; // user cancelled
      pdf = await loadPdf(pw);
    }else{
      throw err;
    }
  }

  let out = [];
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const items = (content.items || []).map(it => ({
      str: String(it.str || ""),
      x: (it.transform && it.transform[4]) ? it.transform[4] : 0,
      y: (it.transform && it.transform[5]) ? it.transform[5] : 0
    })).filter(it => it.str.trim());

    // ---- Better layout reconstruction (keeps chord-over-lyric alignment much better)
    // 1) group into lines by Y
    // 2) within a line, place tokens by X into a fixed-width string
    items.sort((a,b) => (b.y - a.y) || (a.x - b.x));

    const yTol = 3.5; // PDF units; tweakable
    const lines = [];
    let curY = null;
    let cur = [];
    const pushCur = () => {
      if(cur.length) lines.push(cur);
      cur = [];
    };

    for(const it of items){
      if(curY === null){
        curY = it.y;
        cur.push(it);
        continue;
      }
      if(Math.abs(it.y - curY) > yTol){
        pushCur();
        curY = it.y;
      }
      cur.push(it);
    }
    pushCur();

    const median = (arr) => {
      if(!arr.length) return null;
      const a = arr.slice().sort((x,y)=>x-y);
      const mid = Math.floor(a.length/2);
      return (a.length % 2) ? a[mid] : (a[mid-1] + a[mid]) / 2;
    };

    const buildAlignedLine = (lineItems) => {
      const li = lineItems.slice().sort((a,b)=>a.x-b.x);
      if(!li.length) return "";

      const minX = li[0].x;

      // estimate an average "character width" for this line
      const samples = [];
      for(let i=0;i<li.length-1;i++){
        const dx = li[i+1].x - li[i].x;
        const len = Math.max(1, String(li[i].str||"").length);
        if(dx > 1) samples.push(dx / len);
      }
      let charW = median(samples);
      if(!charW || !isFinite(charW)) charW = 4; // fallback
      charW = Math.max(2, Math.min(12, charW));

      let s = "";
      let cursor = 0;
      for(const it of li){
        const col = Math.max(0, Math.round((it.x - minX) / charW));
        if(col > cursor) s += " ".repeat(col - cursor);
        const t = String(it.str || "");
        s += t;
        cursor = col + t.length;
      }
      return s.replace(/\s+$/,"");
    };

    for(const lineItems of lines){
      const s = buildAlignedLine(lineItems).trimEnd();
      if(s) out.push(s);
    }

    if(p !== pdf.numPages) out.push("");
  }

  let txt = out.join("\n").trim();
  txt = fixPdfLetterSpacing(txt);
  return txt;
}


// ----------------------
// ✅ CLIPBOARD IMPORT
// - paste a PDF anywhere (Ctrl+V / iOS paste) -> imports
// - normal text paste continues to work (we do NOT preventDefault)
// ----------------------
function installClipboardImport(){
  document.addEventListener("paste", async (e) => {
    try{
      const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : [];
      if(!items.length) return;

      // Prefer PDF file if present
      for(const it of items){
        const file = it.getAsFile && it.getAsFile();
        if(!file) continue;

        const type = String(file.type || "").toLowerCase();
        const name = String(file.name || "").toLowerCase();
        const isPdf = type === "application/pdf" || name.endsWith(".pdf");
        if(isPdf){
          await importPdfToFull(file);
          return;
        }
      }
    }catch(err){
      console.error(err);
    }
  });
}

/***********************
Recordings UI
***********************/
function fmtDate(ms){
  try{ return new Date(ms).toLocaleString(); }catch{ return String(ms); }
}

async function renderRecordings(){
  let all = [];
  try{
    all = await dbGetAll();
  }catch(e){
    console.warn('Recordings unavailable (IndexedDB blocked or failed):', e);
    if(el.recordingsList){
      el.recordingsList.innerHTML = "";
      const d = document.createElement('div');
      d.style.color = '#666';
      d.style.fontWeight = '900';
      d.textContent = 'Recordings unavailable in this browser session.';
      el.recordingsList.appendChild(d);
    }
    return;
  }
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
   closeNotesModal?.();
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

function notesHtmlToText(src){
  try{
    const root = (src && src.nodeType) ? src.cloneNode(true) : document.createElement("div");
    if(!(src && src.nodeType)) root.innerHTML = String(src || "");
    const out = [];
    const BLOCK = new Set(["DIV","P","LI","UL","OL","BLOCKQUOTE","PRE","H1","H2","H3","H4","H5","H6"]);

    function pushNewline(){
      if(out.length && out[out.length - 1] !== "\n") out.push("\n");
    }

    function walk(node){
      if(!node) return;
      if(node.nodeType === 3){
        out.push(String(node.nodeValue || "").replace(/\u00A0/g, " "));
        return;
      }
      if(node.nodeType !== 1) return;
      const tag = node.tagName;
      if(tag === "BR"){
        out.push("\n");
        return;
      }
      const isBlock = BLOCK.has(tag);
      if(isBlock && out.length && out[out.length - 1] !== "\n") out.push("\n");
      for(const child of Array.from(node.childNodes || [])) walk(child);
      if(isBlock) pushNewline();
    }

    walk(root);
    return normalizeLineBreaks(out.join("")).replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
  }catch{
    return normalizeLineBreaks(String(src?.innerText || src?.textContent || "")).replace(/\u00A0/g, " ");
  }
}

function getNotesEditorText(ed){
  if(!ed) return "";
  return notesHtmlToText(ed);
}

function getCaretCharOffsetInEditor(ed){
  try{
    const sel = window.getSelection?.();
    if(!sel || !sel.rangeCount) return getNotesEditorText(ed).length;
    const range = sel.getRangeAt(0);
    if(!ed.contains(range.endContainer)) return getNotesEditorText(ed).length;
    const pre = range.cloneRange();
    pre.selectNodeContents(ed);
    pre.setEnd(range.endContainer, range.endOffset);
    const wrap = document.createElement("div");
    wrap.appendChild(pre.cloneContents());
    return notesHtmlToText(wrap).length;
  }catch{
    return getNotesEditorText(ed).length;
  }
}

function getSeedFromNotesEditor(ed){
  if(!ed) return "";
  const full = getNotesEditorText(ed);
  const pos = clamp(getCaretCharOffsetInEditor(ed), 0, full.length);
  const before = full.slice(0, pos);
  const lines = normalizeLineBreaks(before).split("\n");
  const curIdx = lines.length - 1;

  for(let i = curIdx - 1; i >= 0; i--){
    const t = String(lines[i] || "").trim();
    if(!t) continue;
    const w = getLastWord(t);
    if(w) return w;
  }
  return getLastWord(before) || "";
}

function getSeedFromTextarea(ta){
  if(!ta) return "";

  if(ta === el.notesEditor || (ta.getAttribute && ta.getAttribute("contenteditable") === "true") || ta.classList?.contains("notesEditor")){
    return getSeedFromNotesEditor(ta);
  }

  // Helper: skip chord-only / chord-input lines in Full view
  function looksLikeChordInputLine(line){
    const s = String(line || "").replace(/\u00A0/g," ").trim();
    if(!s) return false;

    // your break markers / separators
    if(s === BREAK_LINE || s === "_") return true;

    // explicit position-chord format: "1Am 5Dm" / "1E7 5Am"
    if(/^[1-8]\s*[A-Ga-g]/.test(s)) return true;

    const CH = /^[A-G](?:#|b)?(?:maj|min|m|dim|aug|\+|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:maj7|M7|m7|m9|m11|m13|sus2|sus4|add9|add11|add13|dim7|hdim7|m7b5)?(?:b5|#5|b9|#9|b11|#11|b13|#13)?(?:\/[A-G](?:#|b)?)?$/i;

    const toks = s.split(/[\s|,]+/).map(t=>t.trim()).filter(Boolean);
    if(!toks.length) return false;

    let chordish = 0, other = 0;
    for(let t of toks){
      t = t.replace(/^[\[\(\{]+/,"").replace(/[\]\)\}]+$/,"");
      t = t.replace(/♯/g,"#").replace(/♭/g,"b");
      t = t.replace(/[\.,;:]+$/,"");
      t = t.replace(/^\d+/,""); // remove leading position digits (1..8)
      t = t.trim();
      if(!t) continue;

      if(CH.test(t) || /^N\.?C\.?$/i.test(t)) chordish++;
      else other++;
    }

    const total = chordish + other;
    if(chordish === 0) return false;

    // Strongly chord-ish line
    if(other === 0 && chordish >= 1) return true;
    if(chordish >= 2 && (chordish / Math.max(1,total)) >= 0.75 && other <= 1) return true;

    return false;
  }

  // ✅ FULL view: use the previous BAR's last lyric word (skip chord lines)
  // A "bar" in Full view is separated by blank lines. This matches BSP behavior:
  // rhyme target comes from the last lyric line of the previous bar, not the previous line.
  if(ta.classList && (ta.classList.contains("fullBox") || ta.classList.contains("fullSectionText"))){
    let pos;
    // ✅ Use caret captured right before opening the rhyme dock (prevents mobile blur moving caret to end)
    if(typeof ta.__rhymeSelStart === "number" && typeof ta.__rhymeSelTs === "number" && (Date.now() - ta.__rhymeSelTs) < 4000){
      pos = ta.__rhymeSelStart;
    }else{
      // On mobile, opening the rhyme dock can blur the textarea, which makes selectionStart jump to the end.
      // We persist the last known caret position on the textarea itself.
      if(document.activeElement === ta && typeof ta.selectionStart === "number"){
        pos = ta.selectionStart;
        try{ ta.__lastSelStart = pos; }catch{}
      }else if(typeof ta.__lastSelStart === "number"){
        pos = ta.__lastSelStart;
      }else{
        pos = (ta.value || "").length;
      }
    }
    const before = String(ta.value || "").slice(0, pos);
    const lines = normalizeLineBreaks(before).split("\n");
    const curIdx = lines.length - 1;

    // 1) Find the blank-line separator above the current cursor line (start of current bar)
    let sep = -1;
    for(let i = curIdx; i >= 0; i--){
      const t = String(lines[i] || "").replace(/\u00A0/g," ").trim();
      if(t === "") { sep = i; break; }
    }

    // 2) Previous bar ends just above that separator (skip any extra blanks)
    let prevEnd = (sep >= 0) ? sep - 1 : curIdx - 1;
    while(prevEnd >= 0 && String(lines[prevEnd]||"").trim() === "") prevEnd--;

    // 3) Walk upward within the previous bar and pick the LAST eligible lyric line
    //    (closest to the end of the bar), skipping headings/breaks/chord-only lines.
    for(let i = prevEnd; i >= 0; i--){
      const raw = String(lines[i] || "");
      const t = raw.trim();
      if(!t){
        // stop at bar boundary
        break;
      }

      if(isSectionHeadingLine(t)) continue;
      if(t === BREAK_LINE || t === "_") continue;
      if(looksLikeChordInputLine(t)) continue;

      const w = getLastWord(t);
      if(w) return w;
    }

    // 4) Fallback: previous eligible lyric line anywhere above (older behavior)
    for(let i = curIdx - 1; i >= 0; i--){
      const raw = String(lines[i] || "");
      const t = raw.trim();
      if(!t) continue;
      if(isSectionHeadingLine(t)) continue;
      if(t === BREAK_LINE || t === "_") continue;
      if(looksLikeChordInputLine(t)) continue;
      const w = getLastWord(t);
      if(w) return w;
    }

    // final fallback: last word before cursor
    return getLastWord(before) || "";
  }

  // CARD view: prefer previous card's last word, else current last word
  const card = ta.closest(".card");
  if(card){
    const root = el.sheetInner || el.sheetBody;
    const allCards = root ? Array.from(root.querySelectorAll(".card")) : [];
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

function insertWordIntoNotes(word){
  if(!state.notesOpen || !el.notesEditor) return false;
  const insertWord = String(word || "").trim();
  if(!insertWord) return false;

  try{ restoreNotesSelection(); }catch{}

  let sel = null;
  let range = null;
  try{
    sel = window.getSelection?.();
    if(sel && sel.rangeCount) range = sel.getRangeAt(0);
    if(range && !el.notesEditor.contains(range.commonAncestorContainer)) range = null;
  }catch{}

  if(!range && state.notesLastRange){
    try{
      range = state.notesLastRange.cloneRange ? state.notesLastRange.cloneRange() : state.notesLastRange;
      if(!el.notesEditor.contains(range.commonAncestorContainer)) range = null;
    }catch{ range = null; }
  }

  if(!range){
    placeCaretAtEnd(el.notesEditor);
    try{
      sel = window.getSelection?.();
      if(sel && sel.rangeCount) range = sel.getRangeAt(0);
    }catch{}
  }
  if(!range) return false;

  let beforeChar = "";
  let afterChar = "";
  try{
    const probeBefore = range.cloneRange();
    probeBefore.collapse(true);
    if(probeBefore.startContainer.nodeType === Node.TEXT_NODE){
      const t = probeBefore.startContainer.nodeValue || "";
      const o = probeBefore.startOffset;
      beforeChar = t.slice(Math.max(0, o - 1), o);
      afterChar = t.slice(o, o + 1);
    }
  }catch{}

  const insertText = `${beforeChar && !/\s/.test(beforeChar) ? " " : ""}${insertWord}${(!afterChar || !/\s/.test(afterChar)) ? " " : ""}`;

  try{
    range.deleteContents();
    const node = document.createTextNode(insertText);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel = window.getSelection?.();
    if(sel){
      sel.removeAllRanges();
      sel.addRange(range);
    }
    state.notesLastRange = range.cloneRange ? range.cloneRange() : range;
    applyNotesEditorDefaults();
    saveNotesDoc();
    pushNotesHistorySnapshot();
    el.notesEditor.focus({ preventScroll:true });
    return true;
  }catch{
    try{
      restoreNotesSelection();
      if(document.queryCommandSupported && document.queryCommandSupported('insertText')){
        document.execCommand('insertText', false, insertText);
        cacheNotesSelection();
        applyNotesEditorDefaults();
        saveNotesDoc();
        pushNotesHistorySnapshot();
        return true;
      }
    }catch{}
    return false;
  }
}

function insertWordIntoLyrics(word){
  const active = document.activeElement;

  // When Notes is open, rhyme chip taps should always target Notes.
  // If we lost the live selection, insertWordIntoNotes() will restore the
  // stored range or fall back to the end of the Notes editor.
  const useNotesEditor = !!(el.notesEditor && state.notesOpen);
  if(useNotesEditor){
    insertWordIntoNotes(word);
    return;
  }

  // ✅ Use the currently active textarea if it’s lyrics or fullBox
  if(active && active.tagName === "TEXTAREA" && (active.classList.contains("lyrics") || active.classList.contains("fullBox") || active.classList.contains("fullSectionText"))){
    lastLyricsTextarea = active;
  }

  if(!lastLyricsTextarea){
const root = el.sheetInner || el.sheetBody;
const first = root ? (root.querySelector("textarea.lyrics") || root.querySelector("textarea.fullBox")) : null; 
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

  // ✅ allow horizontal swipe for suggestions
  try{
    el.rhymeWords.style.display = "flex";
    el.rhymeWords.style.flexWrap = "nowrap";
    el.rhymeWords.style.gap = "10px";
    el.rhymeWords.style.overflowX = "auto";
    el.rhymeWords.style.overflowY = "hidden";
    el.rhymeWords.style.webkitOverflowScrolling = "touch";
    el.rhymeWords.style.scrollBehavior = "smooth";
    el.rhymeWords.style.paddingBottom = "6px";
  }catch{}

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
    b.style.flex = "0 0 auto";
    b.style.whiteSpace = "nowrap";
    b.textContent = w;

    const MOVE_PX = 12;
    const markStart = (x, y) => {
      b.__dragStartX = Number.isFinite(x) ? x : 0;
      b.__dragStartY = Number.isFinite(y) ? y : 0;
      b.__dragMoved = false;
      b.__pressTs = Date.now();
      if(state.notesOpen && el.notesEditor){
        cacheNotesSelection();
      }
    };
    const markMove = (x, y) => {
      if(!Number.isFinite(x) || !Number.isFinite(y)) return;
      if(!Number.isFinite(b.__dragStartX) || !Number.isFinite(b.__dragStartY)) return;
      if(Math.abs(x - b.__dragStartX) > MOVE_PX || Math.abs(y - b.__dragStartY) > MOVE_PX){
        b.__dragMoved = true;
      }
    };
    const shouldInsertFromTap = () => {
      if(b.__dragMoved) return false;
      const age = Date.now() - (b.__pressTs || 0);
      if(age > 1200) return false;
      const nowTs = Date.now();
      if(b.__lastInsertTs && (nowTs - b.__lastInsertTs) < 500) return false;
      b.__lastInsertTs = nowTs;
      return true;
    };
    const insertFromChip = (e) => {
      if(e){
        e.preventDefault();
        e.stopPropagation();
      }
      if(!shouldInsertFromTap()) return;
      insertWordIntoLyrics(w);
    };

    b.addEventListener("pointerdown", (e) => {
      markStart(e.clientX, e.clientY);
    });
    b.addEventListener("pointermove", (e) => {
      markMove(e.clientX, e.clientY);
    });
    b.addEventListener("pointerup", insertFromChip, {passive:false});
    b.addEventListener("pointercancel", () => {
      b.__dragMoved = true;
    });

    b.addEventListener("mousedown", (e) => {
      markStart(e.clientX, e.clientY);
    });

    b.addEventListener("touchstart", (e) => {
      const t = e.touches && e.touches[0];
      markStart(t ? t.clientX : NaN, t ? t.clientY : NaN);
    }, {passive:true});
    b.addEventListener("touchmove", (e) => {
      const t = e.touches && e.touches[0];
      markMove(t ? t.clientX : NaN, t ? t.clientY : NaN);
    }, {passive:true});
    b.addEventListener("touchend", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      markMove(t ? t.clientX : NaN, t ? t.clientY : NaN);
      insertFromChip(e);
    }, {passive:false});
    b.addEventListener("touchcancel", () => {
      b.__dragMoved = true;
    });

    b.addEventListener("click", (e) => {
      // Click is just a desktop / fallback path. If pointer/touch already handled it,
      // swallow the synthetic click so chips stay scrollable without double inserts.
      const sinceInsert = Date.now() - (b.__lastInsertTs || 0);
      if(sinceInsert < 700 || b.__dragMoved){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      insertFromChip(e);
    });

    el.rhymeWords.appendChild(b);
  });
}

function getBestRhymeTextarea(){
  // Prefer the actually-focused textarea or notes editor (mobile can keep focus while dock is open)
  const a = document.activeElement;
  if(a && a.tagName === "TEXTAREA" && (a.classList.contains("lyrics") || a.classList.contains("fullBox") || a.classList.contains("fullSectionText"))){
    return a;
  }
  if(a && a === el.notesEditor) return a;

  if(state.notesOpen && el.notesEditor) return el.notesEditor;

  // If Full view textarea exists and is on screen, prefer it
  const full = document.querySelector("textarea.fullBox");
  if(full){
    const r = full.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
    if(visible) return full;
  }

  // Fallback to last tracked textarea (card or full)
  if(lastLyricsTextarea && document.contains(lastLyricsTextarea)) return lastLyricsTextarea;

  return full || null;
}

function refreshRhymesFromActive(){
  if(el.rhymeDock.style.display !== "block") return;
  const ta = getBestRhymeTextarea();
  const seed = getSeedFromTextarea(ta);
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
  if(state.notesOpen) renderNotesFromProject();
    ensureCapoStepToggle();
    injectHeaderControlTightStyle();
}


/***********************
PROJECT NOTES
***********************/

function normalizeNotesHtml(html){
  const s = String(html || "").replace(/&nbsp;/g, " ").trim();
  return s === "<br>" ? "" : s;
}

const NOTES_RHYME_MARKER_ATTR = "data-notes-rhyme-marker";

function stripNotesRhymeMarkers(html){
  let s = String(html || "");
  s = s.replace(new RegExp(`<span[^>]*${NOTES_RHYME_MARKER_ATTR}=["']1["'][^>]*>\u200B?<\/span>`, "gi"), "");
  s = s.replace(new RegExp(`<span[^>]*${NOTES_RHYME_MARKER_ATTR}=["']1["'][^>]*><\/span>`, "gi"), "");
  s = s.replace(/​/g, "");
  return s;
}

function clearNotesRhymeMarker(){
  // marker-based caret tracking caused mobile keyboard/selection issues in Notes.
  // Keep this as a no-op for backward compatibility.
}

function placeNotesRhymeMarker(){
  // Use stored Range tracking instead of injecting marker spans.
  cacheNotesSelection();
  return !!state.notesLastRange;
}

function currentNotesHtml(){
  return normalizeNotesHtml(stripNotesRhymeMarkers(el?.notesEditor?.innerHTML || ""));
}

function resetNotesHistory(html=""){
  const snap = normalizeNotesHtml(html);
  state.notesHistory = [snap];
  state.notesHistoryIndex = 0;
}

function pushNotesHistorySnapshot(force=false){
  if(!el.notesEditor || state.notesApplyingHistory) return;
  const snap = currentNotesHtml();
  const cur = state.notesHistory[state.notesHistoryIndex] ?? "";
  if(!force && snap === cur) return;
  if(state.notesHistoryIndex < state.notesHistory.length - 1){
    state.notesHistory = state.notesHistory.slice(0, state.notesHistoryIndex + 1);
  }
  state.notesHistory.push(snap);
  if(state.notesHistory.length > 100) state.notesHistory.shift();
  state.notesHistoryIndex = state.notesHistory.length - 1;
}

function applyNotesHistoryAt(index){
  if(!el.notesEditor) return;
  const snap = normalizeNotesHtml(state.notesHistory[index] ?? "");
  state.notesApplyingHistory = true;
  el.notesEditor.innerHTML = snap;
  applyNotesEditorDefaults();
  state.notesApplyingHistory = false;
  state.notesHistoryIndex = index;
  placeCaretAtEnd(el.notesEditor);
  saveNotesDoc();
}

function notesUndo(){
  if(state.notesHistoryIndex <= 0) return;
  applyNotesHistoryAt(state.notesHistoryIndex - 1);
}

function notesRedo(){
  if(state.notesHistoryIndex >= state.notesHistory.length - 1) return;
  applyNotesHistoryAt(state.notesHistoryIndex + 1);
}

function applyNotesEditorDefaults(){
  if(!el.notesEditor || !state.project) return;
  const color = state.project.notesColor || state.notesDefaultColor || "#151515";
  el.notesEditor.style.color = color;
  if(el.notesTextColor) el.notesTextColor.value = color;
}

function sanitizeNotesHtml(html){
  let s = stripNotesRhymeMarkers(String(html || ""));
  if(!s.trim()) return "";
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/ on\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return s;
}

function getNotesDoc(){
  return normalizeNotesHtml(sanitizeNotesHtml(state?.project?.notesDoc || ""));
}

function saveNotesDoc(){
  if(!state.project || !el.notesEditor) return;
  state.project.notesDoc = normalizeNotesHtml(sanitizeNotesHtml(el.notesEditor.innerHTML));
  if(!state.project.notesColor) state.project.notesColor = state.notesDefaultColor || "#151515";
  upsertProject(state.project);
}

function placeCaretAtEnd(node){
  try{
    const sel = window.getSelection?.();
    if(!sel || !node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    state.notesLastRange = range.cloneRange();
  }catch{}
}

function cacheNotesSelection(){
  try{
    if(!el.notesEditor) return;
    const sel = window.getSelection?.();
    if(!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if(el.notesEditor.contains(range.commonAncestorContainer)){
      state.notesLastRange = range.cloneRange();
    }
  }catch{}
}

function syncNotesCaretMarker(){
  try{
    if(!state.notesOpen || !el.notesEditor) return;
    cacheNotesSelection();
  }catch{}
}

function restoreNotesSelection(){
  try{
    if(!el.notesEditor) return false;
    el.notesEditor.focus({ preventScroll:true });
    const sel = window.getSelection?.();
    if(!sel) return false;
    if(state.notesLastRange){
      sel.removeAllRanges();
      sel.addRange(state.notesLastRange.cloneRange ? state.notesLastRange.cloneRange() : state.notesLastRange);
      return true;
    }
    placeCaretAtEnd(el.notesEditor);
    return true;
  }catch{
    return false;
  }
}

function normalizeExecCommandMarkup(){
  if(!el.notesEditor) return;
  const fonts = el.notesEditor.querySelectorAll('font[size]');
  const map = { '1':'10px', '2':'13px', '3':'16px', '4':'18px', '5':'24px', '6':'32px', '7':'48px' };
  fonts.forEach((font) => {
    const span = document.createElement('span');
    span.style.fontSize = map[font.getAttribute('size')] || '18px';
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
}

function applyNotesFontSize(px){
  if(!el.notesEditor) return;
  restoreNotesSelection();
  const sel = window.getSelection?.();
  if(!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  if(range.collapsed){
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '4');
    normalizeExecCommandMarkup();
    const spans = el.notesEditor.querySelectorAll('span');
    const last = spans[spans.length - 1];
    if(last) last.style.fontSize = `${px}px`;
  }else{
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    try{
      range.surroundContents(span);
    }catch{
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    placeCaretAtEnd(span);
  }

  cacheNotesSelection();
  saveNotesDoc();
  pushNotesHistorySnapshot();
}

function applyNotesColor(color){
  if(!el.notesEditor || !state.project) return;
  const use = color || "#151515";
  state.project.notesColor = use;
  state.notesDefaultColor = use;
  applyNotesEditorDefaults();
  restoreNotesSelection();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('foreColor', false, use);
  cacheNotesSelection();
  saveNotesDoc();
  pushNotesHistorySnapshot();
}

function execNotesCommand(cmd){
  restoreNotesSelection();
  document.execCommand(cmd, false, null);
  normalizeExecCommandMarkup();
  applyNotesEditorDefaults();
  cacheNotesSelection();
  saveNotesDoc();
  pushNotesHistorySnapshot();
}

function renderNotesFromProject(){
  if(!el.notesEditor) return;
  el.notesEditor.innerHTML = getNotesDoc();
  applyNotesEditorDefaults();
}

function openNotesModal(){
  if(!el.notesModal || !el.notesEditor) return;
  state.notesOpen = true;
  renderNotesFromProject();
  resetNotesHistory(getNotesDoc());
  el.notesModal.classList.add('show');
  el.notesModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  try{ toggleRhymeDock?.(false); }catch{}
  setTimeout(() => {
    applyNotesEditorDefaults();
    el.notesEditor.focus({ preventScroll:true });
    if(!getNotesDoc()) placeCaretAtEnd(el.notesEditor);
  }, 30);
}

function closeNotesModal(){
  if(!el.notesModal) return;
  clearNotesRhymeMarker();
  saveNotesDoc();
  state.notesOpen = false;
  el.notesModal.classList.remove('show');
  el.notesModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  try{ toggleRhymeDock(false); }catch{}
}

/***********************
SECTION paging (swipe left/right)
+ Dynamic EXTRA pages
***********************/
const BASE_SECTION_ORDER = SECTIONS.slice(); // stable base, includes "Full" first

function ensurePageMeta(){
  if(!state.project) return;
  if(!Array.isArray(state.project.enabledSections)) state.project.enabledSections = [];
  if(!state.project.sectionTitles || typeof state.project.sectionTitles !== "object") state.project.sectionTitles = {};
  if(!Array.isArray(state.project.extraSections)) state.project.extraSections = []; // ✅ NEW
  if(!Array.isArray(state.project.deletedBaseSections)) state.project.deletedBaseSections = []; // ✅ NEW
}

// ✅ Full order = base order + extras appended (extras are project-specific)
function getAllSectionOrder(){
  ensurePageMeta();
  const extras = (state.project.extraSections || []).filter(Boolean);
  // Keep "Full" first, then base sections, then extras
  return [...BASE_SECTION_ORDER, ...extras.filter(x => x !== "Full" && !BASE_SECTION_ORDER.includes(x))];
}

function nextExtraSectionName(){
  ensurePageMeta();
  const used = new Set([...(state.project.extraSections || [])]);
  let n = 1;
  while(used.has(`EXTRA ${n}`)) n++;
  return `EXTRA ${n}`;
}

function _normTitleKey(t){
  return String(t||"").trim().toUpperCase().replace(/\s+/g," ");
}

// Create or reuse an EXTRA page for a heading title like "OUTRO" or "VERSE 4"
function getOrCreateExtraSectionForTitle(title){
  if(!state.project) return null;
  ensurePageMeta();

  const want = _normTitleKey(title);
  if(!want) return null;

  // 1) reuse existing extra with same stored title
  try{
    const titles = state.project.sectionTitles || {};
    for(const sec of (state.project.extraSections || [])){
      const v = titles[sec];
      if(v && _normTitleKey(v) === want) return sec;
    }
  }catch{}

  // 2) create a new extra
  const sec = nextExtraSectionName();
  if(!state.project.sections) state.project.sections = {};
  if(!Array.isArray(state.project.sections[sec])) state.project.sections[sec] = [newLine()];
  if(!state.project.extraSections.includes(sec)) state.project.extraSections.push(sec);
  if(!state.project.sectionTitles) state.project.sectionTitles = {};
  state.project.sectionTitles[sec] = String(title||"").trim();

  // show it (even if currently blank) - but it will have content soon
  if(!state.project.enabledSections.includes(sec)) state.project.enabledSections.push(sec);

  return sec;
}



function createExtraSection(opts={}){
  if(!state.project) return null;
  ensurePageMeta();

  // default behavior: if the user adds a page via +, it should appear immediately.
  // But when extras are created implicitly during parsing, we can keep them hidden
  // unless they end up with content.
  const shouldEnable = (typeof opts.enable === "boolean") ? opts.enable : true;

  const sec = nextExtraSectionName();

  if(!state.project.sections) state.project.sections = {};
  if(!Array.isArray(state.project.sections[sec])) state.project.sections[sec] = [newLine()];

  // Visible even if blank (because user added it)
  if(shouldEnable && !state.project.enabledSections.includes(sec)) state.project.enabledSections.push(sec);

  // Persist the page in the project’s dynamic list
  if(!state.project.extraSections.includes(sec)) state.project.extraSections.push(sec);

  return sec;
}

function lineHasAnyContent(line){
  if(!line) return false;
  const lyr = String(line.lyrics || "").trim();
  const notes = Array.isArray(line.notes) ? line.notes.join("").trim() : "";
  const beats = Array.isArray(line.beats) ? line.beats.join("").trim() : "";
  return !!(lyr || notes || beats);
}

function sectionHasAnyContent(sec){
  if(!state.project) return false;
  const arr = (state.project.sections && state.project.sections[sec]) ? state.project.sections[sec] : [];
  for(const line of arr){
    if(lineHasAnyContent(line)) return true;
  }
  return false;
}

function isSectionVisible(sec){
  if(sec === "Full") return true;
  ensurePageMeta();
  if(sectionHasAnyContent(sec)) return true;              // appears when content exists
  return state.project.enabledSections.includes(sec);     // or when user added via +
}

function getVisibleSectionPages(){
  ensurePageMeta();
  const pages = ["Full"];
  for(const sec of getAllSectionOrder()){
    if(sec === "Full") continue;
    if(isSectionVisible(sec)) pages.push(sec);
  }
  return pages.length ? pages : ["Full"];
}

function findNextSectionToEnable(fromSec){
  // ✅ Sequential add (NO wrap):
  // - Adds the NEXT hidden base page AFTER fromSec (in base order)
  // - If that next base page was manually deleted (and still has no content),
  //   create an EXTRA page instead.
  // - If there is no remaining hidden base page ahead, create an EXTRA page.

  const base = BASE_SECTION_ORDER.filter(s => s !== "Full");
  const curIdx = Math.max(0, base.indexOf(fromSec));

  for(let i = curIdx + 1; i < base.length; i++){
    const sec = base[i];

    // already visible? keep looking forward
    if(isSectionVisible(sec)) continue;

    const deleted = (state.project?.deletedBaseSections || []).includes(sec);
    if(deleted && !sectionHasAnyContent(sec)){
      return "__CREATE_EXTRA__";
    }
    return sec;
  }

  return "__CREATE_EXTRA__";
}


function enableSection(sec){
  if(!state.project) return;
  ensurePageMeta();
  if(!sec || sec === "Full") return;

  // allow base pages and extras
  const isBase = BASE_SECTION_ORDER.includes(sec);
  const isExtra = (state.project.extraSections || []).includes(sec);

  if(!isBase && !isExtra) return;

  // ✅ Don't resurrect a manually-deleted BASE page via "+" unless it has content.
  if(isBase){
    const deleted = (state.project.deletedBaseSections || []).includes(sec);
    if(deleted && !sectionHasAnyContent(sec)) return;
  }

  if(!state.project.sections) state.project.sections = {};
  if(!Array.isArray(state.project.sections[sec])) state.project.sections[sec] = [newLine()];
  if(!state.project.enabledSections.includes(sec)) state.project.enabledSections.push(sec);
}
function deleteSectionPage(sec){
  if(!state.project) return;
  ensurePageMeta();
  if(!sec || sec === "Full") return;

  const isBase = BASE_SECTION_ORDER.includes(sec);

  // clear its cards
  if(!state.project.sections) state.project.sections = {};
  state.project.sections[sec] = [newLine()];

  // remove title
  try{ delete state.project.sectionTitles[sec]; }catch{}

  if(isBase){
    // Base pages always remain (we just clear them)
    return;
  }

  // EXTRA pages: remove the page itself
  state.project.enabledSections = (state.project.enabledSections || []).filter(x => x !== sec);
  state.project.extraSections = (state.project.extraSections || []).filter(x => x !== sec);
}




function isEditableEl(target){
  if(!target) return false;
  const tag = (target.tagName || "").toUpperCase();
  if(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return true;
  if(target.isContentEditable) return true;
  return false;
}

function goToSection(sec){
  if(!sec || sec === state.currentSection) return;
  // ✅ close rhyme dock when changing pages
  try{ if(typeof toggleRhymeDock==='function') toggleRhymeDock(false); }catch{}
  // prevent landing on a hidden/unused page
  if(sec !== "Full" && !isSectionVisible(sec)) sec = "Full";

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
  const pages = getVisibleSectionPages();
  const i = pages.indexOf(state.currentSection);
  const next = pages[(i + 1) % pages.length];
  goToSection(next);
}

function prevSection(){
  const pages = getVisibleSectionPages();
  const i = pages.indexOf(state.currentSection);
  const prev = pages[(i - 1 + pages.length) % pages.length];
  goToSection(prev);
}

/***********************
Swipe detection (horizontal)
***********************/
function installSectionSwipe(){
  let sx=0, sy=0, t0=0, tracking=false, locked=false;
  let lastFire = 0;
  let startedOnEditable = false;

  const MIN_X = 60;
  const MAX_MS = 800;
  const DOMINANCE = 1.35;

  function onStart(e){
    // ✅ Allow page-swipe even when rhyme dock is open.
    // If the swipe starts on the rhyme chips scroller, let it scroll instead of page-switching.
    if(el.rhymeDock && el.rhymeDock.style.display === "block"){
      const target0 = e.target;
      if(target0 && target0.closest && (target0.closest("#rhymeWords") || target0.closest(".rhymeWords"))){
        return;
      }
    }

    const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const target = e.target;

    // don’t page-switch when starting inside the panel
    if(target && target.closest && target.closest("#panelBody")) return;

    // ✅ Allow starting a swipe on textboxes (lyrics/beat/note inputs).
    // We only "take over" if the gesture is clearly horizontal.
    startedOnEditable = !!isEditableEl(target);

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

    // If the user started on a textarea/input and the gesture is locked horizontal,
    // prevent the element from capturing the touch (so the page swipe works everywhere).
    if(locked && startedOnEditable){
      try{ e.preventDefault(); }catch{}
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

  // ✅ Bind swipe to the LOWER panel so it feels consistent.
  // (Fallback to document if the element isn't present.)
  const root = el.sheetBody || document;

  root.addEventListener("touchstart", onStart, { passive:true });
  // passive:false so we can preventDefault when a horizontal swipe starts on textboxes
  root.addEventListener("touchmove", onMove, { passive:false });
  root.addEventListener("touchend", onEnd, { passive:true });

  root.addEventListener("pointerdown", onStart, { passive:true });
  root.addEventListener("pointermove", onMove, { passive:true });
  root.addEventListener("pointerup", onEnd, { passive:true });

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
  // Guard: if any required element is missing in index.html, don't hard-crash the whole app.
  if(el.togglePanelBtn && el.panelBody){
    el.togglePanelBtn.addEventListener("click", () => {
      const hidden = !el.panelBody.classList.contains("hidden");
      setPanelHidden(hidden);
    });
  }

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
    el.exportBtn.addEventListener("click", (e)=>{ try{ e.preventDefault(); e.stopPropagation(); }catch{} exportFullPreview(); });
  }

  if(el.notesBtn) el.notesBtn.addEventListener("click", () => {
    if(state.notesOpen) closeNotesModal();
    else openNotesModal();
  });

  if(el.notesCloseBtn) el.notesCloseBtn.addEventListener("click", closeNotesModal);

  if(el.notesEditor){
    ["keyup","mouseup","touchend","focus","click","keydown","beforeinput"].forEach(evt => {
      el.notesEditor.addEventListener(evt, () => {
        syncNotesCaretMarker();
      });
    });
    el.notesEditor.addEventListener("input", () => {
      applyNotesEditorDefaults();
      syncNotesCaretMarker();
      saveNotesDoc();
      pushNotesHistorySnapshot();
    });
    el.notesEditor.addEventListener("blur", () => {
      cacheNotesSelection();
      saveNotesDoc();
    });
  }

  if(el.notesUndoBtn) el.notesUndoBtn.addEventListener("click", notesUndo);
  if(el.notesRedoBtn) el.notesRedoBtn.addEventListener("click", notesRedo);

  if(el.notesToolbar){
    el.notesToolbar.querySelectorAll("[data-cmd]").forEach(btn => {
      btn.addEventListener("click", () => execNotesCommand(btn.getAttribute("data-cmd")));
    });
  }

  if(el.notesFontSize){
    el.notesFontSize.addEventListener("change", () => applyNotesFontSize(parseInt(el.notesFontSize.value, 10) || 18));
  }

  if(el.notesTextColor){
    el.notesTextColor.addEventListener("input", () => applyNotesColor(el.notesTextColor.value || "#151515"));
  }

  document.addEventListener("selectionchange", () => {
    if(state.notesOpen) syncNotesCaretMarker();
  });

  function restartClockIfRunning(){
    if(shouldClockRun()){
      startBeatClock();
    }
  }

  // ===== BPM =====
  function commitBpm(){
    if(!el.bpmInput) return;
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

  if(el.bpmInput) el.bpmInput.addEventListener("input", () => {
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

  if(el.bpmInput){
    el.bpmInput.addEventListener("change", commitBpm);
    el.bpmInput.addEventListener("blur", commitBpm);
  }

  // ===== CAPO (legacy; kept for compatibility) =====
  function commitCapo(){
    if(!el.capoInput) return;
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

 if(el.capoInput) el.capoInput.addEventListener("input", () => {
   
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

  if(el.capoInput){
    el.capoInput.addEventListener("change", commitCapo);
    el.capoInput.addEventListener("blur", commitCapo);
  }

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

  if(el.instAcoustic) el.instAcoustic.addEventListener("click", () => handleInstrument("acoustic"));
  if(el.instElectric) el.instElectric.addEventListener("click", () => handleInstrument("electric"));
  if(el.instPiano) el.instPiano.addEventListener("click", () => handleInstrument("piano"));

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

  if(el.drumRock) el.drumRock.addEventListener("click", () => handleDrums("rock"));
  if(el.drumHardRock) el.drumHardRock.addEventListener("click", () => handleDrums("hardrock"));
  if(el.drumPop) el.drumPop.addEventListener("click", () => handleDrums("pop"));
  if(el.drumRap) el.drumRap.addEventListener("click", () => handleDrums("rap"));

  if(el.mRock) el.mRock.addEventListener("click", () => handleDrums("rock"));
  if(el.mHardRock) el.mHardRock.addEventListener("click", () => handleDrums("hardrock"));
  if(el.mPop) el.mPop.addEventListener("click", () => handleDrums("pop"));
  if(el.mRap) el.mRap.addEventListener("click", () => handleDrums("rap"));

  if(el.autoPlayBtn) el.autoPlayBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));
  if(el.mScrollBtn) el.mScrollBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));

  if(el.recordBtn) el.recordBtn.addEventListener("click", toggleRecording);
  if(el.mRecordBtn) el.mRecordBtn.addEventListener("click", toggleRecording);

  if(el.sortSelect) el.sortSelect.addEventListener("change", renderProjectsDropdown);
  if(el.projectSelect) el.projectSelect.addEventListener("change", () => loadProjectById(el.projectSelect.value));

  if(el.newProjectBtn) el.newProjectBtn.addEventListener("click", () => {
    const name = prompt("New project name:", "New Song");
    if(name === null) return;
    const p = defaultProject(name.trim() || "New Song");
    upsertProject(p);
    closeNotesModal?.();
    state.project = p;
    state.currentSection = "Full";
    applyProjectSettingsToUI();
    renderAll();
  });

  if(el.renameProjectBtn) el.renameProjectBtn.addEventListener("click", () => {
    if(!state.project) return;
    const name = prompt("Project name:", state.project.name || "");
    if(name === null) return;
    state.project.name = name.trim() || "Untitled";
    upsertProject(state.project);
    renderProjectsDropdown();
  });

  if(el.deleteProjectBtn) el.deleteProjectBtn.addEventListener("click", () => {
    if(!state.project) return;
    if(!confirm(`Delete project "${state.project.name}"?`)) return;
    deleteProjectById(state.project.id);
    closeNotesModal?.();
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
  // ✅ Capture caret BEFORE button click steals focus (mobile)
  if(el.rBtn){
    const cap = () => _captureRhymeCaret();
    el.rBtn.addEventListener("pointerdown", cap, {passive:true});
    el.rBtn.addEventListener("touchstart", cap, {passive:true});
    el.rBtn.addEventListener("mousedown", cap, {passive:true});

    el.rBtn.addEventListener("click", () => {
      const showing = (el.rhymeDock && el.rhymeDock.style.display === "block");
      toggleRhymeDock(!showing);
    });
  }

  if(el.hideRhymeBtn) el.hideRhymeBtn.addEventListener("click", () => toggleRhymeDock(false));

  // ✅ When rhyme dock is open, allow swipe/drag inside the rhyme words row without triggering page swipe.
  if(el.rhymeWords){
    const stop = (e) => {
      // only stop when dock is visible
      if(el.rhymeDock && el.rhymeDock.style.display === "block"){
        e.stopPropagation();
      }
    };
    el.rhymeWords.addEventListener('touchstart', stop, {passive:true});
    el.rhymeWords.addEventListener('touchmove', stop, {passive:true});
    el.rhymeWords.addEventListener('pointerdown', stop, {passive:true});
    el.rhymeWords.addEventListener('wheel', stop, {passive:true});
  }
}

/***********************
Init
***********************/
async function init(){
  // Yield once so the browser paints before we do any heavy work (prevents “frozen” feel)
  await nextFrame();

  state.project = getCurrentProject();

  // Style injections are cheap, but do them after first paint
  injectBspCardLook();
  injectHeaderMiniIconBtnStyle();

  applyProjectSettingsToUI();

  setPanelHidden(false);
  setAutoScroll(false);

  state.instrumentOn = false;
  state.drumsOn = false;

  renderNoteLenUI();
  setRecordUI();

  // Wiring can be a little heavy (many listeners) — yield between stages
  await nextTick();
  wire();
  await nextTick();
  installClipboardImport();

  // Render in chunks to avoid blocking the UI thread on mobile
  await nextTick();
  renderProjectsDropdown();
  await nextTick();
  renderTabs();
  await nextTick();
  renderSheet();
  await nextTick();
  renderRecordings();
  await nextTick();
  renderInstrumentUI();
  await nextTick();
  renderDrumUI();
  await nextTick();
  updateKeyFromAllNotes();
  await nextTick();
  setRecordUI();

  // Tick visuals + misc
  clearTick();
  applyTick();
  updateFullIfVisible();
  refreshRhymesFromActive();
  refreshDisplayedNoteCells();
  updateAudioButtonsUI();

  // These are “nice to have” UI tweaks — keep them at the end
  ensureCapoStepToggle();
  injectHeaderControlTightStyle();

  pushHistory("init"); // seed the first snapshot
  updateUndoRedoUI();
  installSectionSwipe();

  stopBeatClock();
}

function showBootError(err){
  console.error("SRP init crash", err);
  try{
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    // Try to show in the UI so you don't get a blank freeze
    const hint = document.getElementById("sheetHint");
    if(hint) hint.textContent = "⚠️ Startup error (see console): " + msg.split("\\n")[0];
    const inner = document.getElementById("sheetInner");
    if(inner && !inner.innerHTML.trim()){
      inner.innerHTML = `
        <div style="padding:16px;">
          <div style="font-weight:1200; margin-bottom:8px;">Song Rider Pro failed to start</div>
          <div style="color:#555; font-weight:900; margin-bottom:10px;">
            Open DevTools → Console and look for <span style="font-family:monospace;">SRP init crash</span>.
          </div>
          <pre style="white-space:pre-wrap; word-break:break-word; background:#f6f6f7; border:1px solid rgba(0,0,0,.12); padding:12px; border-radius:12px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px;">${msg}</pre>
        </div>`;
    }
    // Also a quick alert for mobile where console is hard to reach
    try{ alert("Song Rider Pro failed to start.\n\n" + msg.split("\\n")[0]); }catch{}
  }catch{}
}

// IMPORTANT: async errors won't be caught by try/catch unless we handle the Promise.
init().catch(showBootError);
/***********************
KEEP RHYME BOX ABOVE KEYBOARD
***********************/
if (window.visualViewport) {

  const dock = document.getElementById("rhymeDock");

  const updateDock = () => {
    if(!dock) return;

    const vv = window.visualViewport;

// how much of the bottom of the layout viewport is covered (keyboard)
const overlap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));

dock.style.transform = `translateY(-${overlap}px)`;
  };

  visualViewport.addEventListener("resize", updateDock);
  visualViewport.addEventListener("scroll", updateDock);

  updateDock();
}
})();
