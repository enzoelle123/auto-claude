import { randomBytes } from 'node:crypto';
import { route, session, bearer, body, text, fail, rate, pipeline, redis, getPedido, getPedidos, indexPedido, migratePedidos, json } from './_lib.js';
export default route(['GET', 'POST', 'PATCH'], async (req, res) => {
  if (req.method === 'GET') {
    const query = new URL(req.url, 'https://local.invalid').searchParams;
    const pending = query.get('status') === 'novo';
    if (pending) bearer(req); else session(req);
    const pasta = pending ? null : text(query.get('pasta'), 'pasta', 200);
    await migratePedidos();
    const ids = await redis('ZREVRANGE', pending ? 'auto:pedidos:novo' : `auto:pedidos:pasta:${pasta}`, 0, pending ? 99 : 49);
    const pedidos = (await getPedidos(ids)).filter(pedido => pending ? pedido.status === 'novo' : pedido.pasta === pasta);
    return json(res, 200, { pedidos });
  }
  if (req.method === 'POST') {
    const sessao = session(req);
    const data = await body(req);
    const pasta = text(data.pasta, 'pasta', 200);
    const texto = text(data.texto, 'texto', 2000);
    const andar = data.andar;
    if (!(typeof andar === 'string' && andar.trim() && andar.length <= 200) &&
        !(Number.isSafeInteger(andar) && andar >= 0)) fail(400, 'Campo andar inválido.');
    await rate(`auto:limite-pedidos:${sessao}`, 30, 60*60);
    const now = Date.now();
    const pedido = { id: `${now}-${randomBytes(8).toString('hex')}`, pasta, andar, texto, status: 'novo', criado: new Date(now).toISOString() };
    await pipeline([
      ['HSET', `auto:pedido:${pedido.id}`, ...Object.entries(pedido).flatMap(([k,v]) => [k, JSON.stringify(v)])],
      ...indexPedido(pedido)
    ]);
    return json(res, 201, pedido);
  }
  bearer(req);
  const data = await body(req);
  const id = text(data.id, 'id', 100);
  if (!['em andamento', 'feito', 'recusado'].includes(data.status)) fail(400, 'Status inválido.');
  if (data.resposta !== undefined) text(data.resposta, 'resposta', 10000, 0);
  if (!await getPedido(id)) fail(404, 'Pedido não encontrado.');
  const fields = ['status', JSON.stringify(data.status)];
  if (data.resposta !== undefined) fields.push('resposta', JSON.stringify(data.resposta));
  await pipeline([
    ['HSET', `auto:pedido:${id}`, ...fields],
    ['ZREM', 'auto:pedidos:novo', id]
  ]);
  json(res, 200, await getPedido(id));
});
