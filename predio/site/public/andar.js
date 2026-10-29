import { criarConversa } from './conversa.js';

const SETORES=['diretoria','pesquisa','criacao','producao','qualidade','ferramentas','documentacao'];
const NOMES={diretoria:'Diretoria',pesquisa:'Pesquisa',criacao:'Criação',producao:'Produção',qualidade:'Qualidade',ferramentas:'Ferramentas',documentacao:'Documentação'};
const CARGOS={diretoria:'Diretor',pesquisa:'Pesquisador',criacao:'Criador',producao:'Desenvolvedor',qualidade:'Revisor',ferramentas:'Especialista em ferramentas',documentacao:'Documentalista'};
const ESTADOS={ativo:'Ativo',feito:'Feito',pendente:'Pendente',pulado:'Pulado'};
const CORES={ativo:0x8bc6ff,feito:0x9ce0b7,pendente:0xffcf82,pulado:0xacb7c0};
const PALETA={diretoria:'#bb91dc',pesquisa:'#62b8c5',criacao:'#e9aa73',producao:'#769fe2',qualidade:'#83bb94',ferramentas:'#dbb562',documentacao:'#c48fa7'};
const ICONES={gpt:'✦',agente:'♟',web:'◎',terminal:'⌘',instalacao:'⚙',chat:'☏',mcp:'◇',skill:'✧'};
const $=id=>document.getElementById(id);
const texto=value=>value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
const array=value=>Array.isArray(value)?value:[];
const el=(tag,content,className)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=texto(content);if(className)node.className=className;return node;};
const pasta=new URLSearchParams(location.search).get('pasta');
let tema=null,themeKnown=false,themeRequested=false;
const cor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:null;
async function loadTheme(signal){
  try{tema=await api(`/api/tema?pasta=${encodeURIComponent(pasta)}`,{signal});themeKnown=true;}
  catch(error){if(error.status===404){tema=null;themeKnown=true;}else return;}
  $('theme-actions').hidden=false;$('create-theme').hidden=!!tema||!themeKnown;
  $('open-dashboard').hidden=$('edit-theme').hidden=!tema;
  $('open-dashboard').href=`dash.html?pasta=${encodeURIComponent(pasta)}`;
  $('edit-theme').href=`dash.html?pasta=${encodeURIComponent(pasta)}&editar=1`;
  if(tema)$('theme-message').textContent='';
  scene?.theme();
}
$('create-theme').addEventListener('click',async()=>{
  if(!authenticated||!floor||themeRequested)return;
  const button=$('create-theme');button.disabled=true;$('theme-message').textContent='Enviando pedido…';
  try{await api('/api/pedidos',{method:'POST',body:{pasta,andar:floor.n,texto:'[tema] Criar ambiente visual deste andar'}});themeRequested=true;$('theme-message').textContent='Pedido enviado: o ambiente fica pronto em até 30 min';}
  catch(error){button.disabled=false;$('theme-message').textContent=error.status===429?'Limite de pedidos atingido. Tente novamente mais tarde.':'Não foi possível enviar o pedido. Tente novamente.';}
});
let floor=null,events=[],workers=[],chosen=null,scene=null,authenticated=false,timer=0,controller=null,lastMap=0,stopped=false;
const seen=new Set();
const conversa=criarConversa({api,getFloors:()=>floor?[floor]:[],getFloor:()=>floor});
function localDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'Hora não informada':date.toLocaleString('pt-BR');}
function state(sector){const value=floor?.setores?.[sector];return Object.hasOwn(ESTADOS,value)?value:'pendente';}
function eventKey(event){return JSON.stringify([event.pasta,event.setor,event.tipo,event.nome,event.motivo,event.hora]);}
function eventText(event){return event?`${localDate(event.hora)} · ${texto(event.tipo)} · ${texto(event.nome)}${event.motivo?` · ${texto(event.motivo)}`:''}`:'Nenhum evento registrado.';}
function workerEvents(worker){return events.filter(e=>e.setor===worker.sector&&(!worker.guest||e.nome===worker.name));}
function latest(worker){return workerEvents(worker)[0];}
function deskEntries(worker){return array(floor.mesas?.[worker.sector]).slice().reverse();}
function doing(worker){return latest(worker)?eventText(latest(worker)):texto(deskEntries(worker)[0])||'Aguardando a próxima tarefa';}
function toolType(entry){return texto(entry&&typeof entry==='object'?entry.tipo:entry).split(/\s*[·:]\s*/)[0].toLowerCase();}
function inlineCode(node,value){
  const parts=texto(value).split(/(`+[^`]+`+)/g);
  for(const part of parts)node.append(el(/^`/.test(part)?'code':'span',part.replace(/`/g,'')));
}
function renderPending(){
  const pending=array(floor.pendencias);$('pending-count').textContent=pending.length;$('pending-list').replaceChildren();
  for(const item of pending){const row=el('li'),check=el('span','☐'),content=el('span');check.setAttribute('aria-hidden','true');inlineCode(content,item);row.append(check,content);$('pending-list').append(row);}
  if(!pending.length)$('pending-list').append(el('li','Nenhuma pendência ✓'));
}
function portrait(worker){
  const ns='http://www.w3.org/2000/svg',svg=(tag,attrs={},content)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(content!==undefined)node.textContent=content;return node;};
  const root=svg('svg',{viewBox:'0 0 120 146',class:'portrait',role:'img','aria-label':`Retrato de ${worker.name}`}),bust=svg('g',{class:'portrait-bust'}),color=PALETA[worker.sector];
  bust.append(svg('path',{d:'M12 146V122Q15 97 44 97H76Q105 97 108 122V146Z',fill:color}),svg('rect',{x:51,y:84,width:18,height:22,rx:7,fill:'#d9ad8c'}),svg('ellipse',{cx:60,cy:62,rx:28,ry:34,fill:'#ebc4a4'}),svg('path',{d:'M31 65V47Q30 18 60 20Q94 18 89 62L81 45Q60 54 41 40L37 65Z',fill:color}));
  const eyes=svg('g',{class:'portrait-eyes'});eyes.append(svg('ellipse',{cx:49,cy:64,rx:2.5,ry:3,fill:'#25323b'}),svg('ellipse',{cx:71,cy:64,rx:2.5,ry:3,fill:'#25323b'}));
  bust.append(eyes,svg('path',{d:'M53 80Q60 85 67 80',fill:'none',stroke:'#915e4c','stroke-width':2,'stroke-linecap':'round'}),svg('path',{d:'M47 101L60 118L73 101',fill:'none',stroke:'#ffffff88','stroke-width':2}),svg('rect',{x:26,y:124,width:68,height:15,rx:3,fill:'#f4f3e9'}),svg('text',{x:60,y:134,'text-anchor':'middle','font-size':7,fill:'#25323b'},NOMES[worker.sector]));root.append(bust);return root;
}
async function api(path,{method='GET',body,signal}={}){
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:signal??AbortSignal.timeout(10000),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok){if(response.status===401){authenticated=false;stop();conversa.setEnabled(false);location.replace('/');}const error=new Error(`HTTP ${response.status}`);error.status=response.status;throw error;}
  return response.status===204?null:response.json();
}
function roster(){
  const next=[];
  for(const sector of SETORES){
    next.push({id:sector,sector,name:NOMES[sector],role:CARGOS[sector],guest:false});
    const names=new Set();
    for(const event of events){
      const age=Date.now()-Date.parse(event.hora);
      if(event.setor!==sector||event.tipo!=='agente'||!event.nome?.trim()||!Number.isFinite(age)||age<0||age>86400000||names.has(event.nome))continue;
      names.add(event.nome);next.push({id:JSON.stringify([sector,event.nome]),sector,name:event.nome,role:'Funcionário contratado',guest:true});
      if(names.size===3)break;
    }
  }
  workers=next;
  if(chosen&&!workers.some(w=>w.id===chosen)){chosen=null;$('ficha').hidden=true;}
}
function renderSummary(){
  $('title').textContent=`Andar ${floor.n} · ${floor.titulo||floor.pasta}`;document.title=`${$('title').textContent} · /auto`;
  $('status').textContent=({andamento:'Em andamento',pendencias:'Com pendências',entregue:'Entregue'})[floor.status]||texto(floor.status)||'Em andamento';
  const counts=floor.contagem||{};$('kpis').replaceChildren();
  for(const [value,label] of [[array(floor.pendencias).length,'Pendências'],[SETORES.filter(s=>state(s)==='ativo').length,'setores ativos'],[counts.ferramentas||0,'ferramentas'],[counts.gpt||0,'GPT'],[counts.agentes||0,'agentes']]){const item=el('div');item.append(el('strong',value),el('span',label));$('kpis').append(item);}
  renderPending();
  $('central').hidden=true;
  if(floor.central?.url){try{const url=new URL(floor.central.url);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password){$('central').href=url.href;$('central').hidden=false;}}catch{/* Não exibe URLs inválidas. */}}
}
const workerItems=new Map();
function renderWorkers(){
  const list=$('employees'),ids=new Set(workers.map(worker=>worker.id));
  for(const [id,button] of workerItems)if(!ids.has(id)){button.remove();workerItems.delete(id);}
  let cursor=list.firstChild;
  for(const worker of workers){
    let button=workerItems.get(worker.id);
    if(!button){
      button=el('button',undefined,'employee');button.type='button';button.dataset.worker=worker.id;
      button.append(el('strong'),el('small'),el('small'));
      button.addEventListener('click',()=>openFicha(worker.id));workerItems.set(worker.id,button);
    }
    const pressed=String(chosen===worker.id);
    if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
    const texts=[worker.name,`${worker.role} · ${NOMES[worker.sector]} · ${ESTADOS[state(worker.sector)]}`,`agora: ${doing(worker)}`];
    texts.forEach((text,index)=>{if(button.children[index].textContent!==text)button.children[index].textContent=text;});
    if(button!==cursor)list.insertBefore(button,cursor);
    cursor=button.nextSibling;
  }
}
function renderFicha(){
  const worker=workers.find(w=>w.id===chosen);if(!worker)return;
  const panel=$('ficha'),wasAsk=document.activeElement?.classList.contains('ask'),wasClose=document.activeElement?.classList.contains('close');panel.replaceChildren();
  const close=el('button','Fechar','close');close.type='button';close.addEventListener('click',closeFicha);
  const heading=el('h2',worker.name);heading.id='ficha-title';panel.setAttribute('aria-labelledby',heading.id);
  const profile=el('div',undefined,'profile'),info=el('div',undefined,'profile-info'),badge=el('span',ESTADOS[state(worker.sector)],'badge');badge.dataset.state=state(worker.sector);
  info.append(heading,el('p',worker.role),el('small',NOMES[worker.sector]),el('br'),badge);profile.append(portrait(worker),info);
  panel.append(close,profile,el('h3','Fazendo agora'),el('p',doing(worker)),el('h3','Já fez'));
  const history=el('ol',undefined,'timeline'),live=workerEvents(worker),entries=[...live,...deskEntries(worker)];
  for(const entry of entries.slice(0,15)){const row=el('li'),type=toolType(entry);row.append(el('span',`${ICONES[type]||'•'} ${typeof entry==='object'?`${texto(entry.tipo)} · ${texto(entry.nome)}${entry.motivo?` · ${texto(entry.motivo)}`:''}`:texto(entry)}`));if(entry?.hora){const time=el('time',localDate(entry.hora));if(Number.isFinite(Date.parse(entry.hora)))time.dateTime=new Date(entry.hora).toISOString();row.append(time);}history.append(row);}
  if(!entries.length)history.append(el('li','Nenhuma atividade registrada.'));panel.append(history,el('h3','Ferramentas usadas'));
  const chips=el('div',undefined,'chips'),types=[...new Set(entries.map(toolType).filter(Boolean))];for(const type of types)chips.append(el('span',`${ICONES[type]||'•'} ${type}`,'chip'));if(!types.length)chips.append(el('span','Nenhuma ferramenta registrada.','muted'));panel.append(chips);
  const ask=el('button','Pedir algo a este funcionário','ask');ask.type='button';ask.addEventListener('click',()=>conversa.open(`@${worker.name}: `));panel.append(ask);
  if(wasAsk)ask.focus({preventScroll:true});else if(wasClose)close.focus({preventScroll:true});
}
function openFicha(id){chosen=id;renderWorkers();renderFicha();$('ficha').hidden=false;$('ficha').focus();}
function closeFicha(){const id=chosen;chosen=null;$('ficha').hidden=true;renderWorkers();Array.from($('employees').children).find(n=>n.dataset.worker===id)?.focus();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('ficha').hidden)closeFicha();});
$('drawer').addEventListener('click',()=>{const expanded=$('sidebar').classList.toggle('expanded');$('drawer').setAttribute('aria-expanded',String(expanded));$('drawer').textContent=expanded?'Recolher':'Expandir';});
function stop(){clearTimeout(timer);controller?.abort();}
async function poll(){
  if(!authenticated||document.hidden||stopped||controller)return;
  const active=new AbortController();controller=active;const timeout=setTimeout(()=>active.abort(),10000);
  try{
    const result=await api('/api/estado',{signal:active.signal});
    const incoming=array(result?.eventos).filter(e=>e&&e.pasta===pasta&&SETORES.includes(e.setor));const added=[];
    for(const event of incoming){const key=eventKey(event);if(seen.has(key))continue;seen.add(key);events.push(event);added.push(event);}
    // Mantém a janela já observada por 24 h mesmo quando a API sai de sua janela de 60 eventos.
    events=events.filter(e=>Date.parse(e.hora)>=Date.now()-86400000).sort((a,b)=>Date.parse(b.hora)-Date.parse(a.hora)).slice(0,2000);
    if(seen.size>4000){seen.clear();events.forEach(e=>seen.add(eventKey(e)));incoming.forEach(e=>seen.add(eventKey(e)));}
    if(Date.now()-lastMap>=60000){const map=await api('/api/mapa',{signal:active.signal});lastMap=Date.now();const next=array(map.andares).find(f=>f.pasta===pasta);if(next){floor=next;renderSummary();}await loadTheme(active.signal);}
    roster();renderWorkers();if(chosen)renderFicha();scene?.sync();
    for(const event of added.slice().reverse())scene?.event(event);
    $('live').textContent='Ao vivo · conectado · atualização a cada 4 s';
  }catch(error){if(authenticated&&!document.hidden&&!stopped)$('live').textContent='Ao vivo · reconectando…';}
  finally{clearTimeout(timeout);if(controller===active)controller=null;if(authenticated&&!document.hidden&&!stopped)timer=setTimeout(poll,4000);}
}
document.addEventListener('visibilitychange',()=>{stop();if(!document.hidden){scene?.resume();poll();}else scene?.pause();});
window.addEventListener('pagehide',()=>{stopped=true;stop();scene?.pause();});
window.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;scene?.resume();poll();}});
async function init(){
  try{
    await api('/api/sessao');if(!pasta){location.replace('/');return;}
    const map=await api('/api/mapa');floor=array(map.andares).find(f=>f.pasta===pasta);lastMap=Date.now();
    if(!floor){$('title').textContent='Andar não encontrado';$('status').textContent='Volte ao prédio para escolher um andar.';return;}
    authenticated=true;conversa.setEnabled(true);$('workspace').hidden=false;renderSummary();roster();renderWorkers();
    await loadTheme();if(!authenticated)return;
    poll();
    try{scene=await startScene();scene.sync();for(const event of events.slice().reverse())if(Date.now()-Date.parse(event.hora)<8000)scene.event(event);}catch{$('fallback').hidden=false;$('fallback').textContent='3D indisponível. Explore os funcionários pela lista. A cena requer WebGL e acesso ao jsDelivr.';}
  }catch(error){if(error.status!==401){$('status').textContent='Não foi possível carregar o andar. Recarregue para tentar novamente.';}}
}
init();

async function startScene(){
  const [THREE,{OrbitControls},{CSS2DRenderer,CSS2DObject}]=await Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/renderers/CSS2DRenderer.js')]);
  const {PROPS}=await import('./props3d.js');
  const host=$('scene'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Andar em 3D; selecione também pela lista de funcionários.');host.append(renderer.domElement);
  const labels=new CSS2DRenderer();Object.assign(labels.domElement.style,{position:'absolute',inset:'0',pointerEvents:'none'});host.append(labels.domElement);
  const world=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,150),controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.5,0);controls.maxPolarAngle=Math.PI*.47;controls.minDistance=10;controls.maxDistance=50;
  const ambient=new THREE.HemisphereLight(0xffefdb,0x56626b,2.3);world.add(ambient);const light=new THREE.DirectionalLight(0xffdfb0,2.5);light.position.set(6,12,7);world.add(light);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-11,right:11,top:10,bottom:-10});light.shadow.bias=-.001;
  const geometry=new THREE.BoxGeometry(1,1,1),headGeo=new THREE.SphereGeometry(.16,12,10),hairGeo=new THREE.SphereGeometry(.17,12,8,0,Math.PI*2,0,Math.PI*.55),bodyGeo=new THREE.CapsuleGeometry(.14,.35,4,8);
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.5,...extra});
  const metal=mat(0x637c8e,{metalness:.6}),slab=mat(0x9caebc),dark=mat(0x132534),wood=mat(0xb49171),skin=mat(0xd1b9a2),uniforms=new Map(SETORES.map(sector=>[sector,mat(PALETA[sector])])),glass=mat(0x9bd4ed,{transparent:true,opacity:.12,depthWrite:false,metalness:.15}),strip=mat(0xbdefff,{emissive:0x8ce4ef,emissiveIntensity:1});
  function box(parent,material,x,y,z,w,h,d){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;}
  const floorCanvas=document.createElement('canvas');floorCanvas.width=512;floorCanvas.height=512;const fc=floorCanvas.getContext('2d');fc.fillStyle='#7b7770';fc.fillRect(0,0,512,512);
  for(let row=0;row<16;row++){fc.fillStyle=row%2?'#837e74':'#8c867b';fc.fillRect(0,row*32,512,31);fc.fillStyle='#716d65';for(let col=0;col<4;col++)fc.fillRect(col*160+(row%2)*80,row*32,1,32);}
  const floorTexture=new THREE.CanvasTexture(floorCanvas);floorTexture.colorSpace=THREE.SRGBColorSpace;floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;floorTexture.repeat.set(3,2);
  box(world,slab,0,0,0,15,.25,11.6);box(world,metal,0,.16,0,15.1,.08,11.7);const floorMesh=box(world,mat(0xffffff,{map:floorTexture,roughness:.95}),0,.23,0,14.7,.06,11.3);floorMesh.receiveShadow=true;
  // Fachada baixa mantém todas as mesas visíveis na vista de cima.
  for(const z of [-5.65,5.65]){box(world,glass,0,.86,z,14.8,1.2,.04);box(world,metal,0,1.48,z,14.9,.045,.06);for(let x=-7.3;x<=7.4;x+=1.46)box(world,metal,x,.88,z,.035,1.2,.04);}
  for(const x of [-7.35,7.35]){box(world,glass,x,.86,0,.04,1.2,11.3);box(world,strip,x,.31,0,.05,.035,11.3);}
  box(world,strip,0,.31,5.76,15,.035,.045);box(world,dark,5.7,1,-4.4,2.4,1.5,1.5);
  box(world,mat(0xa9aaa0),0,1.7,-5.6,14.7,2.9,.12);
  const boardCanvas=document.createElement('canvas');boardCanvas.width=768;boardCanvas.height=256;const bc=boardCanvas.getContext('2d'),boardTexture=new THREE.CanvasTexture(boardCanvas);boardTexture.colorSpace=THREE.SRGBColorSpace;
  box(world,wood,0,2,-5.48,5.3,1.9,.12);box(world,mat(0xffffff,{map:boardTexture,roughness:1}),0,2,-5.4,5.1,1.7,.04);let boardCount=-1;
  function updateBoard(){const count=array(floor.pendencias).length;if(count===boardCount)return;boardCount=count;bc.fillStyle='#faf7ec';bc.fillRect(0,0,768,256);bc.fillStyle=cor(tema?.paleta?.destaque)||'#31515a';bc.font='bold 54px system-ui';bc.fillText(`Pendências: ${count}`,40,110);bc.font='25px system-ui';bc.fillText('Planejar · conversar · realizar',40,180);boardTexture.needsUpdate=true;}
  const leafMat=mat(0x548866),potMat=mat(0xbb8368);
  for(const [x,z] of [[-6.6,-4.7],[6.6,-4.7],[-6.6,4.6],[6.6,4.6]]){const pot=new THREE.Mesh(new THREE.CylinderGeometry(.27,.2,.5,10),potMat);pot.position.set(x,.5,z);world.add(pot);box(world,wood,x,1,z,.06,.8,.06);for(const [dx,y,dz] of [[0,1.45,0],[-.22,1.2,.08],[.22,1.27,-.06]]){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8),leafMat);leaf.scale.y=1.25;leaf.position.set(x+dx,y,z+dz);world.add(leaf);}}
  const positions=[[-5,2],[-1.7,2],[1.7,2],[5,2],[-5,-2.8],[-1.7,-2.8],[1.7,-2.8]],desks=new Map(),people=new Map(),hits=[];
  const hitMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  function hit(parent,id,x,y,z,w,h,d){const mesh=box(parent,hitMat,x,y,z,w,h,d);mesh.userData.worker=id;hits.push(mesh);return mesh;}
  for(const [index,sector] of SETORES.entries()){
    const [x,z]=positions[index],group=new THREE.Group();group.position.set(x,.27,z);world.add(group);
    box(group,wood,0,.8,0,2.2,.12,1);for(const leg of [-.9,.9])box(group,metal,leg,.4,0,.07,.8,.8);
    box(group,dark,0,1.2,-.3,.08,.6,.08);box(group,dark,0,1.4,-.3,.94,.6,.1);
    const screenMat=mat(CORES[state(sector)],{emissive:CORES[state(sector)],emissiveIntensity:.6});box(group,screenMat,0,1.4,-.24,.83,.47,.02);box(group,metal,0,.88,.15,.7,.03,.24);
    box(group,metal,.85,1.23,-.1,.045,.8,.045);box(group,metal,.62,1.62,-.1,.5,.045,.045);box(group,mat(0xffedc8,{emissive:0xffd89c,emissiveIntensity:.8}),.4,1.58,-.1,.35,.09,.3);
    box(group,dark,0,.54,.9,.65,.12,.6);box(group,dark,0,.88,1.16,.65,.6,.1);box(group,metal,0,.28,.9,.08,.5,.08);
    hit(group,sector,0,.9,0,2.4,1.8,1.2);desks.set(sector,{group,screenMat,until:0});
  }
  let frameId=0,lost=false,lastFrame=0,elapsed=0;
  const recentActivity=new Map(),screenTint=new THREE.Color(0xffe0ad);
  const decoration=new THREE.Group();world.add(decoration);let themeSignature='';
  function applyTheme(){
    const signature=JSON.stringify(tema);if(signature===themeSignature)return;themeSignature=signature;
    const accent=cor(tema?.paleta?.destaque),piso=cor(tema?.andar?.piso),luz=cor(tema?.andar?.luz);
    floorMesh.material.map=piso?null:floorTexture;floorMesh.material.color.set(piso||0xffffff);floorMesh.material.needsUpdate=true;
    light.color.set(luz||0xffdfb0);ambient.color.set(luz||0xffefdb);
    strip.color.set(accent||0xbdefff);strip.emissive.set(accent||0x8ce4ef);
    for(const child of [...decoration.children]){child.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});child.removeFromParent();}
    // Seis vagas no corredor central; limites medidos incluem braços e pés dos props.
    array(tema?.andar?.decoracao).filter(name=>Object.hasOwn(PROPS,name)).slice(0,6).forEach((name,index)=>{
      const prop=PROPS[name](accent||undefined),bounds=new THREE.Box3().setFromObject(prop),size=bounds.getSize(new THREE.Vector3());
      const scale=Math.min(1,1.8/size.x,1.4/size.z,2/size.y);prop.scale.setScalar(scale);
      const center=bounds.getCenter(new THREE.Vector3());prop.position.set(-5.8+index*2.3-center.x*scale,.27-bounds.min.y*scale,-center.z*scale);decoration.add(prop);
    });
    for(const record of people.values())record.plate.element.style.borderColor=accent||'';
    boardCount=-1;updateBoard();invalidate();
  }
  function invalidate(){if(!frameId&&!lost&&!stopped&&!document.hidden&&authenticated)frameId=requestAnimationFrame(animate);}
  function addPerson(worker,index){
    const desk=desks.get(worker.sector),group=new THREE.Group();group.position.set(desk.group.position.x+(worker.guest?1.3:0),.27,desk.group.position.z+(worker.guest?-1.3+index*1.15:.8));world.add(group);
    const uniform=uniforms.get(worker.sector),body=new THREE.Mesh(bodyGeo,uniform);body.position.y=.97;body.castShadow=true;group.add(body);const head=new THREE.Group();head.position.y=1.43;group.add(head);const face=new THREE.Mesh(headGeo,skin);head.add(face);const hair=new THREE.Mesh(hairGeo,uniform);hair.position.y=.05;head.add(hair);
    const hands=[],legs=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.22,1.13,0);group.add(arm);box(arm,uniform,0,-.1,-.07,.13,.24,.15);box(arm,skin,0,-.22,-.22,.1,.1,.35);hands.push(arm);const leg=new THREE.Group();leg.position.set(side*.1,.72,0);box(leg,dark,0,-.21,0,.13,.42,.15);box(leg,metal,0,-.43,-.06,.15,.09,.25);group.add(leg);legs.push(leg);}
    const plate=new CSS2DObject(el('div',worker.name,'plate'));plate.position.set(0,1.85,0);group.add(plate);
    plate.element.style.borderColor=cor(tema?.paleta?.destaque)||'';
    const bubbleEl=el('div','','bubble'),bubble=new CSS2DObject(bubbleEl);bubble.position.set(0,2.45,0);bubble.visible=false;group.add(bubble);
    const proxy=hit(group,worker.id,0,1,0,.8,1.8,.8);
    people.set(worker.id,{worker,group,hands,legs,head,bubble,bubbleEl,plate,proxy,home:group.position.clone(),target:null,phase:'seated',phaseAt:elapsed,nextWalk:elapsed+8+Math.random()*12,seed:Math.random()*6,until:0});
  }
  function sync(){
    recentActivity.clear();for(const event of events){const time=Date.parse(event.hora);if(time<=Date.now())recentActivity.set(event.setor,Math.max(recentActivity.get(event.setor)||0,time+60000));}
    const ids=new Set(workers.map(w=>w.id));
    for(const [id,record] of people)if(!ids.has(id)){record.plate.element.remove();record.bubbleEl.remove();record.group.removeFromParent();hits.splice(hits.indexOf(record.proxy),1);people.delete(id);}
    for(const sector of SETORES){let guest=0;for(const worker of workers.filter(w=>w.sector===sector)){if(!people.has(worker.id))addPerson(worker,guest);if(worker.guest)guest++;}const desk=desks.get(sector);desk.screenMat.color.set(cor(tema?.paleta?.destaque)||CORES[state(sector)]);desk.screenMat.emissive.copy(desk.screenMat.color);}
    updateBoard();
    invalidate();
  }
  function animate(now){
    frameId=0;if(lost||document.hidden||stopped||!authenticated)return;
    if(lastFrame&&now-lastFrame<1000/30){invalidate();return;}
    const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;elapsed+=dt;
    for(const record of people.values()){
      const active=sectorActive(record.worker.sector),t=elapsed-record.phaseAt;
      if(reduced.matches&&record.phase!=='seated'){record.phase='seated';record.group.position.copy(record.home);record.group.rotation.y=0;record.nextWalk=elapsed+8+Math.random()*12;}
      if(!reduced.matches&&record.phase==='seated'&&elapsed>=record.nextWalk){record.phase='out';record.phaseAt=elapsed;record.talkDuration=2+Math.random();record.from=record.home.clone();const others=positions.filter((_,i)=>SETORES[i]!==record.worker.sector),destination=Math.random()<.5?null:others[Math.floor(Math.random()*others.length)];record.target=new THREE.Vector3(destination?destination[0]+1.25:Math.random()*3-1.5,.27,destination?destination[1]+1.65:-4.2);}
      if(record.phase==='out'||record.phase==='back'){
        const target=record.phase==='out'?record.target:record.home,from=record.from,duration=Math.max(1,from.distanceTo(target)/1.25),progress=Math.min(1,(elapsed-record.phaseAt)/duration);
        record.group.position.lerpVectors(from,target,progress);record.group.rotation.y=Math.atan2(from.x-target.x,from.z-target.z);
        if(progress===1){record.phase=record.phase==='out'?'talk':'seated';record.phaseAt=elapsed;record.nextWalk=elapsed+8+Math.random()*(record.worker.guest?4:12);if(record.phase==='seated')record.group.rotation.y=0;}
      }else if(record.phase==='talk'&&t>=record.talkDuration){record.phase='back';record.phaseAt=elapsed;record.from=record.group.position.clone();}
      const walking=record.phase==='out'||record.phase==='back',typing=record.phase==='seated',speed=reduced.matches?2:active?17:6,beat=elapsed*speed+record.seed;
      record.group.position.y=.27+(typing?0:.25)+(walking?Math.abs(Math.sin(elapsed*9))*.025:0);
      record.hands.forEach((arm,i)=>{arm.rotation.x=walking?Math.sin(elapsed*9+i*Math.PI)*.45:typing?Math.sin(beat+i*Math.PI)*(reduced.matches?.025:.13):-.18;});
      record.legs.forEach((leg,i)=>{leg.rotation.x=walking?Math.sin(elapsed*9+i*Math.PI)*.5:typing?-.5:0;});record.head.rotation.x=Math.sin(beat*.35)*(reduced.matches?0:.035);
      record.bubble.visible=record.phase==='talk'||now<record.until;if(record.phase==='talk')record.bubbleEl.textContent='…';else if(now<record.until)record.bubbleEl.textContent=record.eventLabel;
    }
    for(const [sector,desk] of desks){const active=sectorActive(sector),pulse=reduced.matches?0:Math.sin(elapsed*(active?17:5));desk.screenMat.color.set(cor(tema?.paleta?.destaque)||CORES[state(sector)]).lerp(screenTint,(pulse+1)*(active?.14:.03));desk.screenMat.emissive.copy(desk.screenMat.color);desk.screenMat.emissiveIntensity=active?.85+(pulse+1)*.3:.45;}
    controls.update();renderer.render(world,camera);labels.render(world,camera);
    invalidate();
  }
  function sectorActive(sector){return state(sector)==='ativo'||Date.now()<(recentActivity.get(sector)||0);}
  function pause(){cancelAnimationFrame(frameId);frameId=0;lastFrame=0;}
  controls.addEventListener('change',invalidate);
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);labels.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const distance=Math.max(21,19/camera.aspect);camera.position.set(distance*.22,distance*.78,distance*.82);controls.target.set(0,.5,0);controls.update();invalidate();}
  const observer=new ResizeObserver(resize);observer.observe(host);
  let down=null;const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,id:e.pointerId,time:performance.now()};});
  renderer.domElement.addEventListener('pointercancel',()=>down=null);
  renderer.domElement.addEventListener('pointerup',e=>{const origin=down;down=null;if(!origin||origin.id!==e.pointerId||Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>7||performance.now()-origin.time>600)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(hits,false)[0];if(hit)openFicha(hit.object.userData.worker);});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;pause();$('fallback').hidden=false;$('fallback').textContent='A cena 3D foi interrompida. Use a lista ou recarregue a página.';});
  reduced.addEventListener('change',invalidate);applyTheme();sync();resize();$('fallback').hidden=true;
  return {sync,theme:applyTheme,pause,resume:invalidate,event(event){const now=performance.now();desks.get(event.setor).until=now+8000;const id=event.tipo==='agente'?JSON.stringify([event.setor,event.nome]):event.setor;const person=people.get(id)||people.get(event.setor);if(person){person.until=now+8000;person.eventLabel=`${texto(event.nome)} · ${texto(event.motivo||event.tipo)}`;}invalidate();}};
}
