# MayDay

A web application for coordinating mutual aid between individuals, organizations, and communities. Members post requests for help or offers of resources and services, and connect through search, filtering, map-based discovery, and direct messaging. Also includes image uploads, push notifications, content moderation and bug reporting, admin announcements, and internationalization (English now, with Spanish in progress).

## Prerequisites

- [Node.js](https://nodejs.org/) v20.19+ or v22.12+ (required by Vite 8)
- [Docker](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)

## Getting Started

### 1. Install dependencies

```sh
npm install
```

### 2. Set up environment variables

```sh
cp .env.example .env
```

The defaults in `.env.example` work out of the box with the Docker Compose database, but a few things need attention before everything works end-to-end:

- `JWT_SECRET` / `JWT_REFRESH_SECRET` — change from the placeholder values before deploying anywhere non-local.
- `SMTP_*` — required for account confirmation emails. Without these, new signups will not be able to verify their email. The seeded accounts are pre-verified, so they work without SMTP configured.
- `SPACES_*` — optional. Set these if you want to use DigitalOcean Spaces for image uploads on posts.

### 3. Start PostgreSQL

```sh
docker compose up -d
```

### 4. Build the shared types package

```sh
npm run build:shared
```

### 5. Run database migrations

```sh
cd server
npm run db:migrate
cd ..
```

> **Note:** Use `npm run db:migrate` instead of `npx prisma migrate dev`. The npm script loads the root `.env` file via `dotenv-cli`, which Prisma needs to find `DATABASE_URL`.

### 6. Seed the database (optional)

This creates the following:

- 1 admin account
- 4 sample users (each with 3–4 friendships)
- 7 sample organizations
- 7 sample communities
- 14 public posts
- 13 organization posts
- 14 community posts

```sh
npm run db:seed
```

**Test accounts:**

| Role  | Email              | Password     |
| ----- | ------------------ | ------------ |
| Admin | admin@mayday.local | admin123!    |
| User  | emma@example.com   | password123! |
| User  | peter@example.com  | password123! |
| User  | david@example.com  | password123! |
| User  | ursula@example.com | password123! |

### 7. Start the development servers

In two separate terminals:

```sh
# Terminal 1 — API server (port 3001)
npm run dev:server

# Terminal 2 — Client dev server (port 5173)
npm run dev:client
```

Open http://localhost:5173 in your browser.

## Project Structure

```
mayday/
  packages/shared/     Shared TypeScript types, enums, and Zod validation schemas
  client/              React + Vite + Tailwind frontend
  server/              Express + Prisma + WebSocket backend
  docker-compose.yml   PostgreSQL 16 for local development
```

## Available Scripts

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev:client`   | Start the Vite dev server                                    |
| `npm run dev:server`   | Start the Express dev server with hot reload                 |
| `npm run build:shared` | Build the shared types package                               |
| `npm run build:client` | Build the client for production                              |
| `npm run build:server` | Build the server for production                              |
| `npm run build`        | Build all packages                                           |
| `npm start`            | Build shared types and run the server in production mode     |
| `npm test`             | Run the client and server test suites                        |
| `npm run db:migrate`   | Run Prisma migrations                                        |
| `npm run db:seed`      | Seed the database with sample data                           |
| `npm run db:clear`     | Delete all data from the database                            |

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, TanStack Query, React Router, React Hook Form, Leaflet, react-intl (FormatJS), Sonner, libsodium-wrappers
- **Backend:** Express, Prisma, PostgreSQL, WebSocket (`ws`), JWT authentication, bcrypt, Helmet, express-rate-limit, multer + `@aws-sdk/client-s3` (DigitalOcean Spaces), Nodemailer, web-push
- **Shared:** TypeScript, Zod

## Notes

- Versioning is very much being done on a vibes basis. I'm not great at rigidly following specifications
- I'm trying to make this as useful for people IRL as possible. If there's something that I could add that would make this more usable for you, please let me know!
- Accessibility is very important to me! Please report any accessibility issues, and they will instantly go to the top of my priority queue.
