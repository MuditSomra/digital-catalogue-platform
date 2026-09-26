"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Scale,
  ArrowLeft,
  X,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  ShieldCheck,
  Search,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";
import { ShowroomHeader } from "@/components/showroom/ShowroomHeader";
import type { CatalogueProductItem } from "@/types";

function ProductComparisonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [productIds, setProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<CatalogueProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogueProductItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      setProductIds(ids);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    async function fetchComparedProducts() {
      try {
        setLoading(true);
        const fetched: CatalogueProductItem[] = [];

        await Promise.all(
          productIds.slice(0, 3).map(async (id) => {
            const res = await fetch(`/api/catalogue/products/${id}`);
            const json = await res.json();
            if (json.success && json.data) {
              fetched.push(json.data);
            }
          })
        );

        // Sort to preserve original order
        fetched.sort((a, b) => productIds.indexOf(a.id) - productIds.indexOf(b.id));
        setProducts(fetched);
      } catch (err) {
        console.error("Failed to load products for comparison:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchComparedProducts();
  }, [productIds]);

  // Search for products to add to comparison
  useEffect(() => {
    if (!addSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(
          `/api/catalogue/products?search=${encodeURIComponent(addSearch.trim())}&limit=6`
        );
        const json = await res.json();
        if (json.success && json.data?.products) {
          // Exclude already added products
          setSearchResults(
            json.data.products.filter((p: CatalogueProductItem) => !productIds.includes(p.id))
          );
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [addSearch, productIds]);

  const removeProduct = (idToRemove: string) => {
    const updated = productIds.filter((id) => id !== idToRemove);
    setProductIds(updated);
    if (updated.length > 0) {
      router.push(`/compare?ids=${updated.join(",")}`);
    } else {
      router.push("/compare");
    }
  };

  const addProduct = (productToAdd: CatalogueProductItem) => {
    if (productIds.length >= 3) return;
    const updated = [...productIds, productToAdd.id];
    setProductIds(updated);
    setIsAddModalOpen(false);
    setAddSearch("");
    router.push(`/compare?ids=${updated.join(",")}`);
  };

  // Collect all unique specification attribute names across all compared products
  const allAttributesMap = new Map<string, { name: string; unit: string | null }>();
  for (const prod of products) {
    for (const spec of prod.attributeValues) {
      if (!allAttributesMap.has(spec.attributeSlug)) {
        allAttributesMap.set(spec.attributeSlug, {
          name: spec.attributeName,
          unit: spec.unit,
        });
      }
    }
  }
  const allAttributeSlugs = Array.from(allAttributesMap.keys());

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <ShowroomHeader comparedCount={products.length} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                <span>Product Comparison</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Compare prices, features, and specifications side-by-side.
              </p>
            </div>
          </div>

          {products.length < 3 && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product ({products.length}/3)</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs text-slate-500">Loading products for comparison...</div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-2xs max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto">
              <Scale className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Products Selected</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Select 2 to 3 kitchen appliances from the showroom catalogue to compare them side-by-side.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs"
            >
              <span>Browse Showroom Catalogue</span>
            </Link>
          </div>
        ) : (
          /* Side-by-Side Comparison Matrix */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                {/* Header Row: Products Header */}
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="p-4 sm:p-5 w-1/4 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Feature / Appliance
                    </th>
                    {products.map((p) => (
                      <th key={p.id} className="p-4 sm:p-5 w-1/4 align-top">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                              {p.brand.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeProduct(p.id)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-200 transition"
                              title="Remove from comparison"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div
                            className="relative w-full aspect-[4/3] bg-slate-100/70 rounded-xl overflow-hidden border border-slate-200/60 shrink-0"
                            style={{ aspectRatio: "4 / 3", width: "100%" }}
                          >
                            {p.primaryImage ? (
                              <img
                                src={p.primaryImage.url}
                                alt={p.name}
                                className="absolute inset-0 w-full h-full object-contain p-2"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                <Package className="w-10 h-10" />
                              </div>
                            )}
                          </div>

                          <div>
                            <Link
                              href={`/products/${p.id}`}
                              className="text-xs sm:text-sm font-bold text-slate-900 hover:text-blue-600 line-clamp-2 leading-snug transition"
                            >
                              {p.name}
                            </Link>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {p.category.name}
                            </div>
                          </div>
                        </div>
                      </th>
                    ))}
                    {products.length < 3 && (
                      <th className="p-4 sm:p-5 w-1/4 align-middle text-center bg-slate-50/40 border-l border-dashed border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                          className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 transition flex flex-col items-center gap-2 mx-auto"
                        >
                          <Plus className="w-6 h-6" />
                          <span className="text-xs font-bold">Add Product</span>
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {/* Price Row */}
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900 bg-slate-50/30">Price</td>
                    {products.map((p) => (
                      <td key={p.id} className="p-4">
                        <div className="space-y-0.5">
                          <span className="text-base font-extrabold text-slate-900">
                            ₹{(p.sellingPrice ?? p.mrp).toLocaleString("en-IN")}
                          </span>
                          {p.sellingPrice && p.sellingPrice < p.mrp && (
                            <div className="text-[11px] text-slate-400 line-through">
                              MRP ₹{p.mrp.toLocaleString("en-IN")}
                            </div>
                          )}
                          {p.discountPercent !== null && p.discountPercent > 0 && (
                            <div className="text-[10px] font-bold text-emerald-700">
                              {p.discountPercent}% OFF
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                    {products.length < 3 && <td className="bg-slate-50/20" />}
                  </tr>

                  {/* Stock Availability */}
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900 bg-slate-50/30">Stock Availability</td>
                    {products.map((p) => {
                      const isOut = p.inventory.stockStatus === "OUT_OF_STOCK";
                      const isLow = p.inventory.stockStatus === "LOW_STOCK";
                      return (
                        <td key={p.id} className="p-4">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <XCircle className="w-3.5 h-3.5" /> Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                              <AlertTriangle className="w-3.5 h-3.5" /> Low Stock ({p.inventory.quantity})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> In Stock ({p.inventory.quantity} units)
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {products.length < 3 && <td className="bg-slate-50/20" />}
                  </tr>

                  {/* Customer-Visible Price Code */}
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900 bg-slate-50/30">Price Code</td>
                    {products.map((p) => (
                      <td key={p.id} className="p-4 font-mono font-semibold text-slate-600">
                        {p.privatePriceCode || "—"}
                      </td>
                    ))}
                    {products.length < 3 && <td className="bg-slate-50/20" />}
                  </tr>

                  {/* Model Number */}
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900 bg-slate-50/30">Model Number</td>
                    {products.map((p) => (
                      <td key={p.id} className="p-4 font-mono text-slate-600">
                        {p.modelNumber || "—"}
                      </td>
                    ))}
                    {products.length < 3 && <td className="bg-slate-50/20" />}
                  </tr>

                  {/* Warranty */}
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900 bg-slate-50/30">Warranty</td>
                    {products.map((p) => (
                      <td key={p.id} className="p-4 text-slate-700">
                        {p.warranty || "Standard Brand Warranty"}
                      </td>
                    ))}
                    {products.length < 3 && <td className="bg-slate-50/20" />}
                  </tr>

                  {/* Dynamic Category Specifications Section Header */}
                  <tr className="bg-slate-100/80 border-t-2 border-slate-200">
                    <td
                      colSpan={products.length + (products.length < 3 ? 2 : 1)}
                      className="p-3 px-4 font-extrabold text-xs uppercase tracking-wider text-slate-700"
                    >
                      Specifications Matrix
                    </td>
                  </tr>

                  {/* Dynamic Specs Rows */}
                  {allAttributeSlugs.length > 0 ? (
                    allAttributeSlugs.map((slug) => {
                      const attrDef = allAttributesMap.get(slug);
                      return (
                        <tr key={slug} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 font-semibold text-slate-800 bg-slate-50/30">
                            <span>{attrDef?.name}</span>
                            {attrDef?.unit && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({attrDef.unit})
                              </span>
                            )}
                          </td>
                          {products.map((p) => {
                            const spec = p.attributeValues.find((av) => av.attributeSlug === slug);
                            return (
                              <td key={p.id} className="p-4 font-medium">
                                {spec ? (
                                  <span className="font-bold text-slate-900">
                                    {spec.value} {spec.unit || ""}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                          {products.length < 3 && <td className="bg-slate-50/20" />}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={products.length + (products.length < 3 ? 2 : 1)}
                        className="p-4 text-center text-xs text-slate-400 italic"
                      >
                        No unique dynamic specifications found for compared categories.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150 text-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Add Appliance to Compare</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search by name, brand, model or SKU..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {searching ? (
                <div className="text-center py-6 text-xs text-slate-400">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => addProduct(item)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3">
                      {item.primaryImage ? (
                        <img
                          src={item.primaryImage.url}
                          alt={item.name}
                          className="w-10 h-10 object-contain rounded bg-white p-1 border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-xs">
                          📦
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-900 truncate max-w-xs">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.brand.name} &bull; ₹{(item.sellingPrice ?? item.mrp).toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      Add
                    </button>
                  </div>
                ))
              ) : addSearch.trim() ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No matching appliances found.
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Type a product or brand name above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductComparisonPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
          Loading comparison...
        </div>
      }
    >
      <ProductComparisonContent />
    </Suspense>
  );
}
