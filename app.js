/* Song Rider Pro - app.js (FULL REPLACE v12) */
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
    var miniBar=$("#miniBar");

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

    var autoPlayBtn=$("#autoPlayBtn");
    var recordBtn=$("#recordBtn");

    // mini bar mirrors
    var mRock=$("#mRock");
    var mHardRock=$("#mHardRock");
    var mPop=$("#mPop");
    var mRap=$("#mRap");
    var mScrollBtn=$("#mScrollBtn");
    var mRecordBtn=$("#mRecordBtn");

    var sortSelect=$("#sortSelect");
    var projectSelect=$("#projectSelect");
    var renameProjectBtn=$("#renameProjectBtn");

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
        headshotImg.src = "headshot.png?v=12";
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
     * Projects model
     **********************/
    function makeProjectId(){
      return "p_"+Date.now().toString(36)+"_"+Math.floor(Math.random()*1e6).toString(36);
    }
    function projectDisplayName(p){
      var n=(p && p.name) ? p.name.trim() : "";
      return n ? n : "Untitled";
    }

    /**********************
     * State
     **********************/
    var state={
      pageId:"full",
      projects:[],
      projectId:null,
      dataByProject:{},
      sortMode:"az",

      autoSplit:false,
      bpm:95,
      capo:0,
      instrument:"acoustic",

      drumStyle:null,
      playing:false,
      tickIndex:0,

      autoPlay:false,
      playQueue:[],
      playPos:0,

      fullPasteCollapsed:false,

      activeLyricEl:null
    };

    function getProjectMeta(){
      var p=state.projects.find(function(x){ return x.id===state.projectId; });
      return p || null;
    }
    function getProject(){
      if(!state.projectId){
        var id=makeProjectId();
        state.projects=[{id:id, name:"My Song", updatedAt:Date.now()}];
        state.projectId=id;
        state.dataByProject[id]=defaultProjectData();
      }
      if(!state.dataByProject[state.projectId]){
        state.dataByProject[state.projectId]=defaultProjectData();
      }
      return state.dataByProject[state.projectId];
    }
    function touchProject(){
      var meta=getProjectMeta();
      if(meta) meta.updatedAt=Date.now();
      var p=getProject();
      p.updatedAt=Date.now();
      saveAll();
    }

    /**********************
     * Save / load
     **********************/
    function saveAll(){
      lsSet("state_v12", {
        pageId:state.pageId,
        projectId:state.projectId,
        projects:state.projects,
        sortMode:state.sortMode,
        autoSplit:state.autoSplit,
        bpm:state.bpm,
        capo:state.capo,
        instrument:state.instrument,
        drumStyle:state.drumStyle,
        autoPlay:state.autoPlay,
        fullPasteCollapsed:state.fullPasteCollapsed
      });
      lsSet("dataByProject_v12", state.dataByProject);
    }
    function loadAll(){
      var saved=lsGet("state_v12", null);
      var data=lsGet("dataByProject_v12", null);

      // migrate forward from v11 if present
      if(!saved){
        var s11=lsGet("state_v11", null);
        var d11=lsGet("dataByProject_v11", null);
        if(s11) saved=s11;
        if(d11) data=d11;
      }

      if(data && typeof data==="object") state.dataByProject=data;
      if(saved && typeof saved==="object"){
        for(var k in saved) state[k]=saved[k];
      }

      if(!Array.isArray(state.projects)) state.projects=[];
      if(!state.projectId && state.projects.length) state.projectId=state.projects[0].id;

      getProject();
      syncMetaFromProject();
      setScrollBtn();
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
    }

    /**********************
     * UI helpers
     **********************/
    function setAutoSplitButton(){
      autoSplitBtn.classList.toggle("active", state.autoSplit);
      autoSplitBtn.textContent = state.autoSplit ? "AutoSplit: ON" : "AutoSplit: OFF";
    }
    function setScrollBtn(){
      // main
      autoPlayBtn.classList.toggle("on", state.autoPlay);
      autoPlayBtn.textContent="Scroll";
      // mini
      if(mScrollBtn){
        mScrollBtn.classList.toggle("on", state.autoPlay);
        mScrollBtn.textContent="Scroll";
      }
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

      if(mRock){
        mRock.classList.toggle("active", state.drumStyle==="rock");
        mHardRock.classList.toggle("active", state.drumStyle==="hardrock");
        mPop.classList.toggle("active", state.drumStyle==="pop");
        mRap.classList.toggle("active", state.drumStyle==="rap");
      }
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
      return keyFromHistogram(hist); // ✅ no "(auto)"
    }

    /**********************
     * Full parsing (apply only on button / blur to prevent keyboard collapse)
     **********************/
    var HEADER_TO_ID = {
      "VERSE 1":"v1","CHORUS 1":"c1","VERSE 2":"v2","CHORUS 2":"c2",
      "VERSE 3":"v3","BRIDGE":"br","CHORUS 3":"c3"
    };

    function parseNotesLine(line){
      var raw=line.replace(/^@\s*/,"").trim();
      if(!raw) return null;
      var parts=raw.split("|").map(function(s){ return s.trim(); });
      var out=new Array(8).fill("");
      for(var i=0;i<8;i++) out[i]=(parts[i]||"").trim();
      return out;
    }

    function applyFullTextToSections(fullText){
      var proj=getProject();
      proj.fullText = fullText;

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
        if(!line.trim()) continue;

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

    function sortedProjects(){
      var arr=state.projects.slice();
      if(state.sortMode==="recent"){
        arr.sort(function(a,b){ return (b.updatedAt||0)-(a.updatedAt||0); });
      }else{
        arr.sort(function(a,b){
          return projectDisplayName(a).toLowerCase().localeCompare(projectDisplayName(b).toLowerCase());
        });
      }
      return arr;
    }

    function buildProjectSelect(){
      projectSelect.innerHTML="";
      var arr=sortedProjects();
      arr.forEach(function(p){
        var opt=document.createElement("option");
        opt.value=p.id;
        opt.textContent=projectDisplayName(p);
        projectSelect.appendChild(opt);
      });

      var newOpt=document.createElement("option");
      newOpt.value="__new__";
      newOpt.textContent="+ New Project…";
      projectSelect.appendChild(newOpt);

      projectSelect.value=state.projectId;
      sortSelect.value=state.sortMode;
    }

    // ✅ preview container for full page (so we can update without re-rendering textarea)
    var fullPreviewMount=null;

    function render(){
      buildTabs();
      buildProjectSelect();
      setAutoSplitButton();
      setInstrumentButtons();
      setDrumButtons();
      setScrollBtn();

      keyOutput.value = computeKey();

      editorRoot.innerHTML="";
      fullPreviewMount=null;

      var header=document.createElement("div");
      header.className="sheetHeader";
      var h2=document.createElement("h2");
      var hint=document.createElement("div");
      hint.className="hint";

      var name="Full";
      for(var i=0;i<PAGES.length;i++) if(PAGES[i].id===state.pageId) name=PAGES[i].name;
      h2.textContent=name;
      hint.textContent = (state.pageId==="full") ? "" : "";

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

      // ✅ Paste area collapse + Apply button
      var topBar=document.createElement("div");
      topBar.style.display="flex";
      topBar.style.gap="8px";
      topBar.style.justifyContent="flex-end";
      topBar.style.marginBottom="8px";
      topBar.style.flexWrap="wrap";

      var collapseBtn=document.createElement("button");
      collapseBtn.className="btn secondary";
      collapseBtn.textContent = state.fullPasteCollapsed ? "Show Paste Area" : "Hide Paste Area";
      collapseBtn.addEventListener("click", function(){
        state.fullPasteCollapsed=!state.fullPasteCollapsed;
        saveAll();
        render();
      });

      var applyBtn=document.createElement("button");
      applyBtn.className="btn secondary";
      applyBtn.textContent="Apply to Sections";
      applyBtn.addEventListener("click", function(){
        applyFullTextToSections(proj.fullText||"");
        keyOutput.value=computeKey();
        updateFullPreviewOnly();
        setStatus("Applied → sections populated.");
      });

      topBar.appendChild(collapseBtn);
      topBar.appendChild(applyBtn);
      wrap.appendChild(topBar);

      if(!state.fullPasteCollapsed){
        var ta=document.createElement("textarea");
        ta.className="fullBox";
        ta.value = proj.fullText || "";
        ta.placeholder =
`VERSE 1
@ Am | | C | D | G | |
I love you so much

CHORUS 1
@ F | | Am | | G | |
...`;

        // ✅ IMPORTANT: DO NOT RERENDER WHILE TYPING (prevents keyboard collapsing)
        ta.addEventListener("input", function(){
          proj.fullText = ta.value;
          touchProject();
          setStatus("Typing… (tap Apply to populate sections)");
        });

        // optional: apply on blur
        ta.addEventListener("blur", function(){
          applyFullTextToSections(proj.fullText||"");
          keyOutput.value=computeKey();
          updateFullPreviewOnly();
          setStatus("Applied on blur.");
        });

        var help=document.createElement("div");
        help.className="fullHelp";
        help.textContent='Tip: "@ ..." line fills the 8 note boxes for the next lyric line.';

        wrap.appendChild(ta);
        wrap.appendChild(help);
      }

      var previewTitle=document.createElement("div");
      previewTitle.className="previewTitle";
      previewTitle.textContent="Full Sheet Preview (auto from your cards):";
      wrap.appendChild(previewTitle);

      fullPreviewMount=document.createElement("div");
      wrap.appendChild(fullPreviewMount);

      updateFullPreviewOnly();

      return wrap;
    }

    function updateFullPreviewOnly(){
      if(!fullPreviewMount) return;
      var proj=getProject();
      fullPreviewMount.innerHTML="";

      for(var s=0;s<SECTIONS.length;s++){
        var sid=SECTIONS[s].id;
        var sec=proj.sections[sid];

        var sh=document.createElement("div");
        sh.className="sectionHeader";
        sh.textContent=SECTIONS[s].title;
        fullPreviewMount.appendChild(sh);

        for(var i=0;i<sec.cards.length;i++){
          var c=sec.cards[i];
          if(!String(c.lyric||"").trim() && c.notesRaw.join("").trim()==="") continue;
          var cardEl=document.createElement("div");
          cardEl.className="card";
          cardEl.dataset.section=sid;
          cardEl.dataset.idx=String(i);
          cardEl.appendChild(renderPreviewLine(sid, i, c));
          fullPreviewMount.appendChild(cardEl);
        }
      }
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
          touchProject();
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
        touchProject();
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
      cardEl.dataset.section=sectionId;
      cardEl.dataset.idx=String(idx);

      var t=timingSlots4(card.lyric||"");

      var top=document.createElement("div");
      top.className="cardTop";

      var num=document.createElement("div");
      num.className="cardNum";
      num.textContent=String(idx+1);

      var pill=document.createElement("div");
      pill.className="syllPill";
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
            touchProject();
            keyOutput.value = computeKey();
          });
          notesRow.appendChild(inp);
        })(i);
      }

      var ta=document.createElement("textarea");
      ta.className="lyrics";
      ta.value=card.lyric||"";
      ta.placeholder = state.autoSplit ? "Type lyrics (AutoSplit on)…" : "Type lyrics and split with “/”…";
      ta.dataset.section=sectionId;
      ta.dataset.idx=String(idx);

      ta.addEventListener("focus", function(){
        state.activeLyricEl=ta;
        updateRhymeForActiveLine();
      });

      var timingRow=document.createElement("div");
      timingRow.className="timingRow";
      for(var j=0;j<4;j++){
        var cell=document.createElement("div");
        cell.className="timingCell"+((j===1||j===3)?" backbeat":"");
        cell.textContent = t.slots[j] || "";
        cell.dataset.section=sectionId;
        cell.dataset.idx=String(idx);
        cell.dataset.bi=String(j);
        timingRow.appendChild(cell);
      }

      ta.addEventListener("input", function(){
        card.lyric=ta.value;
        var t2=timingSlots4(card.lyric||"");
        pill.textContent="Syllables: "+t2.count;
        var cells=timingRow.querySelectorAll(".timingCell");
        for(var k=0;k<4;k++) cells[k].textContent=t2.slots[k]||"";
        touchProject();
        updateRhymeForActiveLine();
      });

      cardEl.appendChild(top);
      cardEl.appendChild(notesRow);
      cardEl.appendChild(ta);
      cardEl.appendChild(timingRow);

      return cardEl;
    }

    /**********************
     * Panel hide/show behavior (tabs hidden, miniBar shown)
     **********************/
    var panelHidden=false;
    function applyPanelMode(){
      panelBody.classList.toggle("hidden", panelHidden);
      tabsEl.classList.toggle("hidden", panelHidden);
      miniBar.classList.toggle("show", panelHidden);
      togglePanelBtn.textContent = panelHidden ? "Show" : "Hide";
    }
    togglePanelBtn.addEventListener("click", function(){
      panelHidden=!panelHidden;
      applyPanelMode();
    });

    /**********************
     * Controls events
     **********************/
    autoSplitBtn.addEventListener("click", function(){
      state.autoSplit=!state.autoSplit;
      setAutoSplitButton();
      syncMetaToProject();
      render();
      saveAll();
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

    function toggleScroll(){
      state.autoPlay=!state.autoPlay;
      setScrollBtn();
      buildPlayQueue();
      saveAll();
      setStatus(state.autoPlay ? "Scroll ON (plays line-by-line)." : "Scroll OFF.");
    }
    autoPlayBtn.addEventListener("click", toggleScroll);
    if(mScrollBtn) mScrollBtn.addEventListener("click", toggleScroll);

    sortSelect.addEventListener("change", function(){
      state.sortMode=sortSelect.value;
      saveAll();
      buildProjectSelect();
    });

    projectSelect.addEventListener("change", function(){
      if(projectSelect.value==="__new__"){
        var name=prompt("New project name:", "New Song");
        if(name===null) { projectSelect.value=state.projectId; return; }
        var clean=name.trim() || "New Song";
        var id=makeProjectId();
        state.projects.push({id:id, name:clean, updatedAt:Date.now()});
        state.projectId=id;
        state.dataByProject[id]=defaultProjectData();
        syncMetaFromProject();
        touchProject();
        render();
        saveAll();
        return;
      }

      state.projectId=projectSelect.value;
      getProject();
      syncMetaFromProject();
      touchProject();
      render();
      saveAll();
    });

    renameProjectBtn.addEventListener("click", function(){
      var meta=getProjectMeta();
      if(!meta) return;
      var cur=meta.name || "";
      var name=prompt("Rename project:", cur);
      if(name===null) return;
      meta.name=(name.trim()||"Untitled").slice(0,50);
      meta.updatedAt=Date.now();
      saveAll();
      buildProjectSelect();
    });

    /**********************
     * Rhymes (same as v11)
     **********************/
    function showRhymes(){
      rhymeDock.style.display="block";
      updateRhymeForActiveLine();
    }
    function hideRhymes(){ rhymeDock.style.display="none"; }
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

    var RHYME_SETS = {
      "wife": ["life","strife","knife","five"],
      "dear": ["near","fear","clear","cheer","steer","year","sincere","here"],
      "love": ["dove","glove","above"]
    };

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
          w.forEach(function(x){ if(x.length>=2) set.add(x); });
        }
      }
      return Array.from(set);
    }

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
      var vt=vowelTail(base);
      if(vt && vt===vowelTail(cand)) s+=6;
      if(tail(base,4)===tail(cand,4)) s+=5;
      if(tail(base,3)===tail(cand,3)) s+=4;
      if(tail(base,2)===tail(cand,2)) s+=3;
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

    function previousLineWordFromSameSection(el){
      if(!el) return "";
      var sec=el.dataset.section;
      var idx=Number(el.dataset.idx);
      if(!sec || !isFinite(idx)) return "";
      var prevIdx=idx-1;
      if(prevIdx<0) return "";
      var proj=getProject();
      var card=proj.sections[sec] && proj.sections[sec].cards[prevIdx];
      if(!card) return "";
      return lastWord(card.lyric||"");
    }

    function updateRhymeForActiveLine(){
      if(rhymeDock.style.display!=="block") return;
      if(!state.activeLyricEl) return;

      var baseWord = previousLineWordFromSameSection(state.activeLyricEl);
      rhymeTitle.textContent = baseWord ? ('Rhymes for "'+baseWord+'"') : "Rhymes";
      rhymeWords.innerHTML="";

      if(!baseWord){
        var msg=document.createElement("div");
        msg.style.color="#666";
        msg.style.fontWeight="900";
        msg.style.fontSize="13px";
        msg.textContent="Tap a lyric line. Rhymes come from the LAST WORD of the PREVIOUS line (same section).";
        rhymeWords.appendChild(msg);
        return;
      }

      var baseLower=baseWord.toLowerCase();
      var picks=[];

      if(RHYME_SETS[baseLower]) picks = picks.concat(RHYME_SETS[baseLower]);

      var bank=buildWordBank();
      var scored=bank.map(function(w){ return {w:w, s:scoreRhyme(baseLower,w)}; })
        .filter(function(o){ return o.s>=6; })
        .sort(function(a,b){ return b.s-a.s; })
        .slice(0,18)
        .map(function(o){ return o.w; });

      scored.forEach(function(w){ if(picks.indexOf(w)===-1) picks.push(w); });
      picks=picks.slice(0,14);

      if(!picks.length){
        var none=document.createElement("div");
        none.style.color="#666";
        none.style.fontWeight="900";
        none.style.fontSize="13px";
        none.textContent="No good matches yet — add more lyrics and try again.";
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
     * PLAY QUEUE (line-by-line)
     **********************/
    function buildPlayQueue(){
      var proj=getProject();
      var q=[];
      for(var s=0;s<SECTIONS.length;s++){
        var sid=SECTIONS[s].id;
        var sec=proj.sections[sid];
        for(var i=0;i<sec.cards.length;i++){
          var c=sec.cards[i];
          if(String(c.lyric||"").trim() || c.notesRaw.join("").trim()){
            q.push({sectionId:sid, idx:i});
          }
        }
      }
      state.playQueue=q;
      state.playPos=0;
    }

    function markActiveLine(sectionId, idx){
      document.querySelectorAll(".card.activeLine").forEach(function(el){
        el.classList.remove("activeLine");
      });
      var el=document.querySelector('.card[data-section="'+sectionId+'"][data-idx="'+String(idx)+'"]');
      if(el){
        el.classList.add("activeLine");
        if(state.autoPlay){
          try{ el.scrollIntoView({behavior:"smooth", block:"center"}); }catch(e){}
        }
      }
    }

    /**********************
     * DRUMS + AUDIO (✅ sustain until next note)
     **********************/
    var audioCtx=null;
    var drumTimer=null;

    function ensureAudio(){
      if(audioCtx) return;
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    }

    function noiseBuffer(seconds){
      var len=Math.floor(audioCtx.sampleRate*seconds);
      var buf=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
      var d=buf.getChannelData(0);
      for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
      return buf;
    }

    function playKick(t,strength){
      var o=audioCtx.createOscillator();
      var g=audioCtx.createGain();
      o.type="sine";
      o.frequency.setValueAtTime(150,t);
      o.frequency.exponentialRampToValueAtTime(55,t+0.08);
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(strength,t+0.003);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t+0.20);
    }

    function playSnare(t,strength){
      var src=audioCtx.createBufferSource();
      src.buffer=noiseBuffer(0.12);
      var hp=audioCtx.createBiquadFilter();
      hp.type="highpass"; hp.frequency.setValueAtTime(2500,t);
      var g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(strength,t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
      src.connect(hp).connect(g).connect(audioCtx.destination);
      src.start(t); src.stop(t+0.14);
    }

    function playHat(t,strength){
      var src=audioCtx.createBufferSource();
      src.buffer=noiseBuffer(0.05);
      var bp=audioCtx.createBiquadFilter();
      bp.type="bandpass"; bp.frequency.setValueAtTime(8000,t); bp.Q.setValueAtTime(2.5,t);
      var g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(strength,t+0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
      src.connect(bp).connect(g).connect(audioCtx.destination);
      src.start(t); src.stop(t+0.05);
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
          kick:[1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
          snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
          hat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        };
      }
      return {
        kick:[1,0,0,0, 0,1,0,0, 1,0,0,1, 0,0,1,0],
        snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        hat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
      };
    }

    // Note -> freq (root only)
    var NOTE_TO_SEMI=(function(){
      var map={};
      var SH=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
      for(var i=0;i<12;i++) map[SH[i]]=i;
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
      var octave=3;
      var midi=12*(octave+1)+pc;
      return 440*Math.pow(2,(midi-69)/12);
    }

    // highlights
    function clearHighlights(){
      document.querySelectorAll(".noteCell.hl").forEach(function(el){ el.classList.remove("hl"); });
      document.querySelectorAll(".timingCell.hl").forEach(function(el){ el.classList.remove("hl"); });
    }
    function highlightActiveLine(sectionId, idx, eighthIndex, beatIndex){
      clearHighlights();
      document.querySelectorAll('.noteCell[data-section="'+sectionId+'"][data-idx="'+String(idx)+'"][data-ni="'+String(eighthIndex)+'"]')
        .forEach(function(el){ el.classList.add("hl"); });
      document.querySelectorAll('.timingCell[data-section="'+sectionId+'"][data-idx="'+String(idx)+'"][data-bi="'+String(beatIndex)+'"]')
        .forEach(function(el){ el.classList.add("hl"); });
    }

    /**********************
     * Instruments (same as v11)
     **********************/
    function pluckString(freq, t, duration, brightness){
      var sr=audioCtx.sampleRate;
      var period=Math.max(2, Math.floor(sr / Math.max(40, freq)));
      var buf=audioCtx.createBuffer(1, period, sr);
      var d=buf.getChannelData(0);
      for(var i=0;i<period;i++) d[i]=(Math.random()*2-1);

      var src=audioCtx.createBufferSource();
      src.buffer=buf; src.loop=true;

      var delay=audioCtx.createDelay();
      delay.delayTime.setValueAtTime(period/sr, t);

      var fb=audioCtx.createGain();
      fb.gain.setValueAtTime(0.995, t);

      var lp=audioCtx.createBiquadFilter();
      lp.type="lowpass";
      lp.frequency.setValueAtTime(1200 + (brightness||0)*2000, t);

      var out=audioCtx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.6, t+0.01);
      out.gain.exponentialRampToValueAtTime(0.0001, t+duration);

      src.connect(delay);
      delay.connect(lp).connect(out).connect(audioCtx.destination);
      delay.connect(fb).connect(delay);

      src.start(t);
      src.stop(t+duration+0.02);
    }

    function playElectric(freq, t, duration){
      var o=audioCtx.createOscillator();
      var g=audioCtx.createGain();
      var lp=audioCtx.createBiquadFilter();
      var ws=audioCtx.createWaveShaper();

      o.type="sawtooth";
      o.frequency.setValueAtTime(freq, t);

      var n=2048, curve=new Float32Array(n);
      for(var i=0;i<n;i++){
        var x=(i*2/n)-1;
        curve[i]=Math.tanh(2.8*x);
      }
      ws.curve=curve;

      lp.type="lowpass";
      lp.frequency.setValueAtTime(2200, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t+0.01);
      g.gain.exponentialRampToValueAtTime(0.20, t+0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t+duration);

      o.connect(ws).connect(lp).connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t+duration+0.05);
    }

    function playPiano(freq, t, duration){
      var src=audioCtx.createBufferSource();
      src.buffer=noiseBuffer(0.03);
      var hp=audioCtx.createBiquadFilter();
      hp.type="highpass"; hp.frequency.setValueAtTime(1500, t);

      var o1=audioCtx.createOscillator();
      var o2=audioCtx.createOscillator();
      o1.type="triangle"; o2.type="sine";
      o1.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq*2, t);

      var g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t+0.006);
      g.gain.exponentialRampToValueAtTime(0.15, t+0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t+duration);

      var lp=audioCtx.createBiquadFilter();
      lp.type="lowpass"; lp.frequency.setValueAtTime(2800, t);

      src.connect(hp).connect(lp);
      o1.connect(lp); o2.connect(lp);
      lp.connect(g).connect(audioCtx.destination);

      src.start(t); src.stop(t+0.04);
      o1.start(t); o2.start(t);
      o1.stop(t+duration+0.05); o2.stop(t+duration+0.05);
    }

    function playInstrument(freq, t, duration){
      if(state.instrument==="acoustic"){
        pluckString(freq, t, duration, 0.6);
      }else if(state.instrument==="electric"){
        playElectric(freq, t, duration);
      }else{
        playPiano(freq, t, duration);
      }
    }

    /**********************
     * Drums engine + sustained note driver
     **********************/
    function stopDrums(){
      state.playing=false;
      state.tickIndex=0;
      if(drumTimer){ clearInterval(drumTimer); drumTimer=null; }
      clearHighlights();
      document.querySelectorAll(".card.activeLine").forEach(function(el){ el.classList.remove("activeLine"); });
      setStatus("Drums stopped.");
      setDrumButtons();
      saveAll();
    }

    function stepMs(){ return (60/state.bpm)*1000/4; } // 16ths
    function stepSec(){ return (60/state.bpm)/4; }      // 16ths seconds

    function currentLineRef(){
      if(state.autoPlay && state.playQueue.length){
        return state.playQueue[state.playPos] || state.playQueue[0];
      }
      if(state.pageId!=="full"){
        return {sectionId:state.pageId, idx:0};
      }
      if(state.playQueue.length) return state.playQueue[0];
      return {sectionId:"v1", idx:0};
    }

    function advanceLine(){
      if(!state.autoPlay || !state.playQueue.length) return;
      state.playPos++;
      if(state.playPos>=state.playQueue.length) state.playPos=0;
    }

    // ✅ duration until next non-empty note (in eighths)
    function durationUntilNextNote(ref, startEighth){
      // check next eighth slots in same line
      for(var e=startEighth+1; e<8; e++){
        var el=document.querySelector('.noteCell[data-section="'+ref.sectionId+'"][data-idx="'+String(ref.idx)+'"][data-ni="'+String(e)+'"]');
        if(el && String(el.value||"").trim()) return (e - startEighth);
      }
      // none found → hold to end of bar
      return (8 - startEighth);
    }

    function startDrums(style){
      ensureAudio();
      if(audioCtx.state==="suspended") audioCtx.resume();

      state.drumStyle=style;
      state.playing=true;
      state.tickIndex=0;

      buildPlayQueue();

      setDrumButtons();
      saveAll();

      var pat=getPattern(style);

      if(drumTimer) clearInterval(drumTimer);
      drumTimer=setInterval(function(){
        if(!state.playing) return;

        var now=audioCtx.currentTime;
        var step=state.tickIndex % 16;

        if(step===0){
          if(state.tickIndex>0) advanceLine();
          var ref0=currentLineRef();
          markActiveLine(ref0.sectionId, ref0.idx);
        }

        blinkHead();

        var kGain=(style==="hardrock")?0.95:(style==="rap")?1.05:0.75;
        var sGain=(style==="hardrock")?0.90:0.65;
        var hGain=(style==="hardrock")?0.38:(style==="rap")?0.30:0.22;

        if(pat.kick[step]) playKick(now,kGain);
        if(pat.snare[step]) playSnare(now,sGain);
        if(pat.hat[step]) playHat(now,hGain);

        var eighthIndex = Math.floor(step/2); // 0..7
        var beatIndex   = Math.floor(step/4); // 0..3

        var ref=currentLineRef();
        highlightActiveLine(ref.sectionId, ref.idx, eighthIndex, beatIndex);

        // ✅ play note ONLY when this cell is non-empty; duration extends until next note
        if(step % 2 === 0){
          var noteEl=document.querySelector('.noteCell[data-section="'+ref.sectionId+'"][data-idx="'+String(ref.idx)+'"][data-ni="'+String(eighthIndex)+'"]');
          if(noteEl){
            var token=String(noteEl.value||"").trim();
            if(token){
              var f=noteToFreq(token);
              if(f){
                var eighths=durationUntilNextNote(ref, eighthIndex);
                var dur = Math.max(0.18, (stepSec()*2) * eighths * 0.98); // eighth = 2 steps
                playInstrument(f, now, dur);
              }
            }
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

    if(mRock){
      mRock.addEventListener("click", function(){ toggleDrum("rock"); });
      mHardRock.addEventListener("click", function(){ toggleDrum("hardrock"); });
      mPop.addEventListener("click", function(){ toggleDrum("pop"); });
      mRap.addEventListener("click", function(){ toggleDrum("rap"); });
    }

    /**********************
     * Recording (mirrored button)
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
          if(mRecordBtn) mRecordBtn.textContent="Record";

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
        if(mRecordBtn) mRecordBtn.textContent="Stop";
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

    function toggleRecord(){
      try{ ensureAudio(); if(audioCtx && audioCtx.state==="suspended") audioCtx.resume(); }catch(e){}
      if(!recording) startRecording();
      else stopRecording();
    }
    recordBtn.addEventListener("click", toggleRecord);
    if(mRecordBtn) mRecordBtn.addEventListener("click", toggleRecord);

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
    buildPlayQueue();
    render();
    applyPanelMode = applyPanelMode || function(){};
    applyPanelMode();
    setStatus("Ready.");
    setBoot("JS running ✓ (editor rendered)", true);

  }catch(err){
    console.error(err);
    setBoot("JS ERROR: "+(err && err.message ? err.message : String(err)), false);
  }
})();
