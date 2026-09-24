import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Layers,
  SlidersHorizontal,
  Package,
  Store,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Tag,
  Boxes,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [
    categoryCount,
    attributeCount,
    productCount,
    brandCount,
    optionCount,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.categoryAttribute.count(),
    prisma.product.count(),
    prisma.brand.count(),
    prisma.attributeValue.count(),
  ]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Store className="w-3.5 h-3.5" />
              <span>Digital Showroom Administration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome to Showroom Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Manage your store catalogue, dynamic product specifications, customer filter options, and inventory structure without needing code or technical knowledge.
            </p>
          </div>

          <Link
            href="/admin/categories"
            className="px-5 py-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-md flex items-center gap-2"
          >
            <span>Manage Categories & Specs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Catalogue Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Categories</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-foreground">{categoryCount}</div>
          <p className="text-[11px] text-muted-foreground">Arbitrary depth hierarchy</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Dynamic Specs</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-foreground">{attributeCount}</div>
          <p className="text-[11px] text-muted-foreground">{optionCount} Predefined choices</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Showroom Products</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-foreground">{productCount}</div>
          <p className="text-[11px] text-muted-foreground">Phase 3 Management</p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Partner Brands</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-foreground">{brandCount}</div>
          <p className="text-[11px] text-muted-foreground">Prestige, Faber, Bosch & more</p>
        </div>
      </div>

      {/* Quick Access Card */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>Quick Actions</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/products"
            className="p-4 rounded-xl bg-background border border-border hover:border-primary/40 transition group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm text-foreground group-hover:text-primary transition flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span>Showroom Products</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create, edit, view, search, and manage products with dynamic category specifications.
            </p>
          </Link>

          <Link
            href="/admin/categories"
            className="p-4 rounded-xl bg-background border border-border hover:border-primary/40 transition group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm text-foreground group-hover:text-primary transition flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span>Categories & Hierarchy</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add new categories, rearrange subcategory trees, rename sections, or adjust visibility.
            </p>
          </Link>

          <Link
            href="/admin/categories"
            className="p-4 rounded-xl bg-background border border-border hover:border-primary/40 transition group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm text-foreground group-hover:text-primary transition flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <span>Specifications & Filters</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Configure attributes like Burners, Material, Suction Capacity, and manage choices used for customer filters.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
