/* Song Rider Pro - app.js (FULL REPLACE)
   Fixes requested:
   - Full page = one continuous scrolling sheet (all sections in one flow)
   - 8 chord/note boxes ABOVE lyric line
   - Bar # + syllable count pill (green/yellow/red)
   - 8 syllable boxes BELOW lyric line
   - Section pages auto-populated from Full (read-only mirror)
   - Better instrument sounds (acoustic/electric/piano)
   - Headshot blink + beat highlight (yellow)
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

  const DEFAULT_BARS_PER_SECTION = 8;

  /***********************
   * DOM
   ***********************/
  const $ = (sel) => document.querySelector(sel);

  const panel = $("#panel");
  const collapseBtn = $("#collapseBtn");
  const showBtn = $("#showBtn");

  const tabsEl = $("#tabs");
  const editorRoot = $("#editorRoot");

  const projectSelect = $("#projectSelect");
  const splitOff = $("#splitOff");
  const splitOn = $("#splitOn");

  const bpmInput = $("#bpmInput");
  const keyOutput = $("#keyOutput");
  const capoInput = $("#capoInput");

  const instAcoustic = $("#instAcoustic");
  const instElectric = $("#instElectric");
  const instPiano = $("#instPiano");

  const drumRock = $("#drumRock");
  const drumHardRock = $("#drumHardRock");
  const drumPop = $("#drumPop");
  const drumRap = $("#drumRap");

  const drumRock2 = $("#drumRock2");
  const drumHardRock2 = $("#drumHardRock2");
  const drumPop2 = $("#drumPop2");
  const drumRap2 = $("#drumRap2");

  const playStopBtn = $("#playStopBtn");
  const playStopBtn2 = $("#playStopBtn2");

  const recordBtn = $("#recordBtn");
  const recordBtn2 = $("#recordBtn2");
  const stopRecordBtn = $("#stopRecordBtn");
  const downloadLink = $("#downloadLink");

  const pageHeading = $("#pageHeading");
  const pageHint = $("#pageHint");
  const statusEl = $("#status");

  const headshotWrap = $("#headshotWrap");

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
    drumStyle: "rock",      // rock | hardrock | pop | rap
    playing: false,
    tickIndex: 0,           // 0..7 (eighth notes)
    barPlayRef: null,       // { sectionId, barIndex }
    dataByProject: {}
  };

  /***********************
   * Model
   ***********************/
  function emptyBar(){
    return {
      notes: Array(8).fill(""), // 8 chord/note boxes
      lyrics: ""                // lyric line (can be multiline; syllables map off it)
    };
  }

  function emptySection(title){
    return {
      title,
      bars: Array.from({length: DEFAULT_BARS_PER_SECTION}, () => emptyBar())
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
        drumStyle: "rock"
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
    state.recentProjects = [state.projectId, ...state.recentProjects.filter(x => x !== state.projectId)].slice(0, 8);
  }

  function loadAll(){
    const saved = LS.get("state", null);
    const data = LS.get("dataByProject", null);
    const recent = LS.get("recentProjects", []);

    if (data && typeof data === "object") state.dataByProject = data;
    state.recentProjects = Array.isArray(recent) ? recent : [];

    if (saved) Object.assign(state, saved);

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
      drumStyle: state.drumStyle
    });
    LS.set("dataByProject", state.dataByProject);
    LS.set("recentProjects", state.recentProjects);
  }

  function syncMetaFromProject(){
    const p = getProject();
    state.bpm = clampInt(p.meta?.bpm ?? state.bpm, 40, 220);
    state.capo = clampInt(p.meta?.capo ?? state.capo, 0, 12);
    state.autoSplit = !!(p.meta?.autoSplit ?? state.autoSplit);
    state.instrument = p.meta?.instrument ?? state.instrument;
    state.drumStyle = p.meta?.drumStyle ?? state.drumStyle;

    bpmInput.value = state.bpm;
    capoInput.value = state.capo;
    setSplitButtons();
    setInstrumentButtons();
    setDrumButtons();
  }

  function syncMetaToProject(){
    const p = getProject();
    p.meta = p.meta || {};
    p.meta.bpm = state.bpm;
    p.meta.capo = state.capo;
    p.meta.autoSplit = state.autoSplit;
    p.meta.instrument = state.instrument;
    p.meta.drumStyle = state.drumStyle;
    touchProject();
    saveAll();
  }

  /***********************
   * UI build
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

  function buildProjectSelect(){
    const opts = [];
    opts.push({ value:"__RECENT__", label:"Recent" });
    for (let i=0; i<26; i++){
      const letter = String.fromCharCode(65+i);
      opts.push({ value:letter, label:`Project ${letter}` });
    }

    projectSelect.innerHTML = "";
    for (const o of opts){
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
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
    buildProjectSelect();
    render();
    saveAll();
  }

  function setSplitButtons(){
    splitOn.classList.toggle("active", state.autoSplit);
    splitOff.classList.toggle("active", !state.autoSplit);
  }

  function setInstrumentButtons(){
    instAcoustic.classList.toggle("active", state.instrument === "acoustic");
    instElectric.classList.toggle("active", state.instrument === "electric");
    instPiano.classList.toggle("active", state.instrument === "piano");
  }

  function setDrumButtons(){
    const set = (btn, on) => btn.classList.toggle("active", on);
    set(drumRock, state.drumStyle === "rock");
    set(drumHardRock, state.drumStyle === "hardrock");
    set(drumPop, state.drumStyle === "pop");
    set(drumRap, state.drumStyle === "rap");

    set(drumRock2, state.drumStyle === "rock");
    set(drumHardRock2, state.drumStyle === "hardrock");
    set(drumPop2, state.drumStyle === "pop");
    set(drumRap2, state.drumStyle === "rap");
  }

  /***********************
   * Collapsible panel
   ***********************/
  collapseBtn.addEventListener("click", () => panel.classList.add("is-collapsed"));
  showBtn.addEventListener("click", () => panel.classList.remove("is-collapsed"));

  /***********************
   * Controls
   ***********************/
  projectSelect.addEventListener("change", () => {
    const v = projectSelect.value;
    if (v === "__RECENT__"){ openRecentPicker(); return; }
    state.projectId = v;
    if (!state.dataByProject[state.projectId]) state.dataByProject[state.projectId] = defaultProjectData();
    syncMetaFromProject();
    render();
    saveAll();
  });

  splitOff.addEventListener("click", () => { state.autoSplit = false; setSplitButtons(); syncMetaToProject(); render(); });
  splitOn.addEventListener("click", () => { state.autoSplit = true; setSplitButtons(); syncMetaToProject(); render(); });

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
    render(); // updates displayed transpositions
  });

  instAcoustic.addEventListener("click", () => { state.instrument="acoustic"; setInstrumentButtons(); syncMetaToProject(); });
  instElectric.addEventListener("click", () => { state.instrument="electric"; setInstrumentButtons(); syncMetaToProject(); });
  instPiano.addEventListener("click", () => { state.instrument="piano"; setInstrumentButtons(); syncMetaToProject(); });

  const setDrum = (style) => {
    state.drumStyle = style;
    setDrumButtons();
    syncMetaToProject();
    if (state.playing) restartTransport();
  };
  drumRock.addEventListener("click", () => setDrum("rock"));
  drumHardRock.addEventListener("click", () => setDrum("hardrock"));
  drumPop.addEventListener("click", () => setDrum("pop"));
  drumRap.addEventListener("click", () => setDrum("rap"));
  drumRock2.addEventListener("click", () => setDrum("rock"));
  drumHardRock2.addEventListener("click", () => setDrum("hardrock"));
  drumPop2.addEventListener("click", () => setDrum("pop"));
  drumRap2.addEventListener("click", () => setDrum("rap"));

  playStopBtn.addEventListener("click", togglePlay);
  playStopBtn2.addEventListener("click", togglePlay);

  /***********************
   * Syllables + coloring
   ***********************/
  function computeSyllables(text, auto){
    const cleaned = (text || "").trim();
    if (!cleaned) return { slots:Array(8).fill(""), count:0 };

    let parts = [];
    if (!auto){
      parts = cleaned.split("/").map(s => s.trim()).filter(Boolean);
    } else {
      const words = cleaned
        .replace(/[“”"]/g,"")
        .replace(/[^\w'\- ]+/g," ")
        .split(/\s+/)
        .filter(Boolean);

      for (const w of words){
        parts.push(...roughSyllables(w));
      }
    }

    const count = parts.length;

    const slots = Array(8).fill("");
    if (parts.length <= 8){
      for (let i=0;i<parts.length;i++) slots[i] = parts[i];
    } else {
      for (let i=0;i<7;i++) slots[i] = parts[i];
      slots[7] = parts.slice(7).join(" ");
    }
    return { slots, count };
  }

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

  function syllColor(count){
    // simple “safe syllable” bands (tweak later if you want)
    // green: <= 12, yellow: 13-16, red: >= 17
    if (count <= 12) return "green";
    if (count <= 16) return "yellow";
    return "red";
  }

  /***********************
   * Transpose helpers
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
  function transposeRoot(root, semitones){
    const idx = noteIndex(root);
    if (idx === null) return root;
    const preferFlats = /b/.test(root) && !/#/.test(root);
    return idxToName(idx + semitones, preferFlats);
  }

  function transposeToken(token, capo){
    // token may be chord or note; transpose its root if it begins with A-G
    const s = String(token || "").trim();
    if (!s) return "";

    const m = s.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return s;

    const root = (m[1].toUpperCase() + (m[2]||""));
    const rest = (m[3]||"");

    // handle slash bass (D/F#)
    const slash = rest.match(/^(.*)\/([A-Ga-g])([#b]?)\s*$/);
    if (slash){
      const before = slash[1] || "";
      const bassRoot = (slash[2].toUpperCase() + (slash[3]||""));
      const trRoot = transposeRoot(root, capo);
      const trBass = transposeRoot(bassRoot, capo);
      return `${trRoot}${before}/${trBass}`;
    }

    return `${transposeRoot(root, capo)}${rest}`;
  }

  /***********************
   * Key estimate (from note/chord boxes)
   ***********************/
  function estimateKey(project, capo){
    const roots = [];
    for (const sid of Object.keys(project.sections || {})){
      const sec = project.sections[sid];
      for (const bar of (sec.bars || [])){
        for (const tok of (bar.notes || [])){
          const raw = (tok || "").trim();
          if (!raw) continue;
          const tr = transposeToken(raw, capo);
          const rm = tr.match(/^([A-G])([#b]?)/);
          if (!rm) continue;
          roots.push(rm[1] + (rm[2]||""));
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

      let majScore = 0, minScore = 0;
      for (const [r, n] of count.entries()){
        const idx = noteIndex(r);
        if (idx === null) continue;
        if (majSet.has(idx)) majScore += n;
        if (minSet.has(idx)) minScore += n;
      }

      const tonicName = idxToName(tonic, false);
      const tonicNameFlat = idxToName(tonic, true);
      const tonicBoost = (count.get(tonicName)||0) + (count.get(tonicNameFlat)||0);

      candidates.push({ mode:"Major", tonic, score: majScore + tonicBoost*0.6 });
      candidates.push({ mode:"Minor", tonic, score: minScore + tonicBoost*0.6 });
    }
    candidates.sort((a,b)=> b.score - a.score);
    const best = candidates[0];
    if (!best) return "";

    const flatBias = roots.filter(r => r.includes("b")).length > roots.filter(r => r.includes("#")).length;
    return `${idxToName(best.tonic, flatBias)} ${best.mode}`;
  }

  /***********************
   * Rendering
   ***********************/
  function render(){
    buildTabs();

    const page = PAGES.find(x => x.id === state.pageId);
    pageHeading.textContent = page ? page.name : "Full";
    pageHint.textContent = (state.pageId === "full")
      ? "Master sheet: edit here. Section pages mirror it."
      : "Read-only mirror: edit in Full.";

    editorRoot.innerHTML = "";

    const project = getProject();
    keyOutput.value = estimateKey(project, state.capo) || "—";

    if (state.pageId === "full"){
      editorRoot.appendChild(renderFullSheet(project));
    } else {
      editorRoot.appendChild(renderSectionMirror(project, state.pageId));
    }
  }

  function renderFullSheet(project){
    const sheet = document.createElement("div");
    sheet.className = "sheet";

    const header = document.createElement("div");
    header.className = "sheetHeader";

    const left = document.createElement("div");
    left.className = "left";
    left.textContent = "Full Editor (Master)";

    const right = document.createElement("div");
    right.className = "right";

    const addBarBtn = document.createElement("button");
    addBarBtn.className = "btn secondary small";
    addBarBtn.textContent = "+ Bar (to each section)";
    addBarBtn.title = "Adds one bar to every section (keeps them consistent).";
    addBarBtn.addEventListener("click", () => {
      for (const s of SECTIONS){
        project.sections[s.id].bars.push(emptyBar());
      }
      touchProject(); saveAll(); render();
    });

    const delBarBtn = document.createElement("button");
    delBarBtn.className = "btn secondary small";
    delBarBtn.textContent = "− Bar (from each section)";
    delBarBtn.title = "Removes one bar from every section (minimum 1).";
    delBarBtn.addEventListener("click", () => {
      for (const s of SECTIONS){
        const bars = project.sections[s.id].bars;
        if (bars.length > 1) bars.pop();
      }
      touchProject(); saveAll(); render();
    });

    right.appendChild(addBarBtn);
    right.appendChild(delBarBtn);

    header.appendChild(left);
    header.appendChild(right);

    sheet.appendChild(header);

    for (const s of SECTIONS){
      sheet.appendChild(renderSectionEditable(project, s.id, s.title));
    }

    return sheet;
  }

  function renderSectionEditable(project, sectionId, title){
    const sec = project.sections[sectionId];

    const titleRow = document.createElement("div");
    titleRow.className = "sectionTitleRow";

    const t = document.createElement("div");
    t.className = "title";
    t.textContent = title;

    const tool = document.createElement("div");
    tool.style.display = "flex";
    tool.style.gap = "8px";
    tool.style.flexWrap = "wrap";

    const clearBtn = document.createElement("button");
    clearBtn.className = "btn secondary small";
    clearBtn.textContent = "Clear Section";
    clearBtn.addEventListener("click", () => {
      if (!confirm(`Clear ${title}?`)) return;
      sec.bars = Array.from({length: sec.bars.length}, () => emptyBar());
      touchProject(); saveAll(); render();
    });

    tool.appendChild(clearBtn);

    titleRow.appendChild(t);
    titleRow.appendChild(tool);

    const barsWrap = document.createElement("div");
    barsWrap.className = "bars";

    sec.bars.forEach((bar, idx) => {
      barsWrap.appendChild(renderBar(sectionId, idx, bar, { editable:true }));
    });

    const container = document.createElement("div");
    container.appendChild(titleRow);
    container.appendChild(barsWrap);

    return container;
  }

  function renderSectionMirror(project, sectionId){
    const sec = project.sections[sectionId];
    if (!sec){
      const d = document.createElement("div");
      d.textContent = "Section not found.";
      return d;
    }

    const sheet = document.createElement("div");
    sheet.className = "sheet";

    const header = document.createElement("div");
    header.className = "sheetHeader";

    const left = document.createElement("div");
    left.className = "left";
    left.textContent = `${sec.title}`;

    const badge = document.createElement("div");
    badge.className = "readonlyBadge";
    badge.textContent = "Read-only mirror (edit in Full)";

    header.appendChild(left);
    header.appendChild(badge);
    sheet.appendChild(header);

    const barsWrap = document.createElement("div");
    barsWrap.className = "bars";
    sec.bars.forEach((bar, idx) => {
      barsWrap.appendChild(renderBar(sectionId, idx, bar, { editable:false }));
    });

    sheet.appendChild(barsWrap);
    return sheet;
  }

  function renderBar(sectionId, barIndex, bar, { editable }){
    const wrap = document.createElement("div");
    wrap.className = "bar";

    const barKey = `${sectionId}::${barIndex}`;

    // syllables
    const { slots, count } = computeSyllables(bar.lyrics || "", state.autoSplit);

    const top = document.createElement("div");
    top.className = "barTop";

    const barNum = document.createElement("div");
    barNum.className = "barNum";
    barNum.textContent = `Bar ${barIndex + 1}`;

    const pill = document.createElement("div");
    pill.className = `syllPill ${syllColor(count)}`;
    pill.textContent = `Syllables: ${count}`;

    top.appendChild(barNum);
    top.appendChild(pill);

    // 8 chord/note boxes ABOVE lyric line
    const notesRow = document.createElement("div");
    notesRow.className = "notesRow";

    for (let i=0;i<8;i++){
      const inp = document.createElement("input");
      inp.className = "noteCell";
      inp.placeholder = (i % 2 === 0) ? "Chord/Note" : "";
      inp.value = editable ? (bar.notes[i] || "") : transposeToken(bar.notes[i] || "", state.capo);
      inp.setAttribute("data-notekey", barKey);
      inp.setAttribute("data-idx", String(i));

      inp.disabled = !editable;

      inp.addEventListener("focus", () => {
        state.barPlayRef = { sectionId, barIndex };
      });

      if (editable){
        inp.addEventListener("input", () => {
          bar.notes[i] = inp.value;
          touchProject(); saveAll();
          keyOutput.value = estimateKey(getProject(), state.capo) || "—";
        });
      }

      notesRow.appendChild(inp);
    }

    // lyric line
    const lyricRow = document.createElement("div");
    lyricRow.className = "lyricRow";
    const ta = document.createElement("textarea");
    ta.className = "lyrics";
    ta.placeholder = state.autoSplit
      ? "Type lyrics (auto-syllables map below)…"
      : "Type lyrics and split syllables with “/”…";

    ta.value = bar.lyrics || "";
    ta.disabled = !editable;

    ta.addEventListener("focus", () => {
      state.barPlayRef = { sectionId, barIndex };
    });

    if (editable){
      ta.addEventListener("input", () => {
        bar.lyrics = ta.value;
        touchProject(); saveAll();
        // update pill + syll row live
        const { slots: s2, count: c2 } = computeSyllables(bar.lyrics || "", state.autoSplit);
        pill.className = `syllPill ${syllColor(c2)}`;
        pill.textContent = `Syllables: ${c2}`;
        updateSyllRow(wrap, barKey, s2);
      });
    }

    lyricRow.appendChild(ta);

    // syllable row BELOW lyric line
    const syllRow = document.createElement("div");
    syllRow.className = "syllRow";
    for (let i=0;i<8;i++){
      const cell = document.createElement("div");
      cell.className = "syllCell";
      cell.setAttribute("data-syllkey", barKey);
      cell.setAttribute("data-idx", String(i));
      cell.textContent = slots[i] || "";
      syllRow.appendChild(cell);
    }

    wrap.appendChild(top);
    wrap.appendChild(notesRow);
    wrap.appendChild(lyricRow);
    wrap.appendChild(syllRow);

    return wrap;
  }

  function updateSyllRow(barWrap, barKey, slots){
    for (let i=0;i<8;i++){
      const cell = barWrap.querySelector(`[data-syllkey="${cssEscape(barKey)}"][data-idx="${i}"]`);
      if (cell) cell.textContent = slots[i] || "";
    }
  }

  function cssEscape(s){ return String(s).replace(/"/g, '\\"'); }

  /***********************
   * Highlighting (yellow beat highlight)
   ***********************/
  function clearHighlights(){
    document.querySelectorAll(".noteCell.hl").forEach(el => el.classList.remove("hl"));
    document.querySelectorAll(".syllCell.hl").forEach(el => el.classList.remove("hl"));
  }

  function applyHighlights(eighthIndex){
    clearHighlights();
    const ref = state.barPlayRef;
    if (!ref) return;

    const barKey = `${ref.sectionId}::${ref.barIndex}`;

    const noteCell = document.querySelector(`[data-notekey="${cssEscape(barKey)}"][data-idx="${eighthIndex}"]`);
    if (noteCell) noteCell.classList.add("hl");

    const syllCell = document.querySelector(`[data-syllkey="${cssEscape(barKey)}"][data-idx="${eighthIndex}"]`);
    if (syllCell) syllCell.classList.add("hl");
  }

  /***********************
   * Audio Engine (improved instruments)
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
    musicBus.gain.value = 0.75;
    musicBus.connect(master);
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

  // Note parsing -> frequency
  const NOTE_NAMES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const NOTE_NAMES_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

  function midiToFreq(m){ return 440 * Math.pow(2, (m - 69)/12); }

  function noteToFreq(token, capo){
    // Accept C, C#, Db, A4, etc. default octave 4
    const s = String(token || "").trim();
    const m = s.match(/^([A-Ga-g])([#b]?)(-?\d+)?$/);
    if (!m) return null;
    const root = (m[1].toUpperCase() + (m[2]||""));
    const octave = m[3] ? parseInt(m[3],10) : 4;
    const idx = noteIndex(root);
    if (idx === null) return null;
    const midi = (octave + 1) * 12 + (idx + capo);
    return midiToFreq(midi);
  }

  function chordRootFreq(token, capo){
    // Use root note of chord if token looks like chord
    const s = String(token || "").trim();
    const m = s.match(/^([A-Ga-g])([#b]?)/);
    if (!m) return null;
    const root = (m[1].toUpperCase() + (m[2]||""));
    const idx = noteIndex(root);
    if (idx === null) return null;
    const octave = 3; // root around C3–B3
    const midi = (octave + 1) * 12 + (idx + capo);
    return midiToFreq(midi);
  }

  // Instrument engines
  function playAcousticPluck(freq, t, dur){
    // Karplus-Strong pluck string
    const sr = audioCtx.sampleRate;
    const n = Math.max(32, Math.floor(sr / freq));
    const buffer = audioCtx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    for (let i=0;i<n;i++){
      data[i] = (Math.random()*2-1) * 0.7;
    }

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
    lp.Q.value = 0.8;

    const body = audioCtx.createBiquadFilter();
    body.type = "peaking";
    body.frequency.setValueAtTime(240, t);
    body.Q.value = 1.2;
    body.gain.setValueAtTime(3.5, t);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.10);

    src.connect(lp);
    lp.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(body);
    body.connect(g);
    g.connect(musicBus);

    src.start(t);
    src.stop(t + dur + 0.12);
  }

  function playElectric(freq, t, dur){
    // Saw + distortion + filter
    const o = audioCtx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);

    const pre = audioCtx.createGain();
    pre.gain.setValueAtTime(0.9, t);

    const shaper = audioCtx.createWaveShaper();
    shaper.curve = makeDistCurve(220);
    shaper.oversample = "4x";

    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, t);
    lp.Q.value = 0.7;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.10);

    o.connect(pre);
    pre.connect(shaper);
    shaper.connect(lp);
    lp.connect(g);
    g.connect(musicBus);

    o.start(t);
    o.stop(t + dur + 0.12);
  }

  function playPiano(freq, t, dur){
    // “Piano-ish” = stacked partials + quick decay + slight inharmonicity
    const mix = audioCtx.createGain();
    mix.gain.setValueAtTime(0.9, t);
    mix.connect(musicBus);

    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(5200, t);
    lp.Q.value = 0.5;
    lp.connect(mix);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.22);
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
      // tiny inharmonic drift
      const inharm = 1 + (i*0.0008);
      o.frequency.setValueAtTime(freq * p.m * inharm, t);

      const og = audioCtx.createGain();
      og.gain.setValueAtTime(p.a / partials.length, t);

      o.connect(og);
      og.connect(g);

      o.start(t);
      o.stop(t + dur + 0.25);
    });
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

  function playMusicFromToken(token, t, dur){
    const raw = String(token || "").trim();
    if (!raw) return;

    // prefer explicit note (A4) else chord root
    let f = noteToFreq(raw, state.capo);
    if (!f) f = chordRootFreq(raw, state.capo);
    if (!f) return;

    if (state.instrument === "acoustic") playAcousticPluck(f, t, dur);
    else if (state.instrument === "electric") playElectric(f, t, dur);
    else playPiano(f, t, dur);
  }

  /***********************
   * Transport
   ***********************/
  function setPlayButtons(){
    const label = state.playing ? "Stop" : "Play";
    playStopBtn.textContent = label;
    playStopBtn2.textContent = label;
  }

  function togglePlay(){
    if (state.playing) stopTransport();
    else startTransport();
  }

  function stopTransport(){
    if (transportTimer){
      clearInterval(transportTimer);
      transportTimer = null;
    }
    state.playing = false;
    state.tickIndex = 0;
    setPlayButtons();
    clearHighlights();
    headshotWrap.classList.remove("blink");
    setStatus("Stopped.");
  }

  function restartTransport(){
    stopTransport();
    startTransport();
  }

  function pickDefaultBarRef(){
    if (state.pageId === "full") return { sectionId:"v1", barIndex:0 };
    if (SECTIONS.some(s => s.id === state.pageId)) return { sectionId:state.pageId, barIndex:0 };
    return { sectionId:"v1", barIndex:0 };
  }

  function startTransport(){
    ensureAudio();
    audioCtx.resume?.();

    state.playing = true;
    setPlayButtons();
    setStatus(`Playing • ${state.drumStyle.toUpperCase()} • ${state.bpm} BPM`);

    if (!state.barPlayRef) state.barPlayRef = pickDefaultBarRef();

    const msPerBeat = 60000 / state.bpm;
    const msPerEighth = msPerBeat / 2;

    transportTimer = setInterval(() => tick(), msPerEighth);
    tick(true);
  }

  function tick(forceBlink=false){
    if (!state.playing) return;
    ensureAudio();
    const t = audioCtx.currentTime;

    const i = state.tickIndex % 8;
    const isQuarter = (i % 2 === 0);

    // drums
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

    // UI highlight
    applyHighlights(i);

    // headshot blink
    if (isQuarter || forceBlink){
      headshotWrap.classList.add("blink");
      setTimeout(() => headshotWrap.classList.remove("blink"), 90);
    }

    // music play from current bar note box at i
    const ref = state.barPlayRef;
    if (ref){
      const project = getProject();
      const bar = project.sections?.[ref.sectionId]?.bars?.[ref.barIndex];
      if (bar){
        const token = (bar.notes?.[i] || "").trim();
        if (token){
          const noteDur = (60 / state.bpm) / 2;
          playMusicFromToken(token, t, noteDur * 1.25);
        }
      }
    }

    state.tickIndex = (state.tickIndex + 1) % 8;
  }

  /***********************
   * Recording (mic)
   ***********************/
  let mediaRecorder = null;
  let recordedChunks = [];
  let micStream = null;

  async function startRecording(){
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      micStream = stream;
      recordedChunks = [];

      mediaRecorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = `SongRiderPro_${state.projectId}_${Date.now()}.webm`;
        downloadLink.textContent = "Download";
        downloadLink.style.display = "inline-block";
        setStatus("Recording ready to download.");
      };

      mediaRecorder.start();
      recordBtn.disabled = true;
      recordBtn2.disabled = true;
      stopRecordBtn.disabled = false;
      downloadLink.style.display = "none";
      setStatus("Recording (mic)...");
    } catch (err){
      console.error(err);
      setStatus("Mic permission denied or unavailable.");
      alert("Recording needs microphone permission.");
    }
  }

  function stopRecording(){
    try {
      if (mediaRecorder && mediaRecorder.state !== "inactive"){
        mediaRecorder.stop();
      }
      if (micStream){
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
    } catch {}
    recordBtn.disabled = false;
    recordBtn2.disabled = false;
    stopRecordBtn.disabled = true;
  }

  function pickMimeType(){
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const t of types){
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  recordBtn.addEventListener("click", startRecording);
  recordBtn2.addEventListener("click", startRecording);
  stopRecordBtn.addEventListener("click", stopRecording);

  /***********************
   * Focus tracking -> which bar plays
   ***********************/
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!el) return;
    // Any input/textarea inside a bar should set barPlayRef
    const bar = el.closest?.(".bar");
    if (!bar) return;

    // Find first noteCell in that bar for its data key (section::barIndex)
    const nc = bar.querySelector?.(".noteCell");
    if (!nc) return;
    const k = nc.getAttribute("data-notekey");
    if (!k) return;
    const [sectionId, barIndexStr] = k.split("::");
    const barIndex = Number(barIndexStr);
    if (sectionId && Number.isFinite(barIndex)){
      state.barPlayRef = { sectionId, barIndex };
    }
  });

  /***********************
   * Init
   ***********************/
  function init(){
    loadAll();
    buildProjectSelect();
    render();
    saveAll();
    setStatus("Ready.");
  }

  init();
})();
