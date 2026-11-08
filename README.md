# Rachid Head Shop

Loja online feita com Next.js, React, TypeScript e Prisma. O catálogo, os pedidos e as contas são persistidos em PostgreSQL gerenciado pelo Supabase.

## Requisitos

- Node.js 22.5 ou superior
- npm

## Executar localmente

Copie o exemplo, configure `DATABASE_URL` (pooler de transação do Supabase) e `DIRECT_URL` (pooler de sessão) no `.env`, depois rode:

```powershell
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

Abra <http://localhost:3000>. Para uma instalação nova, `db:setup` aplica as migrações e carrega os produtos iniciais. Para preservar os dados do SQLite que já estava em `prisma/dev.db`, rode `npm run db:deploy`, confira o arquivo com `npm run db:import-sqlite -- --dry-run` e depois rode `npm run db:import-sqlite` (não rode `db:setup` antes, pois o importador exige um destino vazio). O importador lê o arquivo diretamente, não cria exportação com dados pessoais e aborta se o destino já contiver registros. Não apague o arquivo SQLite até confirmar os dados no Supabase.

## Recursos

- Catálogo vindo do banco de dados, busca e filtros por categoria
- Carrinho salvo no navegador
- Área do cliente com conta, endereço salvo e histórico de pedidos
- Entrega local por bairro/região e faixa de CEP, com entrega terceirizada cotada pelo WhatsApp
- Resumo do pedido preparado para envio ao WhatsApp cadastrado pela empresa
- Registro persistente de pedidos, com preço recalculado no servidor
- Consulta de saúde em `/api/health`
- Upload de imagens de produtos para o Supabase Storage, sem digitar URLs no painel
- Painel administrativo protegido para gerenciar produtos e acompanhar pedidos

## Área administrativa

Acesse `/admin` e entre com a senha definida em `ADMIN_PASSWORD`. Para habilitar o acesso localmente, gere uma senha forte com pelo menos 12 caracteres e um segredo aleatório com pelo menos 32 caracteres para `ADMIN_SESSION_SECRET`, e defina ambos no arquivo `.env`. Por exemplo, no PowerShell:

```powershell
$bytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Use o valor gerado para `ADMIN_SESSION_SECRET` e configure a senha administrativa separadamente. Gere outro segredo aleatório para `CUSTOMER_SESSION_SECRET`. Em produção, configure essas variáveis como segredos no provedor de hospedagem — nunca as publique no repositório. A sessão administrativa expira após 8 horas e a sessão do cliente após 30 dias. O painel permite gerenciar produtos, categorias (crie uma categoria no próprio formulário de produto), imagens, clientes cadastrados (com busca e exportação CSV), custo, estoque mínimo, faixas locais de CEP, dados da empresa e pedidos. A seção Clientes mostra somente nome, e-mail, telefone e data do cadastro; utilize os contatos apenas conforme a autorização dos clientes. Para imagens, escolha arquivos JPEG, PNG, WebP ou AVIF de até 4 MB no computador; o envio ao bucket do Supabase Storage é feito pelo servidor e só pode ser iniciado no painel autenticado. O bucket `product-images` precisa estar configurado como público para exibir as imagens no catálogo; a chave de serviço fica apenas no servidor. Em Estoque, produtos ativos com quantidade igual ou inferior ao mínimo aparecem como alerta. Ao registrar um pedido, o estoque é reservado; ao cancelar, a quantidade é devolvida. Reativar um pedido tenta reservar o estoque novamente.

Clientes criam conta em `/cliente` com e-mail, CPF válido, telefone e senha, salvam o endereço e consultam seus próprios pedidos. Na busca do CEP, o bairro é selecionado automaticamente pela faixa de CEP cadastrada no admin; CEPs sem faixa local oferecem contato com a loja pelo WhatsApp. O CPF é armazenado como HMAC, não em texto simples; contas existentes precisam cadastrá-lo no perfil após entrar. A recuperação exige e-mail e CPF correspondentes e envia um código de uso único, válido por 10 minutos, por SMTP. O código aceita no máximo cinco tentativas; solicitações são limitadas e uma redefinição invalida as sessões anteriores. Para habilitar o envio pelo Gmail, crie uma senha de app e configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` em `.env` ou nos segredos do servidor. Nunca use nem publique a senha normal da conta Google.

Visitantes também podem informar o CEP na landing page para consultar as opções de frete; o endereço retornado inclui o bairro quando informado pelo ViaCEP. Para concluir um pedido, ainda é necessário entrar na conta. Em `/admin` → Entregas, cadastre uma faixa ativa de CEP para cada bairro/região e informe a tarifa correspondente; faixas ativas sobrepostas são rejeitadas. A tarifa local só é oferecida quando o CEP é da mesma cidade da empresa e corresponde a uma faixa ativa. CEPs fora das faixas continuam podendo usar a opção terceirizada, com frete pendente de cotação. Após registrar um pedido, o site abre um link do WhatsApp da empresa com os itens, endereço, pagamento, subtotal, frete e total preenchidos. O cliente ainda precisa tocar em **Enviar** no WhatsApp; o site não envia mensagens em nome do usuário.

Em `/admin` → Produtos, use **Promoção** no card para aplicar um desconto de 5% a 90%. A promoção altera o preço calculado pelo servidor e permanece ativa até ser removida pelo admin. O desconto aparece no card do catálogo e na seção Promoções. Ao entrar na área do cliente, o cliente também verá promoções de produtos associados a pedidos anteriores não cancelados.

Em `/admin` → Receita, selecione os últimos 7, 15, 30, 120 ou 240 dias ou um intervalo personalizado. A análise exclui pedidos cancelados e frete; representa pedidos registrados, não pagamentos confirmados. O lucro e as margens ficam indisponíveis se faltar custo em qualquer item vendido no período. Custos de novos pedidos são preservados como histórico no momento da compra; pedidos anteriores sem esse registro não são tratados como lucro integral.

## Pagamentos e produção

O site **não processa pagamentos**. Pix, cartão e boleto são registrados somente como a preferência do cliente; a confirmação precisa ser feita manualmente pela loja. Não envie nem armazene dados de cartão neste aplicativo. Para cobrar de verdade, integre um provedor de pagamentos e confirme o resultado por webhook.

Em produção na Vercel, configure `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como variáveis privadas do projeto para os ambientes apropriados. Configure também `SUPABASE_STORAGE_BUCKET=product-images` e crie no Supabase Storage um bucket público com esse nome. A chave de serviço deve ficar exclusivamente no servidor; nunca use uma chave `service_role` ou `sb_secret_` no navegador nem a publique no GitHub. Copie os endereços de conexão com pooler do botão **Connect** no Supabase: use o pooler de transação (porta 6543) para `DATABASE_URL` e o pooler de sessão (porta 5432) para `DIRECT_URL`. As senhas na URL precisam estar codificadas para URL. Nunca publique URLs do banco, senhas ou segredos no GitHub. Execute `npm run db:deploy` após configurar as variáveis e antes de abrir o site. Configure também as variáveis SMTP se for habilitar recuperação de senha por e-mail.

As tarifas locais são definidas por bairro/região nas faixas de CEP do painel administrativo. Para bairros com faixas não contínuas, crie mais de uma faixa com o mesmo nome. O frete terceirizado só é confirmado pela loja no WhatsApp.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Desenvolvimento |
| `npm run build` | Gerar build de produção |
| `npm start` | Servir o build |
| `npm run lint` | Executar ESLint |
| `npm run typecheck` | Verificar tipos TypeScript |
| `npm run db:setup` | Criar o banco e inserir dados iniciais |
| `npm run db:seed` | Recarregar categorias e produtos iniciais |
| `npm run db:studio` | Abrir o Prisma Studio |
| `npm run db:deploy` | Aplicar migrações no PostgreSQL |
| `npm run db:import-sqlite` | Importar o SQLite local para um PostgreSQL vazio |

## API

- `GET /api/health` — estado da aplicação e do banco
- `GET /api/catalogo/produtos` — categorias e produtos ativos
- `GET /api/frete?cep=60000000` — valida CEP e retorna as opções locais configuradas
- `POST /api/pedido` — registrar um pedido autenticado; os preços e a tarifa local são recalculados no servidor
- `POST /api/admin/categorias` — cadastrar categoria, restrito ao administrador
- `/api/cliente/*` — autenticação, perfil e histórico privado do cliente

O arquivo `.env.example` documenta as variáveis disponíveis. Nunca publique valores reais de chaves ou credenciais.
