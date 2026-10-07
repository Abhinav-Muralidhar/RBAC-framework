# RBAC Framework - Frontend Web Application

The frontend administration portal for the RBAC Framework, built with React, Vite, TypeScript, and TailwindCSS.

---

## Features

- **Dashboard & Resource Management:** Comprehensive interfaces for managing Users, Roles, Profiles, Groups, and Sharing Rules.
- **Optimistic Concurrency Feedback:** Integrated conflict resolution toasts (`sonner`) that alert administrators if records were modified simultaneously by another session.
- **Tenant & Branding Controls:** Organization settings management including logo upload, address, and contact details.
- **Audit Log Explorer:** Filterable audit logging views displaying user activity, actor metadata, and before/after changes.
- **Session Control:** Active session inspection with one-click remote session revocation.

---

## Tech Stack

- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** TailwindCSS with CSS variables & dark/light theme support
- **UI Components:** Radix UI primitives & Lucide Icons
- **Data Fetching:** TanStack React Query v5 with Axios client
- **Routing:** React Router v7

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Ensure `VITE_API_URL` points to your active backend server (default: `http://localhost:3001`).

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

### 5. Lint
```bash
npm run lint
```
