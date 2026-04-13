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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const MAX_TEXT_CHARS = 50_000;

interface Props {
  courseId: string;
}

export function UploadMaterialDialog({ courseId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");

  // Text state
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPdfFile(null);
    setPdfTitle("");
    setTextTitle("");
    setTextContent("");
    setError(null);
    setLoading(false);
  }

  async function handlePdfUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile || !pdfTitle.trim()) return;
    setError(null);
    setLoading(true);
    abortRef.current = new AbortController();

    const formData = new FormData();
    formData.append("file", pdfFile);
    formData.append("courseId", courseId);
    formData.append("title", pdfTitle.trim());

    let res: Response;
    try {
      res = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData,
        signal: abortRef.current.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // user cancelled
      setError("Upload failed. Check your connection.");
      setLoading(false);
      return;
    }

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Upload failed.");
      setLoading(false);
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  async function handleTextSave(e: React.FormEvent) {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim()) return;

    if (textContent.length > MAX_TEXT_CHARS) {
      setError(`Text must be under ${MAX_TEXT_CHARS.toLocaleString()} characters.`);
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setLoading(false); return; }

    // Check material limit
    const { count } = await supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);

    if ((count ?? 0) >= 10) {
      setError("Courses are limited to 10 materials.");
      setLoading(false);
      return;
    }

    const { error: dbError } = await supabase.from("materials").insert({
      course_id: courseId,
      title: textTitle.trim(),
      raw_text: textContent.trim(),
      char_count: textContent.trim().length,
    });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
        <Plus className="h-4 w-4" />
        Add Material
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Material</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="pdf" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="pdf" className="flex-1">Upload PDF</TabsTrigger>
            <TabsTrigger value="text" className="flex-1">Paste Text</TabsTrigger>
          </TabsList>

          {/* PDF Tab */}
          <TabsContent value="pdf">
            <form onSubmit={handlePdfUpload} className="mt-3 space-y-3">
              <Input
                placeholder="Title"
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                required
              />
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
                <Upload className="h-6 w-6" />
                {pdfFile ? (
                  <span className="font-medium text-foreground">{pdfFile.name}</span>
                ) : (
                  <span>Click to select a PDF</span>
                )}
                <span className="text-xs">Max 10 MB · Max 50 pages</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading || !pdfFile || !pdfTitle.trim()}>
                  {loading ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Text Tab */}
          <TabsContent value="text">
            <form onSubmit={handleTextSave} className="mt-3 space-y-3">
              <Input
                placeholder="Title"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                required
              />
              <div className="relative">
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[160px] resize-none"
                  placeholder="Paste your study notes or content here…"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  maxLength={MAX_TEXT_CHARS}
                  required
                />
                <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                  {textContent.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
                </span>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading || !textTitle.trim() || !textContent.trim()}>
                  {loading ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
