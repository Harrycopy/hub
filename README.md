# ShippingCaps · Traffic Hub

Versão nova do painel de gestão de tráfego, feita com Claude em HTML, CSS e JavaScript puros, sem Lovable e sem build.

Site: https://harrycopy.github.io/hub/

**Ligado no banco real do Hub** (o mesmo Supabase do Hub do Lovable): mesmo login, mesmas permissões, os mesmos dados. O que alguém muda aqui aparece no Hub e vice-versa. Histórico e avisos continuam sendo gravados pelo próprio banco.

Tudo roda neste site, inclusive o que antes precisava do servidor do Hub:

- **Ads por oferta:** lê pela função `offer_ads_snapshot` a contagem que o robô salva a cada 10 min (ClickUp + docs de COPY ADS). Só admin.
- **Esqueci a senha e definir senha:** o e-mail traz o link de volta para este site.
- **Convidar, reenviar link, trocar papel, ativar e desativar usuário:** pelas funções `admin_invite_user`, `admin_set_user_role` e `admin_set_user_active`. Só admin, com as mesmas travas do Hub: ninguém tira o próprio admin nem se desativa.
- **Ler o Drive agora:** a função `drive_scan_now` dispara o mesmo pedido do robô de 10 em 10 min.

Enquanto uma dessas funções não existir no banco, o botão abre a mesma tela no Hub antigo em vez de quebrar.

O robô que lê o Drive e conta o COPY ADS continua sendo o do Hub do Lovable (roda lá de 10 em 10 min). Se aquele servidor for desligado, a Entrada do Drive e o Ads por oferta param de atualizar.

Demo com dados de exemplo, sem tocar no banco: https://harrycopy.github.io/hub/?demo

## O que tem

- Login por perfil (admin ou gestor), cada um vendo só o que veria de verdade.
- Esteira por anúncio: quadro com arrastar e soltar, lista, lixeira, seleção em lote (com Shift), desfazer.
- Demanda: entrega para o gestor, performance (ROAS, CPA, CTR, CPC, CPM, assertividade), anúncios e testes, comentários e relatórios, histórico.
- Relatórios com filtros, motivo de rejeição, CSV por demanda e consolidado, PDF pela impressão.
- Performance com gráfico clicável e quebra por gestor, produto e mecanismo.
- Entrada do Drive, Ads por oferta, Administração (usuários, catálogo, pastas, integrações).
- EN/PT no topo, busca rápida com ⌘K, celular.

## Demo: abrir direto como alguém

`?demo&as=u_kevin&lang=pt` no fim do link abre como o Kevin em português. Perfis: `u_admin`, `u_harry`, `u_kevin`, `u_joao`, `u_matheus`, `u_akshit`, `u_munish`.

## Atualizar

Subir os arquivos alterados e trocar o `?v=N` dos links de CSS e JS no `index.html`, senão o navegador usa o cache.
