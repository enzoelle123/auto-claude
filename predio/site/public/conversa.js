// A mesma fila de pedidos é usada no prédio, no andar e nas fichas.
export function criarConversa({api, getFloors, getFloor=()=>null}) {
  const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const style=make('style');style.textContent=`
    .conversa-botao{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:#8ce4ef;color:#09212b;border:2px solid #17394e;z-index:30;font-size:24px;cursor:pointer}
    .conversa{position:fixed;right:20px;bottom:88px;width:min(400px,calc(100vw - 24px));max-height:calc(100dvh - 110px);overflow:auto;background:var(--panel,#101d29);color:var(--text,#ecf3f7);border:1px solid var(--line,#2a3c4b);border-radius:14px;padding:16px;box-shadow:0 20px 60px #0008;z-index:31;font:14px/1.5 system-ui}
    .conversa[hidden],.conversa-botao[hidden]{display:none}.conversa header{display:flex;justify-content:space-between;align-items:center;gap:8px}.conversa h2{font-size:18px}.conversa select,.conversa textarea{width:100%;background:var(--bg,#09121b);color:inherit;border:1px solid var(--line,#2a3c4b);border-radius:8px;padding:9px;margin:8px 0}.conversa textarea{min-height:80px;resize:vertical}.conversa ol{padding:0;list-style:none;max-height:32dvh;overflow:auto}.conversa li{display:flex;flex-direction:column;margin:12px 0;gap:5px}.conversa .cliente,.conversa .claude{white-space:pre-wrap;overflow-wrap:anywhere;max-width:90%;padding:9px;border-radius:9px;margin:0}.conversa .cliente{align-self:flex-end;background:var(--panel-soft,#1c3949)}.conversa .claude{align-self:flex-start;border:1px solid var(--line,#2a3c4b)}.conversa small{color:var(--muted,#a2b6c7)}.conversa button{min-height:42px}.conversa :focus-visible{outline:3px solid #8ce4ef;outline-offset:2px}
  `;document.head.append(style);
  const trigger=make('button','✉');trigger.className='conversa-botao';trigger.type='button';trigger.hidden=true;trigger.title='Falar com o Claude';trigger.setAttribute('aria-label','Falar com o Claude');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','conversa');
  const panel=make('section');panel.id='conversa';panel.className='conversa';panel.hidden=true;panel.setAttribute('aria-label','Falar com o Claude');
  const header=make('header'),close=make('button','Fechar');close.type='button';header.append(make('h2','Falar com o Claude'),close);
  const label=make('label','Andar da conversa'),select=make('select');select.id='conversa-andar';label.htmlFor=select.id;
  const list=make('ol');list.setAttribute('aria-label','Conversa em ordem cronológica');
  const form=make('form'),inputLabel=make('label','Seu pedido'),input=make('textarea');input.id='conversa-texto';inputLabel.htmlFor=input.id;input.required=true;input.maxLength=2000;
  const send=make('button','Enviar');send.type='submit';const feedback=make('p');feedback.setAttribute('role','status');
  form.append(inputLabel,input,send);panel.append(header,label,select,list,form,feedback,make('small','Respostas chegam aqui e no app Claude.'));document.body.append(trigger,panel);
  let timer=0,version=0,refreshVersion=0,enabled=false,opener=trigger;
  const drafts=new Map();let draftPasta='';
  const floor=()=>getFloors().find(f=>String(f.pasta)===select.value);
  function options(){
    const current=getFloor(),previous=select.value;select.replaceChildren(make('option','Selecione um andar'));
    select.firstChild.value='';
    for(const f of getFloors()){const option=make('option',`Andar ${f.n} · ${f.titulo||f.pasta}`);option.value=f.pasta;select.append(option);}
    select.value=String(current?.pasta??previous);select.disabled=Boolean(current);switchDraft();
  }
  function switchDraft(){if(draftPasta)drafts.set(draftPasta,input.value);draftPasta=select.value;input.value=drafts.get(draftPasta)||'';version++;list.replaceChildren();feedback.textContent='';send.disabled=!floor();}
  async function refresh(){
    clearTimeout(timer);if(panel.hidden||!enabled||document.hidden)return;
    const f=floor(),v=version,r=++refreshVersion;
    try{if(f){const result=await api(`/api/pedidos?pasta=${encodeURIComponent(f.pasta)}`);if(v!==version||r!==refreshVersion||panel.hidden||!enabled)return;
      list.replaceChildren();const records=(Array.isArray(result)?result:result.pedidos||[]).slice().sort((a,b)=>Date.parse(a.criado)-Date.parse(b.criado));
      for(const record of records){const li=make('li'),client=make('p',record.texto);client.className='cliente';li.append(client,make('small',`${new Date(record.criado).toLocaleString('pt-BR')} · ${record.status||'novo'}`));if(record.resposta){const answer=make('p',record.resposta);answer.className='claude';li.append(answer);}list.append(li);}
      if(!records.length)list.append(make('li','Nenhum pedido neste andar.'));feedback.textContent='';
    }}catch{if(v===version&&r===refreshVersion&&enabled)feedback.textContent='Não foi possível atualizar. Tentaremos novamente.';}
    finally{if(r===refreshVersion&&!panel.hidden&&enabled&&!document.hidden)timer=setTimeout(refresh,20000);}
  }
  function hide(){panel.hidden=true;version++;clearTimeout(timer);trigger.setAttribute('aria-expanded','false');if(enabled)opener?.focus();}
  function open(prefix){if(!enabled)return;opener=document.activeElement;options();panel.hidden=false;trigger.setAttribute('aria-expanded','true');if(prefix!==undefined)input.value=prefix;refresh();(floor()?input:select).focus();}
  trigger.addEventListener('click',()=>panel.hidden?open():hide());close.addEventListener('click',hide);
  select.addEventListener('change',()=>{switchDraft();refresh();});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide();}});
  form.addEventListener('submit',async e=>{e.preventDefault();const f=floor(),texto=input.value.trim(),v=version;if(!f||!texto)return;send.disabled=true;feedback.textContent='Enviando…';
    try{await api('/api/pedidos',{method:'POST',body:{pasta:f.pasta,andar:f.n,texto}});drafts.delete(String(f.pasta));if(v===version){input.value='';feedback.textContent='Pedido enviado.';await refresh();}}
    catch(error){if(v===version)feedback.textContent=error.status===429?'Limite de 30 pedidos por hora atingido.':'Não foi possível enviar. Seu texto foi preservado.';}
    finally{send.disabled=!floor();}
  });
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh();});
  window.addEventListener('pagehide',()=>clearTimeout(timer));window.addEventListener('pageshow',()=>refresh());
  return {open,setEnabled(value){enabled=value;trigger.hidden=!value;if(!value){hide();drafts.clear();input.value='';list.replaceChildren();}},update(){if(!panel.hidden){options();refresh();}}};
}
