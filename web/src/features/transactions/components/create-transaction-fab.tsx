"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CreateTransactionModal } from "./create-transaction-modal";

const ACCOUNT_DETAIL = /^\/accounts\/(\d+)\/?$/;

export function CreateTransactionFab() {
  const [open, setOpen] = useState(false);
  const match = ACCOUNT_DETAIL.exec(usePathname());
  const defaultAccountId = match ? Number(match[1]) : undefined;

  return (
    <>
      <button
        type="button"
        aria-label="New transaction"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[88px] z-20 flex h-[60px] w-[60px] items-center justify-center bg-primary text-bg shadow-[0_6px_18px_rgba(0,0,0,.5)] hover:bg-primary-hover md:right-6 md:bottom-[96px]"
      >
        <Plus size={26} />
      </button>
      {open && <CreateTransactionModal defaultAccountId={defaultAccountId} onClose={() => setOpen(false)} />}
    </>
  );
}
