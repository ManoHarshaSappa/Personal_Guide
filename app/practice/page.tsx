import { PracticeInterview } from "@/components/practice-interview";
import { getResumeData } from "@/lib/resume-loader";

export default async function PracticePage() {
  const resume = await getResumeData();

  return <PracticeInterview roleTitle={resume.profile.title} />;
}
