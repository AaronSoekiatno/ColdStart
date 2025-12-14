/**
 * Converts resume text to LaTeX format using template-based approach
 * This is a free alternative to using Gemini API for LaTeX generation
 */

interface ResumeSection {
  title: string;
  content: string[];
}

/**
 * Parses resume text into sections
 */
function parseResumeText(text: string): ResumeSection[] {
  const sections: ResumeSection[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let currentSection: ResumeSection | null = null;

  // Common section headers (case insensitive)
  const sectionHeaders = [
    'education', 'experience', 'work experience', 'skills', 'technical skills',
    'projects', 'technical projects', 'certifications', 'achievements',
    'summary', 'objective', 'profile', 'contact', 'internships'
  ];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check if this line is a section header
    const isHeader = sectionHeaders.some(header =>
      lowerLine === header || lowerLine.startsWith(header + ':') || lowerLine.startsWith(header + ' ')
    );

    if (isHeader) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      // Start new section
      currentSection = {
        title: line.replace(':', '').trim(),
        content: []
      };
    } else if (currentSection) {
      // Add content to current section
      currentSection.content.push(line);
    } else {
      // Content before first section (likely name/contact info)
      if (sections.length === 0) {
        sections.push({
          title: 'Header',
          content: [line]
        });
      } else {
        sections[0].content.push(line);
      }
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Escapes special LaTeX characters
 */
function escapeLaTeX(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, '\\$&')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Converts a resume section to LaTeX
 */
function sectionToLaTeX(section: ResumeSection): string {
  const title = escapeLaTeX(section.title);
  const content = section.content;

  if (section.title.toLowerCase() === 'header') {
    // Header section (name and contact)
    return content.map(line => {
      if (line.length > 0) {
        return `{\\Large \\textbf{${escapeLaTeX(line)}}}\\\\[0.2cm]`;
      }
      return '';
    }).join('\n');
  }

  // Regular section
  let latex = `\\section*{${title}}\n`;

  // Check if content looks like a list (bullet points)
  const hasBullets = content.some(line => line.startsWith('-') || line.startsWith('•') || line.startsWith('*'));

  if (hasBullets || content.length > 3) {
    latex += '\\begin{itemize}\n';
    for (const line of content) {
      const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
      if (cleanLine.length > 0) {
        latex += `  \\item ${escapeLaTeX(cleanLine)}\n`;
      }
    }
    latex += '\\end{itemize}\n';
  } else {
    // Simple paragraph
    for (const line of content) {
      if (line.length > 0) {
        latex += `${escapeLaTeX(line)}\\\\[0.2cm]\n`;
      }
    }
  }

  return latex;
}

/**
 * Converts resume full text to LaTeX
 */
export function convertResumeToLaTeX(fullText: string): string {
  const sections = parseResumeText(fullText);

  const latex = `\\documentclass[11pt,a4paper]{article}

% Packages
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}

% Remove page numbers
\\pagestyle{empty}

% Section formatting
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{12pt}{6pt}

% List formatting
\\setlist[itemize]{leftmargin=*,nosep}

\\begin{document}

${sections.map(section => sectionToLaTeX(section)).join('\n\n')}

\\end{document}
`;

  return latex;
}
