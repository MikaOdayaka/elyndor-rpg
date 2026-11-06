"use strict";
/* ================= MESA VIRTUAL (P2P) ================= */
/* ---------- rede própria: WebRTC + servidor de sinalização gratuito do PeerJS ---------- */
const NET=(()=>{
 const qs=new URLSearchParams(location.search);
 const CFG=qs.get("peerhost")?{host:qs.get("peerhost"),port:+(qs.get("peerport")||443),path:qs.get("peerpath")||"/",secure:qs.get("peersecure")!=="0",ice:[]}
  :{host:"0.peerjs.com",port:443,path:"/",secure:true,ice:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:global.stun.twilio.com:3478"},
   {urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},{urls:"turn:openrelay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"},
   {urls:"turn:openrelay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"}]};
 class Em{constructor(){this._h={}}on(e,f){(this._h[e]=this._h[e]||[]).push(f);return this}emit(e,...a){(this._h[e]||[]).slice().forEach(f=>{try{f(...a)}catch(x){console.error(x)}})}}
 const CH=30000;
 class Conn extends Em{
  constructor(sig,peer,id,initiator){super();this.sig=sig;this.peer=peer;this.id=id;this.open=false;this.buf={};this.pend=[];
   const pc=this.pc=new RTCPeerConnection({iceServers:CFG.ice});
   pc.onicecandidate=e=>{if(e.candidate)sig.sendSig({type:"CANDIDATE",dst:peer,payload:{c:e.candidate.toJSON(),id}})};
   pc.onconnectionstatechange=()=>{if(["failed","closed"].includes(pc.connectionState))this.close()};
   if(initiator)this.setup(pc.createDataChannel("elyndor",{ordered:true}));else pc.ondatachannel=e=>this.setup(e.channel);
   this.to=setTimeout(()=>{if(!this.open)this.close()},25000)}
  setup(dc){this.dc=dc;dc.onopen=()=>{this.open=true;clearTimeout(this.to);this.emit("open")};dc.onclose=()=>this.close();dc.onmessage=e=>this.recv(e.data)}
  async start(){const o=await this.pc.createOffer();await this.pc.setLocalDescription(o);this.sig.sendSig({type:"OFFER",dst:this.peer,payload:{sdp:{type:o.type,sdp:o.sdp},id:this.id}})}
  async onOffer(p){try{await this.pc.setRemoteDescription(p.sdp);const a=await this.pc.createAnswer();await this.pc.setLocalDescription(a);this.sig.sendSig({type:"ANSWER",dst:this.peer,payload:{sdp:{type:a.type,sdp:a.sdp},id:this.id}});this.flush()}catch(e){this.close()}}
  async onAnswer(p){try{await this.pc.setRemoteDescription(p.sdp);this.flush()}catch(e){this.close()}}
  addCand(c){if(this.pc.remoteDescription)this.pc.addIceCandidate(c).catch(()=>{});else this.pend.push(c)}
  flush(){this.pend.forEach(c=>this.pc.addIceCandidate(c).catch(()=>{}));this.pend=[]}
  send(o){if(!this.open||this.dc.readyState!=="open")return;const s=JSON.stringify(o);if(s.length<=CH){this.dc.send(s);return}
   const mid=Math.random().toString(36).slice(2),n=Math.ceil(s.length/CH);for(let i=0;i<n;i++)this.dc.send(JSON.stringify({__c:mid,i,n,d:s.slice(i*CH,(i+1)*CH)}))}
  recv(d){let o;try{o=JSON.parse(d)}catch(e){return}
   if(o&&o.__c){const b=this.buf[o.__c]=this.buf[o.__c]||{n:o.n,k:0,p:[]};if(b.p[o.i]==null){b.p[o.i]=o.d;b.k++}if(b.k<b.n)return;delete this.buf[o.__c];try{o=JSON.parse(b.p.join(""))}catch(e){return}}
   this.emit("data",o)}
  close(){if(this.closed)return;this.closed=true;this.open=false;clearTimeout(this.to);try{this.dc&&this.dc.close()}catch(e){}try{this.pc.close()}catch(e){}this.sig.conns.delete(this.id);this.emit("close")}}
 class Sig extends Em{
  constructor(id){super();this.id=id||("elyndor-p-"+uid());this.conns=new Map();this.destroyed=false;this.ws=null;setTimeout(()=>this.connectWS(),0)}
  connectWS(){if(this.destroyed)return;this.token=Math.random().toString(36).slice(2);
   let ws;try{ws=this.ws=new WebSocket(`${CFG.secure?"wss":"ws"}://${CFG.host}:${CFG.port}${CFG.path}peerjs?key=peerjs&id=${encodeURIComponent(this.id)}&token=${this.token}&version=1.5.4`)}catch(e){this.emit("error",{type:"network"});return}
   ws.onopen=()=>{clearInterval(this.hb);this.hb=setInterval(()=>this.sendSig({type:"HEARTBEAT"}),5000)};
   ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}this.onSig(m)};
   ws.onclose=()=>{clearInterval(this.hb);if(!this.destroyed&&this.ws===ws)this.emit("disconnected")};
   ws.onerror=()=>{if(!this.destroyed)this.emit("error",{type:"network"})}}
  reconnect(){if(this.destroyed)return;const w=this.ws;this.ws=null;try{w&&w.close()}catch(e){}this.connectWS()}
  sendSig(m){if(this.ws&&this.ws.readyState===1)this.ws.send(JSON.stringify(m))}
  onSig(m){const p=m.payload||{};switch(m.type){
   case"OPEN":this.emit("open",this.id);break;
   case"ID-TAKEN":this.emit("error",{type:"unavailable-id"});break;
   case"INVALID-KEY":case"ERROR":this.emit("error",{type:"server-error"});break;
   case"EXPIRE":for(const c of [...this.conns.values()])if(c.peer===m.src&&!c.open)c.close();this.emit("error",{type:"peer-unavailable",peer:m.src});break;
   case"OFFER":{let c=this.conns.get(p.id);if(!c){c=new Conn(this,m.src,p.id,false);this.conns.set(p.id,c);this.emit("connection",c)}c.onOffer(p);break}
   case"ANSWER":{const c=this.conns.get(p.id);if(c)c.onAnswer(p);break}
   case"CANDIDATE":{const c=this.conns.get(p.id);if(c)c.addCand(p.c);break}
   case"LEAVE":for(const c of [...this.conns.values()])if(c.peer===m.src)c.close();break}}
  connect(dst){const id="c"+Math.random().toString(36).slice(2);const c=new Conn(this,dst,id,true);this.conns.set(id,c);c.start().catch(()=>c.close());return c}
  destroy(){this.destroyed=true;for(const c of [...this.conns.values()])c.close();clearInterval(this.hb);try{this.sendSig({type:"LEAVE"});this.ws&&this.ws.close()}catch(e){}}
  get disconnected(){return!this.ws||this.ws.readyState!==1}}
 return{Sig}})();
const MESA=(()=>{
 const ALFA="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
 let peer=null,role=null,code=null,active=false,hostConn=null,retryT=null,leaving=false;
 const conns={};          // host: peerId -> {conn, sheetId, name, S}
 let st=null,chat=[],imgs={},imgCache={},mapData=null,mapImg=null;
 let mySheet=null;        // sheetId do jogador
 let cv,cx,cam={x:0,y:0,z:1},dirty=true,tool="mover",sel=null,drag=null,ruler=null,remoteRulers={},pings=[],bubbles=[],drawing=null,pointers=new Map(),pinch=null,spaceDown=false;
 const isHost=()=>role==="host";
 const newState=()=>({grid:{size:70,show:true,color:"#2a1f17",alpha:.28,snap:true},map:{w:2100,h:1400,has:false},tokens:{},fog:[],draw:[],init:{list:[],turn:0,round:1},showBars:false});
 function hostCode(){let c=LS.get("elyndor-sala-host");if(!c){c=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>ALFA[b%ALFA.length]).join("");LS.set("elyndor-sala-host",c)}return c}
 const pid=c=>"elyndor-rpg-"+c.toLowerCase();
 function setStatus(t,on){$("#mzStatus").textContent=t;$("#mzDot").className="dot "+(on?"on":"off")}

 /* ---------- IndexedDB da cena do mestre ---------- */
 const IDB={db:null,open(){return this.db?Promise.resolve(this.db):new Promise((ok,bad)=>{const r=indexedDB.open("elyndor",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>{this.db=r.result;ok(r.result)};r.onerror=()=>bad(r.error)})},
  async get(k){const db=await this.open();return new Promise(ok=>{const t=db.transaction("kv").objectStore("kv").get(k);t.onsuccess=()=>ok(t.result);t.onerror=()=>ok(null)})},
  async set(k,v){const db=await this.open();return new Promise(ok=>{const t=db.transaction("kv","readwrite").objectStore("kv").put(v,k);t.onsuccess=()=>ok(true);t.onerror=()=>ok(false)})}};
 let saveT=null;function saveScene(){if(!isHost())return;clearTimeout(saveT);saveT=setTimeout(()=>IDB.set("cena",{st,imgs,mapData,chat:chat.slice(-60)}).catch(()=>{}),800)}

 /* ---------- entrar / sair ---------- */
 let loopId=0;async function enter(){active=true;leaving=false;view("vMesa");buildUI();resize();const my=++loopId;const L=()=>{if(!active||my!==loopId)return;requestAnimationFrame(L);step()};L()}
 async function host(){if(active&&isHost()){show(true);return}
  if(active)leave();role="host";code=hostCode();
  const saved=await IDB.get("cena").catch(()=>null);
  if(saved&&saved.st){st=saved.st;imgs=saved.imgs||{};mapData=saved.mapData||null;chat=saved.chat||[]}else{st=newState();imgs={};mapData=null;chat=[]}
  for(const t of Object.values(st.tokens))if(t.owner)t.online=false;
  if(mapData)setMap(mapData);
  await enter();centerView();
  startHostPeer()}
 function startHostPeer(){if(leaving)return;setStatus("Abrindo a mesa…",false);
  peer=new NET.Sig(pid(code));
  peer.on("open",()=>{setStatus("Mesa aberta · código "+code,true);sys("Mesa aberta. Passe o código "+code+" para os jogadores.")});
  peer.on("connection",c=>{c.on("open",()=>{conns[c.peer]={conn:c,sheetId:null,name:"?"}});c.on("data",m=>onMsg(m,c.peer));c.on("close",()=>dropConn(c.peer));c.on("error",()=>dropConn(c.peer))});
  peer.on("error",e=>{if(e.type==="unavailable-id"){setStatus("O código ainda está preso de uma sessão anterior. Tentando de novo…",false);peer.destroy();clearTimeout(retryT);retryT=setTimeout(startHostPeer,6000)}
   else if(e.type==="network"||e.type==="server-error"||e.type==="socket-error"||e.type==="socket-closed"){setStatus("Sem conexão com o servidor. Tentando de novo…",false);clearTimeout(retryT);retryT=setTimeout(()=>{try{peer.reconnect()}catch(_){peer.destroy();startHostPeer()}},5000)}
   else setStatus("Erro: "+e.type,false)});
  peer.on("disconnected",()=>{if(leaving)return;setStatus("Reconectando ao servidor…",false);clearTimeout(retryT);retryT=setTimeout(()=>{try{peer.reconnect()}catch(_){}},3000)})}
 async function joinAsPlayer(c){if(!cur)return;if(active)leave();role="player";code=c;mySheet=cur.id;st=newState();chat=[];imgs={};mapData=null;mapImg=null;
  await enter();setStatus("Conectando à mesa "+c+"…",false);
  peer=new NET.Sig();
  peer.on("open",()=>connectHost());
  peer.on("error",e=>{if(e.type==="peer-unavailable"){setStatus("A mesa "+code+" não está aberta. Peça ao mestre para abrir. Tentando de novo…",false)}
   else if(["network","server-error","socket-error","socket-closed"].includes(e.type)){setStatus("Sem conexão. Tentando de novo…",false);clearTimeout(retryT);retryT=setTimeout(()=>{try{peer.reconnect()}catch(_){}},5000)}
   else setStatus("Erro: "+e.type,false)});
  peer.on("disconnected",()=>{if(leaving)return;clearTimeout(retryT);retryT=setTimeout(()=>{try{peer.reconnect()}catch(_){}},3000)})}
 function connectHost(){if(leaving||!peer||peer.destroyed)return;clearTimeout(retryT);const old=hostConn;hostConn=null;if(old){try{old.close()}catch(_){}}
  const c=hostConn=peer.connect(pid(code));let opened=false;
  c.on("open",()=>{opened=true;setStatus("Na mesa "+code,true);const S=cur.S;send({t:"hello",sheetId:cur.id,name:S.nome||"Jogador",cor:S.cor||"#8e1b1b",img:S.retrato||null,S:shareable({...S,retrato:""})})});
  c.on("data",m=>onMsg(m,null));
  c.on("close",()=>{if(leaving||c!==hostConn)return;setStatus(opened?"Conexão caiu. Voltando…":"A mesa "+code+" não está aberta ou não respondeu. Tentando de novo…",false);clearTimeout(retryT);retryT=setTimeout(connectHost,opened?2500:5000)})}
 function leave(){leaving=true;clearTimeout(retryT);try{peer&&peer.destroy()}catch(_){}peer=null;hostConn=null;for(const k in conns)delete conns[k];active=false;role=null;$("#mesaBack").classList.add("hidden");
  if(cur)view("vSheet");else{drawPList();view("vList")}}
 function show(on){if(on){view("vMesa");resize();dirty=true}else{$("#mesaBack").classList.toggle("hidden",!active)}}
 function send(m){if(isHost())onMsg(m,null);else if(hostConn&&hostConn.open)hostConn.send(m)}
 function sendTo(p,m){const c=conns[p];if(c&&c.conn.open)try{c.conn.send(m)}catch(_){}}
 function sendAll(m,except){for(const p in conns)if(p!==except)sendTo(p,m)}
 function dropConn(p){const c=conns[p];if(!c)return;delete conns[p];if(c.sheetId){const t=tokOf(c.sheetId);if(t){t.online=false;stateChanged()}sys(c.name+" saiu da mesa.")}drawSide()}
 const tokOf=sheetId=>Object.values(st.tokens).find(t=>t.owner===sheetId);

 /* ---------- estado e mensagens ---------- */
 function filtered(forSheet){const o=JSON.parse(JSON.stringify(st));
  for(const [id,t] of Object.entries(o.tokens)){const mine=t.owner&&t.owner===forSheet;if(t.hidden&&!mine){delete o.tokens[id];continue}
   if(!o.showBars&&!mine){if(t.npc)t.npc={hide:1};if(t.stat)t.stat={cond:t.stat.cond,limiar:t.stat.limiar}}}
  const curId=st.init.list[st.init.turn]?.id;o.init.list=o.init.list.filter(x=>o.tokens[x.id]);o.init.turn=o.init.list.findIndex(x=>x.id===curId);return o}
 let bcT=null;function stateChanged(){dirty=true;drawSide();saveScene();if(!isHost())return;clearTimeout(bcT);bcT=setTimeout(()=>{for(const p in conns)sendTo(p,{t:"state",st:filtered(conns[p].sheetId)})},40)}
 function pushChat(e,from){e.t=e.t||Date.now();chat.push(e);if(chat.length>150)chat.shift();
  if(isHost()){for(const p in conns){if(e.secret&&conns[p].sheetId!==e.from)continue;sendTo(p,{t:"chat",e})}saveScene()}
  showChat(e)}
 function sys(text){const e={who:"",label:"",text,kind:"sys"};if(isHost())pushChat(e);else showChat(e)}
 function onMsg(m,from){if(!m||!m.t)return;const fromHost=from===null;
  if(isHost()){const c=from?conns[from]:null;const sid=c?c.sheetId:null;const master=!from;
   switch(m.t){
    case"hello":{if(!c)return;c.sheetId=m.sheetId;c.name=m.name;c.S=m.S;let t=tokOf(m.sheetId);
     if(!t){const id="p_"+m.sheetId.slice(0,8);const g=st.grid.size,n=Object.keys(st.tokens).length;t=st.tokens[id]={id,name:m.name,x:g*(3+n%6)+g/2,y:g*(3+Math.floor(n/6))+g/2,s:1,color:m.cor,img:null,owner:m.sheetId,hidden:false}}
     t.name=m.name;t.color=m.cor;t.online=true;if(m.img){imgs[t.id]=m.img;delete imgCache[t.id];t.img=t.id;sendAll({t:"img",id:t.id,data:m.img},from)}
     if(m.S){c.S=m.S;t.stat=summary(fix(m.S))}
     sendTo(from,{t:"welcome",code,st:filtered(m.sheetId),chat:chat.filter(e=>!e.secret||e.from===m.sheetId).slice(-60)});
     for(const [id,d] of Object.entries(imgs))sendTo(from,{t:"img",id,data:d});if(mapData)sendTo(from,{t:"map",data:mapData});
     sys(m.name+" entrou na mesa.");stateChanged();return}
    case"move":{const t=st.tokens[m.id];if(!t)return;if(!master&&t.owner!==sid)return;t.x=m.x;t.y=m.y;stateChanged();return}
    case"sheet":{if(!c)return;c.S=m.S;const t=tokOf(sid);if(t){t.stat=summary(fix(m.S));t.name=m.S.nome||t.name;t.color=m.S.cor||t.color}stateChanged();return}
    case"chat":case"roll":{const e=m.t==="chat"?{who:master?"Mestre":(c?.name||"?"),text:String(m.text||"").slice(0,500),kind:"msg"}:{...m.e};
     e.from=sid||"mestre";if(!master&&c)e.who=c.S?.nome||c.name;const t=sid?tokOf(sid):null;if(t){e.tok=t.id;e.color=t.color}if(master&&m.tok){e.tok=m.tok}
     pushChat(e);return}
    case"ping":case"ruler":{const o={...m,by:sid||"mestre",color:m.color||(sid?tokOf(sid)?.color:"#d9b86a")};sendAll(o,from);if(from)localMsg(o);return}
    case"draw":{st.draw.push({...m.s,by:sid||"mestre"});if(st.draw.length>400)st.draw.shift();stateChanged();return}
    case"init":{const t=sid?tokOf(sid):(m.tok?st.tokens[m.tok]:null);if(!t)return;const L=st.init.list;const x=L.find(i=>i.id===t.id);if(x)x.v=m.val;else L.push({id:t.id,v:m.val});L.sort((a,b)=>b.v-a.v);stateChanged();return}
   }return}
  // jogador recebendo do mestre
  switch(m.t){
   case"welcome":st=m.st;chat=[];$("#mzChat").innerHTML="";m.chat.forEach(showChat);dirty=true;drawSide();centerView();toast("Você entrou na mesa "+m.code+".");return;
   case"state":{const keep=drag&&drag.tok&&st.tokens[drag.tok]?{...st.tokens[drag.tok]}:null;st=m.st;if(keep&&st.tokens[keep.id]){st.tokens[keep.id].x=keep.x;st.tokens[keep.id].y=keep.y}dirty=true;drawSide();return}
   case"img":imgs[m.id]=m.data;delete imgCache[m.id];dirty=true;return;
   case"map":setMap(m.data);return;
   case"chat":chat.push(m.e);showChat(m.e);return;
   case"ping":case"ruler":localMsg(m);return}}
 function localMsg(m){if(m.t==="ping"){pings.push({x:m.x,y:m.y,c:m.color||"#d9b86a",t:performance.now()});playSound("dado");dirty=true}
  if(m.t==="ruler"){if(m.a)remoteRulers[m.by]={a:m.a,b:m.b,c:m.color,t:performance.now()};else delete remoteRulers[m.by];dirty=true}}

 /* ---------- chat ---------- */
 function showChat(e){const box=$("#mzChat");if(!box)return;const d=document.createElement("div");d.innerHTML=e.kind==="sys"?`<div class="rl sys">${esc(e.text)}</div>`:e.kind==="msg"?`<div class="rl msg"><b style="color:${esc(e.color||"var(--red)")}">${esc(e.who)}:</b> ${esc(e.text)}</div>`:rollCard({...e,label:(e.secret?"🔒 ":"")+e.label});
  box.appendChild(d.firstChild);box.scrollTop=box.scrollHeight;
  if(e.power&&active){const t=e.tok&&st.tokens[e.tok];bubbles.push({tok:e.tok,text:e.power.nome+(e.total!=null?" · "+e.total:""),c:e.power.cor,t:performance.now()});
   const p=t?w2s(t.x,t.y):null;const r=cv.getBoundingClientRect();if(p)fxBurst(r.left+p.x,r.top+p.y,e.power.cor,1.2);else fxBurst(r.left+r.width/2,r.top+r.height/2,e.power.cor,1);
   if(!(cur&&e.from===cur.id))playSound(e.power.som==="proprio"?"brilho":e.power.som);dirty=true}
  else if(e.kind==="roll"&&!(cur&&e.from===cur.id)&&e.from)playSound("dado");
  const tab=$('#mzTabs [data-mt="chat"]');if(tab&&!tab.classList.contains("on"))tab.classList.add("ping")}
 function chatSubmit(text){text=text.trim();if(!text)return;
  const m=text.match(/^\/(r|roll|rs)\s+(.+)$/i);
  if(m){const secret=m[1].toLowerCase()==="rs";if(cur&&!isHost()){ACT.roll(cur.S,m[2],"rolou "+m[2],{secret});return}
   const r=rollExpr(m[2],null);if(!r||r.err){toast(r?r.err:"Rolagem vazia.");return}send({t:"roll",e:{who:"Mestre",label:"rolou "+m[2],detail:r.detail,total:r.total,crit:r.crit,fail:r.fail,kind:"roll",secret}});playSound("dado");return}
  send({t:"chat",text})}

 /* ---------- câmera e desenho ---------- */
 const w2s=(x,y)=>({x:(x-cam.x)*cam.z,y:(y-cam.y)*cam.z});
 const s2w=(x,y)=>({x:x/cam.z+cam.x,y:y/cam.z+cam.y});
 function resize(){if(!cv)return;const r=cv.parentElement.getBoundingClientRect(),dpr=devicePixelRatio||1;cv.width=Math.max(1,r.width*dpr);cv.height=Math.max(1,r.height*dpr);cv.style.width=r.width+"px";cv.style.height=r.height+"px";dirty=true}
 function centerView(){if(!cv)return;const r=cv.getBoundingClientRect();const W=st.map.w,H=st.map.h;cam.z=Math.min(2,Math.max(.15,Math.min(r.width/W,r.height/H)*.95));cam.x=W/2-r.width/2/cam.z;cam.y=H/2-r.height/2/cam.z;dirty=true}
 function setMap(data){mapData=data;const im=new Image();im.onload=()=>{mapImg=im;if(isHost()){st.map={w:im.width,h:im.height,has:true};stateChanged()}dirty=true};im.src=data}
 function getImg(id){if(!id||!imgs[id])return null;if(!imgCache[id]){const im=new Image();im.onload=()=>{dirty=true};im.src=imgs[id];imgCache[id]=im}return imgCache[id].complete?imgCache[id]:null}
 function canMove(t){return isHost()||(t.owner&&t.owner===mySheet)}
 function tokR(t){return st.grid.size*(t.s||1)/2*.9}
 function hitTok(w){const L=Object.values(st.tokens);for(let i=L.length-1;i>=0;i--){const t=L[i];if(Math.hypot(w.x-t.x,w.y-t.y)<=tokR(t))return t}return null}
 function snap(t){if(!st.grid.snap)return;const g=st.grid.size,s=t.s||1,off=(s%2===1)?g/2:0;t.x=Math.round((t.x-off)/g)*g+off;t.y=Math.round((t.y-off)/g)*g+off}
 function dist(a,b){const g=st.grid.size;const cells=Math.hypot(b.x-a.x,b.y-a.y)/g;return Math.round(cells*1.5*2)/2}
 function step(){const now=performance.now();if(pings.length||bubbles.length||Object.keys(remoteRulers).length||(st&&st.init.list.length))dirty=true;if(!dirty||!cv||!st)return;dirty=false;render(now)}
 function render(now){const dpr=devicePixelRatio||1;cx.setTransform(1,0,0,1,0,0);cx.fillStyle="#1d1611";cx.fillRect(0,0,cv.width,cv.height);
  cx.setTransform(cam.z*dpr,0,0,cam.z*dpr,-cam.x*cam.z*dpr,-cam.y*cam.z*dpr);
  const W=st.map.w,H=st.map.h,g=st.grid.size;
  if(mapImg)cx.drawImage(mapImg,0,0,W,H);else{cx.fillStyle="#efe3c8";cx.fillRect(0,0,W,H)}
  if(st.grid.show){cx.strokeStyle=st.grid.color;cx.globalAlpha=st.grid.alpha;cx.lineWidth=1/cam.z;cx.beginPath();for(let x=0;x<=W;x+=g){cx.moveTo(x,0);cx.lineTo(x,H)}for(let y=0;y<=H;y+=g){cx.moveTo(0,y);cx.lineTo(W,y)}cx.stroke();cx.globalAlpha=1}
  const strokes=st.draw.concat(drawing?[drawing]:[]);for(const s of strokes){if(s.pts.length<2)continue;cx.strokeStyle=s.c;cx.lineWidth=s.w;cx.lineCap=cx.lineJoin="round";cx.beginPath();cx.moveTo(s.pts[0][0],s.pts[0][1]);for(const p of s.pts)cx.lineTo(p[0],p[1]);cx.stroke()}
  const curTurn=st.init.list[st.init.turn]?.id;
  for(const t of Object.values(st.tokens)){const r=tokR(t);cx.save();if(t.hidden)cx.globalAlpha=.45;
   if(t.id===curTurn){const p=.5+.5*Math.sin(now/250);cx.strokeStyle="#ffd56b";cx.lineWidth=(4+3*p)/Math.max(.5,cam.z);cx.beginPath();cx.arc(t.x,t.y,r+6/cam.z+3,0,7);cx.stroke()}
   cx.shadowColor="rgba(0,0,0,.5)";cx.shadowBlur=8;cx.beginPath();cx.arc(t.x,t.y,r,0,7);cx.fillStyle=t.color||"#8e1b1b";cx.fill();cx.shadowBlur=0;
   const im=getImg(t.img);if(im){cx.save();cx.beginPath();cx.arc(t.x,t.y,r-3,0,7);cx.clip();const k=Math.max(2*r/im.width,2*r/im.height);cx.drawImage(im,t.x-im.width*k/2,t.y-im.height*k/2,im.width*k,im.height*k);cx.restore()}
   else{cx.fillStyle="#fff";cx.font=`700 ${r*.9}px 'EB Garamond',serif`;cx.textAlign="center";cx.textBaseline="middle";cx.fillText((t.name||"?").slice(0,1).toUpperCase(),t.x,t.y+1)}
   cx.lineWidth=3;cx.strokeStyle=t.color||"#8e1b1b";cx.beginPath();cx.arc(t.x,t.y,r-1.5,0,7);cx.stroke();
   if(sel===t.id){cx.strokeStyle="#ffe9a8";cx.setLineDash([6,4]);cx.lineWidth=2/cam.z+1;cx.beginPath();cx.arc(t.x,t.y,r+4,0,7);cx.stroke();cx.setLineDash([])}
   if(t.owner&&t.online===false){cx.fillStyle="rgba(0,0,0,.45)";cx.beginPath();cx.arc(t.x,t.y,r,0,7);cx.fill()}
   const bars=[];const s=t.stat;if(s&&s.pvM!=null){bars.push([s.pv,s.pvM,"#b52a2a"]);if(s.vbM)bars.push([s.vb,s.vbM,"#2f6aa8"])}if(t.npc&&t.npc.pvm)bars.push([num(t.npc.pv),num(t.npc.pvm),"#b52a2a"]);
   let by=t.y+r+4;for(const [a,m,c] of bars){const bw=r*1.8;cx.fillStyle="rgba(0,0,0,.6)";cx.fillRect(t.x-bw/2,by,bw,6);cx.fillStyle=c;cx.fillRect(t.x-bw/2,by,bw*Math.max(0,Math.min(1,a/m)),6);by+=8}
   cx.font=`600 ${Math.max(11,g*.2)}px Lora,serif`;cx.textAlign="center";cx.textBaseline="top";const nm=t.name||"";const tw=cx.measureText(nm).width+8;cx.fillStyle="rgba(20,14,10,.75)";cx.fillRect(t.x-tw/2,by,tw,Math.max(11,g*.2)+4);cx.fillStyle="#fff";cx.fillText(nm,t.x,by+2);
   const cs=s&&s.cond?Object.entries(s.cond):[];const lim=s&&s.limiar;const badges=cs.map(([n,l])=>n.slice(0,3)+(l>1?l:""));if(lim)badges.unshift("L"+lim);
   badges.slice(0,5).forEach((b,i)=>{const bx=t.x-r+i*(r*.5)+r*.05,byy=t.y-r-2;cx.fillStyle=b[0]==="L"&&/^L\d$/.test(b)?"#5b2d7a":"#8e1b1b";cx.beginPath();cx.arc(bx+r*.22,byy,r*.24,0,7);cx.fill();cx.fillStyle="#fff";cx.font=`700 ${r*.2}px Lora`;cx.textBaseline="middle";cx.fillText(b,bx+r*.22,byy+1)});
   cx.restore()}
  for(const f of st.fog){if(isHost()){cx.fillStyle="rgba(10,6,4,.5)";cx.fillRect(f.x,f.y,f.w,f.h);cx.strokeStyle="#d9b86a";cx.setLineDash([8,6]);cx.lineWidth=2/cam.z;cx.strokeRect(f.x,f.y,f.w,f.h);cx.setLineDash([])}else{cx.fillStyle="#0b0806";cx.fillRect(f.x-1,f.y-1,f.w+2,f.h+2)}}
  if(drag&&drag.fog){const f=drag.fog;cx.fillStyle="rgba(10,6,4,.4)";cx.fillRect(f.x,f.y,f.w,f.h)}
  const rl=Object.values(remoteRulers).concat(ruler?[{...ruler,c:"#ffd56b"}]:[]);for(const R of rl){if(now-R.t>8000&&R!==ruler)continue;cx.strokeStyle=R.c||"#ffd56b";cx.lineWidth=3/cam.z+1;cx.setLineDash([10/cam.z,6/cam.z]);cx.beginPath();cx.moveTo(R.a.x,R.a.y);cx.lineTo(R.b.x,R.b.y);cx.stroke();cx.setLineDash([]);
   const txt=dist(R.a,R.b)+" m";cx.font=`700 ${16/cam.z}px Lora`;const tw=cx.measureText(txt).width+12/cam.z;cx.fillStyle="rgba(20,14,10,.85)";cx.fillRect(R.b.x+8/cam.z,R.b.y-24/cam.z,tw,22/cam.z);cx.fillStyle="#ffd56b";cx.textAlign="left";cx.textBaseline="middle";cx.fillText(txt,R.b.x+14/cam.z,R.b.y-13/cam.z)}
  pings=pings.filter(p=>now-p.t<1600);for(const p of pings){const k=(now-p.t)/1600;for(let i=0;i<3;i++){const kk=(k+i*.2)%1;cx.strokeStyle=p.c;cx.globalAlpha=1-kk;cx.lineWidth=4/cam.z;cx.beginPath();cx.arc(p.x,p.y,(10+kk*70)/cam.z*1.5,0,7);cx.stroke()}cx.globalAlpha=1}
  bubbles=bubbles.filter(b=>now-b.t<4500);for(const b of bubbles){const t=st.tokens[b.tok];if(!t)continue;const k=(now-b.t)/4500;const y=t.y-tokR(t)-30/cam.z-k*20/cam.z;cx.globalAlpha=k>.8?(1-k)*5:1;
   cx.font=`700 ${15/cam.z}px 'EB Garamond',serif`;const tw=cx.measureText(b.text).width+20/cam.z,h=26/cam.z;cx.fillStyle="#fff8e6";cx.strokeStyle=b.c;cx.lineWidth=3/cam.z;
   const x0=t.x-tw/2,y0=y-h;cx.beginPath();cx.roundRect(x0,y0,tw,h,8/cam.z);cx.fill();cx.stroke();cx.beginPath();cx.moveTo(t.x-6/cam.z,y);cx.lineTo(t.x,y+8/cam.z);cx.lineTo(t.x+6/cam.z,y);cx.fill();
   cx.fillStyle=b.c;cx.textAlign="center";cx.textBaseline="middle";cx.fillText(b.text,t.x,y0+h/2+1/cam.z);cx.globalAlpha=1}}

 /* ---------- entrada (mouse, toque, teclado) ---------- */
 let lastMove=0,lastRuler=0;
 function pos(e){const r=cv.getBoundingClientRect();return{sx:e.clientX-r.left,sy:e.clientY-r.top}}
 function onDown(e){cv.setPointerCapture(e.pointerId);const p=pos(e);pointers.set(e.pointerId,p);
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={d:Math.hypot(a.sx-b.sx,a.sy-b.sy),z:cam.z,c:s2w((a.sx+b.sx)/2,(a.sy+b.sy)/2)};drag=null;return}
  const w=s2w(p.sx,p.sy);
  if(e.button===1||spaceDown||e.button===2&&tool!=="mover"){drag={pan:1,sx:p.sx,sy:p.sy,cx:cam.x,cy:cam.y};return}
  if(e.button===2){const t=hitTok(w);if(t&&isHost()){sel=t.id;dirty=true;tokenMenu(t)}else drag={pan:1,sx:p.sx,sy:p.sy,cx:cam.x,cy:cam.y};return}
  if(tool==="mover"){const t=hitTok(w);if(t&&canMove(t)){sel=t.id;drag={tok:t.id,dx:w.x-t.x,dy:w.y-t.y,moved:false};dirty=true;return}if(t){sel=t.id;dirty=true}else sel=null;drag={pan:1,sx:p.sx,sy:p.sy,cx:cam.x,cy:cam.y};return}
  if(tool==="regua"){ruler={a:w,b:w,t:performance.now()};drag={ruler:1};return}
  if(tool==="ping"){const c=isHost()?"#d9b86a":(cur?.S?.cor||"#d9b86a");send({t:"ping",x:w.x,y:w.y,color:c});localMsg({t:"ping",x:w.x,y:w.y,color:c});return}
  if(tool==="lapis"){drawing={pts:[[w.x,w.y]],c:$("#mzColor").value,w:Math.max(2,4/cam.z)};drag={draw:1};return}
  if(tool==="nevoa"&&isHost()){if(e.shiftKey||e.altKey){const i=st.fog.findIndex(f=>w.x>=f.x&&w.x<=f.x+f.w&&w.y>=f.y&&w.y<=f.y+f.h);if(i>=0){st.fog.splice(i,1);stateChanged()}return}drag={fog:{x:w.x,y:w.y,w:0,h:0},ox:w.x,oy:w.y};return}
  if(tool==="revelar"&&isHost()){const i=st.fog.findIndex(f=>w.x>=f.x&&w.x<=f.x+f.w&&w.y>=f.y&&w.y<=f.y+f.h);if(i>=0){st.fog.splice(i,1);stateChanged()}return}}
 function onMove(e){if(!pointers.has(e.pointerId))return;const p=pos(e);pointers.set(e.pointerId,p);
  if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.sx-b.sx,a.sy-b.sy);const z=Math.min(4,Math.max(.1,pinch.z*d/pinch.d));const m={x:(a.sx+b.sx)/2,y:(a.sy+b.sy)/2};cam.z=z;cam.x=pinch.c.x-m.x/z;cam.y=pinch.c.y-m.y/z;dirty=true;return}
  if(!drag)return;const w=s2w(p.sx,p.sy);
  if(drag.pan){cam.x=drag.cx-(p.sx-drag.sx)/cam.z;cam.y=drag.cy-(p.sy-drag.sy)/cam.z;dirty=true;return}
  if(drag.tok){const t=st.tokens[drag.tok];if(!t)return;t.x=w.x-drag.dx;t.y=w.y-drag.dy;drag.moved=true;dirty=true;const n=performance.now();if(n-lastMove>60){lastMove=n;send({t:"move",id:t.id,x:t.x,y:t.y})}return}
  if(drag.ruler){ruler.b=w;ruler.t=performance.now();dirty=true;const n=performance.now();if(n-lastRuler>80){lastRuler=n;send({t:"ruler",a:ruler.a,b:ruler.b,color:cur?.S?.cor||"#ffd56b"})}return}
  if(drag.draw){drawing.pts.push([Math.round(w.x),Math.round(w.y)]);dirty=true;return}
  if(drag.fog){const f=drag.fog;f.x=Math.min(drag.ox,w.x);f.y=Math.min(drag.oy,w.y);f.w=Math.abs(w.x-drag.ox);f.h=Math.abs(w.y-drag.oy);dirty=true}}
 function onUp(e){pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!drag)return;const d=drag;drag=null;
  if(d.tok){const t=st.tokens[d.tok];if(t){snap(t);send({t:"move",id:t.id,x:t.x,y:t.y});dirty=true}}
  if(d.ruler){setTimeout(()=>{ruler=null;dirty=true;send({t:"ruler",a:null})},1200)}
  if(d.draw&&drawing){if(drawing.pts.length>1)send({t:"draw",s:drawing});drawing=null}
  if(d.fog&&d.fog.w>8&&d.fog.h>8){st.fog.push(d.fog);stateChanged()}dirty=true}
 function onWheel(e){e.preventDefault();const p=pos(e),w=s2w(p.sx,p.sy);const z=Math.min(4,Math.max(.1,cam.z*Math.pow(1.0015,-e.deltaY)));cam.z=z;cam.x=w.x-p.sx/z;cam.y=w.y-p.sy/z;dirty=true}
 function onKey(e){if(!active||$("#vMesa").classList.contains("hidden"))return;const tag=(e.target.tagName||"").toLowerCase();if(tag==="input"||tag==="textarea"||tag==="select")return;
  if(e.code==="Space"){spaceDown=e.type==="keydown";if(spaceDown)e.preventDefault();return}if(e.type!=="keydown")return;
  const k=e.key.toLowerCase();const map={v:"mover",r:"regua",p:"ping",d:"lapis",f:"nevoa",g:"revelar"};if(map[k]&&(isHost()||!["nevoa","revelar"].includes(map[k]))){setTool(map[k]);return}
  const t=sel&&st.tokens[sel];if(!t||!canMove(t))return;const g=st.grid.size;const mv={arrowleft:[-g,0],arrowright:[g,0],arrowup:[0,-g],arrowdown:[0,g]}[k];
  if(mv){e.preventDefault();t.x+=mv[0];t.y+=mv[1];send({t:"move",id:t.id,x:t.x,y:t.y});dirty=true}
  if((k==="delete"||k==="backspace")&&isHost()){delete st.tokens[t.id];st.init.list=st.init.list.filter(x=>x.id!==t.id);sel=null;stateChanged()}}
 function setTool(t){tool=t;document.querySelectorAll("#mzTools [data-tool]").forEach(b=>b.classList.toggle("on",b.dataset.tool===t));cv.style.cursor=t==="mover"?"grab":"crosshair"}

 /* ---------- tokens (mestre) ---------- */
 async function tokenDlg(t){const n=!t;t=t||{};
  const r=await ask(n?"Novo token":"Token: "+(t.name||""),`<div class="pg"><div class="s2"><label>Nome</label><input name="name" required value="${esc(t.name||"")}"></div><div><label>Cor</label><input type="color" name="color" value="${esc(t.color||"#5a4636")}" style="height:40px;padding:2px"></div><div><label>Tamanho (casas)</label><select name="s">${[.5,1,2,3,4].map(v=>`<option ${num(t.s||1)===v?"selected":""}>${v}</option>`).join("")}</select></div>
   ${t.owner?"":`<div><label>PV</label><input type="number" name="pv" value="${esc(t.npc?.pv??"")}"></div><div><label>PV máx.</label><input type="number" name="pvm" value="${esc(t.npc?.pvm??"")}"></div>`}<div><label>Escondido</label><label class="ck"><input type="checkbox" name="hidden" ${t.hidden?"checked":""}> só o mestre vê</label></div>
   <div class="s4"><label>Imagem (opcional)</label><input type="file" id="tokImg" accept="image/*"></div></div>`,n?"Criar":"Salvar",null,true);
  if(!r)return;const f=$("#tokImg")?.files?.[0];if(n){const id="n_"+uid();const c=s2w(cv.clientWidth/2,cv.clientHeight/2);t=st.tokens[id]={id,x:c.x,y:c.y,owner:null};snap(t)}
  t.name=r.name;t.color=r.color;t.s=num(r.s)||1;t.hidden=!!r.hidden;if(!t.owner)t.npc={pv:r.pv,pvm:r.pvm};
  if(f){const d=await shrink(f,200,.8);imgs[t.id]=d;delete imgCache[t.id];t.img=t.id;sendAll({t:"img",id:t.id,data:d})}stateChanged()}
 async function tokenMenu(t){const r=await ask("Token: "+(t.name||""),`<div class="tokmenu">
   <button type="button" value="edit" class="primary">Editar</button>${t.owner?"":`<button type="button" value="dmg">Dano / cura</button>`}<button type="button" value="init">Pôr na iniciativa</button><button type="button" value="hide">${t.hidden?"Mostrar aos jogadores":"Esconder dos jogadores"}</button><button type="button" value="del" class="danger">Remover do mapa</button></div><input type="hidden" name="a" id="tmA">`,"Fechar",null,false,d=>{d.querySelectorAll(".tokmenu button").forEach(b=>b.onclick=()=>{d.querySelector("#tmA").value=b.value;d.querySelector("#dOk").click()})});
  if(!r||!r.a)return;if(r.a==="edit")return tokenDlg(t);
  if(r.a==="hide"){t.hidden=!t.hidden;stateChanged()}
  if(r.a==="del"){delete st.tokens[t.id];st.init.list=st.init.list.filter(x=>x.id!==t.id);sel=null;stateChanged()}
  if(r.a==="init"){const v=rollExpr("1d20");st.init.list.push({id:t.id,v:v.total});st.init.list.sort((a,b)=>b.v-a.v);stateChanged()}
  if(r.a==="dmg"){const x=await ask("Dano ou cura em "+t.name,`<div><label>Valor (negativo cura)</label><input name="v" type="number" required></div>`,"Aplicar");if(!x)return;t.npc=t.npc||{};t.npc.pv=Math.max(0,num(t.npc.pv)-num(x.v));if(num(t.npc.pvm))t.npc.pv=Math.min(num(t.npc.pvm),t.npc.pv);stateChanged()}}

 /* ---------- interface ---------- */
 let built=false,mt="chat";
 function buildUI(){$("#mzCode").textContent=code;$("#mzRole").textContent=isHost()?"Mestre":"Jogador";$("#mesaBack").classList.add("hidden");
  $("#mzTools").innerHTML=[["mover","✋","Mover (V)"],["regua","📏","Régua (R)"],["ping","📍","Ping (P)"],["lapis","✏️","Desenhar (D)"]].concat(isHost()?[["nevoa","🌫️","Névoa: cobrir área (F) · Shift+clique remove"],["revelar","☀️","Névoa: revelar clicando (G)"]]:[])
   .map(([k,i,t])=>`<button type="button" data-tool="${k}" title="${t}">${i}</button>`).join("")+`<input type="color" id="mzColor" value="#8e1b1b" title="Cor do lápis"><button type="button" id="mzZin" title="Aproximar">＋</button><button type="button" id="mzZout" title="Afastar">－</button><button type="button" id="mzFit" title="Ver o mapa inteiro">⤢</button>`;
  $("#mzTabs").innerHTML=(isHost()?[["chat","Chat"],["jog","Jogadores"],["ini","Iniciativa"],["cena","Cena"]]:[["chat","Chat"],["eu","Minha ficha"],["ini","Iniciativa"]]).map(([k,n])=>`<button type="button" data-mt="${k}">${n}</button>`).join("");
  if(!built){built=true;cv=$("#mzCanvas");cx=cv.getContext("2d");
   cv.addEventListener("pointerdown",onDown);cv.addEventListener("pointermove",onMove);cv.addEventListener("pointerup",onUp);cv.addEventListener("pointercancel",onUp);cv.addEventListener("wheel",onWheel,{passive:false});cv.addEventListener("contextmenu",e=>e.preventDefault());
   cv.addEventListener("dblclick",e=>{const p=pos(e),t=hitTok(s2w(p.sx,p.sy));if(t&&isHost())tokenDlg(t);else if(t&&canMove(t)){mt="eu";drawSide()}});
   addEventListener("keydown",onKey);addEventListener("keyup",onKey);addEventListener("resize",resize);
   $("#mzTools").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;if(b.dataset.tool)setTool(b.dataset.tool);
    const r=cv.getBoundingClientRect(),c=s2w(r.width/2,r.height/2);if(b.id==="mzZin"||b.id==="mzZout"){cam.z=Math.min(4,Math.max(.1,cam.z*(b.id==="mzZin"?1.25:.8)));cam.x=c.x-r.width/2/cam.z;cam.y=c.y-r.height/2/cam.z;dirty=true}if(b.id==="mzFit")centerView()});
   $("#mzTabs").addEventListener("click",e=>{const b=e.target.closest("[data-mt]");if(b){mt=b.dataset.mt;drawSide()}});
   $("#mzSend").addEventListener("submit",e=>{e.preventDefault();chatSubmit($("#mzIn").value);$("#mzIn").value=""});
   $("#mzDice").addEventListener("click",e=>{const b=e.target.closest("[data-d]");if(!b)return;const m=$("#mzMod").value.trim();chatSubmit("/r 1d"+b.dataset.d+(m?(/^[+-]/.test(m)?m:"+"+m):""))});
   $("#mzCopy").onclick=()=>copy(location.href.split("#")[0].split("?")[0]+"#sala="+code,"Link da mesa copiado. Mande para os jogadores.");
   $("#mzLeave").onclick=async()=>{if(await ask("Sair da mesa",`<p style="margin:0">${isHost()?"Fechar a mesa? Os jogadores perdem a conexão até você abrir de novo. A cena fica salva.":"Sair da mesa?"}</p>`,"Sair"))leave()};
   $("#mzSheet").onclick=()=>{if(cur){view("vSheet");$("#mesaBack").classList.remove("hidden")}};
   $("#mesaBack").onclick=()=>show(true);
   BUS.addEventListener("roll",e=>{if(!active||isHost()||!cur)return;const x=e.detail;send({t:"roll",e:x})});
   let shT=null;BUS.addEventListener("sheet",()=>{if(!active||isHost()||!cur)return;clearTimeout(shT);shT=setTimeout(()=>send({t:"sheet",S:shareable({...cur.S,retrato:""})}),300);if(mt==="eu")drawSideSoon()});
   BUS.addEventListener("init",e=>{if(!active||isHost())return;send({t:"init",val:e.detail.val})})}
  $("#mzSheet").classList.toggle("hidden",isHost());$("#mzChat").innerHTML="";chat.forEach(showChat);setTool("mover");mt="chat";drawSide()}
 let sdT=null;function drawSideSoon(){clearTimeout(sdT);sdT=setTimeout(drawSide,120)}
 function drawSide(force){if(!active)return;document.querySelectorAll("#mzTabs [data-mt]").forEach(b=>{b.classList.toggle("on",b.dataset.mt===mt);if(b.dataset.mt===mt)b.classList.remove("ping")});
  $("#mzChatWrap").classList.toggle("hidden",mt!=="chat");const P=$("#mzPanel");P.classList.toggle("hidden",mt==="chat");if(mt==="chat")return;
  const n=Object.values(conns).filter(c=>c.sheetId).length;$("#mzCount").textContent=isHost()?`${n} jogador${n===1?"":"es"}`:"";
  const ae=document.activeElement;if(!force&&ae&&P.contains(ae)&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName))return;
  if(mt==="jog")P.innerHTML=panelPlayers();else if(mt==="ini")P.innerHTML=panelInit();else if(mt==="cena")P.innerHTML=panelScene();else if(mt==="eu")P.innerHTML=panelMe()}
 function panelPlayers(){const L=Object.entries(conns).filter(([,c])=>c.sheetId&&c.S);const npcs=Object.values(st.tokens).filter(t=>!t.owner);
  return `<div class="mzsec">Jogadores ao vivo</div>${L.length?L.map(([p,c])=>masterCard(p,c.S,Date.now(),true).replace(/<\/div>$/,`<div class="cf"><button data-pview="${p}">Ver ficha completa</button></div></div>`)).join(""):`<div class="tip">Ninguém entrou ainda. Mande o link da mesa (botão Convidar, no topo).</div>`}
   <div class="mzsec">NPCs e inimigos <button type="button" data-act="npc">+ Token</button></div>${npcs.map(t=>`<div class="npc"><span class="sw" style="background:${esc(t.color)}"></span><b>${esc(t.name)}</b>${t.hidden?" <small>(escondido)</small>":""}<span class="pvs"><input type="number" data-npv="${t.id}" value="${esc(t.npc?.pv??"")}" aria-label="PV">/<input type="number" data-npm="${t.id}" value="${esc(t.npc?.pvm??"")}" aria-label="PV máx."></span><button type="button" data-tmenu="${t.id}">⋯</button></div>`).join("")||`<div class="tip">Nenhum.</div>`}`}
 function panelInit(){const L=st.init.list;const name=id=>st.tokens[id]?.name||"?";
  return `<div class="mzsec">Rodada ${st.init.round}</div>${L.length?`<ol class="inil">${L.map((x,i)=>`<li class="${i===st.init.turn?"on":""}"><span class="sw" style="background:${esc(st.tokens[x.id]?.color||"#555")}"></span><b>${esc(name(x.id))}</b>${isHost()?`<input type="number" data-iv="${i}" value="${x.v}">`:`<em>${x.v}</em>`}${isHost()?`<button type="button" data-irm="${i}">×</button>`:""}</li>`).join("")}</ol>`:`<div class="tip">Ninguém na iniciativa. ${isHost()?"Use os botões abaixo ou clique com o direito num token.":"Role Iniciativa na sua ficha: o valor vem para cá."}</div>`}
   ${isHost()?`<div class="btnrow"><button type="button" data-act="inext" class="primary">Próximo turno ▶</button><button type="button" data-act="iall">Rolar para todos os NPCs</button><button type="button" data-act="isort">Ordenar</button><button type="button" data-act="iclear" class="danger">Limpar</button></div>`:`<div class="btnrow"><button type="button" data-act="myini" class="primary">Rolar minha Iniciativa</button></div>`}`}
 function panelScene(){const g=st.grid;
  return `<div class="mzsec">Mapa</div><div class="btnrow"><label class="btn">Escolher imagem do mapa<input type="file" id="mzMap" accept="image/*" hidden></label>${st.map.has?`<button type="button" data-act="nomap">Tirar mapa</button>`:""}</div>
   <div class="g g2" style="margin-top:8px"><div><label>Largura (px, sem mapa)</label><input type="number" data-sc="map.w" value="${st.map.w}" ${st.map.has?"disabled":""}></div><div><label>Altura</label><input type="number" data-sc="map.h" value="${st.map.h}" ${st.map.has?"disabled":""}></div></div>
   <div class="mzsec">Grade</div><div class="g g2"><div><label>Tamanho da casa (px)</label><input type="number" min="20" max="300" data-sc="grid.size" value="${g.size}"></div><div><label>Cor</label><input type="color" data-sc="grid.color" value="${esc(g.color)}" style="height:38px;padding:2px"></div></div>
   <label class="ck"><input type="checkbox" data-sc="grid.show" ${g.show?"checked":""}> Mostrar grade</label><label class="ck"><input type="checkbox" data-sc="grid.snap" ${g.snap?"checked":""}> Encaixar tokens na grade</label>
   <div><label>Opacidade da grade</label><input type="range" min="0" max="1" step=".05" data-sc="grid.alpha" value="${g.alpha}"></div>
   <div class="mzsec">Jogadores veem</div><label class="ck"><input type="checkbox" data-sc="showBars" ${st.showBars?"checked":""}> barras de vida de todos (não só a própria)</label>
   <div class="mzsec">Limpar</div><div class="btnrow"><button type="button" data-act="cfog">Tirar toda a névoa</button><button type="button" data-act="ffog">Cobrir o mapa todo</button><button type="button" data-act="cdraw">Apagar desenhos</button><button type="button" data-act="cchat">Limpar chat</button></div>
   <div class="mzsec">Arquivo da cena</div><div class="btnrow"><button type="button" data-act="exp">Salvar cena em arquivo</button><label class="btn">Abrir cena<input type="file" id="mzImp" accept=".json,application/json" hidden></label><button type="button" data-act="new" class="danger">Cena nova</button></div>
   <p class="tip">A cena fica salva neste navegador. Atalhos: V mover, R régua, P ping, D lápis, F névoa, G revelar, setas movem o token, Delete remove. Clique direito num token abre o menu.</p>`}
 function panelMe(){if(!cur)return"";const S=cur.S,d=D(S);const bar=(k,lab,a,m)=>`<div class="mrow"><span>${lab}</span><div class="bar" style="--c:var(--${k})"><div style="width:${m>0?Math.max(0,Math.min(100,a/m*100)):0}%"></div></div><b>${a}/${m||"—"}</b><button type="button" data-mpm="${k}" data-d="-1">−</button><button type="button" data-mpm="${k}" data-d="1">+</button></div>`;
  const acts=Object.entries(S.cond||{});
  return `<div class="mehead">${S.retrato?`<img src="${S.retrato}" alt="">`:""}<div><b>${esc(S.nome)}</b><small>Evasiva ${d.eva} · Desloc. ${d.desl} m${d.cd!==""?" · CD "+d.cd:""}</small></div></div>
   ${bar("pv","PV",num(S.pv.a),d.pvM)}${bar("vb","VB",num(S.vb.a),d.vbM)}${bar("fe","Fé",num(S.fe.a),d.feU)}
   <div class="dmgrow"><input type="number" id="meDmg" placeholder="Dano"><select id="meDmgT"><option value="normal">normal</option><option value="brutal">brutal</option><option value="verdadeiro">verdadeiro</option></select><label class="ck"><input type="checkbox" id="meRes">Resistir</label><button type="button" data-act="medmg" class="danger">Receber</button></div>
   <div class="dmgrow"><input type="number" id="meHeal" placeholder="Cura"><select id="meHealT"><option value="pv">PV</option><option value="vb">VB</option><option value="fe">Fé</option></select><button type="button" data-act="meheal">Recuperar</button><button type="button" data-act="meturn">Início do turno</button></div>
   <div class="mzsec">Marcas do Limiar · ${LIMIAR[num(S.limiar)].n}</div><div class="limpips small">${[1,2,3,4,5].map(i=>`<button type="button" class="pip ${i<=num(S.limiar)?"on":""}" data-mlim="${i}">${i}</button>`).join("")}</div>
   <div class="mzsec">Condições</div><div class="chips">${acts.map(([n,L])=>`<span class="chip on">${esc(n)}${condInfo(S,n).lv?` <button type="button" data-mcl="${esc(n)}" data-d="-1">−</button>${L}<button type="button" data-mcl="${esc(n)}" data-d="1">+</button>`:""} <button type="button" data-mcx="${esc(n)}">×</button></span>`).join("")}
    <select id="meCadd"><option value="">+ condição</option>${COND.flatMap(([,it])=>it).concat((S.ccustom||[]).map(c=>c.n)).filter(n=>!S.cond[n]).map(n=>`<option>${esc(n)}</option>`).join("")}</select></div>
   <div class="mzsec">Rolar</div><div class="dmgrow"><select id="mePer">${PER.map(([n])=>`<option>${n}</option>`).join("")}</select><button type="button" data-act="meper">🎲 Perícia</button><button type="button" data-act="meini">Iniciativa</button></div>
   ${(S.atk||[]).filter(a=>a.arma).map((a,i)=>`<button type="button" class="atkb" data-matk="${S.atk.indexOf(a)}">⚔️ ${esc(a.arma)} <small>${esc(a.atq||"")} · ${esc(a.dano||"")}</small></button>`).join("")}
   <div class="mzsec">Poderes</div>${(S.pod||[]).map(p=>`<button type="button" class="powb" style="--tier:${GRAU_COR[p.grau]||"#5a4636"}" data-mpow="${p.id}"><b>${esc(p.nome||"Poder")}</b><small>${p.tipo==="Passivo"?(p.ligado?"ligado · ":"desligado · ")+"reserva ":""}${esc(p.custo||0)} Fé${p.rolagem?" · "+esc(p.rolagem):""}</small></button>`).join("")||`<div class="tip">Crie poderes na aba Grimório da ficha.</div>`}
   <div class="mzsec">Descansar</div><div class="rests small">${DESCANSOS.map(([k,n,p])=>`<button type="button" data-mrest="${k}"><b>${n}</b><small>${Math.round(p*100)}%</small></button>`).join("")}</div>`}
 function bindSide(){const P=$("#mzPanel");
  P.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;const a=b.dataset.act;const S=cur?.S;
   if(b.dataset.pview){const c=conns[b.dataset.pview];if(c&&c.S)readSheet(c.S);return}
   if(b.dataset.tmenu){const t=st.tokens[b.dataset.tmenu];if(t)tokenMenu(t);return}
   if(b.dataset.irm!==undefined){st.init.list.splice(+b.dataset.irm,1);if(st.init.turn>=st.init.list.length)st.init.turn=0;stateChanged();return}
   if(a==="npc")return tokenDlg(null);
   if(a==="inext"){if(!st.init.list.length)return;st.init.turn++;if(st.init.turn>=st.init.list.length){st.init.turn=0;st.init.round++}const t=st.tokens[st.init.list[st.init.turn].id];sys(`Vez de ${t&&!t.hidden?t.name:"um inimigo"} (rodada ${st.init.round}).`);stateChanged();return}
   if(a==="iall"){Object.values(st.tokens).filter(t=>!t.owner&&!st.init.list.find(x=>x.id===t.id)).forEach(t=>st.init.list.push({id:t.id,v:rollExpr("1d20").total}));st.init.list.sort((x,y)=>y.v-x.v);stateChanged();return}
   if(a==="isort"){st.init.list.sort((x,y)=>y.v-x.v);stateChanged();return}
   if(a==="iclear"){st.init={list:[],turn:0,round:1};stateChanged();return}
   if(a==="myini"||a==="meini"){if(S){const r=ACT.rollPer(S,"Iniciativa");if(r)send({t:"init",val:r.total})}return}
   if(a==="cfog"){st.fog=[];stateChanged();return}if(a==="ffog"){st.fog=[{x:0,y:0,w:st.map.w,h:st.map.h}];stateChanged();return}
   if(a==="cdraw"){st.draw=[];stateChanged();return}if(a==="cchat"){chat=[];$("#mzChat").innerHTML="";saveScene();return}
   if(a==="nomap"){mapData=null;mapImg=null;st.map.has=false;sendAll({t:"map",data:null});stateChanged();return}
   if(a==="exp"){download("cena-elyndor.json",JSON.stringify({elyndorCena:1,st,imgs,mapData}));return}
   if(a==="new"){if(!await ask("Cena nova",`<p style="margin:0">Apagar mapa, tokens de NPC, névoa e desenhos? Os tokens dos jogadores continuam.</p>`,"Apagar"))return;const keep=Object.fromEntries(Object.entries(st.tokens).filter(([,t])=>t.owner));st={...newState(),tokens:keep};mapData=null;mapImg=null;sendAll({t:"map",data:null});stateChanged();centerView();return}
   if(!S)return;
   if(b.dataset.mpm){const k=b.dataset.mpm;S[k].a=Math.max(0,num(S[k].a)+ +b.dataset.d);clampRes(S);sheetChanged();drawSide(true);return}
   if(a==="medmg"){const r=ACT.damage(S,{v:$("#meDmg").value,tipo:$("#meDmgT").value,resist:$("#meRes").checked});if(r)toast(r.text);sheetChanged();drawSide(true);return}
   if(a==="meheal"){ACT.heal(S,{v:$("#meHeal").value,alvo:$("#meHealT").value});sheetChanged();drawSide(true);return}
   if(a==="meturn"){ACT.turnStart(S);sheetChanged();drawSide(true);return}
   if(b.dataset.mlim){const v=+b.dataset.mlim;S.limiar=num(S.limiar)===v?v-1:v;sheetChanged();drawSide(true);return}
   if(b.dataset.mcl){ACT.setCond(S,b.dataset.mcl,num(S.cond[b.dataset.mcl])+ +b.dataset.d);sheetChanged();drawSide(true);return}
   if(b.dataset.mcx){ACT.setCond(S,b.dataset.mcx,0);sheetChanged();drawSide(true);return}
   if(a==="meper"){ACT.rollPer(S,$("#mePer").value);return}
   if(b.dataset.matk!==undefined){ACT.rollAtk(S,+b.dataset.matk);return}
   if(b.dataset.mpow){const r=ACT.usePower(S,+b.dataset.mpow);if(r){sheetChanged();drawSide(true)}return}
   if(b.dataset.mrest){ACT.rest(S,b.dataset.mrest);sheetChanged();drawSide(true);return}});
  P.addEventListener("change",async e=>{const t=e.target;
   if(t.id==="meCadd"&&t.value&&cur){ACT.setCond(cur.S,t.value,1);sheetChanged();drawSide(true);return}
   if(t.dataset.npv||t.dataset.npm){const tk=st.tokens[t.dataset.npv||t.dataset.npm];if(!tk)return;tk.npc=tk.npc||{};tk.npc[t.dataset.npv?"pv":"pvm"]=t.value;stateChanged();return}
   if(t.dataset.iv!==undefined){st.init.list[+t.dataset.iv].v=num(t.value);stateChanged();return}
   if(t.dataset.sc){const [a,b]=t.dataset.sc.split(".");const v=t.type==="checkbox"?t.checked:t.type==="range"||t.type==="number"?num(t.value):t.value;if(b)st[a][b]=v;else st[a]=v;if(t.dataset.sc==="grid.size")st.grid.size=Math.max(20,Math.min(300,v));stateChanged();return}
   if(t.id==="mzMap"){const f=t.files[0];if(!f)return;toast("Preparando o mapa…");const d=await shrink(f,2600,.82);setMap(d);sendAll({t:"map",data:d});t.value="";setTimeout(centerView,200);return}
   if(t.id==="mzImp"){const f=t.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.elyndorCena)throw 0;st=d.st;imgs=d.imgs||{};imgCache={};mapData=null;mapImg=null;if(d.mapData)setMap(d.mapData);sendAll({t:"map",data:d.mapData||null});for(const [id,x] of Object.entries(imgs))sendAll({t:"img",id,data:x});stateChanged();centerView();toast("Cena aberta.")}catch(_){toast("Arquivo de cena inválido.")}}});
  P.addEventListener("input",e=>{const t=e.target;if(t.dataset.sc&&t.type==="range"){st.grid.alpha=num(t.value);stateChanged()}})}
 function readSheet(S){const o=$("#sheetOverlay");o.classList.remove("hidden");$("#soTitle").textContent=S.nome||"Ficha";mountSheet($("#soHost"),fix(JSON.parse(JSON.stringify(S))),true)}
 document.addEventListener("DOMContentLoaded",()=>{});
 setTimeout(()=>{bindSide();$("#soClose").onclick=()=>{$("#sheetOverlay").classList.add("hidden");$("#soHost").innerHTML=""}},0);
 // mapas de mensagens de "map" nulos
 const _setMap=setMap;setMap=function(d){if(!d){mapData=null;mapImg=null;dirty=true;return}_setMap(d)};
 return{host,joinAsPlayer,leave,show,hostCode,get active(){return active},get role(){return role},_dbg:()=>({st,cam,w2s})};
})();
$("#bHost").onclick=()=>MESA.host();
