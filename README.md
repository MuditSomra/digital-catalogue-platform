# 🍳 Kitchen Appliance Digital Showroom & Inventory Management

> **Phase 1 Foundation**: Project infrastructure, database modeling, Prisma schema, Supabase PostgreSQL configuration, seed data, Zod validation schemas, and health check endpoint.

---

## 📋 Table of Contents

- [Project Purpose](#-project-purpose)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Supabase Configuration](#-supabase-configuration)
- [Environment Variables](#-environment-variables)
- [Database Migrations & Seeding](#-database-migrations--seeding)
- [Running the Application](#-running-the-application)
- [Verifying Health Check Endpoint](#-verifying-health-check-endpoint)
- [Database Architecture & Design](#-database-architecture--design)
- [Intentionally Out of Scope (Phase 1)](#-intentionally-out-of-scope-phase-1)

---

## 🎯 Project Purpose

This application is built for a kitchen equipment/appliance retail business. The digital platform will ultimately serve two primary user groups:
1. **Customers**: An interactive digital catalogue showroom with dynamic filtering across appliance categories and specifications.
2. **Store Staff & Administrators**: An inventory and pricing management back-office system with real-time stock movement audit logging and private dealer price codes.

**Phase 1** establishes the clean architectural foundation, generic relational database schema, dynamic category-attribute system, seed data (strictly excluding refrigeration), and development workflow.

---

## 🛠 Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) | React 19 server/client components and API routes |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Full type safety across models and validation schemas |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) | Custom dark mode design tokens and utilities |
| **ORM** | [Prisma 6](https://www.prisma.io/) | Schema definition, migrations, and type-safe database queries |
| **Database** | [Supabase PostgreSQL](https://supabase.com/) | Managed PostgreSQL with connection pooling support |
| **Validation** | [Zod 3](https://zod.dev/) | Runtime schema validation for requests and models |
| **Icons** | [Lucide React](https://lucide.dev/) | Consistent, clean icon set |

---

## ⚡ Prerequisites

Ensure you have the following installed on your development machine:
- **Node.js**: v18.18+ or v20+ / v22+ (tested on Node v24)
- **npm**: v10+ or v11+
- **Supabase Account / PostgreSQL Database**: A Supabase project (or local PostgreSQL instance)

---

## 📦 Installation & Setup

1. **Clone or open the repository**:
   ```bash
   cd c:\Business\Shop
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

---

## 🗄 Supabase Configuration

To connect the application to Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. Navigate to **Project Settings** &rarr; **Database**.
3. Under **Connection string**:
   - **Transaction Pooler (Port 6543)**: Use this for `DATABASE_URL` (optimizes connections in serverless/Next.js environments).
   - **Direct Connection (Port 5432)**: Use this for `DIRECT_URL` (used for Prisma migrations and CLI operations).

---

## 🔐 Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure the variables in `.env`:
   ```env
   # Transaction-pooled connection for runtime queries (Supabase Port 6543)
   DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

   # Direct connection for Prisma migrations (Supabase Port 5432)
   DIRECT_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"

   NODE_ENV="development"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

---

## 🚀 Database Migrations & Seeding

### 1. Apply Database Schema
To push the schema directly to your Supabase PostgreSQL instance:
```bash
npm run prisma:push
```
*Or to generate and track SQL migration files:*
```bash
npm run prisma:migrate
```

### 2. Seed the Database
Populate the database with the predefined category tree, starter dynamic attributes, sample brands, test products, and initial inventory audit movements:
```bash
npm run seed
```

#### What gets seeded?
- **Root Category**: `Kitchen Appliances`
- **28 Generic Categories** across 3 levels:
  - `Cooking Appliances` &rarr; Gas Stoves, Gas Hobs, Built-in Hobs, Induction Cooktops, Electric Cooktops, Microwave Ovens (Solo, Grill, Convection), OTG Ovens, Air Fryers
  - `Kitchen Ventilation` &rarr; Kitchen Chimneys, Exhaust Fans
  - `Food Preparation` &rarr; Mixer Grinders, Juicers, Cold Press Juicers, Food Processors, Hand Blenders, Choppers, Hand Mixers
  - `Water Appliances` &rarr; Water Purifiers, Water Dispensers, Electric Kettles
  - `Dishwashing` &rarr; Dishwashers
  - `Kitchen Accessories` &rarr; Gas Accessories, Chimney Accessories, Appliance Accessories
  - ⚠️ **Zero Refrigeration categories exist** (strictly excluded per requirements).
- **Dynamic Category Attributes**:
  - **Gas Stoves**: Burner Count (2, 3, 4, 5), Cooktop Material (Glass, Stainless Steel), Ignition (Manual, Automatic), Burner Material, Gas Type, Installation Type.
  - **Chimneys**: Width, Suction Capacity, Filter Type, Control Type, Auto Clean, Mount Type.
  - **Microwaves**: Type, Capacity, Power, Control Type, Child Lock.
  - **Mixer Grinders**: Motor Power, Number of Jars, Jar Material, Speed Settings, Pulse Function.
- **Sample Brands**: Prestige, Faber, Bosch, Philips, Glen, Elica.
- **Sample Products**: Includes products specifically targeted for multi-attribute filtering tests (e.g. *Prestige Royale Plus 3-Burner Auto Stainless Steel Gas Stove*).
- **Inventory & Movement Records**: Initial stock counts and audited `PURCHASE` movement logs with timestamps and administrator attribution.

---

## 💻 Running the Application

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Typecheck & Production Build
```bash
npm run typecheck
npm run build
```

---

## 🩺 Verifying Health Check Endpoint

The application provides a dedicated health check endpoint at:
`GET /api/health`

### Example Response (`200 OK`):
```json
{
  "status": "ok",
  "timestamp": "2026-09-23T16:00:00.000Z",
  "uptime": 42,
  "environment": "development",
  "database": {
    "connected": true,
    "latencyMs": 12
  },
  "version": "1.0.0-phase1"
}
```

If the database is unreachable, the endpoint returns `503 Service Unavailable` with `status: "degraded"` and sanitizes error details without exposing sensitive credentials.

---

## 🏛 Database Architecture & Design

### Relational Model Summary

```mermaid
erDiagram
    Category ||--o{ Category : "parent / children"
    Category ||--o{ CategoryAttribute : "has attributes"
    Category ||--o{ Product : "categorizes"
    CategoryAttribute ||--o{ AttributeValue : "predefined options"
    CategoryAttribute ||--o{ ProductAttributeValue : "specifies"
    Brand ||--o{ Product : "manufactures"
    Product ||--o{ ProductAttributeValue : "has attributes"
    Product ||--o{ ProductImage : "has gallery"
    Product ||--o{ ProductVideo : "has video embeds"
    Product ||--|| Inventory : "tracks stock"
    Product ||--o{ InventoryMovement : "audit log"
    AdminUser ||--o{ InventoryMovement : "author of movement"
```

### Key Architectural Highlights:
1. **Generic Category Hierarchy**:
   - Uses a self-referencing `parentId` foreign key.
   - Allows arbitrary nesting depth without hardcoding table names.
2. **Dynamic Attribute Architecture**:
   - Appliance specifications (burner count, suction capacity, etc.) are never hardcoded as columns on `Product`.
   - `CategoryAttribute` defines dynamic schema per category.
   - `ProductAttributeValue` stores relational values with indexed text, numeric, and boolean representations for high-performance filtering.
3. **Dual Pricing & Private Codes**:
   - `mrp` is required.
   - `sellingPrice` is optional.
   - `privatePriceCode` is stored separately for dealer/internal reference and never exposed in customer views.
   - Percentage discount is dynamically calculated via `((mrp - sellingPrice) / mrp) * 100`.
4. **Stock Movement Audit Trail**:
   - In addition to current stock in `Inventory`, every stock modification creates an immutable `InventoryMovement` record (`PURCHASE`, `SALE`, `DAMAGED`, `RETURN`, `ADJUSTMENT`).

---

## 🚫 Intentionally Out of Scope (Phase 1)

As specified in the project roadmap, the following features belong to later phases and are intentionally NOT implemented in Phase 1:
- ❌ Customer-facing catalogue browsing UI
- ❌ Admin management dashboard and interactive UI
- ❌ Product creation, edit, and deletion forms
- ❌ Media / Cloudinary file upload UI
- ❌ Customer cart, checkout, or payment gateway
- ❌ Customer authentication UI

---

## 📂 Project Directory Structure

```
c:\Business\Shop/
├── prisma/
│   ├── schema.prisma         # Complete relational Prisma schema (11 models)
│   └── seed.ts               # Comprehensive seed script (hierarchy, attributes, products)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── health/
│   │   │       └── route.ts  # Health check & database latency endpoint
│   │   ├── globals.css       # Design tokens & dark mode styling
│   │   ├── layout.tsx        # Root HTML layout & Inter font
│   │   └── page.tsx          # Phase 1 foundation dashboard & status page
│   ├── lib/
│   │   ├── prisma.ts         # Singleton Prisma client for Next.js
│   │   └── utils.ts          # Class merging (cn) & pricing utilities
│   ├── types/
│   │   └── index.ts          # Shared TypeScript type definitions
│   └── validations/          # Zod validation schemas
│       ├── admin.ts
│       ├── attribute.ts
│       ├── brand.ts
│       ├── category.ts
│       ├── index.ts
│       ├── inventory.ts
│       └── product.ts
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore patterns
├── components.json           # shadcn/ui configuration
├── next.config.ts            # Next.js configuration
├── package.json              # Project dependencies & npm scripts
├── postcss.config.mjs        # PostCSS configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript compiler configuration
└── README.md                 # Project documentation
```
