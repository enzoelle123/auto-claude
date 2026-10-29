import { route, session, bearer, header, body, redis, pipeline, json, fail } from './_lib.js';
import { pastaQuery, temaKey, validarTema, resumoTema, TEMA_LIMIT } from './_tema.js';

export default route(['GET', 'PUT'], async (req, res) => {
  if (header(req, 'authorization')) bearer(req);
  else session(req);
  const pasta = pastaQuery(req), key = temaKey(pasta);
  if (req.method === 'GET') {
    const current = await redis('GET', key);
    if (!current) fail(404, 'Tema não encontrado.');
    return json(res, 200, JSON.parse(current));
  }
  // PUT ?pasta=X&desfazer=1 troca o tema atual pela versão anterior.
  const undo = new URL(req.url, 'https://local.invalid').searchParams.get('desfazer') === '1';
  let result;
  if (undo) {
    const previous = await redis('GET', `${key}:anterior`);
    if (!previous) fail(404, 'Versão anterior não encontrada.');
    result = validarTema(JSON.parse(previous));
  } else result = validarTema(await body(req, TEMA_LIMIT));
  const current = await redis('GET', key);
  await pipeline([
    ...(current ? [['SET', `${key}:anterior`, current]] : []),
    ['SET', key, JSON.stringify(result.tema)],
    ['HSET', 'auto:temas', pasta, JSON.stringify(resumoTema(result.tema))]
  ]);
  json(res, 200, { ok: true, avisos: result.avisos });
});
