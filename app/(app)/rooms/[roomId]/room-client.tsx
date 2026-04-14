"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  QuizRoom,
  RoomParticipant,
  SanitizedQuestion,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  Copy,
  Loader2,
  Swords,
  Trophy,
  User,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  initialRoom: QuizRoom;
  initialParticipants: RoomParticipant[];
  initialQuestions: SanitizedQuestion[];
  myParticipantId: string;
  isHost: boolean;
}

// participantId → questionIndex → isCorrect
type AnswerMap = Record<string, Record<number, boolean>>;

type FlashState = {
  correctIndex: number;
  isCorrect: boolean;
  points: number;
};

const OPTION_LABELS = ["A", "B", "C", "D"];
const FLASH_DURATION_MS = 2000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function RoomClient({
  initialRoom,
  initialParticipants,
  initialQuestions,
  myParticipantId,
  isHost,
}: Props) {
  const supabase = createClient();

  const [room, setRoom] = useState<QuizRoom>(initialRoom);
  const [participants, setParticipants] =
    useState<RoomParticipant[]>(initialParticipants);
  const [questions, setQuestions] =
    useState<SanitizedQuestion[]>(initialQuestions);

  // Per-participant question tracking
  const myParticipant = participants.find((p) => p.id === myParticipantId);
  const [myCurrentQuestion, setMyCurrentQuestion] = useState(
    () =>
      initialParticipants.find((p) => p.id === myParticipantId)
        ?.current_question ?? 0
  );
  const [myFinished, setMyFinished] = useState(
    () =>
      !!(
        initialParticipants.find((p) => p.id === myParticipantId)?.finished_at
      )
  );

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [myAnswerIndex, setMyAnswerIndex] = useState<number | null>(null);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // Track when the current question was shown (for per-question countdown)
  const questionShownAtRef = useRef<number>(Date.now());
  const answeringRef = useRef(false);

  const now = useNow();

  // ─── Derived timing ───────────────────────────────────────────────────────
  const totalQuestions = questions.length;


  const gameStartMs = room.question_started_at
    ? new Date(room.question_started_at).getTime()
    : null;

  // Countdown before game starts (positive = not started yet)
  const countdownSec = gameStartMs
    ? Math.ceil((gameStartMs - now) / 1000)
    : null;
  const isCountingDown = countdownSec !== null && countdownSec > 0;

  // Per-question countdown (resets when myCurrentQuestion changes)
  const questionElapsedSec =
    !isCountingDown && room.status === "active" && !myFinished && !flash
      ? (now - questionShownAtRef.current) / 1000
      : 0;
  const questionTimeLeft = Math.max(
    0,
    room.question_duration_seconds - questionElapsedSec
  );
  const questionTimePct =
    (questionTimeLeft / room.question_duration_seconds) * 100;
  const timerUrgent = questionTimeLeft <= 8;

  // ─── Reset question timer when question advances ──────────────────────────
  useEffect(() => {
    if (room.status === "active" && !isCountingDown) {
      questionShownAtRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCurrentQuestion, isCountingDown]);

  // ─── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`quiz-room-${initialRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quiz_rooms",
          filter: `id=eq.${initialRoom.id}`,
        },
        (payload) => {
          setRoom(payload.new as QuizRoom);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${initialRoom.id}`,
        },
        (payload) => {
          const p = payload.new as RoomParticipant;
          setParticipants((prev) => {
            if (prev.find((x) => x.id === p.id)) return prev;
            return [...prev, p];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${initialRoom.id}`,
        },
        (payload) => {
          const updated = payload.new as RoomParticipant;
          setParticipants((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.id]);

  // ─── Polling fallback (RLS-safe) ──────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${initialRoom.id}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          room: QuizRoom;
          participants: RoomParticipant[];
          questions: SanitizedQuestion[];
          answers: { participant_id: string; question_index: number; is_correct: boolean }[];
        };

        if (json.questions.length > 0) {
          setQuestions((prev) => (prev.length === 0 ? json.questions : prev));
        }
        setRoom((prev) => {
          if (
            prev.status === json.room.status &&
            prev.question_started_at === json.room.question_started_at
          )
            return prev;
          return json.room;
        });
        setParticipants(json.participants);
        if (json.answers.length > 0) {
          const map: AnswerMap = {};
          for (const a of json.answers) {
            if (!map[a.participant_id]) map[a.participant_id] = {};
            map[a.participant_id][a.question_index] = a.is_correct;
          }
          setAnswers(map);
        }
      } catch {
        // Network error — silently ignore
      }
    };

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.id]);

  // ─── Auto-timeout when per-question timer hits 0 ─────────────────────────
  useEffect(() => {
    if (
      room.status !== "active" ||
      isCountingDown ||
      myFinished ||
      flash !== null ||
      myAnswerIndex !== null
    )
      return;
    if (questionTimeLeft <= 0) {
      handleAnswer(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionTimeLeft, room.status, isCountingDown, myFinished, flash, myAnswerIndex]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function handleStart() {
    setStarting(true);
    await fetch(`/api/rooms/${initialRoom.id}/start`, { method: "POST" });
    setStarting(false);
  }

  const handleAnswer = useCallback(
    async (selectedIndex: number) => {
      if (answeringRef.current) return;
      if (myAnswerIndex !== null && selectedIndex !== -1) return;
      if (isCountingDown || myFinished) return;

      answeringRef.current = true;
      if (selectedIndex !== -1) setMyAnswerIndex(selectedIndex);
      setAnswerError(null);

      try {
        const res = await fetch(`/api/rooms/${initialRoom.id}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIndex: myCurrentQuestion,
            selectedIndex,
          }),
        });
        const json = await res.json();

        if (!res.ok) {
          if (selectedIndex !== -1) {
            setAnswerError(json.error ?? "Failed to record answer");
            setMyAnswerIndex(null);
          }
          answeringRef.current = false;
          return;
        }

        // Show 2s flash with correct/wrong reveal
        setFlash({
          correctIndex: json.correctIndex,
          isCorrect: json.isCorrect,
          points: json.points,
        });

        setTimeout(() => {
          setFlash(null);
          setMyAnswerIndex(null);
          answeringRef.current = false;

          if (json.finished) {
            setMyFinished(true);
          } else {
            setMyCurrentQuestion((prev) => prev + 1);
          }
        }, FLASH_DURATION_MS);
      } catch {
        if (selectedIndex !== -1) {
          setAnswerError("Network error");
          setMyAnswerIndex(null);
        }
        answeringRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myCurrentQuestion, myAnswerIndex, isCountingDown, myFinished, initialRoom.id]
  );

  async function copyCode() {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const opponent = participants.find((p) => p.id !== myParticipantId);
  const maxScore = totalQuestions * 20;

  // ─── Render: Waiting Room ─────────────────────────────────────────────────
  if (room.status === "waiting") {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <Swords className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Quiz Room</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalQuestions} questions · {room.question_duration_seconds}s per
            question
          </p>
        </div>

        {/* Room code */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Room Code
          </p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-widest text-foreground">
            {room.code}
          </p>
          <button
            onClick={copyCode}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mx-auto transition-colors"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>

        {/* Participants */}
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Players ({participants.length}/2)
          </p>
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground capitalize">
                {p.display_name}
              </span>
              {p.id === myParticipantId && (
                <Badge className="ml-auto text-xs">You</Badge>
              )}
              {p.user_id === room.host_user_id && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Host
                </Badge>
              )}
            </div>
          ))}
          {participants.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Waiting for opponent to join…
            </p>
          )}
        </div>

        {isHost ? (
          <Button
            onClick={handleStart}
            disabled={starting || participants.length < 2}
            className="w-full gap-2"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Swords className="h-4 w-4" />
            )}
            {starting
              ? "Starting…"
              : participants.length < 2
              ? "Waiting for opponent…"
              : "Start Game"}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Waiting for host to start…
          </p>
        )}
      </div>
    );
  }

  // ─── Render: Game Over ────────────────────────────────────────────────────
  if (room.status === "finished") {
    const sorted = [...participants].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const iWon = winner?.id === myParticipantId;
    const gameStartMs = room.question_started_at
      ? new Date(room.question_started_at).getTime()
      : null;

    function finishTime(p: RoomParticipant): string {
      if (!p.finished_at || !gameStartMs) return "—";
      const secs = Math.round(
        (new Date(p.finished_at).getTime() - gameStartMs) / 1000
      );
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    function accuracy(p: RoomParticipant): string {
      const pAnswers = answers[p.id] ?? {};
      const correct = Object.values(pAnswers).filter(Boolean).length;
      const total = totalQuestions;
      return `${correct}/${total} correct`;
    }

    return (
      <div className="mx-auto max-w-2xl p-6 pb-16">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-3">
            <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {iWon ? "You won!" : "Good game!"}
          </h1>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {sorted.map((p, i) => {
            const isMe = p.id === myParticipantId;
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-lg border p-4 text-center",
                  i === 0
                    ? "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20"
                    : "border-border bg-card"
                )}
              >
                <p className="text-xs font-medium text-muted-foreground capitalize mb-1">
                  {p.display_name}
                  {isMe && <span className="ml-1 text-primary">(you)</span>}
                </p>
                <p className="text-3xl font-black text-foreground">
                  {p.score}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">pts</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{accuracy(p)}</p>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-0.5" />
                  {finishTime(p)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Per-question breakdown */}
        <div className="rounded-lg border border-border overflow-hidden mb-6">
          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem] gap-x-3 px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground text-center">#</span>
            <span className="text-xs font-medium text-muted-foreground">Question</span>
            {participants.map((p) => (
              <span
                key={p.id}
                className="text-xs font-medium text-muted-foreground text-center capitalize truncate"
              >
                {p.display_name.split(" ")[0]}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {questions.map((q, qi) => (
              <div
                key={q.id}
                className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem] gap-x-3 px-4 py-3 items-start"
              >
                <span className="text-xs text-muted-foreground text-center pt-0.5">
                  {qi + 1}
                </span>
                <p className="text-sm text-foreground leading-snug">{q.question}</p>
                {participants.map((p) => {
                  const result = answers[p.id]?.[qi];
                  return (
                    <div key={p.id} className="flex justify-center pt-0.5">
                      {result === undefined ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : result ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => (window.location.href = "/rooms")}
        >
          Back to Rooms
        </Button>
      </div>
    );
  }

  // ─── Render: Countdown / Rules Screen ─────────────────────────────────────
  if (room.status === "active" && isCountingDown) {
    return (
      <div className="mx-auto max-w-md p-6 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 mt-4">
          <div
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full border-4 text-4xl font-black transition-all",
              (countdownSec ?? 0) <= 2
                ? "border-destructive text-destructive scale-110"
                : "border-primary text-primary"
            )}
          >
            {countdownSec}
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Get ready…
          </p>
        </div>

        <div className="flex w-full items-center justify-around">
          {participants.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground capitalize">
                {p.display_name}
              </span>
              {p.id === myParticipantId && (
                <span className="text-xs text-primary">you</span>
              )}
            </div>
          ))}
        </div>

        <div className="w-full rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Swords className="h-4 w-4 text-primary" />
            How to win
          </p>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
              <span>
                Answer all{" "}
                <strong className="text-foreground">{totalQuestions} questions</strong>{" "}
                independently — no waiting for your opponent
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Zap className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
              <span>
                Each correct answer is worth{" "}
                <strong className="text-foreground">10–20 pts</strong> — faster
                answers earn a bigger bonus
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span>
                You have{" "}
                <strong className="text-foreground">
                  {room.question_duration_seconds}s
                </strong>{" "}
                per question — it auto-advances when time runs out
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Trophy className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
              <span>
                Highest score wins. Max possible:{" "}
                <strong className="text-foreground">{maxScore} pts</strong>
              </span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // ─── Render: Waiting for opponent after finishing ─────────────────────────
  if (myFinished) {
    const opponentDone = !!(opponent?.finished_at);
    return (
      <div className="mx-auto max-w-md p-6 flex flex-col items-center gap-6 text-center">
        <div className="mt-8 inline-flex items-center justify-center rounded-full bg-primary/10 p-4">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">You finished!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your score: <strong className="text-foreground">{myParticipant?.score ?? 0} pts</strong>
          </p>
        </div>
        {opponentDone ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating results…
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for {opponent?.display_name ?? "opponent"} to finish…
            </div>
            <p className="text-xs text-muted-foreground">
              {opponent?.display_name ?? "Opponent"} is on question{" "}
              {(opponent?.current_question ?? 0) + 1} / {totalQuestions}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Active Game ──────────────────────────────────────────────────
  const currentQ = questions[myCurrentQuestion];

  if (!currentQ) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const questionTimeSecs = Math.ceil(questionTimeLeft);

  return (
    <div className="mx-auto max-w-2xl p-6 pb-20">
      {/* Header: scores */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground capitalize">
            {myParticipant?.display_name ?? "You"}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {myParticipant?.score ?? 0}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">
              pts
            </span>
          </p>
        </div>

        {/* Per-question timer */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums transition-colors",
              timerUrgent
                ? "border-destructive text-destructive"
                : "border-border text-foreground"
            )}
          >
            {questionTimeSecs}
          </div>
          <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-500",
                timerUrgent ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${questionTimePct}%` }}
            />
          </div>
        </div>

        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground capitalize">
            {opponent?.display_name ?? "Waiting…"}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {opponent?.score ?? 0}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">
              pts
            </span>
          </p>
          {opponent && (
            <p className="text-xs text-muted-foreground">
              Q{Math.min(opponent.current_question + 1, totalQuestions)}/
              {totalQuestions}
            </p>
          )}
        </div>
      </div>

      {/* Question progress */}
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {myCurrentQuestion + 1} / {totalQuestions}
        </span>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className={cn(timerUrgent && "text-destructive font-medium")}>
            {questionTimeSecs}s left
          </span>
        </div>
      </div>

      {/* Question progress bar */}
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${(myCurrentQuestion / totalQuestions) * 100}%`,
          }}
        />
      </div>

      {/* Question card */}
      <div className="rounded-lg border border-border bg-card p-6 mb-4">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {currentQ.topic}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {currentQ.difficulty}
          </Badge>
        </div>
        <p className="mt-3 text-base font-medium text-foreground leading-relaxed">
          {currentQ.question}
        </p>

        <div className="mt-4 space-y-2">
          {currentQ.options.map((opt: string, idx: number) => {
            const isSelected = myAnswerIndex === idx;
            const isCorrectAnswer = flash !== null && flash.correctIndex === idx;
            const isWrongSelected =
              flash !== null && isSelected && !isCorrectAnswer;

            return (
              <button
                key={idx}
                onClick={() => flash === null && myAnswerIndex === null && handleAnswer(idx)}
                disabled={myAnswerIndex !== null || flash !== null}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                  isCorrectAnswer
                    ? "border-green-500 bg-green-50 text-foreground dark:bg-green-900/20"
                    : isWrongSelected
                    ? "border-destructive bg-destructive/10 text-foreground"
                    : isSelected
                    ? "border-primary bg-primary/5 text-foreground"
                    : myAnswerIndex !== null || flash !== null
                    ? "border-border bg-muted/30 text-muted-foreground cursor-default"
                    : "border-border bg-background text-foreground hover:border-muted-foreground/40 hover:bg-muted/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCorrectAnswer
                      ? "bg-green-500 text-white"
                      : isWrongSelected
                      ? "bg-destructive text-destructive-foreground"
                      : isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCorrectAnswer ? (
                    <Check className="h-3 w-3" />
                  ) : isWrongSelected ? (
                    <X className="h-3 w-3" />
                  ) : (
                    OPTION_LABELS[idx]
                  )}
                </span>
                <span className="flex-1 leading-relaxed">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {flash !== null ? (
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                flash.isCorrect
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive"
              )}
            >
              {flash.isCorrect ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {flash.isCorrect
                ? `Correct! +${flash.points} pts`
                : "Wrong — next question in 2s"}
            </span>
          ) : myAnswerIndex !== null ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          ) : (
            <span className="text-muted-foreground">Pick an answer</span>
          )}
        </div>

        {answerError && (
          <span className="text-xs text-destructive">{answerError}</span>
        )}
      </div>

    </div>
  );
}
