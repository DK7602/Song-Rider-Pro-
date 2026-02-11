/* Song Rider Pro - app.js (FULL REPLACE v10) */
(function(){
  "use strict";

  function $(s){ return document.querySelector(s); }
  function setBoot(msg, ok){
    var el=$("#jsBoot");
    if(!el) return;
    el.textContent=msg;
    el.className=ok ? "ok" : "err";
  }

  try{
    setBoot("JS loaded ✓ (building…)", true);

    /**********************
     * DOM
     **********************/
    var headshotWrap=$("#headshotWrap");
    var headshotImg=$("#headshotImg");

    var togglePanelBtn=$("#togglePanelBtn");
    var panelBody=$("#panelBody");

    var autoSplitBtn=$("#autoSplitBtn");
    var bpmInput=$("#bpmInput");
    var capoInput=$("#capoInput");
    var keyOutput=$("#keyOutput");

    var instAcoustic=$("#instAcoustic");
    var instElectric=$("#instElectric");
    var instPiano=$("#instPiano");

    var drumRock=$("#drumRock");
    var drumHardRock=$("#drumHardRock");
    var drumPop=$("#drumPop");
    var drumRap=$("#drumRap");

    var recordBtn=$("#recordBtn");

    var sortSelect=$("#sortSelect");
    var projectSelect=$("#projectSelect");
    var renameProjectBtn=$("#renameProjectBtn");
    var clearProjectBtn=$("#clearProjectBtn");

    var recordingsList=$("#recordingsList");

    var tabsEl=$("#tabs");
    var editorRoot=$("#editorRoot");
    var statusEl=$("#status");

    var rBtn=$("#rBtn");
    var rhymeDock=$("#rhymeDock");
    var rhymeTitle=$("#rhymeTitle");
    var rhymeWords=$("#rhymeWords");
    var hideRhymeBtn=$("#hideRhymeBtn");

    if(!tabsEl || !editorRoot){
      setBoot("JS ERROR: missing #tabs or #editorRoot", false);
      return;
    }

    function setStatus(t){ if(statusEl) statusEl.textContent=t; }
    function blinkHead(){
      if(!headshotWrap) return;
      headshotWrap.classList.add("blink");
      setTimeout(function(){ headshotWrap.classList.remove("blink"); }, 80);
    }

    if(headshotImg){
      headshotImg.addEventListener("error", function(){
        headshotImg.src = "headshot.png?v=10";
      });
    }

    /**********************
     * Storage isolation
     **********************/
    var APP_SCOPE=(function(){
      try{
        var parts=location.pathname.split("/").filter(Boolean);
        return parts.length ? parts[0] : "root";
      }catch(e){ return "root"; }
    })();
    function lsKey(k){ return APP_SCOPE+"::songriderpro::"+k; }
    function lsGet(k, fb){
      try{
        var v=localStorage.getItem(lsKey(k));
        return v ? JSON.parse(v) : fb;
      }catch(e){ return fb; }
    }
    function lsSet(k,v){
      try{ localStorage.setItem(lsKey(k), JSON.stringify(v)); }catch(e){}
    }

    /**********************
     * IndexedDB for recordings
     **********************/
    var DB_NAME = "songriderpro_db";
    var DB_STORE = "recordings";
    function openDB(){
      return new Promise(function(resolve,reject){
        var req=indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded=function(){
          var db=req.result;
          if(!db.objectStoreNames.contains(DB_STORE)){
            db.createObjectStore(DB_STORE, { keyPath:"id" });
          }
        };
        req.onsuccess=function(){ resolve(req.result); };
        req.onerror=function(){ reject(req.error); };
      });
    }
    async function dbPut(rec){
      var db=await openDB();
      return new Promise(function(resolve,reject){
        var tx=db.transaction(DB_STORE,"readwrite");
        tx.objectStore(DB_STORE).put(rec);
        tx.oncomplete=function(){ resolve(); db.close(); };
        tx.onerror=function(){ reject(tx.error); db.close(); };
      });
    }
    async function dbGetAll(){
      var db=await openDB();
      return new Promise(function(resolve,reject){
        var tx=db.transaction(DB_STORE,"readonly");
        var req=tx.objectStore(DB_STORE).getAll();
        req.onsuccess=function(){ resolve(req.result||[]); db.close(); };
        req.onerror=function(){ reject(req.error); db.close(); };
      });
    }
    async function dbDel(id){
      var db=await openDB();
      return new Promise(function(resolve,reject){
        var tx=db.transaction(DB_STORE,"readwrite");
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete=function(){ resolve(); db.close(); };
        tx.onerror=function(){ reject(tx.error); db.close(); };
      });
    }

    /**********************
     * Pages / sections
     **********************/
    var PAGES=[
      {id:"full", name:"Full"},
      {id:"v1", name:"VERSE 1"},
      {id:"c1", name:"CHORUS 1"},
      {id:"v2", name:"VERSE 2"},
      {id:"c2", name:"CHORUS 2"},
      {id:"v3", name:"VERSE 3"},
      {id:"br", name:"BRIDGE"},
      {id:"c3", name:"CHORUS 3"}
    ];
    var SECTIONS=[
      {id:"v1", title:"VERSE 1"},
      {id:"c1", title:"CHORUS 1"},
      {id:"v2", title:"VERSE 2"},
      {id:"c2", title:"CHORUS 2"},
      {id:"v3", title:"VERSE 3"},
      {id:"br", title:"BRIDGE"},
      {id:"c3", title:"CHORUS 3"}
    ];
    var CARDS_PER_SECTION=20;

    function emptyCard(){ return { notesRaw:["","","","","","","",""], lyric:"" }; }
    function emptySection(title){
      var cards=[]; for(var i=0;i<CARDS_PER_SECTION;i++) cards.push(emptyCard());
      return { title:title, cards:cards };
    }
    function defaultProjectData(){
      var sections={};
      for(var i=0;i<SECTIONS.length;i++){
        sections[SECTIONS[i].id]=emptySection(SECTIONS[i].title);
      }
      return {
        meta:{ bpm:95, capo:0, autoSplit:false, instrument:"acoustic" },
        fullText:"",
        sections:sections,
        updatedAt:Date.now()
      };
    }
    function clampInt(v,a,b){
      v=Number(v);
      if(!isFinite(v)) v=a;
      v=Math.round(v);
      if(v<a) v=a;
      if(v>b) v=b;
      return v;
    }

    /**********************
     * State
     **********************/
    var state={
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

      projectNames:{},
      dataByProject:{},
      sortMode:"az",

      // rhyme
      activeLyricEl:null
    };

    function getProject(){
      if(!state.dataByProject[state.projectId]){
        state.dataByProject[state.projectId]=defaultProjectData();
      }
      return state.dataByProject[state.projectId];
    }
    function touchProject(){
      var p=getProject();
      p.updatedAt=Date.now();
      // recent list
      var list=[state.projectId];
      for(var i=0;i<state.recentProjects.length;i++){
        if(state.recentProjects[i]!==state.projectId) list.push(state.recentProjects[i]);
      }
      state.recentProjects=list.slice(0,12);
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
        sortMode:state.sortMode
      });
      lsSet("dataByProject", state.dataByProject);
      lsSet("recentProjects", state.recentProjects);
      lsSet("projectNames", state.projectNames);
    }
    function loadAll(){
      var saved=lsGet("state", null);
      var data=lsGet("dataByProject", null);
      var recent=lsGet("recentProjects", []);
      var names=lsGet("projectNames", {});
      if(data && typeof data==="object") state.dataByProject=data;
      if(saved && typeof saved==="object"){
        for(var k in saved) state[k]=saved[k];
      }
      state.recentProjects=Array.isArray(recent)?recent:[];
      state.projectNames=(names && typeof names==="object")?names:{};
      if(!state.dataByProject[state.projectId]){
        state.dataByProject[state.projectId]=defaultProjectData();
      }
      syncMetaFromProject();
    }
    function syncMetaFromProject(){
      var p=getProject(), m=p.meta||{};
      state.bpm=clampInt(m.bpm!=null?m.bpm:state.bpm,40,220);
      state.capo=clampInt(m.capo!=null?m.capo:state.capo,0,12);
      state.autoSplit=!!(m.autoSplit!=null?m.autoSplit:state.autoSplit);
      state.instrument=m.instrument||state.instrument;

      bpmInput.value=state.bpm;
      capoInput.value=state.capo;
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
      touchProject();
      saveAll();
    }

    /**********************
     * UI helpers
     **********************/
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

    /**********************
     * Syllables
     **********************/
    function roughSyllables(word){
      var w=String(word||"");
      if(w.length<=3) return [w];
      var vowels="aeiouyAEIOUY";
      var out=[], cur="", lastV=vowels.indexOf(w[0])!==-1;
      for(var i=0;i<w.length;i++){
        var ch=w[i], isV=vowels.indexOf(ch)!==-1;
        cur+=ch;
        if(lastV && !isV){
          if(i+1<w.length && vowels.indexOf(w[i+1])!==-1){
            out.push(cur.slice(0,-1));
            cur=ch;
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
      if(!units.length) return {slots:slots,count:count};
      var per=Math.ceil(units.length/4);
      for(var i=0;i<4;i++){
        slots[i]=units.slice(i*per,(i+1)*per).join(" ");
      }
      return {slots:slots,count:count};
    }
    function syllColor(count){
      if((count>=1 && count<=5) || count>=16) return "red";
      if((count>=6 && count<=9) || (count>=14 && count<=15)) return "yellow";
      if(count>=10 && count<=13) return "green";
      return "red";
    }

    /**********************
     * Notes transpose + key detect
     **********************/
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

    // Krumhansl-Schmuckler profiles
    var KK_MAJOR=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
    var KK_MINOR=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
    function rotate(arr,n){
      var out=new Array(arr.length);
      for(var i=0;i<arr.length;i++) out[(i+n)%arr.length]=arr[i];
      return out;
    }
    function dot(a,b){ var s=0; for(var i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
    function norm(a){ var s=0; for(var i=0;i<a.length;i++) s+=a[i]*a[i]; return Math.sqrt(s)||1; }
    function keyFromHistogram(hist){
      var best={score:-1e9, name:""};
      var hnorm=norm(hist);
      for(var t=0;t<12;t++){
        var maj=rotate(KK_MAJOR,t);
        var min=rotate(KK_MINOR,t);
        var majScore=dot(hist,maj)/(hnorm*norm(maj));
        var minScore=dot(hist,min)/(hnorm*norm(min));
        if(majScore>best.score) best={score:majScore,name:SHARP[t]+" major"};
        if(minScore>best.score) best={score:minScore,name:SHARP[t]+" minor"};
      }
      return best.name;
    }
    function computeKey(){
      var proj=getProject();
      var hist=new Array(12).fill(0);
      for(var sid in proj.sections){
        var sec=proj.sections[sid];
        for(var i=0;i<sec.cards.length;i++){
          var card=sec.cards[i];
          for(var n=0;n<8;n++){
            var shown=transposeToken(card.notesRaw[n]||"", state.capo);
            var root=chordRoot(shown);
            if(!root) continue;
            var idx=noteIndex(root);
            if(idx==null) continue;
            hist[idx]+=1;
          }
        }
      }
      var total=hist.reduce(function(a,b){return a+b;},0);
      if(total<3) return "—";
      return keyFromHistogram(hist)+" (auto)";
    }

    /**********************
     * Full parsing
     **********************/
    var HEADER_TO_ID = {
      "VERSE 1":"v1",
      "CHORUS 1":"c1",
      "VERSE 2":"v2",
      "CHORUS 2":"c2",
      "VERSE 3":"v3",
      "BRIDGE":"br",
      "CHORUS 3":"c3"
    };

    function parseNotesLine(line){
      var raw=line.replace(/^@\s*/,"").trim();
      if(!raw) return null;
      var parts=raw.split("|").map(function(s){ return s.trim(); });
      // ensure length
      var out=new Array(8).fill("");
      for(var i=0;i<8;i++){
        out[i]=(parts[i]||"").trim();
      }
      return out;
    }

    function applyFullTextToSections(fullText){
      var proj=getProject();
      proj.fullText = fullText;

      // reset cards
      for(var s=0;s<SECTIONS.length;s++){
        proj.sections[SECTIONS[s].id]=emptySection(SECTIONS[s].title);
      }

      var curId=null;
      var pendingNotes=null;
      var lineIdxBySection={};

      var lines=String(fullText||"").replace(/\r/g,"").split("\n");
      for(var i=0;i<lines.length;i++){
        var line=lines[i];
        var up=line.trim().toUpperCase();

        if(HEADER_TO_ID[up]){
          curId=HEADER_TO_ID[up];
          continue;
        }
        if(!curId) continue;

        if(line.trim().startsWith("@")){
          pendingNotes=parseNotesLine(line.trim());
          continue;
        }
        if(!line.trim()) continue; // spacer allowed

        if(lineIdxBySection[curId]==null) lineIdxBySection[curId]=0;
        var idx=lineIdxBySection[curId];
        if(idx>=CARDS_PER_SECTION) continue;

        var card=proj.sections[curId].cards[idx];
        card.lyric=line;

        if(pendingNotes){
          for(var n=0;n<8;n++){
            card.notesRaw[n]=transposeToken(pendingNotes[n]||"", -state.capo);
          }
          pendingNotes=null;
        }

        lineIdxBySection[curId]=idx+1;
      }

      touchProject();
      saveAll();
    }

    /**********************
     * Rendering
     **********************/
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

    function buildProjectSelect(){
      projectSelect.innerHTML="";
      var letters=[];
      for(var i=0;i<26;i++) letters.push(String.fromCharCode(65+i));

      if(state.sortMode==="recent"){
        var seen=new Set();
        var ordered=[];
        state.recentProjects.forEach(function(x){
          if(/^[A-Z]$/.test(x) && !seen.has(x)){ seen.add(x); ordered.push(x); }
        });
        letters.forEach(function(x){ if(!seen.has(x)) ordered.push(x); });
        letters=ordered;
      }

      letters.forEach(function(letter){
        var name=state.projectNames[letter] ? (" — "+state.projectNames[letter]) : "";
        var opt=document.createElement("option");
        opt.value=letter;
        opt.textContent="Project "+letter+name;
        projectSelect.appendChild(opt);
      });

      projectSelect.value=state.projectId;
      sortSelect.value=state.sortMode;
    }

    function render(){
      buildTabs();
      buildProjectSelect();
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

      if(state.pageId==="full"){
        hint.textContent='Paste like Beat Sheet Pro. Optional notes line starts with "@" above a lyric line.';
      }else{
        hint.textContent="";
      }
      header.appendChild(h2);
      header.appendChild(hint);
      editorRoot.appendChild(header);

      if(state.pageId==="full"){
        editorRoot.appendChild(renderFullEditor());
      }else{
        editorRoot.appendChild(renderSection(getProject(), state.pageId));
      }

      renderRecordings();
      setBoot("JS running ✓ (editor rendered)", true);
    }

    function renderFullEditor(){
      var proj=getProject();

      var wrap=document.createElement("div");
      wrap.className="fullBoxWrap";

      var ta=document.createElement("textarea");
      ta.className="fullBox";
      ta.placeholder =
`VERSE 1
@ Am | | C | D | G | |
I love you so much

CHORUS 1
@ F | | Am | | G | |
...`;

      ta.value = proj.fullText || "";

      var timer=null;
      ta.addEventListener("input", function(){
        if(timer) clearTimeout(timer);
        timer=setTimeout(function(){
          applyFullTextToSections(ta.value);
          keyOutput.value = computeKey();
          setStatus("Full updated → sections populated.");
          // refresh preview
          render();
        }, 250);
      });

      var help=document.createElement("div");
      help.className="fullHelp";
      help.textContent='Tip: "@ ..." line fills the 8 note boxes for the next lyric line. Blank lines are just spacers.';

      wrap.appendChild(ta);
      wrap.appendChild(help);

      // ✅ Preview that shows notes above lyrics like your mock
      var previewTitle=document.createElement("div");
      previewTitle.className="previewTitle";
      previewTitle.textContent="Full Sheet Preview (auto from your cards):";
      wrap.appendChild(previewTitle);

      // show all sections in order
      for(var s=0;s<SECTIONS.length;s++){
        var sid=SECTIONS[s].id;
        var sec=proj.sections[sid];

        var sh=document.createElement("div");
        sh.className="sectionHeader";
        sh.textContent=SECTIONS[s].title;
        wrap.appendChild(sh);

        // show only lines that exist, but keep spacing feel
        for(var i=0;i<sec.cards.length;i++){
          var c=sec.cards[i];
          if(!String(c.lyric||"").trim() && c.notesRaw.join("").trim()==="") continue;
          var cardEl=document.createElement("div");
          cardEl.className="card";
          cardEl.appendChild(renderPreviewLine(sid, i, c));
          wrap.appendChild(cardEl);
        }
      }

      return wrap;
    }

    function renderPreviewLine(sectionId, idx, card){
      var container=document.createElement("div");

      var notesRow=document.createElement("div");
      notesRow.className="notesRow";
      for(var i=0;i<8;i++){
        var inp=document.createElement("input");
        inp.className="noteCell";
        inp.value=transposeToken(card.notesRaw[i]||"", state.capo);
        inp.placeholder="Note";
        inp.dataset.section=sectionId;
        inp.dataset.idx=String(idx);
        inp.dataset.ni=String(i);
        inp.addEventListener("input", function(){
          var ni=Number(this.dataset.ni);
          card.notesRaw[ni]=transposeToken(this.value, -state.capo);
          touchProject(); saveAll();
          keyOutput.value=computeKey();
        });
        notesRow.appendChild(inp);
      }

      var lyric=document.createElement("textarea");
      lyric.className="lyrics";
      lyric.value=card.lyric||"";
      lyric.dataset.section=sectionId;
      lyric.dataset.idx=String(idx);
      lyric.addEventListener("focus", function(){ state.activeLyricEl=lyric; updateRhymeForActiveLine(); });
      lyric.addEventListener("input", function(){
        card.lyric=lyric.value;
        touchProject(); saveAll();
        updateRhymeForActiveLine();
      });

      container.appendChild(notesRow);
      container.appendChild(lyric);
      return container;
    }

    function renderSection(project, sectionId){
      var sec=project.sections[sectionId];
      var wrap=document.createElement("div");

      var sh=document.createElement("div");
      sh.className="sectionHeader";
      sh.textContent=sec ? sec.title : sectionId;
      wrap.appendChild(sh);

      var cards=document.createElement("div");
      cards.className="cards";

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
      num.textContent=String(idx+1);

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
          inp.dataset.section=sectionId;
          inp.dataset.idx=String(idx);
          inp.dataset.ni=String(i);
          inp.addEventListener("input", function(){
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
      ta.addEventListener("focus", function(){
        state.activeLyricEl=ta;
        updateRhymeForActiveLine();
      });

      var timingRow=document.createElement("div");
      timingRow.className="timingRow";
      for(var j=0;j<4;j++){
        var cell=document.createElement("div");
        cell.className="timingCell";
        cell.textContent = t.slots[j] || "";
        cell.dataset.section=sectionId;
        cell.dataset.idx=String(idx);
        cell.dataset.bi=String(j);
        timingRow.appendChild(cell);
      }

      ta.addEventListener("input", function(){
        card.lyric=ta.value;
        var t2=timingSlots4(card.lyric||"");
        pill.className="syllPill "+syllColor(t2.count);
        pill.textContent="Syllables: "+t2.count;
        var cells=timingRow.querySelectorAll(".timingCell");
        for(var k=0;k<4;k++) cells[k].textContent=t2.slots[k]||"";
        touchProject(); saveAll();
        updateRhymeForActiveLine();
      });

      lyricRow.appendChild(ta);

      cardEl.appendChild(top);
      cardEl.appendChild(notesRow);
      cardEl.appendChild(lyricRow);
      cardEl.appendChild(timingRow);

      return cardEl;
    }

    /**********************
     * Collapsible tray
     **********************/
    var panelHidden=false;
    togglePanelBtn.addEventListener("click", function(){
      panelHidden=!panelHidden;
      panelBody.classList.toggle("hidden", panelHidden);
      togglePanelBtn.textContent = panelHidden ? "Show" : "Hide";
    });

    /**********************
     * Controls events
     **********************/
    autoSplitBtn.addEventListener("click", function(){
      state.autoSplit=!state.autoSplit;
      setAutoSplitButton();
      syncMetaToProject();
      render();
    });

    bpmInput.addEventListener("change", function(){
      state.bpm=clampInt(bpmInput.value,40,220);
      bpmInput.value=state.bpm;
      syncMetaToProject();
      if(state.playing) restartDrums();
    });

    capoInput.addEventListener("change", function(){
      state.capo=clampInt(capoInput.value,0,12);
      capoInput.value=state.capo;
      syncMetaToProject();
      render();
    });

    instAcoustic.addEventListener("click", function(){ state.instrument="acoustic"; setInstrumentButtons(); syncMetaToProject(); });
    instElectric.addEventListener("click", function(){ state.instrument="electric"; setInstrumentButtons(); syncMetaToProject(); });
    instPiano.addEventListener("click", function(){ state.instrument="piano"; setInstrumentButtons(); syncMetaToProject(); });

    sortSelect.addEventListener("change", function(){
      state.sortMode=sortSelect.value;
      saveAll();
      buildProjectSelect();
    });

    projectSelect.addEventListener("change", function(){
      state.projectId=projectSelect.value;
      if(!state.dataByProject[state.projectId]) state.dataByProject[state.projectId]=defaultProjectData();
      syncMetaFromProject();
      touchProject();
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
      render();
    });

    clearProjectBtn.addEventListener("click", function(){
      if(!confirm("Clear ALL data in Project "+state.projectId+"?")) return;
      state.dataByProject[state.projectId]=defaultProjectData();
      syncMetaFromProject();
      touchProject();
      render();
      saveAll();
    });

    /**********************
     * Rhymes (better)
     **********************/
    function showRhymes(){
      rhymeDock.style.display="block";
      updateRhymeForActiveLine();
    }
    function hideRhymes(){
      rhymeDock.style.display="none";
    }
    rBtn.addEventListener("click", function(){
      if(rhymeDock.style.display==="block") hideRhymes();
      else showRhymes();
    });
    hideRhymeBtn.addEventListener("click", hideRhymes);

    function lastWord(str){
      var s=String(str||"").trim();
      if(!s) return "";
      s=s.replace(/[^\w'\- ]+/g," ").trim();
      var parts=s.split(/\s+/).filter(Boolean);
      return parts.length ? parts[parts.length-1] : "";
    }

    function buildWordBank(){
      var proj=getProject();
      var set=new Set();
      for(var sid in proj.sections){
        var sec=proj.sections[sid];
        for(var i=0;i<sec.cards.length;i++){
          var w=String(sec.cards[i].lyric||"")
            .toLowerCase()
            .replace(/[^\w'\- ]+/g," ")
            .split(/\s+/).filter(Boolean);
          w.forEach(function(x){
            if(x.length>=2) set.add(x);
          });
        }
      }
      return Array.from(set);
    }

    // small built-in rhyme helpers (expands “easy” cases like dear)
    var RHYME_SETS = {
      "dear": ["near","fear","clear","cheer","steer","year","sincere","here"],
      "life": ["wife","strife","knife","five"],
      "love": ["dove","glove","above"],
      "day": ["way","say","play","stay","gray","okay","away"],
      "mind": ["grind","shine","time","line","fine","mine","kind"]
    };

    function vowelTail(x){
      var m=String(x||"").toLowerCase().match(/[aeiouy]+[^aeiouy]*$/);
      return m?m[0]:"";
    }
    function tail(x,n){
      x=String(x||"").toLowerCase();
      return x.length>=n ? x.slice(-n) : x;
    }

    function scoreRhyme(base, cand){
      base=String(base||"").toLowerCase();
      cand=String(cand||"").toLowerCase();
      if(!base || !cand || base===cand) return -999;

      var s=0;
      // strongest: vowel tail match
      var vt=vowelTail(base);
      if(vt && vt===vowelTail(cand)) s+=6;

      // suffix matches
      if(tail(base,4)===tail(cand,4)) s+=5;
      if(tail(base,3)===tail(cand,3)) s+=4;
      if(tail(base,2)===tail(cand,2)) s+=3;

      // keep it from returning junk that only matches “r”
      if(tail(base,2)===tail(cand,2) && tail(base,2).length===2) s+=1;

      return s;
    }

    function insertWordAtCursor(textarea, word){
      var value=textarea.value;
      var start=textarea.selectionStart||value.length;
      var end=textarea.selectionEnd||value.length;
      var before=value.slice(0,start);
      var after=value.slice(end);

      var needsSpace = before.length && !/\s$/.test(before);
      var insert=(needsSpace?" ":"")+word;

      textarea.value = before + insert + after;
      var pos = (before + insert).length;
      textarea.selectionStart = textarea.selectionEnd = pos;
      textarea.focus();
    }

    function updateRhymeForActiveLine(){
      if(rhymeDock.style.display!=="block") return;
      if(!state.activeLyricEl) return;

      // find previous line in same section if possible
      var baseWord="";
      try{
        var secEl=state.activeLyricEl.closest(".card");
        if(secEl){
          // best effort: previous card's textarea
          var allLyrics=[].slice.call(document.querySelectorAll("textarea.lyrics"));
          var idx=allLyrics.indexOf(state.activeLyricEl);
          if(idx>0) baseWord=lastWord(allLyrics[idx-1].value||"");
        }
      }catch(e){}

      rhymeTitle.textContent = baseWord ? ('Rhymes for "'+baseWord+'"') : "Rhymes";
      rhymeWords.innerHTML="";

      if(!baseWord){
        var msg=document.createElement("div");
        msg.style.color="#666";
        msg.style.fontWeight="900";
        msg.style.fontSize="13px";
        msg.textContent="Tap into a line. Rhymes appear for the last word of the previous line.";
        rhymeWords.appendChild(msg);
        return;
      }

      var baseLower=baseWord.toLowerCase();
      var picks=[];

      if(RHYME_SETS[baseLower]){
        picks = picks.concat(RHYME_SETS[baseLower]);
      }

      var bank=buildWordBank();
      // add common candidates
      var extra=["near","fear","clear","cheer","steer","year","here","there","where","share","care","stare","air","hair","pair"];
      extra.forEach(function(w){ if(bank.indexOf(w)===-1) bank.push(w); });

      var scored=bank.map(function(w){ return {w:w, s:scoreRhyme(baseLower,w)}; })
        .filter(function(o){ return o.s>=6; })
        .sort(function(a,b){ return b.s-a.s; })
        .slice(0,18)
        .map(function(o){ return o.w; });

      scored.forEach(function(w){ if(picks.indexOf(w)===-1) picks.push(w); });
      picks=picks.slice(0,18);

      if(!picks.length){
        var none=document.createElement("div");
        none.style.color="#666";
        none.style.fontWeight="900";
        none.style.fontSize="13px";
        none.textContent="No good matches yet — add more words to your lyrics and try again.";
        rhymeWords.appendChild(none);
        return;
      }

      picks.forEach(function(w){
        var b=document.createElement("button");
        b.className="rWord";
        b.textContent=w;
        b.addEventListener("click", function(){
          insertWordAtCursor(state.activeLyricEl, w);
          state.activeLyricEl.dispatchEvent(new Event("input"));
        });
        rhymeWords.appendChild(b);
      });
    }

    /**********************
     * Drums + beat clock + sustain instruments
     **********************/
    var audioCtx=null;
    var drumTimer=null;

    // sustained voice
    var voice={
      osc:null,
      gain:null,
      filter:null,
      waveshaper:null,
      currentFreq:null
    };

    function ensureAudio(){
      if(audioCtx) return;
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    }

    function stopVoice(){
      try{
        if(voice.gain){
          var t=audioCtx.currentTime;
          voice.gain.gain.cancelScheduledValues(t);
          voice.gain.gain.setValueAtTime(voice.gain.gain.value || 0.0001, t);
          voice.gain.gain.exponentialRampToValueAtTime(0.0001, t+0.06);
        }
        if(voice.osc){
          voice.osc.stop(audioCtx.currentTime+0.07);
        }
      }catch(e){}
      voice.osc=null; voice.gain=null; voice.filter=null; voice.waveshaper=null; voice.currentFreq=null;
    }

    function startVoiceForInstrument(){
      stopVoice();

      var t=audioCtx.currentTime;

      var osc=audioCtx.createOscillator();
      var gain=audioCtx.createGain();
      var filter=audioCtx.createBiquadFilter();

      gain.gain.setValueAtTime(0.0001, t);

      if(state.instrument==="piano"){
        osc.type="triangle";
        filter.type="lowpass";
        filter.frequency.setValueAtTime(2200, t);
        gain.gain.exponentialRampToValueAtTime(0.55, t+0.01);
      }else if(state.instrument==="electric"){
        osc.type="sawtooth";
        filter.type="lowpass";
        filter.frequency.setValueAtTime(2600, t);
        gain.gain.exponentialRampToValueAtTime(0.40, t+0.01);

        // mild distortion
        var ws=audioCtx.createWaveShaper();
        var n=8192, curve=new Float32Array(n);
        for(var i=0;i<n;i++){
          var x=(i*2/n)-1;
          curve[i]=Math.tanh(2.0*x);
        }
        ws.curve=curve;

        osc.connect(ws).connect(filter).connect(gain).connect(audioCtx.destination);
        voice.waveshaper=ws;
        voice.osc=osc; voice.gain=gain; voice.filter=filter;
        osc.start(t);
        return;
      }else{
        // acoustic
        osc.type="triangle";
        filter.type="bandpass";
        filter.frequency.setValueAtTime(700, t);
        filter.Q.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.50, t+0.008);
      }

      osc.connect(filter).connect(gain).connect(audioCtx.destination);
      voice.osc=osc; voice.gain=gain; voice.filter=filter;
      osc.start(t);
    }

    function setVoiceFreq(freq){
      if(!voice.osc || !freq) return;

      var t=audioCtx.currentTime;
      voice.osc.frequency.cancelScheduledValues(t);
      // smooth glide
      voice.osc.frequency.setValueAtTime(voice.osc.frequency.value || freq, t);
      voice.osc.frequency.linearRampToValueAtTime(freq, t+0.03);

      // gentle “pluck/attack” at each change
      voice.gain.gain.cancelScheduledValues(t);
      var base = (state.instrument==="electric") ? 0.38 : (state.instrument==="piano") ? 0.52 : 0.48;
      voice.gain.gain.setValueAtTime(0.0001, t);
      voice.gain.gain.exponentialRampToValueAtTime(base, t+0.010);

      // sustain until next note, but piano decays
      if(state.instrument==="piano"){
        voice.gain.gain.exponentialRampToValueAtTime(0.12, t+0.35);
      }else{
        voice.gain.gain.exponentialRampToValueAtTime(base*0.85, t+0.35);
      }

      voice.currentFreq=freq;
    }

    function noiseBurst(t,dur,gain){
      var bufferSize=Math.floor(audioCtx.sampleRate*dur);
      var buffer=audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var data=buffer.getChannelData(0);
      for(var i=0;i<bufferSize;i++) data[i]=(Math.random()*2-1);
      var src=audioCtx.createBufferSource();
      src.buffer=buffer;

      var filt=audioCtx.createBiquadFilter();
      filt.type="highpass";
      filt.frequency.setValueAtTime(2500, t);

      var g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);

      src.connect(filt).connect(g).connect(audioCtx.destination);
      src.start(t);
      src.stop(t+dur+0.02);
    }

    function playKick(t,strength){
      var o=audioCtx.createOscillator();
      var g=audioCtx.createGain();
      o.type="sine";
      o.frequency.setValueAtTime(140,t);
      o.frequency.exponentialRampToValueAtTime(55,t+0.06);
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(strength,t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t+0.16);
    }

    function playSnare(t,strength){
      noiseBurst(t,0.10,strength);
      var o=audioCtx.createOscillator();
      var g=audioCtx.createGain();
      o.type="triangle";
      o.frequency.setValueAtTime(190,t);
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(strength*0.30,t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t+0.12);
    }

    function playHat(t,strength){
      noiseBurst(t,0.035,strength);
    }

    function getPattern(style){
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
      return {
        kick:[1,0,0,0, 0,1,0,0, 1,0,0,1, 0,0,1,0],
        snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        hat:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
      };
    }

    // note root -> freq
    var NOTE_TO_SEMI=(function(){
      var map={};
      for(var i=0;i<12;i++) map[SHARP[i]]=i;
      map["Db"]=1; map["Eb"]=3; map["Gb"]=6; map["Ab"]=8; map["Bb"]=10;
      return map;
    })();
    function noteToFreq(token){
      var s=String(token||"").trim();
      if(!s) return null;
      var root=chordRoot(s);
      if(!root) return null;
      var pc=NOTE_TO_SEMI[root];
      if(pc==null) return null;
      // lower octave for guitar-ish
      var octave=3;
      var midi=12*(octave+1)+pc; // C4=60
      return 440*Math.pow(2,(midi-69)/12);
    }

    function clearHighlights(){
      document.querySelectorAll(".noteCell.hl").forEach(function(el){ el.classList.remove("hl"); });
      document.querySelectorAll(".timingCell.hl").forEach(function(el){ el.classList.remove("hl"); });
    }

    // ✅ highlight the current beat on ALL cards so you can see it while scrolling
    function highlightAll(eighthIndex, beatIndex){
      clearHighlights();
      document.querySelectorAll('.noteCell[data-ni="'+String(eighthIndex)+'"]').forEach(function(el){
        el.classList.add("hl");
      });
      document.querySelectorAll('.timingCell[data-bi="'+String(beatIndex)+'"]').forEach(function(el){
        el.classList.add("hl");
      });
    }

    function stopDrums(){
      state.playing=false;
      state.tickIndex=0;
      if(drumTimer){ clearInterval(drumTimer); drumTimer=null; }
      clearHighlights();
      stopVoice();
      setStatus("Drums stopped.");
      setDrumButtons();
      saveAll();
    }

    function startDrums(style){
      ensureAudio();
      if(audioCtx.state==="suspended") audioCtx.resume();

      state.drumStyle=style;
      state.playing=true;
      state.tickIndex=0;
      setDrumButtons();
      saveAll();

      startVoiceForInstrument();

      var pat=getPattern(style);
      function stepMs(){ return (60/state.bpm)*1000/4; } // 16ths

      if(drumTimer) clearInterval(drumTimer);
      drumTimer=setInterval(function(){
        if(!state.playing) return;

        var now=audioCtx.currentTime;
        var step=state.tickIndex % 16;

        blinkHead();

        var kGain=(style==="hardrock")?0.9:(style==="rap")?1.0:0.75;
        var sGain=(style==="hardrock")?0.85:0.65;
        var hGain=(style==="hardrock")?0.35:(style==="rap")?0.28:0.22;

        if(pat.kick[step]) playKick(now,kGain);
        if(pat.snare[step]) playSnare(now,sGain);
        if(pat.hat[step]) playHat(now,hGain);

        var eighthIndex = Math.floor(step/2); // 0..7
        var beatIndex   = Math.floor(step/4); // 0..3

        highlightAll(eighthIndex, beatIndex);

        // sustain note changes on eighth boundaries
        if(step % 2 === 0){
          // choose the “first visible card” to drive sound:
          // we use the first note input in DOM for that eighthIndex as the "current note"
          var anyNoteEl=document.querySelector('.noteCell[data-ni="'+String(eighthIndex)+'"]');
          if(anyNoteEl){
            var token=String(anyNoteEl.value||"").trim();
            var f=noteToFreq(token);
            if(f) setVoiceFreq(f);
          }
        }

        state.tickIndex++;
      }, stepMs());

      setStatus("Playing: "+style.toUpperCase()+" (tap style again to stop)");
    }

    function restartDrums(){
      if(!state.playing || !state.drumStyle) return;
      stopDrums();
      startDrums(state.drumStyle);
    }

    function toggleDrum(style){
      if(state.playing && state.drumStyle===style){
        stopDrums();
        state.drumStyle=null;
        setDrumButtons();
        saveAll();
        return;
      }
      startDrums(style);
    }

    drumRock.addEventListener("click", function(){ toggleDrum("rock"); });
    drumHardRock.addEventListener("click", function(){ toggleDrum("hardrock"); });
    drumPop.addEventListener("click", function(){ toggleDrum("pop"); });
    drumRap.addEventListener("click", function(){ toggleDrum("rap"); });

    /**********************
     * Recording (single button toggles)
     **********************/
    var mediaRecorder=null;
    var chunks=[];
    var recording=false;

    async function startRecording(){
      try{
        var stream=await navigator.mediaDevices.getUserMedia({ audio:true });
        mediaRecorder=new MediaRecorder(stream);
        chunks=[];
        mediaRecorder.ondataavailable=function(e){
          if(e.data && e.data.size>0) chunks.push(e.data);
        };
        mediaRecorder.onstop=async function(){
          recording=false;
          recordBtn.textContent="Record";

          var blob=new Blob(chunks, { type:"audio/webm" });
          var id="rec_"+Date.now();
          await dbPut({ id:id, createdAt:Date.now(), mime:"audio/webm", blob:blob });

          stream.getTracks().forEach(function(t){ t.stop(); });

          renderRecordings();
          setStatus("Recording saved.");
        };

        mediaRecorder.start();
        recording=true;
        recordBtn.textContent="Stop";
        setStatus("Recording…");
      }catch(e){
        alert("Mic permission needed to record.");
      }
    }

    function stopRecording(){
      try{
        if(mediaRecorder && mediaRecorder.state!=="inactive"){
          mediaRecorder.stop();
        }
      }catch(e){}
    }

    recordBtn.addEventListener("click", function(){
      try{ ensureAudio(); if(audioCtx && audioCtx.state==="suspended") audioCtx.resume(); }catch(e){}
      if(!recording) startRecording();
      else stopRecording();
    });

    async function renderRecordings(){
      recordingsList.innerHTML="";
      var recs=await dbGetAll();
      recs.sort(function(a,b){ return b.createdAt-a.createdAt; });

      if(!recs.length){
        var none=document.createElement("div");
        none.style.color="#666";
        none.style.fontWeight="900";
        none.textContent="No recordings yet.";
        recordingsList.appendChild(none);
        return;
      }

      recs.forEach(function(r){
        var row=document.createElement("div");
        row.style.display="flex";
        row.style.gap="8px";
        row.style.alignItems="center";
        row.style.flexWrap="wrap";
        row.style.border="1px solid rgba(0,0,0,.10)";
        row.style.borderRadius="14px";
        row.style.padding="10px";
        row.style.background="#fff";

        var title=document.createElement("div");
        title.style.fontWeight="1100";
        title.style.fontSize="13px";
        var d=new Date(r.createdAt);
        title.textContent = d.toLocaleString();

        var play=document.createElement("button");
        play.className="btn secondary";
        play.textContent="▶";

        var stop=document.createElement("button");
        stop.className="btn secondary";
        stop.textContent="■";

        var audio=new Audio();
        audio.src=URL.createObjectURL(r.blob);

        play.addEventListener("click", function(){ audio.play(); });
        stop.addEventListener("click", function(){ audio.pause(); audio.currentTime=0; });

        var dl=document.createElement("button");
        dl.className="btn secondary";
        dl.textContent="⬇";
        dl.addEventListener("click", function(){
          var a=document.createElement("a");
          a.href=audio.src;
          a.download="songrider_recording_"+r.createdAt+".webm";
          document.body.appendChild(a);
          a.click();
          a.remove();
        });

        var del=document.createElement("button");
        del.className="btn secondary";
        del.textContent="🗑";
        del.addEventListener("click", async function(){
          if(!confirm("Delete this recording?")) return;
          await dbDel(r.id);
          renderRecordings();
        });

        row.appendChild(title);
        row.appendChild(play);
        row.appendChild(stop);
        row.appendChild(dl);
        row.appendChild(del);

        recordingsList.appendChild(row);
      });
    }

    /**********************
     * Init
     **********************/
    loadAll();
    touchProject();
    saveAll();

    render();
    setStatus("Ready.");
    setBoot("JS running ✓ (editor rendered)", true);

  }catch(err){
    console.error(err);
    setBoot("JS ERROR: "+(err && err.message ? err.message : String(err)), false);
  }
})();
