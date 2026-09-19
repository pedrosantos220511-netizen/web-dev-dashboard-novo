# Web Dev Dashboard 2.0

Dashboard interno da Web Dev, com login, permissões por área, PostgreSQL/Neon, Prisma, Express, React e Render.

## Equipe
- Pedro: Desenvolvimento + Operações, administrador
- Daniel: Desenvolvimento + Operações
- Pablo: Desenvolvimento + Operações
- Samuel: Marketing + Vendas + Finanças
- Guilherme: Marketing + Vendas + Finanças

## Rodar localmente

1. Instale Node.js 20+.
2. Na raiz:
   `npm install`
3. Entre em `server` e crie `.env` usando `.env.example`.
4. Coloque a `DATABASE_URL` do Neon.
5. Gere o Prisma:
   `npm run db:generate`
6. Crie/aplique a estrutura:
   `npm run db:deploy`
7. Cadastre os usuários e dados de demonstração:
   `npm run db:seed`
8. Inicie:
   `npm run dev`

Frontend: http://localhost:5173
API: http://localhost:3000

## Senhas do seed

Defina no `server/.env`:
PEDRO_PASSWORD, DANIEL_PASSWORD, PABLO_PASSWORD, SAMUEL_PASSWORD, GUILHERME_PASSWORD

Se não definir, o seed usa `WebDev@2026` para todos os usuários de demonstração.

## Produção no Render

O Render usa `npm install && npm run build` e `npm start`.
Configure `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL` e `NODE_ENV=production`.
