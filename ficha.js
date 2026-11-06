"use strict";
/* ================= CRIPTOGRAFIA ================= */
const TE=new TextEncoder(),TD=new TextDecoder(),CS=crypto.subtle;
function b64e(u8){let s="";for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function b64d(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
async function pipe(u8,Stream,mode){const s=new Blob([u8]).stream().pipeThrough(new Stream(mode));return new Uint8Array(await new Response(s).arrayBuffer())}
const canZip=typeof CompressionStream!=="undefined";
async function passKey(pass,salt){const k=await CS.importKey("raw",TE.encode(pass),"PBKDF2",false,["deriveKey"]);
 return CS.deriveKey({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},k,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function sealPass(key,obj){const iv=rnd(12);const ct=new Uint8Array(await CS.encrypt({name:"AES-GCM",iv},key,TE.encode(JSON.stringify(obj))));return{iv:b64e(iv),ct:b64e(ct)}}
async function openPass(key,iv,ct){const pt=await CS.decrypt({name:"AES-GCM",iv:b64d(iv)},key,b64d(ct));return JSON.parse(TD.decode(pt))}
const ECP={name:"ECDH",namedCurve:"P-256"};
async function fingerprint(rawPub){const h=new Uint8Array(await CS.digest("SHA-256",rawPub));return [...h.slice(0,4)].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase().replace(/(....)/,"$1-")}
function parseMesa(s){s=(s||"").trim();const m=s.match(/MESA\.([A-Za-z0-9_-]+)/);if(!m)return null;const raw=b64d(m[1]);return raw.length===65&&raw[0]===4?raw:null}
async function sealForMaster(rawPub,obj){
 const mpub=await CS.importKey("raw",rawPub,ECP,false,[]);const eph=await CS.generateKey(ECP,true,["deriveKey"]);
 const key=await CS.deriveKey({name:"ECDH",public:mpub},eph.privateKey,{name:"AES-GCM",length:256},false,["encrypt"]);
 let pt=TE.encode(JSON.stringify(obj)),flag=0;if(canZip){pt=await pipe(pt,CompressionStream,"deflate-raw");flag=1}
 const iv=rnd(12);const ct=new Uint8Array(await CS.encrypt({name:"AES-GCM",iv},key,pt));const ep=new Uint8Array(await CS.exportKey("raw",eph.publicKey));
 const out=new Uint8Array(1+65+12+ct.length);out[0]=flag;out.set(ep,1);out.set(iv,66);out.set(ct,78);return "ELY1."+b64e(out)}
async function openForMaster(priv,code){
 const m=(code||"").match(/ELY1\.([A-Za-z0-9_-]+)/);if(!m)throw new Error("formato");
 const u=b64d(m[1]);const flag=u[0],ep=u.slice(1,66),iv=u.slice(66,78),ct=u.slice(78);
 const epk=await CS.importKey("raw",ep,ECP,false,[]);const key=await CS.deriveKey({name:"ECDH",public:epk},priv,{name:"AES-GCM",length:256},false,["decrypt"]);
 let pt=new Uint8Array(await CS.decrypt({name:"AES-GCM",iv},key,ct));if(flag&1){if(!canZip)throw new Error("navegador");pt=await pipe(pt,DecompressionStream,"deflate-raw")}
 return JSON.parse(TD.decode(pt))}
const shareable=S=>{const c=JSON.parse(JSON.stringify(S));c.sons={};return c};

/* ================= DIÁLOGO ================= */
function ask(title,html,okText,check,wide,onOpen){return new Promise(res=>{const d=$("#dlg");d.classList.toggle("wide",!!wide);$("#dT").textContent=title;$("#dB").innerHTML=html+"<div class='err' id='dErr'></div>";$("#dOk").textContent=okText||"Confirmar";
 const f=d.querySelector("form");
 f.onsubmit=async ev=>{if(ev.submitter&&ev.submitter.value!=="ok")return;ev.preventDefault();const vals=Object.fromEntries([...d.querySelectorAll("[name]")].map(i=>[i.name,i.type==="checkbox"?i.checked:i.value]));
  $("#dOk").disabled=true;let r;try{r=check?await check(vals):vals}catch(e){r={err:e.message||"Erro."}}$("#dOk").disabled=false;
  if(r&&r.err){$("#dErr").textContent=r.err;return}d.close("ok");res(r)};
 d.onclose=()=>{if(d.returnValue!=="ok")res(null)};d.returnValue="";d.showModal();
 const gs=d.querySelector("[name=grau]");if(gs){const h=()=>{const x=d.querySelector("#tHint");if(x)x.textContent=TIERS[gs.value]?"Custo sugerido: "+TIERS[gs.value]:""};gs.onchange=h;h()}
 if(onOpen)onOpen(d);const fi=d.querySelector("input:not([type=checkbox]):not([type=file])");if(fi)fi.focus()})}

/* ================= AÇÕES DE JOGO ================= */
const who=S=>S.nome||"Personagem";
function clampRes(S){const d=D(S);const c=(k,m)=>{if(S[k].a===""||S[k].a==null)return;S[k].a=Math.max(0,Math.min(num(S[k].a),m))};c("pv",d.pvM||1e9);c("vb",d.vbM||1e9);c("fe",d.feU||1e9)}
function wearArmor(S){const a=num(S.arm.rm)?S.arm:num(S.esc.rm)?S.esc:null;if(!a)return"";const r=a.res===""?num(a.rm):num(a.res);a.res=Math.max(0,r-1);return ` ${a.n||"Armadura"} perdeu 1 de Resistência (${a.res}/${a.rm}${a.res<=0?", quebrou":a.res*2<=num(a.rm)?", avariada":""}).`}
const ACT={
 damage(S,{v,tipo="normal",resist=false,crit=false}){
  let dmg=Math.max(0,Math.floor(num(v)));if(!dmg)return null;const d=D(S);if(d.fx.sofre)dmg+=d.fx.sofre;let txt=[],orig=dmg;
  let vb=num(S.vb.a),pv=num(S.pv.a),vbLoss=0,pvLoss=0,zeroed=false;
  if(tipo==="verdadeiro"){pvLoss=dmg;if(resist)txt.push("Dano Verdadeiro não pode ser reduzido.")}
  else{if(resist){if(vb>0){dmg=Math.floor(dmg/2);txt.push("Resistiu com Vida Bruta: −50%.")}else{dmg=Math.floor(dmg*.75);txt.push("Resistiu sem Vida Bruta: −25%.")}}
   vbLoss=Math.min(vb,dmg);pvLoss=dmg-vbLoss;zeroed=vbLoss>0&&vb-vbLoss===0}
  S.vb.a=vb-vbLoss;S.pv.a=Math.max(0,pv-pvLoss);
  let ar="";if(crit||tipo==="brutal"||zeroed)ar=wearArmor(S);
  let lim="";if(pvLoss>0){if(S.pv.a<=0){lim=" Caiu a 0 PV: Limiar da Morte!";S.cond.Inconsciente=1}
   else if(num(S.limiar)>=5){S.pv.a=0;S.cond.Inconsciente=1;lim=" Estava À beira: vai direto ao Limiar da Morte!"}
   else{S.limiar=num(S.limiar)+1;lim=` Marca do Limiar ${S.limiar} (${LIMIAR[S.limiar].n}).`}}
  const e={who:who(S),label:`sofreu ${orig} de dano${tipo!=="normal"?" "+tipo:""}${crit?" (crítico)":""}`,text:`${txt.join(" ")} VB −${vbLoss}, PV −${pvLoss}.${ar}${lim}`.trim(),kind:"dano"};
  logAdd(e);emit("roll",e);playSound("dano");return e},
 heal(S,{v,alvo="pv"}){const d=D(S);const m={pv:d.pvM,vb:d.vbM,fe:d.feU}[alvo];const before=num(S[alvo].a);S[alvo].a=Math.min(m||1e9,before+Math.max(0,Math.floor(num(v))));
  if(alvo==="pv"&&S.pv.a>0&&S.cond.Inconsciente)delete S.cond.Inconsciente;
  const e={who:who(S),label:`recuperou ${S[alvo].a-before} ${alvo==="pv"?"PV":alvo==="vb"?"VB":"Fé"}`,kind:"cura"};logAdd(e);emit("roll",e);playSound("cura");return e},
 rest(S,key){const r=DESCANSOS.find(x=>x[0]===key);if(!r)return;const d=D(S);const g={};
  [["pv",d.pvM],["vb",d.vbM],["fe",d.feU]].forEach(([k,m])=>{const add=Math.ceil(m*r[2]);const b=num(S[k].a);S[k].a=Math.min(m,b+add);g[k]=S[k].a-b});
  const lb=num(S.limiar);S.limiar=Math.max(0,lb-r[3]);
  if(key==="medio"&&S.cond.Cansado){S.cond.Cansado=num(S.cond.Cansado)-1;if(S.cond.Cansado<=0)delete S.cond.Cansado}
  if(key==="longo"){delete S.cond.Cansado;delete S.cond.Exausto}
  if(S.pv.a>0)delete S.cond.Inconsciente;
  const e={who:who(S),label:r[1],text:`+${g.pv} PV, +${g.vb} VB, +${g.fe} Fé.${lb!==S.limiar?` Marcas do Limiar: ${lb} → ${S.limiar}.`:""}`,kind:"cura"};logAdd(e);emit("roll",e);playSound("descanso");return e},
 turnStart(S){const d=D(S);if(!d.fx.dots.length){toast("Nenhuma condição causa dano no início do turno.");return null}
  const parts=[];let pvDirect=0,normal=0;d.fx.dots.forEach(x=>{const r=rollExpr(x.expr);parts.push(`${x.n} ${x.expr}[${r.detail.replace(/^.*?\[|\].*$/g,"")}] = ${r.total}`);if(x.dotT==="pv")pvDirect+=r.total;else normal+=r.total});
  const e0={who:who(S),label:"início do turno",text:parts.join(" · "),kind:"dano"};logAdd(e0);emit("roll",e0);
  if(normal)ACT.damage(S,{v:normal});if(pvDirect){S.pv.a=Math.max(0,num(S.pv.a)-pvDirect);const e={who:who(S),label:`perdeu ${pvDirect} PV (sangramento)`,kind:"dano"};if(S.pv.a<=0){S.cond.Inconsciente=1;e.text="Caiu a 0 PV: Limiar da Morte!"}logAdd(e);emit("roll",e)}
  return e0},
 roll(S,expr,label,opts={}){const r=rollExpr(expr,S);if(!r)return null;if(r.err){toast(r.err);return null}
  const e={who:who(S),label,detail:r.detail,total:r.total,crit:r.crit,fail:r.fail,kind:"roll",secret:!!opts.secret,extra:r.crit?"20 natural: crítico!":r.fail?"1 natural: falha!":""};
  logAdd(e);emit("roll",e);playSound("dado");return e},
 rollPer(S,n,opts){const p=D(S).per[n];return ACT.roll(S,"1d20"+sg(p.tot),n,opts)},
 rollAtk(S,i){const a=S.atk[i];if(!a)return;const d=D(S);const atq=num(a.atq)+d.fx.test+d.fx.atk;const r=ACT.roll(S,"1d20"+sg(atq),"ataca com "+(a.arma||"arma"));
  if(r&&!r.fail&&a.dano){let ex=a.dano;if(r.crit)ex=critExpr(ex);const dd=rollExpr(ex,S);if(dd&&!dd.err){const dm=Math.max(0,dd.total+d.fx.dano);const e={who:who(S),label:"dano"+(a.tipo?" "+a.tipo:"")+(r.crit?" (crítico)":""),detail:dd.detail+(d.fx.dano?` ${sg(d.fx.dano)}`:""),total:dm,kind:"roll"};logAdd(e);emit("roll",e)}}
  return r},
 usePower(S,id){const p=S.pod.find(x=>x.id===id);if(!p)return null;const c=num(p.custo);
  if(p.tipo==="Passivo"){p.ligado=!p.ligado;const e={who:who(S),label:(p.ligado?"ligou ":"desligou ")+(p.nome||"poder"),text:`Reserva ${c} Fé enquanto ligado.`,kind:"poder"};logAdd(e);emit("roll",e);return e}
  if(num(S.fe.a)<c){toast("Fé insuficiente.");return null}S.fe.a=num(S.fe.a)-c;
  let r=null;if(p.rolagem){r=rollExpr(p.rolagem,S);if(r&&r.err){toast(r.err);r=null}}
  const e={who:who(S),label:"usou "+(p.nome||"um poder"),text:(p.efeito||"").slice(0,220),detail:r?r.detail:"",total:r?r.total:null,extra:`−${c} Fé · ${p.grau||""}`,kind:"poder",power:{nome:p.nome,grau:p.grau,som:p.som||"brilho",cor:GRAU_COR[p.grau]||"#d9b86a"}};
  logAdd(e);emit("roll",e);emit("power",e);playSound(p.som||"brilho",S.sons&&S.sons[p.id]);return e},
 setCond(S,n,lvl){const ci=condInfo(S,n);const max=ci.max||num(S.condMax)||5;if(lvl<=0){delete S.cond[n];return}S.cond[n]=ci.lv?Math.min(lvl,max):1;
  if(n==="Abalado"&&S.cond.Abalado>=3){delete S.cond.Abalado;S.cond.Amedrontado=1;toast("Abalado 3 virou Amedrontado.")}}
};

/* ================= FICHA: HTML ================= */
function listHTML(key){const cols=LISTS[key];
 return `<div class="lst" data-list="${key}"><div class="lh">${cols.map(c=>`<div class="c ${c[3]==="cb"||c[3]==="roll"?"cb":""}" style="flex:${c[2]}">${c[1]}</div>`).join("")}<button type="button" class="del" tabindex="-1">×</button></div><div class="rows"></div><button type="button" class="add">+ adicionar</button></div>`}
function rowHTML(key,i,row){return `<div class="lr">${LISTS[key].map(([c,lab,w,t])=>{const v=row[c]??"";const a=`data-l="${key}" data-i="${i}" data-c="${c}" aria-label="${lab||c}"`;
 if(t==="roll")return `<div class="c cb" style="flex:${w}"><button type="button" class="dice" data-ratk="${i}" title="Rolar ataque e dano">🎲</button></div>`;
 let inp=t==="cb"?`<input type="checkbox" ${a} ${v?"checked":""}>`:t==="ta"?`<textarea ${a} rows="2">${esc(v)}</textarea>`:t==="sel"?`<select ${a}><option></option>${GRAUS.map(g=>`<option ${g===v?"selected":""}>${g}</option>`).join("")}</select>`:`<input ${t==="num"?'type="number"':""} ${a} value="${esc(v)}" ${c==="dano"?'placeholder="1d8+For"':c==="atq"?'placeholder="+5"':""}>`;
 return `<div class="c ${t==="cb"?"cb":""}" style="flex:${w}">${inp}</div>`}).join("")}<button type="button" class="del" data-del="${key}" data-i="${i}" title="Remover">×</button></div>`}
const F=(k,lab,extra="",attrs="")=>`<div ${extra}><label>${lab}</label><input data-k="${k}" ${attrs}></div>`;
const T=(k,lab,h=90)=>`<div><label>${lab}</label><textarea data-k="${k}" style="min-height:${h}px"></textarea></div>`;
function res(k,nome){return `<div class="res" style="--c:var(--${k})"><div class="rt">${nome}</div><input class="big" data-k="${k}.a" type="number" aria-label="${nome} atual"><div class="mx"><span>de</span><output data-max="${k}"></output></div><div class="bar"><div data-bar="${k}"></div></div><div class="pm edit-only"><button type="button" data-pm="${k}" data-d="-5">−5</button><button type="button" data-pm="${k}" data-d="-1">−1</button><button type="button" data-pm="${k}" data-d="1">+1</button><button type="button" data-pm="${k}" data-d="5">+5</button></div><div class="base"><label>Base</label><input data-k="${k}.base" type="number" aria-label="${nome} base"><small data-bonus="${k}"></small></div></div>`}
function armHTML(k,lab){return `<div class="armr" data-arm="${k}"><div class="g" style="grid-template-columns:2.4fr .8fr 1.3fr">${F(k+".n",lab)}${F(k+".vb","VB",'',"type=number")}${F(k+".pen","Penalidade")}</div>
 <div class="armres"><span class="lab">Resistência</span><button type="button" class="edit-only" data-ares="${k}" data-d="-1">−</button><input data-k="${k}.res" type="number" aria-label="Resistência atual"><span>/</span><input data-k="${k}.rm" type="number" aria-label="Resistência máxima"><button type="button" class="edit-only" data-ares="${k}" data-d="1">+</button><button type="button" class="edit-only" data-arep="${k}">Reparar</button><span class="astate" data-astate="${k}"></span></div></div>`}
function sheetHTML(){return `
<div class="tabs">${["Frente","Evolução","Grimório","Personagem"].map((t,i)=>`<button type="button" data-tab="${i}" class="${i?"":"on"}">${t}</button>`).join("")}<button type="button" data-tab="4" class="edit-only">Enviar ao mestre</button></div>
<div class="tabp on" data-p="0"><div class="panel">
 <div class="idrow">${F("nome","Personagem")}${F("jogador","Jogador")}<div><label>Signo de origem</label><select data-k="signo"><option></option>${SIGNOS.map(s=>`<option>${s}</option>`).join("")}</select></div><div><label>Nível</label><input data-k="nivel" type="number" min="1" max="50"></div>${F("estilos","Estilos de combate","",'list="dlEst"')}${F("ressonancia","Ressonância")}</div>
 <datalist id="dlEst">${ESTILOS_LIST.map(e=>`<option value="${esc(e[0])}">${esc(e[1])}</option>`).join("")}</datalist>
 <div class="cols" style="margin-top:16px">
  <div class="cA"><div class="sec">Atributos</div>${ATR.map(([k,n])=>`<div class="attr"><div class="an" data-ratr="${k}" title="Rolar ${n}">${n}</div><input data-k="atr.${k}" type="number" aria-label="${n}"><output class="mod" data-mod="${k}"></output></div>`).join("")}
   <div class="sec">Cor do token</div><input type="color" data-k="cor" class="edit-only" style="height:38px;padding:2px">
  </div>
  <div class="cB">
   <div class="sec">Vitalidade e Fé</div><div class="res3">${res("pv","Pontos de Vida")}${res("vb","Vida Bruta")}${res("fe","Fé")}</div>
   <div class="combat edit-only">
    <div class="dmgrow"><input type="number" id="dmgV" placeholder="Dano" aria-label="Valor do dano"><select id="dmgT" aria-label="Tipo de dano"><option value="normal">normal</option><option value="brutal">brutal</option><option value="verdadeiro">verdadeiro</option></select>
     <label class="ck"><input type="checkbox" id="dmgR">Resistir</label><label class="ck"><input type="checkbox" id="dmgC">Crítico</label><button type="button" class="danger" id="bDmg">Receber dano</button></div>
    <div class="dmgrow"><input type="number" id="healV" placeholder="Cura" aria-label="Valor da cura"><select id="healT" aria-label="Recuperar"><option value="pv">PV</option><option value="vb">VB</option><option value="fe">Fé</option></select><button type="button" id="bHeal">Recuperar</button><button type="button" id="bTurn" title="Rola o dano de Sangramento, Chamas e Veneno">Início do turno</button></div>
    <div class="rests">${DESCANSOS.map(([k,n,p])=>`<button type="button" data-rest="${k}"><b>${n}</b><small>${Math.round(p*100)}%</small></button>`).join("")}</div>
   </div>
   <div class="sec">Marcas do Limiar <span class="limtxt" id="limN"></span></div>
   <div class="lim"><div class="limpips">${[1,2,3,4,5].map(i=>`<button type="button" class="pip" data-lim="${i}" aria-label="${i} marcas">${i}</button>`).join("")}</div><div class="tip" id="limT" style="margin:0"></div></div>
   <div class="sec">Defesa</div>
   <div class="eva"><div class="evbig"><span class="lab">Evasiva</span><output id="evaT"></output></div><span class="op">10 +</span><div style="flex:1"><label>Agi</label><output class="small" id="evaA"></output></div><span class="op">+</span><div style="flex:1"><label>Estilo</label><input data-k="eva.est" type="number"></div><span class="op">+</span><div style="flex:1"><label>Outros</label><input data-k="eva.out" type="number"></div></div>
   <div class="g g4" style="margin-top:10px"><div><label>Iniciativa</label><button type="button" class="outbtn" id="bIni"></button></div><div><label>Desloc. (m)</label><input data-k="desl" type="number" step="0.5"><small class="eff" id="deslE"></small></div><div><label>CD de poder</label><input data-k="cd" type="number"><small class="eff" id="cdE"></small></div>${F("carga","Carga")}</div>
   <div class="srs">SaveRolls ${[0,1,2,3].map(i=>`<input type="checkbox" data-k="sr.${i}" aria-label="SaveRoll ${i+1}">`).join("")}</div>
   <div class="sec">Proteção</div>${armHTML("arm","Armadura")}${armHTML("esc","Escudo")}
   <div class="sec">Condições <span class="edit-only" style="font-size:12px;letter-spacing:.05em;text-transform:none;font-family:Lora,serif;font-weight:400">nível máx. <input data-k="condMax" type="number" min="1" max="20" style="width:52px"></span></div>
   <div id="condAct" class="condact"></div>
   <div id="penBox" class="penbox"></div>
   <details class="edit-only condpick"><summary>+ Adicionar condição</summary>
    <div class="conds">${COND.map(([c,it])=>`<div class="cat">${c}</div><div class="chips">${it.map(n=>`<span class="chip ${COND_FX[n]?.lv?"lv":""}" data-cadd="${esc(n)}" title="${esc(COND_TXT[n]||"")}">${n}${COND_FX[n]?.lv?' <i>Nv.</i>':""}</span>`).join("")}</div>`).join("")}
     <div class="cat">Da casa (homebrew)</div><div class="chips" id="condCustom"></div>
     <button type="button" id="bCondNew" style="margin-top:8px">+ Criar condição da casa</button></div>
   </details>
  </div>
  <div class="cC"><div class="sec">Perícias <span style="font-size:11px;font-family:Lora;text-transform:none;letter-spacing:0">clique no nome para rolar</span></div>
   <table class="per"><tr><th>Tr.</th><th style="text-align:left">Perícia</th><th>Total</th><th>Atr.</th><th>Treino</th><th>Outros</th></tr>
   ${PER.map(([n,a])=>`<tr><td><input type="checkbox" data-k="per.${n}.t" aria-label="${n} treinada"></td><td class="n"><button type="button" class="pn" data-rper="${esc(n)}">${n}</button><i>${AB[a].slice(0,3)}</i></td><td><output data-pt="${n}"></output></td><td data-pa="${n}"></td><td data-pr="${n}"></td><td><input type="number" data-k="per.${n}.o" aria-label="${n} outros"></td></tr>`).join("")}</table>
   <div class="tip">Treino: +2 (nv. 1–9), +3 (10–24), +4 (25–39), +5 (40+). Penalidades de condições e do Limiar já entram no total.</div>
   <div class="sec">Rolagem livre</div><div class="dmgrow"><input id="freeR" placeholder="2d6+Esp+1" aria-label="Rolagem livre"><button type="button" id="bFree">Rolar</button></div>
  </div>
 </div>
 <div class="sec">Ataques <span style="font-size:11px;font-family:Lora;text-transform:none;letter-spacing:0">dano aceita 1d8+For, 2d6+3…</span></div>${listHTML("atk")}
</div></div>

<div class="tabp" data-p="1"><div class="panel">
 <div class="sec">Árvores de evolução <span>PTA gastos <input data-k="pta" type="number"></span></div>
 ${ARV.map(([n,subs],i)=>`<div class="trow"><b>${n}</b><div><div class="tl"><span class="k">Trilha base</span><div class="dots" data-dots="${i}.b" data-max="10"></div></div><div class="tl"><span class="k">Subárea</span><select data-k="arv.${i}.sub"><option></option>${subs.map(s=>`<option>${s}</option>`).join("")}</select><div class="dots" data-dots="${i}.s" data-max="15"></div></div></div></div>`).join("")}
 <div class="g g2" style="margin-top:6px">
  <div><div class="sec">Dons de signo</div>${DONS_NV.map((nv,i)=>`<div class="g" style="grid-template-columns:44px 1fr 2fr;align-items:center;margin-bottom:6px"><b class="dnv">${nv}</b><input data-k="dons.${i}.n" placeholder="Dom" aria-label="Dom nível ${nv}"><input data-k="dons.${i}.e" placeholder="Efeito" aria-label="Efeito nível ${nv}"></div>`).join("")}
   <div class="sec">Passivas e habilidades de árvore</div>${listHTML("pas")}
   <div class="sec">Bônus fixos</div><p class="tip" style="margin-top:0">Tudo que soma PV, VB, Fé ou Evasiva entra aqui e vai direto para os totais da Frente.</p>${listHTML("bon")}</div>
  <div><div class="sec">Equipamento</div><p class="tip" style="margin-top:0">Marque "Usa" para o bônus do item entrar nos totais.</p>${listHTML("eq")}
   <div class="g g2" style="margin-top:10px">${F("griv","Grívnias (G)")}${F("cargaTot","Carga total / máx.")}</div>
   <div class="sec">Ofícios</div>${listHTML("ofi")}</div>
 </div>
</div></div>

<div class="tabp" data-p="2"><div class="panel">
 <div class="sec">Ressonância</div>
 <div class="g g2">${F("res.nome","Nome da Ressonância")}${F("res.img","Imagem (fogo, fio, espelho…)")}${F("res.raiz","Ferida, desejo ou promessa")}${F("res.lim","O que ela nunca consegue fazer")}</div>
 <div class="febar"><b>Fé</b><span id="gFe"></span><div class="bar" style="--c:var(--fe)"><div id="gFeBar"></div></div><span class="tip" id="reserva" style="margin:0"></span></div>
 <div class="bar2" style="margin-top:14px"><h2 style="font-size:22px">Grimório</h2>
  <input id="gQ" placeholder="Buscar poder…" style="width:200px"><select id="gT" style="width:150px"><option value="">Todos os graus</option>${GRAUS.map(g=>`<option>${g}</option>`).join("")}</select>
  <span class="edit-only" style="display:flex;gap:6px;flex-wrap:wrap"><label class="btn" id="lImpG">Importar grimório<input id="fImpG" type="file" accept=".json,application/json" hidden></label><button type="button" class="primary" id="bNewPow">+ Novo poder</button></span></div>
 <div class="tip" style="margin:0 0 10px">Custos: Truque 2–5 · Menor 6–10 · Comum 12–18 (nv. 5) · Forte 20–30 (nv. 10) · Decisivo 35–50 (nv. 20) · Final 55–75 (nv. 30). Custo ≈ Fé máxima ÷ usos desejados. Passivos reservam Fé enquanto ligados.</div>
 <div id="gGrid" class="pgrid"></div>
</div></div>

<div class="tabp" data-p="3"><div class="panel">
 <div class="p3"><div><div class="port" id="port" title="Clique para escolher uma imagem">Retrato</div><input type="file" id="fPort" accept="image/*" hidden><button type="button" class="edit-only" id="bPortDel" style="margin-top:6px;width:100%">Remover retrato</button>
  <div style="margin-top:10px">${T("marca","Marca de nascença",80)}</div></div>
  <div class="g">${F("conceito","Conceito (uma frase)")}<div class="g g2">${F("idade","Idade")}${F("altura","Altura e porte")}</div>${T("aparencia","Aparência")}${T("personalidade","Personalidade")}</div></div>
 <div class="g g2" style="margin-top:12px">${T("medos","Medos")}${T("desejos","Desejos e objetivos")}</div>
 <div style="margin-top:12px">${T("historia","História",200)}</div>
 <div class="g g2" style="margin-top:12px">${T("aliados","Aliados, contatos e rivais",140)}${T("notas","Anotações",140)}</div>
</div></div>

<div class="tabp edit-only" data-p="4"><div class="panel">
 <div class="note">O jeito mais fácil é a <b>mesa ao vivo</b>: clique em <b>🎲 Entrar na mesa</b> no topo da ficha e digite o código que o mestre passou. O mestre vê sua ficha atualizada na hora. O código abaixo é para quando não dá para jogar ao vivo.</div>
 <div class="g g2">
  <div><div class="sec">1 · Chave da mesa</div><p style="margin-top:0">Abra o link de convite do mestre ou cole a chave aqui.</p>
   <input data-k="mesa" placeholder="MESA.…" spellcheck="false"><div class="tip" id="mesaFp"></div></div>
  <div><div class="sec">2 · Enviar a ficha</div><p style="margin-top:0">Gera um código que <b>só o mestre consegue abrir</b>.</p>
   <button type="button" class="primary" id="bSend">Gerar código para o mestre</button>
   <div id="sendOut" class="hidden" style="margin-top:10px"><div class="code" id="sendCode"></div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button type="button" id="bCopyLink">Copiar link</button><button type="button" id="bCopyCode">Copiar código</button><button type="button" id="bDlEly">Baixar arquivo .ely</button></div></div></div>
 </div>
 <div class="sec">Segurança</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="bBackup">Baixar backup (trancado com sua senha)</button><button type="button" id="bPass">Mudar senha</button><button type="button" class="danger" id="bDel">Excluir ficha deste navegador</button></div>
 <p class="tip">O backup serve para levar a ficha a outro aparelho: importe em "Minhas fichas" e abra com a mesma senha.</p>
</div></div>`}

/* ================= FICHA: LIGAÇÃO ================= */
function getP(o,p){return p.split(".").reduce((a,k)=>a==null?a:a[k],o)}
function setP(o,p,v){const ks=p.split(".");const l=ks.pop();const t=ks.reduce((a,k)=>a[k],o);t[l]=v}
function mountSheet(host,S,ro,onChange){
 const R=document.createElement("div");R.innerHTML=sheetHTML();R.classList.toggle("ro",!!ro);host.replaceChildren(R);
 const q=s=>R.querySelector(s);
 const fill=()=>{R.querySelectorAll("[data-k]").forEach(el=>{if(el===document.activeElement)return;const v=getP(S,el.dataset.k);if(el.type==="checkbox")el.checked=!!v;else el.value=v??""});
  Object.keys(LISTS).forEach(drawList);R.querySelectorAll("[data-dots]").forEach(drawDots);drawPort();drawConds();calc();drawGrim()};
 function drawList(key){const box=q(`[data-list="${key}"] .rows`);if(!box)return;const arr=S[key]||[];
  box.innerHTML=arr.length?arr.map((r,i)=>rowHTML(key,i,r)).join(""):(ro?`<div class="tip">—</div>`:"")}
 function drawDots(el){const [i,k]=el.dataset.dots.split(".");const v=S.arv[i][k]||0,max=+el.dataset.max;
  el.innerHTML=Array.from({length:max},(_,j)=>`<button type="button" class="dot ${j<v?"on":""} ${k==="s"&&j===max-1?"apex":""}" data-dot="${i}.${k}" data-v="${j+1}" aria-label="${j+1}"></button>`).join("")+`<span class="tip" style="margin:0 0 0 4px">${v}/${max}</span>`}
 function drawPort(){const p=q("#port");if(S.retrato){p.style.backgroundImage=`url("${S.retrato}")`;p.textContent=""}else{p.style.backgroundImage="";p.textContent="Retrato"}}
 function drawConds(){const act=Object.entries(S.cond||{});
  q("#condAct").innerHTML=act.length?act.map(([n,L])=>{const ci=condInfo(S,n);const max=ci.max||num(S.condMax)||5;
   return `<div class="cact ${ci.custom?"custom":""}"><div class="ch1"><b>${esc(n)}</b>${ci.lv?`<span class="lvl"><button type="button" class="edit-only" data-cl="${esc(n)}" data-d="-1">−</button><em>${L}</em><small>/${max}</small><button type="button" class="edit-only" data-cl="${esc(n)}" data-d="1">+</button></span>`:""}<button type="button" class="x edit-only" data-cx="${esc(n)}" title="Remover">×</button></div><div class="ctx">${esc(ci.txt)}</div></div>`}).join(""):`<div class="tip" style="margin:0">Nenhuma condição ativa.</div>`;
  q("#condCustom").innerHTML=(S.ccustom||[]).map((c,i)=>`<span class="chip ${c.lv?"lv":""}" data-cadd="${esc(c.n)}" title="${esc(c.e)}">${esc(c.n)}${c.lv?" <i>Nv.</i>":""}</span><button type="button" class="mini-x edit-only" data-cdel="${i}" title="Apagar condição da casa">×</button>`).join("")||`<span class="tip" style="margin:0">Nenhuma ainda.</span>`;
  R.querySelectorAll("[data-cadd]").forEach(c=>c.classList.toggle("on",!!S.cond[c.dataset.cadd]))}
 function calc(){const d=D(S);
  ATR.forEach(([k])=>{q(`[data-mod="${k}"]`).textContent=sg(mod(S.atr[k]))});
  PER.forEach(([n])=>{const p=d.per[n];const o=q(`[data-pt="${n}"]`);o.textContent=sg(p.tot);o.classList.toggle("pen",p.pen<0);o.title=p.pen?`Penalidade ${p.pen}`:"";q(`[data-pa="${n}"]`).textContent=sg(p.m);q(`[data-pr="${n}"]`).textContent=p.t?"+"+p.t:"—"});
  const ag=mod(S.atr.agi);q("#evaA").textContent=sg(ag);const ev=q("#evaT");ev.textContent=d.eva;ev.classList.toggle("pen",d.eva<d.evaBase);ev.title=d.eva!==d.evaBase?`Sem penalidades: ${d.evaBase}`:"";
  const mx={pv:d.pvM,vb:d.vbM,fe:d.feU};const bn={pv:d.bon.pv,vb:d.bon.vb+d.aV+d.eV,fe:d.bon.fe};
  ["pv","vb","fe"].forEach(k=>{const a=num(S[k].a),m=mx[k];q(`[data-max="${k}"]`).textContent=m||"—";q(`[data-bar="${k}"]`).style.width=(m>0?Math.max(0,Math.min(100,a/m*100)):0)+"%";
   q(`[data-bonus="${k}"]`).textContent=(bn[k]?`${sg(bn[k])} de ${k==="vb"?"armadura e itens":"itens e bônus"}`:"")+(k==="fe"&&d.rsv?` · ${d.rsv} reservada`:"")});
  q("#bIni").textContent=sg(d.per.Iniciativa.tot)+" 🎲";
  q("#deslE").textContent=d.desl!==(num(S.desl)||9)?`agora: ${d.desl} m`:"";q("#cdE").textContent=S.cd!==""&&d.fx.cd?`agora: ${d.cd}`:"";
  const lim=num(S.limiar);R.querySelectorAll("[data-lim]").forEach(b=>b.classList.toggle("on",+b.dataset.lim<=lim));q("#limN").textContent=lim?LIMIAR[lim].n:"";q("#limT").textContent=LIMIAR[lim].txt;
  ["arm","esc"].forEach(k=>{const st=armState(S[k]);const e=q(`[data-astate="${k}"]`);e.textContent=st?(st==="inteira"?`dá ${armEff(S[k])} VB`:st==="avariada"?`avariada: dá ${armEff(S[k])} VB`:"quebrada: 0 VB"):"";e.className="astate "+st});
  const f=d.fx,pens=[];if(f.test)pens.push(`${f.test} em ataques e testes`);if(f.per)pens.push(`${f.per} em perícias`);if(f.atk)pens.push(`${f.atk} só em ataques`);
  for(const k in f.attr)pens.push(`${f.attr[k]} em testes de ${AB[k]}`);for(const k in f.perOnly)pens.push(`${f.perOnly[k]} em ${k}`);
  if(d.eva!==d.evaBase)pens.push(`Evasiva ${d.evaBase} → ${d.eva}`);if(d.desl!==(num(S.desl)||9))pens.push(`deslocamento ${d.desl} m`);if(f.dano)pens.push(`${f.dano} no dano`);if(f.sofre)pens.push(`+${f.sofre} em todo dano sofrido`);if(f.cd)pens.push(`${f.cd} na CD`);if(f.noR)pens.push("sem reações");
  f.dots.forEach(x=>pens.push(`início do turno: ${x.expr} (${x.n})`));
  q("#penBox").innerHTML=pens.length?`<b>Valendo agora:</b> ${pens.map(esc).join(" · ")}`:"";q("#penBox").classList.toggle("hidden",!pens.length);
  q("#reserva").textContent=d.rsv?`${d.rsv} reservada por passivos · máx. disponível ${d.feU}`:"";
  q("#gFe").textContent=`${S.fe.a===""?"—":num(S.fe.a)} / ${d.feU||"—"}`;q("#gFeBar").style.width=(d.feU>0?Math.max(0,Math.min(100,num(S.fe.a)/d.feU*100)):0)+"%";
  const fp=q("#mesaFp");if(fp){const raw=parseMesa(S.mesa);if(!S.mesa)fp.textContent="Nenhuma mesa ainda.";else if(!raw)fp.textContent="Essa chave não parece válida.";else fingerprint(raw).then(x=>fp.textContent="Mesa "+x)}}
 const changed=(redraw)=>{if(redraw)fill();else calc();onChange&&onChange()};
 R.refill=()=>fill();
 R.addEventListener("click",async e=>{const t=e.target.closest("button,[data-cadd],[data-ratr]")||e.target;
  if(t.dataset.tab!==undefined){R.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("on",b===t));R.querySelectorAll(".tabp").forEach(p=>p.classList.toggle("on",p.dataset.p===t.dataset.tab));return}
  if(ro)return;
  if(t.dataset.rper){const r=ACT.rollPer(S,t.dataset.rper);if(r)fxAt(t,"#b48a3c",.4);return}
  if(t.dataset.ratr){const r=ACT.roll(S,"1d20"+sg(mod(S.atr[t.dataset.ratr])+D(S).fx.test+(D(S).fx.attr[t.dataset.ratr]||0)),"teste de "+AB[t.dataset.ratr]);if(r)fxAt(t,"#b48a3c",.4);return}
  if(t.dataset.ratk!==undefined){const r=ACT.rollAtk(S,+t.dataset.ratk);if(r)fxAt(t,"#8e1b1b",.6);return}
  if(t.id==="bIni"){const r=ACT.rollPer(S,"Iniciativa");if(r){emit("init",{val:r.total});fxAt(t,"#b48a3c",.4)}return}
  if(t.id==="bFree"){const v=q("#freeR").value;if(v){ACT.roll(S,v,"rolagem livre");fxAt(t,"#b48a3c",.4)}return}
  if(t.dataset.cadd){const n=t.dataset.cadd;if(S.cond[n])ACT.setCond(S,n,0);else ACT.setCond(S,n,1);changed(true);return}
  if(t.dataset.cl){ACT.setCond(S,t.dataset.cl,num(S.cond[t.dataset.cl])+ +t.dataset.d);changed(true);return}
  if(t.dataset.cx){ACT.setCond(S,t.dataset.cx,0);changed(true);return}
  if(t.dataset.cdel!==undefined){const c=S.ccustom[+t.dataset.cdel];if(!await ask("Apagar condição da casa",`<p style="margin:0">Apagar <b>${esc(c.n)}</b>?</p>`,"Apagar"))return;delete S.cond[c.n];S.ccustom.splice(+t.dataset.cdel,1);changed(true);return}
  if(t.id==="bCondNew"){const c=await condDlg();if(!c)return;S.ccustom.push(c);changed(true);return}
  if(t.dataset.lim){const v=+t.dataset.lim;S.limiar=num(S.limiar)===v?v-1:v;changed();return}
  if(t.dataset.rest){ACT.rest(S,t.dataset.rest);fxAt(t,"#2f6b3a",.7);changed(true);return}
  if(t.id==="bDmg"){const e2=ACT.damage(S,{v:q("#dmgV").value,tipo:q("#dmgT").value,resist:q("#dmgR").checked,crit:q("#dmgC").checked});if(e2){q("#dmgV").value="";q("#dmgR").checked=q("#dmgC").checked=false;toast(e2.text);fxAt(t,"#8e1b1b",.5);changed(true)}return}
  if(t.id==="bHeal"){ACT.heal(S,{v:q("#healV").value,alvo:q("#healT").value});q("#healV").value="";fxAt(t,"#2f6b3a",.5);changed(true);return}
  if(t.id==="bTurn"){ACT.turnStart(S);changed(true);return}
  if(t.dataset.ares){const a=S[t.dataset.ares];const rm=num(a.rm);a.res=Math.max(0,Math.min(rm||99,(a.res===""?rm:num(a.res))+ +t.dataset.d));changed(true);return}
  if(t.dataset.arep){const a=S[t.dataset.arep];a.res=a.rm;changed(true);toast("Reparada.");return}
  if(t.dataset.dot){const [i,k]=t.dataset.dot.split(".");const v=+t.dataset.v;S.arv[i][k]=S.arv[i][k]===v?v-1:v;drawDots(t.parentElement);changed();return}
  if(t.dataset.pm){const k=t.dataset.pm;S[k].a=Math.max(0,num(S[k].a)+ +t.dataset.d);clampRes(S);q(`[data-k="${k}.a"]`).value=S[k].a;changed();return}
  if(t.classList.contains("add")){const key=t.closest("[data-list]").dataset.list;S[key].push({});drawList(key);changed();const rows=R.querySelectorAll(`[data-list="${key}"] .lr`);rows[rows.length-1]?.querySelector("input,textarea,select")?.focus();return}
  if(t.dataset.del){S[t.dataset.del].splice(+t.dataset.i,1);drawList(t.dataset.del);changed();return}
  if(t.id==="port")q("#fPort").click();
  else if(t.id==="bPortDel"){S.retrato="";drawPort();changed()}});
 const onIn=e=>{if(ro)return;const t=e.target;if(!t.dataset.k&&!t.dataset.l)return;const v=t.type==="checkbox"?t.checked:t.value;
  if(t.dataset.k){setP(S,t.dataset.k,v);changed()}else{S[t.dataset.l][+t.dataset.i][t.dataset.c]=v;changed()}};
 R.addEventListener("input",onIn);R.addEventListener("change",onIn);
 q("#freeR").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();q("#bFree").click()}});
 q("#fPort").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;S.retrato=await shrink(f,260);drawPort();changed();e.target.value=""});
 function drawGrim(){const qq=q("#gQ").value.toLowerCase(),t=q("#gT").value;
  const L=S.pod.filter(p=>(!t||p.grau===t)&&(!qq||JSON.stringify(p).toLowerCase().includes(qq)));
  q("#gGrid").innerHTML=L.length?L.map(p=>`<article class="pcard" style="--tier:var(--t-${GRAUS.includes(p.grau)?p.grau:"x"})">
  <div class="ph"><div><div class="tier">${p.tipo==="Passivo"?"Passivo"+(p.ligado?" · ligado":" · desligado")+" · ":""}${esc(p.grau||"Sem grau")}${p.freq?" · "+esc(p.freq):""}</div><h3>${esc(p.nome||"Sem nome")}</h3></div><span class="cost">${p.tipo==="Passivo"?"reserva ":""}${esc(p.custo||0)} Fé</span></div>
  <div class="meta"><div><b>Ação</b>${esc(p.acao||"—")}</div><div><b>Alcance</b>${esc(p.alcance||"—")}</div><div><b>Teste</b>${esc(p.teste||"—")}</div><div><b>Rolagem</b>${esc(p.rolagem||"—")}</div></div>
  <div class="pbody"><p>${esc(p.efeito)}</p>${p.limite?`<p><span class="lbl">Limite.</span> ${esc(p.limite)}</p>`:""}${p.evolucao?`<p><span class="lbl">Evolução.</span> ${esc(p.evolucao)}</p>`:""}${p.duracao?`<p><span class="lbl">Duração.</span> ${esc(p.duracao)}</p>`:""}
  ${p.asc_nome||p.asc_efeito?`<div class="asc"><span class="lbl">Ascendido${p.asc_nivel?" · nível "+esc(p.asc_nivel):""}</span><b>${esc(p.asc_nome)}</b><p>${esc(p.asc_efeito)}</p></div>`:""}</div>
  <div class="pf edit-only"><button type="button" class="use" data-puse="${p.id}">${p.tipo==="Passivo"?(p.ligado?"Desligar":"Ligar"):`✦ Usar (−${esc(p.custo||0)} Fé)`}</button><button type="button" data-psom="${p.id}" title="Som e efeito">🔊</button><button type="button" data-pedit="${p.id}">Editar</button><button type="button" data-pdup="${p.id}">Duplicar</button><button type="button" data-pdel="${p.id}">Excluir</button></div></article>`).join("")
  :`<div class="empty">${S.pod.length?"Nenhum poder com esse filtro.":ro?"Nenhum poder ainda.":"Nenhum poder ainda. Clique em <b>+ Novo poder</b> para escrever o primeiro."}</div>`}
 q("#gQ").addEventListener("input",e=>{e.stopPropagation();drawGrim()});q("#gT").addEventListener("change",e=>{e.stopPropagation();drawGrim()});
 q("#gGrid").addEventListener("click",async e=>{if(ro)return;const b=e.target.closest("button");if(!b)return;e.stopPropagation();
  const id=+(b.dataset.puse||b.dataset.psom||b.dataset.pedit||b.dataset.pdup||b.dataset.pdel);const p=S.pod.find(x=>x.id===id);if(!p)return;
  if(b.dataset.puse){const r=ACT.usePower(S,id);if(r&&p.tipo!=="Passivo"){fxAt(b,GRAU_COR[p.grau]||"#d9b86a",1);const card=b.closest(".pcard");card.classList.add("cast");setTimeout(()=>card.classList.remove("cast"),700)}if(!r)return;q('[data-k="fe.a"]').value=S.fe.a}
  if(b.dataset.psom){await soundDlg(S,p);changed();return}
  if(b.dataset.pedit){const d=await powDlg(p);if(!d)return;Object.assign(p,d)}
  if(b.dataset.pdup)S.pod.push({...p,id:Date.now(),nome:p.nome+" (cópia)"});
  if(b.dataset.pdel){if(!await ask("Excluir poder",`<p style="margin:0">Excluir <b>${esc(p.nome)}</b>?</p>`,"Excluir"))return;S.pod=S.pod.filter(x=>x!==p);delete S.sons[p.id]}
  drawGrim();changed()});
 if(!ro){q("#bNewPow").onclick=async()=>{const d=await powDlg(null);if(!d)return;S.pod.push({id:Date.now(),ligado:false,...d});drawGrim();changed()};
  q("#fImpG").addEventListener("change",async e=>{e.stopPropagation();const f=e.target.files[0];e.target.value="";if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.poderes))throw 0;importGrim(d)}catch(_){toast("Esse arquivo não é um grimório.")}})}
 function importGrim(d){d.poderes.forEach((p,i)=>{const o={id:Date.now()+i};PF.forEach(k=>o[k]=p[k]??"");o.ligado=!!p.ligado;S.pod.push(o)});
  if(!S.res.nome&&d.res_nome){S.res={nome:d.res_nome||"",raiz:d.res_raiz||"",img:d.res_img||"",lim:d.res_lim||""}}
  fill();changed();toast(d.poderes.length+" poderes adicionados.")}
 fill();
 return R}
function condDlg(){return ask("Condição da casa",`<div class="pg">
 <div class="s3"><label>Nome</label><input name="n" required placeholder="Ex.: Congelado"></div><div><label>Tem nível?</label><label class="ck"><input type="checkbox" name="lv" checked> sim</label></div>
 <div class="s4"><label>Efeito</label><textarea name="e" rows="2" placeholder="O que acontece e quanto cada nível soma."></textarea></div>
 <div><label>Nível máximo</label><input name="max" type="number" min="1" placeholder="mesa"></div><div><label>−Testes por nível</label><input name="t" type="number" min="0" value="0"></div><div><label>−Evasiva por nível</label><input name="ev" type="number" min="0" value="0"></div><div><label>Dano no turno</label><input name="dot" placeholder="1d6"></div>
 <div class="s2"><label>O dano no turno vai para</label><select name="dotT"><option value="normal">VB e depois PV</option><option value="pv">direto nos PV</option></select></div></div>
 <p class="tip">Mostre ao mestre: ele aprova ou ajusta. Use as condições oficiais como régua.</p>`,"Criar",v=>{if(!v.n.trim())return{err:"Dê um nome."};if(v.dot&&!/^\d*d\d+([+-]\d+)?$/i.test(v.dot.trim()))return{err:"Dano no turno: use algo como 1d6 ou 2d4+1."};return{n:v.n.trim(),lv:v.lv,e:v.e,max:v.max,t:v.t,ev:v.ev,dot:v.dot.trim(),dotT:v.dotT}},true)}
function powDlg(p){const v=k=>esc(p?p[k]??"":"");const sel=(k,ops)=>`<select name="${k}">${ops.map(o=>{const [val,lab]=Array.isArray(o)?o:[o,o];return `<option value="${esc(val)}" ${p&&p[k]===val?"selected":""}>${esc(lab)}</option>`}).join("")}</select>`;
 return ask(p?"Editar poder":"Novo poder",`<div class="pg">
 <div class="s3"><label>Nome</label><input name="nome" required value="${v("nome")}" placeholder="Ex.: Brasa da Promessa"></div><div><label>Custo (Fé)</label><input name="custo" type="number" min="0" value="${v("custo")}"></div>
 <div class="s2"><label>Grau</label>${sel("grau",["",...GRAUS])}<div class="tip" id="tHint"></div></div><div><label>Tipo</label>${sel("tipo",["Ativo","Passivo"])}</div><div><label>Ação</label>${sel("acao",["Ação","Ação rápida","Movimento","Reação","Livre","Passiva"])}</div>
 <div><label>Alcance</label><input name="alcance" value="${v("alcance")}" placeholder="Curto (9 m)"></div><div><label>Teste / CD</label><input name="teste" value="${v("teste")}" placeholder="Espírito vs. Evasiva"></div><div><label>Rolagem</label><input name="rolagem" value="${v("rolagem")}" placeholder="1d8+Esp"></div><div><label>Som</label>${sel("som",SONS.filter(s=>s[0]!=="proprio").concat([["proprio","Meu som (🔊 no card)"]]))}</div>
 <div class="s2"><label>Duração</label><input name="duracao" value="${v("duracao")}" placeholder="Instantânea"></div><div class="s2"><label>Frequência</label><input name="freq" value="${v("freq")}" placeholder="1/cena"></div>
 <div class="s4"><label>Efeito</label><textarea name="efeito" rows="3" placeholder="Descreva livremente o que acontece.">${v("efeito")}</textarea></div>
 <div class="s2"><label>Limite</label><textarea name="limite" rows="2">${v("limite")}</textarea></div><div class="s2"><label>Evolução</label><textarea name="evolucao" rows="2">${v("evolucao")}</textarea></div>
 <div class="s4 ascb"><div><label>Nome ascendido</label><input name="asc_nome" value="${v("asc_nome")}"></div><div><label>Nível</label><input name="asc_nivel" type="number" min="25" max="50" value="${v("asc_nivel")}"></div><div class="s2w"><label>Novo efeito (ascendido)</label><textarea name="asc_efeito" rows="2">${v("asc_efeito")}</textarea></div></div></div>`,"Salvar poder",vals=>{if(vals.rolagem){const r=rollExpr(vals.rolagem,blank());if(r&&r.err)return{err:"Rolagem: "+r.err+". Use algo como 2d8+Esp+1."}}return vals},true)}
function soundDlg(S,p){return ask("Som e efeito de "+(p.nome||"poder"),`<div><label>Som</label><select name="som">${SONS.map(([k,n])=>`<option value="${k}" ${(p.som||"brilho")===k?"selected":""}>${n}</option>`).join("")}</select></div>
 <div id="sndFile"><label>Arquivo de som (até 600 KB: mp3, ogg, wav)</label><input type="file" accept="audio/*" id="sndIn"><div class="tip" id="sndInfo">${S.sons&&S.sons[p.id]?"Você já tem um som próprio salvo.":"Nenhum som próprio ainda."}</div></div>
 <button type="button" id="sndTest">▶ Testar</button><p class="tip">O som toca para você. Na mesa ao vivo, os outros ouvem o som escolhido; sons próprios tocam só no seu aparelho.</p>`,"Salvar",async v=>{
  const f=$("#sndIn").files[0];if(f){if(f.size>600*1024)return{err:"Arquivo grande demais (máx. 600 KB)."};S.sons[p.id]=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(f)});v.som="proprio"}
  if(v.som==="proprio"&&!S.sons[p.id])return{err:"Escolha um arquivo de som."};p.som=v.som;return v},false,d=>{
  d.querySelector("#sndTest").onclick=async()=>{const k=d.querySelector("[name=som]").value;const f=d.querySelector("#sndIn").files[0];if(k==="proprio"&&f){playSound("proprio",URL.createObjectURL(f))}else playSound(k,S.sons&&S.sons[p.id]);fxAt(d.querySelector("#sndTest"),GRAU_COR[p.grau]||"#d9b86a",.6)}})}
function shrink(file,max,q=.72){return new Promise((ok,bad)=>{const img=new Image();img.onload=()=>{const r=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);ok(c.toDataURL("image/jpeg",q))};img.onerror=bad;img.src=URL.createObjectURL(file)})}

/* ================= JOGADOR ================= */
const PK="elyndor-fichas-v1";
const store=()=>LS.get(PK)||{list:[]};
let cur=null,curR=null;
let pendingMesa=null,pendingSala=null;
function view(v){["vList","vSheet","vMaster","vMesa"].forEach(x=>$("#"+x).classList.toggle("hidden",x!==v));document.body.classList.toggle("inmesa",v==="vMesa");$("#navP").classList.toggle("on",v==="vList"||v==="vSheet");$("#navM").classList.toggle("on",v==="vMaster")}
function drawPList(){const L=store().list;$("#pList").innerHTML=L.length?L.map(p=>`<div class="card click" data-open="${p.id}"><div class="ch"><h3><svg class="lock" viewBox="0 0 16 16"><path fill="#ecd39b" d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z"/></svg>${esc(p.label||"Sem nome")}</h3><small>Atualizada em ${when(p.upd)}</small></div><div class="cb2">Ficha trancada. Clique para abrir com a senha.</div></div>`).join(""):`<div class="empty">Nenhuma ficha neste navegador ainda. Clique em <b>+ Criar personagem</b>. Não precisa de convite.</div>`;
 $("#salaBanner").classList.toggle("hidden",!pendingSala);if(pendingSala)$("#salaBannerCode").textContent=pendingSala}
$("#pList").addEventListener("click",e=>{const c=e.target.closest("[data-open]");if(c)unlock(c.dataset.open)});
async function unlock(id){const ent=store().list.find(p=>p.id===id);if(!ent)return;
 const r=await ask("Abrir "+(ent.label||"ficha"),`<div><label>Senha</label><input name="p" type="password" autocomplete="current-password" required></div>`,"Abrir",async v=>{
  const key=await passKey(v.p,b64d(ent.salt));try{const S=await openPass(key,ent.iv,ent.ct);return{key,S}}catch(e){return{err:"Senha errada."}}});
 if(!r)return;cur={id,key:r.key,salt:ent.salt,S:fix(r.S)};openSheet()}
$("#bNew").onclick=async()=>{const r=await ask("Criar personagem",`<div><label>Nome do personagem</label><input name="n" required></div><div><label>Senha</label><input name="p" type="password" autocomplete="new-password" required minlength="4"></div><div><label>Repita a senha</label><input name="p2" type="password" autocomplete="new-password" required></div><div class="tip">A senha tranca a ficha neste navegador. Guarde bem: ela não pode ser recuperada.</div>`,"Criar",async v=>{
  if(v.p.length<4)return{err:"Use pelo menos 4 caracteres."};if(v.p!==v.p2)return{err:"As senhas não batem."};
  const salt=rnd(16);return{key:await passKey(v.p,salt),salt:b64e(salt),n:v.n}});
 if(!r)return;cur={id:uid(),key:r.key,salt:r.salt,S:blank(r.n)};await saveNow();openSheet()};
let saveT=null;
function saveSoon(){$("#sStatus").textContent="Salvando…";clearTimeout(saveT);saveT=setTimeout(saveNow,500);emit("sheet",cur&&cur.S)}
async function saveNow(){if(!cur)return;const {iv,ct}=await sealPass(cur.key,cur.S);const st=store();const e={id:cur.id,label:cur.S.nome,salt:cur.salt,iv,ct,upd:Date.now()};
 const i=st.list.findIndex(p=>p.id===cur.id);if(i<0)st.list.push(e);else st.list[i]=e;if(LS.set(PK,st))$("#sStatus").innerHTML=`<svg class="lock" viewBox="0 0 16 16"><path fill="#2f6b3a" d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z"/></svg>Salvo e criptografado`}
function sheetChanged(){if(!cur)return;if(curR&&document.contains(curR))curR.refill();saveSoon()}
let lastCode="";
function openSheet(){view("vSheet");$("#sTitle").textContent=cur.S.nome||"Ficha";
 if(pendingMesa){cur.S.mesa=pendingMesa;pendingMesa=null;toast("Chave da mesa adicionada a esta ficha.");saveSoon()}
 const R=curR=mountSheet($("#sheetHost"),cur.S,false,()=>{$("#sTitle").textContent=cur.S.nome||"Ficha";$("#sendOut").classList.add("hidden");saveSoon()});
 $("#sStatus").textContent="Aberta";
 if(pendingSala){const c=pendingSala;pendingSala=null;setTimeout(()=>joinMesa(c),50)}
 R.querySelector("#bSend").onclick=async()=>{const raw=parseMesa(cur.S.mesa);if(!raw){toast("Primeiro coloque a chave da mesa (passo 1).");return}
  lastCode=await sealForMaster(raw,{id:cur.id,t:Date.now(),s:shareable(cur.S)});$("#sendCode").textContent=lastCode;$("#sendOut").classList.remove("hidden");
  if(lastCode.length>60000)toast("Código grande por causa do retrato. Se o app cortar o link, mande o arquivo .ely.")};
 R.querySelector("#bCopyLink").onclick=()=>copy(location.href.split("#")[0]+"#m="+lastCode,"Link copiado. Mande só para o mestre.");
 R.querySelector("#bCopyCode").onclick=()=>copy(lastCode,"Código copiado.");
 R.querySelector("#bDlEly").onclick=()=>download((cur.S.nome||"ficha").replace(/[^\w\-À-ú ]+/g,"").trim()+".ely",lastCode);
 R.querySelector("#bBackup").onclick=()=>{const e=store().list.find(p=>p.id===cur.id);download((cur.S.nome||"ficha")+"-backup.json",JSON.stringify({elyndorFicha:1,...e}))};
 R.querySelector("#bPass").onclick=async()=>{const r=await ask("Mudar senha",`<div><label>Senha atual</label><input name="o" type="password" required></div><div><label>Nova senha</label><input name="p" type="password" required></div><div><label>Repita a nova senha</label><input name="p2" type="password" required></div>`,"Mudar",async v=>{
   const k=await passKey(v.o,b64d(cur.salt));const e=store().list.find(p=>p.id===cur.id);try{await openPass(k,e.iv,e.ct)}catch(_){return{err:"Senha atual errada."}}
   if(v.p.length<4)return{err:"Use pelo menos 4 caracteres."};if(v.p!==v.p2)return{err:"As senhas não batem."};const s=rnd(16);return{key:await passKey(v.p,s),salt:b64e(s)}});
  if(!r)return;cur.key=r.key;cur.salt=r.salt;await saveNow();toast("Senha trocada.")};
 R.querySelector("#bDel").onclick=async()=>{const r=await ask("Excluir ficha",`<p style="margin:0">Isso apaga <b>${esc(cur.S.nome||"esta ficha")}</b> deste navegador. Digite <b>EXCLUIR</b> para confirmar.</p><input name="x" required>`,"Excluir",async v=>v.x.trim().toUpperCase()==="EXCLUIR"?v:{err:"Digite EXCLUIR."});
  if(!r)return;const st=store();st.list=st.list.filter(p=>p.id!==cur.id);LS.set(PK,st);cur=null;drawPList();view("vList")}}
$("#bLock").onclick=async()=>{if(window.MESA&&MESA.active)MESA.leave();clearTimeout(saveT);await saveNow();cur=null;curR=null;$("#sheetHost").innerHTML="";drawPList();view("vList")};
$("#bJoin").onclick=()=>joinMesa();
async function joinMesa(code){if(!cur)return;const r=code?{c:code}:await ask("Entrar na mesa",`<div><label>Código da mesa</label><input name="c" required value="${esc(cur.S.sala||"")}" placeholder="ex.: K7Q2XM" style="text-transform:uppercase;font-size:22px;letter-spacing:.15em;text-align:center"></div><p class="tip">Peça o código ao mestre. Ele aparece no topo da mesa dele.</p>`,"Entrar",v=>{const c=v.c.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");return c.length<4?{err:"Código curto demais."}:{c}});
 if(!r)return;cur.S.sala=r.c;saveSoon();MESA.joinAsPlayer(r.c)}
$("#fBackup").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{const d=JSON.parse(await f.text());if(!d.elyndorFicha||!d.ct)throw 0;
 const st=store();const i=st.list.findIndex(p=>p.id===d.id);const ent={id:d.id,label:d.label,salt:d.salt,iv:d.iv,ct:d.ct,upd:d.upd};if(i<0)st.list.push(ent);else st.list[i]=ent;LS.set(PK,st);drawPList();toast("Backup importado. Abra com a sua senha.")}catch(_){toast("Esse arquivo não é um backup de ficha.")}};
$("#navP").onclick=()=>{if(window.MESA&&MESA.active){MESA.show(false)}if(cur)view("vSheet");else{drawPList();view("vList")}};
$("#bMute").onclick=()=>{LS.set("elyndor-mudo",!muted());$("#bMute").textContent=muted()?"🔇":"🔊";if(!muted())playSound("brilho")};$("#bMute").textContent=muted()?"🔇":"🔊";
$("#logPanel .lh2").onclick=()=>$("#logPanel").classList.toggle("open");

/* ================= MESTRE (códigos offline) ================= */
const MK="elyndor-mesa-v1";
let M=null;
const mstore=()=>LS.get(MK);
function masterCard(id,s,t,live){s=fix(JSON.parse(JSON.stringify(s)));const d=D(s);const bar=(k,lab,a,m)=>`<span>${lab}</span><div class="bar" style="--c:var(--${k})"><div style="width:${m>0?Math.max(0,Math.min(100,a/m*100)):0}%"></div></div><b>${a}/${m||"—"}</b>`;
 const conds=Object.entries(s.cond||{});
 return `<div class="card"><div class="ch click" data-read="${id}"><h3>${esc(s.nome||"Sem nome")}${live?' <span class="live">ao vivo</span>':""}</h3><small>${esc(s.jogador||"")}${s.jogador?" · ":""}${esc(s.signo||"sem signo")} · nível ${esc(s.nivel)}</small></div>
  <div class="cb2 click" data-read="${id}"><div class="mini">${bar("pv","PV",num(s.pv.a),d.pvM)}${bar("vb","VB",num(s.vb.a),d.vbM)}${bar("fe","Fé",num(s.fe.a),d.feU)}</div>
  <div style="margin-top:8px;font-size:13px">Evasiva <b>${d.eva}</b> · CD <b>${esc(d.cd===""?"—":d.cd)}</b> · Ini. <b>${sg(d.per.Iniciativa.tot)}</b> · Limiar <b>${num(s.limiar)}/5</b>${armState(s.arm)&&armState(s.arm)!=="inteira"?` · armadura <b>${armState(s.arm)}</b>`:""}</div>
  <div class="chips" style="margin-top:6px">${conds.length?conds.map(([c,l])=>`<span class="chip on">${esc(c)}${condInfo(s,c).lv?" "+l:""}</span>`).join(""):`<span class="tip" style="margin:0">Sem condições</span>`}</div>
  ${t?`<div class="tip">${live?"Atualizada":"Recebida"} em ${when(t)}</div>`:""}</div></div>`}
function drawMaster(){const st=mstore();["mSetup","mLocked","mOpen"].forEach(x=>$("#"+x).classList.add("hidden"));$("#bMLock").classList.toggle("hidden",!M);
 if(!st){$("#mSetup").classList.remove("hidden");$("#mStatus").textContent="";return}
 if(!M){$("#mLocked").classList.remove("hidden");$("#mStatus").textContent="";return}
 $("#mOpen").classList.remove("hidden");$("#mRead").classList.add("hidden");$("#mCards").classList.remove("hidden");
 const inv=location.href.split("#")[0]+"#mesa="+st.pub;$("#mInvite").textContent=inv;fingerprint(b64d(st.pub.slice(5))).then(f=>{$("#mFp").textContent="Mesa "+f;$("#mStatus").textContent="Mesa "+f+" aberta"});
 const L=Object.entries(M.fichas).sort((a,b)=>(a[1].s.nome||"").localeCompare(b[1].s.nome||""));
 $("#mCards").innerHTML=L.length?L.map(([id,f])=>masterCard(id,f.s,f.t).replace(/<\/div>$/,`<div class="cf"><button data-read="${id}">Ver ficha</button><button data-mexp="${id}">Exportar</button><button class="danger" data-mdel="${id}">Remover</button></div></div>`)).join(""):`<div class="empty">Nenhuma ficha recebida por código ainda.</div>`}
$("#navM").onclick=()=>{if(window.MESA&&MESA.active)MESA.show(false);view("vMaster");drawMaster();$("#salaCode").textContent=MESA.hostCode()};
$("#bMCreate").onclick=async()=>{const p=$("#mP1").value;if(p.length<6){$("#mErr1").textContent="Use pelo menos 6 caracteres.";return}if(p!==$("#mP2").value){$("#mErr1").textContent="As senhas não batem.";return}
 const kp=await CS.generateKey(ECP,true,["deriveKey"]);const pubRaw=new Uint8Array(await CS.exportKey("raw",kp.publicKey));const jwk=await CS.exportKey("jwk",kp.privateKey);
 const salt=rnd(16);const key=await passKey(p,salt);const sealed=await sealPass(key,jwk);
 LS.set(MK,{v:1,pub:"MESA."+b64e(pubRaw),salt:b64e(salt),pk:sealed,box:null});
 M={priv:await CS.importKey("jwk",jwk,ECP,false,["deriveKey"]),key,fichas:{}};await msave();$("#mP1").value=$("#mP2").value="";drawMaster();await afterUnlock()};
async function munlock(){const st=mstore();const key=await passKey($("#mPass").value,b64d(st.salt));let jwk;
 try{jwk=await openPass(key,st.pk.iv,st.pk.ct)}catch(_){$("#mErr2").textContent="Senha errada.";return}
 $("#mErr2").textContent="";$("#mPass").value="";const fichas=st.box?await openPass(key,st.box.iv,st.box.ct):{};
 M={priv:await CS.importKey("jwk",jwk,ECP,false,["deriveKey"]),key,fichas};drawMaster();await afterUnlock()}
$("#bMUnlock").onclick=munlock;$("#mPass").addEventListener("keydown",e=>{if(e.key==="Enter")munlock()});
async function msave(){const st=mstore();st.box=await sealPass(M.key,M.fichas);LS.set(MK,st)}
$("#bMLock").onclick=()=>{M=null;drawMaster()};
async function receive(code){try{const d=await openForMaster(M.priv,code);if(!d||!d.id||!d.s)throw new Error("formato");
  const old=M.fichas[d.id];if(old&&old.t>d.t){toast("Você já tem uma versão mais nova.");return true}
  M.fichas[d.id]={t:d.t,s:d.s};await msave();drawMaster();toast((old?"Ficha atualizada: ":"Ficha recebida: ")+(d.s.nome||"Sem nome"));return true}
 catch(e){$("#mErr3").textContent=e.message==="formato"?"Isso não parece um código de ficha.":e.message==="navegador"?"Este navegador não abre códigos compactados.":"Não abriu. Esse código foi feito para outra mesa.";return false}}
$("#bMAdd").onclick=async()=>{$("#mErr3").textContent="";if(await receive($("#mIn").value))$("#mIn").value=""};
$("#fEly").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(f){$("#mErr3").textContent="";await receive(await f.text())}};
$("#mCards").addEventListener("click",async e=>{const t=e.target.closest("[data-read],[data-mdel],[data-mexp]");if(!t)return;
 if(t.dataset.mdel){const id=t.dataset.mdel;const n=M.fichas[id].s.nome||"esta ficha";const r=await ask("Remover ficha",`<p style="margin:0">Remover <b>${esc(n)}</b>?</p>`,"Remover");if(!r)return;delete M.fichas[id];await msave();drawMaster()}
 else if(t.dataset.mexp){const f=M.fichas[t.dataset.mexp];download((f.s.nome||"ficha")+"-mestre.json",JSON.stringify(f.s,null,1))}
 else{const f=M.fichas[t.dataset.read];$("#mCards").classList.add("hidden");$("#mRead").classList.remove("hidden");$("#mrTitle").textContent=f.s.nome||"Ficha";$("#mrWhen").textContent="Versão recebida em "+when(f.t);mountSheet($("#mrHost"),fix(JSON.parse(JSON.stringify(f.s))),true);window.scrollTo(0,0)}});
$("#bMBack").onclick=()=>{$("#mRead").classList.add("hidden");$("#mCards").classList.remove("hidden");$("#mrHost").innerHTML=""};
$("#bCopyInv").onclick=()=>copy($("#mInvite").textContent,"Link de convite copiado.");
$("#bCopyKey").onclick=()=>copy(mstore().pub,"Chave copiada.");
$("#bMExport").onclick=()=>download("mesa-elyndor-backup.json",JSON.stringify({elyndorMesa:1,...mstore()}));
$("#fMBackup").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{const d=JSON.parse(await f.text());if(!d.elyndorMesa||!d.pk)throw 0;delete d.elyndorMesa;LS.set(MK,d);drawMaster();toast("Mesa restaurada.")}catch(_){toast("Esse arquivo não é um backup de mesa.")}};
let pendingCode=null;
async function afterUnlock(){if(pendingCode){const c=pendingCode;pendingCode=null;$("#mErr3").textContent="";await receive(c)}}

/* ================= LINKS ================= */
function handleHash(){const h=location.hash.slice(1);if(!h)return;history.replaceState(null,"",location.pathname+location.search);
 if(h.startsWith("m=")){pendingCode=decodeURIComponent(h.slice(2));view("vMaster");drawMaster();
  if(!mstore()){toast("Este link é uma ficha enviada ao mestre.");pendingCode=null}else if(M)afterUnlock();else toast("Abra a mesa para receber a ficha.")}
 else if(h.startsWith("mesa=")){const k=decodeURIComponent(h.slice(5));if(!parseMesa(k)){toast("Link de convite inválido.");return}
  if(cur){cur.S.mesa=k;openSheet();toast("Chave da mesa adicionada.")}else{pendingMesa=k;drawPList();view("vList");toast("Convite recebido. Abra ou crie sua ficha.")}}
 else if(h.startsWith("sala=")){const c=decodeURIComponent(h.slice(5)).toUpperCase().replace(/[^A-Z0-9]/g,"");if(!c)return;
  if(cur){joinMesa(c)}else{pendingSala=c;drawPList();view("vList");toast("Mesa "+c+": abra ou crie seu personagem para entrar.")}}}
window.addEventListener("hashchange",handleHash);
drawPList();handleHash();
if(!crypto.subtle)document.body.innerHTML="<p style='padding:30px'>Abra este site por https (GitHub Pages) ou localhost: o navegador só libera a criptografia em conexões seguras.</p>";
