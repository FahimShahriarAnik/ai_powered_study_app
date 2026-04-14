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

type PartialAnswer = {
  id: string;
  participant_id: string;
  question_index: number;
  is_correct: boolean;
  answered_at: string;
};

interface Props {
  initialRoom: QuizRoom;
  initialParticipants: RoomParticipant[];
  initialCurrentAnswers: PartialAnswer[];
  questions: SanitizedQuestion[];
  myParticipantId: string;
  isHost: boolean;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

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
  initialCurrentAnswers,
  questions,
  myParticipantId,
  isHost,
}: Props) {
  const supabase = createClient();

  const [room, setRoom] = useState<QuizRoom>(initialRoom);
  const [participants, setParticipants] =
    useState<RoomParticipant[]>(initialParticipants);
  const [currentAnswers, setCurrentAnswers] = useState<PartialAnswer[]>(
    initialCurrentAnswers as PartialAnswer[]
  );
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, number>>(
    initialRoom.revealed_answers ?? {}
  );

  const [myAnswerIndex, setMyAnswerIndex] = useState<number | null>(null);
  const [myAnswerCorrect, setMyAnswerCorrect] = useState<boolean | null>(null);
  const [myLastPoints, setMyLastPoints] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const advancingRef = useRef(false);
  const roomRef = useRef(room);
  roomRef.current = room;

  // Live clock for total timer + countdown
  const now = useNow();

  // ─── Derived timing ───────────────────────────────────────────────────────
  const totalQuestions = questions.length;
  const totalDurationSec = totalQuestions * room.question_duration_seconds;

  // question_started_at is used as game_started_at (the moment play begins)
  const gameStartMs = room.question_started_at
    ? new Date(room.question_started_at).getTime()
    : null;

  // Countdown: positive means game hasn't started yet
  const countdownSec = gameStartMs
    ? Math.ceil((gameStartMs - now) / 1000)
    : null;
  const isCountingDown = countdownSec !== null && countdownSec > 0;

  // Total time remaining once game started
  const elapsedSec = gameStartMs ? (now - gameStartMs) / 1000 : 0;
  const totalTimeLeft = Math.max(0, totalDurationSec - elapsedSec);
  const totalTimePct = totalDurationSec > 0 ? (totalTimeLeft / totalDurationSec) * 100 : 100;
  const timerUrgent = totalTimeLeft <= 30;

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
          const updated = payload.new as QuizRoom;
          const prev = roomRef.current;

          setRoom(updated);
          setRevealedAnswers(updated.revealed_answers ?? {});

          if (updated.current_question !== prev.current_question) {
            setCurrentAnswers([]);
            setMyAnswerIndex(null);
            setMyAnswerCorrect(null);
            setMyLastPoints(null);
            advancingRef.current = false;
          }
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_answers",
          filter: `room_id=eq.${initialRoom.id}`,
        },
        (payload) => {
          const a = payload.new as PartialAnswer & { room_id: string; selected_index: number };
          setCurrentAnswers((prev) => {
            if (prev.find((x) => x.id === a.id)) return prev;
            if (a.question_index !== roomRef.current.current_question) return prev;
            return [
              ...prev,
              {
                id: a.id,
                participant_id: a.participant_id,
                question_index: a.question_index,
                is_correct: a.is_correct,
                answered_at: a.answered_at,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.id]);

  // ─── Polling via API route (RLS-safe) ────────────────────────────────────
  // Direct client-side Supabase queries fail for the non-host because RLS on
  // quiz_rooms restricts SELECT to the host. The GET /api/rooms/[roomId] route
  // uses the server-side Supabase client which bypasses RLS, so both players
  // always receive up-to-date state. Realtime is kept as a fast-path when it
  // works; this poll is the reliable fallback.
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${initialRoom.id}`);
        if (!res.ok) return;
        const json = await res.json() as {
          room: QuizRoom;
          participants: RoomParticipant[];
          currentAnswers: PartialAnswer[];
        };

        const { room: roomData, participants: pData, currentAnswers: caData } = json;

        setRoom((prev) => {
          const changed =
            prev.status !== roomData.status ||
            prev.current_question !== roomData.current_question ||
            prev.question_started_at !== roomData.question_started_at;
          if (!changed) return prev;
          setRevealedAnswers(roomData.revealed_answers ?? {});
          if (roomData.current_question !== prev.current_question) {
            setCurrentAnswers(caData);
            setMyAnswerIndex(null);
            setMyAnswerCorrect(null);
            setMyLastPoints(null);
            advancingRef.current = false;
          }
          return roomData;
        });

        setParticipants(pData);
      } catch {
        // Network error — silently ignore, next tick will retry
      }
    };

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.id]);

  // ─── Auto-advance when total timer expires ────────────────────────────────
  const handleNext = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    try {
      await fetch(`/api/rooms/${initialRoom.id}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromQuestion: roomRef.current.current_question }),
      });
    } finally {
      setAdvancing(false);
    }
  }, [initialRoom.id]);

  // Auto-advance: all players answered
  useEffect(() => {
    if (!isHost || room.status !== "active" || isCountingDown) return;
    const answeredCount = currentAnswers.length;
    if (answeredCount > 0 && answeredCount >= participants.length) {
      const t = setTimeout(() => handleNext(), 1800);
      return () => clearTimeout(t);
    }
  }, [currentAnswers, participants, room.status, isHost, handleNext, isCountingDown]);

  // Auto-advance (or end game): total timer expired
  useEffect(() => {
    if (!isHost || room.status !== "active" || isCountingDown) return;
    if (totalTimeLeft <= 0) {
      handleNext();
    }
  }, [totalTimeLeft, isHost, room.status, handleNext, isCountingDown]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function handleStart() {
    setStarting(true);
    await fetch(`/api/rooms/${initialRoom.id}/start`, { method: "POST" });
    setStarting(false);
  }

  async function handleAnswer(selectedIndex: number) {
    if (myAnswerIndex !== null) return;
    if (isCountingDown) return;
    setAnswerError(null);
    setMyAnswerIndex(selectedIndex);

    try {
      const res = await fetch(`/api/rooms/${initialRoom.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: room.current_question,
          selectedIndex,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAnswerError(json.error ?? "Failed to record answer");
        setMyAnswerIndex(null);
        return;
      }
      setMyAnswerCorrect(json.isCorrect);
      if (json.isCorrect) setMyLastPoints(json.points);
    } catch {
      setAnswerError("Network error");
      setMyAnswerIndex(null);
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const currentQ = questions[room.current_question];
  const revealedCorrectIndex =
    revealedAnswers[String(room.current_question)] ?? null;
  const questionClosed =
    revealedCorrectIndex !== null ||
    room.status === "finished" ||
    (currentAnswers.length >= participants.length && participants.length > 0);

  const myParticipant = participants.find((p) => p.id === myParticipantId);
  const opponent = participants.find((p) => p.id !== myParticipantId);
  const opponentAnswered = currentAnswers.some(
    (a) => a.participant_id !== myParticipantId
  );

  // Max possible score for display context
  const maxScore = totalQuestions * 20; // 10 base + 10 bonus per question

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
            {totalQuestions} questions · {totalDurationSec}s total time
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

    return (
      <div className="mx-auto max-w-md p-6">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-3">
            <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {iWon ? "You won!" : "Good game!"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalQuestions} questions · max {maxScore} pts
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {sorted.map((p, i) => {
            const isMe = p.id === myParticipantId;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3",
                  i === 0
                    ? "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20"
                    : "border-border bg-card"
                )}
              >
                <span className="text-lg font-bold text-muted-foreground w-6">
                  #{i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground capitalize">
                    {p.display_name}
                    {isMe && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{p.score}</p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>
              </div>
            );
          })}
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
        {/* Countdown circle */}
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

        {/* Players */}
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

        {/* Rules */}
        <div className="w-full rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Swords className="h-4 w-4 text-primary" />
            How to win
          </p>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
              <span>
                Answer all <strong className="text-foreground">{totalQuestions} questions</strong> correctly to score points
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Zap className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
              <span>
                Each correct answer is worth{" "}
                <strong className="text-foreground">10–20 pts</strong> — the
                more time remaining on the clock, the bigger the bonus
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span>
                Total time:{" "}
                <strong className="text-foreground">{totalDurationSec}s</strong>{" "}
                for all {totalQuestions} questions
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

  // ─── Render: Active Game ──────────────────────────────────────────────────
  if (!currentQ) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalTimeMins = Math.floor(totalTimeLeft / 60);
  const totalTimeSecs = Math.floor(totalTimeLeft % 60);
  const totalTimeDisplay = `${totalTimeMins}:${String(totalTimeSecs).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-2xl p-6 pb-20">
      {/* Header: scores + total timer */}
      <div className="mb-6 flex items-center gap-3">
        {/* My score */}
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground capitalize">
            {myParticipant?.display_name ?? "You"}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {myParticipant?.score ?? 0}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">pts</span>
          </p>
        </div>

        {/* Total timer */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums transition-colors",
              timerUrgent
                ? "border-destructive text-destructive"
                : "border-border text-foreground"
            )}
          >
            {totalTimeDisplay}
          </div>
          <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-500",
                timerUrgent ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${totalTimePct}%` }}
            />
          </div>
        </div>

        {/* Opponent score */}
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground capitalize">
            {opponent?.display_name ?? "Waiting…"}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {opponent?.score ?? 0}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">pts</span>
          </p>
        </div>
      </div>

      {/* Question progress */}
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {room.current_question + 1} / {totalQuestions}
        </span>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className={cn(timerUrgent && "text-destructive font-medium")}>
            {totalTimeDisplay} left
          </span>
        </div>
      </div>

      {/* Question progress bar */}
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${(room.current_question / totalQuestions) * 100}%`,
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
          {currentQ.options.map((opt, idx) => {
            const isSelected = myAnswerIndex === idx;
            const isRevealed = revealedCorrectIndex !== null;
            const isCorrectAnswer = isRevealed && revealedCorrectIndex === idx;
            const isWrongSelected = isRevealed && isSelected && !isCorrectAnswer;

            return (
              <button
                key={idx}
                onClick={() => !questionClosed && handleAnswer(idx)}
                disabled={myAnswerIndex !== null}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                  isCorrectAnswer
                    ? "border-green-500 bg-green-50 text-foreground dark:bg-green-900/20"
                    : isWrongSelected
                      ? "border-destructive bg-destructive/10 text-foreground"
                      : isSelected
                        ? "border-primary bg-primary/5 text-foreground"
                        : myAnswerIndex !== null
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
          {myAnswerIndex !== null ? (
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                myAnswerCorrect === true
                  ? "text-green-600 dark:text-green-400"
                  : myAnswerCorrect === false
                    ? "text-destructive"
                    : "text-muted-foreground"
              )}
            >
              {myAnswerCorrect === true ? (
                <Check className="h-4 w-4" />
              ) : myAnswerCorrect === false ? (
                <X className="h-4 w-4" />
              ) : null}
              {myAnswerCorrect === true
                ? `Correct! +${myLastPoints ?? 10} pts`
                : myAnswerCorrect === false
                  ? "Wrong"
                  : "Answered — waiting…"}
            </span>
          ) : (
            <span className="text-muted-foreground">Pick an answer</span>
          )}

          {opponentAnswered && (
            <span className="text-xs text-muted-foreground">
              · {opponent?.display_name ?? "Opponent"} answered
            </span>
          )}
        </div>

        {answerError && (
          <span className="text-xs text-destructive">{answerError}</span>
        )}

        {/* Host-only manual advance */}
        {isHost && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleNext}
            disabled={advancing}
            className="text-xs"
          >
            {advancing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {room.current_question + 1 >= totalQuestions ? "Finish" : "Next →"}
          </Button>
        )}
      </div>

      {/* Explanation reveal */}
      {revealedCorrectIndex !== null && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Explanation
          </p>
          <p className="text-sm text-foreground">{currentQ.explanation}</p>
        </div>
      )}
    </div>
  );
}
