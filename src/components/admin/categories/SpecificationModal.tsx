"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import {
  AttributeType,
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPE_DESCRIPTIONS,
} from "@/types";

interface SpecificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    categoryId: string;
    name: string;
    type: AttributeType;
    unit: string | null;
    isFilterable: boolean;
    isRequired: boolean;
    initialOptions?: string[];
  }) => Promise<void>;
  attributeToEdit?: {
    id: string;
    name: string;
    type: AttributeType;
    unit: string | null;
    isFilterable: boolean;
    isRequired: boolean;
  } | null;
  categoryId: string;
  categoryName?: string;
}

export function SpecificationModal({
  isOpen,
  onClose,
  onSave,
  attributeToEdit,
  categoryId,
  categoryName,
}: SpecificationModalProps) {
  const isEditing = Boolean(attributeToEdit);
  const [name, setName] = useState("");
  const [type, setType] = useState<AttributeType>(AttributeType.SELECT);
  const [unit, setUnit] = useState("");
  const [isFilterable, setIsFilterable] = useState(true);
  const [isRequired, setIsRequired] = useState(false);
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (attributeToEdit) {
        setName(attributeToEdit.name);
        setType(attributeToEdit.type);
        setUnit(attributeToEdit.unit || "");
        setIsFilterable(attributeToEdit.isFilterable);
        setIsRequired(attributeToEdit.isRequired);
        setOptionsList([]);
        setNewOptionInput("");
      } else {
        setName("");
        setType(AttributeType.SELECT);
        setUnit("");
        setIsFilterable(true);
        setIsRequired(false);
        setOptionsList([""]);
        setNewOptionInput("");
      }
    }
  }, [isOpen, attributeToEdit]);

  const handleAddOption = () => {
    if (newOptionInput.trim()) {
      if (!optionsList.includes(newOptionInput.trim())) {
        setOptionsList((prev) => [...prev.filter((o) => o.trim() !== ""), newOptionInput.trim()]);
      }
      setNewOptionInput("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptionsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    setOptionsList((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a specification name.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const cleanedOptions = optionsList.map((o) => o.trim()).filter(Boolean);

      await onSave({
        id: attributeToEdit?.id,
        categoryId,
        name: name.trim(),
        type,
        unit: unit.trim() || null,
        isFilterable,
        isRequired,
        initialOptions: !isEditing && (type === AttributeType.SELECT || type === AttributeType.MULTI_SELECT)
          ? cleanedOptions
          : undefined,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save specification.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isOptionType = type === AttributeType.SELECT || type === AttributeType.MULTI_SELECT;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Specification" : "Add Specification"}
      description={
        isEditing
          ? `Update specification properties for "${categoryName || "this category"}".`
          : `Define a new dynamic specification for products under "${categoryName || "this category"}".`
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Specification Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Specification Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Burner Count, Cooktop Material, Motor Power"
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
            required
            autoFocus
          />
        </div>

        {/* Specification Type */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">
            Type <span className="text-rose-400">*</span>
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AttributeType)}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          >
            {Object.entries(ATTRIBUTE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label} — {ATTRIBUTE_TYPE_DESCRIPTIONS[key as AttributeType]}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
            {ATTRIBUTE_TYPE_DESCRIPTIONS[type]}
          </p>
        </div>

        {/* Unit (Optional) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Measurement Unit</span>
            <span className="text-[11px] font-normal text-muted-foreground">Optional</span>
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. Watts, cm, Litres, m³/hr, Burners"
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Initial Options (when creating new select type) */}
        {!isEditing && isOptionType && (
          <div className="space-y-2 p-3.5 rounded-xl bg-muted/20 border border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Options / Choices
              </label>
              <span className="text-[11px] text-muted-foreground">
                You can also add or reorder options anytime later
              </span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {optionsList.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1} (e.g. ${idx === 0 ? "2 Burner" : idx === 1 ? "3 Burner" : "4 Burner"})`}
                    className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {optionsList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      aria-label="Remove option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOptionsList((prev) => [...prev, ""])}
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another option field
            </button>
          </div>
        )}

        {/* Checkbox settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isFilterable}
              onChange={(e) => setIsFilterable(e.target.checked)}
              className="w-4 h-4 rounded mt-0.5 text-primary border-border bg-background focus:ring-primary/40"
            />
            <div>
              <div className="text-xs font-semibold text-foreground">
                Show as customer filter
              </div>
              <div className="text-[11px] text-muted-foreground">
                Allow customers to filter and search products in this category by this specification.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-4 h-4 rounded mt-0.5 text-primary border-border bg-background focus:ring-primary/40"
            />
            <div>
              <div className="text-xs font-semibold text-foreground">
                Required when adding a product
              </div>
              <div className="text-[11px] text-muted-foreground">
                Staff must fill in this specification whenever creating a product in this category.
              </div>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{isEditing ? "Save Changes" : "Save Specification"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
