/* Song Rider Pro - app.js (FULL REPLACE v8) */
(function(){
  "use strict";
  function $(sel){ return document.querySelector(sel); }
  function setBoot(msg, ok){
    var el = document.getElementById("jsBoot");
    if (!el) return;
    el.textContent = msg;
    el.className = ok ? "ok" : "err";
  }

  try{
    setBoot("JS loaded ✓ (building editor…)", true);

    /***********************
     * DOM
     ***********************/
    var headshotWrap = $("#headshotWrap");
    var headshotImg  = $("#headshotImg");

    var togglePanelBtn = $("#togglePanelBtn");
    var panelBody = $("#panelBody");

    var autoSplitBtn = $("#autoSplitBtn");
    var bpmInput = $("#bpmInput");
    var capoInput = $("#capoInput");
    var keyOutput = $("#keyOutput");

    var instAcoustic = $("#instAcoustic");
    var instElectric = $("#instElectric");
    var instPiano = $("#instPiano");

    var drumRock = $("#drumRock");
    var drumHardRock = $("#drumHardRock");
    var drumPop = $("#drumPop");
    var drumRap = $("#drumRap");

    var recordBtn = $("#recordBtn");
    var stopRecordBtn = $("#stopRecordBtn");

    var projectSelect = $("#projectSelect");
    var renameProjectBtn = $("#renameProjectBtn");
    var clearProjectBtn = $("#clearProjectBtn");

    var recordingsList = $("#recordingsList");
    var tabsEl = $("#tabs");
    var editorRoot = $("#editorRoot");
    var statusEl = $("#status");
    function setStatus(msg){ if(statusEl) statusEl.textContent = msg; }

    if (!tabsEl || !editorRoot) { setBoot("JS ERROR: missing #tabs or #editorRoot", false); return; }

    if (headshotImg){
      headshotImg.addEventListener("error", function(){
        headshotImg.src = "headshot.png?v=8";
      });
    }

    /***********************
     * Storage isolation
     ***********************/
    var APP_SCOPE = (function(){
      try{
        var parts = location.pathname.split("/").filter(Boolean);
        return parts.length ? parts[0] : "root";
      }catch(e){ return "root"; }
    })();
    function lsKey(k){ return APP_SCOPE + "::songriderpro::" + k; }
    function lsGet(k, fallback){
      try{
        var v = localStorage.getItem(lsKey(k));
        return v ? JSON.parse(v) : fallback;
      }catch(e){ return fallback; }
    }
    function lsSet(k, v){
      try{ localStorage.setItem(lsKey(k), JSON.stringify(v)); }catch(e){}
    }

    /***********************
     * Pages/Sections
     ***********************/
    var PAGES = [
      { id:"full", name:"Full" },
      { id:"v1", name:"VERSE 1" },
      { id:"c1", name:"CHORUS 1" },
      { id:"v2", name:"VERSE 2" },
      { id:"c2", name:"CHORUS 2" },
      { id:"v3", name:"VERSE 3" },
      { id:"br", name:"BRIDGE" },
      { id:"c3", name:"CHORUS 3" }
    ];
    var SECTIONS = [
      { id:"v1", title:"VERSE 1" },
      { id:"c1", title:"CHORUS 1" },
      { id:"v2", title:"VERSE 2" },
      { id:"c2", title:"CHORUS 2" },
      { id:"v3", title:"VERSE 3" },
      { id:"br", title:"BRIDGE" },
      { id:"c3", title:"CHORUS 3" }
    ];
    var CARDS_PER_SECTION = 20;

    function emptyCard(){ return { notesRaw: ["","","","","","","",""], lyric:"" }; }
    function emptySection(title){
      var cards=[]; for (var i=0;i<CARDS_PER_SECTION;i++) cards.push(emptyCard());
      return { title:title, cards:cards };
    }
    function defaultProjectData(){
      var sections={}; for (var i=0;i<SECTIONS.length;i++) sections[SECTIONS[i].id]=emptySection(SECTIONS[i].title);
      return { meta:{ bpm:95, capo:0, autoSplit:false, instrument:"acoustic" }, sections:sections, updatedAt:Date.now() };
    }
    function clampInt(v, a, b){
      v = Number(v);
      if (!isFinite(v)) v = a;
      v = Math.round(v);
      if (v < a) v = a;
      if (v > b) v = b;
      return v;
    }

    /***********************
     * State
     ***********************/
    var state = {
      pageId:"full",
      projectId:"A",
      recentProjects:[],
      autoSplit:false,
      bpm:95,
      capo:0,
      instrument:"acoustic",
      drumStyle:null,
      playing:false,
      tickIndex:0,
      recordingsMeta:[],
      projectNames:{},
      dataByProject:{}
    };

    function getProject(){
      if (!state.dataByProject[state.projectId]) state.dataByProject[state.projectId]=defaultProjectData();
      return state.dataByProject[state.projectId];
    }
    function touchProject(){
      var p = getProject();
      p.updatedAt = Date.now();
      var list=[state.projectId];
      for (var i=0;i<state.recentProjects.length;i++){
        if (state.recentProjects[i]!==state.projectId) list.push(state.recentProjects[i]);
      }
      state.recentProjects = list.slice(0,10);
    }
    function loadAll(){
      var saved = lsGet("state", null);
      var data  = lsGet("dataByProject", null);
      var recent= lsGet("recentProjects", []);
      var names = lsGet("projectNames", {});
      if (data && typeof data==="object") state.dataByProject = data;
      if (saved && typeof saved==="object"){
        for (var k in saved) state[k]=saved[k];
      }
      state.recentProjects = Array.isArray(recent)?recent:[];
      state.projectNames = (names && typeof names==="object")?names:{};
      if (!state.dataByProject[state.projectId]) state.dataByProject[state.projectId]=defaultProjectData();
      syncMetaFromProject();
    }
    function saveAll(){
      lsSet("state", {
        pageId:state.pageId,
        projectId:state.projectId,
        recentProjects:state.recentProjects,
        autoSplit:state.autoSplit,
        bpm:state.bpm,
        capo:state.capo,
        instrument:state.instrument,
        drumStyle:state.drumStyle,
        playing:false,
        tickIndex:0
      });
      lsSet("dataByProject", state.dataByProject);
      lsSet("recentProjects", state.recentProjects);
      lsSet("projectNames", state.projectNames);
    }
    function syncMetaFromProject(){
      var p=getProject(), m=p.meta||{};
      state.bpm = clampInt(m.bpm!=null?m.bpm:state.bpm,40,220);
      state.capo= clampInt(m.capo!=null?m.capo:state.capo,0,12);
      state.autoSplit=!!(m.autoSplit!=null?m.autoSplit:state.autoSplit);
      state.instrument=m.instrument||state.instrument;
      bpmInput.value = state.bpm;
      capoInput.value = state.capo;
      setAutoSplitButton();
      setInstrumentButtons();
    }
    function syncMetaToProject(){
      var p=getProject();
      if(!p.meta) p.meta={};
      p.meta.bpm=state.bpm;
      p.meta.capo=state.capo;
      p.meta.autoSplit=state.autoSplit;
      p.meta.instrument=state.instrument;
      touchProject(); saveAll();
    }

    /***********************
     * UI helpers
     ***********************/
    function setAutoSplitButton(){
      autoSplitBtn.classList.toggle("active", state.autoSplit);
      autoSplitBtn.textContent = state.autoSplit ? "AutoSplit: ON" : "AutoSplit: OFF";
    }
    function setInstrumentButtons(){
      instAcoustic.classList.toggle("active", state.instrument==="acoustic");
      instElectric.classList.toggle("active", state.instrument==="electric");
      instPiano.classList.toggle("active", state.instrument==="piano");
    }
    function setDrumButtons(){
      drumRock.classList.toggle("active", state.drumStyle==="rock");
      drumHardRock.classList.toggle("active", state.drumStyle==="hardrock");
      drumPop.classList.toggle("active", state.drumStyle==="pop");
      drumRap.classList.toggle("active", state.drumStyle==="rap");
    }
    function blinkHead(){
      if(!headshotWrap) return;
      headshotWrap.classList.add("blink");
      setTimeout(function(){ headshotWrap.classList.remove("blink"); }, 90);
    }

    /***********************
     * Syllables
     ***********************/
    function roughSyllables(word){
      var w=String(word||"");
      if (w.length<=3) return [w];
      var vowels="aeiouyAEIOUY";
      var out=[], cur="", lastV=vowels.indexOf(w[0])!==-1;
      for (var i=0;i<w.length;i++){
        var ch=w[i], isV=vowels.indexOf(ch)!==-1;
        cur+=ch;
        if(lastV && !isV){
          if(i+1<w.length && vowels.indexOf(w[i+1])!==-1){
            out.push(cur.slice(0,-1)); cur=ch;
          }
        }
        lastV=isV;
      }
      if(cur) out.push(cur);
      return out.map(function(s){return s.trim();}).filter(Boolean);
    }
    function extractSyllableUnits(text){
      var cleaned=String(text||"").trim();
      if(!cleaned) return [];
      if(!state.autoSplit){
        return cleaned.split("/").map(function(s){return s.trim();}).filter(Boolean);
      }
      var words=cleaned
        .replace(/[“”"]/g,"")
        .replace(/[^\w'\- ]+/g," ")
        .split(/\s+/).filter(Boolean);
      var parts=[];
      for(var i=0;i<words.length;i++){
        var spl=roughSyllables(words[i]);
        for(var j=0;j<spl.length;j++) parts.push(spl[j]);
      }
      return parts;
    }
    function timingSlots4(text){
      var units=extractSyllableUnits(text);
      var count=units.length;
      var slots=["","","",""];
      if(!units.length) return {slots:slots, count:count};
      var per=Math.ceil(units.length/4);
      for(var i=0;i<4;i++){
        slots[i]=units.slice(i*per,(i+1)*per).join(" ");
      }
      return {slots:slots, count:count};
    }
    function syllColor(count){
      if ((count>=1 && count<=5) || count>=16) return "red";
      if ((count>=6 && count<=9) || (count>=14 && count<=15)) return "yellow";
      if (count>=10 && count<=13) return "green";
      return "red";
    }

    /***********************
     * Transpose tokens (capo)
     ***********************/
    var SHARP=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    var FLAT =["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
    function noteIndex(root){
      var r=String(root||"").replace(/[^A-Ga-g#b]/g,"");
      if(!r) return null;
      r=r[0].toUpperCase()+r.slice(1);
      var i=SHARP.indexOf(r); if(i!==-1) return i;
      i=FLAT.indexOf(r); if(i!==-1) return i;
      return null;
    }
    function idxToName(idx, preferFlats){
      idx=((idx%12)+12)%12;
      return preferFlats?FLAT[idx]:SHARP[idx];
    }
    function transposeToken(tok, semis){
      var s=String(tok||"").trim();
      if(!s) return "";
      var m=s.match(/^([A-Ga-g])([#b]?)(.*)$/);
      if(!m) return s;
      var root=(m[1].toUpperCase()+(m[2]||""));
      var rest=(m[3]||"");
      var idx=noteIndex(root);
      if(idx==null) return s;
      var preferFlats=(root.indexOf("b")!==-1 && root.indexOf("#")===-1);
      return idxToName(idx+semis, preferFlats)+rest;
    }
    function chordRoot(token){
      var s=String(token||"").trim();
      if(!s) return null;
      var m=s.match(/^([A-Ga-g])([#b]?)/);
      if(!m) return null;
      return (m[1].toUpperCase()+(m[2]||""));
    }

    /***********************
     * REAL key detection (Krumhansl-Schmuckler)
     ***********************/
    var KK_MAJOR=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
    var KK_MINOR=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

    function rotate(arr, n){
      var out=new Array(arr.length);
      for(var i=0;i<arr.length;i++) out[(i+n)%arr.length]=arr[i];
      return out;
    }
    function dot(a,b){
      var s=0;
      for(var i=0;i<a.length;i++) s += a[i]*b[i];
      return s;
    }
    function norm(a){
      var s=0;
      for(var i=0;i<a.length;i++) s += a[i]*a[i];
      return Math.sqrt(s) || 1;
    }
    function keyFromHistogram(hist){
      // hist = 12 bins pitch-class weights
      var best={score:-1e9, name:""};
      var hnorm = norm(hist);

      for(var t=0;t<12;t++){
        var maj=rotate(KK_MAJOR, t);
        var min=rotate(KK_MINOR, t);
        var majScore = dot(hist, maj)/(hnorm*norm(maj));
        var minScore = dot(hist, min)/(hnorm*norm(min));
        if(majScore>best.score) best={score:majScore, name:SHARP[t]+" major"};
        if(minScore>best.score) best={score:minScore, name:SHARP[t]+" minor"};
      }
      return best.name;
    }

    function computeKey(){
      var proj=getProject();
      var hist=new Array(12).fill(0);

      // use ALL notesRaw across ALL sections; weight by presence
      for(var sid in proj.sections){
        var sec=proj.sections[sid];
        for(var i=0;i<sec.cards.length;i++){
          var card=sec.cards[i];
          for(var n=0;n<8;n++){
            var shown = transposeToken(card.notesRaw[n]||"", state.capo);
            var root = chordRoot(shown);
            if(!root) continue;
            var idx = noteIndex(root);
            if(idx==null) continue;
            hist[idx] += 1;
          }
        }
      }

      var total = hist.reduce(function(a,b){return a+b;},0);
      if(total < 3) return "—";
      return keyFromHistogram(hist) + " (auto)";
    }

    /***********************
     * Render
     ***********************/
    function buildTabs(){
      tabsEl.innerHTML="";
      for(var i=0;i<PAGES.length;i++){
        (function(p){
          var b=document.createElement("button");
          b.className="tab"+(state.pageId===p.id?" active":"");
          b.textContent=p.name;
          b.addEventListener("click", function(){
            state.pageId=p.id;
            render();
            saveAll();
          });
          tabsEl.appendChild(b);
        })(PAGES[i]);
      }
    }
    function buildProjectsSelect(){
      projectSelect.innerHTML="";
      var optRecent=document.createElement("option");
      optRecent.value="__RECENT__";
      optRecent.textContent="Recent…";
      projectSelect.appendChild(optRecent);

      for(var i=0;i<26;i++){
        var letter=String.fromCharCode(65+i);
        var name = state.projectNames[letter] ? (" — "+state.projectNames[letter]) : "";
        var opt=document.createElement("option");
        opt.value=letter;
        opt.textContent="Project "+letter+name;
        projectSelect.appendChild(opt);
      }
      projectSelect.value=state.projectId;
    }
    function openRecentPicker(){
      var rec = state.recentProjects.length ? state.recentProjects : ["A"];
      var pick = prompt("Recent projects:\n"+rec.join(", ")+"\n\nType a letter to open:", rec[0]);
      if(!pick) return;
      var letter=pick.trim().toUpperCase();
      if(!/^[A-Z]$/.test(letter)){ setStatus("Invalid project. Use A–Z."); return; }
      state.projectId=letter;
      if(!state.dataByProject[state.projectId]) state.dataByProject[state.projectId]=defaultProjectData();
      syncMetaFromProject();
      buildProjectsSelect();
      render();
      saveAll();
    }

    function render(){
      buildTabs();
      buildProjectsSelect();
      setAutoSplitButton();
      setInstrumentButtons();
      setDrumButtons();

      keyOutput.value = computeKey();

      editorRoot.innerHTML="";
      var header=document.createElement("div");
      header.className="sheetHeader";
      var h2=document.createElement("h2");
      var hint=document.createElement("div");
      hint.className="hint";

      var name="Full";
      for(var i=0;i<PAGES.length;i++) if(PAGES[i].id===state.pageId) name=PAGES[i].name;
      h2.textContent=name;
      hint.textContent = (state.pageId==="full")
        ? "Full editor (master). Section pages mirror the same data."
        : "Section page (20 cards).";

      header.appendChild(h2); header.appendChild(hint);
      editorRoot.appendChild(header);

      var proj=getProject();
      if(state.pageId==="full"){
        for(var s=0;s<SECTIONS.length;s++){
          editorRoot.appendChild(renderSection(proj, SECTIONS[s].id));
        }
      }else{
        editorRoot.appendChild(renderSection(proj, state.pageId));
      }

      setBoot("JS running ✓ (editor rendered)", true);
    }

    function renderSection(project, sectionId){
      var sec=project.sections[sectionId];
      var wrap=document.createElement("div");
      var sh=document.createElement("div");
      sh.className="sectionHeader";
      sh.textContent = sec ? sec.title : sectionId;
      wrap.appendChild(sh);

      var cards=document.createElement("div");
      cards.className="cards";
      if(!sec){
        var err=document.createElement("div");
        err.className="card";
        err.textContent="Missing section: "+sectionId;
        cards.appendChild(err);
        wrap.appendChild(cards);
        return wrap;
      }

      for(var i=0;i<CARDS_PER_SECTION;i++){
        cards.appendChild(renderCard(sectionId, i, sec.cards[i]));
      }
      wrap.appendChild(cards);
      return wrap;
    }

    function renderCard(sectionId, idx, card){
      var cardEl=document.createElement("div");
      cardEl.className="card";

      var t=timingSlots4(card.lyric||"");

      var top=document.createElement("div");
      top.className="cardTop";

      var num=document.createElement("div");
      num.className="cardNum";
      num.textContent = String(idx+1); // ✅ only number

      var pill=document.createElement("div");
      pill.className="syllPill "+syllColor(t.count);
      pill.textContent="Syllables: "+t.count;

      top.appendChild(num);
      top.appendChild(pill);

      var notesRow=document.createElement("div");
      notesRow.className="notesRow";
      for(var i=0;i<8;i++){
        (function(i){
          var inp=document.createElement("input");
          inp.className="noteCell";
          inp.placeholder="Note";
          inp.value = transposeToken(card.notesRaw[i]||"", state.capo);

          inp.addEventListener("input", function(){
            // store de-transposed so raw stays capo-agnostic
            card.notesRaw[i] = transposeToken(inp.value, -state.capo);
            touchProject(); saveAll();
            keyOutput.value = computeKey();
          });
          notesRow.appendChild(inp);
        })(i);
      }

      var lyricRow=document.createElement("div");
      lyricRow.className="lyricRow";

      var ta=document.createElement("textarea");
      ta.className="lyrics";
      ta.value=card.lyric||"";
      ta.placeholder = state.autoSplit ? "Type lyrics (AutoSplit on)…" : "Type lyrics and split with “/”…";

      var timingRow=document.createElement("div");
      timingRow.className="timingRow";

      var timeCells=[];
      for(var j=0;j<4;j++){
        var cell=document.createElement("div");
        cell.className="timingCell";
        cell.textContent = t.slots[j] || "";
        timingRow.appendChild(cell);
        timeCells.push(cell);
      }

      ta.addEventListener("input", function(){
        card.lyric=ta.value;
        var t2=timingSlots4(card.lyric||"");
        pill.className="syllPill "+syllColor(t2.count);
        pill.textContent="Syllables: "+t2.count;
        for(var k=0;k<4;k++) timeCells[k].textContent = t2.slots[k] || "";
        touchProject(); saveAll();
      });

      lyricRow.appendChild(ta);

      cardEl.appendChild(top);
      cardEl.appendChild(notesRow);
      cardEl.appendChild(lyricRow);
      cardEl.appendChild(timingRow);

      return cardEl;
    }

    /***********************
     * Collapsible tray
     ***********************/
    var panelHidden=false;
    togglePanelBtn.addEventListener("click", function(){
      panelHidden=!panelHidden;
      panelBody.classList.toggle("hidden", panelHidden);
      togglePanelBtn.textContent = panelHidden ? "Show" : "Hide";
    });

    /***********************
     * Controls events
     ***********************/
    autoSplitBtn.addEventListener("click", function(){
      state.autoSplit=!state.autoSplit;
      setAutoSplitButton();
      syncMetaToProject();
      render();
    });

    bpmInput.addEventListener("change", function(){
      state.bpm = clampInt(bpmInput.value, 40, 220);
      bpmInput.value = state.bpm;
      syncMetaToProject();
      if(state.playing) restartDrums();
    });

    capoInput.addEventListener("change", function(){
      state.capo = clampInt(capoInput.value, 0, 12);
      capoInput.value = state.capo;
      syncMetaToProject();
      render();
    });

    instAcoustic.addEventListener("click", function(){ state.instrument="acoustic"; setInstrumentButtons(); syncMetaToProject(); });
    instElectric.addEventListener("click", function(){ state.instrument="electric"; setInstrumentButtons(); syncMetaToProject(); });
    instPiano.addEventListener("click", function(){ state.instrument="piano"; setInstrumentButtons(); syncMetaToProject(); });

    projectSelect.addEventListener("change", function(){
      var v=projectSelect.value;
      if(v==="__RECENT__"){ openRecentPicker(); return; }
      state.projectId=v;
      if(!state.dataByProject[state.projectId]) state.dataByProject[state.projectId]=defaultProjectData();
      syncMetaFromProject();
      render();
      saveAll();
    });

    renameProjectBtn.addEventListener("click", function(){
      var letter=state.projectId;
      var cur=state.projectNames[letter]||"";
      var name=prompt("Edit Project "+letter+" name:", cur);
      if(name===null) return;
      var clean=name.trim();
      if(!clean) delete state.projectNames[letter];
      else state.projectNames[letter]=clean.slice(0,40);
      saveAll();
      buildProjectsSelect();
    });

    clearProjectBtn.addEventListener("click", function(){
      if(!confirm("Clear ALL data in Project "+state.projectId+"?")) return;
      state.dataByProject[state.projectId]=defaultProjectData();
      syncMetaFromProject();
      render();
      saveAll();
    });

    /***********************
     * Drums (simple but working)
     * Tap style toggles playback.
     ***********************/
    var audioCtx = null;
    var drumTimer = null;

    function ensureAudio(){
      if(audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    function clickOsc(freq, t, dur, type, gain){
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    function noiseBurst(t, dur, gain){
      var bufferSize = Math.floor(audioCtx.sampleRate * dur);
      var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1);
      var src = audioCtx.createBufferSource();
      src.buffer = buffer;
      var filt = audioCtx.createBiquadFilter();
      filt.type = "highpass";
      filt.frequency.setValueAtTime(2500, t);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      src.connect(filt).connect(g).connect(audioCtx.destination);
      src.start(t);
      src.stop(t+dur+0.02);
    }

    function playKick(t, strength){
      // low sine + quick pitch drop
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(55, t+0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(strength, t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.12);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t+0.16);
    }

    function playSnare(t, strength){
      noiseBurst(t, 0.10, strength);
      clickOsc(190, t, 0.06, "triangle", strength*0.35);
    }

    function playHat(t, strength){
      noiseBurst(t, 0.035, strength);
    }

    function getPattern(style){
      // 16-step patterns (4/4) for kick/snare/hat
      // 1 = hit, 0 = no hit
      if(style==="rock"){
        return {
          kick:[1,0,0,0, 0,0,1,0, 0,0,0,0, 0,1,0,0],
          snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          hat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        };
      }
      if(style==="hardrock"){
        return {
          kick:[1,0,0,1, 0,1,0,1, 1,0,0,1, 0,1,0,1],
          snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          hat:[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
        };
      }
      if(style==="pop"){
        return {
          kick:[1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
          snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          hat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        };
      }
      // rap: simpler hats + heavy kick
      return {
        kick:[1,0,0,0, 0,1,0,0, 1,0,0,1, 0,0,1,0],
        snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        hat:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
      };
    }

    function stopDrums(){
      state.playing=false;
      state.tickIndex=0;
      if(drumTimer){ clearInterval(drumTimer); drumTimer=null; }
      setStatus("Drums stopped.");
      setDrumButtons();
      saveAll();
    }

    function startDrums(style){
      ensureAudio();
      if(audioCtx.state==="suspended") audioCtx.resume();

      state.drumStyle = style;
      state.playing = true;
      state.tickIndex = 0;
      setDrumButtons();
      saveAll();

      var pat = getPattern(style);

      // 16 steps per bar; step duration:
      // BPM quarter = 60/bpm sec. 16th = quarter/4
      function stepMs(){
        return (60/state.bpm) * 1000 / 4;
      }

      if(drumTimer) clearInterval(drumTimer);
      drumTimer = setInterval(function(){
        if(!state.playing) return;

        var now = audioCtx.currentTime;
        var i = state.tickIndex % 16;

        // blink eyes + (optional: later highlight beat boxes)
        blinkHead();

        // dynamics per style
        var kGain = (style==="hardrock") ? 0.9 : (style==="rap") ? 1.0 : 0.75;
        var sGain = (style==="hardrock") ? 0.85 : 0.65;
        var hGain = (style==="hardrock") ? 0.35 : (style==="rap") ? 0.28 : 0.22;

        if(pat.kick[i])  playKick(now, kGain);
        if(pat.snare[i]) playSnare(now, sGain);
        if(pat.hat[i])   playHat(now, hGain);

        state.tickIndex++;
      }, stepMs());

      setStatus("Drums: " + style.toUpperCase() + " (tap again to stop)");
    }

    function restartDrums(){
      if(!state.playing || !state.drumStyle) return;
      stopDrums();
      startDrums(state.drumStyle);
    }

    function toggleDrum(style){
      // tap same style = stop
      if(state.playing && state.drumStyle===style){ stopDrums(); state.drumStyle=null; setDrumButtons(); saveAll(); return; }
      // switching styles while playing
      startDrums(style);
    }

    drumRock.addEventListener("click", function(){ toggleDrum("rock"); });
    drumHardRock.addEventListener("click", function(){ toggleDrum("hardrock"); });
    drumPop.addEventListener("click", function(){ toggleDrum("pop"); });
    drumRap.addEventListener("click", function(){ toggleDrum("rap"); });

    /***********************
     * Recording UI placeholder (still next step)
     ***********************/
    function renderRecordings(){
      recordingsList.innerHTML="";
      var d=document.createElement("div");
      d.style.fontSize="13px";
      d.style.fontWeight="900";
      d.style.color="#666";
      d.textContent="Recordings UI (play/download/delete) will be added next.";
      recordingsList.appendChild(d);
    }
    recordBtn.addEventListener("click", function(){
      // for now: just prime audio so user interaction enables sound on mobile
      try{ ensureAudio(); if(audioCtx.state==="suspended") audioCtx.resume(); }catch(e){}
      alert("Recording UI is next. (Drums + layout + key detection fixed first.)");
    });
    stopRecordBtn.addEventListener("click", function(){});

    /***********************
     * Init
     ***********************/
    loadAll();
    render();
    renderRecordings();
    saveAll();
    setStatus("Ready.");

    setBoot("JS running ✓ (editor rendered)", true);

  }catch(err){
    console.error(err);
    setBoot("JS ERROR: " + (err && err.message ? err.message : String(err)), false);
  }
})();
