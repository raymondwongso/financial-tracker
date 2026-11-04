"use client";

import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Modal } from "./modal";

interface Props {
  title: string;
  error: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** When set, Delete stays disabled until the user types this text exactly. */
  confirmText?: string;
  children: ReactNode;
}

/** Destructive confirmation: details in `children`, API errors shown inline, dialog stays open on failure. */
export function ConfirmDeleteModal({ title, error, pending, onConfirm, onClose, confirmText, children }: Props) {
  const [typed, setTyped] = useState("");
  const blocked = confirmText !== undefined && typed !== confirmText;
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-2">{children}</div>
      {confirmText !== undefined && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Type “{confirmText}” to confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="min-h-11 border-2 border-ink bg-surface px-3 font-normal"
          />
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-expense-text">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} className="min-h-11 border-2 border-ink font-semibold hover:bg-ink hover:text-bg">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || blocked}
          className="flex min-h-11 items-center justify-center gap-2 bg-expense-text font-semibold text-bg disabled:opacity-60"
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </Modal>
  );
}
