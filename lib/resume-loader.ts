import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ResumeData } from "@/lib/resume-types";

const RESUME_FILE_PATH = path.join(process.cwd(), "data", "master_resume.json");

export async function getResumeData(): Promise<ResumeData> {
  const fileContents = await readFile(RESUME_FILE_PATH, "utf-8");

  return JSON.parse(fileContents) as ResumeData;
}
