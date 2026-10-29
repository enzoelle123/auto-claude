const CORES = ['#118DFF','#12239E','#E66C37','#6B007B','#E044A7','#744EC2','#D9B300','#D64550'];
const lista = value => Array.isArray(value) ? value : [];
const texto = value => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const DIA = 86400000;
function dataISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const stamp = Date.parse(value);
  const day = value.slice(0,10), check = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(stamp) || !Number.isFinite(check.getTime()) || check.toISOString().slice(0,10) !== day) return null;
  return new Date(stamp).toISOString().slice(0,10);
}
function eventos(ficha) {
  return [...lista(ficha.linha_tempo), ...lista(ficha.ferramentas)].map(e => dataISO(e?.hora)).filter(Boolean);
}
function referencia(ficha, days) {
  // Sem relógio global: a mesma ficha sempre produz o mesmo resultado.
  return dataISO(ficha.gerado) || days.slice().sort().at(-1) || null;
}
function atividade(days, end, count) {
  if (!end) return [];
  const endStamp = Date.parse(`${end}T00:00:00Z`);
  const valid = days.filter(day => day <= end);
  const start = count ? endStamp - (count-1)*DIA : Date.parse(`${valid.slice().sort()[0] || end}T00:00:00Z`);
  const grouped = new Map();
  for (const day of valid) if (Date.parse(`${day}T00:00:00Z`) >= start) grouped.set(day,(grouped.get(day) || 0)+1);
  // Tudo preserva dias com eventos, sem criar milhares de pontos vazios.
  if (!count) return [...grouped].sort(([a],[b]) => a.localeCompare(b)).map(([rotulo,valor]) => ({rotulo,valor}));
  return Array.from({length:count}, (_,i) => {
    const rotulo = new Date(start+i*DIA).toISOString().slice(0,10);
    return {rotulo,valor:grouped.get(rotulo) || 0};
  });
}
function status(value) {
  const s = texto(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  return ['feito','pronto','ok','concluido'].includes(s) ? 'Concluído' : ['andamento','fazendo','em andamento'].includes(s) ? 'Em andamento' : 'A fazer';
}
function agrupar(values) {
  const counts = new Map();
  for (const value of values) counts.set(value,(counts.get(value) || 0)+1);
  return [...counts].map(([rotulo,valor]) => ({rotulo,valor}));
}
function tipoEntrega(item) {
  const ext = texto(item?.caminho).split(/[?#]/)[0].split(/[\\/]/).at(-1).match(/\.([^.]+)$/)?.[1].toLowerCase();
  if (['mp4','webm','mov','avi','mkv','m4v'].includes(ext)) return 'Vídeo';
  if (['png','jpg','jpeg','gif','webp','svg','avif','bmp','ico'].includes(ext)) return 'Imagem';
  if (['pdf','md','txt','doc','docx','xls','xlsx','csv','ppt','pptx','odt','rtf'].includes(ext)) return 'Documento';
  if (['js','mjs','cjs','ts','tsx','jsx','html','css','scss','json','py','java','c','cpp','h','cs','go','rs','sql','sh','ps1','yml','yaml','xml'].includes(ext)) return 'Código';
  return 'Outro';
}
export function calcularBI(ficha = {}) {
  ficha = ficha || {};
  const stages = lista(ficha.etapas), criteria = lista(ficha.criterios), deliveries = lista(ficha.entregas);
  const tools = lista(ficha.ferramentas), pending = lista(ficha.pendencias), custom = lista(ficha.kpis).slice(0,4);
  const tasks = [...stages.flatMap(s => lista(s?.itens).map(i => status(i?.status))), ...criteria.map(c => c?.feito === true ? 'Concluído' : 'A fazer')];
  const days = eventos(ficha), end = referencia(ficha,days);
  if (!tasks.length && !stages.length && !deliveries.length && !tools.length && !pending.length && !custom.length && !days.length) return {cartoes:[],graficos:[]};
  const done = tasks.filter(s => s === 'Concluído').length, percent = tasks.length ? Math.round(done/tasks.length*100) : 0;
  const week = atividade(days,end,7), fortnight = atividade(days,end,14);
  const cartoes = [
    {rotulo:'Concluído',valor:`${percent}%`,detalhe:`${done} de ${tasks.length} tarefas e critérios`},
    {rotulo:'Pendências',valor:pending.length,detalhe:'Pendências registradas'},
    {rotulo:'Entregas',valor:deliveries.length,detalhe:'Arquivos entregues'},
    {rotulo:'Atividade 7 dias',valor:week.reduce((n,p) => n+p.valor,0),detalhe:end ? `7 dias até ${end} (UTC)` : 'Sem eventos com data válida',serie:week.map(p => p.valor)},
    ...custom.map(k => ({rotulo:k?.rotulo,valor:k?.valor,detalhe:k?.meta == null ? '' : `Meta: ${texto(k.meta)}`}))
  ];
  const graficos = [];
  function add(id,tipo,titulo,dados,total) {
    if (!dados.some(p => p.valor > 0) && !(id === 'progresso' && tasks.length)) return;
    graficos.push({id,tipo,titulo,dados,...(total === undefined ? {} : {total})});
  }
  add('status','rosca','Status das tarefas',agrupar(tasks),tasks.length);
  add('etapas','barras','Itens por etapa',stages.map((s,i) => ({rotulo:texto(s?.nome) || `Etapa ${i+1}`,valor:lista(s?.itens).length})));
  add('setores','colunas','Trabalho por setor',agrupar(tools.map(t => texto(t?.setor).trim() || 'Sem setor')));
  add('atividade','area','Atividade por dia',fortnight);
  add('progresso','gauge','Progresso geral',[{rotulo:'Concluído',valor:percent}],100);
  add('entregas','rosca','Entregas por tipo',agrupar(deliveries.map(tipoEntrega)),deliveries.length);
  return {cartoes,graficos};
}
const el = (tag, value, cls) => {
  const n = document.createElement(tag);
  if (value !== undefined) n.textContent = texto(value);
  if (cls) n.className = cls;
  return n;
};
const svg = (tag, attrs = {}, value) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [key,v] of Object.entries(attrs)) n.setAttribute(key,String(v));
  if (value !== undefined) n.textContent = texto(value);
  return n;
};
function botao(label) { const b = el('button',label); b.type = 'button'; return b; }
function tabela(chart) {
  const t = el('table'), head = el('thead'), row = el('tr'), body = el('tbody');
  t.append(el('caption',chart.titulo));
  for (const label of ['Rótulo','Valor']) { const th = el('th',label); th.scope = 'col'; row.append(th); }
  head.append(row);
  for (const p of chart.dados) {
    const tr = el('tr'), th = el('th',p.rotulo); th.scope = 'row';
    tr.append(th,el('td',chart.tipo === 'gauge' ? `${p.valor}%` : p.valor)); body.append(tr);
  }
  t.append(head,body); return t;
}
function desenho(chart, tooltip) {
  const root = svg('svg',{viewBox:'0 0 560 280',class:'bi-svg',role:'img','aria-label':`${chart.titulo}. Use Ver dados para acessar a tabela.`});
  root.append(svg('title',{},chart.titulo));
  function mark(node, p) {
    const message = `${p.rotulo}: ${p.valor}${chart.tipo === 'gauge' ? '%' : ''}`;
    node.append(svg('title',{},message));
    node.setAttribute('tabindex','0'); node.setAttribute('aria-label',message);
    const show = () => { tooltip.textContent = message; tooltip.hidden = false; };
    const hide = () => { tooltip.hidden = true; };
    node.addEventListener('pointerenter',show); node.addEventListener('pointerleave',hide);
    node.addEventListener('click',show); node.addEventListener('focus',show); node.addEventListener('blur',hide);
    node.addEventListener('keydown',e => { if (e.key === 'Escape') hide(); });
    root.append(node);
  }
  const pts = chart.dados, max = Math.max(1,...pts.map(p => p.valor));
  const color = i => CORES[i%CORES.length];
  if (chart.tipo === 'rosca') {
    const total = pts.reduce((n,p) => n+p.valor,0), radius = 85, circumference = 2*Math.PI*radius;
    let offset = 0;
    pts.forEach((p,i) => {
      const length = p.valor/total*circumference;
      mark(svg('circle',{cx:280,cy:135,r:radius,fill:'none',stroke:color(i),'stroke-width':34,'stroke-dasharray':`${length} ${circumference-length}`,'stroke-dashoffset':-offset,transform:'rotate(-90 280 135)'}),p);
      const a = (offset+length/2)/radius-Math.PI/2;
      root.append(svg('text',{x:280+Math.cos(a)*119,y:140+Math.sin(a)*119,'text-anchor':'middle'},p.valor));
      offset += length;
    });
    root.append(svg('text',{x:280,y:135,'text-anchor':'middle',class:'bi-total'},total),svg('text',{x:280,y:160,'text-anchor':'middle'},'Total'));
  } else if (chart.tipo === 'gauge') {
    root.append(svg('path',{d:'M 100 210 A 180 180 0 0 1 460 210',fill:'none',stroke:'var(--linha)','stroke-width':30}));
    mark(svg('path',{d:'M 100 210 A 180 180 0 0 1 460 210',fill:'none',stroke:CORES[0],'stroke-width':30,pathLength:100,'stroke-dasharray':`${pts[0].valor} 100`}),pts[0]);
    root.append(svg('text',{x:280,y:190,'text-anchor':'middle',class:'bi-total'},`${pts[0].valor}%`),svg('text',{x:100,y:250,'text-anchor':'middle'},'0%'),svg('text',{x:460,y:250,'text-anchor':'middle'},'100%'));
  } else if (chart.tipo === 'barras') {
    const height = Math.max(280,pts.length*46+45); root.setAttribute('viewBox',`0 0 560 ${height}`);
    for (let i=0;i<=4;i++) { const x = 175+i*82; root.append(svg('line',{x1:x,x2:x,y1:10,y2:height-30,class:'bi-gridline'})); }
    pts.forEach((p,i) => {
      const y = 15+i*(height-50)/pts.length, width = p.valor/max*310;
      const label = svg('text',{x:160,y:y+20,'text-anchor':'end'},texto(p.rotulo).slice(0,20)); label.append(svg('title',{},p.rotulo)); root.append(label);
      mark(svg('rect',{x:175,y,width,height:28,rx:2,fill:color(i)}),p);
      root.append(svg('text',{x:185+width,y:y+20},p.valor));
    });
  } else {
    const y = n => 220-n/max*175, step = 480/pts.length, x = i => 50+step*(i+.5);
    for (let i=0;i<=4;i++) {
      const value = max*i/4;
      root.append(svg('line',{x1:45,x2:540,y1:y(value),y2:y(value),class:'bi-gridline'}),svg('text',{x:38,y:y(value)+4,'text-anchor':'end'},Number(value.toFixed(1))));
    }
    if (chart.tipo === 'area') {
      const path = pts.map((p,i) => `${x(i)},${y(p.valor)}`).join(' ');
      root.append(svg('polygon',{points:`${x(0)},220 ${path} ${x(pts.length-1)},220`,fill:CORES[0],opacity:.18}),svg('polyline',{points:path,fill:'none',stroke:CORES[0],'stroke-width':3}));
    }
    pts.forEach((p,i) => {
      if (chart.tipo === 'area') mark(svg('circle',{cx:x(i),cy:y(p.valor),r:7,fill:CORES[0]}),p);
      else mark(svg('rect',{x:x(i)-step*.32,y:y(p.valor),width:step*.64,height:220-y(p.valor),fill:color(i),rx:2}),p);
      if (pts.length <= 14 || i%Math.ceil(pts.length/12) === 0) {
        root.append(svg('text',{x:x(i),y:y(p.valor)-10,'text-anchor':'middle'},p.valor));
        const label = chart.tipo === 'area' ? p.rotulo.slice(5).replace('-','/') : texto(p.rotulo).slice(0,12);
        const t = svg('text',{x:x(i),y:244,transform:`rotate(-30 ${x(i)} 244)`,'text-anchor':'end'},label); t.append(svg('title',{},p.rotulo)); root.append(t);
      }
    });
  }
  return root;
}
function cardGrafico(chart) {
  const card = el('article',undefined,'bi-chart'), header = el('div',undefined,'bi-chart-header'), title = el('h3',chart.titulo);
  const toggle = botao('Ver dados'), plot = el('div',undefined,'bi-plot'), table = el('div',undefined,'bi-table');
  const tip = el('div',undefined,'bi-tooltip'); tip.setAttribute('role','tooltip'); tip.hidden = true;
  plot.append(desenho(chart,tip));
  const legend = el('ul',undefined,'bi-legend');
  const entries = chart.tipo === 'area' ? [{rotulo:'Eventos',valor:chart.dados.reduce((n,p) => n+p.valor,0)}] : chart.dados;
  entries.forEach((p,i) => {
    const li = el('li'), dot = svg('svg',{viewBox:'0 0 12 12','aria-hidden':'true'});
    dot.append(svg('circle',{cx:6,cy:6,r:5,fill:CORES[i%CORES.length]}));
    li.append(dot,el('span',`${p.rotulo}: ${p.valor}${chart.tipo === 'gauge' ? '%' : ''}`)); legend.append(li);
  });
  plot.append(legend); table.append(tabela(chart)); table.hidden = true; table.id = `bi-dados-${chart.id}`;
  toggle.setAttribute('aria-controls',table.id); toggle.setAttribute('aria-expanded','false');
  toggle.addEventListener('click',() => {
    table.hidden = !table.hidden; plot.hidden = !table.hidden; tip.hidden = true;
    toggle.textContent = table.hidden ? 'Ver dados' : 'Ver gráfico'; toggle.setAttribute('aria-expanded',String(!table.hidden));
  });
  card.addEventListener('keydown',e => { if (e.key === 'Escape') tip.hidden = true; });
  header.append(title,toggle); card.append(header,plot,table,tip); return card;
}
export function renderBI(container, ficha = {}) {
  if (!container) return;
  ficha = ficha || {};
  // O relógio pertence apenas à camada de apresentação.
  const source = {...ficha,gerado:dataISO(ficha.gerado) ? ficha.gerado : new Date().toISOString()};
  const bi = calcularBI(source);
  container.replaceChildren(); container.hidden = !bi.cartoes.length && !bi.graficos.length;
  if (container.hidden) return;
  const top = el('div',undefined,'bi-top'), filters = el('div',undefined,'bi-slicer');
  filters.setAttribute('role','group'); filters.setAttribute('aria-label','Período do gráfico de atividade');
  top.append(el('h2','Visão BI'),filters);
  const cards = el('div',undefined,'bi-kpis'), grid = el('div',undefined,'bi-charts');
  for (const k of bi.cartoes) {
    const card = el('article',undefined,'bi-kpi'); card.append(el('small',k.rotulo),el('strong',k.valor),el('small',k.detalhe));
    if (k.serie?.length) {
      const spark = svg('svg',{viewBox:'0 0 160 32',class:'bi-spark',role:'img','aria-label':`Eventos por dia: ${k.serie.join(', ')}`});
      spark.append(svg('title',{},`Eventos por dia: ${k.serie.join(', ')}`),svg('polyline',{points:k.serie.map((v,i) => `${3+i*154/(k.serie.length-1 || 1)},${29-v/Math.max(1,...k.serie)*26}`).join(' '),fill:'none',stroke:CORES[0],'stroke-width':2})); card.append(spark);
    }
    cards.append(card);
  }
  let activityCard;
  const buttons = [];
  function drawActivity() {
    const count = Number(container.dataset.periodo || 14), days = eventos(source), end = referencia(source,days);
    const dados = atividade(days,end,count);
    const chart = {id:'atividade',tipo:'area',titulo:'Atividade por dia',dados};
    const next = dados.some(p => p.valor > 0) ? cardGrafico(chart) : el('p','Sem atividade no período selecionado.','bi-empty');
    if (activityCard) activityCard.replaceWith(next); else grid.append(next);
    activityCard = next;
    buttons.forEach(([button,value]) => button.setAttribute('aria-pressed',String(value === count)));
  }
  for (const [label,count] of [['7 dias',7],['14 dias',14],['Tudo',0]]) {
    const b = botao(label); buttons.push([b,count]);
    b.addEventListener('click',() => { container.dataset.periodo = String(count); drawActivity(); }); filters.append(b);
  }
  for (const chart of bi.graficos) if (chart.id !== 'atividade') grid.append(cardGrafico(chart));
  if (eventos(source).some(day => day <= referencia(source,eventos(source)))) drawActivity(); else filters.hidden = true;
  container.append(top,cards,grid);
}
