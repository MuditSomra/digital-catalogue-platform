"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface OptionItem {
  id: string;
  attributeId: string;
  value: string;
  label: string;
  sortOrder: number;
}

interface OptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  specification: {
    id: string;
    name: string;
    type: string;
    predefinedValues: OptionItem[];
  } | null;
  onAddOption: (attributeId: string, value: string, label: string) => Promise<void>;
  onUpdateOption: (optionId: string, value: string, label: string) => Promise<void>;
  onDeleteOption: (optionId: string) => Promise<void>;
  onReorderOptions: (items: { id: string; sortOrder: number }[]) => Promise<void>;
}

export function OptionsModal({
  isOpen,
  onClose,
  specification,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onReorderOptions,
}: OptionsModalProps) {
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!specification) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await onAddOption(
        specification.id,
        newValue.trim(),
        newLabel.trim() || newValue.trim()
      );
      setNewValue("");
      setNewLabel("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to add option.");
      }
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (opt: OptionItem) => {
    setEditingId(opt.id);
    setEditValue(opt.value);
    setEditLabel(opt.label);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setEditLabel("");
  };

  const saveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    try {
      setLoading(true);
      setError(null);
      await onUpdateOption(id, editValue.trim(), editLabel.trim() || editValue.trim());
      setEditingId(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update option.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await onDeleteOption(id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete option.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const list = [...specification.predefinedValues];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const payload = list.map((item, idx) => ({
      id: item.id,
      sortOrder: idx + 1,
    }));

    try {
      setLoading(true);
      setError(null);
      await onReorderOptions(payload);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to reorder options.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Options: ${specification.name}`}
      description="Add, edit, reorder, or remove choices for this specification."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Add New Option Form */}
        <form
          onSubmit={handleAdd}
          className="p-3.5 rounded-xl bg-muted/20 border border-border space-y-3"
        >
          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Add New Option</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Option Value <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => {
                  setNewValue(e.target.value);
                  if (!newLabel || newLabel === newValue) {
                    setNewLabel(e.target.value);
                  }
                }}
                placeholder="e.g. 3 Burner, Stainless Steel"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Display Label <span className="text-muted-foreground text-[10px]">(Optional)</span>
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Defaults to value"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !newValue.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Option</span>
            </button>
          </div>
        </form>

        {/* Existing Options List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Current Options ({specification.predefinedValues.length})</span>
            <span>Reorder & Actions</span>
          </div>

          {specification.predefinedValues.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border text-muted-foreground text-xs">
              No options defined yet. Add your first option above.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {specification.predefinedValues.map((opt, index) => (
                <div
                  key={opt.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs gap-2 group hover:border-border/80 transition"
                >
                  {editingId === opt.id ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 mr-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="px-2.5 py-1 bg-background border border-border rounded text-xs text-foreground focus:ring-1 focus:ring-primary"
                        placeholder="Value"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="px-2.5 py-1 bg-background border border-border rounded text-xs text-foreground focus:ring-1 focus:ring-primary"
                        placeholder="Label"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                        {index + 1}
                      </span>
                      <div className="truncate">
                        <span className="font-semibold text-foreground mr-1.5">
                          {opt.label}
                        </span>
                        {opt.value !== opt.label && (
                          <span className="text-muted-foreground text-[11px]">
                            ({opt.value})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions & Reordering */}
                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === opt.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(opt.id)}
                          disabled={loading}
                          className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                          title="Save option"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0 || loading}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={index === specification.predefinedValues.length - 1 || loading}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(opt)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                          title="Edit label"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(opt.id)}
                          disabled={loading}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete option"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
