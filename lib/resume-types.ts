export interface ResumeProfile {
  name: string;
  title: string;
  summary: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface ExperienceEntry {
  company: string;
  role: string;
  description: string;
  tools: string[];
  achievements: string[];
}

export interface ProjectEntry {
  title: string;
  description: string;
  tools: string[];
  impact: string;
}

export interface InterviewProjectSummary {
  title: string;
  description: string;
  tools: string[];
  impact: string;
  score: number;
}

export interface InterviewProfile {
  keyStrengths: string[];
  coreTools: string[];
  topProjects: InterviewProjectSummary[];
  interviewTopics: string[];
  behavioralThemes: string[];
  weakAreas: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  year: string;
}

export interface ResumeData {
  profile: ResumeProfile;
  skills: SkillCategory[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  weakAreas?: string[];
}
