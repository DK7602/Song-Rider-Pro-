/* Song Rider Pro - app.js (FULL REPLACE v14) */
(() => {
"use strict";

/* -----------------------------
   DOM
------------------------------*/
const $ = (id) => document.getElementById(id);

const tabsEl = $("tabs");
const sheetTitleEl = $("sheetTitle");
const sheetBodyEl = $("sheetBody");

const togglePanelBtn = $("togglePanelBtn");
const panelBody = $("panelBody");
const miniBar = $("miniBar");

const autoSplitBtn = $("autoSplitBtn");
const bpmInput = $("bpmInput");
const capoInput = $("capoInput");
const keyOutput = $("keyOutput");

const instAcoustic = $("instAcoustic");
const instElectric = $("instElectric");
const instPiano = $("instPiano");

const drumRock = $("drumRock");
const drumHardRock = $("drumHardRock");
const drumPop = $("drumPop");
const drumRap = $("drumRap");

const autoPlayBtn = $("autoPlayBtn");
const recordBtn = $("recordBtn");

const mRock = $("mRock");
const mHardRock = $("mHardRock");
const mPop = $("mPop");
const mRap = $("mRap");
const mScrollBtn = $("mScrollBtn");
const mRecordBtn = $("mRecordBtn");

const sortSelect = $("sortSelect");
const projectSelect = $("projectSelect");
const renameProjectBtn = $("renameProjectBtn");
const recordingsList = $("recordingsList");

const rBtn = $("rBtn");
const rhymeDock = $("rhymeDock");
const rhymeTitle = $("rhymeTitle");
const rhymeWords = $("rhymeWords");
const hideRhymeBtn = $("hideRhymeBtn");

/* -----------------------------
   State
------------------------------*/
const SECTIONS = ["Full","VERSE 1","CHORUS 1","VERSE 2","CHORUS 2","VERSE 3","BRIDGE","CHORUS 3"];

let state = {
  projectId: null,
  projectName: "Dave song",
  autoSplit: true,
  bpm: 95,
  capo: 0,
  key: "—",
  instrument: "Piano",      // Acoustic / Electric / Piano
  drumStyle: "Rap",         // Rock / Hard Rock / Pop / Rap
  autoPlay: false,
  currentSection: "Full",
  pasteOpen: false
};

let lastFocusedTextarea = null;
document.addEventListener("focusin", (e) => {
  if(e.target && e.target.tagName === "TEXTAREA"){
    lastFocusedTextarea = e.target;
  }
});

/* -----------------------------
   IndexedDB (projects + recordings)
------------------------------*/
const DB_NAME = "songriderpro_db_v14";
const DB_VER = 1;
const STORE_PROJECTS = "projects";
const STORE_RECORDINGS = "recordings";

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_PROJECTS)){
        const s = db.createObjectStore(STORE_PROJECTS, { keyPath:"id" });
        s.createIndex("name","name",{ unique:false });
        s.createIndex("updatedAt","updatedAt",{ unique:false });
      }
      if(!db.objectStoreNames.contains(STORE_RECORDINGS)){
        const s = db.createObjectStore(STORE_RECORDINGS, { keyPath:"id" });
        s.createIndex("projectId","projectId",{ unique:false });
        s.createIndex("createdAt","createdAt",{ unique:false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store, obj){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,"readwrite");
    tx.objectStore(store).put(obj);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}
async function dbGet(store, key){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,"readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}
async function dbGetAll(store){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,"readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}
async function dbDelete(store, key){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,"readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}

/* -----------------------------
   Default project + data model
------------------------------*/
function emptyLine(){
  return {
    notes: Array(8).fill("Not"),
    lyrics: "",
    timing: ["","","",""]   // 4 chunks
  };
}
function defaultProject(){
  const sections = {};
  SECTIONS.forEach(s=>{
    sections[s] = Array.from({length: (s==="Full"? 0: 8)}, ()=>emptyLine());
  });
  // Full is special: used for paste + preview (not a line list)
  return {
    id: "proj_"+Date.now(),
    name: "Dave song",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections,
    fullPaste: "VERSE 1\n\nI love you sweet wife\n\nCHORUS 1\n\nYou are the love of my life\n",
    // for preview sheet derived from section cards
  };
}

let project = null;

/* -----------------------------
   UI helpers
------------------------------*/
function setActivePillGroup(btns, activeText){
  btns.forEach(b=>{
    if(!b) return;
    b.classList.toggle("active", b.textContent.trim().toLowerCase() === activeText.toLowerCase());
  });
}
function setInstrumentUI(){
  setActivePillGroup([instAcoustic,instElectric,instPiano], state.instrument);
}
function setDrumUI(){
  setActivePillGroup([drumRock,drumHardRock,drumPop,drumRap], state.drumStyle);
  setActivePillGroup([mRock,mHardRock,mPop,mRap], state.drumStyle);
}
function setScrollUI(){
  autoPlayBtn.classList.toggle("on", state.autoPlay);
  mScrollBtn.classList.toggle("on", state.autoPlay);
  autoPlayBtn.textContent="⇅";
  mScrollBtn.textContent="⇅";
}
function setAutoSplitUI(){
  autoSplitBtn.classList.toggle("active", state.autoSplit);
  autoSplitBtn.textContent = "AutoSplit: " + (state.autoSplit ? "ON" : "OFF");
}
function setKeyUI(){
  keyOutput.value = state.key || "—";
}
function setPanelCollapsed(collapsed){
  if(collapsed){
    panelBody.classList.add("hidden");
    tabsEl.classList.add("hidden");
    miniBar.classList.add("show");
    togglePanelBtn.textContent = "Show";
  }else{
    panelBody.classList.remove("hidden");
    tabsEl.classList.remove("hidden");
    miniBar.classList.remove("show");
    togglePanelBtn.textContent = "Hide";
  }
}

/* -----------------------------
   Tabs + Render
------------------------------*/
function renderTabs(){
  tabsEl.innerHTML = "";
  SECTIONS.forEach(sec=>{
    const b = document.createElement("button");
    b.className = "tab" + (state.currentSection===sec ? " active":"");
    b.textContent = sec;
    b.addEventListener("click", ()=>{
      state.currentSection = sec;
      renderAll();
    });
    tabsEl.appendChild(b);
  });
}

function syllableCount(word){
  if(!word) return 0;
  let w = String(word).toLowerCase().replace(/[^a-z']/g,"");
  if(!w) return 0;
  // very simple heuristic
  w = w.replace(/'s$/,"");
  if(w.length<=3) return 1;
  const vowels = w.match(/[aeiouy]+/g);
  let n = vowels ? vowels.length : 1;
  if(w.endsWith("e")) n = Math.max(1, n-1);
  if(w.endsWith("le") && w.length>3) n += 1;
  return Math.max(1,n);
}

function autosplitTiming(text){
  const words = String(text||"").trim().split(/\s+/).filter(Boolean);
  if(words.length===0) return ["","","",""];

  const syls = words.map(w=>syllableCount(w));
  const total = syls.reduce((a,b)=>a+b,0);
  const target = total/4;

  const chunks = ["","","",""];
  let ci=0, acc=0;
  for(let i=0;i<words.length;i++){
    if(ci<3 && acc + syls[i] > target && chunks[ci].trim().length>0){
      ci++;
      acc=0;
    }
    chunks[ci] += (chunks[ci] ? " ":"") + words[i];
    acc += syls[i];
  }
  return chunks;
}

function renderFullView(){
  sheetTitleEl.textContent = "Full";
  sheetBodyEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "fullBoxWrap";

  const row = document.createElement("div");
  row.style.display="flex";
  row.style.gap="8px";
  row.style.flexWrap="wrap";
  row.style.marginBottom="10px";

  const togglePaste = document.createElement("button");
  togglePaste.className="btn secondary";
  togglePaste.textContent = state.pasteOpen ? "Hide Paste Area" : "Show Paste Area";
  togglePaste.addEventListener("click", ()=>{
    state.pasteOpen = !state.pasteOpen;
    renderAll();
    // keep keyboard stable: focus back if open
    setTimeout(()=>{
      if(state.pasteOpen){
        const ta = document.querySelector("textarea.fullBox");
        if(ta) ta.focus();
      }
    }, 60);
  });

  const applyBtn = document.createElement("button");
  applyBtn.className="btn secondary";
  applyBtn.textContent="Apply to Sections";
  applyBtn.addEventListener("click", ()=>{
    applyPasteToSections();
  });

  row.appendChild(togglePaste);
  row.appendChild(applyBtn);
  wrap.appendChild(row);

  if(state.pasteOpen){
    const ta = document.createElement("textarea");
    ta.className="fullBox";
    ta.value = project.fullPaste || "";
    ta.addEventListener("input", ()=>{
      project.fullPaste = ta.value;
      project.updatedAt = Date.now();
      saveProjectSoon();
    });
    wrap.appendChild(ta);

    const help = document.createElement("div");
    help.className="fullHelp";
    help.textContent = 'Tip: Put section headers like "VERSE 1", "CHORUS 1", etc. Lines under each become lyric lines. (Notes stay as-is.)';
    wrap.appendChild(help);
  }

  // Preview sheet (auto from cards)
  const previewTitle = document.createElement("div");
  previewTitle.style.marginTop="14px";
  previewTitle.style.fontWeight="1100";
  previewTitle.textContent = "Full Sheet Preview (auto from your cards):";
  wrap.appendChild(previewTitle);

  SECTIONS.filter(s=>s!=="Full").forEach(sec=>{
    const hasAny = (project.sections[sec]||[]).some(l=>String(l.lyrics||"").trim().length>0);
    if(!hasAny) return;

    const sh = document.createElement("div");
    sh.className="sectionHeader";
    sh.textContent = sec;
    wrap.appendChild(sh);

    const cards = document.createElement("div");
    cards.className="cards";

    (project.sections[sec]||[]).forEach((line, idx)=>{
      if(!String(line.lyrics||"").trim()) return;

      const card = document.createElement("div");
      card.className="card";

      const notesRow = document.createElement("div");
      notesRow.className="notesRow";
      (line.notes||Array(8).fill("Not")).forEach((n)=>{
        const inp = document.createElement("input");
        inp.className="noteCell";
        inp.value = n || "Not";
        inp.readOnly = true;
        notesRow.appendChild(inp);
      });
      card.appendChild(notesRow);

      const lyr = document.createElement("textarea");
      lyr.className="lyrics";
      lyr.value = line.lyrics;
      lyr.readOnly = true;
      card.appendChild(lyr);

      cards.appendChild(card);
    });

    wrap.appendChild(cards);
  });

  sheetBodyEl.appendChild(wrap);
}

function renderSection(sec){
  sheetTitleEl.textContent = sec;
  sheetBodyEl.innerHTML = "";

  const cardsWrap = document.createElement("div");
  cardsWrap.className="cards";

  const lines = project.sections[sec] || [];
  lines.forEach((line, idx)=>{
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.section = sec;
    card.dataset.index = String(idx);

    const top = document.createElement("div");
    top.className="cardTop";

    const num = document.createElement("div");
    num.className="cardNum";
    num.textContent = String(idx+1);

    const syll = document.createElement("div");
    syll.className="syllPill";
    syll.textContent = "Syllables: " + countSyllablesInLine(line.lyrics);

    top.appendChild(num);
    top.appendChild(syll);
    card.appendChild(top);

    const notesRow = document.createElement("div");
    notesRow.className="notesRow";
    const notes = line.notes || Array(8).fill("Not");
    for(let i=0;i<8;i++){
      const inp = document.createElement("input");
      inp.className="noteCell";
      inp.value = notes[i] ?? "Not";
      inp.addEventListener("input", ()=>{
        line.notes[i] = inp.value.trim() || "Not";
        project.updatedAt = Date.now();
        updateKeyFromAllNotes();
        saveProjectSoon();
      });
      notesRow.appendChild(inp);
    }
    card.appendChild(notesRow);

    const ta = document.createElement("textarea");
    ta.className="lyrics";
    ta.placeholder = "Type lyrics (AutoSplit on)…";
    ta.value = line.lyrics || "";
    ta.addEventListener("input", ()=>{
      line.lyrics = ta.value;
      if(state.autoSplit){
        line.timing = autosplitTiming(line.lyrics);
      }
      syll.textContent = "Syllables: " + countSyllablesInLine(line.lyrics);
      renderTimingRow(timingRow, line, idx);
      project.updatedAt = Date.now();
      saveProjectSoon();
    });
    card.appendChild(ta);

    const timingRow = document.createElement("div");
    timingRow.className="timingRow";
    card.appendChild(timingRow);
    renderTimingRow(timingRow, line, idx);

    cardsWrap.appendChild(card);
  });

  sheetBodyEl.appendChild(cardsWrap);
}

function renderTimingRow(timingRow, line, idx){
  timingRow.innerHTML = "";
  const parts = line.timing || ["","","",""];
  for(let i=0;i<4;i++){
    const d = document.createElement("div");
    d.className = "timingCell" + ((i===1 || i===3) ? " backbeat":"");
    d.textContent = parts[i] || "";
    timingRow.appendChild(d);
  }
}

function countSyllablesInLine(text){
  const words = String(text||"").trim().split(/\s+/).filter(Boolean);
  return words.reduce((a,w)=>a+syllableCount(w),0);
}

function renderAll(){
  setAutoSplitUI();
  bpmInput.value = String(state.bpm);
  capoInput.value = String(state.capo);
  setKeyUI();
  setInstrumentUI();
  setDrumUI();
  setScrollUI();
  renderTabs();

  if(state.currentSection === "Full"){
    renderFullView();
  }else{
    renderSection(state.currentSection);
  }
  renderProjectsDropdown();
  renderRecordings();
}

function renderAllSoon(){
  clearTimeout(renderAllSoon._t);
  renderAllSoon._t = setTimeout(renderAll, 50);
}

/* -----------------------------
   Paste -> Sections
------------------------------*/
function applyPasteToSections(){
  const text = String(project.fullPaste || "");
  const lines = text.split(/\r?\n/);

  let cur = null;
  const newMap = {};
  SECTIONS.forEach(s=>{
    if(s!=="Full") newMap[s] = [];
  });

  for(const raw of lines){
    const line = raw.trimEnd();
    const t = line.trim();
    if(!t) continue;

    const upper = t.toUpperCase();
    const match = SECTIONS.find(s=>s!=="Full" && s===upper);
    if(match){
      cur = match;
      continue;
    }
    if(cur){
      const obj = emptyLine();
      obj.lyrics = t;
      obj.timing = state.autoSplit ? autosplitTiming(obj.lyrics) : ["","","",""];
      newMap[cur].push(obj);
    }
  }

  // keep at least 8 lines per section so UI has room
  for(const sec of Object.keys(newMap)){
    while(newMap[sec].length < 8) newMap[sec].push(emptyLine());
    newMap[sec] = newMap[sec].slice(0, 32);
  }

  project.sections = {...project.sections, ...newMap};
  project.updatedAt = Date.now();
  saveProjectSoon();
  renderAll();
}

/* -----------------------------
   Projects UI
------------------------------*/
async function ensureProject(){
  const all = await dbGetAll(STORE_PROJECTS);
  if(all.length===0){
    project = defaultProject();
    state.projectId = project.id;
    state.projectName = project.name;
    await dbPut(STORE_PROJECTS, project);
  }else{
    // load most recent
    all.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    project = all[0];
    state.projectId = project.id;
    state.projectName = project.name;
  }
}

async function renderProjectsDropdown(){
  const all = await dbGetAll(STORE_PROJECTS);
  const mode = sortSelect.value || "az";
  let list = [...all];

  if(mode==="az"){
    list.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""), undefined, { sensitivity:"base" }));
  }else{
    list.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  }

  projectSelect.innerHTML = "";
  list.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name || "(untitled)";
    if(p.id === state.projectId) opt.selected = true;
    projectSelect.appendChild(opt);
  });

  // ensure a selection exists
  if(!projectSelect.value && list[0]){
    projectSelect.value = list[0].id;
  }
}

/* create project if user types a new name in rename prompt */
async function renameProject(){
  const name = prompt("Project name:", project.name || "");
  if(name===null) return;
  const nm = name.trim() || "Untitled";
  project.name = nm;
  project.updatedAt = Date.now();
  state.projectName = nm;
  await dbPut(STORE_PROJECTS, project);
  renderAllSoon();
}

/* -----------------------------
   Recordings UI
------------------------------*/
async function renderRecordings(){
  const all = await dbGetAll(STORE_RECORDINGS);
  const mine = all.filter(r=>r.projectId === state.projectId);
  mine.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  recordingsList.innerHTML = "";

  if(mine.length===0){
    const d = document.createElement("div");
    d.style.color="#666";
    d.style.fontWeight="900";
    d.textContent = "No recordings yet.";
    recordingsList.appendChild(d);
    return;
  }

  mine.forEach(rec=>{
    const row = document.createElement("div");
    row.style.display="flex";
    row.style.gap="8px";
    row.style.alignItems="center";
    row.style.flexWrap="wrap";
    row.style.border="1px solid rgba(0,0,0,.10)";
    row.style.borderRadius="14px";
    row.style.padding="10px";

    const title = document.createElement("div");
    title.style.flex="1 1 auto";
    title.style.minWidth="190px";
    title.style.fontWeight="1100";
    const d = new Date(rec.createdAt || Date.now());
    const label = (rec.title && rec.title.trim()) ? rec.title.trim()+" • " : "";
    title.textContent = label + d.toLocaleString();

    // ✅ edit pencil BEFORE play
    const edit = document.createElement("button");
    edit.className="btn secondary";
    edit.textContent="✏️";
    edit.title="Rename recording";
    edit.addEventListener("click", async ()=>{
      const name = prompt("Recording title:", rec.title || "");
      if(name===null) return;
      rec.title = (name.trim() || "");
      await dbPut(STORE_RECORDINGS, rec);
      renderRecordings();
    });

    const play = document.createElement("button");
    play.className="btn secondary";
    play.textContent="▶";
    play.title="Play";
    play.addEventListener("click", async ()=>{
      const blob = rec.blob;
      if(!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = ()=>URL.revokeObjectURL(url);
    });

    const download = document.createElement("button");
    download.className="btn secondary";
    download.textContent="↓";
    download.title="Download";
    download.addEventListener("click", ()=>{
      const blob = rec.blob;
      if(!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (rec.title && rec.title.trim() ? rec.title.trim() : "recording")+"."+ (rec.mime==="audio/webm" ? "webm":"webm");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
    });

    const del = document.createElement("button");
    del.className="btn secondary";
    del.textContent="🗑";
    del.title="Delete";
    del.addEventListener("click", async ()=>{
      if(!confirm("Delete this recording?")) return;
      await dbDelete(STORE_RECORDINGS, rec.id);
      renderRecordings();
    });

    row.appendChild(title);
    row.appendChild(edit);
    row.appendChild(play);
    row.appendChild(download);
    row.appendChild(del);
    recordingsList.appendChild(row);
  });
}

/* -----------------------------
   Save debounce
------------------------------*/
function saveProjectSoon(){
  clearTimeout(saveProjectSoon._t);
  saveProjectSoon._t = setTimeout(async ()=>{
    if(!project) return;
    await dbPut(STORE_PROJECTS, project);
    renderProjectsDropdown();
  }, 250);
}

/* -----------------------------
   Key detection from notes (simple)
------------------------------*/
const SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const KK_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KK_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function norm(v){ return Math.sqrt(v.reduce((a,x)=>a+x*x,0)) || 1; }
function dot(a,b){ let s=0; for(let i=0;i<12;i++) s+= (a[i]||0)*(b[i]||0); return s; }
function rotate(arr, t){
  const out = Array(12).fill(0);
  for(let i=0;i<12;i++) out[(i+t)%12] = arr[i];
  return out;
}

function noteToPC(n){
  const s = String(n||"").trim().toUpperCase();
  if(!s || s==="NOT") return null;

  // chord root detection
  const m = s.match(/^([A-G])(#|B)?/);
  if(!m) return null;
  let root = m[1];
  let acc = m[2] || "";
  if(acc==="B") acc="b";

  const map = {
    "C":0,"C#":1,"DB":1,
    "D":2,"D#":3,"EB":3,
    "E":4,
    "F":5,"F#":6,"GB":6,
    "G":7,"G#":8,"AB":8,
    "A":9,"A#":10,"BB":10,
    "B":11
  };
  const key = root + (acc==="#" ? "#" : (acc==="b" ? "b" : ""));
  // normalize flats
  const k2 = key.replace("b","B");
  return map[k2] ?? null;
}

function keyFromHistogram(hist){
  let best = { score:-1e9, name:"" };
  const hnorm = norm(hist);
  for(let t=0;t<12;t++){
    const maj = rotate(KK_MAJOR, t);
    const min = rotate(KK_MINOR, t);
    const majScore = dot(hist, maj) / (hnorm * norm(maj));
    const minScore = dot(hist, min) / (hnorm * norm(min));
    if(majScore > best.score) best = { score:majScore, name: SHARP[t] + " maj" };
    if(minScore > best.score) best = { score:minScore, name: SHARP[t] + " min" };
  }
  return best.name || "—";
}

function updateKeyFromAllNotes(){
  const hist = Array(12).fill(0);
  SECTIONS.filter(s=>s!=="Full").forEach(sec=>{
    (project.sections[sec]||[]).forEach(line=>{
      (line.notes||[]).forEach(n=>{
        const pc = noteToPC(n);
        if(pc!==null) hist[pc] += 1;
      });
    });
  });
  state.key = keyFromHistogram(hist);
  setKeyUI();
}

/* -----------------------------
   Rhymes (improved + stopwords)
------------------------------*/
const STOPWORDS = new Set([
  "the","a","an","and","or","but","to","of","in","on","at","for","with","from",
  "is","are","was","were","be","been","being",
  "i","im","i'm","you","your","you're","we","they","he","she","it","me","my","mine","our","ours",
  "this","that","these","those",
  "love"
]);

function cleanWord(w){
  return String(w||"")
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g,"");
}

/* rime key: last vowel group + tail, e.g. "wife" => "ife", "knife" => "ife" */
function rimeKey(word){
  const w = cleanWord(word);
  if(!w || w.length<2) return "";
  // find last vowel group index
  const m = w.match(/([aeiouy]+[^aeiouy]*)$/);
  if(m && m[1]){
    const k = m[1];
    // shorten super long tails
    return k.length>5 ? k.slice(-5) : k;
  }
  return w.slice(-3);
}

function buildWordBank(){
  const set = new Set();
  SECTIONS.filter(s=>s!=="Full").forEach(sec=>{
    (project.sections[sec]||[]).forEach(line=>{
      const words = String(line.lyrics||"").split(/\s+/).map(cleanWord).filter(Boolean);
      words.forEach(x=>{
        if(x.length>=2 && !STOPWORDS.has(x)) set.add(x);
      });
    });
  });
  return Array.from(set);
}

function showRhymesFor(word){
  const w = cleanWord(word);
  if(!w || STOPWORDS.has(w)) return;

  const key = rimeKey(w);
  const bank = buildWordBank();
  const picks = bank
    .filter(x=>x!==w)
    .map(x=>({ w:x, k:rimeKey(x) }))
    .filter(o=>o.k === key)
    .map(o=>o.w)
    .slice(0, 10);

  rhymeTitle.textContent = `Rhymes for "${w}"`;
  rhymeWords.innerHTML = "";

  if(picks.length===0){
    const d = document.createElement("div");
    d.style.color="#666";
    d.style.fontWeight="900";
    d.textContent = "No rhymes found in your lyrics yet.";
    rhymeWords.appendChild(d);
  }else{
    picks.forEach(r=>{
      const b = document.createElement("button");
      b.className="rWord";
      b.textContent = r;
      b.addEventListener("click", ()=>{
        if(lastFocusedTextarea){
          // insert replacement of last word
          const t = lastFocusedTextarea.value;
          const parts = t.split(/\s+/);
          if(parts.length>0){
            parts[parts.length-1] = r;
            lastFocusedTextarea.value = parts.join(" ");
            lastFocusedTextarea.dispatchEvent(new Event("input",{bubbles:true}));
            lastFocusedTextarea.focus();
          }
        }
      });
      rhymeWords.appendChild(b);
    });
  }

  rhymeDock.style.display="block";
}

function getLastWordFromFocused(){
  if(!lastFocusedTextarea) return "";
  const txt = lastFocusedTextarea.value || "";
  const parts = txt.trim().split(/\s+/);
  return parts[parts.length-1] || "";
}

/* -----------------------------
   Audio engine (drums + notes + recording mix)
------------------------------*/
let audioCtx = null;
let masterOut = null;
let mediaDest = null;

function ensureAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterOut = audioCtx.createGain();
  masterOut.gain.value = 0.9;
  masterOut.connect(audioCtx.destination);

  mediaDest = audioCtx.createMediaStreamDestination();
  masterOut.connect(mediaDest);
}

function hzFromNoteName(name){
  const s = String(name||"").trim();
  if(!s || s.toLowerCase()==="not") return null;

  // chord like Am, C, G, D: use root
  const m = s.match(/^([A-G])(#|b)?/);
  if(!m) return null;
  const root = m[1] + (m[2]||"");
  const map = {C:0,"C#":1,"Db":1,D:2,"D#":3,"Eb":3,E:4,F:5,"F#":6,"Gb":6,G:7,"G#":8,"Ab":8,A:9,"A#":10,"Bb":10,B:11};
  const pc = map[root] ?? null;
  if(pc===null) return null;

  // base octave 4
  const a4 = 440;
  const n = pc - 9; // distance from A
  return a4 * Math.pow(2, n/12);
}

function playTone(freq, t0, t1, type){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(type==="Acoustic" ? 2200 : type==="Electric" ? 3200 : 1800, t0);

  // instrument character
  if(type==="Electric") o.type="sawtooth";
  else if(type==="Piano") o.type="triangle";
  else o.type="triangle";

  o.frequency.setValueAtTime(freq, t0);

  // envelope (sustained until next note)
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(type==="Piano" ? 0.35 : 0.25, t0 + 0.01);
  g.gain.setValueAtTime(type==="Piano" ? 0.20 : 0.18, Math.max(t0+0.02, t1-0.03));
  g.gain.exponentialRampToValueAtTime(0.0001, t1);

  o.connect(f).connect(g).connect(masterOut);
  o.start(t0);
  o.stop(t1 + 0.02);
}

function drumKick(t){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type="sine";
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(45, t+0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.8, t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.18);
  o.connect(g).connect(masterOut);
  o.start(t);
  o.stop(t+0.22);
}

function drumSnare(t){
  ensureAudio();
  const n = audioCtx.createBufferSource();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();

  const dur = 0.18;
  const sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, Math.floor(sr*dur), sr);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(sr*0.04));

  n.buffer = buf;
  f.type="highpass";
  f.frequency.setValueAtTime(800, t);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);

  n.connect(f).connect(g).connect(masterOut);
  n.start(t);
  n.stop(t+dur);
}

function drumHat(t, open=false){
  ensureAudio();
  const dur = open ? 0.14 : 0.05;
  const sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, Math.floor(sr*dur), sr);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    data[i] = (Math.random()*2-1) * Math.exp(-i/(sr*(open?0.03:0.015)));
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const f = audioCtx.createBiquadFilter();
  f.type="highpass";
  f.frequency.setValueAtTime(6000, t);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(open?0.35:0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  src.connect(f).connect(g).connect(masterOut);
  src.start(t);
  src.stop(t+dur);
}

function scheduleDrums(t0, bars){
  ensureAudio();
  const bpm = state.bpm;
  const beat = 60/bpm;
  const barDur = beat*4;

  for(let b=0;b<bars;b++){
    const base = t0 + b*barDur;

    if(state.drumStyle==="Rap"){
      // kick on 1, “and” of 2, 3; snare on 2/4; hats 8ths
      drumKick(base + 0*beat);
      drumKick(base + 1.5*beat);
      drumKick(base + 2*beat);
      drumSnare(base + 1*beat);
      drumSnare(base + 3*beat);
      for(let i=0;i<8;i++){
        drumHat(base + i*(beat/2), i===7);
      }
    }else if(state.drumStyle==="Pop"){
      drumKick(base + 0*beat);
      drumKick(base + 2*beat);
      drumSnare(base + 1*beat);
      drumSnare(base + 3*beat);
      for(let i=0;i<8;i++) drumHat(base + i*(beat/2), false);
    }else if(state.drumStyle==="Rock"){
      drumKick(base + 0*beat);
      drumKick(base + 2.5*beat);
      drumSnare(base + 1*beat);
      drumSnare(base + 3*beat);
      for(let i=0;i<8;i++) drumHat(base + i*(beat/2), i===7);
    }else{
      // Hard Rock
      drumKick(base + 0*beat);
      drumKick(base + 2*beat);
      drumKick(base + 2.75*beat);
      drumSnare(base + 1*beat);
      drumSnare(base + 3*beat);
      for(let i=0;i<8;i++) drumHat(base + i*(beat/2), i===7);
    }
  }
}

function scheduleLineNotes(line, t0){
  const bpm = state.bpm;
  const step = (60/bpm)/2; // eighth note
  const notes = (line.notes||[]).map(x=>String(x||"Not"));

  // sustained: each note holds until next non-Not (or end)
  for(let i=0;i<8;i++){
    const n = notes[i];
    if(!n || n.toLowerCase()==="not") continue;

    let j=i+1;
    while(j<8 && (!notes[j] || notes[j].toLowerCase()==="not")) j++;
    const tStart = t0 + i*step;
    const tEnd = t0 + (j<8 ? j*step : 8*step);

    const hz = hzFromNoteName(n);
    if(hz) playTone(hz, tStart, tEnd, state.instrument);
  }
  return t0 + 8*step;
}

/* -----------------------------
   AutoScroll play
------------------------------*/
let playing = false;
let playTimer = null;
let activeCard = null;

function clearActiveCard(){
  if(activeCard) activeCard.classList.remove("activeLine");
  activeCard = null;
}

function highlightCard(sec, idx){
  clearActiveCard();
  const card = document.querySelector(`.card[data-section="${sec}"][data-index="${idx}"]`);
  if(card){
    activeCard = card;
    card.classList.add("activeLine");
    card.scrollIntoView({ behavior:"smooth", block:"center" });
  }
}

function getPlayableSequence(){
  // if on Full, play all sections in order
  const order = SECTIONS.filter(s=>s!=="Full");
  const seq = [];
  order.forEach(sec=>{
    (project.sections[sec]||[]).forEach((line, idx)=>{
      if(String(line.lyrics||"").trim().length>0 || (line.notes||[]).some(n=>String(n||"").toLowerCase()!=="not")){
        seq.push({sec, idx, line});
      }
    });
  });
  return seq;
}

async function startAutoPlay(){
  ensureAudio();
  if(audioCtx.state==="suspended") await audioCtx.resume();

  state.autoPlay = true;
  setScrollUI();

  playing = true;
  const bpm = state.bpm;
  const step = (60/bpm)/2;
  const lineDur = step*8;

  const seq = getPlayableSequence();
  if(seq.length===0){
    state.autoPlay=false;
    setScrollUI();
    return;
  }

  let cursor = 0;

  const loop = async ()=>{
    if(!playing) return;

    const now = audioCtx.currentTime + 0.05;

    // schedule 2 lines ahead
    for(let k=0;k<2;k++){
      const item = seq[(cursor+k) % seq.length];
      const t0 = now + k*lineDur;

      scheduleDrums(t0, 1);
      scheduleLineNotes(item.line, t0);

      // visual highlight near time
      setTimeout(()=>{
        if(!playing) return;
        // if user is not on that section, switch view automatically
        if(state.currentSection !== item.sec){
          state.currentSection = item.sec;
          renderAll();
        }
        highlightCard(item.sec, item.idx);
      }, Math.max(0, (t0 - audioCtx.currentTime)*1000));
    }

    cursor = (cursor + 1) % seq.length;
    playTimer = setTimeout(loop, lineDur*1000);
  };

  loop();
}

function stopAutoPlay(){
  playing = false;
  clearTimeout(playTimer);
  playTimer = null;
  clearActiveCard();
  state.autoPlay = false;
  setScrollUI();
}

/* -----------------------------
   Recording (MIC + APP AUDIO)
------------------------------*/
let mediaRecorder = null;
let recChunks = [];
let recording = false;

async function startRecording(){
  try{
    ensureAudio();
    if(audioCtx.state==="suspended") await audioCtx.resume();

    const mic = await navigator.mediaDevices.getUserMedia({ audio:true });

    const tracks = [];
    mic.getAudioTracks().forEach(t=>tracks.push(t));
    if(mediaDest && mediaDest.stream){
      mediaDest.stream.getAudioTracks().forEach(t=>tracks.push(t));
    }

    const mixed = new MediaStream(tracks);
    recChunks = [];

    mediaRecorder = new MediaRecorder(mixed);
    mediaRecorder.ondataavailable = (e)=>{
      if(e.data && e.data.size>0) recChunks.push(e.data);
    };

    mediaRecorder.onstop = async ()=>{
      recording = false;
      recordBtn.textContent = "Record";
      mRecordBtn.textContent = "Record";

      const blob = new Blob(recChunks, { type:"audio/webm" });
      const id = "rec_"+Date.now();
      await dbPut(STORE_RECORDINGS, {
        id,
        projectId: state.projectId,
        createdAt: Date.now(),
        mime: "audio/webm",
        title: "",
        blob
      });

      mic.getTracks().forEach(t=>t.stop());
      renderRecordings();
    };

    mediaRecorder.start();
    recording = true;
    recordBtn.textContent = "Stop";
    mRecordBtn.textContent = "Stop";

  }catch(e){
    alert("Mic permission is required to record.");
  }
}

function stopRecording(){
  if(mediaRecorder && recording){
    mediaRecorder.stop();
  }
}

/* -----------------------------
   Headshot blink hook
------------------------------*/
function blinkOnce(){
  const w = $("headshotWrap");
  if(!w) return;
  w.classList.add("blink");
  setTimeout(()=>w.classList.remove("blink"), 120);
}

/* -----------------------------
   Events
------------------------------*/
togglePanelBtn.addEventListener("click", ()=>{
  const collapsed = !panelBody.classList.contains("hidden");
  setPanelCollapsed(collapsed);
});

autoSplitBtn.addEventListener("click", ()=>{
  state.autoSplit = !state.autoSplit;
  setAutoSplitUI();
  // recompute timing for current section
  if(state.currentSection !== "Full"){
    const sec = state.currentSection;
    (project.sections[sec]||[]).forEach(line=>{
      line.timing = state.autoSplit ? autosplitTiming(line.lyrics) : ["","","",""];
    });
    project.updatedAt = Date.now();
    saveProjectSoon();
    renderAllSoon();
  }
});

bpmInput.addEventListener("input", ()=>{
  state.bpm = Math.max(40, Math.min(220, Number(bpmInput.value||95)));
});
capoInput.addEventListener("input", ()=>{
  state.capo = Math.max(0, Math.min(12, Number(capoInput.value||0)));
});

instAcoustic.addEventListener("click", ()=>{ state.instrument="Acoustic"; setInstrumentUI(); });
instElectric.addEventListener("click", ()=>{ state.instrument="Electric"; setInstrumentUI(); });
instPiano.addEventListener("click", ()=>{ state.instrument="Piano"; setInstrumentUI(); });

function setDrumStyle(s){
  state.drumStyle = s;
  setDrumUI();
}
drumRock.addEventListener("click", ()=>setDrumStyle("Rock"));
drumHardRock.addEventListener("click", ()=>setDrumStyle("Hard Rock"));
drumPop.addEventListener("click", ()=>setDrumStyle("Pop"));
drumRap.addEventListener("click", ()=>setDrumStyle("Rap"));
mRock.addEventListener("click", ()=>setDrumStyle("Rock"));
mHardRock.addEventListener("click", ()=>setDrumStyle("Hard Rock"));
mPop.addEventListener("click", ()=>setDrumStyle("Pop"));
mRap.addEventListener("click", ()=>setDrumStyle("Rap"));

autoPlayBtn.addEventListener("click", async ()=>{
  if(state.autoPlay){
    stopAutoPlay();
  }else{
    await startAutoPlay();
  }
});
mScrollBtn.addEventListener("click", async ()=>{
  if(state.autoPlay){
    stopAutoPlay();
  }else{
    await startAutoPlay();
  }
});

recordBtn.addEventListener("click", async ()=>{
  if(recording) stopRecording();
  else await startRecording();
});
mRecordBtn.addEventListener("click", async ()=>{
  if(recording) stopRecording();
  else await startRecording();
});

sortSelect.addEventListener("change", renderProjectsDropdown);

projectSelect.addEventListener("change", async ()=>{
  const id = projectSelect.value;
  const p = await dbGet(STORE_PROJECTS, id);
  if(!p) return;
  project = p;
  state.projectId = p.id;
  state.projectName = p.name;
  updateKeyFromAllNotes();
  renderAll();
  renderRecordings();
});

renameProjectBtn.addEventListener("click", renameProject);

rBtn.addEventListener("click", ()=>{
  blinkOnce();
  const w = getLastWordFromFocused();
  showRhymesFor(w);
});
hideRhymeBtn.addEventListener("click", ()=>{
  rhymeDock.style.display="none";
});

/* -----------------------------
   Init
------------------------------*/
(async function init(){
  await ensureProject();
  setAutoSplitUI();
  setPanelCollapsed(false);
  renderTabs();
  updateKeyFromAllNotes();
  renderAll();
})();
})();
