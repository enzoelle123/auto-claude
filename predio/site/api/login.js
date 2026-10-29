import { route, origin, body, equal, config, fail, setCookie, sessionToken, json } from './_lib.js';

// Sem limite de tentativas, a pedido do cliente (27/10/2026): o limite bloqueava o próprio dono.
export default route(['POST'], async (req, res) => {
  origin(req);
  const data = await body(req);
  // A senha cadastrada pelo PowerShell pode vir com quebra de linha no fim; os dois lados são aparados.
  if (typeof data.senha !== 'string' || !equal(data.senha.trim(), config('SENHA_SITE').trim())) {
    fail(401, 'Senha inválida.');
  }
  setCookie(res, sessionToken());
  json(res, 200, { ok: true });
});
