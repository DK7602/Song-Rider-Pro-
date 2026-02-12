/* Song Rider Pro - app.js (FULL REPLACE) */
(() => {
  "use strict";

  /***********************
   * Small helpers
   ***********************/
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const now = () => Date.now();

  /***********************
   * DOM
   ***********************/
  const el = {
    // panel
    togglePanelBtn: $("togglePanelBtn"),
    panelBody: $("panelBody"),
    miniBar: $("miniBar"),

    // controls
    autoSplitBtn: $("autoSplitBtn"),
    bpmInput: $("bpmInput"),
    capoInput: $("capoInput"),
    keyOutput: $("keyOutput"),

    // instrument pills
    instAcoustic: $("instAcoustic"),
    instElectric: $("instElectric"),
    instPiano: $("instPiano"),

    // drum pills
    drumRock: $("drumRock"),
    drumHardRock: $("drumHardRock"),
    drumPop: $("drumPop"),
    drumRap: $("drumRap"),

    // mini bar drum pills
    mRock: $("mRock"),
    mHardRock: $("mHardRock"),
    mPop: $("mPop"),
    mRap: $("mRap"),

    // scroll + record
    autoPlayBtn: $("autoPlayBtn"), // scroll only
    mScrollBtn: $("mScrollBtn"),   // scroll only
    recordBtn: $("recordBtn"),
    mRecordBtn: $("mRecordBtn"),

    // projects
    sortSelect: $("sortSelect"),
    projectSelect: $("projectSelect"),
    renameProjectBtn: $("renameProjectBtn"),
    deleteProjectBtn: $("deleteProjectBtn"),

    // recordings
    recordingsList: $("recordingsList"),

    // editor
    tabs: $("tabs"),
    sheetTitle: $("sheetTitle"),
    sheetHint: $("sheetHint"),
    sheetBody: $("sheetBody"),

    // rhyme
    rBtn: $("rBtn"),
    rhymeDock: $("rhymeDock"),
    hideRhymeBtn: $("hideRhymeBtn")
  };

  /***********************
   * Data model
   ***********************/
  const SECTIONS = ["VERSE 1","CHORUS 1","VERSE 2","CHORUS 2","VERSE 3","CHORUS 3","BRIDGE","OUTRO","Full"];

  const defaultProject = () => ({
    id: crypto.randomUUID(),
    name: "New Project",
    createdAt: now(),
    updatedAt: now(),
    sections: Object.fromEntries(SECTIONS.map(s => [s, []]))
  });

  const state = {
    project: null,
    currentSection: "Full",
    bpm: 95,
    capo: 0,
    autoSplit: true,

    instrument: "piano",   // "acoustic" | "electric" | "piano"
    drumStyle: "rap",      // "rock" | "hardrock" | "pop" | "rap"

    // AutoScroll ONLY
    autoScrollOn: false,
    autoScrollTimer: null,

    // Audio
    ctx: null,
    drumTimer: null,
    drumOn: false,
    currentAudio: null, // for recordings playback stop
  };

  /***********************
   * Storage (localStorage)
   ***********************/
  const LS_KEY = "songrider_v16_projects";
  const LS_CUR = "songrider_v16_currentProjectId";

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
    if(i >= 0) all[i] = p; else all.unshift(p);
    saveAllProjects(all);
    localStorage.setItem(LS_CUR, p.id);
  }
  function deleteProject(id){
    const all = loadAllProjects().filter(p => p.id !== id);
    saveAllProjects(all);
    localStorage.removeItem(LS_CUR);
  }
  function getCurrentProject(){
    const all = loadAllProjects();
    if(all.length === 0){
      const p = defaultProject();
      upsertProject(p);
      return p;
    }
    const curId = localStorage.getItem(LS_CUR);
    const found = curId ? all.find(p => p.id === curId) : null;
    return found || all[0];
  }

  /***********************
   * IndexedDB (Recordings)
   ***********************/
  const DB_NAME = "songrider_db_v16";
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
   * Audio core (simple)
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

  function playClick(freq=440, ms=80){
    const ctx = ensureCtx();
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + ms/1000 + 0.02);
  }

  /***********************
   * UI state helpers
   ***********************/
  function setActivePill(groupIds, activeId){
    groupIds.forEach(id => {
      const b = $(id);
      if(!b) return;
      b.classList.toggle("active", id === activeId);
    });
  }

  function setInstrument(which){
    state.instrument = which;
    setActivePill(["instAcoustic","instElectric","instPiano"], ({
      acoustic:"instAcoustic",
      electric:"instElectric",
      piano:"instPiano"
    })[which]);

    // ✅ instrument buttons should DO something immediately
    // quick ear-test ping so you know it worked
    const f = which === "acoustic" ? 330 : which === "electric" ? 440 : 523.25;
    playClick(f, 80);
  }

  function setDrumStyle(which){
    state.drumStyle = which;

    const map = {
      rock: "drumRock",
      hardrock: "drumHardRock",
      pop: "drumPop",
      rap: "drumRap"
    };
    setActivePill(Object.values(map), map[which]);

    const mapMini = {
      rock: "mRock",
      hardrock: "mHardRock",
      pop: "mPop",
      rap: "mRap"
    };
    setActivePill(Object.values(mapMini), mapMini[which]);

    // ✅ audible confirmation so you KNOW the press worked
    playClick(196, 60);
  }

  /***********************
   * AutoScroll ONLY (no audio)
   ***********************/
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

  /***********************
   * Tabs + editor rendering
   ***********************/
  function ensureSectionArray(sec){
    if(!state.project.sections[sec]) state.project.sections[sec] = [];
    return state.project.sections[sec];
  }

  function renderTabs(){
    el.tabs.innerHTML = "";
    const show = SECTIONS.slice(0, -1); // exclude "Full" from list, we add it first
    const order = ["Full", ...show];

    order.forEach(sec => {
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

  function renderSheet(){
    el.sheetTitle.textContent = state.currentSection;

    // FULL view: big box preview + tools
    if(state.currentSection === "Full"){
      el.sheetHint.textContent = "Full Sheet Preview (auto from your cards):";
      const wrap = document.createElement("div");
      wrap.className = "fullBoxWrap";

      const btnRow = document.createElement("div");
      btnRow.className = "row";
      btnRow.style.padding = "0 0 10px 0";

      const showPaste = document.createElement("button");
      showPaste.className = "btn secondary";
      showPaste.textContent = "Show Paste Area";

      const apply = document.createElement("button");
      apply.className = "btn secondary";
      apply.textContent = "Apply to Sections";

      btnRow.appendChild(showPaste);
      btnRow.appendChild(apply);

      const ta = document.createElement("textarea");
      ta.className = "fullBox";
      ta.readOnly = true;
      ta.value = buildFullPreviewText();

      wrap.appendChild(btnRow);
      wrap.appendChild(document.createTextNode("Full Sheet Preview (auto from your cards):"));
      wrap.appendChild(document.createElement("div")).style.height = "6px";
      wrap.appendChild(ta);

      el.sheetBody.innerHTML = "";
      el.sheetBody.appendChild(wrap);
      return;
    }

    // Section view: cards
    el.sheetHint.textContent = "";
    const cardsWrap = document.createElement("div");
    cardsWrap.className = "cards";

    const arr = ensureSectionArray(state.currentSection);
    if(arr.length === 0){
      // seed one empty line
      arr.push({ lyrics:"", notes:Array(8).fill("Not"), timing:["","","",""] });
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
          const v = String(inp.value || "").trim();
          notes[i] = v ? v : "Not";
          line.notes = notes;
          state.project.updatedAt = now();
          upsertProject(state.project);
          updateKeyFromAllNotes();
        });
        inp.addEventListener("blur", () => {
          // normalize "not"
          const v = String(inp.value || "").trim();
          inp.value = v ? v : "Not";
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
        if(state.autoSplit){
          // optional: keep simple (no auto-splitting surprises)
        }
      });

      card.appendChild(top);
      card.appendChild(notesRow);
      card.appendChild(lyr);

      cardsWrap.appendChild(card);
    });

    el.sheetBody.innerHTML = "";
    el.sheetBody.appendChild(cardsWrap);

    updateKeyFromAllNotes();
  }

  function buildFullPreviewText(){
    const lines = [];
    SECTIONS.filter(s => s !== "Full").forEach(sec => {
      const arr = state.project.sections[sec] || [];
      const hasAny = arr.some(x => String(x.lyrics || "").trim());
      if(!hasAny) return;
      lines.push(sec.toUpperCase());
      lines.push("");
      arr.forEach(line => {
        const t = String(line.lyrics || "").trim();
        if(t) lines.push(t);
      });
      lines.push("");
    });
    return lines.join("\n").trim();
  }

  /***********************
   * Key detection (simple)
   ***********************/
  const NOTE_TO_PC = {
    "C":0,"C#":1,"DB":1,"D":2,"D#":3,"EB":3,"E":4,"F":5,"F#":6,"GB":6,"G":7,"G#":8,"AB":8,"A":9,"A#":10,"BB":10,"B":11
  };
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
  function dot(a,b){
    let s=0;
    for(let i=0;i<12;i++) s += (a[i]||0) * (b[i]||0);
    return s;
  }
  function norm(v){
    return Math.sqrt(v.reduce((a,x)=>a+(x*x),0)) || 1;
  }
  function rotate(arr, t){
    const out = Array(12).fill(0);
    for(let i=0;i<12;i++) out[(i+t)%12] = arr[i];
    return out;
  }
  function keyFromHistogram(hist){
    const hn = norm(hist);
    let best = { score:-1e9, name:"—" };

    for(let t=0;t<12;t++){
      const maj = rotate(MAJOR_PROFILE, t);
      const min = rotate(MINOR_PROFILE, t);
      const sMaj = dot(hist, maj)/hn/norm(maj);
      const sMin = dot(hist, min)/hn/norm(min);

      if(sMaj > best.score){
        best = { score:sMaj, name: pcToName(t) + " maj" };
      }
      if(sMin > best.score){
        best = { score:sMin, name: pcToName(t) + " min" };
      }
    }
    return best.name;
  }
  function pcToName(pc){
    const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    return names[pc%12];
  }

  function updateKeyFromAllNotes(){
    const hist = Array(12).fill(0);
    SECTIONS.filter(s => s !== "Full").forEach(sec => {
      (state.project.sections[sec] || []).forEach(line => {
        const notes = Array.isArray(line.notes) ? line.notes : [];
        notes.forEach(n => {
          const pc = noteToPC(n);
          if(pc !== null) hist[pc] += 1;
        });
      });
    });
    el.keyOutput.value = keyFromHistogram(hist);
  }

  /***********************
   * Recordings UI (layout fixed)
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

      // rename
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

      // play
      const play = document.createElement("button");
      play.className="btn secondary";
      play.textContent="▶";
      play.title="Play";
      play.addEventListener("click", () => {
        if(!rec.blob) return;
        const url = URL.createObjectURL(rec.blob);

        // stop any previous playback
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

      // stop
      const stop = document.createElement("button");
      stop.className="btn secondary";
      stop.textContent="■";
      stop.title="Stop";
      stop.addEventListener("click", () => {
        if(state.currentAudio){
          try{
            state.currentAudio.pause();
            state.currentAudio.currentTime = 0;
          }catch{}
          state.currentAudio = null;
        }
      });

      // download
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

      // delete
      const del = document.createElement("button");
      del.className="btn secondary";
      del.textContent="🗑️";
      del.title="Delete recording";
      del.addEventListener("click", async () => {
        if(!confirm("Delete this recording?")) return;
        await dbDelete(rec.id);
        renderRecordings();
      });

      // ✅ order: title then buttons then trash at end
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
   * Recording (simple)
   ***********************/
  async function startRecording(){
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const chunks = [];
    const rec = new MediaRecorder(stream);

    rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      const id = crypto.randomUUID();
      const item = { id, createdAt: now(), title: "", blob };
      await dbPut(item);
      await renderRecordings();
    };

    rec.start();
    playClick(880, 60);
    setTimeout(() => rec.stop(), 8000); // 8 sec default
  }

  /***********************
   * Projects dropdown
   ***********************/
  function renderProjectsDropdown(){
    const all = loadAllProjects();

    // sort
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
    upsertProject(state.project);
    renderAll();
  }

  /***********************
   * Syllable count (simple)
   ***********************/
  function countSyllablesInline(text){
    const s = String(text||"").toLowerCase().replace(/[^a-z\s']/g," ").trim();
    if(!s) return 0;
    const words = s.split(/\s+/).filter(Boolean);
    let total = 0;
    for(const w0 of words){
      let w = w0.replace(/'s$/,"").replace(/'$/,"");
      if(!w) continue;
      // simple heuristic
      w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,"");
      w = w.replace(/^y/,"");
      const m = w.match(/[aeiouy]{1,2}/g);
      total += m ? m.length : 1;
    }
    return total;
  }

  /***********************
   * Panel hide/show
   ***********************/
  function setPanelHidden(hidden){
    el.panelBody.classList.toggle("hidden", hidden);
    el.togglePanelBtn.textContent = hidden ? "Show" : "Hide";
    el.miniBar.classList.toggle("show", hidden);
  }

  /***********************
   * Render all
   ***********************/
  function renderAll(){
    renderProjectsDropdown();
    renderTabs();
    renderSheet();
    renderRecordings();
  }

  /***********************
   * Wire buttons (THE IMPORTANT FIX)
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
    });
    el.capoInput.addEventListener("input", () => {
      state.capo = clamp(parseInt(el.capoInput.value || "0",10) || 0, 0, 12);
      el.capoInput.value = String(state.capo);
    });

    // ✅ instrument listeners (FIXED)
    el.instAcoustic.addEventListener("click", () => setInstrument("acoustic"));
    el.instElectric.addEventListener("click", () => setInstrument("electric"));
    el.instPiano.addEventListener("click", () => setInstrument("piano"));

    // ✅ drum listeners (FIXED)
    el.drumRock.addEventListener("click", () => setDrumStyle("rock"));
    el.drumHardRock.addEventListener("click", () => setDrumStyle("hardrock"));
    el.drumPop.addEventListener("click", () => setDrumStyle("pop"));
    el.drumRap.addEventListener("click", () => setDrumStyle("rap"));

    el.mRock.addEventListener("click", () => setDrumStyle("rock"));
    el.mHardRock.addEventListener("click", () => setDrumStyle("hardrock"));
    el.mPop.addEventListener("click", () => setDrumStyle("pop"));
    el.mRap.addEventListener("click", () => setDrumStyle("rap"));

    // ✅ AutoScroll ONLY (FIXED)
    el.autoPlayBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));
    el.mScrollBtn.addEventListener("click", () => setAutoScroll(!state.autoScrollOn));

    // recording buttons
    el.recordBtn.addEventListener("click", startRecording);
    el.mRecordBtn.addEventListener("click", startRecording);

    // project dropdown
    el.sortSelect.addEventListener("change", renderProjectsDropdown);
    el.projectSelect.addEventListener("change", () => loadProjectById(el.projectSelect.value));

    // rename/delete project
    el.renameProjectBtn.addEventListener("click", () => {
      const name = prompt("Project name:", state.project?.name || "");
      if(name === null) return;
      state.project.name = name.trim() || "Untitled";
      state.project.updatedAt = now();
      upsertProject(state.project);
      renderProjectsDropdown();
    });

    el.deleteProjectBtn.addEventListener("click", () => {
      if(!state.project) return;
      if(!confirm(`Delete project "${state.project.name}"?`)) return;
      deleteProject(state.project.id);
      state.project = getCurrentProject();
      renderAll();
    });

    // rhyme dock
    el.rBtn.addEventListener("click", () => {
      const showing = el.rhymeDock.style.display === "block";
      el.rhymeDock.style.display = showing ? "none" : "block";
    });
    el.hideRhymeBtn.addEventListener("click", () => {
      el.rhymeDock.style.display = "none";
    });
  }

  /***********************
   * Init
   ***********************/
  function init(){
    state.project = getCurrentProject();

    // initial UI
    el.autoSplitBtn.textContent = "AutoSplit: ON";
    el.autoSplitBtn.classList.add("active");

    // defaults
    setInstrument("piano");
    setDrumStyle("rap");
    setPanelHidden(false);
    setAutoScroll(false);

    wire();
    renderAll();
  }

  init();
})();
