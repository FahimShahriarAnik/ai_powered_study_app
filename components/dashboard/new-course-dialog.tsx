"use client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  open?: boolean;
  triggerLabel?: string;
  className?: string;
}

export function NewCourseDialog({ open: initialOpen, triggerLabel, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen ?? false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setLoading(false); return; }

    const { error } = await supabase
      .from("courses")
      .insert({ name: name.trim(), user_id: user.id });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setName("");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) router.replace("/dashboard");
    }}>
      <DialogTrigger
        className={cn(
          buttonVariants({ size: "sm" }),
          "gap-2",
          className
        )}
      >
        <Plus className="h-4 w-4" />
        {triggerLabel ?? "New Course"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Course</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="mt-2 space-y-3">
          <Input
            placeholder="Course name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
