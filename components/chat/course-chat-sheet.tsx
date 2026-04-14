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
import { Bot, Loader2, MessageSquare, RefreshCw, Send, User } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[]; // material titles cited by this assistant response
}

interface Props {
  courseId: string;
  courseName: string;
  /** When provided, the sheet is fully controlled by the parent */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type EmbedStatus =
  | "unknown"
  | "checking"
  | "missing"
  | "ready"
  | "embedding"
  | "error";

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

  // Embedding state
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>("unknown");
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);

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

  // Check embed status when sheet first opens
  useEffect(() => {
    if (!sheetOpen) return;
    if (embedStatus !== "unknown") return;
    void checkEmbedStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  // ── Embedding ───────────────────────────────────────────────────────────────

  async function checkEmbedStatus() {
    setEmbedStatus("checking");
    setEmbedError(null);
    try {
      const res = await fetch(`/api/embed-course?courseId=${courseId}`);
      if (!res.ok) throw new Error("Failed to check status");
      const data = (await res.json()) as {
        hasEmbeddings: boolean;
        chunkCount: number;
      };
      setChunkCount(data.chunkCount);
      setEmbedStatus(data.hasEmbeddings ? "ready" : "missing");
    } catch {
      setEmbedStatus("error");
      setEmbedError("Could not reach the server. Please try again.");
    }
  }

  async function handleEmbed() {
    setEmbedStatus("embedding");
    setEmbedError(null);
    try {
      const res = await fetch("/api/embed-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = (await res.json()) as {
        chunksCreated?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Embedding failed");
      setChunkCount(data.chunksCreated ?? 0);
      setEmbedStatus("ready");
    } catch (err) {
      setEmbedError(err instanceof Error ? err.message : "Embedding failed");
      setEmbedStatus("error");
    }
  }

  async function handleReEmbed() {
    setEmbedStatus("unknown");
    setChunkCount(0);
    await handleEmbed();
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

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi, courseId }),
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
    [messages, courseId, isStreaming]
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
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setSheetOpen(true)}
        >
          <MessageSquare className="h-4 w-4" />
          Chat with AI
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
              {embedStatus === "ready" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleReEmbed()}
                  title={`${chunkCount} chunks indexed — click to re-index`}
                  className="text-muted-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="sr-only">Re-index materials</span>
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Embedding gate */}
            {embedStatus !== "ready" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                {(embedStatus === "checking" || embedStatus === "unknown") && (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Checking materials…
                    </p>
                  </>
                )}

                {embedStatus === "embedding" && (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Indexing course materials
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Building AI embeddings — this takes ~10–30 seconds…
                      </p>
                    </div>
                  </>
                )}

                {embedStatus === "missing" && (
                  <>
                    <Bot className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Materials not yet indexed
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Index your materials once to enable AI-powered chat.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => void handleEmbed()}>
                      Prepare for Chat
                    </Button>
                  </>
                )}

                {embedStatus === "error" && (
                  <>
                    <p className="max-w-xs text-sm text-destructive">
                      {embedError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void checkEmbedStatus()}
                    >
                      Retry
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Chat UI */}
            {embedStatus === "ready" && (
              <>
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
                          msg.role === "user"
                            ? "flex-row-reverse"
                            : "flex-row"
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
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
