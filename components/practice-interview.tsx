"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { SpeakButton } from "@/components/SpeakButton";
import staticInterviewFlow from "@/data/static_interview_flow.json";
import type {
  InterviewQuestion,
  StaticInterviewFlowQuestion,
  StartInterviewRequest,
} from "@/lib/interview-types";

interface PracticeInterviewProps {
  roleTitle: string;
}

type PracticePhase = "setup" | "loading" | "active" | "summary";
const TOTAL_QUESTIONS = 12;
const STATIC_OPENING_QUESTION_COUNT = 5;

function pickRandomOption(options: readonly string[]) {
  return options[Math.floor(Math.random() * options.length)];
}

function sanitizeText(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentencesIntoParagraphs(value: string, sentencesPerParagraph = 2): string[] {
  const sentences = value.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)?.map((item) => item.trim()) ?? [];

  if (sentences.length <= sentencesPerParagraph) {
    return [value.trim()].filter(Boolean);
  }

  const paragraphs: string[] = [];

  for (let index = 0; index < sentences.length; index += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(index, index + sentencesPerParagraph).join(" ").trim());
  }

  return paragraphs.filter(Boolean);
}

function toParagraphs(value: string, options?: { sentenceChunkSize?: number }): string[] {
  const cleaned = sanitizeText(value);

  if (!cleaned) {
    return [];
  }

  const explicitParagraphs = cleaned
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (explicitParagraphs.length > 1) {
    return explicitParagraphs;
  }

  return splitSentencesIntoParagraphs(cleaned, options?.sentenceChunkSize ?? 2);
}

function toSectionBlocks(value: string): Array<{ title?: string; body: string[] }> {
  const cleaned = sanitizeText(value);

  if (!cleaned) {
    return [];
  }

  const numberedSections = cleaned
    .split(/\n(?=\d+\.\s*[A-Za-z])|(?<=\.)\s+(?=\d+\.\s*[A-Za-z])/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (numberedSections.length > 1) {
    return numberedSections.map((section) => {
      const normalized = section.replace(/^\d+\.\s*/, "").trim();
      const headingMatch = normalized.match(/^([^:]{3,80}):\s*([\s\S]*)$/);

      if (headingMatch) {
        return {
          title: headingMatch[1].trim(),
          body: toParagraphs(headingMatch[2].trim(), { sentenceChunkSize: 2 }),
        };
      }

      const paragraphs = toParagraphs(normalized, { sentenceChunkSize: 2 });
      const [first, ...rest] = paragraphs;
      return {
        title: first && first.length < 90 ? first : undefined,
        body: first && first.length < 90 ? rest.length > 0 ? rest : [""] : paragraphs,
      };
    });
  }

  return cleaned
    .split(/\n(?=[A-Z][^:\n]{2,80}:)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((section) => {
      const headingMatch = section.match(/^([^:]{3,80}):\s*([\s\S]*)$/);

      if (headingMatch) {
        return {
          title: headingMatch[1].trim(),
          body: toParagraphs(headingMatch[2].trim(), { sentenceChunkSize: 2 }),
        };
      }

      return {
        body: toParagraphs(section, { sentenceChunkSize: 2 }),
      };
    });
}

function buildStaticOpeningQuestions(): InterviewQuestion[] {
  return (staticInterviewFlow as StaticInterviewFlowQuestion[]).map((item) => ({
    question:
      item.question_variations && item.question_variations.length > 0
        ? pickRandomOption(item.question_variations)
        : item.question,
    type: item.type,
    interviewer_intent: item.interviewer_intent,
    expected_points: [...item.expected_points],
    sample_answer:
      item.answerOptions && item.answerOptions.length > 0
        ? pickRandomOption(item.answerOptions)
        : item.sample_answer ?? "",
    explanation: item.explanation,
  }));
}

const JUSTIFIED_TEXT_STYLE = {
  textAlign: "justify" as const,
  textJustify: "inter-word" as const,
  hyphens: "auto" as const,
};

export function PracticeInterview({ roleTitle }: PracticeInterviewProps) {
  const [phase, setPhase] = useState<PracticePhase>("setup");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [queuedQuestions, setQueuedQuestions] = useState<Record<number, InterviewQuestion>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const questionsRef = useRef<InterviewQuestion[]>([]);
  const queuedQuestionsRef = useRef<Record<number, InterviewQuestion>>({});
  const pendingQuestionNumbersRef = useRef<Set<number>>(new Set());
  const openingQuestionsRef = useRef<InterviewQuestion[]>([]);

  const currentQuestion = questions[currentIndex] ?? null;
  const progress = questions.length > 0 ? ((currentIndex + 1) / TOTAL_QUESTIONS) * 100 : 0;

  async function requestQuestion(
    questionNumber: number,
    previousQuestions: string[],
  ): Promise<InterviewQuestion> {
    if (questionNumber <= STATIC_OPENING_QUESTION_COUNT) {
      return openingQuestionsRef.current[questionNumber - 1];
    }

    const requestBody: StartInterviewRequest = {
      question_number: questionNumber,
      previous_questions: previousQuestions,
    };

    const response = await fetch("/api/interview/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "Unable to load the interview question.";

      throw new Error(message);
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("question" in payload) ||
      typeof payload.question !== "string"
    ) {
      throw new Error("Question payload was malformed.");
    }

    return payload as InterviewQuestion;
  }

  function syncQuestions(nextQuestions: InterviewQuestion[]) {
    questionsRef.current = nextQuestions;
    setQuestions(nextQuestions);
  }

  function syncQueuedQuestions(nextQueuedQuestions: Record<number, InterviewQuestion>) {
    queuedQuestionsRef.current = nextQueuedQuestions;
    setQueuedQuestions(nextQueuedQuestions);
  }

  function updateCurrentIndex(nextIndex: number) {
    setCurrentIndex(nextIndex);
    setIsCompleted(nextIndex === TOTAL_QUESTIONS - 1);
  }

  function resetInterviewState() {
    syncQuestions([]);
    syncQueuedQuestions({});
    pendingQuestionNumbersRef.current.clear();
    openingQuestionsRef.current = [];
    updateCurrentIndex(0);
    setIsCompleted(false);
    setError(null);
  }

  async function ensureQueue(baseQuestions: InterviewQuestion[]): Promise<void> {
    const workingQuestions = [...baseQuestions];

    while (workingQuestions.length < TOTAL_QUESTIONS) {
      const queuedEntries = Object.entries(queuedQuestionsRef.current)
        .map(([key, question]) => [Number(key), question] as const)
        .sort(([left], [right]) => left - right);
      const queuedCountAhead = queuedEntries.filter(
        ([questionNumber]) => questionNumber > workingQuestions.length,
      ).length;

      if (queuedCountAhead >= 2) {
        return;
      }

      const nextQuestionNumber = workingQuestions.length + 1 + queuedCountAhead;

      if (nextQuestionNumber > TOTAL_QUESTIONS) {
        return;
      }

      if (pendingQuestionNumbersRef.current.has(nextQuestionNumber)) {
        return;
      }

      const priorQuestions = [
        ...workingQuestions.map((question) => question.question),
        ...queuedEntries
          .filter(([questionNumber]) => questionNumber < nextQuestionNumber)
          .map(([, question]) => question.question),
      ];

      pendingQuestionNumbersRef.current.add(nextQuestionNumber);

      try {
        const question = await requestQuestion(nextQuestionNumber, priorQuestions);
        const nextQueuedQuestions = {
          ...queuedQuestionsRef.current,
          [nextQuestionNumber]: question,
        };
        syncQueuedQuestions(nextQueuedQuestions);
      } catch {
        return;
      } finally {
        pendingQuestionNumbersRef.current.delete(nextQuestionNumber);
      }
    }
  }

  async function startInterview() {
    try {
      resetInterviewState();
      openingQuestionsRef.current = buildStaticOpeningQuestions();
      const firstQuestion = await requestQuestion(1, []);
      syncQuestions([firstQuestion]);
      updateCurrentIndex(0);
      setPhase("active");
      void ensureQueue([firstQuestion]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the interview question.",
      );
      setPhase("setup");
    }
  }

  function handleNextQuestion() {
    void (async () => {
      const nextIndex = currentIndex + 1;
      const nextQuestionNumber = nextIndex + 1;

      if (nextQuestionNumber > TOTAL_QUESTIONS) {
        return;
      }

      if (nextIndex < questionsRef.current.length) {
        updateCurrentIndex(nextIndex);
        void ensureQueue(questionsRef.current.slice(0, nextIndex + 1));
        return;
      }

      const queued = queuedQuestionsRef.current[nextQuestionNumber];

      if (queued) {
        const nextQuestions =
          questionsRef.current.length > nextIndex
            ? questionsRef.current
            : [...questionsRef.current, queued];
        syncQuestions(nextQuestions);
        updateCurrentIndex(nextIndex);
        const updatedQueue = { ...queuedQuestionsRef.current };
        delete updatedQueue[nextQuestionNumber];
        syncQueuedQuestions(updatedQueue);
        void ensureQueue(nextQuestions.slice(0, nextIndex + 1));
        return;
      }

      try {
        const priorQuestions = questionsRef.current.map((item) => item.question);
        const question = await requestQuestion(nextQuestionNumber, priorQuestions);
        const nextQuestions =
          questionsRef.current.length > nextIndex
            ? questionsRef.current
            : [...questionsRef.current, question];
        syncQuestions(nextQuestions);
        updateCurrentIndex(nextIndex);
        void ensureQueue(nextQuestions.slice(0, nextIndex + 1));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the interview question.",
        );
      }
    })();
  }

  function handlePreviousQuestion() {
    if (currentIndex === 0) {
      return;
    }

    updateCurrentIndex(currentIndex - 1);
  }

  function handleFinishInterview() {
    setPhase("summary");
  }

  if (phase === "setup") {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-8 text-slate-100 md:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-8">
          <header className="rounded-[2rem] border border-slate-800/80 bg-slate-900/70 px-4 py-5 shadow-2xl shadow-cyan-950/10 backdrop-blur md:px-6 md:py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300 sm:text-sm">
              Interview Trainer
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Hi Mano Harsha, welcome to your interview trainer
            </h1>
            <p className="mt-4 max-w-[65ch] break-words text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              You&apos;ll go through a realistic structured interview with intro,
              background, sponsorship, salary, technical, and behavioral questions.
            </p>
          </header>

          <section className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/10 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-sm">
                Session Setup
              </p>
              <div className="mt-4 grid gap-4 md:mt-5 md:gap-5 md:grid-cols-2">
                <SetupCard label="Selected Role" value={roleTitle} />
                <SetupCard label="Interview Flow" value="12 structured interview questions" />
              </div>

              {error ? (
                <p className="mt-4 rounded-2xl border border-rose-900/60 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={startInterview}
                  className="min-h-12 w-full rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 sm:w-auto"
                >
                  Start Interview
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/10 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-sm">
                What To Expect
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300 md:mt-5 md:space-y-4 md:text-base md:leading-7">
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                  <span>The interviewer tone is conversational and slightly probing, like a real screen.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                  <span>The first five questions come from your saved interview script, so the session starts instantly.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                  <span>After that, seven generated questions keep preloading in the background so the conversation keeps moving.</span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-10 text-slate-100 md:px-6 md:py-14 lg:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 md:gap-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300 sm:text-sm">
            Preparing Your Interview
          </p>
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-cyan-950/20 md:p-8">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-300" />
              <div>
                <p className="text-lg font-semibold text-white sm:text-xl">Preparing your interview...</p>
                <p className="mt-2 max-w-[65ch] break-words text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
                  Generating your first interview question for {roleTitle}.
                </p>
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800 md:mt-6">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-300" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-10 text-slate-100 md:px-6 md:py-14 lg:px-10">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-rose-900/60 bg-slate-900 p-5 shadow-2xl shadow-rose-950/20 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300 sm:text-sm">
            Practice Interview
          </p>
          <h1 className="mt-4 break-words text-xl font-semibold sm:text-2xl">Couldn&apos;t load the interview question</h1>
          <p className="mt-4 max-w-[65ch] break-words text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            {error ?? "No interview question was returned by the API."}
          </p>
        </div>
      </main>
    );
  }

  if (phase === "summary") {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-8 text-slate-100 md:px-6 md:py-10 lg:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-8">
          <header className="rounded-[2rem] border border-slate-800/80 bg-slate-900/70 px-4 py-5 shadow-2xl shadow-cyan-950/10 backdrop-blur md:px-6 md:py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300 sm:text-sm">
              Interview Summary
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Interview Summary
            </h1>
            <p className="mt-4 max-w-[65ch] break-words text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              Here&apos;s a simple recap of the questions from your latest interview session.
            </p>
          </header>

          <section className="rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/10 md:p-6">
            <div className="space-y-4">
              {questions.map((question, index) => (
                <article
                  key={`${question.question}-${index}`}
                  className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 md:p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                    Question {index + 1}
                  </p>
                  <p className="mt-3 max-w-[65ch] break-words text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
                    {sanitizeText(question.question)}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-cyan-500/20 bg-cyan-400/10 px-4 py-5 text-center md:mt-8 md:px-6">
              <p className="text-base font-medium leading-7 text-cyan-100 sm:text-lg">
                Thanks for visiting again Harsha. Let&apos;s learn and get a job.
              </p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={startInterview}
                className="min-h-[56px] w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Start Interview
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-8 text-slate-100 md:px-6 md:py-10 lg:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:gap-5">
        <header className="rounded-3xl border border-slate-800/80 bg-slate-900/70 px-4 py-4 shadow-2xl shadow-cyan-950/10 backdrop-blur transition-all md:px-5 md:py-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-[0.02em] text-slate-400">
                Interviewer Intent
              </p>
              <p
                className="max-w-[65ch] break-words text-sm leading-7 text-slate-200 sm:text-base sm:leading-7"
                style={JUSTIFIED_TEXT_STYLE}
              >
                {sanitizeText(currentQuestion.interviewer_intent)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm leading-6 text-slate-400">
              <span>
                Question {currentIndex + 1} / {TOTAL_QUESTIONS}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800 md:h-2">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        <section className="grid gap-4">
          <div className="space-y-4 rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/10 backdrop-blur md:space-y-5 md:p-5">
            <article className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 transition-all duration-300 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2
                    className="mt-3 max-w-[65ch] break-words text-lg font-semibold leading-7 text-white sm:text-xl sm:leading-8"
                    style={JUSTIFIED_TEXT_STYLE}
                  >
                    {currentQuestion.question}
                  </h2>
                </div>
                <SpeakButton text={currentQuestion.question} />
              </div>
            </article>

            <ListCard
              title="Expected Points"
              items={currentQuestion.expected_points}
            />

            <InfoCard title="Sample Answer" content={currentQuestion.sample_answer} />

            <LargeExplanationCard content={currentQuestion.explanation} />

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handlePreviousQuestion}
                disabled={currentIndex === 0}
                className="min-h-12 w-full rounded-full border border-slate-700 bg-slate-950/80 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600 sm:w-auto"
              >
                Previous Question
              </button>
              <button
                type="button"
                onClick={isCompleted ? handleFinishInterview : handleNextQuestion}
                className="min-h-12 w-full rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-700 sm:w-auto"
              >
                {currentIndex + 1 >= TOTAL_QUESTIONS ? "Session Complete" : "Next Question"}
              </button>
              {isCompleted ? (
                <button
                  type="button"
                  onClick={startInterview}
                  className="min-h-12 w-full rounded-full border border-cyan-500/40 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/20 sm:w-auto"
                >
                  Practice Again
                </button>
              ) : currentIndex + 1 < TOTAL_QUESTIONS && !queuedQuestions[currentIndex + 2] ? (
                <p className="self-center break-words text-sm text-slate-400">
                  Warming up the next question...
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SetupCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p
        className="mt-3 max-w-[65ch] break-words text-sm font-medium leading-6 text-white sm:text-base sm:leading-7"
        style={JUSTIFIED_TEXT_STYLE}
      >
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const paragraphs = toParagraphs(content, {
    sentenceChunkSize: title === "Sample Answer" ? 2 : 3,
  });

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 md:p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.02em] text-slate-300">
            {title}
          </p>
          <SpeakButton text={content} />
        </div>
        <FormattedParagraphs paragraphs={paragraphs} />
      </div>
    </section>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 md:p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.02em] text-slate-300">
            {title}
          </p>
          <SpeakButton text={items.map((item) => sanitizeText(item)).join(". ")} />
        </div>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 break-words text-sm text-slate-200 sm:text-base">
              <span className="text-cyan-300">•</span>
              <span
                className="max-w-[65ch] break-words leading-7"
                style={JUSTIFIED_TEXT_STYLE}
              >
                {sanitizeText(item)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function LargeExplanationCard({ content }: { content: string }) {
  const sections = toSectionBlocks(content);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 md:p-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.02em] text-slate-300">
            Explanation
          </p>
          <SpeakButton text={content} />
        </div>
        <div className="max-w-5xl space-y-5">
          {sections.map((section, index) => (
            <div key={`${section.title ?? "section"}-${index}`} className="space-y-2">
              {section.title ? (
                <p className="break-words text-sm font-medium leading-6 text-cyan-200 sm:text-base sm:leading-7">
                  {section.title}
                </p>
              ) : null}
              <FormattedParagraphs paragraphs={section.body} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FormattedParagraphs({ paragraphs }: { paragraphs: string[] }): ReactNode {
  if (paragraphs.length === 0) {
    return (
      <p className="max-w-5xl break-words text-sm leading-7 text-slate-200 sm:text-base sm:leading-8">
        No additional details provided.
      </p>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${paragraph.slice(0, 24)}-${index}`}
          className="max-w-[65ch] break-words text-sm leading-7 text-slate-200 sm:text-base sm:leading-7"
          style={JUSTIFIED_TEXT_STYLE}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
