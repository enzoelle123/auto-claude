import assert from 'node:assert/strict';
import { calcularBI } from './public/bi.js';

const ficha = {
  gerado:'2026-10-29T15:00:00Z',
  kpis:[{rotulo:'Build',valor:'v2'},{rotulo:'Zero',valor:0},{rotulo:'A',valor:1},{rotulo:'B',valor:2},{rotulo:'Ignorado',valor:3}],
  etapas:[
    {nome:'Produção',itens:[{status:'feito'},{status:' PRONTO '},{status:'ok'},{status:'Concluído'},{status:'fazendo'}]},
    {nome:'Revisão',itens:[{status:'em andamento'},{status:'andamento'},{status:'aguardando'}]}
  ],
  criterios:[{feito:true},{feito:false}],
  pendencias:['Revisar'],
  entregas:[{caminho:'filme.MP4?x=1'},{caminho:'img.png'},{caminho:'doc.pdf'},{caminho:'app.js'},{caminho:'arquivo.zip'}],
  ferramentas:[{hora:'2026-10-29T10:00:00Z',setor:'produção'},{hora:'2026-10-28T10:00:00Z',setor:'produção'},{hora:'inválida',setor:'revisão'}],
  linha_tempo:[{hora:'2026-10-29T11:00:00Z'},{hora:'2026-10-23T11:00:00Z'},{hora:'2026-10-16T11:00:00Z'},{hora:'2026-10-15T11:00:00Z'},{hora:'2026-10-30T11:00:00Z'},{hora:'inválida'},{hora:'2026-02-30T00:00:00Z'}]
};
const snapshot = JSON.stringify(ficha);
const {cartoes,graficos} = calcularBI(ficha);
const graph = id => graficos.find(g => g.id === id);
const values = id => Object.fromEntries(graph(id).dados.map(p => [p.rotulo,p.valor]));
assert.equal(cartoes.find(k => k.rotulo === 'Concluído').valor,'50%');
assert.equal(cartoes.find(k => k.rotulo === 'Pendências').valor,1);
assert.equal(cartoes.find(k => k.rotulo === 'Entregas').valor,5);
assert.equal(cartoes.find(k => k.rotulo === 'Atividade 7 dias').valor,4);
assert.deepEqual(cartoes.find(k => k.rotulo === 'Atividade 7 dias').serie,[1,0,0,0,0,1,2]);
assert.equal(cartoes.length,8);
assert.equal(cartoes[5].valor,0);
assert.deepEqual(values('status'),{'Concluído':5,'Em andamento':3,'A fazer':2});
assert.equal(graph('status').total,10);
assert.deepEqual(values('etapas'),{'Produção':5,'Revisão':3});
assert.deepEqual(values('setores'),{'produção':2,'revisão':1});
assert.equal(graph('atividade').dados.length,14);
assert.equal(values('atividade')['2026-10-29'],2);
assert.equal(values('atividade')['2026-10-16'],1);
assert.equal(values('atividade')['2026-10-15'],undefined);
assert.equal(graph('atividade').dados.reduce((n,p) => n+p.valor,0),5);
assert.deepEqual(values('entregas'),{'Vídeo':1,'Imagem':1,'Documento':1,'Código':1,'Outro':1});
assert.deepEqual(values('progresso'),{'Concluído':50});
assert.equal(JSON.stringify(ficha),snapshot,'Não deve alterar a ficha');
assert.deepEqual(calcularBI(ficha),calcularBI(ficha),'Cálculo determinístico');
assert.deepEqual(calcularBI({}),{cartoes:[],graficos:[]});
assert.deepEqual(calcularBI(),{cartoes:[],graficos:[]});
assert.deepEqual(calcularBI({linha_tempo:[{hora:'inválida'},{hora:null},{hora:'2026-02-30'}]}),{cartoes:[],graficos:[]});
const invalid = calcularBI({gerado:ficha.gerado,ferramentas:[{hora:'inválida',setor:'QA'}]});
assert.equal(invalid.cartoes.find(k => k.rotulo === 'Atividade 7 dias').valor,0);
assert.ok(!invalid.graficos.some(g => g.id === 'atividade'));
const zero = calcularBI({criterios:[{feito:false}]});
assert.equal(zero.graficos.find(g => g.id === 'progresso').dados[0].valor,0);
assert.ok(!zero.graficos.some(g => g.id === 'etapas'));
console.log('ok bi');
