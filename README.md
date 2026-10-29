# ShippingCaps · Traffic Hub (protótipo)

Versão nova do painel de gestão de tráfego, feita com Claude em HTML, CSS e JavaScript puros, sem Lovable e sem build.

Site: https://harrycopy.github.io/hub/

**É um protótipo navegável com dados de exemplo.** Nada aqui lê ou grava no Hub de produção. Os dados ficam no navegador de quem abre (localStorage) e o botão "Reiniciar demo" volta tudo ao exemplo.

## O que tem

- Login por perfil (admin ou gestor), cada um vendo só o que veria de verdade.
- Esteira por anúncio: quadro com arrastar e soltar, lista, lixeira, seleção em lote (com Shift), desfazer.
- Demanda: entrega para o gestor, performance (ROAS, CPA, CTR, CPC, CPM, assertividade), anúncios e testes, comentários e relatórios, histórico.
- Relatórios com filtros, motivo de rejeição, CSV por demanda e consolidado, PDF pela impressão.
- Performance com gráfico clicável e quebra por gestor, produto e mecanismo.
- Entrada do Drive, Ads por oferta, Administração (usuários, catálogo, pastas, integrações).
- EN/PT no topo, busca rápida com ⌘K, celular.

## Abrir direto como alguém

`?as=u_kevin&lang=pt` no fim do link abre como o Kevin em português. Perfis: `u_admin`, `u_harry`, `u_kevin`, `u_joao`, `u_matheus`, `u_akshit`, `u_munish`.

## Atualizar

Subir os arquivos alterados e trocar o `?v=N` dos links de CSS e JS no `index.html`, senão o navegador usa o cache.
