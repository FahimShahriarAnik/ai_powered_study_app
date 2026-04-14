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
import { FileText, Loader2, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const MAX_TEXT_CHARS = 50_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type Phase = "idle" | "uploading" | "processing";

interface Props {
  courseId: string;
}

export function UploadMaterialDialog({ courseId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // Track if user cancelled mid-upload so async continuations bail out
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Storage path that may need cleanup on cancel
  const storagePathRef = useRef<string | null>(null);

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");

  // Text state
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  function reset() {
    abortRef.current = null;
    storagePathRef.current = null;
    cancelledRef.current = false;
    setPdfFile(null);
    setPdfTitle("");
    setTextTitle("");
    setTextContent("");
    setError(null);
    setTitleError(null);
    setContentError(null);
    setPhase("idle");
  }

  function handleClose(v: boolean) {
    if (!v && phase !== "idle") {
      // Abort in-flight fetch
      abortRef.current?.abort();
      // Clean up orphaned storage file (fire-and-forget)
      const path = storagePathRef.current;
      if (path) {
        storagePathRef.current = null;
        createClient()
          .storage.from("materials")
          .remove([path])
          .catch(() => {});
      }
      cancelledRef.current = true;
    }
    setOpen(v);
    if (!v) reset();
  }

  async function handlePdfUpload(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation
    let valid = true;
    if (!pdfTitle.trim()) {
      setTitleError("Title is required");
      valid = false;
    } else {
      setTitleError(null);
    }
    if (!pdfFile) {
      setContentError("Please select a PDF file");
      valid = false;
    } else if (pdfFile.size > MAX_FILE_SIZE) {
      setContentError("File must be under 10 MB");
      valid = false;
    } else if (!pdfFile.name.toLowerCase().endsWith(".pdf")) {
      setContentError("Only PDF files are supported");
      valid = false;
    } else {
      setContentError(null);
    }
    if (!valid) return;

    setError(null);
    cancelledRef.current = false;
    abortRef.current = new AbortController();

    // pdfFile is guaranteed non-null by the validation above
    const file = pdfFile!;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      return;
    }

    // ── Phase 1: Upload directly to Supabase Storage (fast, bypasses Vercel) ──
    setPhase("uploading");
    const filePath = `${user.id}/${courseId}/${Date.now()}-${file.name}`;
    storagePathRef.current = filePath;

    const { error: uploadError } = await supabase.storage
      .from("materials")
      .upload(filePath, file, { contentType: "application/pdf" });

    if (cancelledRef.current) return;

    if (uploadError) {
      setError("Upload failed: " + uploadError.message);
      setPhase("idle");
      storagePathRef.current = null;
      return;
    }

    // ── Phase 2: Parse PDF server-side (reads from storage, extracts text) ──
    setPhase("processing");

    let res: Response;
    try {
      res = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageFilePath: filePath,
          courseId,
          title: pdfTitle.trim(),
        }),
        signal: abortRef.current.signal,
      });
    } catch (err) {
      if (cancelledRef.current || (err as Error).name === "AbortError") {
        // cleanup already handled in handleClose
        return;
      }
      // Server didn't create the record yet, clean up storage
      const path = storagePathRef.current;
      if (path) {
        storagePathRef.current = null;
        supabase.storage.from("materials").remove([path]).catch(() => {});
      }
      setError("Connection lost. Please try again.");
      setPhase("idle");
      return;
    }

    if (cancelledRef.current) return;

    // Server created the material record; storage path is now owned by the record
    storagePathRef.current = null;

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Processing failed.");
      setPhase("idle");
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  async function handleTextSave(e: React.FormEvent) {
    e.preventDefault();

    let valid = true;
    if (!textTitle.trim()) {
      setTitleError("Title is required");
      valid = false;
    } else {
      setTitleError(null);
    }
    if (!textContent.trim()) {
      setContentError("Content is required");
      valid = false;
    } else if (textContent.length > MAX_TEXT_CHARS) {
      setContentError(`Must be under ${MAX_TEXT_CHARS.toLocaleString()} characters`);
      valid = false;
    } else {
      setContentError(null);
    }
    if (!valid) return;

    setError(null);
    setPhase("processing");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setPhase("idle");
      return;
    }

    const { count } = await supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);

    if ((count ?? 0) >= 10) {
      setError("Courses are limited to 10 materials.");
      setPhase("idle");
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
      setPhase("idle");
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  const isLoading = phase !== "idle";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
        <Plus className="h-4 w-4" />
        Add Material
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Material</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="pdf"
          className="mt-2"
          onValueChange={() => {
            setError(null);
            setTitleError(null);
            setContentError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="pdf" className="text-xs h-7 gap-1.5">
              <Upload className="h-3 w-3" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs h-7 gap-1.5">
              <FileText className="h-3 w-3" />
              Paste Text
            </TabsTrigger>
          </TabsList>

          {/* ── PDF Tab ── */}
          <TabsContent value="pdf">
            <form onSubmit={handlePdfUpload} className="mt-4 space-y-3">
              <div>
                <Input
                  placeholder="Material title"
                  value={pdfTitle}
                  onChange={(e) => {
                    setPdfTitle(e.target.value);
                    if (titleError) setTitleError(null);
                  }}
                  disabled={isLoading}
                  className={cn(titleError && "border-destructive focus-visible:ring-destructive")}
                />
                {titleError && (
                  <p className="mt-1 text-xs text-destructive">{titleError}</p>
                )}
              </div>

              <div>
                <label
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground transition-colors",
                    isLoading
                      ? "cursor-not-allowed border-border opacity-60"
                      : contentError
                      ? "border-destructive hover:bg-muted/40"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="font-medium text-foreground text-sm">
                        {phase === "uploading" ? "Uploading file…" : "Extracting text…"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {phase === "uploading" ? "Step 1 of 2 · Sending to storage" : "Step 2 of 2 · Reading PDF content"}
                      </span>
                    </>
                  ) : pdfFile ? (
                    <>
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium text-foreground">{pdfFile.name}</span>
                      <span className="text-xs">
                        {(pdfFile.size / 1024).toFixed(0)} KB · Click to change
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span>Click to select a PDF</span>
                      <span className="text-xs">Max 10 MB · Max 50 pages</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    disabled={isLoading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setPdfFile(f);
                      if (!f) return;
                      if (!f.name.toLowerCase().endsWith(".pdf")) {
                        setContentError("Only PDF files are supported");
                      } else if (f.size > MAX_FILE_SIZE) {
                        setContentError("File must be under 10 MB");
                      } else {
                        setContentError(null);
                      }
                    }}
                  />
                </label>
                {contentError && (
                  <p className="mt-1 text-xs text-destructive">{contentError}</p>
                )}
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClose(false)}
                >
                  {isLoading ? "Cancel upload" : "Cancel"}
                </Button>
                <Button type="submit" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {phase === "uploading" ? "Uploading…" : "Processing…"}
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── Text Tab ── */}
          <TabsContent value="text">
            <form onSubmit={handleTextSave} className="mt-4 space-y-3">
              <div>
                <Input
                  placeholder="Material title"
                  value={textTitle}
                  onChange={(e) => {
                    setTextTitle(e.target.value);
                    if (titleError) setTitleError(null);
                  }}
                  disabled={isLoading}
                  className={cn(titleError && "border-destructive focus-visible:ring-destructive")}
                />
                {titleError && (
                  <p className="mt-1 text-xs text-destructive">{titleError}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <textarea
                    className={cn(
                      "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[150px] resize-none",
                      contentError
                        ? "border-destructive focus:ring-destructive"
                        : "border-border"
                    )}
                    placeholder="Paste your study notes or content here…"
                    value={textContent}
                    onChange={(e) => {
                      setTextContent(e.target.value);
                      if (contentError) setContentError(null);
                    }}
                    maxLength={MAX_TEXT_CHARS}
                    disabled={isLoading}
                  />
                  <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                    {textContent.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
                  </span>
                </div>
                {contentError && (
                  <p className="mt-1 text-xs text-destructive">{contentError}</p>
                )}
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
