import { criarConversa } from './conversa.js';
import { renderBI } from './bi.js';

const $ = id => document.getElementById(id);
const text = value => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const el = (tag, value, cls) => { const n = document.createElement(tag); if (value !== undefined) n.textContent = text(value); if (cls) n.className = cls; return n; };
const array = value => Array.isArray(value) ? value : [];
const clone = value => JSON.parse(JSON.stringify(value));
const TIPOS = { kpis:'Indicadores', etapas:'Etapas', tabela:'Tabela', lista:'Lista', calendario:'Calendário', linha_tempo:'Linha do tempo', galeria:'Entregas', checklist:'Validação', equipe:'Equipe', decisoes:'Decisões', pesquisa:'Pesquisa', grafico:'Gráfico', metrica_externa:'Métricas externas', conversa:'Conversa' };
const ICONES = { kpis:'◷', etapas:'▤', tabela:'▦', lista:'☷', calendario:'▣', linha_tempo:'◴', galeria:'▧', checklist:'✓', equipe:'♟', decisoes:'◆', pesquisa:'◎', grafico:'▥', metrica_externa:'↗', conversa:'✉' };
const CAMINHOS = { kpis:'kpis', etapas:'etapas', tabela:'extra.tarefas', lista:'pendencias', calendario:'extra.agenda', linha_tempo:'linha_tempo', galeria:'entregas', checklist:'criterios', equipe:'setores', decisoes:'decisoes', pesquisa:'pesquisa', grafico:'extra.grafico', metrica_externa:'externo' };
const PROPS = ['claquete','refletor','camera','sofa','arcade','controle','pufe','neon','servidor','quadro_branco','monitor_duplo','planta','estante','trofeu','mesa_pingpong','cavalete','microfone','globo'];
const SETORES = { diretoria:'Diretoria · Diretor', pesquisa:'Pesquisa · Pesquisador', criacao:'Criação · Criador', producao:'Produção · Desenvolvedor', qualidade:'Qualidade · Revisor', ferramentas:'Ferramentas · Especialista', documentacao:'Documentação · Documentalista' };
const pasta = new URLSearchParams(location.search).get('pasta');
const query = `?pasta=${encodeURIComponent(pasta || '')}`;
let tema = null, salvo = null, ficha = {}, floor = null, eventos = [], catalogo = [], timer = 0, liveVersion = 0, ativo = false, busy = false;
const conversa = criarConversa({api, getFloors:() => floor ? [floor] : [], getFloor:() => floor});

async function api(path, {method='GET', body} = {}) {
  const r = await fetch(path, {method, credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(10000), headers:body === undefined ? {} : {'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body)});
  if (r.status === 401) { ativo = false; clearTimeout(timer); conversa.setEnabled(false); location.replace('/'); }
  const data = await r.json();
  if (!r.ok) { const error = new Error(data.erro || `Erro ${r.status}`); error.status = r.status; throw error; }
  return data;
}
async function optional(path) { try { return await api(path); } catch (e) { if (e.status === 404) return null; throw e; } }
function date(value) { const d = new Date(value); return !value || Number.isNaN(d.getTime()) ? text(value) || 'Data não informada' : d.toLocaleString('pt-BR'); }
function url(value, media=false) {
  if (typeof value !== 'string' || !value.trim() || /[\\\u0000-\u001f]/.test(value) || /^[a-z]:/i.test(value)) return null;
  if (media && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
  try { const u = new URL(value, location.href); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password && (!media || u.origin === location.origin) ? u.href : null; } catch { return null; }
}
function link(parent, value, label='Abrir ↗') { const href = url(value); if (href) { const a = el('a', label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.append(a); } }
function button(label, action) { const b = el('button', label); b.type = 'button'; b.addEventListener('click', action); return b; }
function resolveData(painel) {
  const path = painel.dados || (CAMINHOS[painel.tipo] ? `ficha.${CAMINHOS[painel.tipo]}` : '');
  if (!/^ficha(?:\.[\p{L}\p{N}_-]+)+$/u.test(path)) return undefined;
  let value = ficha;
  for (const key of path.split('.').slice(1)) {
    if (['__proto__','prototype','constructor'].includes(key) || !value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}
function empty(parent, tipo) { parent.append(el('p', `Ainda sem dados: o /auto preenche quando registrar ${TIPOS[tipo]?.toLowerCase() || 'informações'} neste projeto.`, 'vazio')); }
function hasData(value) { return value != null && (typeof value !== 'object' || Object.keys(value).length > 0) && value !== ''; }
function heading(item) { return typeof item === 'object' && item ? item.titulo ?? item.nome ?? item.texto ?? item.rotulo ?? item.valor ?? text(item) : item; }
function details(parent, item) {
  if (!item || typeof item !== 'object') return;
  for (const key of ['status','detalhe','descricao','motivo','resumo','resultado','responsavel','fonte']) if (hasData(item[key])) parent.append(el('p', item[key], 'muted'));
  if (item.hora || item.data) { const t = el('time', date(item.hora || item.data)); parent.append(t); }
  link(parent, item.link || item.url);
}
function items(value) { return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.entries(value).map(([nome, valor]) => ({nome, valor})) : hasData(value) ? [value] : []; }
const label = value => text(value).replaceAll('_',' ').replace(/^./u, c => c.toLocaleUpperCase('pt-BR'));
const sameLabel = (a,b) => text(a).replaceAll('_',' ').trim().toLocaleLowerCase('pt-BR') === text(b).replaceAll('_',' ').trim().toLocaleLowerCase('pt-BR');
function list(parent, value, kind='lista', group='') {
  const ul = el('ul', undefined, kind === 'linha_tempo' ? 'timeline' : 'lista');
  for (const item of items(value)) { const li = el('li', undefined, kind === 'linha_tempo' ? '' : 'item'); if (!group || !sameLabel(heading(item),group)) li.append(el('strong', heading(item))); details(li, item); if (item?.valor !== undefined && item?.nome !== undefined) li.append(el('p', item.valor)); ul.append(li); }
  parent.append(ul);
}
function table(parent, value) {
  const rows = items(value).map(row => row && typeof row === 'object' ? row : {valor:row});
  const cols = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const wrap = el('div', undefined, 'tabela-wrap'), t = el('table'), head = el('thead'), tr = el('tr');
  for (const key of cols) { const th = el('th', key.replaceAll('_',' ')); th.scope = 'col'; tr.append(th); }
  head.append(tr); const body = el('tbody');
  for (const row of rows) { const line = el('tr'); for (const key of cols) { const td = el('td'); if (['url','link'].includes(key)) link(td, row[key], row[key]); else td.textContent = text(row[key]); line.append(td); } body.append(line); }
  t.append(head, body); wrap.append(t); parent.append(wrap);
}
function chart(parent, value) {
  const raw = Array.isArray(value) ? value : array(value?.pontos || value?.valores);
  const points = raw.map((p,i) => ({label:text(p?.rotulo ?? p?.nome ?? p?.data ?? i+1), value:Number(p?.valor ?? p)})).filter(p => Number.isFinite(p.value));
  if (!points.length) return empty(parent, 'grafico');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, content) => { const n = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v); if (content !== undefined) n.textContent = text(content); return n; };
  const root = svg('svg', {viewBox:'0 0 600 250', class:'grafico', role:'img', 'aria-label':'Gráfico de valores. Dados detalhados na tabela a seguir.'});
  const min = Math.min(0, ...points.map(p => p.value)), max = Math.max(0, ...points.map(p => p.value)), span = max-min || 1;
  const y = n => 195-(n-min)/span*165, step = 530/points.length, x = i => 45+step*(i+.5);
  root.append(svg('line', {x1:40,y1:y(0),x2:580,y2:y(0),class:'eixo'}));
  if (value?.tipo === 'linha') {
    root.append(svg('polyline', {points:points.map((p,i) => `${x(i)},${y(p.value)}`).join(' '), fill:'none', stroke:'currentColor', 'stroke-width':3}));
    points.forEach((p,i) => root.append(svg('circle', {cx:x(i),cy:y(p.value),r:4,fill:'currentColor'})));
  } else points.forEach((p,i) => root.append(svg('rect', {x:x(i)-step*.32,y:Math.min(y(0),y(p.value)),width:step*.64,height:Math.max(1,Math.abs(y(p.value)-y(0))),rx:3})));
  points.forEach((p,i) => { if (points.length <= 12 || i % Math.ceil(points.length/12) === 0) root.append(svg('text', {x:x(i),y:220,'text-anchor':'middle'}, p.label.slice(0,12))); });
  parent.append(root); const d = el('details'), summary = el('summary','Ver valores'); d.append(summary); table(d, points.map(p => ({rotulo:p.label,valor:p.value}))); parent.append(d);
}
function renderTeam(parent, value) {
  const sectors = value && typeof value === 'object' ? value : {};
  const box = el('div', undefined, 'equipe');
  const keys = new Set([...Object.keys(sectors), ...eventos.map(e => e.setor)]);
  if (!keys.size) return empty(parent, 'equipe');
  for (const key of keys) {
    const entry = sectors[key], event = eventos.find(e => e.setor === key), row = el('div', undefined, 'pessoa');
    row.append(el('strong', SETORES[key] || key), el('small', typeof entry === 'object' ? entry?.status : entry || 'Estado não informado'));
    if (event) row.append(el('p', [sameLabel(event.nome,key) || sameLabel(event.nome,SETORES[key]) ? '' : event.nome, event.motivo || event.tipo].filter(Boolean).join(' · ')), el('small', date(event.hora)));
    const guests = [...new Set(eventos.filter(e => e.setor === key && e.tipo === 'agente' && !sameLabel(e.nome,key) && !sameLabel(e.nome,SETORES[key])).map(e => e.nome))];
    if (guests.length) row.append(el('small', `Funcionários: ${guests.join(', ')}`));
    box.append(row);
  }
  parent.append(box);
}
function renderStages(parent, value) {
  const stages = items(value), grouped = stages.some(stage => Array.isArray(stage?.itens));
  const columns = grouped ? stages : [...new Set(stages.map(stage => text(stage?.status) || 'Sem status'))].map(status => ({nome:status,itens:stages.filter(stage => (text(stage?.status) || 'Sem status') === status)}));
  const box = el('div',undefined,'etapas kanban');
  box.tabIndex = 0; box.setAttribute('aria-label','Etapas; role horizontalmente para ver todas as colunas');
  for (const stage of columns) {
    const name = stage.nome || stage.titulo, row = el('section',undefined,'etapa');
    row.append(el('h3',label(name)));
    if (array(stage.itens).length) list(row,stage.itens,'lista',name);
    else row.append(el('p','Nenhum item nesta etapa.','muted'));
    box.append(row);
  }
  parent.append(box);
}
function renderCalendar(parent, value) {
  const today = new Date(), start = new Date(today.getFullYear(),today.getMonth(),today.getDate());
  start.setDate(start.getDate() - (start.getDay()+6)%7);
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const rows = items(value).map(item => {
    const raw = text(item.data || item.hora);
    return {item,day:new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw)};
  }).filter(row => !Number.isNaN(row.day.getTime())).sort((a,b) => a.day-b.day);
  const box = el('div',undefined,'calendario-semana');
  for (let i=0;i<7;i++) {
    const day = new Date(start); day.setDate(start.getDate()+i);
    const column = el('section',undefined,'calendario-coluna');
    if (dayKey(day) === dayKey(today)) column.classList.add('hoje');
    column.append(el('h3',day.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}),'calendario-dia'));
    const entries = rows.filter(row => dayKey(row.day) === dayKey(day));
    for (const {item} of entries) {
      const card = el('article',undefined,'item'); card.append(el('strong',heading(item)));
      if (item.canal || item.plataforma) card.append(el('p',[item.canal,item.plataforma].filter(Boolean).map(label).join(' · '),'muted'));
      details(card,item); column.append(card);
    }
    if (!entries.length) column.append(el('p','Sem eventos','muted'));
    box.append(column);
  }
  parent.append(box);
}
function renderGallery(parent, value) {
  const groups = new Map();
  for (const raw of items(value)) {
    const item = typeof raw === 'string' ? {caminho:raw} : raw;
    const path = text(item.caminho || item.url || item.nome).split(/[?#]/)[0];
    const base = path.replace(/\.(mp4|webm|jpg|jpeg|png|webp|gif|svg|md)$/i,'').replace(/-(capa|folha)$/i,'');
    const movie = /\.(mp4|webm)$/i.test(path) || /^(video|vídeo)$/i.test(item.tipo);
    const image = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(path) || /^(imagem|image)$/i.test(item.tipo);
    const script = /\.md$/i.test(path);
    if (!movie && !image && !script) continue;
    if (!groups.has(base)) groups.set(base,{base,files:[],time:0});
    const group = groups.get(base);
    group.files.push({item,path:item.url || item.caminho,movie,image,script});
    group.time = Math.max(group.time,Date.parse(item.data || item.hora) || 0);
  }
  const sorted = [...groups.values()].sort((a,b) => b.time-a.time || a.base.localeCompare(b.base));
  if (!sorted.length) return empty(parent,'galeria');
  const box = el('div',undefined,'galeria'); parent.append(box);
  function draw(limit) {
    box.replaceChildren();
    for (const group of sorted.slice(0,limit)) {
      const row = el('article',undefined,'entrega');
      const cover = group.files.find(f => f.image && /-capa\./i.test(f.path)) || group.files.find(f => f.image);
      const movie = group.files.find(f => f.movie);
      const name = label(group.base.split(/[\\/]/).pop());
      const placeholder = () => el('div',`${movie ? '▶' : cover ? '🖼' : '📄'} ${name}`,'mini-vazia');
      const source = [cover,...group.files].find(file => typeof file?.item.miniatura === 'string' && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(file.item.miniatura))?.item.miniatura;
      if (source) {
        const media = el('img'); media.src = source;
        media.alt = name; media.loading = 'lazy';
        media.addEventListener('error',() => media.replaceWith(placeholder())); row.append(media);
      } else row.append(placeholder());
      row.append(el('h3',name));
      const assets = el('div',undefined,'entrega-arquivos');
      const types = new Set(group.files.map(file => file.movie ? 'Vídeo' : file.script ? 'Roteiro' : /-folha\./i.test(file.path) ? 'Folha' : 'Capa'));
      for (const type of types) assets.append(el('span',type,'chip'));
      row.append(assets); box.append(row);
    }
  }
  draw(12);
  if (sorted.length > 12) { const more = button(`ver todos (${sorted.length})`,() => { draw(sorted.length); more.remove(); }); parent.append(more); }
}
function renderMetrics(parent, value) {
  const channels = new Map();
  function collect(data, path=[]) {
    if (!data || typeof data !== 'object') return;
    if (['postados','pendentes','erros','reenvios'].some(key => Object.hasOwn(data,key))) {
      const channel = text(data.canal || data.nome || path.at(-2) || 'Canal');
      const platform = text(data.plataforma || path.at(-1) || 'Plataforma');
      if (!channels.has(channel)) channels.set(channel,new Map());
      channels.get(channel).set(platform,data); return;
    }
    if (Array.isArray(data)) data.forEach(item => collect(item,path));
    else for (const [key,item] of Object.entries(data)) collect(item,[...path,key]);
  }
  collect(value);
  if (!channels.size) { table(parent,items(value)); return; }
  const platforms = [...new Set([...channels.values()].flatMap(row => [...row.keys()]))];
  const wrap = el('div',undefined,'tabela-wrap metricas'), t = el('table'), head = el('thead'), header = el('tr');
  for (const name of ['Canal',...platforms]) { const th = el('th',label(name)); th.scope = 'col'; header.append(th); }
  head.append(header); const body = el('tbody');
  for (const [channel,platformData] of channels) {
    const row = el('tr'), name = el('th',label(channel)); name.scope = 'row'; row.append(name);
    for (const platform of platforms) {
      const td = el('td'), data = platformData.get(platform);
      if (!data) td.append(el('span','—'));
      else {
        const counts = el('div',undefined,'metrica-numeros');
        for (const key of ['postados','pendentes','erros','reenvios']) if (key !== 'reenvios' || data[key] != null) {
          const count = el('span',`${label(key)}: ${text(data[key] ?? 0)}`,`metrica-${key}`); counts.append(count);
        }
        td.append(counts);
        const next = array(data.proximos_horarios).slice().sort((a,b) => (Date.parse(a)||0)-(Date.parse(b)||0))[0] || data.proximo_horario;
        td.append(el('small',next ? `Próximo: ${date(next)}` : 'Sem horário'));
        const href = [...array(data.links).map(item => typeof item === 'string' ? item : item?.url || item?.link),data.url,data.link].find(item => url(item));
        link(td,href,'abrir');
      }
      row.append(td);
    }
    body.append(row);
  }
  t.append(head,body); wrap.append(t); parent.append(wrap);
}
function renderBody(parent, p) {
  const value = resolveData(p);
  if (p.tipo === 'conversa') { parent.append(el('p','Acompanhe os pedidos e converse com o Diretor deste andar.'), button('Falar com o Claude', () => conversa.open())); return; }
  if (p.tipo === 'equipe') { renderTeam(parent, value); return; }
  if (p.tipo === 'linha_tempo') {
    const merged = [...items(value), ...eventos.map(e => ({hora:e.hora,texto:`${e.setor} · ${e.nome}`,detalhe:e.motivo || e.tipo}))];
    const unique = [...new Map(merged.map(i => [JSON.stringify(i),i])).values()].sort((a,b) => (Date.parse(b.hora || b.data) || 0)-(Date.parse(a.hora || a.data) || 0));
    if (!unique.length) empty(parent,p.tipo); else list(parent,unique,p.tipo); return;
  }
  if (p.tipo === 'calendario') return renderCalendar(parent,value);
  if (!hasData(value)) return empty(parent,p.tipo);
  switch (p.tipo) {
    case 'kpis': {
      const box = el('div',undefined,'kpis');
      for (const k of items(value)) { const row = el('div',undefined,'kpi'); if (['ok','alerta','erro'].includes(k.tom)) row.dataset.tom = k.tom; row.append(el('small',k.rotulo || k.nome),el('strong',k.valor)); if (k.meta !== undefined) row.append(el('small',`Meta: ${text(k.meta)}`)); box.append(row); } parent.append(box); break;
    }
    case 'etapas': renderStages(parent,value); break;
    case 'tabela': table(parent,value); break;
    case 'grafico': chart(parent,value); break;
    case 'galeria': renderGallery(parent,value); break;
    case 'checklist': {
      const rows = items(value), done = rows.filter(r => r.feito === true).length, percent = Math.round(done/rows.length*100);
      parent.append(el('p',`${percent}% concluído · ${done}/${rows.length} critérios do /auto`)); const progress = el('progress'); progress.max = rows.length; progress.value = done; progress.setAttribute('aria-label',`${percent}% dos critérios concluídos`); parent.append(progress);
      for (const row of rows) { const label = el('label',undefined,'criterio'), input = el('input'); input.type = 'checkbox'; input.checked = row.feito === true; input.disabled = true; label.append(input,el('span',row.texto || heading(row))); parent.append(label); } parent.append(el('small','Validação registrada pelo /auto. Peça ajustes na conversa.')); break;
    }
    case 'metrica_externa': renderMetrics(parent,value); break;
    case 'lista': case 'decisoes': case 'pesquisa': list(parent,value); break;
    default: empty(parent,p.tipo);
  }
}
function palette() {
  for (const [key,color] of Object.entries(tema.paleta)) if (/^#[a-f\d]{6}$/i.test(color)) document.documentElement.style.setProperty(`--${key}`,color);
  if (/^#[a-f\d]{6}$/i.test(tema.andar.piso)) document.documentElement.style.setProperty('--chao',tema.andar.piso);
  document.querySelector('meta[name=theme-color]').content = tema.paleta.fundo;
}
function render() {
  if (!tema) return;
  palette(); renderBI($('bi'), ficha); $('tema-nome').textContent = tema.nome; $('icone').textContent = tema.icone;
  $('paineis').replaceChildren();
  for (const p of tema.paineis) { const card = el('section',undefined,'card'); card.dataset.tipo = p.tipo; card.dataset.id = p.id; const muro = el('div',undefined,'muro'), icon = el('span',ICONES[p.tipo] || '▦','quadro'); icon.setAttribute('aria-hidden','true'); muro.append(icon,el('h2',p.titulo)); const body = el('div',undefined,'corpo'); renderBody(body,p);
    if (['lista','tabela','checklist','galeria','linha_tempo','calendario','decisoes','pesquisa','metrica_externa'].includes(p.tipo)) {
      card.classList.add('painel-rolavel');
      body.id = `painel-corpo-${tema.paineis.indexOf(p)}`;
      body.tabIndex = 0;
      body.setAttribute('role','region');
      body.setAttribute('aria-label',p.titulo);
      const toggle = button('Expandir',() => {
        const expanded = card.classList.toggle('expandido');
        toggle.textContent = expanded ? 'Recolher' : 'Expandir';
        toggle.setAttribute('aria-expanded',String(expanded));
      });
      toggle.className = 'expandir-painel';
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-controls',body.id);
      muro.append(toggle);
    }
    card.append(muro,body); $('paineis').append(card); }
  if (!tema.paineis.length) $('paineis').append(el('p','Nenhum painel ativo. Use Editar tema para ligar os painéis.','vazio'));
}
function liveRender() { for (const node of $('paineis').children) if (['equipe','linha_tempo'].includes(node.dataset.tipo)) { const p = tema?.paineis.find(p => p.id === node.dataset.id); if (p) { const body = node.querySelector('.corpo'); body.replaceChildren(); renderBody(body,p); } } }
async function poll() {
  clearTimeout(timer); const version = ++liveVersion; if (!ativo || document.hidden) return;
  try { const data = await api('/api/estado'); if (version !== liveVersion || !ativo || document.hidden) return; eventos = array(data.eventos).filter(e => e.pasta === pasta).sort((a,b) => (Date.parse(b.hora)||0)-(Date.parse(a.hora)||0)); liveRender(); $('ao-vivo').textContent = `Ao vivo · atualizado às ${new Date().toLocaleTimeString('pt-BR')} · equipe e linha do tempo`; }
  catch { if (version === liveVersion && ativo) $('ao-vivo').textContent = 'Conexão interrompida. Nova tentativa em 4 segundos.'; }
  finally { if (version === liveVersion && ativo && !document.hidden) timer = setTimeout(poll,4000); }
}

function syncPanels() { tema.paineis = catalogo.filter(p => p.ligado).map(({ligado,...p}) => p); render(); }
function makeCatalog() {
  const previous = catalogo;
  catalogo = tema.paineis.map(p => ({...clone(p),ligado:true}));
  for (const p of previous) if (!catalogo.some(current => current.id === p.id)) catalogo.push({...p,ligado:false});
  for (const [tipo,titulo] of Object.entries(TIPOS)) if (!catalogo.some(p => p.tipo === tipo)) { let id = tipo; while (catalogo.some(p => p.id === id)) id += '-novo'; catalogo.push({id,tipo,titulo,...(CAMINHOS[tipo] ? {dados:`ficha.${CAMINHOS[tipo]}`} : {}),ligado:false}); }
}
function editorPanels() {
  $('editor-paineis').replaceChildren();
  catalogo.forEach((p,index) => {
    const row = el('div',undefined,'painel-edicao'), label = el('label'), check = el('input'); check.type = 'checkbox'; check.checked = p.ligado;
    check.addEventListener('change',() => { if (check.checked && catalogo.filter(p => p.ligado).length >= 16) { check.checked = false; $('editor-aviso').textContent = 'Ative no máximo 16 painéis.'; return; } p.ligado = check.checked; $('editor-aviso').textContent = ''; syncPanels(); }); label.append(check,el('span',TIPOS[p.tipo] || p.tipo));
    const titleLabel = el('label','Título'), name = el('input'); name.type = 'text'; name.maxLength = 80; name.required = true; name.value = p.titulo; name.addEventListener('input',() => { p.titulo = name.value; syncPanels(); }); titleLabel.append(name);
    const order = el('div',undefined,'ordem'); order.append(el('small',p.id));
    for (const [delta,arrow] of [[-1,'↑'],[1,'↓']]) { const b = button(arrow,() => { const dest = index+delta; [catalogo[index],catalogo[dest]] = [catalogo[dest],catalogo[index]]; syncPanels(); editorPanels(); $('editor-paineis').children[dest].querySelector(delta < 0 ? '.subir' : '.descer').focus(); }); b.className = delta < 0 ? 'subir' : 'descer'; b.setAttribute('aria-label',`${delta < 0 ? 'Subir' : 'Descer'} ${p.titulo}`); b.disabled = index+delta < 0 || index+delta >= catalogo.length; order.append(b); }
    row.append(label,titleLabel,order); $('editor-paineis').append(row);
  });
}
function fillEditor() {
  $('campos-tema').replaceChildren(); $('cores').replaceChildren(); $('decoracao').replaceChildren();
  for (const [key,title] of [['nome','Nome'],['icone','Ícone']]) { const label = el('label',title), input = el('input'); input.type = 'text'; input.maxLength = 80; input.required = true; input.value = tema[key]; input.addEventListener('input',() => { tema[key] = input.value; render(); }); label.append(input); $('campos-tema').append(label); }
  for (const [group,keys] of [['paleta',Object.keys(tema.paleta)],['andar',['piso','luz','fachada']]]) for (const key of keys) { const label = el('label',key), input = el('input'); input.type = 'color'; input.value = tema[group][key]; input.addEventListener('input',() => { tema[group][key] = input.value; render(); }); label.append(input); $('cores').append(label); }
  for (const prop of PROPS) { const label = el('label'), input = el('input'); input.type = 'checkbox'; input.checked = tema.andar.decoracao.includes(prop); input.addEventListener('change',() => { if (input.checked && tema.andar.decoracao.length >= 6) { input.checked = false; $('editor-aviso').textContent = 'Escolha até 6 itens de decoração.'; return; } tema.andar.decoracao = input.checked ? [...tema.andar.decoracao,prop] : tema.andar.decoracao.filter(p => p !== prop); $('editor-aviso').textContent = ''; render(); }); label.append(input,el('span',prop.replaceAll('_',' '))); $('decoracao').append(label); }
  editorPanels();
}
function openEditor() { if (!tema) return; if ($('editor').hidden) { makeCatalog(); fillEditor(); } $('editor').hidden = false; document.body.classList.add('editor-aberto'); $('fechar-editor').focus(); }
function closeEditor() { $('editor').hidden = true; document.body.classList.remove('editor-aberto'); $('editar').focus(); }
async function persist(undo=false) {
  if (busy) return;
  if (!undo && (!tema.nome.trim() || !tema.icone.trim() || tema.paineis.some(p => !p.titulo.trim()))) { $('editor-aviso').textContent = 'Preencha nome, ícone e títulos dos painéis.'; return; }
  busy = true; const controls = [...$('editor').querySelectorAll('input,button')]; controls.forEach(n => n.disabled = true); $('editor-aviso').textContent = undo ? 'Desfazendo…' : 'Salvando…';
  try {
    const result = await api(`/api/tema${query}${undo ? '&desfazer=1' : ''}`,{method:'PUT',...(undo ? {} : {body:tema})});
    const current = await api(`/api/tema${query}`); tema = current; salvo = clone(current); makeCatalog(); render(); fillEditor();
    $('editor-aviso').textContent = `${undo ? 'Última versão restaurada.' : 'Tema salvo.'}${array(result.avisos).length ? ' '+result.avisos.join(' ') : ''}`;
  } catch (e) { $('editor-aviso').textContent = e.status === 404 && undo ? 'Ainda não há uma versão anterior para desfazer.' : `Não foi possível concluir: ${e.message}. Sua prévia foi preservada.`; }
  finally { busy = false; controls.filter(n => n.isConnected).forEach(n => n.disabled = false); editorPanels(); }
}
$('editar').addEventListener('click',openEditor);
$('fechar-editor').addEventListener('click',closeEditor);
$('editor').addEventListener('keydown',e => { if (e.key === 'Escape' && !busy) closeEditor(); });
$('form-tema').addEventListener('submit',e => { e.preventDefault(); persist(); });
$('desfazer').addEventListener('click',() => persist(true));
$('cancelar').addEventListener('click',() => { tema = clone(salvo); makeCatalog(); render(); fillEditor(); $('editor-aviso').textContent = 'Alterações locais canceladas.'; });
$('pedir').addEventListener('click',() => { closeEditor(); conversa.open('[tema] '); });
$('criar').addEventListener('click',async () => { $('criar').disabled = true; try { await api('/api/pedidos',{method:'POST',body:{pasta,andar:floor.n,texto:'[tema] Criar ambiente visual deste andar'}}); $('aviso').textContent = 'Pedido enviado: o ambiente fica pronto em até 30 min'; } catch (e) { $('aviso').textContent = `Não foi possível enviar: ${e.message}`; $('criar').disabled = false; } });
document.addEventListener('visibilitychange',() => { clearTimeout(timer); liveVersion++; if (!document.hidden) poll(); });
window.addEventListener('pagehide',() => { ativo = false; liveVersion++; clearTimeout(timer); });
window.addEventListener('pageshow',e => { if (e.persisted) { ativo = true; poll(); } });

async function init() {
  try {
    await api('/api/sessao');
    if (!pasta) { location.replace('/'); return; }
    $('andar').href = `/andar.html${query}`;
    const [theme,record,map] = await Promise.all([optional(`/api/tema${query}`),optional(`/api/ficha${query}`),api('/api/mapa')]);
    tema = theme; ficha = record || {}; floor = array(map.andares).find(f => f.pasta === pasta) || {pasta,n:pasta,titulo:ficha.titulo || pasta};
    $('titulo').textContent = ficha.titulo || floor.titulo || pasta; document.title = `${$('titulo').textContent} · /auto`;
    $('status').textContent = ficha.status || floor.status || 'Sem status'; $('resumo').textContent = ficha.resumo || '';
    conversa.setEnabled(true); $('aviso').textContent = record ? '' : 'Ficha ainda não publicada: o /auto preencherá os dados deste projeto.';
    $('sem-tema').hidden = Boolean(tema); $('editar').hidden = !tema;
    if (tema) { salvo = clone(tema); render(); if (new URLSearchParams(location.search).get('editar') === '1') openEditor(); }
    ativo = true; poll();
  } catch (e) { $('titulo').textContent = 'Dashboard indisponível'; $('aviso').textContent = `Não foi possível carregar: ${e.message}. Recarregue para tentar novamente.`; }
}
init();
