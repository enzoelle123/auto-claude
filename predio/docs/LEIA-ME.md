Prédio /auto v2 no ar em https://predio-auto.vercel.app: funcionários ao vivo, pedidos por andar e Central pela Tailscale

# Prédio /auto v2

- Site: https://predio-auto.vercel.app (entre com a sua senha; a sessão dura 30 dias)
- Ao vivo: cada ação do /auto aparece em segundos (balão no boneco, faixa "Ao vivo")
- Pedidos: escreva no andar → o próximo /auto lista, executa e responde ali mesmo
- Central dos Canais: botão no andar dos canais dark, abre com a Tailscale ligada no celular
- Conversa ao vivo: app Claude no celular (Remote Control)

- Andar: pendências à vista, funcionários se mexendo e ficha com retrato 2D (toque no boneco)

## Pendências
- [ ] Teste do cliente no celular: entrar, mandar um pedido e abrir a Central com a Tailscale ligada
- [ ] Próximas centrais: criar `<projeto>/central.json` + `tailscale serve` na porta dela + liberar o host
- [ ] Baixas (Gerente): Origin da Central aceita http do mesmo host e POST sem Origin; three.js sem SRI

## Visão BI (29/10/2026)
Todo dashboard (`dash.html`) abre com a faixa **Visão BI** estilo Power BI, calculada da ficha: cartões KPI com minigráfico, rosca de status, barras por etapa, colunas por setor, área de atividade, medidor de progresso e rosca de entregas por tipo; filtro 7/14 dias/Tudo, dica ao tocar e "Ver dados" em tabela. Código: `site/public/bi.js`; teste: `node site/teste_bi.mjs`.
