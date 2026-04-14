"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Swords, Users, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface QuizOption {
  id: string;
  label: string;
  questionCount: number;
  difficulty: string;
}

interface Props {
  quizOptions: QuizOption[];
  userId: string;
}

const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  hard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  mixed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  adaptive: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
};

export function RoomsHub({ quizOptions }: Props) {
  const router = useRouter();
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!selectedQuizId) return;
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: selectedQuizId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to create room");
        return;
      }
      router.push(`/rooms/${json.roomId}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to join room");
        return;
      }
      router.push(`/rooms/${json.roomId}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
      {/* Create Room */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="h-4 w-4 text-primary" />
            Create Room
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pick a quiz and share the room code with a friend
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {quizOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quizzes yet — generate one from a course material first.
            </p>
          ) : (
            <>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {quizOptions.map((quiz) => {
                  const isSelected = quiz.id === selectedQuizId;
                  return (
                    <button
                      key={quiz.id}
                      onClick={() => setSelectedQuizId(quiz.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="leading-snug truncate">{quiz.label}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {quiz.questionCount}q
                          </span>
                          <Badge
                            className={`text-xs px-1 py-0 ${DIFF_COLORS[quiz.difficulty] ?? DIFF_COLORS.mixed}`}
                          >
                            {quiz.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={handleCreate}
                disabled={!selectedQuizId || creating}
                className="w-full gap-2"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Swords className="h-4 w-4" />
                )}
                {creating ? "Creating…" : "Create Room"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Join Room */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Join Room
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Enter the 6-letter code your friend shared
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="e.g. ABCD12"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            maxLength={6}
            className="font-mono text-lg tracking-widest uppercase text-center"
          />
          <Button
            onClick={handleJoin}
            disabled={joinCode.trim().length < 4 || joining}
            className="w-full gap-2"
            variant="secondary"
          >
            {joining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {joining ? "Joining…" : "Join Room"}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="md:col-span-2">
          <Separator className="mb-4" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Info */}
      <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-foreground mb-1">How it works</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Host creates a room and shares the 6-letter code</li>
          <li>• Guest joins — both players see a 5-second countdown together</li>
          <li>• Race through all questions before the total timer runs out</li>
          <li>• Correct answers earn 10–20 pts — answer fast for a bigger bonus</li>
        </ul>
      </div>
    </div>
  );
}
