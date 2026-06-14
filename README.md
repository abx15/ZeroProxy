# ZeroProxy Backend

> **Smart Face Auth + Employee Monitoring System — Complete Backend Engine**

ZeroProxy is an enterprise-grade backend built with NestJS, powering a secure employee monitoring platform with Face Authentication, Multi-Device Session Management, real-time WebSockets tracking, and MongoDB-based audit logs.

---

## 🛠️ Tech Stack & Infrastructure

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Primary Database**: PostgreSQL + [Prisma ORM](https://www.prisma.io/)
- **Caching & Session Tracking**: Redis (using `ioredis`)
- **Audit Trails**: MongoDB + Mongoose
- **Real-Time Communication**: Socket.io (NestJS Gateways)
- **API Documentation**: Swagger OpenAPI UI
- **Testing**: Jest (Unit & E2E)

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- Node.js (v18+)
- Docker and Docker Compose
- Git

### 2. Infrastructure Setup (Docker)
Start the Redis and MongoDB containers locally:
```bash
docker-compose up -d
```
*Note: PostgreSQL is configured via the Neon Cloud Database inside `.env`.*

### 3. Install Dependencies
```bash
cd backend
npm install
```

### 4. Database Setup & Seeding
Run Prisma migrations and seed default Admin/Employee accounts:
```bash
npx prisma db push
npx prisma db seed
```

### 5. Running the Application
```bash
# Development Mode (with hot-reload)
npm run start:dev

# Production Mode
npm run build
npm run start:prod
```
Once started, the backend is available at `http://localhost:3001/api`.

---

## 📚 API Documentation (Swagger)

A fully interactive Swagger API interface is available at:
👉 **[http://localhost:3001/api/docs](http://localhost:3001/api/docs)**

### Key Highlights
- **JWT Authorization**: Use the `Authorize` button to input your token in `Bearer <JWT_TOKEN>` format to access protected endpoints.
- **Structured Categories**: Clean tag grouping for `Auth`, `Users`, `Attendance`, `Sessions`, and `Activity`.

---

## ⚡ WebSocket Gateway

The real-time gateway is hosted at `ws://localhost:3001/events` (namespace `/events`).

### Connection & Security
- **Authentication**: JWT token validation is enforced during handshake.
- **Room isolation**:
  - `company:${companyId}`: Joined by all company employees.
  - `admin:${companyId}`: Restrictive admin/HR room. All sensitive events are routed here.

### Broadcast Events
- `employee:checkin` — Restrictive broadcast when an employee checks in.
- `employee:checkout` — Restrictive broadcast when an employee checks out.
- `user:login` — Admin broadcast on login.
- `user:logout` — Admin broadcast on logout.
- `session:force-logout` — Broadcast when a session is terminated by an admin.
- `user:kicked:${userId}` — Directed disconnect event targeting a kicked employee socket.

---

## 🧪 Testing Suite

ZeroProxy is covered by Jest unit tests and integration E2E tests.

```bash
# Run unit tests
npm run test

# Run E2E integration tests (requires docker containers to be running)
npm run test:e2e

# Generate test coverage report
npm run test:cov
```

---

## 📂 Project Structure

```
backend/
├── src/
│   ├── activity/        # MongoDB Audit Trail Module
│   ├── attendance/      # Check-in, Check-out, and Reports
│   ├── auth/            # JWT Guard, Strategy, Login/Logout
│   ├── common/          # Global interceptors, filters, decorators
│   ├── events/          # WebSocket Gateway & Socket.io Room manager
│   ├── prisma/          # Prisma database client
│   ├── redis/           # Session management & token blacklist cache
│   ├── sessions/        # Multi-device session manager
│   ├── users/           # User profiles & management
│   ├── app.module.ts    # Main NestJS module entry
│   └── main.ts          # Server listener, CORS, Swagger setup
├── test/
│   ├── app.e2e-spec.ts  # End-to-end integration tests
│   └── jest-e2e.json    # E2E test runner configuration
└── test_websockets.js   # Automated WebSocket gateway verification
```
