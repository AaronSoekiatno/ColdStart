import type { StructuredResumeData } from "@/types/resume";

/**
 * Converts structured resume data (used in Jake's template) into a plain-text
 * representation suitable for PDF generation. This keeps sections and bullets
 * close to what users see in the preview.
 */
export function structuredResumeToPlainText(data: StructuredResumeData): string {
  const lines: string[] = [];

  // Header: name
  lines.push(data.personal.name);

  // Contact line
  const contactParts: string[] = [];
  if (data.personal.email) contactParts.push(data.personal.email);
  if (data.personal.phone) contactParts.push(data.personal.phone);
  if (data.personal.location) contactParts.push(data.personal.location);
  if (data.personal.website) contactParts.push(data.personal.website);
  if (data.personal.linkedin) contactParts.push(data.personal.linkedin);
  if (data.personal.github) contactParts.push(data.personal.github);
  if (contactParts.length > 0) {
    lines.push(contactParts.join(" | "));
  }

  // Experience
  if (data.experience && data.experience.length > 0) {
    lines.push("", "EXPERIENCE");
    for (const exp of data.experience) {
      const titleCompany = [exp.title, exp.company].filter(Boolean).join(" - ");
      if (titleCompany) lines.push(titleCompany);

      const metaParts: string[] = [];
      if (exp.location) metaParts.push(exp.location);
      const dates =
        exp.startDate && exp.endDate
          ? `${exp.startDate} - ${exp.endDate}`
          : exp.startDate || exp.endDate || "";
      if (dates) metaParts.push(dates);
      if (metaParts.length > 0) lines.push(metaParts.join(" | "));

      if (Array.isArray(exp.description)) {
        for (const bullet of exp.description) {
          const text = String(bullet || "").trim();
          if (text) lines.push(`• ${text}`);
        }
      }
      lines.push(""); // spacer between roles
    }
  }

  // Education
  if (data.education && data.education.length > 0) {
    lines.push("", "EDUCATION");
    for (const edu of data.education) {
      const schoolLine = [edu.degree, edu.school].filter(Boolean).join(" - ");
      if (schoolLine) lines.push(schoolLine);

      const metaParts: string[] = [];
      if (edu.location) metaParts.push(edu.location);
      if (edu.graduationDate) metaParts.push(edu.graduationDate);
      if (metaParts.length > 0) lines.push(metaParts.join(" | "));

      const detailParts: string[] = [];
      if (edu.major) detailParts.push(`Major: ${edu.major}`);
      if (edu.minor) detailParts.push(`Minor: ${edu.minor}`);
      if (edu.honors) detailParts.push(edu.honors);
      if (detailParts.length > 0) lines.push(detailParts.join(" | "));

      if (edu.relevantCourses && edu.relevantCourses.length > 0) {
        lines.push(`Relevant Courses: ${edu.relevantCourses.join(", ")}`);
      }
      lines.push("");
    }
  }

  // Projects
  if (data.projects && data.projects.length > 0) {
    lines.push("", "PROJECTS");
    for (const proj of data.projects) {
      const techLine =
        proj.technologies && proj.technologies.length > 0
          ? ` (${proj.technologies.join(", ")})`
          : "";
      lines.push(`${proj.name}${techLine}`);

      if (Array.isArray(proj.description)) {
        for (const bullet of proj.description) {
          const text = String(bullet || "").trim();
          if (text) lines.push(`• ${text}`);
        }
      }
      lines.push("");
    }
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    lines.push("", "SKILLS");
    lines.push(data.skills.join(", "));
  }

  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    lines.push("", "CERTIFICATIONS");
    for (const cert of data.certifications) {
      const text = String(cert || "").trim();
      if (text) lines.push(text);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n"); // collapse extra blank lines
}


