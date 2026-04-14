"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Bot, Loader2, Send, User } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[]; // material titles cited by this assistant response
}

interface MaterialOption {
  id: string;
  title: string;
}

interface Props {
  courseId: string;
  courseName: string;
  /** When provided, the sheet is fully controlled by the parent */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CourseChatSheet({
  courseId,
  courseName,
  open,
  onOpenChange,
}: Props) {
  const controlled = open !== undefined && onOpenChange !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const sheetOpen = controlled ? open : internalOpen;
  const setSheetOpen = controlled ? onOpenChange : setInternalOpen;

  // Material filter state
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch materials and select all by default when sheet opens
  useEffect(() => {
    if (!sheetOpen) return;
    void fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  // ── Materials ───────────────────────────────────────────────────────────────

  async function fetchMaterials() {
    const supabase = createClient();
    const { data } = await supabase
      .from("materials")
      .select("id, title")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true });
    const opts: MaterialOption[] = data ?? [];
    setMaterialOptions(opts);
    // Select all materials by default
    setSelectedMaterialIds(new Set(opts.map((m) => m.id)));
  }

  function toggleMaterial(id: string) {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Streaming chat ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isStreaming) return;

      // Cancel any in-flight stream
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: userText.trim(),
      };
      const assistantId = uid();

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setIsStreaming(true);
      setStreamError(null);

      const historyForApi = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Empty selection = send undefined (route treats missing = all materials)
      const materialIdsPayload =
        selectedMaterialIds.size > 0 ? Array.from(selectedMaterialIds) : undefined;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyForApi,
            courseId,
            materialIds: materialIdsPayload,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Chat request failed");
        }

        if (!res.body) throw new Error("No response body");

        // Read cited sources from response header (set before streaming begins)
        let sources: string[] = [];
        const sourcesHeader = res.headers.get("X-Sources");
        if (sourcesHeader) {
          try {
            sources = JSON.parse(sourcesHeader) as string[];
          } catch {}
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + chunk, sources }
                : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setStreamError(msg);
        // Remove the empty assistant placeholder on error
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === ""))
        );
      } finally {
        setIsStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, courseId, isStreaming, selectedMaterialIds]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    void sendMessage(text);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger (only rendered when not controlled externally) */}
      {!controlled && (
        <Button
          className="gap-2 shadow-sm"
          onClick={() => setSheetOpen(true)}
        >
          <Bot className="h-4 w-4" />
          AI Study Coach
        </Button>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          {/* Header */}
          <SheetHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between pr-8">
              <div>
                <SheetTitle className="flex items-center gap-2 text-sm">
                  <Bot className="h-4 w-4 text-primary" />
                  AI Study Coach
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {courseName}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Material filter pills */}
            {materialOptions.length > 1 && (
              <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
                {materialOptions.map((m) => {
                  const active = selectedMaterialIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMaterial(m.id)}
                      className={cn(
                        "max-w-[160px] truncate rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50"
                      )}
                      title={m.title}
                    >
                      {m.title}
                    </button>
                  );
                })}
              </div>
            )}

            <ScrollArea className="flex-1 px-4 py-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Ask anything about {courseName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    &ldquo;Explain [concept]&rdquo; &middot;{" "}
                    &ldquo;Quiz me on [topic]&rdquo; &middot;{" "}
                    &ldquo;Summarize key points&rdquo;
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Bubble + sources */}
                    <div className="flex max-w-[80%] flex-col gap-1">
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "rounded-tr-sm bg-primary text-primary-foreground"
                            : "rounded-tl-sm bg-muted text-foreground"
                        }`}
                      >
                        {msg.content === "" && msg.role === "assistant" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          msg.content.split("\n").map((line, i, arr) => (
                            <span key={i}>
                              {line}
                              {i < arr.length - 1 && <br />}
                            </span>
                          ))
                        )}
                      </div>
                      {/* Cited sources — only for assistant messages with sources */}
                      {msg.role === "assistant" &&
                        msg.sources &&
                        msg.sources.length > 0 &&
                        msg.content.length > 0 && (
                          <p className="pl-1 text-[10px] text-muted-foreground">
                            From:{" "}
                            {msg.sources.map((s, i) => (
                              <span key={i}>
                                <span className="font-medium text-foreground/70">
                                  {s}
                                </span>
                                {i < msg.sources!.length - 1 && ", "}
                              </span>
                            ))}
                          </p>
                        )}
                    </div>
                  </div>
                ))}

                {streamError && (
                  <p className="text-xs text-destructive">{streamError}</p>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-border px-3 py-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your materials…"
                disabled={isStreaming}
                className="flex-1 text-sm"
                autoComplete="off"
              />
              <Button
                type="submit"
                size="icon-sm"
                disabled={isStreaming || !input.trim()}
              >
                <Send className="h-3.5 w-3.5" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
