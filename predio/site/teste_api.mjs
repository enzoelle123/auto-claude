import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Valores sintéticos, exclusivos deste processo; nenhum serviço externo é acessado.
process.env.REDIS_FALSO = '1';
process.env.SENHA_SITE = 'senha-de-teste';
process.env.SEGREDO_SESSAO = 'segredo-local-de-teste';
process.env.TOKEN_PC = 'token-pc-de-teste';
const { default: login } = await import('./api/login.js');
const { default: logout } = await import('./api/logout.js');
const { default: sessao } = await import('./api/sessao.js');
const { default: mapa } = await import('./api/mapa.js');
const { default: estado } = await import('./api/estado.js');
const { default: pedidos } = await import('./api/pedidos.js');
const { default: tema } = await import('./api/tema.js');
const { default: ficha } = await import('./api/ficha.js');
const { default: temas } = await import('./api/temas.js');
const lib = await import('./api/_lib.js');
let checks = 0;
async function call(handler, method = 'GET', { data, headers = {}, url = '/', raw, parsed = false } = {}) {
  const payload = raw ?? (data === undefined ? '' : JSON.stringify(data));
  const req = Readable.from([Buffer.from(payload)]);
  req.method = method;
  req.url = url;
  req.headers = { host: 'predio.test', origin: 'https://predio.test', 'x-forwarded-for': '192.0.2.1', ...headers };
  if (parsed) req.body = data;
  const res = {
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(value) { this.data = JSON.parse(value); }
  };
  await handler(req, res);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  checks++;
  return res;
}
async function status(handler, method, options, expected) {
  const res = await call(handler, method, options);
  assert.equal(res.statusCode, expected, JSON.stringify(res.data));
  return res;
}
const auth = { authorization: `Bearer ${process.env.TOKEN_PC}` };

await status(login, 'POST', { data: { senha: 'errada' } }, 401);
const logged = await status(login, 'POST', { data: { senha: process.env.SENHA_SITE } }, 200);
assert.deepEqual(logged.data, { ok: true });
const setCookie = logged.headers['set-cookie'];
for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=2592000'])
  assert.ok(setCookie.includes(attribute));
const cookie = setCookie.split(';')[0];
const browser = { cookie };
// Sem limite de tentativas (pedido do cliente): depois de vários erros, a senha certa ainda entra.
for (let i=0; i<40; i++) await status(login, 'POST', { data: { senha: 'errada' } }, 401);
await status(login, 'POST', { data: { senha: process.env.SENHA_SITE } }, 200);
await status(login, 'POST', { data: { senha: `${process.env.SENHA_SITE}\r\n` } }, 200);
await status(login, 'POST', { data: { senha: 'errada' }, headers: { 'x-forwarded-for': '192.0.2.2, 192.0.2.1' } }, 401);
await status(login, 'POST', { data: { senha: 'errada' }, headers: { origin: 'https://outro.test' } }, 403);

for (const handler of [sessao, mapa, estado, pedidos]) await status(handler, 'GET', {}, 401);
await status(pedidos, 'POST', { data: { pasta: 'x', andar: 1, texto: 'oi' } }, 401);
await status(sessao, 'GET', { headers: browser }, 200);
await status(sessao, 'GET', { headers: { cookie: `${cookie}0` } }, 401);
await status(sessao, 'GET', { headers: { cookie: `${cookie}; ${cookie}` } }, 401);
const expires = String(Math.floor(Date.now()/1000)-1);
const signedExpired = `${expires}.${createHmac('sha256', process.env.SEGREDO_SESSAO).update(expires).digest('hex')}`;
await status(sessao, 'GET', { headers: { cookie: `sessao=${signedExpired}` } }, 401);

for (const [handler, method] of [[mapa, 'PUT'], [estado, 'POST'], [pedidos, 'PATCH'], [pedidos, 'GET']])
  await status(handler, method, { headers: { authorization: 'Bearer errado' }, url: '/api/pedidos?status=novo' }, 401);
await status(pedidos, 'GET', { headers: browser, url: '/api/pedidos?status=novo' }, 401);
const mapData = { gerado: new Date().toISOString(), andares: [{ n: 1, pasta: 'projeto' }] };
await status(mapa, 'PUT', { headers: auth, data: mapData }, 200);
assert.deepEqual((await status(mapa, 'GET', { headers: browser }, 200)).data, mapData);
await status(mapa, 'PUT', { headers: auth, data: { texto: 'á'.repeat(160000) } }, 413);
await status(mapa, 'PUT', { headers: auth, raw: '{quebrado' }, 400);
await status(mapa, 'PUT', { headers: auth, raw: '[]' }, 400);
await status(mapa, 'PUT', { headers: { ...auth, 'content-length': '400000' }, raw: '{}' }, 413);

const event = { pasta: 'projeto', setor: 'producao', tipo: 'agente', nome: 'n'.repeat(240), motivo: 'teste', hora: new Date().toISOString() };
await status(estado, 'POST', { headers: auth, data: { ...event, setor: 123 } }, 400);
for (let i=0; i<205; i++) await status(estado, 'POST', { headers: auth, data: { ...event, motivo: String(i) } }, 201);
const events = (await status(estado, 'GET', { headers: browser }, 200)).data;
assert.equal(events.eventos.length, 60);
assert.equal(events.eventos[0].nome.length, 200);
assert.equal(events.eventos[0].motivo, '204');
assert.ok(!Number.isNaN(Date.parse(events.agora)));
assert.equal((await lib.redis('LRANGE', 'auto:eventos', 0, 999)).length, 200);

const created = (await status(pedidos, 'POST', { headers: browser, data: { pasta: 'projeto', andar: 1, texto: 'Fazer revisão', senha: 'não guardar' } }, 201)).data;
// Pedido existente apenas no índice antigo: a primeira consulta deve migrá-lo.
const legacy = { ...created, id: 'legado', pasta: 'antiga', status: 'feito' };
await lib.pipeline([
  ['HSET', 'auto:pedido:legado', ...Object.entries(legacy).flatMap(([k,v]) => [k, JSON.stringify(v)])],
  ['ZADD', 'auto:pedidos', Date.parse(legacy.criado), legacy.id]
]);
assert.equal(created.status, 'novo');
assert.match(created.id, /^\d+-[a-f0-9]+$/);
assert.ok(!Number.isNaN(Date.parse(created.criado)));
assert.ok(!('senha' in created));
const list = await status(pedidos, 'GET', { headers: browser, url: '/api/pedidos?pasta=projeto' }, 200);
assert.deepEqual(list.data.pedidos, [created]);
assert.deepEqual((await status(pedidos, 'GET', { headers: browser, url: '/api/pedidos?pasta=antiga' }, 200)).data.pedidos, [legacy]);
assert.equal(await lib.redis('TTL', 'auto:pedido:legado'), lib.PEDIDO_SECONDS);
assert.deepEqual((await status(pedidos, 'GET', { headers: browser, url: '/api/pedidos?pasta=outra' }, 200)).data.pedidos, []);
assert.deepEqual((await status(pedidos, 'GET', { headers: auth, url: '/api/pedidos?status=novo' }, 200)).data.pedidos, [created]);
await status(pedidos, 'PATCH', { headers: auth, data: { id: created.id, status: 'inválido' } }, 400);
await status(pedidos, 'PATCH', { headers: auth, data: { id: 'ausente', status: 'feito' } }, 404);
for (const next of ['em andamento', 'feito', 'recusado']) {
  const changed = await status(pedidos, 'PATCH', { headers: auth, data: { id: created.id, status: next, resposta: 'Recebido' } }, 200);
  assert.equal(changed.data.status, next);
  assert.equal(changed.data.resposta, 'Recebido');
}
assert.equal((await status(pedidos, 'GET', { headers: auth, url: '/api/pedidos?status=novo' }, 200)).data.pedidos.length, 0);
assert.equal((await status(pedidos, 'GET', { headers: browser, url: '/api/pedidos?pasta=projeto' }, 200)).data.pedidos[0].status, 'recusado');
for (const texto of ['', ' ', 'a'.repeat(2001), 123])
  await status(pedidos, 'POST', { headers: browser, data: { pasta: 'projeto', andar: 1, texto } }, 400);
for (const origin of ['https://invasor.test', 'null', '', 'https://predio.test.invasor.test']) {
  const headers = { ...browser, origin };
  await status(pedidos, 'POST', { headers, data: { pasta: 'projeto', andar: 1, texto: 'oi' } }, 403);
  await status(logout, 'POST', { headers }, 403);
  await status(mapa, 'PUT', { headers: { ...headers, ...auth }, data: mapData }, 403);
  await status(pedidos, 'PATCH', { headers: { ...headers, ...auth }, data: { id: created.id, status: 'feito' } }, 403);
}
for (let i=1; i<30; i++) await status(pedidos, 'POST', { headers: browser, data: { pasta: 'projeto', andar: 'Primeiro', texto: `Pedido ${i}` }, parsed: true }, 201);
await status(pedidos, 'POST', { headers: browser, data: { pasta: 'projeto', andar: 1, texto: 'Excedente' } }, 429);
const originalNow = Date.now;
try {
  const future = originalNow() + 3601000;
  Date.now = () => future;
  await status(pedidos, 'POST', { headers: browser, data: { pasta: 'projeto', andar: 1, texto: 'Após expiração' } }, 201);
  await status(login, 'POST', { data: { senha: process.env.SENHA_SITE } }, 200);
  // Mais de 50 entradas: a pasta recebe apenas os 50 mais recentes.
  for (let i=0; i<30; i++) await status(pedidos, 'POST', { headers: browser, data: { pasta: 'projeto', andar: 1, texto: `Lote ${i}` } }, i === 29 ? 429 : 201);
  const allNew = (await status(pedidos, 'GET', { headers: auth, url: '/api/pedidos?status=novo' }, 200)).data.pedidos;
  assert.equal(allNew.length, 59);
  const recent = (await status(pedidos, 'GET', { headers: browser, url: '/api/pedidos?pasta=projeto' }, 200)).data.pedidos;
  assert.equal(recent.length, 50);
  assert.ok(recent.every((p, i) => i === 0 || recent[i-1].criado >= p.criado));
} finally { Date.now = originalNow; }
const loggedOut = await status(logout, 'POST', { headers: browser }, 200);
assert.ok(loggedOut.headers['set-cookie'].includes('sessao=; Max-Age=0;'));
await status(sessao, 'GET', { headers: { cookie: 'sessao=' } }, 401);
const wrongMethod = await status(mapa, 'DELETE', {}, 405);
assert.equal(wrongMethod.headers.allow, 'GET, PUT');

// Sessões sintéticas distintas preservam o limite de 30 pedidos por sessão.
function batchBrowser(batch) {
  const expires = String(Math.floor(originalNow()/1000) + 86400 + batch);
  return { cookie: `sessao=${expires}.${createHmac('sha256', process.env.SEGREDO_SESSAO).update(expires).digest('hex')}` };
}
for (let i=0; i<200; i++) {
  await status(pedidos, 'POST', { headers: batchBrowser(Math.floor(i/30)), data: { pasta: `pasta-${i}`, andar: i, texto: `Pedido isolado ${i}` } }, 201);
}
const bulk = [];
for (let i=0; i<220; i++) {
  bulk.push((await status(pedidos, 'POST', { headers: batchBrowser(100+Math.floor(i/30)), data: { pasta: 'lote', andar: 1, texto: `Pedido em lote ${i}` } }, 201)).data);
}
assert.equal((await lib.redis('ZREVRANGE', 'auto:pedidos:pasta:lote', 0, -1)).length, 200);
assert.equal(await lib.redis('TTL', `auto:pedido:${bulk[0].id}`), lib.PEDIDO_SECONDS);
assert.equal((await status(pedidos, 'GET', { headers: auth, url: '/api/pedidos?status=novo' }, 200)).data.pedidos.length, 100);

// Exercita o transporte REST real com um servidor simulado apoiado no Redis em memória.
// Cada GET deve buscar todos os hashes em exatamente uma chamada /pipeline.
async function checkPedidoPipeline(url, headers, count) {
  const savedFetch = globalThis.fetch, batches = [];
  process.env.REDIS_FALSO = '0';
  process.env.KV_REST_API_URL = 'https://redis.test';
  process.env.KV_REST_API_TOKEN = 'token-redis-teste';
  globalThis.fetch = async (endpoint, options) => {
    assert.equal(endpoint, 'https://redis.test/pipeline');
    const commands = JSON.parse(options.body);
    batches.push(commands);
    process.env.REDIS_FALSO = '1';
    let results;
    try { results = await lib.pipeline(commands); }
    finally { process.env.REDIS_FALSO = '0'; }
    return { ok: true, json: async () => results.map(result => ({ result })) };
  };
  try {
    const response = await status(pedidos, 'GET', { headers, url }, 200);
    assert.equal(response.data.pedidos.length, count);
    const hashBatches = batches.filter(commands => commands.some(cmd => cmd[0] === 'HGETALL'));
    assert.equal(hashBatches.length, 1);
    assert.equal(hashBatches[0].length, count);
    assert.ok(hashBatches[0].every(cmd => cmd[0] === 'HGETALL'));
    assert.ok(!batches.flat().some(cmd => cmd[0] === 'ZREVRANGE' && cmd[1] === 'auto:pedidos'));
    return response.data.pedidos;
  } finally {
    globalThis.fetch = savedFetch; process.env.REDIS_FALSO = '1';
    delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
  }
}
for (let i=0; i<200; i++) {
  const isolated = await checkPedidoPipeline(`/api/pedidos?pasta=pasta-${i}`, browser, 1);
  assert.equal(isolated[0].pasta, `pasta-${i}`);
}
const limited = await checkPedidoPipeline('/api/pedidos?pasta=lote', browser, 50);
assert.ok(limited.every(p => p.pasta === 'lote'));
const pendingBatch = await checkPedidoPipeline('/api/pedidos?status=novo', auth, 100);
await status(pedidos, 'PATCH', { headers: auth, data: { id: pendingBatch[0].id, status: 'feito' } }, 200);
assert.ok(!(await lib.redis('ZREVRANGE', 'auto:pedidos:novo', 0, -1)).includes(pendingBatch[0].id));
assert.ok(!(await checkPedidoPipeline('/api/pedidos?status=novo', auth, 100)).some(p => p.id === pendingBatch[0].id));

try {
  let now = originalNow() + 2*3600000;
  Date.now = () => now;
  // Sem limite global: muitos erros de vários IPs não bloqueiam o dono.
  for (let i=0; i<30; i++) await status(login, 'POST', {
    headers: { 'x-forwarded-for': `198.51.100.${i}` }, data: { senha: 'errada' }
  }, 401);
  await status(login, 'POST', { headers: { 'x-forwarded-for': '203.0.113.1' }, data: { senha: process.env.SENHA_SITE } }, 200);
  now += 91*86400000;
  assert.equal(await lib.getPedido(bulk[0].id), null, 'Hash expira após 90 dias');
} finally { Date.now = originalNow; }

// Verifica as duas configurações REST sem rede e sem depender do Redis falso.
const realFetch = globalThis.fetch;
try {
  process.env.REDIS_FALSO = '0';
  for (const prefix of ['KV_REST_API', 'UPSTASH_REDIS_REST']) {
    process.env[`${prefix}_URL`] = 'https://redis.test/';
    process.env[`${prefix}_TOKEN`] = 'token-redis-teste';
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://redis.test/pipeline');
      assert.equal(options.headers.Authorization, 'Bearer token-redis-teste');
      assert.deepEqual(JSON.parse(options.body), [['GET', 'teste']]);
      return { ok: true, json: async () => [{ result: 'valor' }] };
    };
    assert.equal(await lib.redis('GET', 'teste'), 'valor');
    delete process.env[`${prefix}_URL`]; delete process.env[`${prefix}_TOKEN`];
  }
  process.env.KV_REST_API_URL = 'https://redis.test';
  process.env.KV_REST_API_TOKEN = 'token-redis-teste';
  globalThis.fetch = async () => ({ ok: true, json: async () => [{ error: 'erro interno privado' }] });
  const unavailable = await status(mapa, 'GET', { headers: browser }, 503);
  assert.ok(!JSON.stringify(unavailable.data).includes('privado'));
} finally { globalThis.fetch = realFetch; process.env.REDIS_FALSO = '1'; }
const vercel = JSON.parse(await readFile(new URL('./vercel.json', import.meta.url), 'utf8'));
const security = Object.fromEntries(vercel.headers[0].headers.map(h => [h.key, h.value]));
const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
assert.equal(scripts.length, 2);
const importmap = scripts.find(script => /\btype="importmap"/.test(script[1]));
assert.ok(importmap);
const hash = createHash('sha256').update(importmap[2]).digest('base64');
assert.ok(security['Content-Security-Policy'].includes(`script-src 'self' https://cdn.jsdelivr.net 'sha256-${hash}';`));
assert.ok(scripts.some(script => /\btype="module"/.test(script[1]) && /\bsrc="\/app.js"/.test(script[1]) && !script[2].trim()));
assert.ok(!/\son[a-z]+\s*=/i.test(html), 'Não deve haver atributos de eventos inline.');
assert.ok(security['Content-Security-Policy'].includes("frame-ancestors 'none'"));
assert.equal(security['X-Content-Type-Options'], 'nosniff');
assert.equal(security['Referrer-Policy'], 'no-referrer');
// Parte A: temas, fichas e índice; nenhum arquivo do projeto é lido pela API.
const themeURL = '/api/tema?pasta=projeto-tematico';
const fichaURL = '/api/ficha?pasta=projeto-tematico';
const baseTheme = {
  versao: 1, nome: 'Estúdio Dark', assunto: 'video', icone: '🎬',
  paleta: Object.fromEntries(['fundo', 'painel', 'parede', 'texto', 'fraco', 'destaque', 'destaque2', 'ok', 'alerta', 'erro'].map(k => [k, '#151a28'])),
  andar: { piso: '#1b2030', luz: '#ffd9a0', fachada: '#ff3d3d', decoracao: ['claquete', 'sofa'] },
  paineis: [{ id: 'resumo', tipo: 'kpis', titulo: 'Resumo' }, { id: 'funil', tipo: 'etapas', titulo: 'Produção', dados: 'ficha.etapas' }]
};
for (const handler of [tema, ficha, temas]) {
  await status(handler, 'GET', { url: themeURL }, 401);
  await status(handler, 'GET', { headers: auth, url: themeURL }, handler === tema ? 404 : 401);
  await status(handler, 'GET', { headers: { authorization: 'Bearer errado' }, url: themeURL }, 401);
  await status(handler, 'DELETE', { headers: browser, url: themeURL }, 405);
}
assert.deepEqual((await status(temas, 'GET', { headers: browser }, 200)).data, {});
for (const handler of [tema, ficha]) {
  await status(handler, 'GET', { headers: browser, url: themeURL }, 404);
  await status(handler, 'GET', { headers: browser }, 400);
  await status(handler, 'PUT', { url: themeURL, data: baseTheme }, 401);
  await status(handler, 'PUT', { headers: { authorization: 'Bearer errado' }, url: themeURL, data: baseTheme }, 401);
  await status(handler, 'PUT', { headers: { ...browser, ...auth, origin: 'https://invasor.test' }, url: themeURL, data: baseTheme }, 403);
}
await status(ficha, 'PUT', { headers: browser, url: fichaURL, data: {} }, 401);
await status(tema, 'PUT', { headers: browser, url: `${themeURL}&desfazer=1` }, 404);
await status(tema, 'PUT', { headers: auth, url: themeURL, data: baseTheme, parsed: true }, 200);
assert.deepEqual((await status(tema, 'GET', { headers: browser, url: themeURL }, 200)).data, baseTheme);
assert.deepEqual((await status(tema, 'GET', { headers: auth, url: themeURL }, 200)).data, baseTheme);
assert.equal(await lib.redis('GET', 'auto:tema:projeto-tematico:anterior'), null);
const invalidThemes = [
  { ...baseTheme, versao: 2 }, { ...baseTheme, assunto: 'inexistente' },
  { ...baseTheme, nome: 'a'.repeat(81) }, { ...baseTheme, icone: '' },
  { ...baseTheme, paleta: { ...baseTheme.paleta, fundo: 'red' } },
  { ...baseTheme, andar: { ...baseTheme.andar, luz: '#fff' } },
  { ...baseTheme, andar: { ...baseTheme.andar, decoracao: Array(7).fill('sofa') } },
  { ...baseTheme, paineis: Array(17).fill(baseTheme.paineis[0]) },
  { ...baseTheme, paineis: [baseTheme.paineis[0], baseTheme.paineis[0]] },
  { ...baseTheme, paineis: [{ id: 'x', tipo: 'lista', titulo: 'a'.repeat(81) }] },
  ...['externo.central', 'ficha.__proto__.x', 'ficha.constructor', 'ficha.', 'ficha.x<script>'].map(dados =>
    ({ ...baseTheme, paineis: [{ id: 'x', tipo: 'lista', titulo: 'X', dados }] }))
];
for (const data of invalidThemes) await status(tema, 'PUT', { headers: browser, url: themeURL, data }, 400);
assert.deepEqual((await status(tema, 'GET', { headers: browser, url: themeURL }, 200)).data, baseTheme);
const changedTheme = { ...baseTheme, nome: 'Games', assunto: 'jogo' };
const warningResult = await status(tema, 'PUT', { headers: browser, url: themeURL, data: {
  ...changedTheme, andar: { ...baseTheme.andar, decoracao: ['claquete', 'desconhecida'] },
  paineis: [...baseTheme.paineis, { tipo: 'desconhecido' }]
} }, 200);
assert.equal(warningResult.data.avisos.length, 2);
const sanitized = { ...changedTheme, andar: { ...baseTheme.andar, decoracao: ['claquete'] } };
assert.deepEqual((await status(tema, 'GET', { headers: browser, url: themeURL }, 200)).data, sanitized);
assert.deepEqual(JSON.parse(await lib.redis('GET', 'auto:tema:projeto-tematico:anterior')), baseTheme);
const summary = value => ({ nome: value.nome, icone: value.icone, paleta: { destaque: value.paleta.destaque }, andar: value.andar });
assert.deepEqual((await status(temas, 'GET', { headers: browser }, 200)).data, { 'projeto-tematico': summary(sanitized) });
await status(tema, 'PUT', { headers: browser, url: `${themeURL}&desfazer=1` }, 200);
assert.deepEqual((await status(tema, 'GET', { headers: browser, url: themeURL }, 200)).data, baseTheme);
assert.deepEqual((await status(temas, 'GET', { headers: browser }, 200)).data, { 'projeto-tematico': summary(baseTheme) });
assert.deepEqual(JSON.parse(await lib.redis('GET', 'auto:tema:projeto-tematico:anterior')), sanitized);
await status(tema, 'PUT', { headers: auth, url: '/api/tema?pasta=outra', data: changedTheme }, 200);
const summaries = (await status(temas, 'GET', { headers: browser }, 200)).data;
assert.deepEqual(summaries.outra, summary(changedTheme));
assert.deepEqual(summaries['projeto-tematico'], summary(baseTheme));
await status(tema, 'PUT', { headers: { ...browser, origin: 'https://invasor.test' }, url: `${themeURL}&desfazer=1` }, 403);
await status(tema, 'PUT', { url: `${themeURL}&desfazer=1` }, 401);
await status(tema, 'PUT', { headers: auth, url: `${themeURL}%3Aanterior`, data: changedTheme }, 200);
assert.deepEqual(JSON.parse(await lib.redis('GET', 'auto:tema:projeto-tematico:anterior')), sanitized);
assert.deepEqual((await status(tema, 'GET', { headers: browser, url: `${themeURL}%3Aanterior` }, 200)).data, changedTheme);

// Limites em bytes UTF-8: aceitam exatamente o teto e recusam um byte a mais.
function padded(value, size) {
  const data = { ...value, padding: '' };
  data.padding = 'x'.repeat(size - Buffer.byteLength(JSON.stringify(data)));
  return data;
}
for (const [handler, url, value, limit] of [[tema, themeURL, baseTheme, 30*1024], [ficha, fichaURL, { titulo: 'Vídeo', extra: { livre: [1, 2] } }, 200*1024]]) {
  await status(handler, 'PUT', { headers: auth, url, data: padded(value, limit) }, 200);
  await status(handler, 'PUT', { headers: auth, url, data: padded(value, limit+1), parsed: true }, 413);
  await status(handler, 'PUT', { headers: auth, url, data: { texto: 'á'.repeat(limit/2) } }, 413);
  await status(handler, 'PUT', { headers: { ...auth, 'content-length': String(limit+1) }, url, raw: '{}' }, 413);
  for (const raw of ['{quebrado', '[]', 'null']) await status(handler, 'PUT', { headers: auth, url, raw }, 400);
}
const fichaData = { gerado: new Date().toISOString(), pasta: 'projeto-tematico', titulo: 'Projeto', extra: { agenda: [] }, externo: { central: { postados: 2 } } };
await status(ficha, 'PUT', { headers: auth, url: fichaURL, data: fichaData }, 200);
assert.deepEqual((await status(ficha, 'GET', { headers: browser, url: fichaURL }, 200)).data, fichaData);
await status(ficha, 'GET', { headers: browser, url: '/api/ficha?pasta=outra' }, 404);
console.log(`OK: ${checks} requisições simuladas; autenticação, limites, mapa, eventos, pedidos, Origin, Redis REST, temas, desfazer e fichas validados.`);
