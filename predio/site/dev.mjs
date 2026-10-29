import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Valores públicos e fixos, exclusivos do servidor de desenvolvimento.
Object.assign(process.env, {
  REDIS_FALSO: '1', SENHA_SITE: 'teste123',
  SEGREDO_SESSAO: 'token-local', TOKEN_PC: 'token-local'
});
const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = await realpath(resolve(root, 'public'));
// Fixtures sintéticas somente neste processo local; nenhuma escrita em produção.
const { redis } = await import('./api/_lib.js');
const { validarTema, temaKey, resumoTema } = await import('./api/_tema.js');
const examplePasta = 'exemplo-video';
const exampleTema = validarTema(JSON.parse(await readFile(resolve(root, 'exemplos/tema-video.json'), 'utf8'))).tema;
const exampleFicha = JSON.parse(await readFile(resolve(root, 'exemplos/ficha-video.json'), 'utf8'));
await redis('SET', temaKey(examplePasta), JSON.stringify(exampleTema));
await redis('HSET', 'auto:temas', examplePasta, JSON.stringify(resumoTema(exampleTema)));
await redis('SET', `auto:ficha:${encodeURIComponent(examplePasta)}`, JSON.stringify(exampleFicha));
await redis('SET', 'auto:mapa', JSON.stringify({andares:[{pasta:examplePasta,n:1,titulo:exampleFicha.titulo,status:'andamento',setores:exampleFicha.setores,pendencias:exampleFicha.pendencias}]}));
await redis('LPUSH', 'auto:eventos', JSON.stringify({pasta:examplePasta,setor:'producao',tipo:'agente',nome:'Editor de exemplo',motivo:'Preparando corte de demonstração',hora:new Date().toISOString()}));
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
const rules = (config.headers ?? []).map(rule => ({
  pattern: new RegExp(`^${rule.source}$`), headers: rule.headers
}));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
function reply(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost:8780').pathname);
    for (const rule of rules) {
      if (rule.pattern.test(pathname)) {
        for (const { key, value } of rule.headers) res.setHeader(key, value);
      }
    }
    if (pathname.startsWith('/api/')) {
      const route = pathname.slice(5);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(route)) return reply(res, 404, 'Rota não encontrada.');
      const handlerPath = resolve(root, 'api', `${route}.js`);
      try { await stat(handlerPath); }
      catch (error) {
        if (error.code === 'ENOENT') return reply(res, 404, 'Rota não encontrada.');
        throw error;
      }
      const { default: handler } = await import(pathToFileURL(handlerPath).href);
      await handler(req, res);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return reply(res, 405, 'Método não permitido.');
    }
    const file = await realpath(resolve(publicRoot, `.${pathname === '/' ? '/index.html' : pathname}`));
    const rel = relative(publicRoot, file);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) return reply(res, 404, 'Arquivo não encontrado.');
    if (!(await stat(file)).isFile()) return reply(res, 404, 'Arquivo não encontrado.');
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': data.length
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (res.headersSent) { res.destroy(); return; }
    const missing = ['ENOENT', 'ENOTDIR'].includes(error.code);
    reply(res, error instanceof URIError ? 400 : missing ? 404 : 500,
      missing ? 'Arquivo não encontrado.' : 'Não foi possível atender à requisição.');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(8780, 'localhost', () => {
  console.warn('AVISO: somente desenvolvimento; Redis em memória e credenciais fixas: SENHA_SITE=teste123, SEGREDO_SESSAO=token-local, TOKEN_PC=token-local.');
  console.log('Site local: http://localhost:8780');
  console.log('Dashboard fictício: http://localhost:8780/dash.html?pasta=exemplo-video');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
