import { fail, text } from './_lib.js';

const assuntos = ['video', 'jogo', 'programacao', 'site', 'marketing', 'design', 'pesquisa', 'educacao', 'negocio', 'outro'];
const tipos = ['kpis', 'etapas', 'tabela', 'lista', 'calendario', 'linha_tempo', 'galeria', 'checklist', 'equipe', 'decisoes', 'pesquisa', 'grafico', 'metrica_externa', 'conversa'];
const props = ['claquete', 'refletor', 'camera', 'sofa', 'arcade', 'controle', 'pufe', 'neon', 'servidor', 'quadro_branco', 'monitor_duplo', 'planta', 'estante', 'trofeu', 'mesa_pingpong', 'cavalete', 'microfone', 'globo'];
export const TEMA_LIMIT = 30 * 1024;

export function pastaQuery(req) {
  return text(new URL(req.url, 'https://local.invalid').searchParams.get('pasta'), 'pasta', 200);
}
// Codifica separadores para não colidir com a chave reservada :anterior.
export function temaKey(pasta) { return `auto:tema:${encodeURIComponent(pasta)}`; }
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, `Campo ${name} inválido.`);
  return value;
}
function color(value, name) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail(400, `Cor ${name} inválida.`);
  return value;
}
function colors(value, name, fields) {
  object(value, name);
  return Object.fromEntries(fields.map(key => [key, color(value[key], `${name}.${key}`)]));
}
export function validarTema(value) {
  if (Buffer.byteLength(JSON.stringify(value)) > TEMA_LIMIT) fail(413, 'JSON excede o limite.');
  object(value, 'tema');
  if (value.versao !== 1) fail(400, 'Versão de tema inválida.');
  if (!assuntos.includes(value.assunto)) fail(400, 'Assunto inválido.');
  const tema = {
    versao: 1, nome: text(value.nome, 'nome', 80), assunto: value.assunto,
    icone: text(value.icone, 'icone', 80),
    paleta: colors(value.paleta, 'paleta', ['fundo', 'painel', 'parede', 'texto', 'fraco', 'destaque', 'destaque2', 'ok', 'alerta', 'erro']),
    andar: colors(value.andar, 'andar', ['piso', 'luz', 'fachada'])
  };
  if (!Array.isArray(value.andar.decoracao) || value.andar.decoracao.length > 6)
    fail(400, 'Decoração deve ter no máximo 6 itens.');
  if (!Array.isArray(value.paineis) || value.paineis.length > 16)
    fail(400, 'Informe no máximo 16 painéis.');
  const avisos = [], ids = new Set();
  tema.andar.decoracao = value.andar.decoracao.filter(prop => {
    if (props.includes(prop)) return true;
    avisos.push('Decoração desconhecida descartada.'); return false;
  });
  tema.paineis = [];
  for (const entry of value.paineis) {
    object(entry, 'painel');
    if (!tipos.includes(entry.tipo)) { avisos.push('Tipo de painel desconhecido descartado.'); continue; }
    const painel = { id: text(entry.id, 'id', 80), tipo: entry.tipo, titulo: text(entry.titulo, 'titulo', 80) };
    if (ids.has(painel.id)) fail(400, 'IDs de painéis devem ser únicos.');
    ids.add(painel.id);
    if (entry.dados !== undefined) {
      painel.dados = text(entry.dados, 'dados', 80);
      if (!/^ficha\.[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*$/u.test(painel.dados) ||
          painel.dados.split('.').some(key => ['__proto__', 'prototype', 'constructor'].includes(key)))
        fail(400, 'Caminho de dados inválido.');
    }
    tema.paineis.push(painel);
  }
  return { tema, avisos };
}
export function resumoTema(tema) {
  return { nome: tema.nome, icone: tema.icone, paleta: { destaque: tema.paleta.destaque }, andar: tema.andar };
}
