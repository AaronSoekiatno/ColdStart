import type { StructuredResumeData } from "@/types/resume";

/**
 * Builds a standalone HTML document for the resume using the same structure
 * as Jake's template, but without importing React components. This keeps it
 * safe to use in server-only contexts (like Puppeteer PDF export).
 */
export function renderResumeTemplateHtml(data: StructuredResumeData): string {
  const lines: string[] = [];

  const esc = (value: string | undefined | null) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const push = (s: string) => lines.push(s);

  push("<!doctype html>");
  push("<html>");
  push("<head>");
  push('<meta charset="utf-8" />');
  push("<title>Resume</title>");
  push(`<style>
  :root { color-scheme: light; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  .resume-container {
    max-width: 8.5in;
    margin: 0 auto;
    padding: 0 12px 12px 12px; /* no top padding */
    color: #111827;
  }
  h1 {
    font-size: 20pt;
    margin: 0 0 2px 0;
    text-align: center;
  }
  .contact {
    font-size: 10pt;
    color: #4b5563;
    text-align: center;
    margin-bottom: 18px;
  }
  h2 {
    font-size: 11pt;
    margin: 12px 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #111827;
    padding-bottom: 2px;
  }
  h3 {
    font-size: 10pt;
    margin: 2px 0 0;
  }
  p, li {
    font-size: 8.5pt;
    line-height: 1.28;
    margin: 1px 0;
  }
  ul {
    margin: 4px 0 6px 18px;
    padding: 0;
  }
  .meta {
    font-size: 9pt;
    color: #4b5563;
  }
  .section-spacer {
    margin-top: 4px;
  }
  </style>`);
  push("</head>");
  push("<body>");
  push('<div class="resume-container">');

  // Header
  push(`<h1>${esc(data.personal.name)}</h1>`);
  const contactParts: string[] = [];
  if (data.personal.email) contactParts.push(esc(data.personal.email));
  if (data.personal.phone) contactParts.push(esc(data.personal.phone));
  if (data.personal.location) contactParts.push(esc(data.personal.location));
  if (data.personal.linkedin) contactParts.push(esc(data.personal.linkedin));
  if (data.personal.github) contactParts.push(esc(data.personal.github));
  if (data.personal.website) contactParts.push(esc(data.personal.website));
  if (contactParts.length > 0) {
    push(`<div class="contact">${contactParts.join(" | ")}</div>`);
  }

  // Education
  if (data.education && data.education.length > 0) {
    push("<h2>Education</h2>");
    for (const edu of data.education) {
      const title = [edu.school, edu.degree].filter(Boolean).join(" — ");
      if (title || edu.location || edu.graduationDate) {
        push(
          `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">` +
            `<h3 style="margin:2px 0 0;font-size:10.5pt;">${esc(title)}</h3>` +
            (edu.location || edu.graduationDate
              ? `<div class="meta" style="display:flex;align-items:flex-start;gap:6px;white-space:nowrap;margin-left:8px;font-style:italic;">` +
                  (edu.location ? `<span>${esc(edu.location)}</span>` : "") +
                  (edu.location && edu.graduationDate ? `<span>|</span>` : "") +
                  (edu.graduationDate ? `<span>${esc(edu.graduationDate)}</span>` : "") +
                `</div>`
              : "") +
          `</div>`
        );
      }

      const details: string[] = [];
      if (edu.major) details.push(`Major: ${esc(edu.major)}`);
      if (edu.minor) details.push(`Minor: ${esc(edu.minor)}`);
      if (edu.honors) details.push(esc(edu.honors));
      if (edu.gpa) details.push(`GPA: ${esc(edu.gpa)}`);
      if (details.length > 0) push(`<p style="margin-top:4px;margin-bottom:4px;">${details.join(" | ")}</p>`);

      if (edu.relevantCourses && edu.relevantCourses.length > 0) {
        push(`<p>Relevant Courses: ${edu.relevantCourses.map(esc).join(", ")}</p>`);
      }
      push('<div class="section-spacer"></div>');
    }
  }

  // Experience
  if (data.experience && data.experience.length > 0) {
    push("<h2>Experience</h2>");
    for (const exp of data.experience) {
      push('<div class="section-spacer">');
      // Title + dates on the same row
      push('<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">');
      push(`<div style="font-weight:700;font-size:10pt;">${esc(exp.title)}</div>`);
      const dates =
        exp.startDate && exp.endDate
          ? `${esc(exp.startDate)} — ${esc(exp.endDate)}`
          : esc(exp.startDate || exp.endDate || "");
      push(`<div class="meta" style="white-space:nowrap;font-style:italic;">${dates}</div>`);
      push("</div>");

      // Company line
      push(`<div style="font-size:9.5pt;font-style:italic;margin-top:2px;">${esc(exp.company)}</div>`);
      // Location line
      if (exp.location) {
        push(`<div class="meta">${esc(exp.location)}</div>`);
      }

      // Bullets
      if (Array.isArray(exp.description) && exp.description.length > 0) {
        push("<ul>");
        for (const bullet of exp.description) {
          const text = String(bullet || "").trim();
          if (!text) continue;
          push(`<li>${esc(text)}</li>`);
        }
        push("</ul>");
      }
      push("</div>");
    }
  }

  // Projects
  if (data.projects && data.projects.length > 0) {
    push("<h2>Projects</h2>");
    for (const proj of data.projects) {
      let title = `<span>${esc(proj.name)}</span>`;
      if (proj.technologies && proj.technologies.length > 0) {
        title += ` <span style="font-size:9pt;font-style:italic;">— ${esc(proj.technologies.join(", "))}</span>`;
      }
      push(`<h3>${title}</h3>`);

      if (Array.isArray(proj.description) && proj.description.length > 0) {
        push("<ul>");
        for (const bullet of proj.description) {
          const text = String(bullet || "").trim();
          if (!text) continue;
          push(`<li>${esc(text)}</li>`);
        }
        push("</ul>");
      }
      push('<div class="section-spacer"></div>');
    }
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    push("<h2>Skills</h2>");
    push(`<p>${esc(data.skills.join(", "))}</p>`);
  }

  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    push("<h2>Certifications</h2>");
    for (const cert of data.certifications) {
      const text = String(cert || "").trim();
      if (!text) continue;
      push(`<p>${esc(text)}</p>`);
    }
  }

  push("</div>"); // resume-container
  push("</body>");
  push("</html>");

  return lines.join("");
}



