import { criarConversa } from './conversa.js';

  const SECTORS = ['diretoria', 'pesquisa', 'criacao', 'producao', 'qualidade', 'ferramentas', 'documentacao'];
  const SECTOR_NAMES = {diretoria:'Diretoria',pesquisa:'Pesquisa',criacao:'Criação',producao:'Produção',qualidade:'Qualidade',ferramentas:'Ferramentas',documentacao:'Documentação'};
  const STATES = {ativo:'Ativo',feito:'Feito',pendente:'Pendente',pulado:'Pulado'};
  const STATE_COLORS = {ativo:'#8bc6ff',feito:'#9ce0b7',pendente:'#ffcf82',pulado:'#acb7c0'};
  const FLOOR_STATES = {andamento:'Em andamento',pendencias:'Com pendências',entregue:'Entregue'};
  let data = {}, floors = [];
  let temas = {};
  const themeColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:null;
  const floorTheme=floor=>Object.hasOwn(temas,floor.pasta)?temas[floor.pasta]:null;
  const themeIcon=floor=>floorTheme(floor)?.icone?`${string(floorTheme(floor).icone)} `:'';
  async function fetchThemes(signal){
    try{const result=await api('/api/temas',{signal});return result&&typeof result==='object'&&!Array.isArray(result)?result:{};}
    catch(error){if(error.status===401)throw error;return temas;}
  }
  const $ = id => document.getElementById(id);
  const string = value => value == null ? '' : String(value);
  const array = value => Array.isArray(value) ? value : [];
  const floorState = floor => Object.hasOwn(FLOOR_STATES,floor.status) ? floor.status : 'andamento';
  const sectorState = (floor,sector) => Object.hasOwn(STATES,floor.setores?.[sector]) ? floor.setores[sector] : 'pendente';
  const el = (tag, className, text) => {const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=string(text);return node;};
  const announce = text => {$('announcement').textContent=text;};
  let selected = -1, selectedSector = null, sceneAPI = null, selectionVersion = 0;
  let authenticated = false, pollTimer = 0, pollController = null, sessionVersion = 0;
  let lastMapRefresh = 0;
  let sceneStarted = false, sceneStarting = false, recentEvents = [];
  const seenEvents = new Set();

  const conversa=criarConversa({api,getFloors:()=>floors,getFloor:()=>floors[selected]});

  function localDate(value){
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'Data não informada':date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  const floorItems=new Map();
  let emptyFloorList=null;
  function renderList(){
    const list=$('floor-list'),keys=new Set(floors.map(floor=>string(floor.pasta)));
    for(const [key,button] of floorItems)if(!keys.has(key)){button.remove();floorItems.delete(key);}
    if(floors.length)emptyFloorList?.remove();
    let cursor=list.firstChild;
    floors.map((floor,index)=>({floor,index})).reverse().forEach(({floor,index})=>{
      const key=string(floor.pasta);let button=floorItems.get(key);
      if(!button){
        button=el('button','floor-button');button.type='button';
        const copy=el('span','floor-copy');copy.append(el('span','floor-title'),el('span','floor-meta'));
        const dot=el('span');dot.setAttribute('aria-hidden','true');
        button.append(el('span','floor-number'),copy,dot);
        button.addEventListener('click',()=>selectFloor(Number(button.dataset.index)));floorItems.set(key,button);
      }
      if(button.dataset.index!==String(index))button.dataset.index=index;
      const pressed=String(index===selected),status=floorState(floor);
      if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
      for(const [node,text] of [[button.children[0],String(floor.n??index+1).padStart(2,'0')],[button.children[1].children[0],themeIcon(floor)+string(floor.titulo||floor.pasta||'Projeto sem título')],[button.children[1].children[1],FLOOR_STATES[status]]])if(node.textContent!==text)node.textContent=text;
      const dot=button.children[2],className=`status-dot status-${status}`;
      if(dot.className!==className)dot.className=className;
      if(button!==cursor)list.insertBefore(button,cursor);
      cursor=button.nextSibling;
    });
    if(!floors.length){
      emptyFloorList??=el('p','empty','Nenhum projeto no mapa. Novos projetos aparecerão como andares na próxima geração.');
      if(emptyFloorList.parentNode!==list)list.append(emptyFloorList);
    }
  }
  function section(title,text){const node=el('section');node.append(el('h3','',title),el('p','',text||'Não informado.'));return node;}
  function listSection(title,items,empty){const node=el('section');node.append(el('h3','',title));if(items.length){const ul=el('ul');items.forEach(item=>ul.append(el('li','',item)));node.append(ul);}else node.append(el('p','muted',empty));return node;}
  function overview(){
    selectionVersion++;selected=-1;selectedSector=null;$('detail').hidden=true;$('floor-list').hidden=false;
    $('panel-title').textContent='Andares da empresa';$('panel-subtitle').textContent='Do mais novo ao mais antigo';$('view-title').textContent='A empresa, por inteiro.';
    $('explode').value='0';$('explode-value').textContent='0%';sceneAPI?.select(-1);sceneAPI?.explode(0);renderList();announce('Vista geral do prédio.');
  }
  function selectFloor(index,sector=null){
    if(!floors[index])return;
    location.href=`/andar.html?pasta=${encodeURIComponent(string(floors[index].pasta))}`;
  }

  function renderDetail(){
    if(selected<0)return;const floor=floors[selected],detail=$('detail');detail.replaceChildren();
    const back=el('button','back','← Todos os andares');back.type='button';back.addEventListener('click',overview);detail.append(back);
    const head=el('header','detail-head');head.append(el('p','eyebrow',`Projeto / ${String(floor.n??selected+1).padStart(2,'0')}`),el('h2','',floor.titulo||floor.pasta),el('span',`badge status-${floorState(floor)}`,FLOOR_STATES[floorState(floor)]));detail.append(head);
    detail.append(section('Sobre o projeto',floor.resumo),section('Pedido original',floor.pedido));
    const sectors=el('section');sectors.append(el('h3','','As sete mesas'));const grid=el('div','sector-grid');
    for(const sector of SECTORS){const state=sectorState(floor,sector),button=el('button','sector');button.type='button';button.dataset.sector=sector;button.setAttribute('aria-pressed',String(sector===selectedSector));const dot=el('span','sector-dot');dot.style.background=STATE_COLORS[state];const text=el('span','',SECTOR_NAMES[sector]);text.append(el('span','sector-state',STATES[state]));button.append(dot,text);button.addEventListener('click',()=>showSector(sector));grid.append(button);}
    const tools=el('div','tool-card');tools.id='tools';tools.hidden=true;sectors.append(grid,tools);detail.append(sectors);
    detail.append(listSection('Pendências',array(floor.pendencias),'Nenhuma pendência registrada.'),listSection('Decisões',array(floor.decisoes),'Nenhuma decisão registrada.'),section('Último passo',floor.ultimo));
    const counts=floor.contagem||{};const countNote=el('p','notice',`${Number(counts.ferramentas)||0} usos de ferramentas · ${Number(counts.gpt)||0} GPT · ${Number(counts.agentes)||0} agentes`);detail.append(countNote);
    if(floor.central && typeof floor.central.url==='string'){
      try{const url=new URL(floor.central.url);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password){
        const central=el('section'),link=el('a','central-link',`Abrir central: ${string(floor.central.nome)}`);
        link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';central.append(link,el('p','notice','funciona com a Tailscale ligada no celular'));detail.append(central);
      }}catch{/* URL inválida não vira link. */}
    }
    const abrir=el('a','central-link','Abrir andar');abrir.href=`/andar.html?pasta=${encodeURIComponent(string(floor.pasta))}`;detail.append(abrir);
    if(selectedSector)showSector(selectedSector);
  }
  function showSector(sector){
    if(selected<0||!SECTORS.includes(sector))return;selectedSector=sector;const floor=floors[selected],card=$('tools');if(!card)return;
    card.hidden=false;card.replaceChildren(el('h3','',`${SECTOR_NAMES[sector]} · últimas ferramentas`));
    const tools=array(floor.mesas?.[sector]).slice(-3);if(tools.length){const ul=el('ul');tools.forEach(tool=>ul.append(el('li','',tool)));card.append(ul);}else card.append(el('p','muted','Nenhuma ferramenta registrada neste setor.'));
    $('detail').querySelectorAll('[data-sector]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sector===sector)));
    sceneAPI?.sector(sector);announce(`${SECTOR_NAMES[sector]}: ${STATES[sectorState(floor,sector)]}.`);
  }
  async function api(path,{method='GET',body,signal}={}){
    const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:signal??AbortSignal.timeout(10000),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    if(!response.ok){if(response.status===401 && path!=='/api/login')showLogin(authenticated?'Sua sessão expirou. Entre novamente.':'Digite a senha para entrar.');const error=new Error(`HTTP ${response.status}`);error.status=response.status;throw error;}
    if(response.status===204)return null;
    return response.json();
  }
  $('overview').addEventListener('click',overview);
  $('reset-camera').addEventListener('click',()=>sceneAPI?.reframe());
  $('explode').addEventListener('input',event=>{const value=Number(event.target.value);$('explode-value').textContent=`${value}%`;sceneAPI?.explode(value/100);});
  $('drawer-toggle').addEventListener('click',()=>{const expanded=$('sidebar').classList.toggle('expanded');$('drawer-toggle').setAttribute('aria-expanded',String(expanded));$('drawer-toggle').textContent=expanded?'Recolher':'Expandir';});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){overview();$('overview').focus();}});
  window.addEventListener('pagehide',()=>{stopPolling();sceneAPI?.pause();});
  window.addEventListener('pageshow',event=>{if(event.persisted)checkSession();});

  function stopPolling(){clearTimeout(pollTimer);pollTimer=0;pollController?.abort();pollController=null;}
  function showLogin(message){
    conversa.setEnabled(false);authenticated=false;sessionVersion++;selectionVersion++;stopPolling();sceneAPI?.pause();
    $('app').hidden=true;$('login-screen').hidden=false;$('login-message').textContent=message;$('login-button').disabled=false;
  }
  async function checkSession(){
    $('retry-session').hidden=true;$('login-button').disabled=true;
    try{await api('/api/sessao');await enterSite();}
    catch(error){if(error.status!==401){showLogin('Não foi possível conectar ao servidor. Tente novamente.');$('retry-session').hidden=false;}}
  }
  async function enterSite(){
    // A nova sessão recarrega também a cena e elimina os dados da sessão anterior.
    if(sceneStarted||sceneStarting){location.reload();return;}
    const version=++sessionVersion;
    const result=await api('/api/mapa');if(version!==sessionVersion)return;
    const loadedThemes=await fetchThemes();if(version!==sessionVersion)return;temas=loadedThemes;
    if(!result||!Array.isArray(result.andares))throw new Error('Mapa inválido');
    lastMapRefresh=Date.now();data=result;floors=data.andares.filter(f=>f&&typeof f==='object').slice().sort((a,b)=>Number(a.n)-Number(b.n));
    authenticated=true;$('login-screen').hidden=true;$('app').hidden=false;$('password').value='';
    conversa.setEnabled(true);renderMapSummary();
    renderList();sceneStarting=true;
    try{await startScene();sceneStarted=true;}
    catch(error){showFallback('O 3D está indisponível neste navegador.','Use a lista para explorar os andares e as sete mesas. A cena requer WebGL e acesso ao jsDelivr.');}
    finally{sceneStarting=false;}
    if(authenticated)poll();
  }
  function renderMapSummary(){
    const date=new Date(data.gerado);$('generated').textContent=`Atualizado ${Number.isNaN(date.getTime())?'em data não informada':date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}`;
    $('k-total').textContent=floors.length;for(const [id,state] of [['k-active','andamento'],['k-pending','pendencias'],['k-done','entregue']])$(id).textContent=floors.filter(f=>floorState(f)===state).length;
  }
  async function refreshMap(signal,version){
    lastMapRefresh=Date.now();
    const result=await api('/api/mapa',{signal});
    const nextThemes=await fetchThemes(signal);
    if(!authenticated||version!==sessionVersion)return;
    if(!result||!Array.isArray(result.andares))throw new Error('Mapa inválido');
    const next=result.andares.filter(f=>f&&typeof f==='object').slice().sort((a,b)=>Number(a.n)-Number(b.n));
    const changed=JSON.stringify(next)!==JSON.stringify(floors)||JSON.stringify(nextThemes)!==JSON.stringify(temas);
    temas=nextThemes;
    const pasta=floors[selected]?.pasta;
    data=result;
    if(changed){
      sceneAPI?.dispose();sceneAPI=null;
      floors=next;selectionVersion++;selected=pasta==null?-1:floors.findIndex(f=>f.pasta===pasta);
      renderList();
      if(selected>=0){$('panel-title').textContent=`Andar ${floors[selected].n??selected+1}`;$('view-title').textContent=floors[selected].titulo||'Projeto selecionado';renderDetail();}else overview();
      try{await startScene();}catch{showFallback('O 3D está indisponível neste navegador.','Use a lista para explorar os andares e as sete mesas.');}
    }
    conversa.update();renderMapSummary();renderEvents();
  }
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();$('login-button').disabled=true;$('login-message').textContent='Entrando…';
    try{await api('/api/login',{method:'POST',body:{senha:$('password').value}});$('password').value='';await enterSite();}
    catch(error){showLogin(error.status===429?'Limite de tentativas atingido. Aguarde 15 minutos.':error.status===401?'Senha incorreta. Tente novamente.':'Não foi possível entrar ou carregar o mapa. Tente novamente.');}
  });
  $('retry-session').addEventListener('click',checkSession);
  $('logout').addEventListener('click',async()=>{
    $('logout').disabled=true;
    try{await api('/api/logout',{method:'POST',body:{}});showLogin('Sessão encerrada.');location.reload();}
    catch(error){if(error.status!==401)announce('Não foi possível sair. Tente novamente.');}
    finally{$('logout').disabled=false;}
  });
  function eventKey(event){return JSON.stringify([event.pasta,event.setor,event.tipo,event.nome,event.motivo,event.hora]);}
  function renderEvents(){
    const list=$('live-events');list.replaceChildren();
    recentEvents.slice(0,5).forEach(event=>{
      const index=floors.findIndex(f=>string(f.pasta)===string(event.pasta)),floor=floors[index];
      list.append(el('li','',`${localDate(event.hora)} · ${floor?`Andar ${floor.n??index+1}`:'Novo andar'} · ${SECTOR_NAMES[event.setor]||string(event.setor)} · ${string(event.nome)} · ${string(event.motivo)}`));
    });
    if(!list.childElementCount)list.append(el('li','','Aguardando atividades da equipe.'));
  }
  async function poll(){
    if(!authenticated||document.hidden||pollController)return;
    const controller=new AbortController(),version=sessionVersion;pollController=controller;
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
    try{
      const state=await api('/api/estado',{signal:controller.signal});if(!authenticated||version!==sessionVersion)return;
      const events=array(state?.eventos).filter(e=>e&&typeof e==='object').slice(0,60);
      // O servidor lista os mais recentes primeiro; reage em ordem cronológica.
      for(const event of events.slice().reverse()){
        const key=eventKey(event);if(seenEvents.has(key))continue;seenEvents.add(key);
        sceneAPI?.event(event);recentEvents.unshift(event);
      }
      // Janela limitada, incluindo a última resposta inteira para evitar repetições.
      recentEvents=recentEvents.slice(0,60);
      if(seenEvents.size>1000){seenEvents.clear();events.forEach(e=>seenEvents.add(eventKey(e)));recentEvents.forEach(e=>seenEvents.add(eventKey(e)));}
      renderEvents();$('live-status').textContent='Ao vivo · conectado';
    }catch(error){if(authenticated&&!document.hidden)$('live-status').textContent='Ao vivo · reconectando…';}
    if(authenticated&&!document.hidden&&version===sessionVersion&&Date.now()-lastMapRefresh>=60000){
      try{await refreshMap(controller.signal,version);}catch{/* Nova tentativa no próximo intervalo do mapa. */}
    }
    }finally{clearTimeout(timeout);if(pollController===controller){pollController=null;if(authenticated&&!document.hidden)pollTimer=setTimeout(poll,4000);}}
  }
  document.addEventListener('visibilitychange',()=>{stopPolling();if(!document.hidden&&authenticated)poll();});
  checkSession();

  async function startScene(){
    // Imports dinâmicos permitem conservar a interface 2D mesmo sem CDN/WebGL.
    const [THREE,{OrbitControls},{RoomEnvironment},{CSS2DRenderer,CSS2DObject}]=await Promise.all([
      import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js'),import('three/addons/renderers/CSS2DRenderer.js')
    ]);
    const host=$('scene'),coarse=matchMedia('(pointer: coarse)').matches,light=matchMedia('(prefers-color-scheme: light)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const renderer=new THREE.WebGLRenderer({antialias:!coarse,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(coarse?1:Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=!coarse;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.shadowMap.autoUpdate=false;renderer.transmissionResolutionScale=.5;
    renderer.domElement.setAttribute('aria-label','Torre 3D: arraste para orbitar e selecione os andares pelo painel');renderer.domElement.setAttribute('role','img');host.append(renderer.domElement);
    const labels=new CSS2DRenderer();labels.domElement.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';host.append(labels.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,1200);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=9;controls.maxDistance=500;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.16;controls.screenSpacePanning=true;controls.target.set(0,8,0);
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
    const hemi=new THREE.HemisphereLight(0xb3d8ff,0x26364b,2.2);scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xc8ddff,3.2);sun.position.set(-25,48,20);sun.castShadow=!coarse;sun.shadow.mapSize.set(1024,1024);sun.shadow.radius=4;sun.shadow.blurSamples=8;sun.shadow.bias=-.0003;
    const height=Math.max(1,floors.length)*3.4+3;sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=height+15;sun.shadow.camera.bottom=-35;sun.shadow.camera.far=height+180;scene.add(sun);
    const rim=new THREE.DirectionalLight(0x65cfff,2);rim.position.set(20,15,-24);scene.add(rim);
    const geometry={box:new THREE.BoxGeometry(1,1,1),capsule:new THREE.CapsuleGeometry(.15,.3,3,6),sphere:new THREE.SphereGeometry(.14,8,6),cylinder:new THREE.CylinderGeometry(1,1,1,16)};
    function material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.55,...extra});}
    const baseMaterials={concrete:material(0xc5ced2,{roughness:.7}),metal:material(0x8aabb9,{metalness:.8,roughness:.23}),dark:material(0x172a38,{metalness:.5}),wood:material(0xad8b64),chair:material(0x273c4b),person:material(0x7b9bac),core:material(0x415768,{metalness:.5}),strip:material(0xc1eaff,{emissive:0x86d9ff,emissiveIntensity:1.1}),glass:new THREE.MeshPhysicalMaterial({color:0xb4dfeb,metalness:.08,roughness:.075,transmission:coarse?0:.88,transparent:true,opacity:coarse?.24:1,thickness:.16,ior:1.5,attenuationColor:0x79b4c9,attenuationDistance:14,envMapIntensity:1.3,side:THREE.DoubleSide,depthWrite:false})};
    function box(parent,mat,x,y,z,w,h,d,cast=true){const mesh=new THREE.Mesh(geometry.box,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=cast&&!coarse;mesh.receiveShadow=!coarse;parent.add(mesh);return mesh;}
    const plaza=material(0x172c39,{roughness:.42,metalness:.15}),paving=material(0x536574,{roughness:.7});
    const ground=box(scene,plaza,0,-.34,0,280,.4,280,false);ground.receiveShadow=true;
    box(scene,paving,0,-.09,0,23,.22,19,false);box(scene,baseMaterials.dark,0,.06,0,14.3,.27,11.3);box(scene,baseMaterials.concrete,0,.24,0,13.3,.18,10.3);
    for(const x of [-10,10])for(let z=-7;z<=7;z+=3.5){box(scene,baseMaterials.metal,x,.25,z,.15,.6,.15);box(scene,baseMaterials.strip,x,.57,z,.3,.06,.3,false);}
    for(let x=-10;x<=10;x+=2)box(scene,baseMaterials.dark,x,.035,0,.025,.012,18,false);
    for(let z=-8;z<=8;z+=2)box(scene,baseMaterials.dark,0,.035,z,22,.012,.025,false);
    // Cidade, placa e materiais procedurais: nenhum recurso visual externo.
    let seed=103;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    const skyline=material(0x101f30,{roughness:.9});
    const cityWindows=new THREE.InstancedMesh(geometry.box,material(0x8ca4b1,{emissive:0x829aaf,emissiveIntensity:.6}),1600);let windowCount=0;const dummy=new THREE.Object3D();
    for(let i=0;i<28;i++){
      const angle=Math.PI*.9+(i/28)*Math.PI*1.1,dist=44+random()*48,x=Math.cos(angle)*dist,z=Math.sin(angle)*dist,h=4+random()*19,w=4+random()*6,d=4+random()*5;
      box(scene,skyline,x,h/2-.4,z,w,h,d,false);
      for(let y=1;y<h-1;y+=1.6)for(let dx=-w/2+.7;dx<w/2;dx+=1.25){if(random()<.46&&windowCount<1600){dummy.position.set(x+dx,y,z+d/2+.025);dummy.scale.set(.42,.55,.035);dummy.updateMatrix();cityWindows.setMatrixAt(windowCount++,dummy.matrix);}}
    }cityWindows.count=windowCount;cityWindows.instanceMatrix.needsUpdate=true;scene.add(cityWindows);
    function sign(text){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#0e2230';ctx.fillRect(0,0,512,128);ctx.fillStyle='#c5f4ff';ctx.font='600 86px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,65);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:texture});}
    box(scene,baseMaterials.dark,0,.95,5.15,3.35,1.15,.18);box(scene,sign('/auto'),0,.95,5.25,3.2,.8,.035,false);
    const floorGroups=[],pickFloors=[],pickDesks=[],typing=[];let focus=-1,explosion=Number($('explode').value)/100,chosenSector=null;
    const positions=[[-3.9,2.15],[-1.35,2.15],[1.35,2.15],[3.9,2.15],[-3.9,-1.8],[-1.25,-1.8],[2,-1.8]];
    const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
    floors.forEach((floor,index)=>{
      const group=new THREE.Group();group.position.y=.48+index*3.4;scene.add(group);const materials=new Map();
      const own=name=>{if(!materials.has(name))materials.set(name,baseMaterials[name].clone());return materials.get(name);};
      const add=(mat,x,y,z,w,h,d,cast=true)=>box(group,mat,x,y,z,w,h,d,cast);
      add(own('concrete'),0,.02,0,12.4,.22,9.4);add(own('metal'),0,.19,0,12.5,.09,9.5);
      add(own('dark'),0,.29,0,11.9,.07,8.9,false);add(own('core'),4.7,1.55,-3.3,1.6,2.8,2);
      // Montantes e juntas pertencem somente à fachada.
      const glass=own('glass'),facades=[];
      for(const z of [-4.53,4.53])facades.push(add(glass,0,1.74,z,11.96,2.9,.045,false));
      for(const x of [-6.03,6.03])facades.push(add(glass,x,1.74,0,.045,2.9,9.1,false));
      for(const x of [-6,6])for(const z of [-4.5,4.5])add(own('metal'),x,1.7,z,.12,2.95,.12);
      for(let x=-4.5;x<=4.5;x+=1.5)for(const z of [-4.57,4.57])add(own('metal'),x,1.7,z,.045,2.9,.065,false);
      for(let z=-3;z<=3;z+=1.5)for(const x of [-6.07,6.07])add(own('metal'),x,1.7,z,.065,2.9,.045,false);
      for(const z of [-4.56,4.56])add(own('metal'),0,2.65,z,12.15,.035,.06,false);
      const tema=floorTheme(floor),accent=themeColor(tema?.andar?.fachada)||themeColor(tema?.paleta?.destaque);
      if(accent){own('strip').color.set(accent);own('strip').emissive.set(accent);}
      const status=floorState(floor),lightColor=accent||(status==='entregue'?0xb7d8bb:status==='pendencias'?0xffc57d:0xaedbfa);
      const ceiling=material(0xffe6bd,{emissive:lightColor,emissiveIntensity:status==='pendencias'?1:.65,roughness:.6});materials.set('ceiling',ceiling);
      for(const x of [-3,0,3])add(ceiling,x,3.04,0,1.8,.04,5.5,false);
      const glow=material(lightColor,{emissive:lightColor,emissiveIntensity:.5,transparent:true,opacity:.19,depthWrite:false});materials.set('glow',glow);
      for(let x=-5.2;x<5.5;x+=1.5){if((Math.round((x+5.2)/1.5)+index)%4!==0)add(glow,x,2.37,-4.43,1.3,1.1,.018,false);}
      add(own('strip'),0,.28,4.65,12.5,.035,.045,false);
      const floorLabel=el('div','floor-label',`${themeIcon(floor)}${String(floor.n??index+1).padStart(2,'0')} / ${FLOOR_STATES[status]}`);const labelObject=new CSS2DObject(floorLabel);labelObject.position.set(-6.5,1,4.6);group.add(labelObject);
      const deskLabels=[],sectorMeshes=[],dynamicMeshes=new Set();
      SECTORS.forEach((sector,s)=>{
        const [x,z]=positions[s],state=sectorState(floor,sector),desk=new THREE.Group();desk.position.set(x,.33,z);group.add(desk);
        box(desk,own('wood'),0,.8,0,1.9,.11,.9);for(const leg of [-.74,.74])box(desk,own('metal'),leg,.39,0,.065,.76,.65);
        box(desk,own('dark'),0,1.17,-.23,.08,.5,.08);box(desk,own('dark'),0,1.36,-.27,.9,.58,.09);
        const monitor=material(state==='pulado'?0x182733:new THREE.Color(STATE_COLORS[state]),{emissive:state==='pulado'?0x000000:new THREE.Color(STATE_COLORS[state]),emissiveIntensity:state==='ativo'?1.8:.55,roughness:.3});materials.set(`monitor${s}`,monitor);
        const screen=box(desk,monitor,0,1.36,-.21,.79,.46,.012,false);screen.userData.baseIntensity=monitor.emissiveIntensity;sectorMeshes.push({sector,screen});dynamicMeshes.add(screen);
        box(desk,own('metal'),0,.87,.14,.62,.025,.2,false);box(desk,own('chair'),0,.54,.85,.55,.12,.5);box(desk,own('chair'),0,.86,1.06,.55,.56,.1);box(desk,own('metal'),0,.25,.85,.06,.5,.06);
        const person=new THREE.Mesh(geometry.capsule,own('person'));person.position.set(0,.96,.66);desk.add(person);const head=new THREE.Mesh(geometry.sphere,own('person'));head.position.set(0,1.38,.63);desk.add(head);
        const hands=new THREE.Group();hands.position.set(0,.94,.3);desk.add(hands);for(const side of [-1,1])dynamicMeshes.add(box(hands,own('person'),side*.18,0,0,.11,.09,.38,false));
        const bubbleElement=el('div','event-bubble'),bubble=new CSS2DObject(bubbleElement);bubble.position.set(x,2.75,z+.5);bubble.visible=false;group.add(bubble);
        const guest=new THREE.Group();guest.position.set(.75,0,.4);guest.visible=false;desk.add(guest);
        const guestBody=new THREE.Mesh(geometry.capsule,own('person'));guestBody.position.set(0,.96,.66);guest.add(guestBody);
        const guestHead=new THREE.Mesh(geometry.sphere,own('person'));guestHead.position.set(0,1.38,.63);guest.add(guestHead);
        typing.push({index,sector,state,hands,head,person,guest,bubble,bubbleElement,screen,until:0,guestUntil:0,offset:s*1.7});
        const text=el('div','desk-label',SECTOR_NAMES[sector]),label=new CSS2DObject(text);label.position.set(x,2.31,z-.2);label.visible=false;group.add(label);deskLabels.push(label);
        // Pequena placa de status acompanha o nome exibido pelo CSS2DRenderer.
        box(desk,monitor,.66,.94,0,.28,.15,.045,false);
        const hit=box(desk,hitMaterial,0,1,.2,2.1,1.9,1.7,false);hit.userData={index,sector};pickDesks.push(hit);
      });
      const proxy=add(hitMaterial,0,1.65,0,12.2,3.25,9.3,false);proxy.userData={index};pickFloors.push(proxy);
      // Agrupa centenas de peças estáticas em instâncias por material/andar.
      // Proxies, fachadas, monitores e mãos animadas conservam seus objetos.
      group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map();
      group.traverse(mesh=>{if(!mesh.isMesh||mesh.geometry!==geometry.box||mesh.material===hitMaterial||dynamicMeshes.has(mesh)||facades.includes(mesh))return;const key=mesh.material;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);});
      for(const [mat,meshes] of batches){const batch=new THREE.InstancedMesh(geometry.box,mat,meshes.length);meshes.forEach((mesh,i)=>{batch.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));mesh.removeFromParent();});batch.instanceMatrix.needsUpdate=true;batch.castShadow=!coarse;batch.receiveShadow=!coarse;group.add(batch);}
      const mats=[...materials.values()];mats.forEach(mat=>{mat.userData.restOpacity=mat.opacity;mat.userData.restTransparent=mat.transparent;});
      floorGroups.push({group,materials:mats,facades,glass,ceiling,deskLabels,sectorMeshes,floorLabel,labelObject,glow,flashUntil:0});
    });
    const roof=new THREE.Group();scene.add(roof);box(roof,baseMaterials.metal,0,.1,0,12.65,.3,9.65);box(roof,baseMaterials.dark,0,.32,0,12.1,.14,9.1);box(roof,baseMaterials.core,2,.85,-1.5,3.2,1,3);box(roof,baseMaterials.metal,-3,1.5,-2.5,.06,2.4,.06);box(roof,baseMaterials.strip,-3,2.72,-2.5,.12,.09,.12,false);
    function applyTheme(){scene.fog=new THREE.FogExp2(light.matches?0xc7d5e2:0x102033,.007);hemi.intensity=light.matches?3.2:2.2;renderer.toneMappingExposure=light.matches?1.25:1.12;plaza.color.setHex(light.matches?0x899eaf:0x172c39);skyline.color.setHex(light.matches?0x8b9bab:0x101f30);invalidate();}
    let frameId=0,timer=0,fly=null,interacting=false,lost=false,lastTime=0;
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
    function invalidate(){if(!frameId&&!lost&&!document.hidden&&authenticated)frameId=requestAnimationFrame(frame);}
    function targetY(index){return .48+index*(3.4+explosion*3.2)+(focus>=0&&index>focus?5.5:0);}
    function overviewPose(){
      const top=height+Math.max(0,floors.length-1)*explosion*3.2+(focus>=0?5.5:0),aspect=camera.aspect;
      const distance=Math.max(26,(top*.61+7)/Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),(10+top*.14)/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*aspect));
      const target=new THREE.Vector3(0,top*.43,0),direction=new THREE.Vector3(.85,.46,1.2).normalize();return {position:target.clone().addScaledVector(direction,distance),target};
    }
    function focusPose(index){
      const target=new THREE.Vector3(0,targetY(index)+1.1,0),direction=new THREE.Vector3(.18,.8,1).normalize();
      // Enquadra os cantos do andar, com margem para os rótulos em telas estreitas.
      const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
      const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;let distance=controls.minDistance;
      for(const x of [-6.3,6.3])for(const y of [-1.1,2.1])for(const z of [-4.8,4.8]){
        const corner=new THREE.Vector3(x,y,z),depth=corner.dot(direction);
        distance=Math.max(distance,depth+Math.abs(corner.dot(right))*1.12/tanH,depth+Math.abs(corner.dot(up))*1.12/tanV);
      }
      return {position:target.clone().addScaledVector(direction,distance),target};
    }
    function reframe(instant=false){const pose=focus>=0?focusPose(focus):overviewPose();if(instant||reduced.matches){camera.position.copy(pose.position);controls.target.copy(pose.target);fly=null;}else fly={start:performance.now(),position:camera.position.clone(),target:controls.target.clone(),...{endPosition:pose.position,endTarget:pose.target}};invalidate();}
    function updateSelection(){
      floorGroups.forEach((item,index)=>{
        const above=focus>=0&&index>focus;
        item.materials.forEach(mat=>{const ghost=above?.09:mat.userData.restOpacity;mat.opacity=ghost;const transparent=above||mat.userData.restTransparent;if(mat.transparent!==transparent){mat.transparent=transparent;mat.needsUpdate=true;}});
        item.glass.opacity=above?.045:index===focus?.055:(coarse?.24:1);item.glass.transmission=coarse?0:index===focus?.2:.88;
        item.sectorMeshes.forEach(record=>record.screen.material.emissiveIntensity=record.screen.userData.baseIntensity);
        item.group.traverse(child=>{if(child.isMesh&&child.material===item.ceiling)child.visible=index!==focus;});
        item.facades.forEach(face=>face.visible=index!==focus);item.group.traverse(child=>{if(child.isMesh&&child.material!==hitMaterial)child.castShadow=!above&&!coarse&&child.material!==item.glass;});
        item.deskLabels.forEach(label=>label.visible=index===focus);item.labelObject.visible=focus<0||index===focus;item.floorLabel.classList.toggle('selected',index===focus);
        item.floorLabel.textContent=themeIcon(floors[index])+(index===focus?`${floors[index].n??index+1} / ${floors[index].titulo||'Projeto'}`:`${String(floors[index].n??index+1).padStart(2,'0')} / ${FLOOR_STATES[floorState(floors[index])]}`);
      });roof.visible=focus<0;renderer.shadowMap.needsUpdate=true;invalidate();
    }
    function frame(now){
      frameId=0;if(document.hidden||lost||!authenticated)return;const delta=Math.min(64,lastTime?now-lastTime:16);lastTime=now;let moving=false;
      floorGroups.forEach((item,index)=>{const y=targetY(index),diff=y-item.group.position.y;if(Math.abs(diff)>.003){item.group.position.y=reduced.matches?y:item.group.position.y+diff*(1-Math.exp(-delta/130));moving=true;}else item.group.position.y=y;});
      roof.position.y=floorGroups.length?floorGroups.at(-1).group.position.y+3.38:1.2;
      if(fly){const k=Math.min(1,(now-fly.start)/850),ease=k*k*(3-2*k);camera.position.lerpVectors(fly.position,fly.endPosition,ease);controls.target.lerpVectors(fly.target,fly.endTarget,ease);if(k===1)fly=null;else moving=true;}
      let animating=false;
      for(const worker of typing){
        const busy=worker.state==='ativo'||now<worker.until,visible=worker.index===focus||focus<0;
        worker.bubble.visible=visible&&now<worker.until;
        worker.guest.visible=now<worker.guestUntil;
        const transient=now<worker.until||now<worker.guestUntil;
        if(transient)animating=true;
        worker.screen.material.emissiveIntensity=now<worker.until?(!reduced.matches?1.6+Math.sin(now*.018)*1.1:2.2):(worker.index===focus&&worker.sector===chosenSector?2.2:worker.screen.userData.baseIntensity);
        if((busy||worker.index===focus)&&!reduced.matches){
          animating=true;worker.hands.rotation.x=busy?Math.sin(now*.012+worker.offset)*.1:0;
          worker.head.rotation.x=busy?Math.sin(now*.004+worker.offset)*.035:0;
          worker.person.scale.y=busy?1:1+Math.sin(now*.0018+worker.offset)*.018;
        }
      }
      floorGroups.forEach((item,index)=>{
        const flash=now<item.flashUntil&&index!==focus;
        item.glow.emissiveIntensity=flash?(!reduced.matches?1.6+Math.sin(now*.015)*1.2:2):.5;
        item.glow.opacity=flash?.8:.19;if(flash)animating=true;
      });
      controls.update();if(moving)renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);labels.render(scene,camera);
      if(moving||interacting)invalidate();else if(animating){clearTimeout(timer);timer=setTimeout(invalidate,33);}
    }
    controls.addEventListener('change',invalidate);controls.addEventListener('start',()=>{interacting=true;fly=null;invalidate();});controls.addEventListener('end',()=>{interacting=false;invalidate();});
    renderer.domElement.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY,time:performance.now(),id:event.pointerId};});
    renderer.domElement.addEventListener('pointercancel',()=>down=null);
    renderer.domElement.addEventListener('pointerup',event=>{
      if(!down||down.id!==event.pointerId)return;const origin=down;down=null;if(Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>7||performance.now()-origin.time>600)return;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
      const desk=focus>=0?ray.intersectObjects(pickDesks.filter(mesh=>mesh.userData.index===focus),false)[0]:null;
      if(desk){showSector(desk.object.userData.sector);return;}const hit=ray.intersectObjects(pickFloors,false).find(result=>focus<0||result.object.userData.index<=focus);if(hit)selectFloor(hit.object.userData.index);
    });
    function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);labels.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();reframe(true);}
    const observer=new ResizeObserver(resize);observer.observe(host);
    sceneAPI={dispose(){
      lost=true;cancelAnimationFrame(frameId);clearTimeout(timer);observer.disconnect();controls.dispose();
      document.removeEventListener('visibilitychange',onSceneVisibility);
      light.removeEventListener('change',applyTheme);reduced.removeEventListener('change',invalidate);
      const geometries=new Set(Object.values(geometry)),materials=new Set(Object.values(baseMaterials));
      scene.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)for(const mat of (Array.isArray(node.material)?node.material:[node.material]))materials.add(mat);});
      geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());environment.dispose();renderer.dispose();host.replaceChildren();
    },pause(){cancelAnimationFrame(frameId);frameId=0;clearTimeout(timer);},event(event){
      const index=floors.findIndex(f=>string(f.pasta)===string(event.pasta));if(index<0)return;
      const now=performance.now();floorGroups[index].flashUntil=now+8000;
      const worker=typing.find(w=>w.index===index&&w.sector===event.setor);
      if(worker){worker.until=now+8000;worker.bubbleElement.textContent=`${string(event.tipo)} · ${string(event.nome)}`;if(event.tipo==='agente')worker.guestUntil=now+20000;}
      invalidate();
    },select(index){focus=index;chosenSector=null;updateSelection();reframe();},explode(value){explosion=value;reframe();invalidate();},reframe(){reframe();},sector(sector){chosenSector=sector;floorGroups.forEach((item,index)=>item.sectorMeshes.forEach(record=>{record.screen.material.emissiveIntensity=record.sector===chosenSector&&index===focus?2.2:record.screen.userData.baseIntensity;}));invalidate();}};
    function onSceneVisibility(){clearTimeout(timer);if(document.hidden){cancelAnimationFrame(frameId);frameId=0;lastTime=0;}else invalidate();}
    document.addEventListener('visibilitychange',onSceneVisibility);
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(frameId);frameId=0;clearTimeout(timer);showFallback('A visualização 3D foi interrompida.','A lista e os detalhes continuam disponíveis. Reabra a página para restaurar o 3D.');});
    light.addEventListener('change',applyTheme);reduced.addEventListener('change',invalidate);
    resize();applyTheme();updateSelection();if(selected>=0)sceneAPI.select(selected);$('fallback').hidden=true;
  }
  function showFallback(title,message){const box=$('fallback');box.hidden=false;box.replaceChildren(el('strong','',title),el('p','',message));}

