# MayDay

A web application for coordinating mutual aid between individuals and organizations. Users can post requests for help or offer resources and services, and the app helps connect them through search, filtering, map-based discovery, and direct messaging.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
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

The defaults in `.env.example` work out of the box with the Docker Compose database. If you need to change the JWT secrets, edit `.env` before starting the server.

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

This creates an admin account, two sample users, and six sample posts.

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

| Command                | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm run dev:client`   | Start the Vite dev server                    |
| `npm run dev:server`   | Start the Express dev server with hot reload |
| `npm run build:shared` | Build the shared types package               |
| `npm run build:client` | Build the client for production              |
| `npm run build:server` | Build the server for production              |
| `npm run build`        | Build all packages                           |
| `npm run db:migrate`   | Run Prisma migrations                        |
| `npm run db:seed`      | Seed the database with sample data           |
| `npm run db:clear`     | Delete all data from the database            |

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, TanStack Query, React Router, Leaflet, React Hook Form
- **Backend:** Express, Prisma, PostgreSQL, WebSocket (`ws`), JWT authentication
- **Shared:** TypeScript, Zod
