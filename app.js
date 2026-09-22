const LS_KEY = "financas-app-v1";
const DEFAULT_CATS = [
  { id:"fixo", name:"Custo Fixo", color:"#0ea5e9", pct:40 },
  { id:"invest", name:"Investimentos", color:"#22c55e", pct:20 },
  { id:"metas", name:"Metas", color:"#f59e0b", pct:15 },
  { id:"conforto", name:"Conforto", color:"#8b5cf6", pct:10 },
  { id:"prazer", name:"Prazeres", color:"#ec4899", pct:10 },
  { id:"conhec", name:"Conhecimento", color:"#14b8a6", pct:5 },
];

let state = load() || { income: 5000, categories: DEFAULT_CATS, txs: [] };
if(!state.categories?.length) state.categories = DEFAULT_CATS;

const $ = id => document.getElementById(id);
const EUR = v => (v||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"});
const uid = () => Math.random().toString(36).slice(2,9);
function parseNum(v){
  let s = String(v ?? "").trim();
  if(!s) return 0;
  if(s.includes(",")) s = s.replace(/\./g,"").replace(",",".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)); }catch{ return null; } }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

let donut=null, bar=null, editingId=null;

// init
$("incomeInput").value = state.income || "";
$("fDate").valueAsDate = new Date();

$("incomeInput").addEventListener("input", e=>{ state.income = parseNum(e.target.value); save(); render(); });
$("resetBtn").onclick = ()=>{ if(confirm("Apagar tudo?")){ state={income:0,categories:DEFAULT_CATS,txs:[]}; save(); location.reload(); } };
$("exportBtn").onclick = ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="financas.json"; a.click();
};
$("fabBtn").onclick = ()=>openModal();
$("settingsBtn").onclick = ()=>document.body.classList.add("drawer-open");
$("settingsClose").onclick = ()=>document.body.classList.remove("drawer-open");
$("drawerOverlay").onclick = ()=>document.body.classList.remove("drawer-open");
$("cancelBtn").onclick = ()=>$("modal").classList.add("hidden");
$("saveTxBtn").onclick = saveTx;
$("addCatBtn").onclick = ()=>$("catModal").classList.remove("hidden");
$("cCancel").onclick = ()=>$("catModal").classList.add("hidden");
$("cSave").onclick = ()=>{
  const name=$("cName").value.trim(); if(!name) return alert("Dê um nome.");
  state.categories.push({id:uid(),name,color:$("cColor").value,pct:parseNum($("cPct").value)});
  $("cName").value=""; save(); render(); $("catModal").classList.add("hidden");
};
$("searchInput").addEventListener("input", renderTx);
$("filterCat").addEventListener("change", renderTx);

function openModal(tx){
  editingId = tx?.id || null;
  $("modalTitle").textContent = tx? "Editar transação":"Nova transação";
  $("fDesc").value = tx?.desc||""; $("fValue").value = tx?.value||"";
  $("fDate").value = tx?.date || new Date().toISOString().slice(0,10);
  $("fType").value = tx?.type||"despesa";
  fillCatSelect($("fCat"), tx?.catId);
  $("modal").classList.remove("hidden");
}
function fillCatSelect(sel, val){
  sel.innerHTML = state.categories.map(c=>`<option value="${c.id}" ${c.id===val?"selected":""}>${c.name}</option>`).join("");
}
function saveTx(){
  const desc=$("fDesc").value.trim()||"Sem descrição";
  const value=parseNum($("fValue").value);
  if(!value||value<=0) return alert("Informe um valor válido.");
  const data={id:editingId||uid(),desc,value,catId:$("fCat").value,type:$("fType").value,date:$("fDate").value||new Date().toISOString().slice(0,10)};
  if(editingId){ state.txs = state.txs.map(t=>t.id===editingId?data:t); }
  else state.txs.unshift(data);
  editingId=null; save(); $("modal").classList.add("hidden"); render();
}

function icons(){ if(window.lucide) lucide.createIcons(); }
function catById(id){ return state.categories.find(c=>c.id===id) || {name:"—",color:"#999"}; }
function spentByCat(){
  const m={}; state.txs.filter(t=>t.type==="despesa").forEach(t=>{ m[t.catId]=(m[t.catId]||0)+t.value; });
  return m;
}

function getInvestCat(){
  return state.categories.find(c=>c.id==="invest") || state.categories.find(c=>c.name.toLowerCase().includes("invest")) || null;
}

function render(){
  // budgets UI
  const income = state.income||0;
  const spentMap = spentByCat();
  const totalSpent = Object.values(spentMap).reduce((a,b)=>a+b,0);
  const extraIn = state.txs.filter(t=>t.type==="receita").reduce((a,t)=>a+t.value,0);

  // Investimento obrigatório: reserva automática sobre a renda
  const investCat = getInvestCat();
  const investLimit = investCat ? income*(investCat.pct/100) : 0;
  const investSpent = investCat ? (spentMap[investCat.id]||0) : 0;
  const investPending = Math.max(0, investLimit - investSpent);
  const committed = totalSpent + investPending;
  const balance = income + extraIn - committed;

  $("kpiSpent").textContent = EUR(committed);
  $("kpiBalance").textContent = EUR(balance);
  $("kpiBalance").className = balance<0?"red":"green";
  const rawPct = income>0 ? committed/income*100 : 0;
  const pct = Math.min(100, rawPct);
  $("kpiPct").textContent = rawPct.toFixed(0)+"%";
  $("progressBar").style.width = pct+"%";
  $("progressBar").style.background = rawPct>100?"#ef4444":rawPct>85?"#f59e0b":"linear-gradient(90deg,#22c55e,#16a34a)";
  if(balance<0||rawPct>100){$("progressBar").style.width="100%";}

  // Caixa do investimento obrigatório
  if(investCat && income>0){
    $("investBox").style.display = "flex";
    $("investText").textContent = `${EUR(investSpent)} de ${EUR(investLimit)} investidos • faltam ${EUR(investPending)}`;
    $("investBtn").style.display = investPending>0 ? "" : "none";
    $("investBtn").onclick = ()=>{
      openModal(null);
      $("fDesc").value = "Investimento mensal";
      $("fValue").value = investPending.toFixed(2);
      $("fCat").value = investCat.id;
      $("fType").value = "despesa";
    };
  } else {
    $("investBox").style.display = "none";
  }

  const totalPct = state.categories.reduce((a,c)=>a+(+c.pct||0),0);
  $("totalPct").textContent = totalPct+"%";
  $("pctWarn").classList.toggle("hidden", totalPct===100);
  $("warnVal").textContent = totalPct+"%";

  $("budgetList").innerHTML = state.categories.map(c=>{
    const limit = income*(c.pct/100);
    const spent = spentMap[c.id]||0;
    const p = limit>0?Math.min(100,spent/limit*100):(spent>0?100:0);
    const over = limit>0 && spent>limit;
    return `<div class="budget">
      <div class="budget-top">
        <span class="dot" style="background:${c.color}"></span>
        <span class="name">${c.name}</span>
        <input type="text" inputmode="decimal" value="${c.pct}" data-pct="${c.id}" title="%" /> <small>%</small>
        <button class="icon-btn" data-del="${c.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
      </div>
      <input type="range" min="0" max="100" value="${c.pct}" data-range="${c.id}" />
      <div class="budget-meta"><span>Limite ${EUR(limit)}</span><span style="color:${over?"#ef4444":"inherit"}">Gasto ${EUR(spent)}${over?" • estourou!":""}</span></div>
      <div class="budget-bar"><i style="width:${p}%;background:${over?"#ef4444":c.color}"></i></div>
    </div>`;
  }).join("");

  document.querySelectorAll("[data-pct]").forEach(i=>i.onchange=e=>{
    const c=state.categories.find(x=>x.id===e.target.dataset.pct); c.pct=Math.max(0,parseNum(e.target.value)); save(); render();
  });
  document.querySelectorAll("[data-range]").forEach(i=>i.oninput=e=>{
    const c=state.categories.find(x=>x.id===e.target.dataset.range); c.pct=+e.target.value; save(); render();
  });
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=e=>{
    if(!confirm("Excluir categoria? Gastos dela ficam sem categoria."))return;
    state.categories=state.categories.filter(x=>x.id!==e.currentTarget.dataset.del); save(); render();
  });

  $("filterCat").innerHTML = `<option value="">Todas categorias</option>`+state.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  fillCatSelect($("fCat"));

  renderTx();
  drawCharts();
}

function renderTx(){
  const q=($("searchInput").value||"").toLowerCase();
  const fc=$("filterCat").value;
  const list=state.txs.filter(t=>{
    if(fc&&t.catId!==fc)return false;
    if(q&&!t.desc.toLowerCase().includes(q))return false;
    return true;
  });
  $("txCount").textContent = `${list.length} lançamento(s)`;
  $("txList").innerHTML = list.length? list.map(t=>{
    const c=catById(t.catId);
    return `<div class="tx">
      <span class="dot" style="background:${c.color}"></span>
      <div class="tx-info"><b>${t.desc}</b><small>${c.name} • ${t.date.split("-").reverse().join("/")} • ${t.type==="receita"?"receita":"despesa"}</small></div>
      <span class="tx-val ${t.type==="receita"?"in":"out"}">${t.type==="receita"?"+":"−"} ${EUR(t.value)}</span>
      <button class="icon-btn" data-edit="${t.id}"><i data-lucide="pencil"></i></button>
      <button class="icon-btn" data-rm="${t.id}"><i data-lucide="trash-2"></i></button>
    </div>`;
  }).join("") : `<div class="empty">Nenhum lançamento. Clique em <b>+ Adicionar</b>.</div>`;
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=e=>{ state.txs=state.txs.filter(t=>t.id!==e.currentTarget.dataset.rm); save(); render(); });
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=e=>{ openModal(state.txs.find(t=>t.id===e.currentTarget.dataset.edit)); });
  icons();
}

function drawCharts(){
  Chart.defaults.color = "#f5f5f7"; Chart.defaults.borderColor = "transparent";
  const spentMap = spentByCat();
  const labels = state.categories.map(c=>c.name);
  const data = state.categories.map(c=>spentMap[c.id]||0);
  const colors = state.categories.map(c=>c.color);
  const income=state.income||0;

  const hasSpent = data.some(v=>v>0);
  const hasBudget = income>0 && state.categories.some(c=>(+c.pct||0)>0);

  // Donut: mostra placeholder quando vazio
  $("donutEmpty").classList.toggle("hidden", hasSpent);
  $("donutChart").style.display = hasSpent ? "" : "none";
  if(donut) { donut.destroy(); donut=null; }
  if(hasSpent){
    donut = new Chart($("donutChart"),{type:"doughnut",
      data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0,hoverOffset:4}]},
      options:{maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"bottom",labels:{boxWidth:12,boxHeight:12,usePointStyle:false}}}}});
  }

  // Barra: mostra placeholder quando sem renda/budget e sem gasto
  const showBar = hasSpent || hasBudget;
  $("barEmpty").classList.toggle("hidden", showBar);
  $("barChart").style.display = showBar ? "" : "none";
  if(bar) { bar.destroy(); bar=null; }
  if(showBar){
    bar = new Chart($("barChart"),{type:"bar",
      data:{labels,datasets:[
        {label:"Orçado",data:state.categories.map(c=>+(income*c.pct/100).toFixed(2)),backgroundColor:"#3f3f46",borderWidth:0,borderRadius:8},
        {label:"Gasto",data,backgroundColor:colors,borderWidth:0,borderRadius:8}
      ]},
      options:{maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:12,boxHeight:12,usePointStyle:false}}},
        scales:{x:{grid:{display:false,drawBorder:false},border:{display:false}},y:{beginAtZero:true,grid:{display:false,drawBorder:false},border:{display:false},ticks:{maxTicksLimit:5}}}}});
  }
}

render();
