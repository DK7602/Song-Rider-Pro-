/* app.js (FULL REPLACE v25) */
(() => {
  "use strict";

  /***********************
   * FORCE-NUKE OLD SERVICE WORKER CACHE
   * (Fixes “I updated but it still runs old code”)
   ***********************/
  try{
    if("serviceWorker" in navigator){
      navigator.serviceWorker.getRegistrations()
        .then(rs => rs.forEach(r => r.unregister()))
        .catch(()=>{});
    }
  }catch{}

  /***********************
   * Utils
   ***********************/
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const now = () => Date.now();

  function uuid(){
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /***********************
   * DOM
   ***********************/
  const el = {
    headshotWrap: $("headshotWrap"),

    togglePanelBtn: $("togglePanelBtn"),
    panelBody: $("panelBody"),
    miniBar: $("miniBar"),

    autoSplitBtn: $("autoSplitBtn"),
    bpmInput: $("bpmInput"),
    capoInput: $("capoInput"),
    keyOutput: $("keyOutput"),

    instAcoustic: $("instAcoustic"),
    instElectric: $("instElectric"),
    instPiano: $("instPiano"),

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
   * Active card + active lyrics
   ***********************/
  let lastLyricsTextarea = null;
  let lastActiveCardEl = null;

  document.addEventListener("focusin", (e) => {
    const t = e.target;

    if(t && t.tagName === "TEXTAREA" && t.classList.contains("lyrics")){
      lastLyricsTextarea = t;
      const card = t.closest(".card");
      if(card) lastActiveCardEl = card;
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
   * Sections (ORDER LOCKED)
   ***********************/
  const SECTIONS = ["Full","VERSE 1","CHORUS 1","VERSE 2","CHORUS 2","VERSE 3","BRIDGE","CHORUS 3"];
  const DEFAULT_LINES_PER_SECTION = 20;

  /***********************
   * Project storage (version bump)
   ***********************/
  const LS_KEY = "songrider_v25_projects";
  const LS_CUR = "songrider_v25_currentProjectId";

  function newLine(){
    return {
      id: uuid(),
      notes: Array(8).fill(""),
      lyrics: "",
      beats: Array(4).fill("")
    };
  }

  function defaultProject(name="New Song"){
    const sections = {};
    SECTIONS.filter(s=>s!=="Full").forEach(sec => {
      sections[sec] = Array.from({length: DEFAULT_LINES_PER_SECTION}, () => newLine());
    });
    return {
      id: uuid(),
      name,
      createdAt: now(),
      updatedAt: now(),
      fullText: "",
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
    if(!p.sections || typeof p.sections !== "object") p.sections = {};

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

      while(p.sections[sec].length < DEFAULT_LINES_PER_SECTION){
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
   * IndexedDB (Recordings) version bump
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
   * State
   ***********************/
  const state = {
    project: null,
    currentSection: "Full",
    bpm: 95,
    capo: 0,
    autoSplit: true,

    instrument: "piano",
    instrumentOn: false,

    drumStyle: "rap",
    drumsOn: false,

    autoScrollOn: false,
    autoScrollTimer: null,

    ctx: null,
    drumTimer: null,

    isRecording: false,
    recStream: null,
    rec: null,
    recChunks: [],

    beatTimer: null,
    tick8: 0
  };

  /***********************
   * Headshot blink
   ***********************/
  function doBlink(){
    if(!el.headshotWrap) return;
    el.headshotWrap.classList.add("blink");
    setTimeout(() => el.headshotWrap.classList.remove("blink"), 80);
  }

  /***********************
   * Tick UI
   ***********************/
  function clearTick(){
    const root = el.sheetBody;
    if(!root) return;
    root.querySelectorAll(".tick").forEach(x => x.classList.remove("tick"));
  }

  function applyTick(){
    const root = el.sheetBody;
    if(!root) return;
    if(state.currentSection === "Full") return;

    const nIdx = state.tick8 % 8;
    const bIdx = Math.floor((state.tick8 % 8) / 2);

    root.querySelectorAll(".card").forEach(card => {
      const notes = card.querySelectorAll(".noteCell");
      const beats = card.querySelectorAll(".beatCell");
      if(notes[nIdx]) notes[nIdx].classList.add("tick");
      if(beats[bIdx]) beats[bIdx].classList.add("tick");
    });
  }

  /***********************
   * Audio
   ***********************/
  function ensureCtx(){
    if(!state.ctx){
      state.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(state.ctx.state === "suspended"){
      state.ctx.resume().catch(()=>{});
    }
    return state.ctx;
  }

  function pluck(freq=440, ms=180, gain=0.08, type="sine"){
    const ctx = ensureCtx();
    const t0 = ctx.currentTime;

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = type;
    o.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

    o.connect(g); g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + ms/1000 + 0.02);
  }

  function noise(ms=40, gain=0.08){
    const ctx = ensureCtx();
    const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * (ms/1000)));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

    src.connect(g); g.connect(ctx.destination);
    src.start();
  }

  function drumHit(kind){
    if(kind === "kick") pluck(70, 120, 0.16, "sine");
    if(kind === "snare"){ noise(60, 0.10); pluck(180, 70, 0.05, "square"); }
    if(kind === "hat"){ noise(25, 0.05); }
  }

  /***********************
   * NOTE PARSER for blue boxes
   ***********************/
  const NOTE_TO_FREQ = {
    "C":261.63,"C#":277.18,"DB":277.18,
    "D":293.66,"D#":311.13,"EB":311.13,
    "E":329.63,
    "F":349.23,"F#":369.99,"GB":369.99,
    "G":392.00,"G#":415.30,"AB":415.30,
    "A":440.00,"A#":466.16,"BB":466.16,
    "B":493.88
  };

  function noteCellToFreq(v){
    const s = String(v||"").trim().toUpperCase();
    if(!s) return null;
    const m = s.match(/^([A-G])([#B])?$/);
    if(!m) return null;
    const root = m[1];
    const acc = (m[2]||"");
    const key = root + (acc === "B" ? "B" : acc === "#" ? "#" : "");
    return NOTE_TO_FREQ[key] ?? null;
  }

  function instWave(){
    if(state.instrument === "electric") return "sawtooth";
    if(state.instrument === "acoustic") return "triangle";
    return "sine";
  }

  /***********************
   * ACTIVE CARD selection
   ***********************/
  function getHeaderBottomY(){
    const hdr = document.querySelector("header");
    if(!hdr) return 86;
    const r = hdr.getBoundingClientRect();
    return Math.max(0, Math.min(window.innerHeight, r.bottom)) + 8;
  }

  function getNearestVisibleCard(){
    const cards = Array.from(el.sheetBody.querySelectorAll(".card"));
    if(cards.length === 0) return null;

    const yLine = getHeaderBottomY();
    let best = null;
    let bestDist = Infinity;

    for(const c of cards){
      const r = c.getBoundingClientRect();
      if(r.bottom < yLine || r.top > window.innerHeight) continue;
      const dist = Math.abs(r.top - yLine);
      if(dist < bestDist){
        bestDist = dist;
        best = c;
      }
    }
    return best || cards[0];
  }

  function getPlaybackCard(){
    if(state.currentSection === "Full") return null;
    if(state.autoScrollOn) return getNearestVisibleCard();
    if(lastActiveCardEl && document.contains(lastActiveCardEl)) return lastActiveCardEl;
    return getNearestVisibleCard();
  }

  function playInstrumentStep(){
    if(!state.instrumentOn) return;
    if(state.currentSection === "Full") return;

    const card = getPlaybackCard();
    if(!card) return;

    const nIdx = state.tick8 % 8;
    const cells = card.querySelectorAll(".noteCell");
    if(!cells[nIdx]) return;

    const freq = noteCellToFreq(cells[nIdx].value);
    if(!freq) return;

    pluck(freq, 180, 0.09, instWave());
  }

  /***********************
   * BAR ADVANCE (autoscroll)
   ***********************/
  function autoAdvanceOnBar(){
    if(!state.autoScrollOn) return;
    if(state.currentSection === "Full") return;
    if(state.tick8 % 8 !== 0) return;

    const cards = Array.from(el.sheetBody.querySelectorAll(".card"));
    if(cards.length === 0) return;

    const active = getNearestVisibleCard() || cards[0];
    const idx = cards.indexOf(active);
    const next = cards[idx + 1] || cards[0];

    try{
      next.scrollIntoView({ behavior:"smooth", block:"start" });
    }catch{}
  }

  /***********************
   * DRUMS + CLOCK
   ***********************/
  function stopBeatClock(){
    if(state.beatTimer){
      clearInterval(state.beatTimer);
      state.beatTimer = null;
    }
    clearTick();
  }

  function startBeatClock(){
    stopBeatClock();
    const bpm = clamp(state.bpm || 95, 40, 220);
    const eighthMs = Math.round((60000 / bpm) / 2);

    state.tick8 = 0;
    clearTick();

    state.beatTimer = setInterval(() => {
      clearTick();
      applyTick();

      if(state.drumsOn && state.tick8 % 2 === 0) doBlink();
      if(state.drumsOn) playInstrumentStep();
      if(state.drumsOn) autoAdvanceOnBar();

      state.tick8++;
    }, eighthMs);
  }

  function stopDrums(){
    if(state.drumTimer){
      clearInterval(state.drumTimer);
      state.drumTimer = null;
    }
    state.drumsOn = false;
    stopBeatClock();
  }

  function startDrums(){
    stopDrums();
    state.drumsOn = true;
    startBeatClock();

    const bpm = clamp(state.bpm || 95, 40, 220);
    const stepMs = Math.round((60000 / bpm) / 2);
    let step = 0;

    state.drumTimer = setInterval(() => {
      if(!state.drumsOn) return;
      const s = step % 16;

      if(state.drumStyle === "rap"){
        if(s === 0 || s === 6 || s === 8) drumHit("kick");
        if(s === 4 || s === 12) drumHit("snare");
        drumHit("hat");
      } else if(state.drumStyle === "rock"){
        if(s === 0 || s === 8) drumHit("kick");
        if(s === 4 || s === 12) drumHit("snare");
        drumHit("hat");
      } else if(state.drumStyle === "hardrock"){
        if(s === 0 || s === 2 || s === 8 || s === 10) drumHit("kick");
        if(s === 4 || s === 12) drumHit("snare");
        drumHit("hat");
      } else {
        if(s === 0 || s === 7 || s === 8) drumHit("kick");
        if(s === 4 || s === 12) drumHit("snare");
        if(s % 2 === 0) drumHit("hat");
      }

      step++;
    }, stepMs);
  }

  function stopInstrument(){ state.instrumentOn = false; }
  function startInstrument(){ state.instrumentOn = true; ensureCtx(); }

  /***********************
   * UI helpers
   ***********************/
  function setActive(ids, activeId){
    ids.forEach(id => {
      const b = $(id);
      if(!b) return;
      b.classList.toggle("active", id === activeId);
    });
  }

  function renderInstrumentUI(){
    const map = { acoustic:"instAcoustic", electric:"instElectric", piano:"instPiano" };
    const active = state.instrumentOn ? map[state.instrument] : null;
    setActive(Object.values(map), active);
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

    if(state.autoScrollTimer){
      clearInterval(state.autoScrollTimer);
      state.autoScrollTimer = null;
    }
    if(state.autoScrollOn){
      state.autoScrollTimer = setInterval(() => {
        window.scrollBy({ top: 1, left: 0, behavior: "auto" });
      }, 25);
    }
  }

  function setPanelHidden(hidden){
    el.panelBody.classList.toggle("hidden", hidden);
    el.togglePanelBtn.textContent = hidden ? "Show" : "Hide";
    el.miniBar.classList.toggle("show", hidden);
  }

  function setRecordUI(){
    const label = state.isRecording ? "Stop" : "Record";
    if(el.recordBtn) el.recordBtn.textContent = label;
    if(el.mRecordBtn) el.mRecordBtn.textContent = label;
  }

  /***********************
   * Tabs + editor
   ***********************/
  function ensureSectionArray(sec){
    if(sec === "Full") return [];
    if(!state.project.sections[sec]) state.project.sections[sec] = [];
    while(state.project.sections[sec].length < DEFAULT_LINES_PER_SECTION){
      state.project.sections[sec].push(newLine());
    }
    return state.project.sections[sec];
  }

  function renderTabs(){
    el.tabs.innerHTML = "";
    SECTIONS.forEach(sec => {
      const b = document.createElement("button");
      b.className = "tab";
      b.textContent = sec;
      b.classList.toggle("active", sec === state.currentSection);
      b.addEventListener("click", () => {
        state.currentSection = sec;
        renderTabs();
        renderSheet();
        clearTick();
        applyTick();

        lastActiveCardEl = null;
        lastLyricsTextarea = null;
        refreshRhymesFromActive();
      });
      el.tabs.appendChild(b);
    });
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
   * AutoSplit
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

      if(bi < 3 && acc >= target){
        bi++;
        acc = 0;
      }

      boxes[bi].push(w);
      acc += s;
    }

    return boxes.map(arr => arr.join(" ").trim());
  }

  /***********************
   * Key display (unchanged)
   ***********************/
  const NOTE_TO_PC = {
    "C":0,"C#":1,"DB":1,"D":2,"D#":3,"EB":3,"E":4,"F":5,"F#":6,"GB":6,"G":7,"G#":8,"AB":8,"A":9,"A#":10,"BB":10,"B":11
  };
  const PC_TO_NAME = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  function noteToPC(n){
    const s = String(n||"").trim().toUpperCase();
    if(!s) return null;
    const m = s.match(/^([A-G])([#B])?/);
    if(!m) return null;
    const root = m[1];
    const acc = (m[2] || "").toUpperCase();
    const key = root + (acc === "B" ? "B" : acc === "#" ? "#" : "");
    return NOTE_TO_PC[key] ?? null;
  }

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
    const transposedPC = (k.pc + (state.capo % 12) + 12) % 12;
    el.keyOutput.value = `${PC_TO_NAME[transposedPC]} ${k.mode}`;
  }

  /***********************
   * Full preview (unchanged)
   ***********************/
  function compactNotesLine(notesArr){
    const notes = Array.isArray(notesArr) ? notesArr : Array(8).fill("");
    return notes.map(n => (String(n||"").trim() || "—")).join(" ");
  }

  function buildFullPreviewText(){
    const out = [];
    let any = false;

    SECTIONS.filter(s => s !== "Full").forEach(sec => {
      const arr = state.project.sections[sec] || [];
      const hasAny = arr.some(line => {
        const lyr = String(line.lyrics || "").trim();
        const notes = Array.isArray(line.notes) ? line.notes : [];
        const hasNotes = notes.some(n => String(n||"").trim());
        return !!lyr || hasNotes;
      });
      if(!hasAny) return;

      any = true;
      out.push(sec.toUpperCase());
      out.push("");

      arr.forEach((line, idx) => {
        const lyr = String(line.lyrics || "").trim();
        const notesLine = compactNotesLine(line.notes);

        const hasNotes = notesLine.replace(/—|\s/g,"").length > 0;
        const hasLyrics = !!lyr;

        if(!hasNotes && !hasLyrics) return;

        out.push(`(${idx+1}) ${notesLine}`);
        if(hasLyrics) out.push(`    ${lyr}`);
        out.push("");
      });

      out.push("");
    });

    return any ? out.join("\n").trim() : "(No lyrics/notes yet — start typing in a section)";
  }

  function updateFullIfVisible(){
    if(state.currentSection !== "Full") return;
    const preview = el.sheetBody.querySelector("textarea.fullPreview");
    if(preview) preview.value = buildFullPreviewText();
  }

  /***********************
   * Sheet rendering (unchanged from your v24)
   ***********************/
  function renderSheetActions(){
    el.sheetActions.innerHTML = "";
    if(state.currentSection === "Full") return;

    const addBtn = document.createElement("button");
    addBtn.className = "btn secondary";
    addBtn.textContent = "+ Line";
    addBtn.title = "Add another card (line)";
    addBtn.addEventListener("click", () => {
      const arr = ensureSectionArray(state.currentSection);
      arr.push(newLine());
      upsertProject(state.project);
      renderSheet();
      updateFullIfVisible();
      updateKeyFromAllNotes();
      clearTick(); applyTick();
    });

    el.sheetActions.appendChild(addBtn);
  }

  function renderSheet(){
    el.sheetTitle.textContent = state.currentSection;
    renderSheetActions();

    if(state.currentSection === "Full"){
      el.sheetHint.textContent = "Full Page (editable) + Preview (auto):";
      el.sheetBody.innerHTML = "";

      const wrap = document.createElement("div");
      wrap.className = "fullBoxWrap";

      const label1 = document.createElement("div");
      label1.className = "fullLabel";
      label1.textContent = "FULL PAGE (type anything here):";

      const ta = document.createElement("textarea");
      ta.className = "fullBox";
      ta.readOnly = false;
      ta.placeholder = "Type your full lyrics / notes here…";
      ta.value = state.project.fullText || "";
      ta.addEventListener("input", () => {
        state.project.fullText = ta.value;
        upsertProject(state.project);
      });

      const label2 = document.createElement("div");
      label2.className = "fullLabel";
      label2.textContent = "FULL PREVIEW (auto from cards):";

      const preview = document.createElement("textarea");
      preview.className = "fullPreview";
      preview.readOnly = true;
      preview.value = buildFullPreviewText();

      wrap.appendChild(label1);
      wrap.appendChild(ta);
      wrap.appendChild(label2);
      wrap.appendChild(preview);

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

      const top = document.createElement("div");
      top.className = "cardTop";

      const num = document.createElement("div");
      num.className = "cardNum";
      num.textContent = String(idx + 1);
      num.title = "Long-press to delete this line";

      let pressTimer = null;
      const startPress = () => {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          if(!confirm(`Delete line ${idx+1} from ${state.currentSection}?`)) return;
          arr.splice(idx, 1);
          while(arr.length < DEFAULT_LINES_PER_SECTION) arr.push(newLine());
          upsertProject(state.project);
          renderSheet();
          updateFullIfVisible();
          updateKeyFromAllNotes();
          clearTick(); applyTick();
        }, 650);
      };
      const endPress = () => clearTimeout(pressTimer);

      num.addEventListener("touchstart", startPress, {passive:true});
      num.addEventListener("touchend", endPress);
      num.addEventListener("touchcancel", endPress);
      num.addEventListener("mousedown", startPress);
      num.addEventListener("mouseup", endPress);
      num.addEventListener("mouseleave", endPress);

      const syll = document.createElement("div");
      syll.className = "syllPill";
      syll.textContent = "Syllables: " + countSyllablesInline(line.lyrics || "");

      top.appendChild(num);
      top.appendChild(syll);

      const notesRow = document.createElement("div");
      notesRow.className = "notesRow";

      for(let i=0;i<8;i++){
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "noteCell";
        inp.value = line.notes[i] || "";
        inp.autocomplete = "off";
        inp.autocapitalize = "characters";
        inp.spellcheck = false;

        inp.addEventListener("pointerdown", (e)=>{ e.stopPropagation(); });

        inp.addEventListener("focus", () => {
          lastActiveCardEl = card;
        });

        inp.addEventListener("input", () => {
          line.notes[i] = String(inp.value || "").trim();
          upsertProject(state.project);
          updateKeyFromAllNotes();
          updateFullIfVisible();
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
          upsertProject(state.project);
          updateFullIfVisible();
        });

        beatInputs.push(inp);
        beatsRow.appendChild(inp);
      }

      lyr.addEventListener("input", () => {
        line.lyrics = lyr.value;
        syll.textContent = "Syllables: " + countSyllablesInline(line.lyrics || "");
        upsertProject(state.project);
        updateFullIfVisible();

        refreshRhymesFromActive();

        if(state.autoSplit){
          const boxes = autosplitBeatsFromLyrics(line.lyrics);
          line.beats = boxes;
          for(let k=0;k<4;k++){
            beatInputs[k].value = line.beats[k] || "";
          }
          upsertProject(state.project);
          updateFullIfVisible();
        }

        if(state.autoSplit && lyr.value.includes("\n")){
          const parts = lyr.value.split("\n");
          const first = parts.shift();
          line.lyrics = first;
          const rest = parts.join("\n").trim();

          if(rest){
            const nl = newLine();
            nl.lyrics = rest;
            nl.beats = autosplitBeatsFromLyrics(rest);
            arr.splice(idx+1, 0, nl);
          }

          while(arr.length < DEFAULT_LINES_PER_SECTION) arr.push(newLine());

          upsertProject(state.project);
          renderSheet();
          updateFullIfVisible();
          updateKeyFromAllNotes();
          clearTick(); applyTick();
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
  }

  /***********************
   * Recordings UI (unchanged)
   ***********************/
  function fmtDate(ms){
    try{ return new Date(ms).toLocaleString(); }catch{ return String(ms); }
  }

  async function renderRecordings(){
    const all = await dbGetAll();
    const mine = all.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
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
      title.textContent = (rec.title && rec.title.trim() ? rec.title.trim() + " — " : "") + fmtDate(rec.createdAt || now());

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
      play.addEventListener("click", () => {
        if(!rec.blob) return;
        const url = URL.createObjectURL(rec.blob);
        const audio = new Audio(url);
        audio.play().catch(()=>{});
        audio.onended = () => URL.revokeObjectURL(url);
      });

      const download = document.createElement("button");
      download.className="btn secondary";
      download.textContent="↓";
      download.title="Download";
      download.addEventListener("click", () => {
        if(!rec.blob) return;
        const url = URL.createObjectURL(rec.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (rec.title && rec.title.trim() ? rec.title.trim() : "recording") + ".webm";
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
      row.appendChild(download);
      row.appendChild(del);
      el.recordingsList.appendChild(row);
    });
  }

  /***********************
   * Recording (unchanged)
   ***********************/
  async function startRecording(){
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    state.recStream = stream;
    state.recChunks = [];

    const rec = new MediaRecorder(stream);
    state.rec = rec;

    rec.ondataavailable = (e) => { if(e.data && e.data.size) state.recChunks.push(e.data); };

    rec.onstop = async () => {
      try{ stream.getTracks().forEach(t => t.stop()); }catch{}
      const blob = new Blob(state.recChunks, { type: "audio/webm" });
      const item = { id: uuid(), createdAt: now(), title: "", blob };
      await dbPut(item);
      await renderRecordings();
      state.rec = null;
      state.recStream = null;
      state.recChunks = [];
    };

    rec.start();
    state.isRecording = true;
    setRecordUI();
  }

  async function stopRecording(){
    if(!state.rec) return;
    try{ state.rec.stop(); }catch{}
    state.isRecording = false;
    setRecordUI();
  }

  async function toggleRecording(){
    try{
      if(state.isRecording) await stopRecording();
      else await startRecording();
    }catch{
      state.isRecording = false;
      setRecordUI();
      alert("Recording failed. Make sure mic permission is allowed for this site.");
    }
  }

  /***********************
   * Projects dropdown (unchanged)
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

  function loadProjectById(id){
    const all = loadAllProjects().map(normalizeProject).filter(Boolean);
    const p = all.find(x => x.id === id);
    if(!p) return;
    state.project = p;
    localStorage.setItem(LS_CUR, p.id);
    renderAll();
  }

  /***********************
   * RHYMES (CLEAN)
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

    const currentText = String(ta.value||"");
    const pos = (typeof ta.selectionStart === "number") ? ta.selectionStart : currentText.length;
    const upto = currentText.slice(0, pos);

    // If current box is empty, rhyme last word of previous card
    if(!currentText.trim()){
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
      return "";
    }

    const words = upto.match(/[A-Za-z']+/g) || [];
    if(words.length === 0) return "";

    const endsWithLetter = /[A-Za-z']$/.test(upto);
    // If cursor is inside/at end of a word, rhyme PREVIOUS word
    if(endsWithLetter && words.length >= 2) return words[words.length - 2];
    return words[words.length - 1];
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
    if(!lastLyricsTextarea){
      const first = el.sheetBody.querySelector("textarea.lyrics");
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
    ta.selectionStart = ta.selectionEnd = newPos;

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
      b.className = "rWord"; // matches your CSS
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
   * Render all
   ***********************/
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
  }

  /***********************
   * Wiring
   ***********************/
  function wire(){
    el.togglePanelBtn.addEventListener("click", () => {
      const hidden = !el.panelBody.classList.contains("hidden");
      setPanelHidden(hidden);
    });

    el.autoSplitBtn.addEventListener("click", () => {
      state.autoSplit = !state.autoSplit;
      el.autoSplitBtn.classList.toggle("active", state.autoSplit);
      el.autoSplitBtn.textContent = "AutoSplit: " + (state.autoSplit ? "ON" : "OFF");
    });

    el.bpmInput.addEventListener("input", () => {
      state.bpm = clamp(parseInt(el.bpmInput.value || "95",10) || 95, 40, 220);
      el.bpmInput.value = String(state.bpm);
      if(state.drumsOn) startDrums();
    });

    el.capoInput.addEventListener("input", () => {
      state.capo = clamp(parseInt(el.capoInput.value || "0",10) || 0, 0, 12);
      el.capoInput.value = String(state.capo);
      updateKeyFromAllNotes();
      updateFullIfVisible();
    });

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
      renderAll();
    });

    el.rBtn.addEventListener("click", () => {
      const showing = el.rhymeDock.style.display === "block";
      toggleRhymeDock(!showing);
    });
    el.hideRhymeBtn.addEventListener("click", () => toggleRhymeDock(false));
  }

  /***********************
   * Init
   ***********************/
  function init(){
    state.project = getCurrentProject();

    el.autoSplitBtn.textContent = "AutoSplit: ON";
    el.autoSplitBtn.classList.add("active");

    setPanelHidden(false);
    setAutoScroll(false);

    state.instrumentOn = false;
    state.drumsOn = false;

    setRecordUI();
    wire();
    renderAll();

    stopBeatClock();
  }

  init();
})();
