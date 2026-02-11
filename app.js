/* Song Rider Pro - app.js (FULL REPLACE)
   Implements:
   - Projects section (A-Z, Recent, rename, clear)
   - One-button AutoSplit toggle
   - BPM/Capo/Key in one line (small)
   - Instruments one line
   - Drums: click style to play; click again to stop (no Play button)
   - Record button in drum row
   - Recordings list with Edit(i), Play, Stop, Download, Delete
   - Full editor: like Beat Sheet full page (section headers + 20 cards) + notes row above lyric
   - Section pages: 20 cards each
   - Card layout:
       Card # + syll count pill (color rules)
       8 note boxes (auto-transposed by capo)
       lyric line
       4 timing boxes
   - Rhyme box floating bottom: suggests rhymes from typed words + built-in bank; click inserts into lyric
   - Better sounds: strummed acoustic/electric, piano-ish
*/

(() => {
  "use strict";

  /***********************
   * Storage isolation
   ***********************/
  const APP_SCOPE = (() => {
    try {
      const parts = location.pathname.split("/").filter(Boolean);
      return parts.length ? parts[0] : "root";
    } catch { return "root"; }
  })();

  const LS = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(`${APP_SCOPE}::songriderpro::${k}`);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(`${APP_SCOPE}::songriderpro::${k}`, JSON.stringify(v)); } catch {}
    }
  };

  /***********************
   * IndexedDB for recordings
   ***********************/
  const IDB_NAME = `${APP_SCOPE}__songriderpro_recordings`;
  const IDB_STORE = "recs";
  let idb = null;

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)){
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(key, blob){
    if (!idb) idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGet(key){
    if (!idb) idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbDel(key){
    if (!idb) idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /***********************
   * Pages / Sections
   ***********************/
  const PAGES = [
    { id:"full", name:"Full" },
    { id:"v1", name:"VERSE 1" },
    { id:"c1", name:"CHORUS 1" },
    { id:"v2", name:"VERSE 2" },
    { id:"c2", name:"CHORUS 2" },
    { id:"v3", name:"VERSE 3" },
    { id:"br", name:"BRIDGE" },
    { id:"c3", name:"CHORUS 3" },
  ];

  const SECTIONS = [
    { id:"v1", title:"VERSE 1" },
    { id:"c1", title:"CHORUS 1" },
    { id:"v2", title:"VERSE 2" },
    { id:"c2", title:"CHORUS 2" },
    { id:"v3", title:"VERSE 3" },
    { id:"br", title:"BRIDGE" },
    { id:"c3", title:"CHORUS 3" },
  ];

  const CARDS_PER_SECTION = 20;

  /***********************
   * DOM
   ***********************/
  const $ = (sel) => document.querySelector(sel);

  const headshotWrap = $("#headshotWrap");
  const headshotImg = $("#headshotImg");

  const togglePanelBtn = $("#togglePanelBtn");
  const panelBody = $("#panelBody");

  const autoSplitBtn = $("#autoSplitBtn");
  const bpmInput = $("#bpmInput");
  const capoInput = $("#capoInput");
  const keyOutput = $("#keyOutput");

  const instAcoustic = $("#instAcoustic");
  const instElectric = $("#instElectric");
  const instPiano = $("#instPiano");

  const drumRock = $("#drumRock");
  const drumHardRock = $("#drumHardRock");
  const drumPop = $("#drumPop");
  const drumRap = $("#drumRap");

  const recordBtn = $("#recordBtn");
  const stopRecordBtn = $("#stopRecordBtn");

  const projectSelect = $("#projectSelect");
  const renameProjectBtn = $("#renameProjectBtn");
  const clearProjectBtn = $("#clearProjectBtn");

  const recordingsList = $("#recordingsList");

  const tabsEl = $("#tabs");
  const editorRoot = $("#editorRoot");

  const rhymeDock = $("#rhymeDock");
  const rhymeTitle = $("#rhymeTitle");
  const rhymeWords = $("#rhymeWords");
  const hideRhymeBtn = $("#hideRhymeBtn");

  const statusEl = $("#status");
  function setStatus(msg){ statusEl.textContent = msg; }

  /***********************
   * State
   ***********************/
  const state = {
    pageId: "full",
    projectId: "A",
    recentProjects: [],
    autoSplit: false,
    bpm: 95,
    capo: 0,
    instrument: "acoustic", // acoustic | electric | piano
    drumStyle: null,        // rock | hardrock | pop | rap | null
    playing: false,
    tickIndex: 0,           // 0..7 (8th notes)
    cardPlayRef: null,      // { sectionId, cardIndex }
    // recordings metadata (small) stored in LS; blobs in IDB
    recordingsMeta: [],     // [{id, name, ts}]
    projectNames: {},       // {A:"My Song", ...}
    dataByProject: {}
  };

  /***********************
   * Model
   ***********************/
  function emptyCard(){
    return {
      notesRaw: Array(8).fill(""), // stored as "concert" (capo 0 internal)
      lyric: ""
    };
  }

  function emptySection(title){
    return {
      title,
      cards: Array.from({length: CARDS_PER_SECTION}, () => emptyCard())
    };
  }

  function defaultProjectData(){
    const sections = {};
    for (const s of SECTIONS){
      sections[s.id] = emptySection(s.title);
    }
    return {
      meta: {
        bpm: 95,
        capo: 0,
        autoSplit: false,
        instrument: "acoustic",
      },
      sections,
      updatedAt: Date.now()
    };
  }

  function clampInt(v, a, b){
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = Math.round(v);
    return Math.max(a, Math.min(b, v));
  }

  function getProject(){
    if (!state.dataByProject[state.projectId]){
      state.dataByProject[state.projectId] = defaultProjectData();
    }
    return state.dataByProject[state.projectId];
  }

  function touchProject(){
    const p = getProject();
    p.updatedAt = Date.now();
    state.recentProjects = [state.projectId, ...state.recentProjects.filter(x => x !== state.projectId)].slice(0, 10);
  }

  /***********************
   * Load/Save
   ***********************/
  function loadAll(){
    const saved = LS.get("state", null);
    const data = LS.get("dataByProject", null);
    const recent = LS.get("recentProjects", []);
    const recMeta = LS.get("recordingsMeta", []);
    const names = LS.get("projectNames", {});

    if (data && typeof data === "object") state.dataByProject = data;
    if (saved) Object.assign(state, saved);

    state.recentProjects = Array.isArray(recent) ? recent : [];
    state.recordingsMeta = Array.isArray(recMeta) ? recMeta : [];
    state.projectNames = (names && typeof names === "object") ? names : {};

    if (!state.dataByProject[state.projectId]){
      state.dataByProject[state.projectId] = defaultProjectData();
    }
    syncMetaFromProject();
  }

  function saveAll(){
    LS.set("state", {
      pageId: state.pageId,
      projectId: state.projectId,
      recentProjects: state.recentProjects,
      autoSplit: state.autoSplit,
      bpm: state.bpm,
      capo: state.capo,
      instrument: state.instrument,
      drumStyle: state.drumStyle,
      playing: false,
      tickIndex: 0
    });
    LS.set("dataByProject", state.dataByProject);
    LS.set("recentProjects", state.recentProjects);
    LS.set("recordingsMeta", state.recordingsMeta);
    LS.set("projectNames", state.projectNames);
  }

  function syncMetaFromProject(){
    const p = getProject();
    state.bpm = clampInt(p.meta?.bpm ?? state.bpm, 40, 220);
    state.capo = clampInt(p.meta?.capo ?? state.capo, 0, 12);
    state.autoSplit = !!(p.meta?.autoSplit ?? state.autoSplit);
    state.instrument = p.meta?.instrument ?? state.instrument;

    bpmInput.value = state.bpm;
    capoInput.value = state.capo;
    setAutoSplitButton();
    setInstrumentButtons();
  }

  function syncMetaToProject(){
    const p = getProject();
    p.meta = p.meta || {};
    p.meta.bpm = state.bpm;
    p.meta.capo = state.capo;
    p.meta.autoSplit = state.autoSplit;
    p.meta.instrument = state.instrument;
    touchProject();
    saveAll();
  }

  /***********************
   * Headshot load fallback
   ***********************/
  headshotImg.addEventListener("error", () => {
    // Try without "./"
    headshotImg.src = "headshot.png?v=2";
  });

  /***********************
   * UI builders
   ***********************/
  function buildTabs(){
    tabsEl.innerHTML = "";
    for (const p of PAGES){
      const b = document.createElement("button");
      b.className = "tab" + (state.pageId === p.id ? " active" : "");
      b.textContent = p.name;
      b.addEventListener("click", () => {
        state.pageId = p.id;
        render();
        saveAll();
      });
      tabsEl.appendChild(b);
    }
  }

  function buildProjectsSelect(){
    projectSelect.innerHTML = "";
    const optRecent = document.createElement("option");
    optRecent.value = "__RECENT__";
    optRecent.textContent = "Recent…";
    projectSelect.appendChild(optRecent);

    for (let i=0;i<26;i++){
      const letter = String.fromCharCode(65+i);
      const name = state.projectNames[letter] ? ` — ${state.projectNames[letter]}` : "";
      const opt = document.createElement("option");
      opt.value = letter;
      opt.textContent = `Project ${letter}${name}`;
      projectSelect.appendChild(opt);
    }

    projectSelect.value = state.projectId;
  }

  function openRecentPicker(){
    const rec = state.recentProjects.length ? state.recentProjects : ["A"];
    const pick = prompt(`Recent projects:\n${rec.join(", ")}\n\nType a letter to open:`, rec[0]);
    if (!pick) return;
    const letter = pick.trim().toUpperCase();
    if (!/^[A-Z]$/.test(letter)) { setStatus("Invalid project. Use A–Z."); return; }
    state.projectId = letter;
    if (!state.dataByProject[state.projectId]) state.dataByProject[state.projectId] = defaultProjectData();
    syncMetaFromProject();
    buildProjectsSelect();
    render();
    saveAll();
  }

  function setAutoSplitButton(){
    autoSplitBtn.textContent = `AutoSplit: ${state.autoSplit ? "ON" : "OFF"}`;
    autoSplitBtn.classList.toggle("active", state.autoSplit);
  }

  function setInstrumentButtons(){
    instAcoustic.classList.toggle("active", state.instrument === "acoustic");
    instElectric.classList.toggle("active", state.instrument === "electric");
    instPiano.classList.toggle("active", state.instrument === "piano");
  }

  function setDrumButtons(){
    const on = (btn, active) => btn.classList.toggle("active", active);
    on(drumRock, state.drumStyle === "rock");
    on(drumHardRock, state.drumStyle === "hardrock");
    on(drumPop, state.drumStyle === "pop");
    on(drumRap, state.drumStyle === "rap");
  }

  /***********************
   * Panel hide/show
   ***********************/
  let panelHidden = false;
  togglePanelBtn.addEventListener("click", () => {
    panelHidden = !panelHidden;
    panelBody.style.display = panelHidden ? "none" : "block";
    togglePanelBtn.textContent = panelHidden ? "Show" : "Hide";
  });

  /***********************
   * Controls events
   ***********************/
  autoSplitBtn.addEventListener("click", () => {
    state.autoSplit = !state.autoSplit;
    setAutoSplitButton();
    syncMetaToProject();
    render();
  });

  bpmInput.addEventListener("change", () => {
    state.bpm = clampInt(bpmInput.value, 40, 220);
    bpmInput.value = state.bpm;
    syncMetaToProject();
    if (state.playing) restartTransport();
  });

  capoInput.addEventListener("change", () => {
    state.capo = clampInt(capoInput.value, 0, 12);
    capoInput.value = state.capo;
    syncMetaToProject();
    render(); // updates displayed transposition
  });

  instAcoustic.addEventListener("click", () => { state.instrument="acoustic"; setInstrumentButtons(); syncMetaToProject(); });
  instElectric.addEventListener("click", () => { state.instrument="electric"; setInstrumentButtons(); syncMetaToProject(); });
  instPiano.addEventListener("click", () => { state.instrument="piano"; setInstrumentButtons(); syncMetaToProject(); });

  projectSelect.addEventListener("change", () => {
    const v = projectSelect.value;
    if (v === "__RECENT__"){ openRecentPicker(); return; }
    state.projectId = v;
    if (!state.dataByProject[state.projectId]) state.dataByProject[state.projectId] = defaultProjectData();
    syncMetaFromProject();
    render();
    saveAll();
  });

  renameProjectBtn.addEventListener("click", () => {
    const letter = state.projectId;
    const cur = state.projectNames[letter] || "";
    const name = prompt(`Rename Project ${letter}:`, cur);
    if (name === null) return;
    const clean = name.trim();
    if (!clean){
      delete state.projectNames[letter];
    } else {
      state.projectNames[letter] = clean.slice(0, 40);
    }
    saveAll();
    buildProjectsSelect();
  });

  clearProjectBtn.addEventListener("click", () => {
    if (!confirm(`Clear ALL data in Project ${state.projectId}?`)) return;
    state.dataByProject[state.projectId] = defaultProjectData();
    syncMetaFromProject();
    render();
    saveAll();
  });

  /***********************
   * Syllables + timing boxes (4)
   ***********************/
  function roughSyllables(word){
    const w = String(word);
    if (w.length <= 3) return [w];
    const vowels = "aeiouyAEIOUY";
    const out = [];
    let cur = "";
    let lastV = vowels.includes(w[0]);
    for (let i=0;i<w.length;i++){
      const ch = w[i];
      const isV = vowels.includes(ch);
      cur += ch;
      if (lastV && !isV){
        if (i+1 < w.length && vowels.includes(w[i+1])){
          out.push(cur.slice(0,-1));
          cur = ch;
        }
      }
      lastV = isV;
    }
    if (cur) out.push(cur);
    return out.map(s => s.trim()).filter(Boolean);
  }

  function extractSyllableUnits(text){
    const cleaned = (text || "").trim();
    if (!cleaned) return [];
    if (!state.autoSplit){
      return cleaned.split("/").map(s => s.trim()).filter(Boolean);
    }
    const words = cleaned
      .replace(/[“”"]/g,"")
      .replace(/[^\w'\- ]+/g," ")
      .split(/\s+/)
      .filter(Boolean);
    const parts = [];
    for (const w of words) parts.push(...roughSyllables(w));
    return parts;
  }

  function timingSlots4(text){
    const units = extractSyllableUnits(text);
    const count = units.length;

    // distribute into 4 boxes: 1-2-3-4 roughly evenly
    const slots = ["", "", "", ""];
    if (!units.length) return { slots, count };

    const per = Math.ceil(units.length / 4);
    for (let i=0;i<4;i++){
      const chunk = units.slice(i*per, (i+1)*per);
      slots[i] = chunk.join(" ");
    }
    return { slots, count };
  }

  // Your coloring rule:
  // red: 1-5 & 16+
  // yellow: 6-9 & 14-15
  // green: 10-13
  function syllColor(count){
    if (count >= 1 && count <= 5) return "red";
    if (count >= 16) return "red";
    if (count >= 6 && count <= 9) return "yellow";
    if (count >= 14 && count <= 15) return "yellow";
    if (count >= 10 && count <= 13) return "green";
    return "red"; // 0 -> treat as red
  }

  /***********************
   * Transposition (Capo)
   * We store notesRaw as "concert".
   * Displayed value = transpose(notesRaw, +capo)
   * When user types displayed, we store transpose(typed, -capo)
   ***********************/
  const NOTE_NAMES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const NOTE_NAMES_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

  function normalizeRoot(root){
    const r = root.replace(/[^A-Ga-g#b]/g,"");
    if (!r) return null;
    return r[0].toUpperCase() + r.slice(1);
  }
  function noteIndex(root){
    const r = normalizeRoot(root);
    if (!r) return null;
    let idx = NOTE_NAMES_SHARP.indexOf(r);
    if (idx !== -1) return idx;
    idx = NOTE_NAMES_FLAT.indexOf(r);
    if (idx !== -1) return idx;
    return null;
  }
  function idxToName(idx, preferFlats=false){
    idx = ((idx%12)+12)%12;
    return preferFlats ? NOTE_NAMES_FLAT[idx] : NOTE_NAMES_SHARP[idx];
  }
  function transposeRoot(root, semis){
    const idx = noteIndex(root);
    if (idx === null) return root;
    const preferFlats = /b/.test(root) && !/#/.test(root);
    return idxToName(idx + semis, preferFlats);
  }
  function transposeToken(token, semis){
    const s = String(token || "").trim();
    if (!s) return "";
    const m = s.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return s;

    const root = (m[1].toUpperCase() + (m[2]||""));
    const rest = (m[3]||"");

    const slash = rest.match(/^(.*)\/([A-Ga-g])([#b]?)\s*$/);
    if (slash){
      const before = slash[1] || "";
      const bassRoot = (slash[2].toUpperCase() + (slash[3]||""));
      const trRoot = transposeRoot(root, semis);
      const trBass = transposeRoot(bassRoot, semis);
      return `${trRoot}${before}/${trBass}`;
    }
    return `${transposeRoot(root, semis)}${rest}`;
  }

  /***********************
   * Key estimate (simple)
   ***********************/
  function estimateKey(project){
    const roots = [];
    for (const sid of Object.keys(project.sections || {})){
      const sec = project.sections[sid];
      for (const card of (sec.cards || [])){
        for (const raw of (card.notesRaw || [])){
          const tok = transposeToken(raw, state.capo).trim();
          const m = tok.match(/^([A-G])([#b]?)/);
          if (m) roots.push(m[1] + (m[2]||""));
        }
      }
    }
    if (!roots.length) return "";

    const count = new Map();
    for (const r of roots) count.set(r, (count.get(r)||0)+1);

    const MAJOR = [0,2,4,5,7,9,11];
    const MINOR = [0,2,3,5,7,8,10];

    const candidates = [];
    for (let tonic=0; tonic<12; tonic++){
      const majSet = new Set(MAJOR.map(x => (tonic+x)%12));
      const minSet = new Set(MINOR.map(x => (tonic+x)%12));
      let majScore=0, minScore=0;

      for (const [r,n] of count.entries()){
        const idx = noteIndex(r);
        if (idx === null) continue;
        if (majSet.has(idx)) majScore += n;
        if (minSet.has(idx)) minScore += n;
      }

      const tonicName = idxToName(tonic,false);
      const tonicNameF = idxToName(tonic,true);
      const tonicBoost = (count.get(tonicName)||0) + (count.get(tonicNameF)||0);

      candidates.push({mode:"Major", tonic, score:majScore + tonicBoost*0.6});
      candidates.push({mode:"Minor", tonic, score:minScore + tonicBoost*0.6});
    }

    candidates.sort((a,b)=>b.score-a.score);
    const best = candidates[0];
    if (!best) return "";
    const flatBias = roots.filter(r=>r.includes("b")).length > roots.filter(r=>r.includes("#")).length;
    return `${idxToName(best.tonic, flatBias)} ${best.mode}`;
  }

  /***********************
   * Rendering
   ***********************/
  function render(){
    buildTabs();
    buildProjectsSelect();
    setAutoSplitButton();
    setInstrumentButtons();
    setDrumButtons();

    const project = getProject();
    keyOutput.value = estimateKey(project) || "—";

    editorRoot.innerHTML = "";

    const header = document.createElement("div");
    header.className = "sheetHeader";

    const title = document.createElement("h2");
    const page = PAGES.find(p => p.id === state.pageId);
    title.textContent = page ? page.name : "Full";

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = (state.pageId === "full")
      ? "Full editor (master). Section pages are linked to this."
      : "Section page. Edit in Full for fastest workflow.";

    header.appendChild(title);
    header.appendChild(hint);
    editorRoot.appendChild(header);

    if (state.pageId === "full"){
      for (const s of SECTIONS){
        editorRoot.appendChild(renderSection(project, s.id, true));
      }
    } else {
      editorRoot.appendChild(renderSection(project, state.pageId, true)); // still editable here (as you want cards)
    }

    renderRecordings();
  }

  function renderSection(project, sectionId, editable){
    const sec = project.sections[sectionId];
    if (!sec) return document.createElement("div");

    const wrap = document.createElement("div");

    const sh = document.createElement("div");
    sh.className = "sectionHeader";
    sh.textContent = sec.title;

    const cards = document.createElement("div");
    cards.className = "cards";

    for (let i=0;i<CARDS_PER_SECTION;i++){
      const card = sec.cards[i];
      cards.appendChild(renderCard(sectionId, i, card, editable));
    }

    wrap.appendChild(sh);
    wrap.appendChild(cards);
    return wrap;
  }

  function renderCard(sectionId, cardIndex, card, editable){
    const cardEl = document.createElement("div");
    cardEl.className = "card";

    const key = `${sectionId}::${cardIndex}`;

    const { slots, count } = timingSlots4(card.lyric || "");

    const top = document.createElement("div");
    top.className = "cardTop";

    const num = document.createElement("div");
    num.className = "cardNum";
    num.textContent = `Card ${cardIndex+1}`;

    const pill = document.createElement("div");
    pill.className = `syllPill ${syllColor(count)}`;
    pill.textContent = `Syllables: ${count}`;

    top.appendChild(num);
    top.appendChild(pill);

    const notesRow = document.createElement("div");
    notesRow.className = "notesRow";

    for (let i=0;i<8;i++){
      const inp = document.createElement("input");
      inp.className = "noteCell";
      inp.placeholder = (i%2===0) ? "Note/Chord" : "";

      // DISPLAY transposed
      const showVal = transposeToken(card.notesRaw[i] || "", state.capo);
      inp.value = showVal;

      inp.setAttribute("data-notekey", key);
      inp.setAttribute("data-idx", String(i));

      inp.disabled = !editable;

      inp.addEventListener("focus", () => {
        state.cardPlayRef = { sectionId, cardIndex };
        updateRhymeBoxForCurrent();
      });

      if (editable){
        inp.addEventListener("input", () => {
          // store de-transposed so internal stays "concert"
          const typed = inp.value;
          card.notesRaw[i] = transposeToken(typed, -state.capo);
          touchProject(); saveAll();
          keyOutput.value = estimateKey(getProject()) || "—";
        });
      }

      notesRow.appendChild(inp);
    }

    const lyricRow = document.createElement("div");
    lyricRow.className = "lyricRow";

    const ta = document.createElement("textarea");
    ta.className = "lyrics";
    ta.placeholder = state.autoSplit
      ? "Type lyrics (AutoSplit on)…"
      : "Type lyrics and split timing with “/”…";
    ta.value = card.lyric || "";
    ta.disabled = !editable;

    ta.addEventListener("focus", () => {
      state.cardPlayRef = { sectionId, cardIndex };
      updateRhymeBoxForCurrent();
    });

    if (editable){
      ta.addEventListener("input", () => {
        card.lyric = ta.value;
        touchProject(); saveAll();

        const t = timingSlots4(card.lyric || "");
        pill.className = `syllPill ${syllColor(t.count)}`;
        pill.textContent = `Syllables: ${t.count}`;
        updateTimingRow(cardEl, key, t.slots);

        // Update rhymes live
        updateRhymeBoxForCurrent();
      });
    }

    lyricRow.appendChild(ta);

    const timingRow = document.createElement("div");
    timingRow.className = "timingRow";
    for (let i=0;i<4;i++){
      const cell = document.createElement("div");
      cell.className = "timingCell";
      cell.setAttribute("data-timekey", key);
      cell.setAttribute("data-idx", String(i));
      cell.textContent = slots[i] || "";
      timingRow.appendChild(cell);
    }

    cardEl.appendChild(top);
    cardEl.appendChild(notesRow);
    cardEl.appendChild(lyricRow);
    cardEl.appendChild(timingRow);

    return cardEl;
  }

  function updateTimingRow(cardEl, key, slots){
    for (let i=0;i<4;i++){
      const cell = cardEl.querySelector(`[data-timekey="${cssEscape(key)}"][data-idx="${i}"]`);
      if (cell) cell.textContent = slots[i] || "";
    }
  }

  function cssEscape(s){ return String(s).replace(/"/g, '\\"'); }

  /***********************
   * Rhyme box
   ***********************/
  hideRhymeBtn.addEventListener("click", () => {
    rhymeDock.style.display = "none";
  });

  function getLastWord(text){
    const cleaned = String(text || "")
      .trim()
      .replace(/[“”"]/g,"")
      .replace(/[^a-zA-Z'\- ]+/g," ")
      .trim();
    if (!cleaned) return "";
    const parts = cleaned.split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length-1].toLowerCase() : "";
  }

  const BUILTIN_WORDS = [
    "flow","glow","show","go","know","low","slow","throw","grow",
    "time","rhyme","climb","prime","line","shine","grind","mind","find",
    "day","play","stay","way","say","pray","okay","display",
    "night","light","fight","tight","right","bright","height",
    "pain","gain","train","chain","brain","lane",
    "real","feel","steel","deal","heal","seal","appeal",
    "game","name","flame","same","claim","frame"
  ];

  function collectProjectWords(){
    const project = getProject();
    const bag = new Set();
    for (const sid of Object.keys(project.sections || {})){
      const sec = project.sections[sid];
      for (const c of (sec.cards || [])){
        const txt = String(c.lyric || "");
        txt.split(/\s+/).forEach(w=>{
          const ww = w.toLowerCase().replace(/[^a-z'\-]/g,"").trim();
          if (ww && ww.length >= 3) bag.add(ww);
        });
      }
    }
    BUILTIN_WORDS.forEach(w=>bag.add(w));
    return Array.from(bag);
  }

  function rhymeCandidates(target){
    if (!target || target.length < 2) return [];
    const words = collectProjectWords();

    const suffix3 = target.slice(-3);
    const suffix2 = target.slice(-2);

    const scored = [];
    for (const w of words){
      if (w === target) continue;
      let score = 0;
      if (w.endsWith(suffix3)) score += 3;
      else if (w.endsWith(suffix2)) score += 2;

      // bonus: same last vowel group
      const v = (s) => (s.match(/[aeiouy]+/g) || []).pop() || "";
      if (v(w) && v(w) === v(target)) score += 1;

      if (score > 0) scored.push({w, score});
    }

    scored.sort((a,b)=> b.score-a.score || a.w.localeCompare(b.w));
    return scored.slice(0, 18).map(x=>x.w);
  }

  function updateRhymeBoxForCurrent(){
    const ref = state.cardPlayRef;
    if (!ref) return;

    // last word of PREVIOUS card in same section
    const project = getProject();
    const sec = project.sections[ref.sectionId];
    if (!sec) return;

    const prevIdx = Math.max(0, ref.cardIndex - 1);
    const prevText = sec.cards[prevIdx]?.lyric || "";
    const last = getLastWord(prevText);

    if (!last){
      rhymeDock.style.display = "none";
      return;
    }

    const rhymes = rhymeCandidates(last);
    if (!rhymes.length){
      rhymeDock.style.display = "none";
      return;
    }

    rhymeTitle.textContent = `Rhymes for “${last}” (tap to insert)`;
    rhymeWords.innerHTML = "";

    rhymes.forEach(word => {
      const b = document.createElement("div");
      b.className = "rWord";
      b.textContent = word;
      b.addEventListener("click", () => insertRhymeWord(word));
      rhymeWords.appendChild(b);
    });

    rhymeDock.style.display = "block";
  }

  function insertRhymeWord(word){
    const ref = state.cardPlayRef;
    if (!ref) return;
    const project = getProject();
    const card = project.sections?.[ref.sectionId]?.cards?.[ref.cardIndex];
    if (!card) return;

    const cur = (card.lyric || "").trim();
    card.lyric = cur ? (cur + " " + word) : word;

    touchProject(); saveAll();
    render();

    setStatus(`Inserted “${word}”.`);
  }

  /***********************
   * Highlighting while drums play:
   * - note highlight follows 8th-note index (0..7)
   * - timing highlight follows beat (0..3) quarter notes
   ***********************/
  function clearHighlights(){
    document.querySelectorAll(".noteCell.hl").forEach(el => el.classList.remove("hl"));
    document.querySelectorAll(".timingCell.hl").forEach(el => el.classList.remove("hl"));
  }

  function applyHighlights(eighthIndex){
    clearHighlights();

    const ref = state.cardPlayRef;
    if (!ref) return;

    const key = `${ref.sectionId}::${ref.cardIndex}`;

    const note = document.querySelector(`[data-notekey="${cssEscape(key)}"][data-idx="${eighthIndex}"]`);
    if (note) note.classList.add("hl");

    const beatIdx = Math.floor(eighthIndex / 2); // 0..3
    const timeCell = document.querySelector(`[data-timekey="${cssEscape(key)}"][data-idx="${beatIdx}"]`);
    if (timeCell) timeCell.classList.add("hl");
  }

  /***********************
   * Audio: drums + strummed instruments
   ***********************/
  let audioCtx = null;
  let master = null;
  let drumBus = null;
  let musicBus = null;
  let transportTimer = null;

  function ensureAudio(){
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);

    drumBus = audioCtx.createGain();
    drumBus.gain.value = 0.75;
    drumBus.connect(master);

    musicBus = audioCtx.createGain();
    musicBus.gain.value = 0.85;
    musicBus.connect(master);
  }

  function midiToFreq(m){ return 440 * Math.pow(2, (m - 69)/12); }

  function noteToFreq(token){
    const s = String(token || "").trim();
    const m = s.match(/^([A-Ga-g])([#b]?)(-?\d+)?$/);
    if (!m) return null;
    const root = (m[1].toUpperCase() + (m[2]||""));
    const octave = m[3] ? parseInt(m[3],10) : 4;
    const idx = noteIndex(root);
    if (idx === null) return null;
    const midi = (octave + 1) * 12 + (idx);
    return midiToFreq(midi);
  }

  function chordRootFreq(token){
    const s = String(token || "").trim();
    const m = s.match(/^([A-Ga-g])([#b]?)/);
    if (!m) return null;
    const root = (m[1].toUpperCase() + (m[2]||""));
    const idx = noteIndex(root);
    if (idx === null) return null;
    const octave = 3;
    const midi = (octave + 1) * 12 + idx;
    return midiToFreq(midi);
  }

  function makeDistCurve(amount){
    const n = 44100;
    const curve = new Float32Array(n);
    const k = typeof amount === "number" ? amount : 50;
    for (let i=0;i<n;i++){
      const x = (i * 2 / n) - 1;
      curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  // Drum synth
  function playKick(t){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(drumBus);
    o.start(t); o.stop(t + 0.13);
  }

  function playSnare(t){
    const bufferSize = audioCtx.sampleRate * 0.18;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0; i<bufferSize; i++){
      data[i] = (Math.random()*2-1) * Math.pow(1 - i/bufferSize, 2);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    noise.connect(filter); filter.connect(g); g.connect(drumBus);
    noise.start(t); noise.stop(t + 0.15);

    const o = audioCtx.createOscillator();
    const og = audioCtx.createGain();
    o.type="triangle";
    o.frequency.setValueAtTime(220, t);
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(og); og.connect(drumBus);
    o.start(t); o.stop(t + 0.12);
  }

  function playHat(t, open=false){
    const bufferSize = audioCtx.sampleRate * (open ? 0.12 : 0.05);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0; i<bufferSize; i++){
      data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6000;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(open ? 0.45 : 0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.10 : 0.04));

    src.connect(filter); filter.connect(g); g.connect(drumBus);
    src.start(t); src.stop(t + (open ? 0.12 : 0.06));
  }

  // Strummed pluck (acoustic)
  function pluckString(freq, t, dur, out){
    const sr = audioCtx.sampleRate;
    const n = Math.max(32, Math.floor(sr / freq));
    const buffer = audioCtx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    for (let i=0;i<n;i++) data[i] = (Math.random()*2-1) * 0.7;

    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const delay = audioCtx.createDelay();
    delay.delayTime.setValueAtTime(1 / freq, t);

    const feedback = audioCtx.createGain();
    feedback.gain.setValueAtTime(0.82, t);

    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, t);

    const body = audioCtx.createBiquadFilter();
    body.type = "peaking";
    body.frequency.setValueAtTime(240, t);
    body.Q.value = 1.2;
    body.gain.setValueAtTime(3.5, t);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);

    src.connect(lp);
    lp.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(body);
    body.connect(g);
    g.connect(out);

    src.start(t);
    src.stop(t + dur + 0.18);
  }

  // Electric strum with overdrive
  function electricString(freq, t, dur, out){
    const o = audioCtx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);

    const pre = audioCtx.createGain();
    pre.gain.setValueAtTime(0.9, t);

    const sh = audioCtx.createWaveShaper();
    sh.curve = makeDistCurve(260);
    sh.oversample = "4x";

    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, t);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.20);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);

    o.connect(pre);
    pre.connect(sh);
    sh.connect(lp);
    lp.connect(g);
    g.connect(out);

    o.start(t);
    o.stop(t + dur + 0.22);
  }

  // Piano-ish
  function pianoHit(freq, t, dur, out){
    const mix = audioCtx.createGain();
    mix.gain.setValueAtTime(0.9, t);
    mix.connect(out);

    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(5200, t);
    lp.connect(mix);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.28);
    g.connect(lp);

    const partials = [
      { m:1.0, a:1.00 },
      { m:2.0, a:0.40 },
      { m:3.0, a:0.22 },
      { m:4.0, a:0.12 },
      { m:5.0, a:0.07 }
    ];

    partials.forEach((p, i) => {
      const o = audioCtx.createOscillator();
      o.type = "sine";
      const inharm = 1 + (i*0.0008);
      o.frequency.setValueAtTime(freq * p.m * inharm, t);
      const og = audioCtx.createGain();
      og.gain.setValueAtTime(p.a / partials.length, t);
      o.connect(og);
      og.connect(g);
      o.start(t);
      o.stop(t + dur + 0.35);
    });
  }

  // Play note token (strum-ish): if chord, strum 5-string voicing; if single note, just hit one
  function playTokenStrum(token, t, dur){
    const raw = String(token || "").trim();
    if (!raw) return;

    // token displayed is already transposed; we want sounding => use displayed token
    const fNote = noteToFreq(raw);
    const fRoot = chordRootFreq(raw);
    const base = fNote || fRoot;
    if (!base) return;

    // build voicing (approx)
    const freqs = fNote ? [base] : [
      base,
      base * Math.pow(2, 4/12),
      base * Math.pow(2, 7/12),
      base * 2,
      base * 2 * Math.pow(2, 4/12),
    ];

    const strumMs = (state.instrument === "piano") ? 0 : (state.instrument === "electric" ? 14 : 18);

    freqs.slice(0,5).forEach((f, idx) => {
      const tt = t + (idx * strumMs / 1000);
      if (state.instrument === "acoustic") pluckString(f, tt, dur, musicBus);
      else if (state.instrument === "electric") electricString(f, tt, dur, musicBus);
      else pianoHit(f, tt, dur, musicBus);
    });
  }

  /***********************
   * Transport: drums auto-start with style button
   ***********************/
  function startTransport(){
    ensureAudio();
    audioCtx.resume?.();

    if (!state.cardPlayRef){
      state.cardPlayRef = { sectionId:"v1", cardIndex:0 };
    }

    if (state.playing) return;
    state.playing = true;
    state.tickIndex = 0;

    setStatus(`Playing • ${state.drumStyle.toUpperCase()} • ${state.bpm} BPM`);

    const msPerBeat = 60000 / state.bpm;
    const msPerEighth = msPerBeat / 2;

    transportTimer = setInterval(() => tick(), msPerEighth);
    tick(true);
  }

  function stopTransport(){
    if (transportTimer){
      clearInterval(transportTimer);
      transportTimer = null;
    }
    state.playing = false;
    state.tickIndex = 0;
    clearHighlights();
    headshotWrap.classList.remove("blink");
    setStatus("Stopped.");
  }

  function restartTransport(){
    stopTransport();
    if (state.drumStyle) startTransport();
  }

  function tick(forceBlink=false){
    if (!state.playing || !state.drumStyle) return;
    ensureAudio();
    const t = audioCtx.currentTime;
    const i = state.tickIndex % 8;
    const isQuarter = (i % 2 === 0);

    // drums patterns
    const style = state.drumStyle;

    const hatLevel = (style === "rap") ? 0.65 : 1.0;
    if (Math.random() < hatLevel) playHat(t, style === "hardrock" && i === 7);

    if (style === "rock"){
      if (i === 0 || i === 4) playKick(t);
      if (i === 2 || i === 6) playSnare(t);
    } else if (style === "hardrock"){
      if (i === 0 || i === 1 || i === 4 || i === 5) playKick(t);
      if (i === 2 || i === 6) playSnare(t);
    } else if (style === "pop"){
      if (i === 0 || i === 3 || i === 4) playKick(t);
      if (i === 2 || i === 6) playSnare(t);
      if (i === 7) playHat(t, true);
    } else if (style === "rap"){
      if (i === 0 || i === 5) playKick(t);
      if (i === 2 || i === 6) playSnare(t);
      if (Math.random() < 0.25) playHat(t + 0.02, false);
    }

    // highlights
    applyHighlights(i);

    // headshot blink
    if (isQuarter || forceBlink){
      headshotWrap.classList.add("blink");
      setTimeout(() => headshotWrap.classList.remove("blink"), 90);
    }

    // play instrument on eighth tick using the current note box
    const ref = state.cardPlayRef;
    const project = getProject();
    const card = project.sections?.[ref.sectionId]?.cards?.[ref.cardIndex];
    if (card){
      const displayed = transposeToken(card.notesRaw[i] || "", state.capo);
      if (displayed.trim()){
        const dur = (60 / state.bpm) / 2 * 1.25;
        playTokenStrum(displayed, t, dur);
      }
    }

    state.tickIndex = (state.tickIndex + 1) % 8;
  }

  /***********************
   * Drums buttons: click starts, click again stops
   ***********************/
  function toggleDrum(style){
    if (state.drumStyle === style){
      state.drumStyle = null;
      setDrumButtons();
      stopTransport();
      saveAll();
      return;
    }
    state.drumStyle = style;
    setDrumButtons();
    saveAll();
    startTransport();
  }

  drumRock.addEventListener("click", () => toggleDrum("rock"));
  drumHardRock.addEventListener("click", () => toggleDrum("hardrock"));
  drumPop.addEventListener("click", () => toggleDrum("pop"));
  drumRap.addEventListener("click", () => toggleDrum("rap"));

  /***********************
   * Focus tracking: current card to play + rhyme suggestions
   ***********************/
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!el) return;
    const card = el.closest?.(".card");
    if (!card) return;
    const noteCell = card.querySelector?.(".noteCell");
    if (!noteCell) return;
    const k = noteCell.getAttribute("data-notekey");
    if (!k) return;
    const [sectionId, idxStr] = k.split("::");
    const cardIndex = Number(idxStr);
    if (sectionId && Number.isFinite(cardIndex)){
      state.cardPlayRef = { sectionId, cardIndex };
      updateRhymeBoxForCurrent();
    }
  });

  /***********************
   * Recording system
   ***********************/
  let mediaRecorder = null;
  let recordedChunks = [];
  let micStream = null;
  let currentPlaybackAudio = null;

  function pickMimeType(){
    const types = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"];
    for (const t of types){
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  recordBtn.addEventListener("click", startRecording);
  stopRecordBtn.addEventListener("click", stopRecording);

  async function startRecording(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      micStream = stream;
      recordedChunks = [];

      mediaRecorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const id = `rec_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        await dbPut(id, blob);

        const meta = {
          id,
          name: `Recording ${new Date().toLocaleString()}`,
          ts: Date.now()
        };
        state.recordingsMeta = [meta, ...state.recordingsMeta].slice(0, 50);
        saveAll();
        renderRecordings();
        setStatus("Recording saved.");
      };

      mediaRecorder.start();
      recordBtn.disabled = true;
      stopRecordBtn.disabled = false;
      setStatus("Recording (mic)...");
    } catch(err){
      console.error(err);
      alert("Recording needs microphone permission.");
      setStatus("Mic permission denied/unavailable.");
    }
  }

  function stopRecording(){
    try{
      if (mediaRecorder && mediaRecorder.state !== "inactive"){
        mediaRecorder.stop();
      }
      if (micStream){
        micStream.getTracks().forEach(t=>t.stop());
        micStream = null;
      }
    } catch {}
    recordBtn.disabled = false;
    stopRecordBtn.disabled = true;
  }

  async function playRecording(id){
    const blob = await dbGet(id);
    if (!blob){
      setStatus("Recording missing.");
      return;
    }
    if (currentPlaybackAudio){
      try{ currentPlaybackAudio.pause(); } catch {}
      currentPlaybackAudio = null;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentPlaybackAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentPlaybackAudio = null;
    };
    audio.play();
    setStatus("Playing recording…");
  }

  function stopPlayback(){
    if (currentPlaybackAudio){
      try{ currentPlaybackAudio.pause(); currentPlaybackAudio.currentTime = 0; } catch {}
      currentPlaybackAudio = null;
      setStatus("Playback stopped.");
    }
  }

  async function downloadRecording(id){
    const blob = await dbGet(id);
    if (!blob){ setStatus("Recording missing."); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SongRiderPro_${state.projectId}_${id}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }

  async function deleteRecording(id){
    if (!confirm("Delete this recording?")) return;
    await dbDel(id);
    state.recordingsMeta = state.recordingsMeta.filter(x => x.id !== id);
    saveAll();
    renderRecordings();
    setStatus("Deleted recording.");
  }

  function renameRecording(id){
    const meta = state.recordingsMeta.find(x => x.id === id);
    if (!meta) return;
    const name = prompt("Rename recording:", meta.name || "");
    if (name === null) return;
    meta.name = name.trim().slice(0, 60) || meta.name;
    saveAll();
    renderRecordings();
  }

  function renderRecordings(){
    recordingsList.innerHTML = "";

    if (!state.recordingsMeta.length){
      const empty = document.createElement("div");
      empty.style.fontSize = "13px";
      empty.style.fontWeight = "900";
      empty.style.color = "#666";
      empty.textContent = "No recordings yet.";
      recordingsList.appendChild(empty);
      return;
    }

    state.recordingsMeta.forEach(meta => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.flexWrap = "wrap";
      row.style.padding = "8px 10px";
      row.style.border = "1px solid rgba(0,0,0,.10)";
      row.style.borderRadius = "12px";
      row.style.background = "#fff";

      const name = document.createElement("div");
      name.style.fontWeight = "1000";
      name.style.fontSize = "13px";
      name.style.flex = "1 1 auto";
      name.textContent = meta.name || meta.id;

      const btnI = mkMini("i", () => renameRecording(meta.id), "Edit name");
      const btnPlay = mkMini("▶", () => playRecording(meta.id), "Play");
      const btnStop = mkMini("■", () => stopPlayback(), "Stop");
      const btnDown = mkMini("⬇", () => downloadRecording(meta.id), "Download");
      const btnDel = mkMini("🗑", () => deleteRecording(meta.id), "Delete");

      row.appendChild(name);
      row.appendChild(btnI);
      row.appendChild(btnPlay);
      row.appendChild(btnStop);
      row.appendChild(btnDown);
      row.appendChild(btnDel);

      recordingsList.appendChild(row);
    });
  }

  function mkMini(txt, fn, title){
    const b = document.createElement("button");
    b.className = "btn secondary";
    b.style.padding = "8px 10px";
    b.style.borderRadius = "10px";
    b.style.fontWeight = "1100";
    b.style.fontSize = "13px";
    b.textContent = txt;
    b.title = title || "";
    b.addEventListener("click", fn);
    return b;
  }

  /***********************
   * Init
   ***********************/
  function init(){
    loadAll();
    buildTabs();
    buildProjectsSelect();
    setAutoSplitButton();
    setInstrumentButtons();
    setDrumButtons();
    render();
    renderRecordings();
    saveAll();
    setStatus("Ready.");
  }

  init();
})();
