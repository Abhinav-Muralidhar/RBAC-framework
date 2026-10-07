# Enterprise RBAC & Access Governance Framework

An enterprise-grade Role-Based Access Control (RBAC) and Governance Framework built with **TypeScript**, **Node.js/Express**, **PostgreSQL**, and **React**.

Designed with granular permission matrices, optimistic concurrency control, immutable audit logging, and a decoupled Service-Repository architecture with ACID transaction safety.

---

## Architecture & Access Control Model

### 1. Multi-Layered Authorization Engine
The authorization engine evaluates access using a strict fail-closed, deny-over-allow strategy:

```
┌─────────────────────────────────────────────────────────────┐
│                    User & Group Layer                       │
│  - User Accounts (authentication, status, preferences)      │
│  - User Groups (logical department / team grouping)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Role & Profile Layer                     │
│  - Roles (assigned to users or groups)                      │
│  - Profiles (reusable bundles of module permissions)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Module & Permission Matrix                  │
│  - Modules (Users, Roles, Audit Logs, Settings, etc.)       │
│  - Permissions (Actions: create, read, update, delete,      │
│                 export with explicit 'allow' / 'deny')      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Sharing Rules Layer                     │
│  - Cross-Group resource sharing policies (Read / Read-Write)│
└─────────────────────────────────────────────────────────────┘
```

* **Module & Permission Matrix:** Fine-grained actions (`create`, `read`, `update`, `delete`, `export`) defined per application module.
* **Profiles:** Collections of permission grants with explicit `allow` or `deny` effects.
* **Roles:** Composite roles containing one or more profiles, assignable to users.
* **User Groups:** Logical grouping for users (e.g. departments, teams) used for team management and cross-group sharing rules.
* **Sharing Rules:** Granular cross-group record access policies that define read or read-write access between groups.
* **Company & Organization Management:** Centralized company profile management (branding logo, GSTIN, fiscal year, address, and localized preferences).

---

### 2. Optimistic Concurrency Control (OCC)
* Prevents **lost updates** and race conditions when multiple administrators edit the same record concurrently.
* Every mutable entity (`organizations`, `users`, `roles`, `profiles`, `groups`, `sharing_rules`, `smtp_config`) enforces an integer `version` counter and `updated_at` timestamp.
* Database updates enforce `WHERE id = $1 AND version = $2` conditions. If a version mismatch occurs, the engine throws a `ConcurrentModificationError`, returning an **`HTTP 409 Conflict`** response and triggering conflict resolution notifications on the frontend.

---

### 3. Comprehensive Audit Trail & Governance
* Immutable audit logging (`audit_logs`) tracking actor ID, action type, entity type, entity ID, previous state snapshot, new state snapshot, IP address, and timestamp.
* Seamless audit context propagation via Express middleware (`injectAuditContext.middleware.ts`).

---

### 4. Enterprise Security & Session Management
* **Cookie-Based Sessions:** Signed, secure HTTP-only cookies with configurable TTL and multi-device session revocation.
* **Password Hashing:** `bcrypt` with work factors and brute-force lockout safeguards.
* **Encryption Utilities:** AES-256 encryption for sensitive secrets (e.g. SMTP credentials) and HMAC verification.
* **Tiered Rate Limiting:** Dedicated rate limiters for authentication endpoints, strict action routes, and general APIs.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Runtime** | Node.js, Express.js 5.x, TypeScript |
| **Data & Persistence** | PostgreSQL, `pg-promise` (transactions), `knex` (migrations) |
| **Security & Auth** | `bcrypt`, `cookie-parser`, `express-rate-limit`, crypto HMAC/AES |
| **Frontend UI** | React 18, TypeScript, Vite, TailwindCSS, Radix UI Primitives |
| **State & Data Fetching**| TanStack React Query v5, React Router v7, Axios, Lucide Icons, Sonner |

---

## Project Structure

```text
rbac-framework/
├── backend/
│   ├── migrations/               # Knex database schema migrations (17 steps)
│   ├── src/
│   │   ├── config.ts             # Centralized typed environment & limits configuration
│   │   ├── db.ts                 # PostgreSQL connection pool and pg-promise instance
│   │   ├── server.ts             # Express application entry point & middleware chain
│   │   ├── rbac/
│   │   │   ├── dto/              # Request & Response Data Transfer Objects
│   │   │   ├── errors/           # Custom typed errors (RBACError, ConcurrencyError, etc.)
│   │   │   ├── middleware/       # Auth, rate limiting, audit context, error handler
│   │   │   ├── models/           # Typed domain entity interfaces with versioning
│   │   │   ├── repositories/     # Database queries & optimistic locking logic
│   │   │   ├── routes/           # REST endpoint routers for all RBAC resources
│   │   │   ├── services/         # Core business logic & authorization evaluation
│   │   │   ├── types/            # Repository interfaces & query contracts
│   │   │   └── utils/            # Crypto, token generation, and audit utilities
│   │   ├── scripts/              # Database seed and reset automation scripts
│   │   └── utils/                # Transaction wrapper (`withTransaction`)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── core/                 # Core API client, layout, sidebar, headers
│   │   ├── pages/                # Authentication, Dashboard, and Unauthorized pages
│   │   ├── plugins/              # Pluggable RBAC management views (Users, Roles, Groups, etc.)
│   │   ├── shared/               # Reusable UI components (Dialogs, Buttons, Tables, ErrorBoundary)
│   │   ├── router.tsx            # Protected client-side routing definitions
│   │   └── main.tsx              # App bootstrap with QueryClient & theme providers
│   └── package.json
│
├── .gitignore                    # Root ignore rules for build artifacts & secrets
└── README.md
```

---

## Getting Started

### Prerequisites
* **Node.js**: `v18.x` or higher (`v20+` recommended)
* **PostgreSQL**: `v14+` running locally or accessible via network

---

### Step 1: Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your local environment file:
   ```bash
   cp .env.example .env
   ```
   *Configure your `DATABASE_URL`, `COOKIE_SECRET`, and `SESSION_SECRET` in `backend/.env`.*

4. Run database migrations:
   ```bash
   npm run migrate
   ```

5. Seed initial data (Admin user, default Organization profile, Modules, Permissions, and Roles):
   ```bash
   npm run seed
   ```

6. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The API will start at `http://localhost:3001`.*

---

### Step 2: Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the frontend environment file:
   ```bash
   cp .env.example .env
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The application will be accessible at `http://localhost:5173` (or port assigned by Vite).*

---

## Default Seed Credentials

After running `npm run seed`, you can sign in with the following default accounts:

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `admin123` | Full administrative access to all RBAC settings, users, audit logs, and security controls. |
| **Standard User** | `user` | `user123` | Limited access based on standard user profile permissions. |

---

## Core API Endpoints

All authenticated RBAC endpoints are mounted under `/v1/rbac/*`:

| Resource | Base Path | Key Capabilities |
| :--- | :--- | :--- |
| **Auth & Sessions** | `/v1/rbac/sessions` | Session listing, active session inspection, remote session revocation. |
| **Public Auth / OTP**| `/v1/auth/otp` | OTP generation, validation, password reset flows. |
| **Users** | `/v1/rbac/users` | User CRUD, role assignments, profile overrides, status toggles. |
| **Roles** | `/v1/rbac/roles` | Role definitions, profile bundling, user bindings. |
| **Profiles** | `/v1/rbac/profiles` | Fine-grained permission bundle management. |
| **Permissions** | `/v1/rbac/permissions` | Module-action permission matrices and catalog queries. |
| **Groups** | `/v1/rbac/groups` | User grouping, group-level role assignment. |
| **Sharing Rules** | `/v1/rbac/sharing-rules` | Cross-group granular record visibility and access policies. |
| **Organizations** | `/v1/rbac/organizations` | Company profile settings, branding metadata, contact configurations. |
| **Audit Logs** | `/v1/rbac/audit-logs` | Chronological, filterable security and activity logs. |
| **SMTP Config** | `/v1/rbac/smtpconfig` | Secure email server connection and notification credentials. |

---

## Quality & Build Verification

To verify type safety and build integrity across both workspaces:

```bash
# Run Backend Automated Test Suite
cd backend
npm test

# Verify Backend Type Safety & Build
npm run build

# Verify Frontend Lint & Build
cd ../frontend
npm run lint
npm run build
```

---

## License
ISC
