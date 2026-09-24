import Link from "next/link";
import {
  Layers,
  Database,
  Activity,
  Boxes,
  ShieldCheck,
  Cpu,
  Tag,
  SlidersHorizontal,
  FileCode2,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

export default function Home() {
  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header Banner */}
      <header className="space-y-4 border-b border-border pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Boxes className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Kitchen Appliance Digital Showroom
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Phase 1: Architecture, Relational Database & Foundation Layer
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Phase 2 Active
            </span>
            <Link
              href="/admin/categories"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              Admin Categories
              <ArrowUpRight className="w-3 h-3" />
            </Link>
            <Link
              href="/api/health"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition border border-border"
              target="_blank"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              API Health
              <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </header>

      {/* System Status & Key Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Framework</span>
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold">Next.js 15 App Router</div>
          <p className="text-xs text-muted-foreground">TypeScript, Tailwind CSS & Zod</p>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">ORM & Database</span>
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold">Prisma ORM</div>
          <p className="text-xs text-muted-foreground">Supabase PostgreSQL Pooling</p>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Category Hierarchy</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold">28 Generic Categories</div>
          <p className="text-xs text-emerald-400">Strictly 0 Refrigeration</p>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Data Integrity</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold">11 Core Models</div>
          <p className="text-xs text-muted-foreground">Full Indexing & Audit Trails</p>
        </div>
      </section>

      {/* Architectural Pillars */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <FileCode2 className="w-5 h-5 text-primary" />
          Implemented Database Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold">Generic Category Model</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Self-referencing tree structure supporting arbitrary depth (Root → Cooking Appliances → Microwave Ovens → Convection). Fully customizable by admin.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold">Dynamic Category Attributes</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Decoupled schema supporting SELECT, MULTI_SELECT, TEXT, NUMBER, BOOLEAN, and RANGE attributes with units, indexing, and predefined values.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary">
              <Tag className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold">Product & Pricing Engine</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mandatory MRP, optional Selling Price, and secure Private Price Codes. Dynamic discount calculations without storing redundant fields.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary">
              <Boxes className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold">Inventory & Audit Trail</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time stock quantities, low-stock thresholds, and immutable InventoryMovement records (PURCHASE, SALE, DAMAGED, RETURN, ADJUSTMENT).
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold">Admin Authentication Ready</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Structured for Supabase Auth integration or standalone credentials with granular role-based permissions (SUPER_ADMIN, ADMIN, STAFF).
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border space-y-3">
            <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold">Multi-Media Modeling</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Relational support for multi-image galleries (Cloudinary-ready) and multi-provider video embeds (YouTube / Cloudinary).
            </p>
          </div>
        </div>
      </section>

      {/* Seeding & Verification Summary */}
      <section className="p-6 rounded-xl bg-card/60 border border-border space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Starter Seed Verification Checklist
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Root Category: Kitchen Appliances (28 subcategories)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Refrigeration verification: Zero refrigeration records</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Gas Stove test target: 3 Burner + Stainless Steel + Auto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Chimneys, Microwaves & Food Prep attributes seeded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Starter brands: Prestige, Faber, Bosch, Philips, Glen, Elica</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Initial inventory movements created with audit trail</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-6 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-4">
        <div>Kitchen Appliance Digital Showroom &bull; Phase 1 Foundation</div>
        <div>Ready for Phase 2: Category Management & Admin Services</div>
      </footer>
    </main>
  );
}
