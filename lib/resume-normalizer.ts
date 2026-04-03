import type {
  InterviewProfile,
  InterviewProjectSummary,
  ProjectEntry,
  ResumeData,
} from "@/lib/resume-types";

interface TopicRule {
  topic: string;
  keywords: string[];
}

interface BehavioralRule {
  theme: string;
  keywords: string[];
}

const INTERVIEW_TOPIC_RULES: TopicRule[] = [
  { topic: "SQL", keywords: ["sql", "postgres", "mysql", "database", "query"] },
  {
    topic: "Data Pipelines",
    keywords: ["pipeline", "pipelines", "workflow", "orchestration", "airflow"],
  },
  { topic: "ETL", keywords: ["etl", "elt", "data integration", "transformation"] },
  { topic: "Cloud", keywords: ["aws", "azure", "gcp", "cloud", "vercel"] },
  {
    topic: "Machine Learning",
    keywords: ["ml", "machine learning", "model", "training", "prediction"],
  },
  {
    topic: "Dashboards",
    keywords: ["dashboard", "visualization", "reporting", "bi", "analytics"],
  },
  {
    topic: "Frontend Engineering",
    keywords: ["react", "next.js", "frontend", "ui", "tailwind", "typescript"],
  },
  {
    topic: "APIs",
    keywords: ["api", "rest", "graphql", "endpoint", "backend"],
  },
  {
    topic: "Testing and Quality",
    keywords: ["test", "testing", "qa", "quality", "debugging"],
  },
];

const BEHAVIORAL_THEME_RULES: BehavioralRule[] = [
  {
    theme: "Teamwork",
    keywords: ["team", "partnered", "collaborated", "cross-functional", "stakeholder"],
  },
  {
    theme: "Leadership",
    keywords: ["led", "managed", "mentored", "owned", "drove", "initiated"],
  },
  {
    theme: "Problem Solving",
    keywords: ["solved", "improved", "optimized", "fixed", "streamlined", "built"],
  },
  {
    theme: "Handling Challenges",
    keywords: ["challenge", "constraint", "blocked", "issue", "incident", "tight deadline"],
  },
  {
    theme: "Execution and Ownership",
    keywords: ["delivered", "launched", "implemented", "owned", "end-to-end"],
  },
];

const IMPACT_KEYWORDS = [
  "improved",
  "increased",
  "reduced",
  "optimized",
  "automated",
  "launched",
  "delivered",
  "scaled",
  "saved",
  "%",
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueSortedByScore(scoreMap: Map<string, number>, limit: number): string[] {
  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function addScore(scoreMap: Map<string, number>, value: string, amount: number): void {
  if (!value) {
    return;
  }

  scoreMap.set(value, (scoreMap.get(value) ?? 0) + amount);
}

function getAllNarrativeText(resume: ResumeData): string[] {
  return [
    resume.profile.summary,
    ...resume.experience.flatMap((entry) => [entry.description, ...entry.achievements]),
    ...resume.projects.flatMap((project) => [project.description, project.impact]),
  ];
}

function collectToolScores(resume: ResumeData): Map<string, number> {
  const toolScores = new Map<string, number>();

  for (const category of resume.skills) {
    for (const item of category.items) {
      addScore(toolScores, item, 2);
    }
  }

  for (const entry of resume.experience) {
    for (const tool of entry.tools) {
      addScore(toolScores, tool, 3);
    }
  }

  for (const project of resume.projects) {
    for (const tool of project.tools) {
      addScore(toolScores, tool, 2);
    }
  }

  return toolScores;
}

function extractKeyStrengths(
  resume: ResumeData,
  toolScores: Map<string, number>,
): string[] {
  const strengths = new Map<string, number>();
  const strongestTools = uniqueSortedByScore(toolScores, 4);

  for (const tool of strongestTools) {
    addScore(strengths, tool, toolScores.get(tool) ?? 0);
  }

  for (const category of resume.skills) {
    const label = category.category;
    const categoryWeight = category.items.length + 1;
    addScore(strengths, label, categoryWeight);
  }

  for (const project of resume.projects) {
    const complexityScore = scoreProject(project);
    if (complexityScore >= 7) {
      addScore(strengths, `${project.title} Delivery`, complexityScore);
    }
  }

  return uniqueSortedByScore(strengths, 6);
}

function scoreProject(project: ProjectEntry): number {
  let score = project.tools.length * 2;

  const text = normalizeText(`${project.description} ${project.impact}`);

  for (const keyword of IMPACT_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 2;
    }
  }

  if (/\d/.test(text)) {
    score += 2;
  }

  if (project.description.split(/\s+/).length > 12) {
    score += 1;
  }

  return score;
}

function extractTopProjects(resume: ResumeData): InterviewProjectSummary[] {
  return resume.projects
    .map((project) => ({
      ...project,
      score: scoreProject(project),
    }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 3);
}

function extractInterviewTopics(
  resume: ResumeData,
  toolScores: Map<string, number>,
): string[] {
  const topics = new Map<string, number>();
  const searchableText = normalizeText(
    [
      ...getAllNarrativeText(resume),
      ...resume.skills.map((category) => category.category),
      ...[...toolScores.keys()],
    ].join(" "),
  );

  for (const rule of INTERVIEW_TOPIC_RULES) {
    const matches = rule.keywords.filter((keyword) => searchableText.includes(keyword)).length;

    if (matches > 0) {
      addScore(topics, rule.topic, matches);
    }
  }

  return uniqueSortedByScore(topics, 6);
}

function extractBehavioralThemes(resume: ResumeData): string[] {
  const themes = new Map<string, number>();
  const searchableText = normalizeText(getAllNarrativeText(resume).join(" "));

  for (const rule of BEHAVIORAL_THEME_RULES) {
    const matches = rule.keywords.filter((keyword) => searchableText.includes(keyword)).length;

    if (matches > 0) {
      addScore(themes, rule.theme, matches);
    }
  }

  if (themes.size === 0 && resume.experience.length > 0) {
    addScore(themes, "Problem Solving", 1);
    addScore(themes, "Execution and Ownership", 1);
  }

  return uniqueSortedByScore(themes, 5);
}

function inferWeakAreas(resume: ResumeData, topics: string[], themes: string[]): string[] {
  if (resume.weakAreas && resume.weakAreas.length > 0) {
    return [...new Set(resume.weakAreas.map((area) => area.trim()).filter(Boolean))];
  }

  const searchableText = normalizeText(
    [
      ...getAllNarrativeText(resume),
      ...resume.skills.flatMap((category) => category.items),
      ...resume.projects.flatMap((project) => project.tools),
      ...resume.experience.flatMap((entry) => entry.tools),
    ].join(" "),
  );

  const weakAreas: string[] = [];

  if (
    !topics.includes("Cloud") &&
    !["aws", "azure", "gcp", "cloud", "infrastructure"].some((keyword) =>
      searchableText.includes(keyword),
    )
  ) {
    weakAreas.push("Limited demonstrated cloud depth");
  }

  if (
    !["architecture", "system design", "scalability", "distributed", "microservices"].some(
      (keyword) => searchableText.includes(keyword),
    )
  ) {
    weakAreas.push("Limited evidence of system design experience");
  }

  if (
    !themes.includes("Leadership") &&
    !["led", "managed", "mentored", "owned"].some((keyword) => searchableText.includes(keyword))
  ) {
    weakAreas.push("Few explicit leadership examples");
  }

  if (
    !["test", "testing", "qa", "quality"].some((keyword) => searchableText.includes(keyword))
  ) {
    weakAreas.push("Limited visible testing and quality signals");
  }

  return weakAreas;
}

export function buildInterviewProfile(resume: ResumeData): InterviewProfile {
  const toolScores = collectToolScores(resume);
  const coreTools = uniqueSortedByScore(toolScores, 8);
  const topProjects = extractTopProjects(resume);
  const interviewTopics = extractInterviewTopics(resume, toolScores);
  const behavioralThemes = extractBehavioralThemes(resume);

  return {
    keyStrengths: extractKeyStrengths(resume, toolScores),
    coreTools,
    topProjects,
    interviewTopics,
    behavioralThemes,
    weakAreas: inferWeakAreas(resume, interviewTopics, behavioralThemes),
  };
}
