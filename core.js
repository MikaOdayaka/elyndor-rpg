"use strict";
/* ================= DADOS DO JOGO ================= */
const ATR=[["for","Força"],["agi","Agilidade"],["vit","Vitalidade"],["int","Intelecto"],["pre","Presença"],["esp","Espírito"]];
const AB=Object.fromEntries(ATR);
const ATR_KEYS={for:"for",forca:"for",força:"for",agi:"agi",agilidade:"agi",vit:"vit",vitalidade:"vit",int:"int",intelecto:"int",pre:"pre",presenca:"pre",presença:"pre",esp:"esp",espirito:"esp",espírito:"esp"};
const PER=[["Acrobacia","agi"],["Atletismo","for"],["Atuação","pre"],["Combate","for"],["Conhecimento","int"],["Diplomacia","pre"],["Enganação","pre"],["Fortitude","vit"],["Furtividade","agi"],["Iniciativa","agi"],["Intimidação","pre"],["Intuição","esp"],["Investigação","int"],["Ladinagem","agi"],["Medicina","int"],["Ofício","int"],["Percepção","esp"],["Reflexos","agi"],["Religião","esp"],["Sobrevivência","esp"],["Tecnologia Antiga","int"],["Vontade","esp"]];
const COND=[["Medo",["Abalado","Amedrontado","Apavorado"]],["Corpo",["Cansado","Exausto","Debilitado","Enjoado","Envenenado","Sangramento","Em Chamas","Lento"]],["Movimento e posição",["Derrubado","Agarrado","Enredado","Imóvel","Exposto","Surpreso"]],["Mente",["Atordoado","Pasmo","Confuso","Fascinado","Frustrado","Silenciado"]],["Sentidos",["Cego","Ofuscado","Surdo"]],["Graves",["Vulnerável","Indefeso","Paralisado","Inconsciente","Petrificado","Ressonância Instável"]]];
const COND_TXT={"Abalado": "−1 por nível em testes de perícia. Ao chegar ao nível 3, vira Amedrontado.", "Amedrontado": "−2 em ataques e testes enquanto puder ver a fonte do medo, e você não pode se aproximar dela por vontade própria.", "Apavorado": "Você gasta suas ações para se afastar da fonte do medo pelo caminho mais seguro. Se não puder fugir, fica Indefeso diante dela.", "Cansado": "−1 por nível em todos os testes, até o nível 3. Descanso médio remove 1 nível; longo remove todos.", "Exausto": "−3 em todos os testes e deslocamento pela metade. Se ficar Exausto de novo, cai Inconsciente.", "Debilitado": "−1 por nível em testes de Força, Agilidade e Vitalidade e no dano.", "Enjoado": "Em cada turno, você faz apenas uma ação ou um movimento, não os dois.", "Envenenado": "Sofre 1d6 de dano por nível no início de cada turno, ou o efeito do veneno. Medicina (CD 10 + 2 × nível) encerra.", "Sangramento": "Perde 1d4 PV por nível no início de cada turno. Uma ação para estancar reduz 1 nível; Medicina (CD 12) encerra tudo.", "Em Chamas": "Sofre 1d6 de fogo por nível no início de cada turno. Rolar no chão (um movimento) reduz 2 níveis; água apaga tudo.", "Lento": "Deslocamento pela metade, e você não pode usar ações rápidas nem reações.", "Derrubado": "−2 em ataques corpo a corpo. Inimigos corpo a corpo recebem +2 contra você; à distância, −2. Levantar gasta o movimento.", "Agarrado": "Deslocamento 0 e −2 em ataques que não sejam contra quem o agarra. Escapar exige um teste de Atletismo ou Acrobacia contra quem agarra.", "Enredado": "Deslocamento pela metade, −2 em ataques e −2 na Evasiva. Uma ação e um teste de Força (CD 12) libertam você.", "Imóvel": "Deslocamento 0. Você ainda pode atacar e usar poderes.", "Exposto": "−2 por nível na Evasiva.", "Surpreso": "Até o fim do seu primeiro turno, você não pode usar reações nem soma o bônus de estilo na Evasiva. Você não perde ações.", "Atordoado": "Você perde sua ação e seu movimento e não pode usar reações.", "Pasmo": "Você não pode usar ações, só movimento.", "Confuso": "No início do turno, role 1d6: 1 — ataca a criatura mais próxima; 2–3 — move-se ao acaso; 4–6 — age normalmente.", "Fascinado": "Você só observa a fonte do fascínio e sofre −5 em Percepção para outras coisas. Qualquer ameaça ou dano encerra o efeito.", "Frustrado": "−1 por nível na CD dos seus poderes e em testes de Ressonância.", "Silenciado": "Você não pode falar nem usar poderes que dependam da voz.", "Cego": "Falha em qualquer teste que dependa da visão. −5 na Evasiva, e seus ataques erram em 1–3 num d6 (role antes do ataque).", "Ofuscado": "−1 por nível em ataques e em Percepção.", "Surdo": "Falha em testes de audição, −2 em Iniciativa, e poderes que dependam da voz falham em 1–2 num d6.", "Vulnerável": "Você sofre +2 de dano por nível, de todas as fontes.", "Indefeso": "Sua Evasiva vira 5, e ataques corpo a corpo contra você são acertos críticos automáticos.", "Paralisado": "Você não se move nem age e fica Indefeso. Ainda pode pensar e usar Fé em poderes que não exigem gestos.", "Inconsciente": "Você cai, solta o que segura, não percebe nada e fica Indefeso.", "Petrificado": "Seu corpo vira pedra. Você fica Inconsciente, não envelhece e reduz à metade todo dano sofrido até o efeito acabar.", "Ressonância Instável": "Seus poderes falham em 1–2 num d6, mas a Fé é gasta mesmo assim."};
/* efeitos automáticos de cada condição (por nível quando lv:1) */
const COND_FX={
 Abalado:{lv:1,per:-1},Amedrontado:{test:-2},Cansado:{lv:1,max:3,test:-1},Exausto:{test:-3,half:1},
 Debilitado:{lv:1,attr:{for:-1,agi:-1,vit:-1},dano:-1},Envenenado:{lv:1,dot:"1d6",dotT:"normal"},Sangramento:{lv:1,dot:"1d4",dotT:"pv"},
 "Em Chamas":{lv:1,dot:"1d6",dotT:"normal"},Lento:{half:1,noR:1},Agarrado:{zero:1},Enredado:{half:1,atk:-2,eva:-2},Imóvel:{zero:1},
 Exposto:{lv:1,eva:-2},Surpreso:{noStyle:1,noR:1},Atordoado:{noR:1},Fascinado:{perOnly:{Percepção:-5}},Frustrado:{lv:1,cd:-1},
 Cego:{eva:-5},Ofuscado:{lv:1,atk:-1,perOnly:{Percepção:-1}},Surdo:{perOnly:{Iniciativa:-2}},Vulnerável:{lv:1,sofre:2},
 Indefeso:{evaSet:5},Paralisado:{evaSet:5,zero:1,noR:1},Inconsciente:{evaSet:5,zero:1,noR:1},Petrificado:{evaSet:5,zero:1,noR:1}};
const LIMIAR=[{n:"Inteiro",t:0,eva:0,txt:"Sem marcas."},{n:"Ferido",t:-1,eva:0,txt:"−1 em ataques e testes."},{n:"Machucado",t:-2,eva:-1,txt:"−2 em ataques e testes; −1 Evasiva."},
 {n:"Abatido",t:-3,eva:-2,desl:-3,txt:"−3 em ataques e testes; −2 Evasiva; −3 m de deslocamento."},
 {n:"Quebrado",t:-4,eva:-3,half:1,noR:1,txt:"−4 em ataques e testes; −3 Evasiva; deslocamento pela metade; sem reações."},
 {n:"À beira",t:-5,eva:-4,half:1,noR:1,txt:"−5 em ataques e testes; −4 Evasiva; metade do deslocamento; sem reações. O próximo golpe nos PV leva ao Limiar da Morte."}];
const DESCANSOS=[["relaxar","Relaxar",.05,0],["curto","Descanso curto",.15,1],["medio","Descanso médio",.40,2],["longo","Descanso longo",1,5]];
const SIGNOS=["O Pergaminho","A Montanha","A Lâmina","O Escudo","A Chama","O Lobo","A Coroa","A Raposa","A Bigorna","A Andorinha","A Engrenagem","O Espelho","A Tempestade","A Serpente","A Lua Nova","O Laço"];
const ESTILOS_LIST=[["Guardião", "Proteção", "+1 Evasiva empunhando escudo.", "<b>Interpor</b> (reação, 1/rodada): quando um aliado adjacente for atacado, você se torna o alvo do ataque."], ["Vanguarda", "Linha de frente", "+3 Vida Bruta; ignora o traço Lenta.", "<b>Esmagar</b>: +1 dano com armas pesadas e muito pesadas."], ["Duelista", "Combate um a um", "+1 Evasiva.", "<b>Leitura de Duelo</b>: +1 ataque com arma leve ou média empunhada em uma mão."], ["Relâmpago", "Velocidade", "+1 Evasiva.", "<b>Passo Rápido</b>: +2 m de deslocamento."], ["Atirador", "Distância", "+1 ataque à distância.", "<b>Olho de Águia</b> (1/cena): ignore a cobertura parcial de um alvo."], ["Batedor", "Exploração e terreno", "+1 Evasiva.", "<b>Trilheiro</b>: +1 em Percepção e Sobrevivência, e terreno difícil não reduz seu deslocamento."], ["Estrategista", "Análise e suporte", "Sem bônus de Evasiva.", "<b>Ler o Inimigo</b> (ação rápida): teste de Investigação contra CD 12 + nível do alvo. Em sucesso, aliados recebem +1 em ataques contra ele até o fim da rodada."], ["Canalizador", "Poderes e foco", "Sem bônus de Evasiva.", "<b>Condução</b>: +1 na CD de poderes de Ressonância enquanto empunha um foco."], ["Engenhoso", "Ferramentas e relíquias", "Sem bônus de Evasiva.", "<b>Mão na Massa</b>: usar um item ou ferramenta custa ação rápida; +1 em ataques com armas tecnológicas ou criadas por você."], ["Comandante", "Liderança", "Sem bônus de Evasiva.", "<b>Ordem de Batalha</b> (ação rápida, 1/rodada): um aliado que possa ouvi-lo recebe +1 em ataque ou Evasiva até o seu próximo turno."], ["Berserker", "Fúria", "+3 Vida Bruta.", "<b>Sangue Quente</b>: enquanto estiver com metade dos PV ou menos, +2 de dano corpo a corpo."], ["Lanceiro", "Alcance", "+1 Evasiva.", "<b>Manter Distância</b> (reação, 1/rodada): quando um inimigo entra no alcance da sua arma de haste, faça um ataque contra ele."], ["Lâmina Dupla", "Duas armas", "+1 Evasiva.", "<b>Ritmo Duplo</b> (ação rápida): depois de atacar com uma arma leve, ataque com a outra mão. Esse segundo golpe não soma atributo no dano."], ["Punho Livre", "Combate desarmado", "+2 Evasiva sem armadura média ou pesada.", "<b>Corpo Treinado</b>: seus golpes desarmados causam 1d6 + Força e, em acerto, podem empurrar o alvo 1,5 m."], ["Sombra", "Furtividade", "+1 Evasiva.", "<b>Golpe Oculto</b>: +1d6 de dano contra alvos Surpresos ou que não conseguem ver você."], ["Caçador", "Presa marcada", "Sem bônus de Evasiva.", "<b>Marcar a Presa</b> (ação rápida): +1 em ataques e +2 de dano contra o alvo marcado até o fim da cena. Trocar a marca custa outra ação rápida."], ["Arremessador", "Armas de arremesso", "+1 em ataques de arremesso.", "<b>Chuva de Lâminas</b> (ação, 1/cena): arremesse contra até 3 alvos a 9 m, com −2 em cada ataque."], ["Pistoleiro", "Armas de fogo", "+1 Evasiva.", "<b>Gatilho Rápido</b>: sacar e recarregar são ações livres, e você recebe +2 em Iniciativa."], ["Cavaleiro", "Armadura pesada", "+5 Vida Bruta usando armadura pesada.", "<b>Muralha Viva</b>: ignora a primeira penalidade da armadura, e inimigos adjacentes sofrem −1 em ataques contra seus aliados."], ["Ripostador", "Contra-ataque", "+1 Evasiva.", "<b>Riposta</b> (reação, 1/rodada): quando um ataque corpo a corpo erra você, faça um ataque contra o atacante."], ["Lutador", "Agarrão", "+3 Vida Bruta.", "<b>Pegada de Ferro</b>: +2 para agarrar e derrubar; quem estiver agarrado por você sofre 1d4 no início de cada turno."], ["Dançarino de Lâminas", "Giro e fluidez", "+2 Evasiva sem armadura pesada.", "<b>Giro</b>: se você se moveu ao menos 3 m antes de atacar, +1 no ataque e no dano."], ["Sentinela", "Vigilância", "Sem bônus de Evasiva.", "<b>Vigília</b>: +2 em Percepção e Iniciativa, e você nunca fica Surpreso."], ["Médico de Campo", "Socorro", "Sem bônus de Evasiva.", "<b>Primeiros Socorros</b> (ação rápida, 1/rodada): um aliado adjacente recupera 1d6 + Intelecto de Vida Bruta. Estabilizar alguém custa só uma ação rápida."], ["Lâmina Ressonante", "Arma e Fé", "Sem bônus de Evasiva.", "<b>Golpe Canalizado</b> (1/rodada): ao acertar, gaste 3 Fé para somar +1d8 de dano do tipo da sua Ressonância."], ["Ritualista", "Preparo de poderes", "Sem bônus de Evasiva.", "<b>Preparo</b> (ação rápida): o próximo poder que você usar até o fim do seu próximo turno custa 2 Fé a menos (mínimo 1)."], ["Provocador", "Atrair golpes", "+3 Vida Bruta.", "<b>Insulto</b> (ação rápida): Intimidação contra a Vontade do alvo. Em sucesso, ele sofre −2 em ataques contra qualquer um que não seja você até o seu próximo turno."], ["Arauto da Canção", "Inspiração", "Sem bônus de Evasiva.", "<b>Canção de Guerra</b> (ação rápida para começar, mantida): aliados a até 9 m recebem +1 em Fortitude, Reflexos e Vontade."], ["Instintivo", "Reação animal", "+1 Evasiva.", "<b>Instinto</b>: na primeira vez na cena em que seus PV caem para metade ou menos, você ganha um movimento extra imediatamente."], ["Oportunista", "Golpes baixos", "+1 Evasiva.", "<b>Aproveitar a Brecha</b>: +2 de dano contra alvos Derrubados, Agarrados, Enredados ou cercados por dois aliados seus."], ["Artilheiro", "Bestas e rifles", "+1 em ataques com bestas e rifles.", "<b>Tiro Pesado</b> (ação completa): o ataque causa +1d8 de dano e ignora 5 de Vida Bruta."], ["Escudo Ofensivo", "Escudo como arma", "+1 Evasiva empunhando escudo.", "<b>Pancada de Escudo</b> (ação rápida, 1/rodada): 1d4 + Força de dano e empurra o alvo 1,5 m."], ["Sobrevivente", "Aguentar firme", "+3 Vida Bruta.", "<b>Fôlego Extra</b> (ação rápida, 1/cena): recupere 1d8 + Vitalidade de Vida Bruta."], ["Armadilheiro", "Terreno preparado", "Sem bônus de Evasiva.", "<b>Armadilha</b> (ação): prepare um espaço a até 3 m. Quem entrar faz Reflexos (CD 12 + Intelecto); em falha, sofre 1d6 e fica Imóvel por 1 rodada."], ["Escaramuçador", "Bater e correr", "+1 Evasiva.", "<b>Recuo Treinado</b>: depois de atacar, mova-se até 3 m sem provocar reações."], ["Executor", "Finalização", "Sem bônus de Evasiva.", "<b>Golpe de Misericórdia</b>: +1d8 de dano contra alvos com metade dos PV ou menos."], ["Égide", "Proteção pela Fé", "Sem bônus de Evasiva.", "<b>Escudo de Fé</b> (reação, 4 Fé): um aliado a até 9 m recebe +5 de Vida Bruta temporária contra um ataque."], ["Trapaceiro", "Fintas e truques", "+1 Evasiva.", "<b>Finta</b> (ação rápida): Enganação contra a Intuição do alvo. Em sucesso, ele fica Exposto até o seu próximo ataque."]];
const ARV=[["Potência",["Força Bruta","Destruição","Resiliência"]],["Movimento",["Reflexo","Acrobacia","Investida"]],["Alma",["Canalização","Determinação","Ascensão"]],["Conhecimento",["Estratégia","Engenharia","Ocultismo"]],["Surto",["Fúria","Ousadia","Caçada"]]];
const GRAUS=["Truque","Menor","Comum","Forte","Decisivo","Final"];
const GRAU_COR={Truque:"#6b7a3a",Menor:"#24507a",Comum:"#2f6b3a",Forte:"#a0441a",Decisivo:"#8e1b1b",Final:"#5b2d7a"};
const DONS_NV=[1,5,10,25,40,50];
const LISTS={
 atk:[["arma","Arma",2.6],["atq","Ataque",.9],["dano","Dano",1.3],["tipo","Tipo",1],["trac","Traços e alcance",2.4],["roll","",.55,"roll"]],
 pas:[["n","Nome",1.6],["e","Efeito",3.6,"ta"],["a","Asc.",.5,"cb"]],
 eq:[["on","Usa",.45,"cb"],["i","Item",3],["q","Qtd.",.55],["p","Peso",.55],["pv","+PV",.6,"num"],["vb","+VB",.6,"num"],["fe","+Fé",.6,"num"],["ev","+Eva",.6,"num"]],
 bon:[["n","De onde vem (estilo, árvore, passiva…)",3],["pv","+PV",.6,"num"],["vb","+VB",.6,"num"],["fe","+Fé",.6,"num"],["ev","+Eva",.6,"num"]],
 ofi:[["n","Ofício",3],["g","Grau",2]]
};
const TIERS={Truque:"2–5 Fé · nível 1",Menor:"6–10 Fé · nível 1",Comum:"12–18 Fé · nível 5",Forte:"20–30 Fé · nível 10",Decisivo:"35–50 Fé · nível 20",Final:"55–75 Fé · nível 30"};
const PF=["nome","custo","grau","tipo","acao","alcance","teste","duracao","freq","efeito","limite","evolucao","asc_nome","asc_nivel","asc_efeito","rolagem","som"];
const SONS=[["brilho","Brilho"],["fogo","Fogo"],["impacto","Impacto"],["cura","Cura"],["sombra","Sombra"],["raio","Raio"],["vento","Vento"],["gelo","Gelo"],["nenhum","Sem som"],["proprio","Meu som (arquivo)"]];

function blank(nome){return{v:2,nome:nome||"",jogador:"",signo:"",nivel:1,estilos:"",ressonancia:"",
 atr:Object.fromEntries(ATR.map(([k])=>[k,10])),pv:{a:"",base:""},vb:{a:"",base:""},fe:{a:"",base:""},
 eva:{est:0,out:0},desl:"9",cd:"",carga:"",sr:[false,false,false,false],
 arm:{n:"",vb:"",res:"",rm:"",pen:""},esc:{n:"",vb:"",res:"",rm:"",pen:""},
 cond:{},ccustom:[],condMax:5,limiar:0,
 per:Object.fromEntries(PER.map(([n])=>[n,{t:false,o:0}])),
 atk:[{}],arv:ARV.map(()=>({b:0,sub:"",s:0})),pta:"",dons:DONS_NV.map(nv=>({nv,n:"",e:""})),pas:[{}],eq:[{}],bon:[],griv:"",cargaTot:"",ofi:[],
 res:{nome:"",raiz:"",img:"",lim:""},pod:[],sons:{},cor:"#8e1b1b",
 conceito:"",idade:"",altura:"",marca:"",aparencia:"",personalidade:"",medos:"",desejos:"",historia:"",aliados:"",notas:"",retrato:"",mesa:"",sala:""}}
function fix(s){const b=blank();
 if(Array.isArray(s.pod))s.pod=s.pod.filter(p=>p&&Object.keys(p).length).map((p,i)=>p.nome!==undefined?p:{id:Date.now()+i,nome:p.n||"",grau:p.g||"",custo:p.c||"",tipo:p.ps?"Passivo":"Ativo",ligado:!!p.ps,efeito:p.e||""});
 ["pv","vb","fe"].forEach(k=>{if(s[k]&&s[k].base===undefined){s[k].base=s[k].m??"";delete s[k].m}});
 if(s.cond)for(const k in s.cond)if(s.cond[k]===true)s.cond[k]=1;
 if(typeof s.desl==="string")s.desl=s.desl.replace(/[^\d.,]/g,"").replace(",",".")||"9";
 for(const k in b){if(s[k]===undefined)s[k]=b[k];else if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k]))for(const j in b[k])if(s[k][j]===undefined)s[k][j]=b[k][j]}
 return s}

/* ================= UTIL ================= */
const $=s=>document.querySelector(s);
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const num=v=>{const n=parseFloat(String(v??"").replace(",","."));return isNaN(n)?0:n};
const mod=v=>(v===""||v==null||isNaN(v))?0:Math.floor((Number(v)-10)/2);
const sg=n=>(n>=0?"+":"")+n;
const treino=nv=>nv>=40?5:nv>=25?4:nv>=10?3:2;
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("on"),2800)}
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){toast("Não deu para salvar neste navegador (memória cheia ou modo privado).");return false}}};
function copy(t,msg){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast(msg||"Copiado."),()=>{prompt("Copie:",t)})}
function download(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function when(t){if(!t)return"";const d=new Date(t);return d.toLocaleDateString("pt-BR")+" às "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
function uid(){return [...crypto.getRandomValues(new Uint8Array(8))].map(b=>b.toString(16).padStart(2,"0")).join("")}
const BUS=new EventTarget();
const emit=(t,d)=>BUS.dispatchEvent(new CustomEvent(t,{detail:d}));

/* ================= REGRAS: VALORES CALCULADOS ================= */
function condInfo(S,name){const c=(S.ccustom||[]).find(x=>x.n===name);if(c)return{lv:!!c.lv,max:num(c.max)||0,txt:c.e||"",fx:{test:-num(c.t),eva:-num(c.ev),dot:c.dot||"",dotT:c.dotT||"normal"},custom:1};
 const fx=COND_FX[name]||{};return{lv:!!fx.lv,max:fx.max||0,txt:COND_TXT[name]||"",fx}}
function armEff(a){const vb=num(a.vb);if(!vb)return 0;const rm=num(a.rm),r=a.res===""?rm:num(a.res);if(!rm)return vb;if(r<=0)return 0;if(r*2<=rm)return Math.floor(vb/2);return vb}
function armState(a){const rm=num(a.rm),r=a.res===""?rm:num(a.res);if(!rm||!num(a.vb))return"";if(r<=0)return"quebrada";if(r*2<=rm)return"avariada";return"inteira"}
function D(S){
 const fx={test:0,atk:0,per:0,eva:0,evaSet:null,noStyle:0,half:0,zero:0,deslFlat:0,cd:0,dano:0,sofre:0,noR:0,attr:{},perOnly:{},dots:[]};
 const add=(f,L)=>{const m=f.lv?L:1;fx.test+=(f.test||0)*m;fx.atk+=(f.atk||0)*m;fx.per+=(f.per||0)*m;fx.eva+=(f.eva||0)*m;fx.cd+=(f.cd||0)*m;fx.dano+=(f.dano||0)*m;fx.sofre+=(f.sofre||0)*m;
  if(f.evaSet!=null)fx.evaSet=f.evaSet;if(f.noStyle)fx.noStyle=1;if(f.half)fx.half=1;if(f.zero)fx.zero=1;if(f.noR)fx.noR=1;if(f.desl)fx.deslFlat+=f.desl;
  if(f.attr)for(const k in f.attr)fx.attr[k]=(fx.attr[k]||0)+f.attr[k]*m;if(f.perOnly)for(const k in f.perOnly)fx.perOnly[k]=(fx.perOnly[k]||0)+f.perOnly[k]*m};
 for(const [n,L] of Object.entries(S.cond||{})){const ci=condInfo(S,n),lvl=num(L)||1;add({...ci.fx,lv:ci.lv},lvl);
  if(ci.fx.dot){const m=String(ci.fx.dot).match(/^(\d*)d(\d+)(.*)$/);const mult=ci.lv?lvl:1;fx.dots.push({n,expr:m?((+m[1]||1)*mult)+"d"+m[2]+(m[3]||""):ci.fx.dot,dotT:ci.fx.dotT||"normal"})}}
 const L=LIMIAR[Math.max(0,Math.min(5,num(S.limiar)))];fx.test+=L.t;fx.eva+=L.eva||0;fx.deslFlat-=(L.desl?3:0);if(L.half)fx.half=1;if(L.noR)fx.noR=1;
 const bon={pv:0,vb:0,fe:0,ev:0};(S.eq||[]).forEach(r=>{if(r.on)for(const k in bon)bon[k]+=num(r[k])});(S.bon||[]).forEach(r=>{for(const k in bon)bon[k]+=num(r[k])});
 const aV=armEff(S.arm),eV=armEff(S.esc);
 const pvM=num(S.pv.base)+bon.pv,vbM=num(S.vb.base)+aV+eV+bon.vb,feM=num(S.fe.base)+bon.fe;
 const rsv=(S.pod||[]).filter(p=>p.tipo==="Passivo"&&p.ligado).reduce((s,p)=>s+num(p.custo),0);
 const ag=mod(S.atr.agi);
 const evaBase=10+ag+(fx.noStyle?0:num(S.eva.est))+num(S.eva.out)+bon.ev;
 const eva=fx.evaSet!=null?fx.evaSet:Math.max(0,evaBase+fx.eva);
 let desl=num(S.desl)||9;desl=Math.max(0,desl+fx.deslFlat);if(fx.half)desl=Math.floor(desl/2*10)/10;if(fx.zero)desl=0;
 const nv=num(S.nivel)||1,tr=treino(nv);
 const per={};PER.forEach(([n,a])=>{const m=mod(S.atr[a]),t=S.per[n]?.t?tr:0,o=num(S.per[n]?.o),pen=fx.test+fx.per+(fx.attr[a]||0)+(fx.perOnly[n]||0);per[n]={m,t,o,pen,tot:m+t+o+pen}});
 return{fx,bon,aV,eV,pvM,vbM,feM,rsv,feU:Math.max(0,feM-rsv),eva,evaBase,desl,per,lim:L,cd:S.cd===""?"":num(S.cd)+fx.cd}}
function summary(S){const d=D(S);return{nome:S.nome,jogador:S.jogador,signo:S.signo,nivel:S.nivel,cor:S.cor,pv:num(S.pv.a),pvM:d.pvM,vb:num(S.vb.a),vbM:d.vbM,fe:num(S.fe.a),feM:d.feU,eva:d.eva,cd:d.cd,desl:d.desl,limiar:num(S.limiar),cond:{...S.cond},ini:d.per.Iniciativa.tot,arm:armState(S.arm)}}

/* ================= DADOS (rolagens) ================= */
function rollExpr(expr,S){
 const src=String(expr||"").trim();if(!src)return null;
 const toks=src.replace(/\s+/g,"").match(/[+-]?[^+-]+/g)||[];let total=0;const parts=[];let d20=null,dice=[];
 for(let tk of toks){let sign=1;if(tk[0]==="-"){sign=-1;tk=tk.slice(1)}else if(tk[0]==="+")tk=tk.slice(1);
  const m=tk.match(/^(\d*)d(\d+)$/i);
  if(m){const n=Math.min(100,+m[1]||1),f=+m[2];const rs=[];for(let i=0;i<n;i++)rs.push(1+Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*f));const s=rs.reduce((a,b)=>a+b,0)*sign;total+=s;parts.push(`${sign<0?"−":""}${n}d${f}[${rs.join(",")}]`);if(f===20&&n===1)d20=rs[0];dice.push({n,f,rs,sign});continue}
  if(/^\d+(\.\d+)?$/.test(tk)){total+=sign*Number(tk);parts.push((sign<0?"−":"+")+tk);continue}
  const k=ATR_KEYS[tk.toLowerCase()];if(k&&S){const v=mod(S.atr[k]);total+=sign*v;parts.push(`${sign<0?"−":"+"}${tk}(${sg(v)})`);continue}
  if(/^nv|nivel|nível$/i.test(tk)&&S){const v=num(S.nivel);total+=sign*v;parts.push(`+nv(${v})`);continue}
  const per=S&&PER.find(([n])=>n.toLowerCase()===tk.toLowerCase());if(per){const v=D(S).per[per[0]].tot;total+=sign*v;parts.push(`+${per[0]}(${sg(v)})`);continue}
  return{err:"Não entendi: "+tk}}
 return{expr:src,total,detail:parts.join(" ").replace(/^\+/,""),d20,crit:d20===20,fail:d20===1,dice}}
function critExpr(expr){return String(expr).replace(/(\d*)d(\d+)/gi,(m,a,b)=>(2*(+a||1))+"d"+b)}

/* ================= SOM ================= */
let AC=null;const muted=()=>LS.get("elyndor-mudo")===true;
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==="suspended")AC.resume();return AC}
function tone(c,{f=440,f2=null,t=0,d=.3,type="sine",g=.18,at=.005}){const o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(f,c.currentTime+t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,c.currentTime+t+d);
 v.gain.setValueAtTime(0,c.currentTime+t);v.gain.linearRampToValueAtTime(g,c.currentTime+t+at);v.gain.exponentialRampToValueAtTime(.0001,c.currentTime+t+d);o.connect(v).connect(c.destination);o.start(c.currentTime+t);o.stop(c.currentTime+t+d+.05)}
function noise(c,{t=0,d=.4,g=.2,ft="lowpass",f=1200,f2=null,q=1}){const len=Math.ceil(c.sampleRate*(d+.05)),b=c.createBuffer(1,len,c.sampleRate),x=b.getChannelData(0);for(let i=0;i<len;i++)x[i]=Math.random()*2-1;
 const s=c.createBufferSource();s.buffer=b;const fl=c.createBiquadFilter();fl.type=ft;fl.Q.value=q;fl.frequency.setValueAtTime(f,c.currentTime+t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,c.currentTime+t+d);
 const v=c.createGain();v.gain.setValueAtTime(g,c.currentTime+t);v.gain.exponentialRampToValueAtTime(.0001,c.currentTime+t+d);s.connect(fl).connect(v).connect(c.destination);s.start(c.currentTime+t);s.stop(c.currentTime+t+d+.05)}
const SYNTH={
 brilho:c=>{[660,880,1320,1760].forEach((f,i)=>tone(c,{f,t:i*.06,d:.5,g:.12}))},
 fogo:c=>{noise(c,{d:.7,g:.35,f:400,f2:2400,q:.7});tone(c,{f:90,f2:50,d:.5,g:.2,type:"triangle"})},
 impacto:c=>{tone(c,{f:140,f2:38,d:.45,g:.45});noise(c,{d:.12,g:.4,f:3000,ft:"bandpass"})},
 cura:c=>{[523,659,784,1046].forEach((f,i)=>tone(c,{f,t:i*.09,d:.8,g:.1,type:"triangle",at:.04}))},
 sombra:c=>{tone(c,{f:110,f2:70,d:.9,g:.12,type:"sawtooth"});tone(c,{f:113,f2:66,d:.9,g:.12,type:"sawtooth"});noise(c,{d:.8,g:.08,f:300})},
 raio:c=>{noise(c,{d:.35,g:.5,ft:"highpass",f:1800});[0,.07,.15].forEach(t=>noise(c,{t,d:.08,g:.4,ft:"bandpass",f:4000,q:3}));tone(c,{f:60,d:.6,g:.25})},
 vento:c=>{noise(c,{d:1,g:.3,ft:"bandpass",f:300,f2:2000,q:4})},
 gelo:c=>{[1568,2093,2637].forEach((f,i)=>tone(c,{f,t:i*.04,d:.35,g:.08,type:"triangle"}));noise(c,{d:.3,g:.12,ft:"highpass",f:5000})},
 dado:c=>{[0,.05,.11,.16].forEach(t=>noise(c,{t,d:.04,g:.25,ft:"bandpass",f:2500+Math.random()*1500,q:2}))},
 dano:c=>{tone(c,{f:200,f2:60,d:.25,g:.3,type:"square"})},
 descanso:c=>{[392,523,659].forEach((f,i)=>tone(c,{f,t:i*.15,d:1,g:.08,at:.08}))}};
function playSound(key,custom){if(muted()||key==="nenhum")return;
 if(key==="proprio"&&custom){try{const a=new Audio(custom);a.volume=.8;a.play().catch(()=>{})}catch(e){}return}
 const c=ac();if(!c)return;(SYNTH[key]||SYNTH.brilho)(c)}

/* ================= EFEITO VISUAL ================= */
let FXC=null,FXP=[],FXrun=false;
function fxBurst(x,y,color="#d9b86a",big=1){if(!FXC){FXC=document.createElement("canvas");FXC.id="fx";document.body.appendChild(FXC)}
 FXC.width=innerWidth;FXC.height=innerHeight;
 for(let i=0;i<60*big;i++){const a=Math.random()*Math.PI*2,s=1.5+Math.random()*5*big;FXP.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,l:1,c:Math.random()<.35?"#fff3c4":color,r:1.5+Math.random()*3})}
 FXP.push({ring:1,x,y,r:6,l:1,c:color});if(!FXrun){FXrun=true;requestAnimationFrame(fxStep)}}
function fxStep(){const g=FXC.getContext("2d");g.clearRect(0,0,FXC.width,FXC.height);
 FXP=FXP.filter(p=>p.l>0);for(const p of FXP){if(p.ring){p.r+=7;p.l-=.035;g.strokeStyle=p.c;g.globalAlpha=Math.max(0,p.l);g.lineWidth=4*p.l+1;g.beginPath();g.arc(p.x,p.y,p.r,0,7);g.stroke();continue}
  p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.vx*=.98;p.l-=.018;g.globalAlpha=Math.max(0,p.l);g.fillStyle=p.c;g.beginPath();g.arc(p.x,p.y,p.r*p.l+.5,0,7);g.fill()}
 g.globalAlpha=1;if(FXP.length)requestAnimationFrame(fxStep);else{FXrun=false;g.clearRect(0,0,FXC.width,FXC.height)}}
function fxAt(el,color,big){const r=el?.getBoundingClientRect?.();if(r)fxBurst(r.left+r.width/2,r.top+r.height/2,color,big);else fxBurst(innerWidth/2,innerHeight/2,color,big)}

/* ================= REGISTRO DE ROLAGENS ================= */
const LOG=[];
function logAdd(e){e.t=e.t||Date.now();LOG.push(e);if(LOG.length>80)LOG.shift();drawLog(e)}
function rollCard(e){const cls=e.crit?"crit":e.fail?"fail":"";
 return `<div class="rl ${e.kind||""} ${cls}"><div class="rl-h"><b>${esc(e.who||"")}</b> ${esc(e.label||"")}</div>${e.text?`<div class="rl-t">${esc(e.text)}</div>`:""}${e.total!=null?`<div class="rl-r"><span class="rl-d">${esc(e.detail||"")}</span><span class="rl-n">${e.total}</span></div>`:""}${e.extra?`<div class="rl-x">${esc(e.extra)}</div>`:""}</div>`}
function drawLog(last){const box=$("#logList");if(!box)return;box.innerHTML=LOG.slice().reverse().map(rollCard).join("");
 const p=$("#logPanel");if(p&&last&&!p.classList.contains("open")){p.classList.add("ping");setTimeout(()=>p.classList.remove("ping"),900)}}
