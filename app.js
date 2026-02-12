/* Song Rider Pro - app.js (FULL REPLACE v18) */
(() => {
  "use strict";

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
    rhymeWords: $("rhymeWords")
  };

  /***********************
   * Sections
   ***********************/
  const SECTIONS = ["Full","VERSE 1","CHORUS 1","VERSE 2","CHORUS 2","VERSE 3","CHORUS 3","BRIDGE","OUTRO"];

  /***********************
   * Project storage (localStorage)
   ***********************/
  const LS_KEY = "songrider_v18_projects";
  const LS_CUR = "songrider_v18_currentProjectId";

  function newLine(){
    return {
      id: uuid(),
      lyrics: "",
      notes: Array(8).fill("Not")
    };
  }

  function defaultProject(name="New Song"){
    return {
      id: uuid(),
      name,
      createdAt: now(),
      updatedAt: now(),
      sections: Object.fromEntries(SECTIONS.filter(s=>s!=="Full").map(s => [s, []]))
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

  function getCurrentProject(){
    const all = loadAllProjects();
    if(all.length === 0){
      const p = defaultProject("New Song");
      upsertProject(p);
      return p;
    }
    const curId = localStorage.getItem(LS_CUR);
    return (curId && all.find(p => p.id === curId)) || all[0];
  }

  /***********************
   * IndexedDB (Recordings)
   ***********************/
  const DB_NAME = "songrider_db_v18";
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
    instNodes: null,

    currentAudio: null,

    // recording
    isRecording: false,
    recStream: null,
    rec: null,
    recChunks: []
  };

  /***********************
   * Audio (demo engine)
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

  function beep(freq=440, ms=70, gain=0.10){
    const ctx = ensureCtx();
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
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
    if(kind === "kick") beep(70, 90, 0.16);
    if(kind === "snare"){ noise(60, 0.10); beep(180, 40, 0.04); }
    if(kind === "hat"){ noise(25, 0.05); }
  }

  function stopDrums(){
    if(state.drumTimer){
      clearInterval(state.drumTimer);
      state.drumTimer = null;
    }
    state.drumsOn = false;
  }

  function startDrums(){
    stopDrums();
    state.drumsOn = true;

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

  function stopInstrument(){
    ensureCtx();
    if(state.instNodes){
      try{ state.instNodes.oscs.forEach(o => o.stop()); }catch{}
      try{ state.instNodes.gain.disconnect(); }catch{}
      state.instNodes = null;
    }
    state.instrumentOn = false;
  }

  function startInstrument(){
    stopInstrument();
    state.instrumentOn = true;

    const ctx = ensureCtx();
    const freqs = [261.63, 329.63, 392.00]; // C E G
    const oscs = freqs.map(f => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.type = (state.instrument === "electric") ? "sawtooth" : (state.instrument === "acoustic" ? "triangle" : "sine");
      return o;
    });

    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.05);

    oscs.forEach(o => o.connect(g));
    g.connect(ctx.destination);
    oscs.forEach(o => o.start());

    state.instNodes = { oscs, gain: g };
  }

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
    el.autoPlayBtn?.classList.toggle("on", state.autoScrollOn);
    el.mScrollBtn?.classList.toggle("on", state.autoScrollOn);

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
   * Sections + editor
   ***********************/
  function ensureSectionArray(sec){
    if(sec === "Full") return [];
    if(!state.project.sections[sec]) state.project.sections[sec] = [];
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
   * Capo transpose helpers (display)
   ***********************/
  const NOTE_TO_PC = {
    "C":0,"C#":1,"DB":1,"D":2,"D#":3,"EB":3,"E":4,"F":5,"F#":6,"GB":6,"G":7,"G#":8,"AB":8,"A":9,"A#":10,"BB":10,"B":11
  };
  const PC_TO_NAME = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  function parseRootToken(token){
    const s = String(token||"").trim();
    if(!s) return null;
    // match root like C, C#, Db then keep rest (Am7, Gsus4, etc.)
    const m = s.match(/^([A-Ga-g])([#bB])?(.*)$/);
    if(!m) return null;
    const L = m[1].toUpperCase();
    const acc = (m[2] || "").toUpperCase();
    const rest = m[3] || "";
    const key = L + (acc === "B" ? "B" : acc === "#" ? "#" : "");
    const pc = NOTE_TO_PC[key];
    if(pc === undefined) return null;
    return { pc, rest };
  }

  function transposeToken(token, semis){
    const t = parseRootToken(token);
    if(!t) return token;
    const pc2 = (t.pc + (semis % 12) + 12) % 12;
    return PC_TO_NAME[pc2] + t.rest;
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

  function noteToPC(n){
    const s = String(n||"").trim().toUpperCase();
    if(!s || s === "NOT") return null;
    const m = s.match(/^([A-G])([#B])?/);
    if(!m) return null;
    const root = m[1];
    const acc = (m[2] || "").toUpperCase();
    const key = root + (acc === "B" ? "B" : acc === "#" ? "#" : "");
    return NOTE_TO_PC[key] ?? null;
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
        (Array.isArray(line.notes) ? line.notes : []).forEach(n => {
          const pc = noteToPC(n);
          if(pc !== null) hist[pc] += 1;
        });
      });
    });

    const k = keyFromHistogram(hist);
    const transposedPC = (k.pc + (state.capo % 12) + 12) % 12;
    el.keyOutput.value = `${PC_TO_NAME[transposedPC]} ${k.mode}`;
  }

  /***********************
   * Full preview (lyrics + notes)
   ***********************/
  function buildFullPreviewText(){
    const out = [];
    const semis = state.capo % 12;

    let any = false;

    SECTIONS.filter(s => s !== "Full").forEach(sec => {
      const arr = state.project.sections[sec] || [];
      const hasAny = arr.some(x => String(x.lyrics || "").trim() || (Array.isArray(x.notes) && x.notes.some(n => String(n||"").trim() && String(n).trim() !== "Not")));
      if(!hasAny) return;

      any = true;
      out.push(sec.toUpperCase());
      out.push("");

      arr.forEach((line, idx) => {
        const lyr = String(line.lyrics || "").trim();
        const notes = Array.isArray(line.notes) ? line.notes : [];
        const notesClean = notes.map(n => String(n ?? "").trim() || "Not");

        // capo-transposed display for notes ONLY in the Full preview
        const notesTx = notesClean.map(n => {
          if(!n || n.toLowerCase() === "not") return "Not";
          return transposeToken(n, semis);
        });

        const notesLine = notesTx.join(" | ");
        const hasNotes = notesTx.some(n => n !== "Not");

        if(hasNotes) out.push(`(${idx+1})  ${notesLine}`);
        if(lyr) out.push(`     ${lyr}`);
        if(hasNotes || lyr) out.push("");
      });

      out.push("");
    });

    return any ? out.join("\n").trim() : "(No lyrics/notes yet — start typing in a section)";
  }

  function updateFullIfVisible(){
    if(state.currentSection !== "Full") return;
    const ta = el.sheetBody.querySelector("textarea.fullBox");
    if(ta) ta.value = buildFullPreviewText();
  }

  /***********************
   * Sheet rendering
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
    });

    el.sheetActions.appendChild(addBtn);
  }

  function renderSheet(){
    el.sheetTitle.textContent = state.currentSection;
    renderSheetActions();

    if(state.currentSection === "Full"){
      el.sheetHint.textContent = "Full Sheet Preview (auto from your cards):";
      el.sheetBody.innerHTML = "";

      const wrap = document.createElement("div");
      wrap.className = "fullBoxWrap";

      const ta = document.createElement("textarea");
      ta.className = "fullBox";
      ta.readOnly = true;
      ta.value = buildFullPreviewText();

      wrap.appendChild(ta);
      el.sheetBody.appendChild(wrap);
      return;
    }

    el.sheetHint.textContent = "";
    const cardsWrap = document.createElement("div");
    cardsWrap.className = "cards";

    const arr = ensureSectionArray(state.currentSection);
    if(arr.length === 0){
      arr.push(newLine());
      upsertProject(state.project);
    }

    arr.forEach((line, idx) => {
      // normalize
      if(!Array.isArray(line.notes)) line.notes = Array(8).fill("Not");

      const card = document.createElement("div");
      card.className = "card";

      const top = document.createElement("div");
      top.className = "cardTop";

      const num = document.createElement("div");
      num.className = "cardNum";
      num.textContent = String(idx + 1);
      num.title = "Long-press to delete this line";

      // Long-press to delete (mobile friendly, no clutter)
      let pressTimer = null;
      const startPress = () => {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          if(!confirm(`Delete line ${idx+1} from ${state.currentSection}?`)) return;
          arr.splice(idx, 1);
          if(arr.length === 0) arr.push(newLine());
          upsertProject(state.project);
          renderSheet();
          updateFullIfVisible();
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
        inp.value = (line.notes[i] ?? "Not");
        inp.autocomplete = "off";
        inp.autocapitalize = "characters";
        inp.spellcheck = false;

        // ensures taps always focus the input
        inp.addEventListener("pointerdown", (e)=>{ e.stopPropagation(); });

        inp.addEventListener("input", () => {
          const v = String(inp.value || "").trim();
          line.notes[i] = v || "Not";
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

      lyr.addEventListener("input", () => {
        line.lyrics = lyr.value;
        syll.textContent = "Syllables: " + countSyllablesInline(line.lyrics || "");
        upsertProject(state.project);
        updateFullIfVisible();

        // AutoSplit: pressing Enter creates a new line/card
        if(state.autoSplit && lyr.value.includes("\n")){
          const parts = lyr.value.split("\n");
          const first = parts.shift();
          line.lyrics = first;
          const rest = parts.join("\n").trim();
          if(rest){
            const nl = newLine();
            nl.lyrics = rest;
            arr.splice(idx+1, 0, nl);
          }
          upsertProject(state.project);
          renderSheet();
          updateFullIfVisible();
        }
      });

      card.appendChild(top);
      card.appendChild(notesRow);
      card.appendChild(lyr);
      cardsWrap.appendChild(card);
    });

    el.sheetBody.innerHTML = "";
    el.sheetBody.appendChild(cardsWrap);
  }

  /***********************
   * Recordings UI
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

        if(state.currentAudio){
          try{ state.currentAudio.pause(); }catch{}
          state.currentAudio = null;
        }

        const audio = new Audio(url);
        state.currentAudio = audio;
        audio.play().catch(()=>{});
        audio.onended = () => {
          URL.revokeObjectURL(url);
          state.currentAudio = null;
        };
      });

      const stop = document.createElement("button");
      stop.className="btn secondary";
      stop.textContent="■";
      stop.title="Stop";
      stop.addEventListener("click", () => {
        if(state.currentAudio){
          try{ state.currentAudio.pause(); state.currentAudio.currentTime = 0; }catch{}
          state.currentAudio = null;
        }
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
      row.appendChild(stop);
      row.appendChild(download);
      row.appendChild(del);
      el.recordingsList.appendChild(row);
    });
  }

  /***********************
   * Recording start/stop (FIXED)
   ***********************/
  async function startRecording(){
    // iOS/Safari sometimes needs user gesture; we already have click
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
    beep(880, 60, 0.12);
  }

  async function stopRecording(){
    if(!state.rec) return;
    try{
      state.rec.stop();
    }catch{}
    state.isRecording = false;
    setRecordUI();
    beep(220, 60, 0.10);
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
   * Projects dropdown (FIXED)
   ***********************/
  function renderProjectsDropdown(){
    const all = loadAllProjects();

    const sort = el.sortSelect.value;
    let list = [...all];
    if(sort === "az"){
      list.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    }else{
      list.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    }

    el.projectSelect.innerHTML = "";
    list.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || "Untitled";
      if(state.project && p.id === state.project.id) opt.selected = true;
      el.projectSelect.appendChild(opt);
    });

    // If for any reason dropdown ends empty, recreate one project
    if(el.projectSelect.options.length === 0){
      const p = defaultProject("New Song");
      upsertProject(p);
      state.project = p;
      renderProjectsDropdown();
    }
  }

  function loadProjectById(id){
    const all = loadAllProjects();
    const p = all.find(x => x.id === id);
    if(!p) return;
    state.project = p;
    localStorage.setItem(LS_CUR, p.id);
    renderAll();
  }

  /***********************
   * Rhymes (always opens)
   ***********************/
  const DEMO_RHYMES = ["flow", "go", "show", "pro", "mode", "road", "cold", "bold", "gold", "hold"];
  function renderRhymes(){
    el.rhymeWords.innerHTML = "";
    DEMO_RHYMES.forEach(w => {
      const b = document.createElement("div");
      b.className = "rWord";
      b.textContent = w;
      b.addEventListener("click", () => {
        navigator.clipboard?.writeText(w).catch(()=>{});
        beep(660, 40, 0.08);
      });
      el.rhymeWords.appendChild(b);
    });
  }
  function toggleRhymeDock(show){
    el.rhymeDock.style.display = show ? "block" : "none";
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
  }

  /***********************
   * Wiring
   ***********************/
  function wire(){
    // panel
    el.togglePanelBtn.addEventListener("click", () => {
      const hidden = !el.panelBody.classList.contains("hidden");
      setPanelHidden(hidden);
    });

    // autosplit
    el.autoSplitBtn.addEventListener("click", () => {
      state.autoSplit = !state.autoSplit;
      el.autoSplitBtn.classList.toggle("active", state.autoSplit);
      el.autoSplitBtn.textContent = "AutoSplit: " + (state.autoSplit ? "ON" : "OFF");
    });

    // bpm / capo
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

    // instruments
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

    // drums
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

    // autoscroll ONLY
    el.autoPlayBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));
    el.mScrollBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));

    // recording (FIXED toggle)
    el.recordBtn.addEventListener("click", toggleRecording);
    el.mRecordBtn.addEventListener("click", toggleRecording);

    // projects
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

    // rhymes
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

    renderRhymes();
    toggleRhymeDock(false);

    setRecordUI();
    wire();
    renderAll();
  }

  init();
})();
