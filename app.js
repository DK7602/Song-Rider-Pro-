/* Song Rider Pro - app.js (FULL REPLACE v17) */
(() => {
  "use strict";

  /***********************
   * Utils
   ***********************/
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const now = () => Date.now();

  // crypto.randomUUID fallback (older Android WebViews)
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

    autoPlayBtn: $("autoPlayBtn"), // scroll only
    mScrollBtn: $("mScrollBtn"),   // scroll only

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
  const LS_KEY = "songrider_v17_projects";
  const LS_CUR = "songrider_v17_currentProjectId";

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
  const DB_NAME = "songrider_db_v17";
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

    // audio toggles
    instrument: "piano",
    instrumentOn: false,

    drumStyle: "rap",
    drumsOn: false,

    // autoscroll only
    autoScrollOn: false,
    autoScrollTimer: null,

    // audio
    ctx: null,
    drumTimer: null,
    instNodes: null,

    // recordings playback
    currentAudio: null
  };

  /***********************
   * Audio (very lightweight “demo” engine)
   * - Drum loop: kick/snare/hat based on style
   * - Instrument: simple chord pad / pluck pattern per instrument
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
    // super-simple: kick = low sine, snare/hat = noise + tiny tone
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
    const stepMs = Math.round((60000 / bpm) / 2); // 8th notes
    let step = 0;

    state.drumTimer = setInterval(() => {
      if(!state.drumsOn) return;

      // 16-step pattern (8th = step, so 16 steps = 2 bars of 4/4 at 8ths)
      const s = step % 16;

      // styles
      if(state.drumStyle === "rap"){
        // kick on 1, “and” of 2, 3; snare on 2 & 4; hats steady
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
      } else { // pop
        if(s === 0 || s === 7 || s === 8) drumHit("kick");
        if(s === 4 || s === 12) drumHit("snare");
        // lighter hats
        if(s % 2 === 0) drumHit("hat");
      }

      step++;
    }, stepMs);
  }

  function stopInstrument(){
    const ctx = ensureCtx();
    if(state.instNodes){
      try{
        state.instNodes.oscs.forEach(o => o.stop());
      }catch{}
      try{
        state.instNodes.gain.disconnect();
      }catch{}
      state.instNodes = null;
    }
    state.instrumentOn = false;
  }

  function startInstrument(){
    stopInstrument();
    state.instrumentOn = true;

    const ctx = ensureCtx();

    // simple “C major” pad so you can hear ON/OFF clearly
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
    // green only when instrumentOn AND it matches
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

  /***********************
   * Tabs + editor
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

  function buildFullPreviewText(){
    const out = [];
    SECTIONS.filter(s => s !== "Full").forEach(sec => {
      const arr = state.project.sections[sec] || [];
      const hasAny = arr.some(x => String(x.lyrics || "").trim());
      if(!hasAny) return;
      out.push(sec.toUpperCase());
      out.push("");
      arr.forEach(line => {
        const t = String(line.lyrics || "").trim();
        if(t) out.push(t);
      });
      out.push("");
    });
    return out.join("\n").trim() || "(No lyrics yet — start typing in a section)";
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

  function renderSheet(){
    el.sheetTitle.textContent = state.currentSection;

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
      arr.push({ lyrics:"", notes:Array(8).fill("Not") });
    }

    arr.forEach((line, idx) => {
      const card = document.createElement("div");
      card.className = "card";

      const top = document.createElement("div");
      top.className = "cardTop";

      const num = document.createElement("div");
      num.className = "cardNum";
      num.textContent = String(idx + 1);

      const syll = document.createElement("div");
      syll.className = "syllPill";
      syll.textContent = "Syllables: " + countSyllablesInline(line.lyrics || "");

      top.appendChild(num);
      top.appendChild(syll);

      const notesRow = document.createElement("div");
      notesRow.className = "notesRow";
      const notes = Array.isArray(line.notes) ? line.notes : Array(8).fill("Not");

      for(let i=0;i<8;i++){
        const inp = document.createElement("input");
        inp.className = "noteCell";
        inp.value = notes[i] ?? "Not";
        inp.addEventListener("input", () => {
          notes[i] = String(inp.value || "").trim() || "Not";
          line.notes = notes;
          state.project.updatedAt = now();
          upsertProject(state.project);
          updateKeyFromAllNotes();
        });
        notesRow.appendChild(inp);
      }

      const lyr = document.createElement("textarea");
      lyr.className = "lyrics";
      lyr.placeholder = "Type lyrics (AutoSplit on)…";
      lyr.value = line.lyrics || "";
      lyr.addEventListener("input", () => {
        line.lyrics = lyr.value;
        state.project.updatedAt = now();
        upsertProject(state.project);
        syll.textContent = "Syllables: " + countSyllablesInline(line.lyrics || "");
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
   * Key detection + capo transpose (display only)
   ***********************/
  const NOTE_TO_PC = {
    "C":0,"C#":1,"DB":1,"D":2,"D#":3,"EB":3,"E":4,"F":5,"F#":6,"GB":6,"G":7,"G#":8,"AB":8,"A":9,"A#":10,"BB":10,"B":11
  };
  const PC_TO_NAME = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

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
        (Array.isArray(line.notes) ? line.notes : []).forEach(n => {
          const pc = noteToPC(n);
          if(pc !== null) hist[pc] += 1;
        });
      });
    });

    const k = keyFromHistogram(hist);
    // ✅ capo transpose display
    const transposedPC = (k.pc + (state.capo % 12) + 12) % 12;
    el.keyOutput.value = `${PC_TO_NAME[transposedPC]} ${k.mode}`;
  }

  /***********************
   * Recordings UI (same as before)
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

  async function startRecording(){
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const chunks = [];
    const rec = new MediaRecorder(stream);

    rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      const item = { id: uuid(), createdAt: now(), title: "", blob };
      await dbPut(item);
      await renderRecordings();
    };

    rec.start();
    beep(880, 60, 0.12);
    setTimeout(() => rec.stop(), 8000);
  }

  /***********************
   * Projects dropdown
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
   * Rhymes (simple stub so box always opens)
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
  }

  /***********************
   * Button wiring
   ***********************/
  function wire(){
    // panel
    el.togglePanelBtn.addEventListener("click", () => {
      const hidden = !el.panelBody.classList.contains("hidden");
      setPanelHidden(hidden);
    });

    // autosplit UI only
    el.autoSplitBtn.addEventListener("click", () => {
      state.autoSplit = !state.autoSplit;
      el.autoSplitBtn.classList.toggle("active", state.autoSplit);
      el.autoSplitBtn.textContent = "AutoSplit: " + (state.autoSplit ? "ON" : "OFF");
    });

    // bpm / capo
    el.bpmInput.addEventListener("input", () => {
      state.bpm = clamp(parseInt(el.bpmInput.value || "95",10) || 95, 40, 220);
      el.bpmInput.value = String(state.bpm);
      if(state.drumsOn) startDrums(); // re-time drums live
    });
    el.capoInput.addEventListener("input", () => {
      state.capo = clamp(parseInt(el.capoInput.value || "0",10) || 0, 0, 12);
      el.capoInput.value = String(state.capo);
      updateKeyFromAllNotes();
    });

    // ✅ Instruments: tap = ON, tap same again = OFF
    function handleInstrument(which){
      ensureCtx(); // unlock audio
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

    // ✅ Drums: tap = ON, tap same again = OFF, switch style while playing
    function handleDrums(which){
      ensureCtx(); // unlock audio
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

    // ✅ AutoScroll ONLY
    el.autoPlayBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));
    el.mScrollBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));

    // recording
    el.recordBtn.addEventListener("click", startRecording);
    el.mRecordBtn.addEventListener("click", startRecording);

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
      state.project.updatedAt = now();
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

    // start with everything OFF visually
    state.instrumentOn = false;
    state.drumsOn = false;
    renderRhymes();
    toggleRhymeDock(false);

    wire();
    renderAll();
  }

  init();
})();
