"use client";

import type { StructuredResumeData, ExperienceItem, EducationItem, ProjectItem } from '@/types/resume';

interface JakesResumeTemplateProps {
  data: StructuredResumeData;
  highlightedFields?: Set<string>; // Field paths like "experience[0].description[1]"
}

export function JakesResumeTemplate({ data, highlightedFields = new Set() }: JakesResumeTemplateProps) {
  const isHighlighted = (fieldPath: string) => highlightedFields.has(fieldPath);

  return (
    <div className="w-full h-full overflow-auto bg-white">
      <div className="max-w-[8.5in] mx-auto p-8 text-sm leading-[1.4] text-gray-900" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold mb-1" style={{ fontSize: '24pt', letterSpacing: '0.5px' }}>
            {data.personal.name}
          </h1>
          <div className="flex flex-wrap justify-center gap-1 text-xs text-gray-700">
            {data.personal.phone && (
              <span>{data.personal.phone}</span>
            )}
            {data.personal.phone && data.personal.email && <span> | </span>}
            {data.personal.email && (
              <span><a href={`mailto:${data.personal.email}`} className="text-gray-900 hover:underline">{data.personal.email}</a></span>
            )}
            {data.personal.email && data.personal.linkedin && <span> | </span>}
            {data.personal.linkedin && (
              <span><a href={data.personal.linkedin} className="text-gray-900 hover:underline">{data.personal.linkedin.replace(/^https?:\/\//, '')}</a></span>
            )}
            {data.personal.linkedin && data.personal.github && <span> | </span>}
            {data.personal.github && (
              <span><a href={data.personal.github} className="text-gray-900 hover:underline">{data.personal.github.replace(/^https?:\/\//, '')}</a></span>
            )}
          </div>
        </div>

        {/* Summary */}
        {data.summary && (
          <div className={`mb-3 ${isHighlighted('summary') ? 'bg-green-50 px-2 py-1 border-l-2 border-green-400' : ''}`}>
            <p className="text-justify text-sm leading-relaxed">{data.summary}</p>
          </div>
        )}

        {/* Education */}
        {data.education.length > 0 && (
          <div className="mb-3">
            <h2 className="text-base font-bold uppercase mb-2 pb-1 border-b border-gray-800 tracking-wide" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Education
            </h2>
            {data.education.map((edu, eduIdx) => (
              <div key={edu.id} className="mb-2">
                <div className="flex justify-between items-start mb-0.5">
                  <div className="flex-1">
                    <div className="font-bold text-sm">{edu.school}</div>
                    <div className="text-sm italic text-gray-700">
                      {edu.degree}
                      {edu.honors && `, ${edu.honors}`}
                    </div>
                  </div>
                  <div className="text-right text-xs whitespace-nowrap ml-4 italic">
                    {edu.graduationDate || ''}
                  </div>
                </div>
                {edu.location && (
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs italic text-gray-700">{edu.location}</div>
                    {edu.gpa && (
                      <div className="text-xs italic text-gray-700 ml-4">{edu.gpa}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Experience */}
        {data.experience.length > 0 && (
          <div className="mb-3">
            <h2 className="text-base font-bold uppercase mb-2 pb-1 border-b border-gray-800 tracking-wide" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Experience
            </h2>
            {data.experience.map((exp, expIdx) => (
              <div key={exp.id} className="mb-2">
                <div className="flex justify-between items-start mb-0.5">
                  <div className="flex-1">
                    <div className="font-bold text-sm">{exp.title}</div>
                    <div className="text-sm italic text-gray-700">{exp.company}</div>
                  </div>
                  <div className="text-right text-xs whitespace-nowrap ml-4 italic">
                    {exp.startDate} -- {exp.endDate}
                  </div>
                </div>
                {exp.location && (
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs italic text-gray-700">{exp.location}</div>
                  </div>
                )}
                <ul className="list-none ml-4 mt-0.5 space-y-0.5">
                  {exp.description.map((bullet, bulletIdx) => {
                    const fieldPath = `experience[${expIdx}].description[${bulletIdx}]`;
                    return (
                      <li
                        key={bulletIdx}
                        className={`text-xs leading-relaxed ${isHighlighted(fieldPath) ? 'bg-green-50 px-1 border-l-2 border-green-400' : ''}`}
                      >
                        <span className="mr-1.5">•</span>
                        {bullet}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Projects */}
        {data.projects && data.projects.length > 0 && (
          <div className="mb-3">
            <h2 className="text-base font-bold uppercase mb-2 pb-1 border-b border-gray-800 tracking-wide" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Projects
            </h2>
            {data.projects.map((project, projIdx) => {
              const fieldPath = `projects[${projIdx}]`;
              return (
                <div
                  key={project.id}
                  className={`mb-2 ${isHighlighted(fieldPath) ? 'bg-green-50 px-2 py-1 border-l-2 border-green-400' : ''}`}
                >
                  <div className="flex justify-between items-start mb-0.5">
                    <div className="flex-1">
                      <span className="font-bold text-sm">{project.name}</span>
                      {project.technologies && project.technologies.length > 0 && (
                        <>
                          <span className="text-sm mx-1"> | </span>
                          <span className="text-sm italic text-gray-700">
                            {project.technologies.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                    {project.link && (
                      <div className="text-xs italic text-gray-700 ml-4">
                        <a href={project.link} className="hover:underline">
                          {project.link.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>
                  <ul className="list-none ml-4 mt-0.5 space-y-0.5">
                    {Array.isArray(project.description) 
                      ? project.description.map((bullet, bulletIdx) => {
                          const cleanBullet = typeof bullet === 'string' ? bullet.trim().replace(/^[-•*]\s*/, '') : String(bullet).trim();
                          return (
                            <li
                              key={bulletIdx}
                              className="text-xs leading-relaxed"
                            >
                              <span className="mr-1.5">•</span>
                              {cleanBullet}
                            </li>
                          );
                        })
                      : (() => {
                          // Fallback: if description is still a string, split it
                          const bullets = String(project.description).split('\n').filter(line => line.trim());
                          return bullets.map((bullet, bulletIdx) => {
                            const cleanBullet = bullet.trim().replace(/^[-•*]\s*/, '');
                            return (
                              <li
                                key={bulletIdx}
                                className="text-xs leading-relaxed"
                              >
                                <span className="mr-1.5">•</span>
                                {cleanBullet}
                              </li>
                            );
                          });
                        })()}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* Skills */}
        {data.skills.length > 0 && (
          <div className="mb-3">
            <h2 className="text-base font-bold uppercase mb-2 pb-1 border-b border-gray-800 tracking-wide" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Technical Skills
            </h2>
            <div className={isHighlighted('skills') ? 'bg-green-50 px-2 py-1 border-l-2 border-green-400' : ''}>
              <p className="text-xs leading-relaxed">{data.skills.join(', ')}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


