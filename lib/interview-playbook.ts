import { readFile } from "node:fs/promises";
import path from "node:path";

export interface InterviewStory {
  topic: string;
  strategy: string;
  script: string;
}

export interface InterviewPlaybook {
  candidateContext: {
    targetBackground: string[];
    education: string;
    positioning: string;
  };
  answerStyle: {
    tone: string[];
    guidance: string[];
  };
  coreStories: InterviewStory[];
  questionsForInterviewer: string[];
  referenceQuestions?: string[];
  focusTopics: string[];
}

const PLAYBOOK_FILE_PATH = path.join(
  process.cwd(),
  "data",
  "interview-playbook.json",
);

export async function getInterviewPlaybook(): Promise<InterviewPlaybook> {
  const fileContents = await readFile(PLAYBOOK_FILE_PATH, "utf-8");

  return JSON.parse(fileContents) as InterviewPlaybook;
}
