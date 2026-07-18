const STORAGE_KEY = "LifeSimSave";
const NEED_NAMES = ["Energy","Hunger","Hygiene","Fun","Social","Environment","Focus"];
const XP_BY_DIFFICULTY = {easy:10,medium:25,hard:50};
const LEVEL_UNLOCKS = [
  [1,"Player record, quests, skills and rituals"],
  [2,"Quest XP bonus: +10%"],
  [3,"Unlock a new profile badge"],
  [4,"Coin shop discount: 10%"],
  [5,"Custom player title"],
  [6,"Quest XP bonus increases to +20%"],
  [8,"Unlock advanced reward themes"],
  [10,"Coin shop discount increases to 20%"],
  [12,"Legendary profile frame"]
];

const defaultState = {
  schemaVersion:1,
  level:1,
  xp:0,
  coins:0,
  mood:"Fine",
  lastNeedsCheck:"",
  registrationComplete:false,
  needsAssessmentComplete:false,
  customTitle:"",
  needs:{Energy:0,Hunger:0,Hygiene:0,Fun:0,Social:0,Environment:0,Focus:0},
  profile:{name:"",height:"",weight:"",org:"",path:"",traits:[],bio:""},
  skills:{},
  arcs:[],
  arcTypes:[],
  motivations:[],
  categories:[],
  quests:[],
  rituals:[],
  rewards:[],
  achievements:[],
  log:[],
  dailyFocus:"",
  dailyFun:""
};

let state = loadState();
let currentView = "today";
let questFilter = "all";
let currentArcStatus = "ongoing";
let selectedArcId = null;

function clone(x){return JSON.parse(JSON.stringify(x));}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return clone(defaultState);
    const saved=JSON.parse(raw);
    return normalize(saved&&typeof saved==="object"?saved:{});
  }catch(error){
    console.error("Could not load LifeSim save",error);
    return clone(defaultState);
  }
}
function normalize(input){
  const s=(input&&typeof input==="object")?input:{};

  s.schemaVersion=1;
  s.level=Math.max(1,Number(s.level)||1);
  s.xp=Math.max(0,Number(s.xp)||0);
  s.coins=Math.max(0,Number(s.coins)||0);
  s.mood=String(s.mood||"Fine");
  s.lastNeedsCheck=String(s.lastNeedsCheck||"");
  s.registrationComplete=Boolean(s.registrationComplete);
  s.needsAssessmentComplete=Boolean(s.needsAssessmentComplete||s.lastNeedsCheck);
  s.customTitle=String(s.customTitle||"");
  s.dailyFocus=String(s.dailyFocus||"");
  s.dailyFun=String(s.dailyFun||"");

  s.profile={...defaultState.profile,...((s.profile&&typeof s.profile==="object")?s.profile:{})};
  s.profile.traits=Array.isArray(s.profile.traits)?s.profile.traits:[];

  const incomingNeeds=(s.needs&&typeof s.needs==="object")?s.needs:{};
  s.needs={};
  NEED_NAMES.forEach(name=>{
    const value=Number(incomingNeeds[name]);
    s.needs[name]=Number.isFinite(value)?Math.max(0,Math.min(5,value)):0;
  });

  s.skills=(s.skills&&typeof s.skills==="object"&&!Array.isArray(s.skills))?s.skills:{};
  s.arcs=Array.isArray(s.arcs)?s.arcs:[];
  s.arcTypes=Array.isArray(s.arcTypes)?s.arcTypes:[];
  s.motivations=Array.isArray(s.motivations)?s.motivations:[];
  s.categories=Array.isArray(s.categories)?s.categories:[];
  s.quests=Array.isArray(s.quests)?s.quests:[];
  s.rituals=Array.isArray(s.rituals)?s.rituals:[];
  s.rewards=Array.isArray(s.rewards)?s.rewards:[];
  s.achievements=Array.isArray(s.achievements)?s.achievements:[];
  s.log=Array.isArray(s.log)?s.log:[];

  return s;
}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render();}
function addLog(text){state.log.unshift({text,time:new Date().toLocaleString()});state.log=state.log.slice(0,40);}
function toast(text){const t=document.getElementById("toast");t.textContent=text;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800);}
function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function xpNeededForLevel(level){
  return Math.round(55 + Math.pow(Math.max(0,level-1),1.45)*38);
}
function questXpMultiplier(){
  if(state.level>=6)return 1.20;
  if(state.level>=2)return 1.10;
  return 1;
}
function shopDiscount(){
  if(state.level>=10)return 0.20;
  if(state.level>=4)return 0.10;
  return 0;
}
function activeArcLimit(){ return Infinity; }
function levelReward(level){
  const coinReward=20+level*5;
  state.coins+=coinReward;
  if(level===5&&!state.customTitle)state.customTitle="Rising Player";
  return coinReward;
}
function addXP(amount){
  const gained=Math.max(1,Math.round(amount));
  state.xp+=gained;
  while(state.xp>=xpNeededForLevel(state.level)){
    state.xp-=xpNeededForLevel(state.level);
    state.level++;
    const reward=levelReward(state.level);
    addLog(`Reached level ${state.level}.`);
    toast(`Level ${state.level}! +${reward} coins and a new perk`);
  }
}
function skillLevel(xp){return Math.floor(xp/100);}
function gainSkill(name,amount){if(!name)return;if(!state.skills[name])state.skills[name]={xp:0,description:"",tasks:[]};state.skills[name].xp+=amount;}
function uniquePush(arr,v){if(v&&!arr.includes(v))arr.push(v);}
function todayISO(){return new Date().toISOString().slice(0,10);}
function arcById(id){return state.arcs.find(a=>a.id===Number(id));}

function render(){
  const safeRender=(name,fn)=>{
    try{
      fn();
    }catch(error){
      console.error(`Render failed: ${name}`,error);
    }
  };

  document.getElementById("level").textContent=state.level??1;
  document.getElementById("xp").textContent=state.xp??0;
  document.getElementById("xpNext").textContent=xpNeededForLevel(state.level??1);
  document.getElementById("coins").textContent=state.coins??0;
  document.getElementById("todayDate").textContent=new Date().toLocaleDateString("en-AU",{
    weekday:"long",
    day:"numeric",
    month:"long"
  });

  safeRender("profile",renderProfile);
  safeRender("today",renderToday);
  safeRender("arcs",renderArcs);
  safeRender("quests",renderQuests);
  safeRender("rituals",renderRituals);
  safeRender("skills",renderSkills);
  safeRender("rewards",renderRewards);
  safeRender("lore",renderLore);
  safeRender("selects",populateSelects);
}
function switchView(view,options={}){
  currentView=view;document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.getElementById(`view-${view}`).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const titles={today:"Today",sim:"My Sim",arcs:"Arcs",quests:"Quests",rituals:"Rituals",skills:"Skills",rewards:"Rewards",lore:"Life Lore","arc-detail":"Arc Detail"}
const subtitles={today:"Daily overview",sim:"Registration Record",arcs:"Life Hub Goal Planner",quests:"Today's missions",rituals:"Daily systems",skills:"Level your abilities",rewards:"Spend your coins",lore:"Achievements & history","arc-detail":"Arc information"};
  document.getElementById("pageTitle").textContent=titles[view];document.getElementById("pageSubtitle").textContent=subtitles[view]||"";window.scrollTo({top:0,behavior:"smooth"});
  if(view==="sim"&&options.requireRating)openNeedsDialog();
}

function renderToday(){
  const values=Object.values(state.needs);const avg=values.reduce((a,b)=>a+b,0)/values.length;const low=Object.entries(state.needs).sort((a,b)=>a[1]-b[1])[0];
  let title="🙂 Decently Functional",text="Your systems are stable enough. Pick one useful thing and one enjoyable thing.";
  if(avg>=4.3){title="✨ Main Character Energy";text="Most needs are strong. Use the momentum on something meaningful.";}
  if(low[1]===1){title="🚨 One Need Is Cooked";text=`${low[0]} is critically low. Deal with that before forcing productivity.`;}
  else if(state.mood==="Focused"){title="🎯 Locked In";text="Protect the focus and do the hardest useful task first.";}
  else if(state.mood==="Stressed"){title="😵 Deadline Panic";text="Shrink the next action until it feels startable.";}
  document.getElementById("heroMood").textContent=title;document.getElementById("heroText").textContent=text;
  document.getElementById("needsMini").innerHTML=Object.entries(state.needs).map(([n,v])=>`<div class="need-row"><strong>${n}</strong><div class="bar"><span style="width:${v*20}%;background:${needColor(v)}"></span></div><span>${v}/5</span></div>`).join("");
  const advice={Energy:["Recover before grinding","Sleep, rest or reduce the size of today's plan."],Hunger:["Eat something proper","Basic biology is not a side quest."],Hygiene:["Run a physical reset","A shower and fresh clothes can shift the whole day."],Fun:["Schedule guilt-free fun","Fun is maintenance, not a prize for perfection."],Social:["Make one social move","A message, call or short hangout counts."],Environment:["Do a five-minute reset","Clear the exact space needed for the next task."],Focus:["Use Lock-In Sequence","Choose one target, remove your phone and start a timer."]};
  document.getElementById("recommendation").innerHTML=`<h4>${advice[low[0]][0]}</h4><p>${advice[low[0]][1]}</p>`;
  const todays=state.quests.filter(q=>q.today&&!q.done).slice(0,5);document.getElementById("todayQuests").innerHTML=todays.length?todays.map(questHTML).join(""):"<p class='muted'>Nothing queued for Today.</p>";
  const active=state.arcs.find(a=>a.status==="ongoing");document.getElementById("todayArcTitle").textContent=active?active.name:"No active arc";
  document.getElementById("todayArc").innerHTML=active?`<p class="muted">${esc(active.endGoal||active.why)}</p><div class="progress"><span style="width:${arcProgress(active)}%"></span></div><p><strong>${arcProgress(active)}%</strong> complete</p><button class="ghost small" onclick="openArcDetail(${active.id})">Open arc</button>`:"<p class='muted'>Create an arc to connect daily quests to a bigger goal.</p>";
}
function needColor(v){return v<=1?"#ec7a72":v<=3?"#f4cf66":"#72d59b";}

function renderProfile(){
  const root=document.getElementById("profileCard");
  if(!root)return;

  const profile=(state&&state.profile&&typeof state.profile==="object")
    ?state.profile
    :{};

  const show=value=>{
    const text=String(value??"").trim();
    return text?esc(text):"N/A";
  };

  const height=String(profile.height??"").trim();
  const weight=String(profile.weight??"").trim();
  const physical=[
    height?`${esc(height)} cm`:"",
    weight?`${esc(weight)} kg`:""
  ].filter(Boolean).join(" · ")||"N/A";

  const traits=Array.isArray(profile.traits)&&profile.traits.length
    ?profile.traits.map(trait=>`<span class="trait-pill">${show(trait)}</span>`).join("")
    :`<span class="trait-pill muted-pill">N/A</span>`;

  const arcs=Array.isArray(state.arcs)?state.arcs:[];
  const activeArcs=arcs.filter(arc=>arc&&arc.status==="ongoing").length;

  root.innerHTML=`
    <div class="profile-hero">
      <div class="avatar">🧑‍💻</div>
      <div class="profile-title">
        <h4>${show(profile.name)}</h4>
        <p>Level ${Number(state.level)||1}</p>
      </div>
    </div>

    <div class="profile-info">
      <div class="info-tile">
        <span>Physical</span>
        <strong>${physical}</strong>
      </div>
      <div class="info-tile">
        <span>University / workplace</span>
        <strong>${show(profile.org)}</strong>
      </div>
      <div class="info-tile">
        <span>Degree / occupation</span>
        <strong>${show(profile.path)}</strong>
      </div>
      <div class="info-tile">
        <span>Active arcs</span>
        <strong>${activeArcs}</strong>
      </div>
    </div>

    <div class="profile-section-label">Traits</div>
    <div class="trait-wrap">${traits}</div>

    <div class="profile-section-label">Bio</div>
    <p class="muted profile-bio">${show(profile.bio)}</p>
  `;

  const needsRoot=document.getElementById("needsControls");
  if(needsRoot){
    const labels=["Energy","Hunger","Hygiene","Fun","Social","Environment","Focus"];
    needsRoot.innerHTML=labels.map(name=>{
      const raw=Number(state.needs?.[name]);
      const rating=Number.isFinite(raw)?Math.max(0,Math.min(5,raw)):0;
      return `
        <div class="need-rank-card">
          <strong>${name}</strong>
          <div class="stars">${"★".repeat(rating)}${"☆".repeat(5-rating)}</div>
          <span class="muted">${rating}/5</span>
        </div>`;
    }).join("");
  }
}
function openNeedsDialog(force=false){
  const d=document.getElementById("needsDialog");
  d.dataset.force=force?"true":"false";
  document.getElementById("ratingError").textContent="";
  document.getElementById("needsDialogEyebrow").textContent=force?"Initial Sim assessment":"Optional Sim reassessment";
  document.getElementById("needsDialogText").textContent=force
    ?"Complete this once to establish your starting needs. 1 = very low, 5 = excellent."
    :"Update your rankings only when they have meaningfully changed.";
  document.getElementById("needRatingRows").innerHTML=NEED_NAMES.map(n=>`<div class="rating-row"><strong>${n}</strong><div class="rating-options">${[1,2,3,4,5].map(v=>`<input type="radio" name="need-${n}" id="need-${n}-${v}" value="${v}" ${Number(state.needs[n])===v?"checked":""}><label for="need-${n}-${v}">${v}</label>`).join("")}</div></div>`).join("");
  d.showModal();
}

function renderArcs(){
  const mode=document.getElementById("arcGroupMode")?.value||"all";const arcs=state.arcs.filter(a=>a.status===currentArcStatus);const root=document.getElementById("arcList");
  if(!arcs.length){root.innerHTML=`<div class="card"><p class="muted">No ${currentArcStatus} arcs.</p></div>`;return;}
  if(mode==="all"){root.innerHTML=arcs.map(arcCardHTML).join("");return;}
  const groups={};arcs.forEach(a=>{const key=a[mode]||"Uncategorised";(groups[key]??=[]).push(a);});root.innerHTML=Object.entries(groups).map(([k,list])=>`<h3 class="group-title">${esc(k)}</h3>${list.map(arcCardHTML).join("")}`).join("");
}
function arcProgress(a){const linked=state.quests.filter(q=>q.arcId===a.id);if(!linked.length)return 0;return Math.round(linked.filter(q=>q.done).length/linked.length*100);}
function arcCardHTML(a){return `<article class="arc-card"><span class="arc-type">${esc(a.type)}</span><h4>${esc(a.name)}</h4><p class="muted">${esc(a.endGoal||a.why||"")}</p><div class="meta"><span>${esc(a.motivation||"No motivation")}</span><span>•</span><span>${esc(a.category||"No category")}</span></div><div class="progress"><span style="width:${arcProgress(a)}%"></span></div><div class="meta"><strong>${arcProgress(a)}%</strong><span>${a.deadline?`Deadline ${esc(a.deadline)}`:"No deadline"}</span></div><div class="card-actions"><button class="primary small" onclick="openArcDetail(${a.id})">Open</button><button class="ghost small" onclick="editArc(${a.id})">Edit</button></div></article>`;}
function openArcDetail(id){selectedArcId=id;renderArcDetail();switchView("arc-detail");}
function renderArcDetail(){
  const a=arcById(selectedArcId);if(!a)return;const linked=state.quests.filter(q=>q.arcId===a.id);
  document.getElementById("arcDetail").innerHTML=`<div class="arc-detail-head"><div><p class="eyebrow">${esc(a.type)} arc</p><h3>${esc(a.name)}</h3><div class="meta"><span class="tag">${esc(a.status)}</span><span>${esc(a.motivation||"")}</span><span>${esc(a.category||"")}</span></div></div><div class="card-actions"><button class="ghost" onclick="editArc(${a.id})">Edit arc</button><button class="danger-button" onclick="deleteArc(${a.id})">Delete</button></div></div><div class="arc-detail-layout"><div class="stack"><section class="card"><p class="eyebrow">End goal</p><h3>${esc(a.endGoal||"Not set")}</h3><p>${esc(a.why||"")}</p><div class="progress"><span style="width:${arcProgress(a)}%"></span></div><p><strong>${arcProgress(a)}%</strong> of linked quests complete</p></section><section class="card"><div class="section-head"><div><p class="eyebrow">Arc quests</p><h3>Steps and quests</h3></div><button class="primary small" onclick="openQuestForArc(${a.id})">+ Add quest</button></div><div class="stack">${linked.length?linked.map(questHTML).join(""):"<p class='muted'>No linked quests yet.</p>"}</div></section><section class="card"><div class="section-head"><div><p class="eyebrow">Progress memory</p><h3>Notes</h3></div><button class="ghost small" onclick="openArcNote()">+ Note</button></div><div class="notes-list">${a.notes.length?a.notes.map(n=>`<div class="note"><strong>${esc(n.date)}</strong><p>${esc(n.text)}</p></div>`).join(""):"<p class='muted'>No notes recorded.</p>"}</div></section></div><aside class="stack"><section class="card"><p class="eyebrow">This week</p><h3>${esc(a.weekly||"No weekly challenge")}</h3></section><section class="card"><p class="eyebrow">Repeating daily tasks</p><div class="stack">${a.daily.length?a.daily.map(t=>`<label class="daily-task"><input type="checkbox"> ${esc(t)}</label>`).join(""):"<p class='muted'>No daily tasks.</p>"}</div></section><section class="card"><p class="eyebrow">Status controls</p><div class="stack"><button class="ghost" onclick="setArcStatus(${a.id},'ongoing')">Move to ongoing</button><button class="ghost" onclick="setArcStatus(${a.id},'future')">Move to future</button><button class="ghost" onclick="setArcStatus(${a.id},'paused')">Pause</button><button class="primary" onclick="setArcStatus(${a.id},'completed')">Complete arc</button><button class="danger-button" onclick="setArcStatus(${a.id},'failed')">Mark failed</button></div></section></aside></div>`;
  document.querySelectorAll("[data-quest]").forEach(b=>b.onclick=()=>toggleQuest(Number(b.dataset.quest)));
}
function openArcModal(existing=null){
  document.getElementById("arcDialogTitle").textContent=existing?"Edit arc":"Create arc";document.getElementById("arcEditId").value=existing?.id||"";
  [["arcName","name"],["arcType","type"],["arcMotivation","motivation"],["arcCategory","category"],["arcDeadline","deadline"],["arcEndGoal","endGoal"],["arcWhy","why"],["arcWeekly","weekly"]].forEach(([id,key])=>document.getElementById(id).value=existing?.[key]||"");
  document.getElementById("arcStatus").value=existing?.status||"ongoing";document.getElementById("arcDaily").value=(existing?.daily||[]).join("\n");document.getElementById("arcDialog").showModal();
}
function editArc(id){openArcModal(arcById(id));}
function deleteArc(id){if(!confirm("Delete this arc? Linked quests will remain but become unlinked."))return;state.arcs=state.arcs.filter(a=>a.id!==id);state.quests.forEach(q=>{if(q.arcId===id)q.arcId=null;});addLog("Deleted an arc.");save();switchView("arcs");}
function setArcStatus(id,status){const a=arcById(id);a.status=status;addLog(`${a.name} moved to ${status}.`);save();if(currentView==="arc-detail")renderArcDetail();}

function questHTML(q){const arc=arcById(q.arcId);return `<div class="quest ${q.done?'done':''}"><button class="quest-check ${q.done?'completed':''}" data-quest="${q.id}">${q.done?'✓':''}</button><div class="quest-body"><h4>${esc(q.name)}</h4><div class="meta"><span class="tag">${labelCategory(q.category)}</span><span class="tag">${q.difficulty}</span><span>+${XP_BY_DIFFICULTY[q.difficulty]} XP</span>${arc?`<span class="tag">${esc(arc.name)}</span>`:""}${q.frequency!=="once"?`<span>↻ ${q.frequency}</span>`:""}</div><div class="quest-actions"><button class="ghost small" onclick="editQuest(${q.id})">Edit</button><button class="ghost small" onclick="deleteQuest(${q.id})">Delete</button></div></div></div>`;}
function labelCategory(c){return {uni:"University",life:"Life",fitness:"Fitness"}[c]||c;}
function renderQuests(){
  const list=state.quests.filter(q=>questFilter==="all"||(questFilter==="arc"?q.arcId:q.category===questFilter));document.getElementById("questList").innerHTML=list.length?list.map(questHTML).join(""):"<p class='muted'>No quests in this filter.</p>";
  document.querySelectorAll("[data-quest]").forEach(b=>b.onclick=()=>toggleQuest(Number(b.dataset.quest)));
  const next=LEVEL_UNLOCKS.find(x=>x[0]>state.level);
  const discount=Math.round(shopDiscount()*100);
  document.getElementById("levelBenefits").innerHTML=`
    <div class="unlock"><strong>Current level ${state.level}</strong>
      <p class="muted">${Math.round((questXpMultiplier()-1)*100)}% quest XP bonus · ${discount}% shop discount.</p>
    </div>
    <div class="perk-strip">
      <span>Next level: ${xpNeededForLevel(state.level)-state.xp} XP remaining</span>
      <span>Reward: ${20+(state.level+1)*5} coins</span>
    </div>
    ${next?`<div class="unlock locked"><strong>Next major unlock: level ${next[0]}</strong><p>${next[1]}</p></div>`:"<div class='unlock'><strong>All core unlocks earned</strong></div>"}`;
}
function toggleQuest(id){const q=state.quests.find(x=>x.id===id);if(!q)return;q.done=!q.done;if(q.done){const amount=XP_BY_DIFFICULTY[q.difficulty];addXP(amount);state.coins+=Math.ceil(amount/5);gainSkill(q.skill,Math.ceil(amount*.8));q.lastCompleted=todayISO();addLog(`Completed quest: ${q.name}`);toast(`+${amount} XP and +${Math.ceil(amount/5)} coins`);}else{q.lastCompleted="";}checkAchievements();save();if(currentView==="arc-detail")renderArcDetail();}
function openQuestModal(existing=null,arcId=null){
  document.getElementById("questDialogTitle").textContent=existing?"Edit quest":"Create quest";document.getElementById("questEditId").value=existing?.id||"";document.getElementById("questName").value=existing?.name||"";document.getElementById("questCategory").value=existing?.category||"uni";document.getElementById("questDifficulty").value=existing?.difficulty||"easy";document.getElementById("questFrequency").value=existing?.frequency||"once";document.getElementById("questToday").checked=existing?.today??true;populateSelects();document.getElementById("questArc").value=existing?.arcId??arcId??"";document.getElementById("questSkill").value=existing?.skill||Object.keys(state.skills)[0]||"";document.getElementById("questDialog").showModal();
}
function editQuest(id){openQuestModal(state.quests.find(q=>q.id===id));}
function deleteQuest(id){if(!confirm("Delete this quest?"))return;state.quests=state.quests.filter(q=>q.id!==id);save();if(currentView==="arc-detail")renderArcDetail();}
function openQuestForArc(id){openQuestModal(null,id);}

function openArcNote(){
  const arc=arcById(selectedArcId);
  if(!arc){toast("Open an arc before adding a note.");return;}
  const dialog=document.getElementById("arcNoteDialog");
  const text=document.getElementById("arcNoteText");
  if(text)text.value="";
  if(dialog&&typeof dialog.showModal==="function")dialog.showModal();
}

const arcNoteForm=document.getElementById("arcNoteForm");
if(arcNoteForm){
  arcNoteForm.addEventListener("submit",event=>{
    event.preventDefault();
    const arc=arcById(selectedArcId);
    const textElement=document.getElementById("arcNoteText");
    const noteText=(textElement?.value||"").trim();
    if(!arc){toast("Open an arc before adding a note.");return;}
    if(!noteText){toast("Write a note before saving.");return;}
    if(!Array.isArray(arc.notes))arc.notes=[];
    arc.notes.unshift({date:new Date().toLocaleDateString("en-AU"),text:noteText});
    document.getElementById("arcNoteDialog")?.close();
    addLog(`Added a note to ${arc.name}.`);
    save();
  });
}

function resetRecurringQuests(){const today=todayISO();let changed=false;state.quests.forEach(q=>{if(!q.done||q.frequency==="once"||!q.lastCompleted)return;const last=new Date(q.lastCompleted+"T00:00:00"),now=new Date(today+"T00:00:00");const diff=(now-last)/86400000;if((q.frequency==="daily"&&diff>=1)||(q.frequency==="weekly"&&diff>=7)||(q.frequency==="monthly"&&now.getMonth()!==last.getMonth())){q.done=false;changed=true;}});if(changed)localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}

function renderRituals(){document.getElementById("ritualGrid").innerHTML=state.rituals.map(r=>`<article class="ritual-card"><div class="ritual-icon">${r.icon||"✨"}</div><p class="eyebrow">${esc(r.trigger||"Anytime")}</p><h4>${esc(r.name)}</h4><ol>${r.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol><div class="meta"><span>+${r.xp} ${esc(r.skill)} XP</span><span>Done ${r.times||0}×</span></div><button class="primary" onclick="performRitual(${r.id})">Perform ritual</button></article>`).join("");}
function performRitual(id){const r=state.rituals.find(x=>x.id===id);r.times=(r.times||0)+1;addXP(r.xp);gainSkill(r.skill,r.xp);state.coins+=3;addLog(`Performed ritual: ${r.name}`);checkAchievements();save();toast(`${r.name}: +${r.xp} XP, +3 coins`);}

function renderSkills(){
  const root=document.getElementById("skillList");root.innerHTML=Object.entries(state.skills).map(([name,s])=>`<article class="skill-card"><div class="skill-header"><div><p class="eyebrow">Level ${skillLevel(s.xp)}</p><h4>${esc(name)}</h4></div><strong>${s.xp%100}/100 XP</strong></div><p class="muted">${esc(s.description||"")}</p><div class="progress"><span style="width:${s.xp%100}%"></span></div><div class="training-list">${(s.tasks||[]).map(t=>`<div class="training-task"><span>${esc(t.name)} <small class="muted">+${t.xp}</small></span><button class="primary small" onclick="completeSkillTask('${encodeURIComponent(name)}',${t.id})">Train</button></div>`).join("")||"<p class='muted'>No training tasks yet.</p>"}</div><button class="ghost small" onclick="openSkillTask('${encodeURIComponent(name)}')">+ Add training task</button></article>`).join("");
}
function openSkillTask(encoded){const name=decodeURIComponent(encoded);document.getElementById("skillTaskSkill").value=name;document.getElementById("skillTaskTitle").textContent=name;document.getElementById("skillTaskName").value="";document.getElementById("skillTaskDialog").showModal();}
function completeSkillTask(encoded,id){const name=decodeURIComponent(encoded),s=state.skills[name],t=s.tasks.find(x=>x.id===id);gainSkill(name,t.xp);addXP(Math.ceil(t.xp/2));state.coins+=2;addLog(`Trained ${name}: ${t.name}`);save();toast(`Training complete: +${t.xp} ${name} XP`);}

function renderRewards(){
  const discount=shopDiscount();
  document.getElementById("rewardList").innerHTML=state.rewards.map(r=>{
    const finalCost=Math.max(1,Math.ceil(r.cost*(1-discount)));
    return `<div class="reward-card"><div><h4>${esc(r.name)}</h4><span class="muted">💰 ${finalCost}${discount?` <s>${r.cost}</s>`:""}</span></div><button class="primary small" onclick="redeemReward(${r.id})" ${state.coins<finalCost?'disabled':''}>Redeem</button></div>`;
  }).join("");
  document.getElementById("unlockList").innerHTML=LEVEL_UNLOCKS.map(([lvl,text])=>`<div class="unlock ${state.level<lvl?'locked':''}"><strong>${state.level>=lvl?'✓':'🔒'} Level ${lvl}</strong><p>${esc(text)}</p></div>`).join("");
}
function redeemReward(id){
  const r=state.rewards.find(x=>x.id===id);
  const cost=Math.max(1,Math.ceil(r.cost*(1-shopDiscount())));
  if(state.coins<cost)return;
  state.coins-=cost;
  addLog(`Redeemed reward: ${r.name}`);
  save();
  toast("Reward redeemed — use it guilt-free.");
}

function renderLore(){
  document.getElementById("achievementList").innerHTML=state.achievements.map(a=>`<div class="achievement" style="${a.unlocked?'':'opacity:.45'}"><h4>${a.unlocked?'🏆':'🔒'} ${esc(a.name)}</h4><p class="muted">${esc(a.desc)}</p></div>`).join("");
}
function checkAchievements(){const checks={"Locked In":state.quests.filter(q=>q.done&&q.category==="uni").length>=3,"Ritualist":state.rituals.reduce((n,r)=>n+(r.times||0),0)>=5,"Arc Architect":state.arcs.length>=3,"Skill Collector":Object.keys(state.skills).length>=6};state.achievements.forEach(a=>{if(checks[a.name]&&!a.unlocked){a.unlocked=true;state.coins+=20;addLog(`Achievement unlocked: ${a.name}`);toast(`Achievement: ${a.name} (+20 coins)`);}});}
function populateSelects(){
  document.getElementById("questArc").innerHTML=`<option value="">No linked arc</option>${state.arcs.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}`;
  const skills=Object.keys(state.skills);document.getElementById("questSkill").innerHTML=skills.map(s=>`<option>${esc(s)}</option>`).join("");document.getElementById("ritualSkill").innerHTML=skills.map(s=>`<option>${esc(s)}</option>`).join("");
  const arcTypeOptions=document.getElementById("arcTypeOptions");
  const motivationOptions=document.getElementById("motivationOptions");
  const categoryOptions=document.getElementById("categoryOptions");
  if(arcTypeOptions)arcTypeOptions.innerHTML=state.arcTypes.map(x=>`<option value="${esc(x)}"></option>`).join("");
  if(motivationOptions)motivationOptions.innerHTML=state.motivations.map(x=>`<option value="${esc(x)}"></option>`).join("");
  if(categoryOptions)categoryOptions.innerHTML=state.categories.map(x=>`<option value="${esc(x)}"></option>`).join("");
}

// Navigation
nav.onclick=e=>{const b=e.target.closest("[data-view]");if(!b)return;switchView(b.dataset.view);};
document.querySelectorAll("[data-view-link]").forEach(b=>b.onclick=()=>switchView(b.dataset.viewLink));
manageSimBtn.onclick=()=>switchView("sim");rerateBtn.onclick=()=>openNeedsDialog(false);backToArcs.onclick=()=>switchView("arcs");
needsDialog.addEventListener("cancel",e=>{if(needsDialog.dataset.force==="true")e.preventDefault();});needsDialog.addEventListener("click",e=>{if(e.target===needsDialog&&needsDialog.dataset.force!=="true")needsDialog.close();});
needsForm.onsubmit=e=>{e.preventDefault();const ratings={};for(const n of NEED_NAMES){const selected=document.querySelector(`input[name='need-${n}']:checked`);if(!selected){ratingError.textContent="Rank every need before continuing.";return;}ratings[n]=Number(selected.value);}state.needs=ratings;state.lastNeedsCheck=new Date().toISOString();state.needsAssessmentComplete=true;addXP(5);addLog("Completed Sim needs assessment.");needsDialog.close();save();toast("Assessment saved. +5 XP");};

checkInBtn.onclick=()=>{checkMood.value=state.mood;dailyFocus.value=state.dailyFocus||"";dailyFun.value=state.dailyFun||"";checkInDialog.showModal();};
saveCheckIn.onclick=()=>{state.mood=checkMood.value;state.dailyFocus=dailyFocus.value.trim();state.dailyFun=dailyFun.value.trim();addXP(5);addLog(`Daily check-in: ${state.mood}.`);save();toast("Check-in saved. +5 XP");};
moodSelect.onchange=e=>{state.mood=e.target.value;save();};
editProfileBtn.onclick=()=>{
  const p=state.profile;
  profileName.value=p.name||"";
  profileHeight.value=p.height||"";
  profileWeight.value=p.weight||"";
  profileOrg.value=p.org||"";
  profilePath.value=p.path||"";
  profileTraits.value=(p.traits||[]).join(", ");
  profileBio.value=p.bio||"";
  profileDialog.showModal();
};
profileForm.onsubmit=()=>{
  state.profile={
    name:profileName.value.trim(),
    height:profileHeight.value,
    weight:profileWeight.value,
    org:profileOrg.value.trim(),
    path:profilePath.value.trim(),
    traits:profileTraits.value.split(",").map(x=>x.trim()).filter(Boolean),
    bio:profileBio.value.trim()
  };
  addLog("Updated player registration.");
  save();
};

addArcBtn.onclick=()=>openArcModal();

function closeArcDialog(){
  arcForm.reset();
  arcEditId.value="";
  arcDialog.close();
}
cancelArcBtn.onclick=closeArcDialog;
cancelArcBtnBottom.onclick=closeArcDialog;

arcForm.onsubmit=e=>{
  e.preventDefault();
  const id=Number(arcEditId.value);
  const name=arcName.value.trim();
  if(!name){ toast("Give the arc a name before saving."); return; }

  const data={
    name,
    type:arcType.value.trim()||"General",
    motivation:arcMotivation.value.trim(),
    category:arcCategory.value.trim(),
    status:arcStatus.value,
    deadline:arcDeadline.value,
    endGoal:arcEndGoal.value.trim(),
    why:arcWhy.value.trim(),
    weekly:arcWeekly.value.trim(),
    daily:arcDaily.value.split("\\n").map(x=>x.trim()).filter(Boolean)
  };

  const existing=arcById(id);
  uniquePush(state.arcTypes,data.type);
  uniquePush(state.motivations,data.motivation);
  uniquePush(state.categories,data.category);

  if(existing){
    Object.assign(existing,data);
    addLog(`Edited arc: ${data.name}`);
  }else{
    state.arcs.push({...data,id:Date.now(),notes:[],createdAt:new Date().toISOString()});
    addXP(10);
    addLog(`Created arc: ${data.name}`);
  }

  closeArcDialog();
  checkAchievements();
  save();
  toast(existing?"Arc updated.":"Arc created.");
};

addRitualBtn.onclick=()=>ritualDialog.showModal();

function closeRitualDialog(){
  ritualForm.reset();
  ritualDialog.close();
}
cancelRitualBtn.onclick=closeRitualDialog;
cancelRitualBtnBottom.onclick=closeRitualDialog;

ritualForm.onsubmit=e=>{
  e.preventDefault();
  const name=ritualName.value.trim();
  if(!name){ toast("Give the ritual a name before saving."); return; }

  const steps=ritualSteps.value.split("\\n").map(x=>x.trim()).filter(Boolean);
  state.rituals.push({
    id:Date.now(),
    name,
    icon:ritualIcon.value.trim()||"✨",
    trigger:ritualTrigger.value.trim(),
    steps:steps.length?steps:["Do the ritual"],
    skill:ritualSkill.value,
    xp:15,
    times:0
  });
  addLog(`Created ritual: ${name}`);
  closeRitualDialog();
  save();
  toast("Ritual created.");
};

resetBtn.onclick=()=>{
  const confirmed=window.confirm("Reset all LifeSim progress and return to registration?");
  if(!confirmed)return;

  localStorage.removeItem(STORAGE_KEY);

  document.querySelectorAll("dialog[open]").forEach(dialog=>{
    try{dialog.close();}catch(error){}
  });

  window.location.reload();
};

window.openArcDetail=openArcDetail;window.editArc=editArc;window.deleteArc=deleteArc;window.setArcStatus=setArcStatus;window.openQuestForArc=openQuestForArc;window.openArcNote=openArcNote;window.editQuest=editQuest;window.deleteQuest=deleteQuest;window.performRitual=performRitual;window.openSkillTask=openSkillTask;window.completeSkillTask=completeSkillTask;window.redeemReward=redeemReward;


// ---------------------------------------------------------------------
// Application boot, registration gate and responsive sidebar
// ---------------------------------------------------------------------

const registrationPage = document.getElementById("registrationPage");
const registrationFormElement = document.getElementById("registrationForm");
const appShell = document.getElementById("appShell");

const registrationFields = {
  name: document.getElementById("regName"),
  height: document.getElementById("regHeight"),
  weight: document.getElementById("regWeight"),
  org: document.getElementById("regOrg"),
  path: document.getElementById("regPath"),
  traits: document.getElementById("regTraits"),
  bio: document.getElementById("regBio"),
  error: document.getElementById("registrationError")
};

function showRegistrationPage(){
  const profile = state.profile || {};

  registrationFields.name.value = profile.name || "";
  registrationFields.height.value = profile.height || "";
  registrationFields.weight.value = profile.weight || "";
  registrationFields.org.value = profile.org || "";
  registrationFields.path.value = profile.path || "";
  registrationFields.traits.value = (profile.traits || []).join(", ");
  registrationFields.bio.value = profile.bio || "";
  registrationFields.error.textContent = "";

  registrationPage.hidden = false;
  appShell.hidden = true;
  document.body.classList.add("registration-active");

  requestAnimationFrame(() => registrationFields.name.focus());
}

function showApplication(){
  state=loadState();
  registrationPage.hidden = true;
  appShell.hidden = false;
  renderProfile();
  document.body.classList.remove("registration-active");
  render();

  if(!state.needsAssessmentComplete){
    setTimeout(() => openNeedsDialog(true), 350);
  }
}

function buildFreshRegisteredState(){
  const name=registrationFields.name.value.trim();
  return normalize({
    schemaVersion:1,
    registrationComplete:true,
    needsAssessmentComplete:false,
    level:1,
    xp:0,
    coins:0,
    mood:"Fine",
    lastNeedsCheck:"",
    customTitle:"",
    needs:{Energy:0,Hunger:0,Hygiene:0,Fun:0,Social:0,Environment:0,Focus:0},
    profile:{
      name,
      height:registrationFields.height.value.trim(),
      weight:registrationFields.weight.value.trim(),
      org:registrationFields.org.value.trim(),
      path:registrationFields.path.value.trim(),
      traits:registrationFields.traits.value.split(",").map(x=>x.trim()).filter(Boolean),
      bio:registrationFields.bio.value.trim()
    },
    skills:{},
    arcs:[],
    arcTypes:[],
    motivations:[],
    categories:[],
    quests:[],
    rituals:[],
    rewards:[],
    achievements:[],
    log:[],
    dailyFocus:"",
    dailyFun:""
  });
}

function completeRegistration(event){
  if(event)event.preventDefault();
  registrationFields.error.textContent="";

  const submitButton=document.getElementById("registrationSubmit");
  const name=registrationFields.name.value.trim();

  if(!name){
    registrationFields.error.textContent="Enter your name to continue.";
    registrationFields.name.focus();
    return false;
  }

  submitButton.disabled=true;
  submitButton.textContent="Entering…";

  try{
    const freshState=buildFreshRegisteredState();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(freshState));
    state=freshState;

    // Reload from the persisted save so registration and application boot use
    // exactly the same startup path. This avoids a half-initialised UI.
    window.location.reload();
    return true;
  }catch(error){
    console.error("Registration failed",error);
    registrationFields.error.textContent=`Registration could not finish: ${error.message||"unknown error"}`;
    submitButton.disabled=false;
    submitButton.textContent="Enter the System";
    return false;
  }
}

registrationFormElement.onsubmit=completeRegistration;
document.getElementById("registrationSubmit").onclick=event=>{
  // Explicit click fallback for browsers that do not dispatch the form submit correctly.
  event.preventDefault();
  completeRegistration(event);
};

function bootApplication(){
  const registered=Boolean(state.registrationComplete&&state.profile&&String(state.profile.name||"").trim());
  if(registered){
    showApplication();
  }else{
    showRegistrationPage();
  }
}

// Responsive sidebar.
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function openSidebar(){
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("show");
  document.body.classList.add("sidebar-open");
  menuToggle.setAttribute("aria-expanded", "true");
}

function closeSidebar(){
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
  document.body.classList.remove("sidebar-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

menuToggle.addEventListener("click", () => {
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
});

sidebarOverlay.addEventListener("click", closeSidebar);

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    if(window.innerWidth <= 768){
      closeSidebar();
    }
  });
});

window.addEventListener("resize", () => {
  if(window.innerWidth > 768){
    closeSidebar();
  }
});

bootApplication();

