/* Song Rider Pro - app.js (FULL REPLACE)
   - PWA ready
   - Projects A–Z + Recent
   - Full editor auto-populates section pages
   - Capo transposition (display sounding chords/notes)
   - Auto-syllable split toggle (manual uses "/")
   - Metronome/drum patterns (Rock/Hard Rock/Pop/Rap)
   - Beat highlight (yellow) on beat + note highlight
   - Instrument toggle (Acoustic/Electric/Piano) plays notes on metronome
   - Record (mic) to .webm
*/

(() => {
  "use strict";

  /***********************
   * Storage Isolation
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
        const v = localStorage.getItem(`${APP_SCOPE}::songrider::${k}`);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(`${APP_SCOPE}::songrider::${k}`, JSON.stringify(v)); } catch {}
    }
  };

  /***********************
   * Constants / Pages
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

  const FULL_SECTIONS = [
    { id:"v1", title:"VERSE 1" },
    { id:"c1", title:"CHORUS 1" },
    { id:"v2", title:"VERSE 2" },
    { id:"c2", title:"CHORUS 2" },
    { id:"v3", title:"VERSE 3" },
    { id:"br", title:"BRIDGE" },
    { id:"c3", title:"CHORUS 3" },
  ];

  const DEFAULT_LINES_PER_SECTION = 8;

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
    tickIndex: 0,           // 0..7 eighth-notes
    linePlayRef: null,      // { sectionId, lineIndex }
    // data model per project
    dataByProject: {}
  };

  function setStatus(msg){
    statusEl.textContent = msg;
  }

  /***********************
   * Data Model
   ***********************/
  function emptyLine(){
    return {
      notes: Array(8).fill(""),       // note boxes above lyrics (can be note OR chord)
      chords: ["", "", "", ""],       // chord for each beat
      lyrics: "",                     // raw lyric text
      // derived: syllables (computed from lyrics)
    };
  }

  function emptySection(title){
    return {
      title,
      lines: Array.from({length: DEFAULT_LINES_PER_SECTION}, () => emptyLine()),
      // for Full editor only: allow "visual blank lines" that don't propagate.
      // We'll store as an array of line objects with optional {isSpacer:true}
      // but keep it simple: user can add spacer blocks; section pages ignore them.
      spacers: [] // indices where a spacer appears AFTER line i (full only)
    };
  }

  function defaultProjectData(){
    const sections = {};
    for (const s of FULL_SECTIONS){
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
      // pages are derived, but we persist the same structure for simplicity
      updatedAt: Date.now()
    };
  }

  function loadAll(){
    const saved = LS.get("state", null);
    const dataByProject = LS.get("dataByProject", null);
    const recent = LS.get("recentProjects", []);

    if (dataByProject && typeof dataByProject === "object") state.dataByProject = dataByProject;
    state.recentProjects = Array.isArray(recent) ? recent : [];

    if (saved){
      Object.assign(state, saved);
    }

    // Ensure project exists
    if (!state.dataByProject[state.projectId]){
      state.dataByProject[state.projectId] = defaultProjectData();
    }

    // Pull meta into controls
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

  function getProject(){
    if (!state.dataByProject[state.projectId]){
      state.dataByProject[state.projectId] = defaultProjectData();
    }
    return state.dataByProject[state.projectId];
  }

  function touchProject(){
    const p = getProject();
    p.updatedAt = Date.now();
    // update recent
    state.recentProjects = [state.projectId, ...state.recentProjects.filter(x => x !== state.projectId)].slice(0, 8);
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

  function clampInt(v, a, b){
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = Math.round(v);
    return Math.max(a, Math.min(b, v));
  }

  /***********************
   * Tabs / Projects UI
   ***********************/
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
    // If current is in recent list view, set to __RECENT__
    // otherwise set to actual letter
    if (state.projectId && state.projectId !== "__RECENT__"){
      projectSelect.value = state.projectId;
    }
  }

  function openRecentPicker(){
    const rec = state.recentProjects.length ? state.recentProjects : ["A"];
    const pick = prompt(`Recent projects:\n${rec.join(", ")}\n\nType a letter to open:`, rec[0]);
    if (!pick) return;
    const letter = pick.trim().toUpperCase();
    if (!/^[A-Z]$/.test(letter)) {
      setStatus("Invalid project. Use A–Z.");
      return;
    }
    state.projectId = letter;
    if (!state.dataByProject[state.projectId]) state.dataByProject[state.projectId] = defaultProjectData();
    syncMetaFromProject();
    buildProjectSelect();
    render();
    saveAll();
  }

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

  function setSplitButtons(){
    if (state.autoSplit){
      splitOn.classList.add("active");
      splitOff.classList.remove("active");
    } else {
      splitOff.classList.add("active");
      splitOn.classList.remove("active");
    }
  }

  function setInstrumentButtons(){
    const set = (btn, on) => btn.classList.toggle("active", on);
    set(instAcoustic, state.instrument === "acoustic");
    set(instElectric, state.instrument === "electric");
    set(instPiano, state.instrument === "piano");
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
   * Collapsible Panel
   ***********************/
  collapseBtn.addEventListener("click", () => {
    panel.classList.add("is-collapsed");
  });
  showBtn.addEventListener("click", () => {
    panel.classList.remove("is-collapsed");
  });

  /***********************
   * Controls events
   ***********************/
  projectSelect.addEventListener("change", () => {
    const v = projectSelect.value;
    if (v === "__RECENT__"){
      openRecentPicker();
      return;
    }
    state.projectId = v;
    if (!state.dataByProject[state.projectId]) state.dataByProject[state.projectId] = defaultProjectData();
    syncMetaFromProject();
    render();
    saveAll();
  });

  splitOff.addEventListener("click", () => {
    state.autoSplit = false;
    setSplitButtons();
    syncMetaToProject();
    render();
  });
  splitOn.addEventListener("click", () => {
    state.autoSplit = true;
    setSplitButtons();
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
    render(); // re-display transposed chords/notes
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
   * Audio Engine
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
    musicBus.gain.value = 0.55;
    musicBus.connect(master);
  }

  function stopTransport(){
    if (transportTimer){
      clearInterval(transportTimer);
      transportTimer = null;
    }
    state.playing = false;
    state.tickIndex = 0;
    state.linePlayRef = null;
    setPlayButtons();
    clearHighlights();
    headshotWrap.classList.remove("blink");
    setStatus("Stopped.");
  }

  function restartTransport(){
    stopTransport();
    startTransport();
  }

  function setPlayButtons(){
    const label = state.playing ? "Stop" : "Play";
    playStopBtn.textContent = label;
    playStopBtn2.textContent = label;
  }

  function togglePlay(){
    if (state.playing) stopTransport();
    else startTransport();
  }

  function startTransport(){
    ensureAudio();
    audioCtx.resume?.();

    state.playing = true;
    setPlayButtons();
    setStatus(`Playing • ${state.drumStyle.toUpperCase()} • ${state.bpm} BPM`);

    // Choose which line to play/highlight:
    // If user last focused a textarea in this page, use that line.
    // Otherwise default: first line of first visible section.
    if (!state.linePlayRef){
      state.linePlayRef = pickDefaultLineRef();
    }

    const msPerBeat = 60000 / state.bpm;
    const msPerEighth = msPerBeat / 2;

    // tick every eighth note
    transportTimer = setInterval(() => {
      tick();
    }, msPerEighth);

    // immediate tick for responsiveness
    tick(true);
  }

  function pickDefaultLineRef(){
    // Prefer first section visible in current page, line 0
    if (state.pageId === "full"){
      return { sectionId: "v1", lineIndex: 0 };
    }
    // map pageId to sectionId
    const pid = state.pageId;
    if (FULL_SECTIONS.some(s => s.id === pid)){
      return { sectionId: pid, lineIndex: 0 };
    }
    return { sectionId: "v1", lineIndex: 0 };
  }

  // Drum synthesis helpers
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
    // noise + tone
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

  // Instrument synth
  function playMusicNote(noteNameOrChord, t, dur){
    // If empty, do nothing
    const raw = (noteNameOrChord || "").trim();
    if (!raw) return;

    // Try parse as chord first, else parse as note
    const freqs = chordToFreqs(raw, state.capo) || noteToFreqs(raw, state.capo);
    if (!freqs || !freqs.length) return;

    const isPiano = state.instrument === "piano";
    const isElectric = state.instrument === "electric";
    const baseType = isPiano ? "sine" : (isElectric ? "sawtooth" : "triangle");

    // Simple pad/pluck-ish envelope
    const now = t;
    const end = t + dur;

    // For guitar-ish, make a quicker attack and decay; for piano quick decay; for electric slightly longer
    const attack = 0.008;
    const release = isElectric ? 0.10 : (isPiano ? 0.09 : 0.12);
    const decay = isPiano ? 0.22 : (isElectric ? 0.35 : 0.30);

    // Slight filter to shape timbre
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(isElectric ? 2600 : 1800, now);
    filter.Q.value = 0.7;

    const mix = audioCtx.createGain();
    mix.gain.value = 0.85;
    mix.connect(filter);
    filter.connect(musicBus);

    // voice per frequency
    freqs.slice(0, 4).forEach((f, idx) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      o.type = baseType;
      o.frequency.setValueAtTime(f, now);

      // detune slightly for richness
      o.detune.value = (idx - 1.5) * (isElectric ? 6 : 3);

      // envelope
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.55 / freqs.length, now + attack);
      g.gain.exponentialRampToValueAtTime(0.20 / freqs.length, now + decay);
      g.gain.exponentialRampToValueAtTime(0.0001, end + release);

      o.connect(g);
      g.connect(mix);

      o.start(now);
      o.stop(end + release + 0.02);
    });
  }

  function tick(forceBlink=false){
    if (!state.playing) return;

    ensureAudio();
    const t = audioCtx.currentTime;

    // Drum patterns scheduled on eighth-notes
    // We treat each bar as 8 ticks (1 & 2 & 3 & 4 &)
    const i = state.tickIndex % 8;

    // Determine beat number 1..4 and whether this is "on-beat" (quarter)
    const beatNum = Math.floor(i/2) + 1; // 1..4
    const isQuarter = (i % 2 === 0);

    // Pattern mapping by style
    // Use kick/snare on certain ticks. Hats most ticks.
    const style = state.drumStyle;

    // Always hat on each tick for most styles; rap uses hats but lighter
    const hatLevel = (style === "rap") ? 0.65 : 1.0;
    if (Math.random() < hatLevel) playHat(t, style === "hardrock" && i === 7);

    if (style === "rock"){
      // kick: 1, 3
      if (i === 0 || i === 4) playKick(t);
      // snare: 2, 4
      if (i === 2 || i === 6) playSnare(t);
    } else if (style === "hardrock"){
      // kick: 1, (1&), 3, (3&)
      if (i === 0 || i === 1 || i === 4 || i === 5) playKick(t);
      // snare: 2, 4
      if (i === 2 || i === 6) playSnare(t);
      // extra hat energy already
    } else if (style === "pop"){
      // kick: 1, (2&), 3
      if (i === 0 || i === 3 || i === 4) playKick(t);
      // snare/clap: 2,4
      if (i === 2 || i === 6) playSnare(t);
      // open hat on 4&
      if (i === 7) playHat(t, true);
    } else if (style === "rap"){
      // kick: 1, (3&)
      if (i === 0 || i === 5) playKick(t);
      // snare: 2,4
      if (i === 2 || i === 6) playSnare(t);
      // occasional extra hat
      if (Math.random() < 0.25) playHat(t + 0.02, false);
    }

    // Highlight UI
    applyHighlights(i);

    // Blink headshot eyes on quarter notes (or force)
    if (isQuarter || forceBlink){
      headshotWrap.classList.add("blink");
      setTimeout(() => headshotWrap.classList.remove("blink"), 90);
    }

    // Music note playback: on each tick, if the current line has a note/chord in note box i
    // sustain until next tick, but we can also stretch to next filled note by scanning ahead.
    const noteDur = (60/state.bpm)/2; // one eighth note in seconds
    const ref = state.linePlayRef;
    if (ref){
      const line = getLine(ref.sectionId, ref.lineIndex);
      if (line){
        const cellVal = (line.notes?.[i] || "").trim();
        if (cellVal){
          // sustain slightly longer for smoother transitions
          playMusicNote(cellVal, t, noteDur * 1.15);
        }
      }
    }

    // advance tick
    state.tickIndex = (state.tickIndex + 1) % 8;
  }

  /***********************
   * Highlighting
   ***********************/
  function clearHighlights(){
    document.querySelectorAll(".beatBox.hl").forEach(el => el.classList.remove("hl"));
    document.querySelectorAll(".syllCell.hl").forEach(el => el.classList.remove("hl"));
    document.querySelectorAll(".noteCell.hl").forEach(el => el.classList.remove("hl"));
  }

  function applyHighlights(eighthIndex){
    clearHighlights();

    const ref = state.linePlayRef;
    if (!ref) return;

    // Highlight syllable cell and note cell
    const lineKey = `${ref.sectionId}::${ref.lineIndex}`;
    const syllCell = document.querySelector(`[data-syllkey="${cssEscape(lineKey)}"][data-idx="${eighthIndex}"]`);
    if (syllCell) syllCell.classList.add("hl");

    const noteCell = document.querySelector(`[data-notekey="${cssEscape(lineKey)}"][data-idx="${eighthIndex}"]`);
    if (noteCell) noteCell.classList.add("hl");

    // Highlight beat box (quarter)
    const beatNum = Math.floor(eighthIndex/2); // 0..3
    const beatBox = document.querySelector(`[data-beatkey="${cssEscape(lineKey)}"][data-beat="${beatNum}"]`);
    if (beatBox) beatBox.classList.add("hl");
  }

  function cssEscape(s){
    // minimal attribute escape
    return String(s).replace(/"/g, '\\"');
  }

  /***********************
   * Editor Rendering
   ***********************/
  function getLine(sectionId, lineIndex){
    const p = getProject();
    const sec = p.sections?.[sectionId];
    if (!sec) return null;
    return sec.lines?.[lineIndex] || null;
  }

  function render(){
    buildTabs();

    // heading/hint
    const page = PAGES.find(x => x.id === state.pageId);
    pageHeading.textContent = page ? page.name : "Full";
    pageHint.textContent = (state.pageId === "full")
      ? "Full editor auto-populates section pages. Add spacers here without affecting section pages."
      : "This page is populated from the Full editor (same content, no extra spacer blocks).";

    // render sections depending on page
    editorRoot.innerHTML = "";

    if (state.pageId === "full"){
      for (const s of FULL_SECTIONS){
        editorRoot.appendChild(renderSectionCard(s.id, s.title, true));
      }
    } else {
      // section page
      const secId = state.pageId;
      const s = FULL_SECTIONS.find(x => x.id === secId);
      if (!s){
        editorRoot.appendChild(renderSectionCard("v1", "VERSE 1", false));
      } else {
        editorRoot.appendChild(renderSectionCard(s.id, s.title, false));
      }
    }

    // Update key estimate (based on chords in project)
    const key = estimateKeyFromProject(getProject(), state.capo);
    keyOutput.value = key || "—";

    setSplitButtons();
    setInstrumentButtons();
    setDrumButtons();
  }

  function renderSectionCard(sectionId, title, allowSpacers){
    const p = getProject();
    const sec = p.sections[sectionId];

    const card = document.createElement("div");
    card.className = "sectionCard";

    const header = document.createElement("div");
    header.className = "sectionHeader";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = title;

    const tools = document.createElement("div");
    tools.className = "tools";

    if (allowSpacers){
      const addSpacerBtn = document.createElement("button");
      addSpacerBtn.className = "btn secondary small";
      addSpacerBtn.textContent = "Add Spacer";
      addSpacerBtn.title = "Adds an empty visual gap here only (won't affect section pages).";
      addSpacerBtn.addEventListener("click", () => {
        // add spacer after last line by default
        sec.spacers = sec.spacers || [];
        const afterIndex = Math.max(0, sec.lines.length - 1);
        sec.spacers.push(afterIndex);
        touchProject();
        saveAll();
        render();
      });

      const clearSpacersBtn = document.createElement("button");
      clearSpacersBtn.className = "btn secondary small";
      clearSpacersBtn.textContent = "Clear Spacers";
      clearSpacersBtn.addEventListener("click", () => {
        sec.spacers = [];
        touchProject();
        saveAll();
        render();
      });

      tools.appendChild(addSpacerBtn);
      tools.appendChild(clearSpacersBtn);
    }

    const addLineBtn = document.createElement("button");
    addLineBtn.className = "btn secondary small";
    addLineBtn.textContent = "+ Line";
    addLineBtn.addEventListener("click", () => {
      sec.lines.push(emptyLine());
      touchProject();
      saveAll();
      render();
    });

    const delLineBtn = document.createElement("button");
    delLineBtn.className = "btn secondary small";
    delLineBtn.textContent = "− Line";
    delLineBtn.addEventListener("click", () => {
      if (sec.lines.length <= 1) return;
      sec.lines.pop();
      // also prune spacers that point past end
      sec.spacers = (sec.spacers || []).filter(i => i < sec.lines.length);
      touchProject();
      saveAll();
      render();
    });

    tools.appendChild(addLineBtn);
    tools.appendChild(delLineBtn);

    header.appendChild(name);
    header.appendChild(tools);

    const linesWrap = document.createElement("div");
    linesWrap.className = "lines";

    // render lines with optional spacer blocks (full only)
    const spacers = new Set((sec.spacers || []).map(n => Number(n)));
    sec.lines.forEach((line, idx) => {
      linesWrap.appendChild(renderLine(sectionId, idx, line));
      if (allowSpacers && spacers.has(idx)){
        const spacer = document.createElement("div");
        spacer.style.height = "18px";
        spacer.style.borderTop = "1px dashed rgba(0,0,0,.15)";
        spacer.style.borderBottom = "1px dashed rgba(0,0,0,.15)";
        spacer.style.borderRadius = "12px";
        spacer.style.background = "rgba(255,255,255,.65)";
        linesWrap.appendChild(spacer);
      }
    });

    card.appendChild(header);
    card.appendChild(linesWrap);
    return card;
  }

  function renderLine(sectionId, lineIndex, line){
    const wrap = document.createElement("div");
    wrap.className = "line";

    const lineKey = `${sectionId}::${lineIndex}`;

    // note row (8 boxes)
    const noteRow = document.createElement("div");
    noteRow.className = "noteRow";

    for (let i=0;i<8;i++){
      const inp = document.createElement("input");
      inp.className = "noteCell";
      inp.value = line.notes[i] || "";
      inp.placeholder = (i%2===0) ? "♪" : "";
      inp.setAttribute("data-notekey", lineKey);
      inp.setAttribute("data-idx", String(i));
      inp.addEventListener("focus", () => {
        state.linePlayRef = { sectionId, lineIndex };
      });
      inp.addEventListener("input", () => {
        line.notes[i] = inp.value;
        touchProject();
        saveAll();
        // update key estimate quickly
        keyOutput.value = estimateKeyFromProject(getProject(), state.capo) || "—";
      });
      noteRow.appendChild(inp);
    }

    // lyric row
    const lyricRow = document.createElement("div");
    lyricRow.className = "lyricRow";

    const ta = document.createElement("textarea");
    ta.className = "lyrics";
    ta.value = line.lyrics || "";
    ta.placeholder = state.autoSplit
      ? "Type lyrics (auto-syllable will map under the line)…"
      : "Type lyrics and split syllables with “/” (example: ste/reo/ty/pi/cal)…";
    ta.addEventListener("focus", () => {
      state.linePlayRef = { sectionId, lineIndex };
    });
    ta.addEventListener("input", () => {
      line.lyrics = ta.value;
      touchProject();
      saveAll();
      // update syllable row in-place
      updateSyllableRow(wrap, lineKey, line.lyrics);
    });

    lyricRow.appendChild(ta);

    // beat row (4 boxes)
    const beatRow = document.createElement("div");
    beatRow.className = "beatRow";

    for (let b=0;b<4;b++){
      const box = document.createElement("div");
      box.className = "beatBox" + ((b===1 || b===3) ? " b24" : "");
      box.setAttribute("data-beatkey", lineKey);
      box.setAttribute("data-beat", String(b));

      const top = document.createElement("div");
      top.className = "beatTop";

      const num = document.createElement("div");
      num.className = "bNum";
      num.textContent = `Beat ${b+1}`;

      const chord = document.createElement("input");
      chord.className = "chord";
      chord.value = line.chords[b] || "";
      chord.placeholder = "Chord";
      chord.title = "Enter chord (e.g., Am7, E7#9, Fmaj7). Capo transposes the displayed value.";
      chord.addEventListener("focus", () => {
        state.linePlayRef = { sectionId, lineIndex };
      });
      chord.addEventListener("input", () => {
        line.chords[b] = chord.value;
        touchProject();
        saveAll();
        keyOutput.value = estimateKeyFromProject(getProject(), state.capo) || "—";
        // refresh chord display (transposed)
        refreshChordDisplaysForLine(wrap, line, sectionId, lineIndex);
      });

      top.appendChild(num);
      top.appendChild(chord);
      box.appendChild(top);

      // show transposed chord below
      const disp = document.createElement("div");
      disp.style.fontFamily = "var(--mono)";
      disp.style.fontSize = "12px";
      disp.style.opacity = "0.92";
      disp.style.marginTop = "2px";
      disp.setAttribute("data-chorddisp", String(b));
      box.appendChild(disp);

      // allow click to set play ref
      box.addEventListener("click", () => {
        state.linePlayRef = { sectionId, lineIndex };
      });

      beatRow.appendChild(box);
    }

    // syllable row (8 boxes)
    const syllRow = document.createElement("div");
    syllRow.className = "syllRow";
    for (let i=0;i<8;i++){
      const c = document.createElement("div");
      c.className = "syllCell";
      c.setAttribute("data-syllkey", lineKey);
      c.setAttribute("data-idx", String(i));
      syllRow.appendChild(c);
    }

    wrap.appendChild(noteRow);
    wrap.appendChild(lyricRow);
    wrap.appendChild(beatRow);
    wrap.appendChild(syllRow);

    // initial populate
    updateSyllableRow(wrap, lineKey, line.lyrics || "");
    refreshChordDisplaysForLine(wrap, line, sectionId, lineIndex);

    return wrap;
  }

  function refreshChordDisplaysForLine(lineWrap, line){
    const capo = state.capo;
    const boxes = lineWrap.querySelectorAll(".beatBox");
    boxes.forEach((box, idx) => {
      const disp = box.querySelector('[data-chorddisp]');
      if (!disp) return;
      const raw = (line.chords[idx] || "").trim();
      const out = raw ? transposeChord(raw, capo) : "";
      disp.textContent = out ? `Sounding: ${out}` : "";
    });
  }

  function updateSyllableRow(lineWrap, lineKey, lyrics){
    const cells = lineWrap.querySelectorAll(`[data-syllkey="${cssEscape(lineKey)}"]`);
    const sylls = computeSyllableSlots(lyrics, state.autoSplit);
    for (let i=0;i<8;i++){
      const cell = Array.from(cells).find(el => Number(el.getAttribute("data-idx")) === i);
      if (!cell) continue;
      cell.textContent = sylls[i] || "";
    }
  }

  /***********************
   * Syllable mapping
   ***********************/
  function computeSyllableSlots(text, auto){
    const cleaned = (text || "").trim();
    if (!cleaned) return Array(8).fill("");

    let parts = [];
    if (!auto){
      // manual: split on "/" into syllables
      parts = cleaned.split("/").map(s => s.trim()).filter(Boolean);
    } else {
      // auto: quick-and-dirty syllable guess:
      // split words, then split by vowel-group boundaries
      const words = cleaned
        .replace(/[“”"]/g,"")
        .replace(/[^\w'\- ]+/g," ")
        .split(/\s+/)
        .filter(Boolean);

      for (const w0 of words){
        const w = w0.replace(/_/g,"");
        parts.push(...roughSyllables(w));
      }
    }

    // Fit into 8 slots: if more than 8, pack extras into last slot
    const slots = Array(8).fill("");
    if (parts.length <= 8){
      for (let i=0;i<parts.length;i++) slots[i] = parts[i];
    } else {
      for (let i=0;i<7;i++) slots[i] = parts[i];
      slots[7] = parts.slice(7).join(" ");
    }
    return slots;
  }

  function roughSyllables(word){
    const w = String(word);
    if (w.length <= 3) return [w];

    // vowel groups
    const vowels = "aeiouyAEIOUY";
    const out = [];
    let cur = "";
    let lastWasVowel = vowels.includes(w[0]);

    for (let i=0;i<w.length;i++){
      const ch = w[i];
      const isV = vowels.includes(ch);
      cur += ch;

      // boundary: vowel->consonant after a vowel group, but avoid ending with a single letter syllable often
      if (lastWasVowel && !isV){
        // lookahead: if next char exists and is vowel, break here
        if (i+1 < w.length && vowels.includes(w[i+1])){
          out.push(cur.slice(0,-1));
          cur = ch;
        }
      }
      lastWasVowel = isV;
    }
    if (cur) out.push(cur);

    // cleanup empties
    return out.map(s => s.trim()).filter(Boolean);
  }

  /***********************
   * Note / Chord parsing + Transpose (Capo)
   ***********************/
  const NOTE_NAMES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const NOTE_NAMES_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

  function normalizeRoot(root){
    // root like "Db" or "C#"
    const r = root.replace(/[^A-Ga-g#b]/g,"");
    if (!r) return null;
    const L = r[0].toUpperCase();
    const acc = r.slice(1);
    return L + acc;
  }

  function noteIndex(root){
    // returns 0..11 for C..B
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

  function transposeChord(chord, capo){
    // chord: Root + suffix, support slash bass (e.g., D/F#)
    const s = String(chord).trim();
    if (!s) return "";

    // capture root (A-G)(#|b)?
    const m = s.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return s;

    const root = (m[1].toUpperCase() + (m[2] || ""));
    let rest = m[3] || "";

    // slash bass?
    const slash = rest.match(/^(.*)\/([A-Ga-g])([#b]?)\s*$/);
    if (slash){
      const before = slash[1] || "";
      const bassRoot = (slash[2].toUpperCase() + (slash[3]||""));
      const trRoot = transposeRoot(root, capo);
      const trBass = transposeRoot(bassRoot, capo);
      return `${trRoot}${before}/${trBass}`;
    }

    const tr = transposeRoot(root, capo);
    return `${tr}${rest}`;
  }

  function noteToFreqs(noteStr, capo){
    // Accept: C, C#, Db, A4, etc.
    const s = String(noteStr).trim();
    const m = s.match(/^([A-Ga-g])([#b]?)(-?\d+)?$/);
    if (!m) return null;

    const root = (m[1].toUpperCase() + (m[2]||""));
    const octave = m[3] ? parseInt(m[3],10) : 4; // default 4
    const idx = noteIndex(root);
    if (idx === null) return null;

    // Apply capo as semitone shift up
    const idx2 = idx + capo;

    // Convert to midi: C4 = 60
    const midi = (octave + 1) * 12 + idx2;
    const freq = midiToFreq(midi);
    return [freq];
  }

  function chordToFreqs(chordStr, capo){
    // basic triad/seventh support:
    // Root + quality: m, min, maj, dim, aug, sus2/sus4, 7, maj7, m7, m7b5, add9, 9 (approx)
    const s = String(chordStr).trim();
    if (!s) return null;

    const m = s.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return null;

    const root = (m[1].toUpperCase() + (m[2]||""));
    const suffix = (m[3]||"").trim();

    const rootIdx = noteIndex(root);
    if (rootIdx === null) return null;

    // slash bass ignored for voicing here (still plays chord)
    const suffixNoSlash = suffix.split("/")[0].trim();

    // determine intervals (in semitones) from root
    let intervals = [0, 4, 7]; // major triad default

    const low = suffixNoSlash.toLowerCase();

    if (low.startsWith("m") && !low.startsWith("maj")) intervals = [0, 3, 7]; // minor
    if (low.includes("dim")) intervals = [0, 3, 6];
    if (low.includes("aug")) intervals = [0, 4, 8];
    if (low.includes("sus2")) intervals = [0, 2, 7];
    if (low.includes("sus4") || low.includes("sus")) intervals = [0, 5, 7];

    // sevenths
    if (low.includes("maj7")) intervals = [...intervals, 11];
    else if (low.includes("m7") || low.includes("min7")) intervals = [...intervals, 10]; // minor 7th in common usage
    else if (low.includes("7")) intervals = [...intervals, 10];

    // half-diminished
    if (low.includes("m7b5") || low.includes("ø")){
      intervals = [0, 3, 6, 10];
    }

    // add9 / 9
    if (low.includes("add9")) intervals = [...intervals, 14];
    else if (/\b9\b/.test(low) || low.endsWith("9")) intervals = [...intervals, 14];

    // #9 (like E7#9) add +15 (minor third above 9)
    if (low.includes("#9")) intervals = [...intervals, 15];

    // pick a comfortable octave around A3–A4 region
    const baseOct = 3;
    const rootMidi = (baseOct + 1) * 12 + (rootIdx + capo); // C4 = 60
    const freqs = intervals.map(semi => midiToFreq(rootMidi + semi));
    return freqs;
  }

  function midiToFreq(m){
    return 440 * Math.pow(2, (m - 69)/12);
  }

  /***********************
   * Key Estimation
   ***********************/
  function estimateKeyFromProject(project, capo){
    // Gather all chord roots, then find best matching major/minor key (simple diatonic fit)
    const roots = [];
    for (const sid of Object.keys(project.sections || {})){
      const sec = project.sections[sid];
      for (const line of (sec.lines || [])){
        for (const c of (line.chords || [])){
          const raw = (c || "").trim();
          if (!raw) continue;
          const tr = transposeChord(raw, capo);
          const rm = tr.match(/^([A-G])([#b]?)/);
          if (!rm) continue;
          roots.push(rm[1] + (rm[2]||""));
        }
      }
    }
    if (!roots.length) return "";

    // Count occurrences
    const count = new Map();
    for (const r of roots){
      count.set(r, (count.get(r)||0)+1);
    }

    // diatonic sets
    const MAJOR_STEPS = [0,2,4,5,7,9,11];
    const MINOR_STEPS = [0,2,3,5,7,8,10]; // natural minor
    const candidates = [];

    for (let tonic=0; tonic<12; tonic++){
      const majSet = new Set(MAJOR_STEPS.map(x => (tonic+x)%12));
      const minSet = new Set(MINOR_STEPS.map(x => (tonic+x)%12));

      let majScore = 0, minScore = 0;

      for (const [r, n] of count.entries()){
        const idx = noteIndex(r);
        if (idx === null) continue;
        if (majSet.has(idx)) majScore += n;
        if (minSet.has(idx)) minScore += n;
      }

      // prefer if tonic appears frequently
      const tonicName = idxToName(tonic, false);
      const tonicNameFlat = idxToName(tonic, true);
      const tonicBoost = (count.get(tonicName)||0) + (count.get(tonicNameFlat)||0);

      candidates.push({ mode:"Major", tonic, score: majScore + tonicBoost*0.6 });
      candidates.push({ mode:"Minor", tonic, score: minScore + tonicBoost*0.6 });
    }

    candidates.sort((a,b)=> b.score - a.score);
    const best = candidates[0];
    if (!best) return "";

    // display name: prefer flats if many flats present
    const flatBias = roots.filter(r => r.includes("b")).length > roots.filter(r => r.includes("#")).length;
    const name = idxToName(best.tonic, flatBias);
    return `${name} ${best.mode}`;
  }

  /***********************
   * Recording (Mic)
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
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus"
    ];
    for (const t of types){
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  recordBtn.addEventListener("click", startRecording);
  recordBtn2.addEventListener("click", startRecording);
  stopRecordBtn.addEventListener("click", stopRecording);

  /***********************
   * Play-ref selection (focus tracking)
   ***********************/
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    // When focusing inside a line, state.linePlayRef is set by listeners.
    // This is just a fallback.
    if (el && el.classList && (el.classList.contains("lyrics") || el.classList.contains("noteCell") || el.classList.contains("chord"))){
      // do nothing here
    }
  });

  /***********************
   * PWA install (optional)
   ***********************/
  if ("serviceWorker" in navigator){
    // This app works without SW; you can add sw.js later if you want offline caching.
    // Keeping it minimal to match your request: only manifest.
  }

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
