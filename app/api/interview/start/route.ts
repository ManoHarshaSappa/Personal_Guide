import { NextResponse } from "next/server";

import type {
  InterviewQuestion,
  InterviewQuestionType,
  StartInterviewRequest,
} from "@/lib/interview-types";
import { getInterviewPlaybook } from "@/lib/interview-playbook";
import { parseJsonResponse } from "@/lib/json-response";
import { buildInterviewProfile } from "@/lib/resume-normalizer";
import { getResumeData } from "@/lib/resume-loader";
import { callLLM, type JsonSchemaFormat } from "@/lib/openai";

export const runtime = "nodejs";

const INTERVIEW_QUESTION_SCHEMA: JsonSchemaFormat = {
  type: "json_schema",
  name: "structured_interview_question",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "question",
      "type",
      "interviewer_intent",
      "expected_points",
      "sample_answer",
      "explanation",
    ],
    properties: {
      question: { type: "string" },
      type: {
        type: "string",
        enum: [
          "intro",
          "experience",
          "technical",
          "behavioral",
          "hr",
          "closing",
        ],
      },
      interviewer_intent: { type: "string" },
      expected_points: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
      },
      sample_answer: { type: "string" },
      explanation: { type: "string" },
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRequestBody(body: unknown): StartInterviewRequest {
  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const { question_number: questionNumber, previous_questions: previousQuestions } = body;

  if (
    typeof questionNumber !== "number" ||
    !Number.isInteger(questionNumber) ||
    questionNumber < 1 ||
    questionNumber > 12
  ) {
    throw new Error("question_number must be an integer between 1 and 12.");
  }

  if (
    previousQuestions !== undefined &&
    (!Array.isArray(previousQuestions) ||
      !previousQuestions.every((item) => typeof item === "string"))
  ) {
    throw new Error("previous_questions must be an array of strings.");
  }

  return {
    question_number: questionNumber,
    previous_questions: previousQuestions?.map((item) => item.trim()).filter(Boolean) ?? [],
  };
}

function buildInterviewPrompt(input: {
  questionNumber: number;
  previousQuestions: string[];
  resume: Awaited<ReturnType<typeof getResumeData>>;
  profile: ReturnType<typeof buildInterviewProfile>;
  playbook: Awaited<ReturnType<typeof getInterviewPlaybook>>;
}): string {
  const slotInstructions = [
    "1. intro",
    "2. hr",
    "3. hr",
    "4. hr",
    "5. hr",
    "6. experience",
    "7. technical",
    "8. technical",
    "9. technical",
    "10. technical",
    "11. behavioral",
    "12. closing",
  ];

  return [
    "You are a real hiring manager conducting a structured interview.",
    "Your goal is to simulate a realistic interview based on the candidate's resume and real-world interview patterns.",
    "You are also generating strong interview-ready answers that should sound like a clear, professional, concise mid-level to senior candidate.",
    "Learn the pattern, tone, and depth from the reference questions, but do not repeat those exact questions.",
    "Generate similar but improved questions adapted to the candidate's resume.",
    `Generate only question number ${input.questionNumber} in the structured 12-question flow.`,
    "Use this exact slot mapping:",
    ...slotInstructions,
    "Ask like a real interviewer. Be conversational, slightly probing, and natural.",
    "Questions 1 through 5 are handled elsewhere in the product as fixed opening questions, so when generating question 6 through 12 you should continue the interview naturally without repeating those openings.",
    "Question 7 should ask the candidate to explain a project or pipeline end to end.",
    "Questions 8 through 10 should go deeper into architecture, challenges, scaling, optimization, SQL, dbt, Snowflake, Airflow, orchestration, or related tools if supported by the resume.",
    "Question 11 should be a strong behavioral question grounded in teamwork, ownership, pressure, conflict, or ambiguity.",
    "Question 12 should close professionally by inviting the candidate to ask questions.",
    "Do not repeat or closely paraphrase any previous question from this session.",
    "For intro, experience, hr, behavioral, and closing questions, set explanation to an empty string.",
    "For those non-technical question types, provide interviewer_intent, expected_points, and sample_answer only.",
    "For technical questions, provide a full explanation that teaches what the interviewer is testing, how to structure the answer, and why the answer is strong.",
    "Technical questions must be deep and resume-based and should include architecture discussion, challenges, and scaling or optimization angles.",
    "Every sample_answer must follow this exact structure:",
    "Context:",
    "Action:",
    "Result:",
    "Keep the language natural, human, confident, professional, and direct.",
    "Do not sound robotic or textbook-like.",
    "Focus on real-world implementation, tools used, and measurable outcomes where possible.",
    "Avoid repetition, filler, generic statements, and unnecessary theory.",
    "If a draft answer would exceed the word limit, automatically shorten it while preserving meaning.",
    "For HR, yes/no, salary, authorization, and similar short questions, keep sample_answer between 30 and 60 words.",
    "For standard experience, background, behavioral, and project-summary questions, keep sample_answer between 80 and 120 words.",
    "For deep technical questions, keep sample_answer between 120 and 180 words.",
    "Never exceed 180 words in any sample_answer.",
    "Sample answers should stay grounded in the candidate's real experience.",
    "Keep expected_points to 3 to 5 bullets max.",
    "Keep non-technical answers concise.",
    "Return ONLY valid JSON.",
    "",
    "CANDIDATE DATA",
    "Resume:",
    JSON.stringify(input.resume, null, 2),
    "",
    "Interview Playbook:",
    JSON.stringify(input.playbook, null, 2),
    "",
    "Reference Questions (optional):",
    JSON.stringify(
      [
        "Can you introduce yourself?",
        "Can you walk me through your experience working in analytics and data science roles?",
        "Can you explain the data pipeline or project you worked on?",
        "How have you used dbt in your previous projects?",
        "Can you provide an example of a dbt model you built?",
        "How did you write and optimize SQL queries in your project?",
        "What was your role in building, maintaining, and orchestrating pipelines using Airflow?",
        "Can you describe a specific problem you faced while using Airflow and how you resolved it?",
        "What experience do you have with large datasets using tools like Redshift or Databricks?",
        "Is there any particular experience you'd like to highlight that we haven't discussed?",
        "How do you approach learning tools or technologies you're not familiar with?",
        "Do you require sponsorship?",
        "Are you eligible to work on a W-2 basis in the U.S.?",
        "What are your salary expectations?",
        "Do you have any offers in hand?",
        "What is most important to you in a new role?",
        "How would you describe your ideal team and hiring manager?",
        "What is your availability this week and next week?",
        "Do you have any commitments or constraints in the next 90 days?",
        "If an offer is made, when can you start?",
        "Do you have any questions for us?",
        ...(input.playbook.referenceQuestions ?? []),
      ],
      null,
      2,
    ),
    "",
    "Derived Interview Profile:",
    JSON.stringify(
      {
        keyStrengths: input.profile.keyStrengths,
        coreTools: input.profile.coreTools,
        topProjects: input.profile.topProjects.map((project) => ({
          title: project.title,
          tools: project.tools,
          impact: project.impact,
        })),
        weakAreas: input.profile.weakAreas,
      },
      null,
      2,
    ),
    "",
    "Previous questions already asked in this session:",
    JSON.stringify(input.previousQuestions, null, 2),
  ].join("\n");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isQuestionType(value: unknown): value is InterviewQuestionType {
  return (
    value === "intro" ||
    value === "experience" ||
    value === "technical" ||
    value === "behavioral" ||
    value === "hr" ||
    value === "closing"
  );
}

function isInterviewQuestion(value: unknown): value is InterviewQuestion {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.question === "string" &&
    isQuestionType(value.type) &&
    typeof value.interviewer_intent === "string" &&
    isStringArray(value.expected_points) &&
    typeof value.sample_answer === "string" &&
    typeof value.explanation === "string"
  );
}

function parseInterviewQuestion(raw: string): InterviewQuestion {
  let parsed: unknown;

  try {
    parsed = parseJsonResponse(raw);
  } catch {
    console.error("Interview start raw OpenAI output:", raw.slice(0, 1200));
    throw new Error(
      "The interview generator returned an incomplete response. Please try again.",
    );
  }

  if (
    !isRecord(parsed) ||
    !isInterviewQuestion(parsed)
  ) {
    throw new Error("OpenAI returned malformed interview question.");
  }

  return parsed as InterviewQuestion;
}

export async function POST(request: Request) {
  try {
    const input = parseRequestBody(await request.json());
    const resume = await getResumeData();
    const profile = buildInterviewProfile(resume);
    const playbook = await getInterviewPlaybook();

    const rawResponse = await callLLM(
      buildInterviewPrompt({
        questionNumber: input.question_number,
        previousQuestions: input.previous_questions ?? [],
        resume,
        profile,
        playbook,
      }),
      {
        instructions:
          "You are an experienced hiring manager and interviewer. Generate one realistic interview question in valid JSON that exactly matches the schema.",
        format: INTERVIEW_QUESTION_SCHEMA,
        maxOutputTokens: 2600,
      },
    );

    return NextResponse.json(parseInterviewQuestion(rawResponse));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start interview session.";

    const status =
      error instanceof SyntaxError ||
      message.includes("Invalid") ||
      message.includes("Request body")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
