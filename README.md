# OpenMasjid

Multi-tenant platform for masjid websites, built with Next.js 15 and Payload CMS 3 on Postgres.

## Prerequisites

- **Node.js** ≥ 20.9.0
- **Docker** (for the local Postgres container)
- **npm**

## Setup

```bash
git clone https://github.com/majidtahir1/open-masjid.git
cd open-masjid
npm install
```

### Environment

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# Host port from docker-compose.yml is 5433 (not 5432)
DATABASE_URI=postgres://postgres:postgres@localhost:5433/openmasjid

# Generate with: openssl rand -hex 32
PAYLOAD_SECRET=<32-byte random hex>

NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

### Database

```bash
docker compose up -d
```

This starts Postgres 16 on host port `5433` with a persistent `pgdata` volume. Payload pushes its schema automatically on first boot — no manual migrations needed.

### Run

```bash
npm run dev
```

Open http://localhost:3000 for the site and http://localhost:3000/admin for the Payload admin. Create the first admin user on first visit.

### Seed (optional)

```bash
npm run seed
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run lint` | ESLint |
| `npm run generate:types` | Regenerate `payload-types.ts` from collections |
| `npm run seed` | Seed the database |

## Project structure

```
src/
├── app/              # Next.js app router (public site + /admin)
├── collections/      # Payload collections — the source of truth for the DB schema
├── access/           # Access control helpers
├── components/       # Shared React components
├── fields/           # Reusable Payload field definitions
├── hooks/            # Payload collection hooks
├── lib/              # Utilities
├── middleware.ts     # Tenant resolution
└── payload.config.ts # Payload config entry point
```

## Schema changes

The DB schema is defined by the Payload collections in `src/collections/`. On a fresh clone, starting the dev server creates all tables. When you change a collection, Payload auto-syncs the schema in dev. For production, consider switching to explicit migration files via `npx payload migrate:create`.

## Troubleshooting

- **`ECONNREFUSED` on port 5432** — the `.env` `DATABASE_URI` must use port **5433** (the host-mapped port in `docker-compose.yml`).
- **`payload-types.ts` missing** — run `npm run generate:types`. The file is gitignored and generated locally.
- **Reset the DB** — `docker compose down -v` removes the `pgdata` volume. Next `up -d` starts fresh.
