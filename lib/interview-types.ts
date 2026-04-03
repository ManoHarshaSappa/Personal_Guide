export type InterviewQuestionType =
  | "intro"
  | "experience"
  | "technical"
  | "behavioral"
  | "hr"
  | "closing";

export interface StartInterviewRequest {
  question_number: number;
  previous_questions?: string[];
}

export interface InterviewQuestion {
  question: string;
  type: InterviewQuestionType;
  interviewer_intent: string;
  expected_points: string[];
  sample_answer: string;
  explanation: string;
}

export interface StaticInterviewFlowQuestion {
  question: string;
  question_variations?: string[];
  type: InterviewQuestionType;
  interviewer_intent: string;
  expected_points: string[];
  sample_answer?: string;
  answerOptions?: string[];
  explanation: string;
}
