# Rachid Head Shop

Loja online feita com Next.js, React, TypeScript e Prisma. O catálogo e os pedidos são persistidos em SQLite.

## Requisitos

- Node.js 20.9 ou superior
- npm

## Executar localmente

```powershell
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

Abra <http://localhost:3000>. O script `db:setup` cria as tabelas e carrega as categorias e os 14 produtos iniciais. Para recriar ou atualizar os dados do catálogo, use `npm run db:seed`.

O SQLite fica em `prisma/dev.db` e não é enviado ao GitHub. O arquivo `.env` também é privado. A URL de conexão pode ser alterada em `DATABASE_URL`.

## Recursos

- Catálogo vindo do banco de dados, busca e filtros por categoria
- Carrinho salvo no navegador
- Consulta de CEP e estimativa de frete via ViaCEP
- Registro persistente de pedidos, com preço recalculado no servidor
- Consulta de saúde em `/api/health`
- Assistente de perguntas frequentes sem expor chaves de terceiros no navegador

## Pagamentos e produção

O site **não processa pagamentos**. Pix, cartão e boleto são registrados somente como a preferência do cliente; a confirmação precisa ser feita manualmente pela loja. Não envie nem armazene dados de cartão neste aplicativo. Para cobrar de verdade, integre um provedor de pagamentos e confirme o resultado por webhook.

Esta configuração SQLite é voltada a desenvolvimento ou a um servidor persistente de instância única. Não use o arquivo SQLite local como banco de produção em hospedagens serverless ou com disco efêmero. Para esses cenários, migre para um PostgreSQL gerenciado antes do deploy.

As opções de frete e prazos exibidos são estimativas regionais, não uma cotação contratada com os Correios.

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

## API

- `GET /api/health` — estado da aplicação e do banco
- `GET /api/catalogo/produtos` — categorias e produtos ativos
- `GET /api/frete?cep=60000000&valor=150` — endereço e opções estimadas
- `POST /api/pedido` — registrar um pedido; os preços e o frete são recalculados no servidor
- `POST /api/chat` — resposta para perguntas frequentes

O arquivo `.env.example` documenta as variáveis disponíveis. Nunca publique valores reais de chaves ou credenciais.
