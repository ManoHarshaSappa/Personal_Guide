import type { ResumeData } from "@/lib/resume-types";

interface ResumeFoundationProps {
  resume: ResumeData;
}

export function ResumeFoundation({ resume }: ResumeFoundationProps) {
  const sections = [
    { label: "Skill Categories", value: resume.skills.length },
    { label: "Experience Entries", value: resume.experience.length },
    { label: "Projects", value: resume.projects.length },
    { label: "Education Records", value: resume.education.length },
    { label: "Certifications", value: resume.certifications.length },
  ];

  return (
    <section className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Resume Foundation
        </p>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
            {resume.profile.name}
          </h1>
          <p className="text-lg text-slate-700">{resume.profile.title}</p>
        </div>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          {resume.profile.summary}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {sections.map((section) => (
          <article
            key={section.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <p className="text-sm text-slate-500">{section.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {section.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
