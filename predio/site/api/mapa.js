import { route, session, bearer, body, redis, json } from './_lib.js';
export default route(['GET', 'PUT'], async (req, res) => {
  if (req.method === 'GET') {
    session(req);
    const mapa = await redis('GET', 'auto:mapa');
    return json(res, 200, mapa ? JSON.parse(mapa) : { andares: [] });
  }
  bearer(req);
  const mapa = await body(req, 300*1024);
  await redis('SET', 'auto:mapa', JSON.stringify(mapa));
  json(res, 200, { ok: true });
});
