"use client";

import type { StructuredResumeData, ExperienceItem, EducationItem, ProjectItem } from '@/types/resume';
import { calculateInlineDiff } from '@/lib/inline-diff';

interface JakesResumeTemplateProps {
  data: StructuredResumeData;
  highlightedFields?: Set<string>; // Field paths like "experience[0].description[1]" (ResumePath is string)
  pathToSuggestionId?: Map<string, string>; // Map field paths to suggestion IDs
  pathToSuggestion?: Map<string, { original: string; suggested: string }>; // Map field paths to suggestion text
  selectedSuggestionId?: string | null;
  blurredFields?: Set<string>; // Field paths that should be blurred (for free users)
  onHover?: (suggestionId: string, event: React.MouseEvent) => void;
  onClick?: (suggestionId: string) => void;
  onLeave?: () => void;
  upgradeCount?: number; // Number of locked/blurred suggestions
  onUpgradeClick?: () => void; // Open upgrade modal
}
//deploy

export function JakesResumeTemplate({
  data,
  highlightedFields = new Set(),
  pathToSuggestionId = new Map(),
  pathToSuggestion = new Map(),
  selectedSuggestionId,
  blurredFields = new Set(),
  onHover,
  onClick,
  onLeave,
  upgradeCount,
  onUpgradeClick,
}: JakesResumeTemplateProps) {
  const isHighlighted = (fieldPath: string) => highlightedFields.has(fieldPath);
  const getSuggestionId = (fieldPath: string) => pathToSuggestionId.get(fieldPath);
  const getSuggestion = (fieldPath: string) => pathToSuggestion.get(fieldPath);
  const isBlurred = (fieldPath: string) => blurredFields.has(fieldPath);
  const isActiveSelection = (fieldPath: string) => {
    const suggestionId = getSuggestionId(fieldPath);
    return selectedSuggestionId && suggestionId === selectedSuggestionId;
  };

  // Track whether we've already rendered the upgrade CTA in this render pass,
  // so it only appears over the first blurred field.
  let hasRenderedUpgradeCTA = false;

  const shouldShowUpgradeCTA = (fieldPath: string) => {
    if (!onUpgradeClick || !upgradeCount || upgradeCount <= 0) return false;
    if (!isBlurred(fieldPath)) return false;
    if (hasRenderedUpgradeCTA) return false;
    hasRenderedUpgradeCTA = true;
    return true;
  };
  
  const renderDiffText = (text: string, fieldPath: string) => {
    const suggestion = getSuggestion(fieldPath);
    if (!suggestion) return text;
    
    const diffParts = calculateInlineDiff(suggestion.original, suggestion.suggested);
    return diffParts.map((part, index) => {
      if (part.type === 'removed') {
        return (
          <span
            key={index}
            className="bg-red-100 text-gray-900 line-through decoration-red-500 decoration-2"
          >
            {part.text}
          </span>
        );
      } else if (part.type === 'added') {
        return (
          <span
            key={index}
            className="bg-green-100 text-gray-900"
          >
            {part.text}
          </span>
        );
      } else {
        return <span key={index} className="text-gray-900">{part.text}</span>;
      }
    });
  };

  return (
    <div className="w-full h-full overflow-auto bg-white">
      <div
        className="max-w-[8.5in] mx-auto px-3 pt-0 pb-4 text-[12px] leading-[1.33] text-gray-900"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold mb-1" style={{ fontSize: '22pt', letterSpacing: '0.5px' }}>
            {data.personal.name}
          </h1>
          <div className="flex flex-nowrap justify-center items-center gap-0.2 text-[11px] text-gray-700 overflow-hidden">
            {data.personal.phone && (
              <span className="whitespace-nowrap">{data.personal.phone}</span>
            )}
            {data.personal.phone && data.personal.email && <span className="px-1">|</span>}
            {data.personal.email && (
              <span className="whitespace-nowrap"><a href={`mailto:${data.personal.email}`} className="text-gray-900 hover:underline">{data.personal.email}</a></span>
            )}
            {data.personal.email && data.personal.linkedin && <span className="px-1">|</span>}
            {data.personal.linkedin && (
              <span className="whitespace-nowrap"><a href={data.personal.linkedin} className="text-gray-900 hover:underline">{data.personal.linkedin.replace(/^https?:\/\//, '')}</a></span>
            )}
            {data.personal.linkedin && data.personal.github && <span className="px-1">|</span>}
            {data.personal.github && (
              <span className="whitespace-nowrap"><a href={data.personal.github} className="text-gray-900 hover:underline">{data.personal.github.replace(/^https?:\/\//, '')}</a></span>
            )}
          </div>
        </div>

        {/* Education */}
        {data.education.length > 0 && (
          <div className="mb-3">
            <h2 className="text-base font-bold uppercase mb-2 pb-1 border-b border-gray-800 tracking-wide" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Education
            </h2>
            {data.education.map((edu) => (
              <div key={edu.id} className="mb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-sm">
                    {edu.school}
                    {edu.degree && ` — ${edu.degree}`}
                  </div>
                  {(edu.location || edu.graduationDate) && (
                    <div className="flex items-start text-xs italic text-gray-700 whitespace-nowrap gap-1 ml-2">
                      {edu.location && <span>{edu.location}</span>}
                      {edu.location && edu.graduationDate && <span className="mx-0.5">|</span>}
                      {edu.graduationDate && <span>{edu.graduationDate}</span>}
                    </div>
                  )}
                </div>
                {edu.major || edu.minor || edu.honors || edu.gpa ? (
                  <div className="text-xs text-gray-700 mt-1 mb-1">
                    {[edu.major && `Major: ${edu.major}`, edu.minor && `Minor: ${edu.minor}`, edu.honors, edu.gpa && `GPA: ${edu.gpa}`]
                      .filter(Boolean)
                      .join(' | ')}
                  </div>
                ) : null}
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
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-sm">{exp.title}</div>
                  <div className="text-xs italic text-gray-700 whitespace-nowrap">
                    {exp.startDate}{exp.endDate ? ` - ${exp.endDate}` : ''}
                  </div>
                </div>
                <div className="text-sm italic text-gray-700 mt-0.5">{exp.company}</div>
                {exp.location && (
                  <div className="text-xs italic text-gray-700">{exp.location}</div>
                )}
                <ul className="list-none ml-4 mt-0.5 space-y-0.5">
                  {exp.description.map((bullet, bulletIdx) => {
                    const fieldPath = `experience[${expIdx}].description[${bulletIdx}]`;
                    const suggestionId = getSuggestionId(fieldPath);
                    const highlighted = isHighlighted(fieldPath);
                    const active = isActiveSelection(fieldPath);
                    const blurred = isBlurred(fieldPath);
                    return (
                      <li
                        key={bulletIdx}
                        className={`relative text-xs leading-relaxed ${highlighted ? 'px-1 cursor-pointer' : ''} ${active ? 'border border-yellow-400 rounded bg-yellow-50/70' : ''}`}
                        onMouseEnter={highlighted && suggestionId && onHover ? (e) => onHover(suggestionId, e) : undefined}
                        onClick={highlighted && suggestionId && onClick ? () => onClick(suggestionId) : undefined}
                        onMouseLeave={highlighted && onLeave ? onLeave : undefined}
                      >
                        <div className={blurred ? 'filter blur-sm opacity-60' : ''}>
                          <span className="mr-1.5">•</span>
                          {highlighted ? renderDiffText(bullet, fieldPath) : bullet}
                        </div>
                        {shouldShowUpgradeCTA(fieldPath) && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpgradeClick?.();
                              }}
                              className="bg-gray-900 hover:bg-black text-white text-sm h-7 px-8 rounded-md cursor-pointer pointer-events-auto"
                            >
                              View More Suggestions
                            </button>
                          </div>
                        )}
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
              const projectPath = `projects[${projIdx}]`;
              const isProjectHighlighted = isHighlighted(projectPath);
              const isProjectActive = isActiveSelection(projectPath);
              return (
                <div
                  key={project.id}
                  className={`mb-2 ${isProjectHighlighted ? 'px-2 py-1' : ''} ${isProjectActive ? 'border border-yellow-400 rounded bg-yellow-50/70' : ''}`}
                >
                  <div className="flex justify-between items-start mb-0.5">
                    <div className="flex-1">
                      <span className="font-bold text-sm">{project.name}</span>
                      {project.technologies && project.technologies.length > 0 && (
                        <>
                          <span className="text-[12px] mx-1"> | </span>
                          <span className="text-[12px] italic text-gray-700">
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
                          const bulletPath = `projects[${projIdx}].description[${bulletIdx}]`;
                          const suggestionId = getSuggestionId(bulletPath);
                          const isBulletHighlighted = isHighlighted(bulletPath);
                          const isBulletActive = isActiveSelection(bulletPath);
                          const cleanBullet = typeof bullet === 'string' ? bullet.trim().replace(/^[-•*]\s*/, '') : String(bullet).trim();
                          const blurred = isBlurred(bulletPath);
                          return (
                            <li
                              key={bulletIdx}
                              className={`relative text-xs leading-relaxed ${isBulletHighlighted ? 'px-1 cursor-pointer' : ''} ${isBulletActive ? 'border border-yellow-400 rounded bg-yellow-50/70' : ''}`}
                              onMouseEnter={isBulletHighlighted && suggestionId && onHover ? (e) => onHover(suggestionId, e) : undefined}
                              onClick={isBulletHighlighted && suggestionId && onClick ? () => onClick(suggestionId) : undefined}
                              onMouseLeave={isBulletHighlighted && onLeave ? onLeave : undefined}
                            >
                              <div className={blurred ? 'filter blur-sm opacity-60' : ''}>
                                <span className="mr-1.5">•</span>
                                {isBulletHighlighted ? renderDiffText(cleanBullet, bulletPath) : cleanBullet}
                              </div>
                              {shouldShowUpgradeCTA(bulletPath) && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="bg-white/95 rounded-lg border border-blue-200 shadow-lg px-3 py-2 text-xs text-gray-900 max-w-xs pointer-events-auto">
                                    <div className="font-semibold text-gray-900 mb-0.5">
                                      Upgrade to Premium
                                    </div>
                                    {typeof upgradeCount === 'number' && upgradeCount > 0 && (
                                      <div className="text-[11px] text-gray-600">
                                        View {upgradeCount} more suggestion{upgradeCount === 1 ? '' : 's'}
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpgradeClick?.();
                                      }}
                                      className="mt-1 w-full bg-gray-900 hover:bg-black text-white text-xs font-medium py-1.5 px-4 rounded-md transition-colors cursor-pointer"
                                    >
                                      Upgrade
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })
                      : (() => {
                          // Fallback: if description is still a string, split it
                          const bullets = String(project.description).split('\n').filter(line => line.trim());
                          return bullets.map((bullet, bulletIdx) => {
                            const bulletPath = `projects[${projIdx}].description[${bulletIdx}]`;
                            const isBulletHighlighted = isHighlighted(bulletPath);
                            const cleanBullet = bullet.trim().replace(/^[-•*]\s*/, '');
                            return (
                              <li
                                key={bulletIdx}
                                className={`text-xs leading-relaxed ${isBulletHighlighted ? 'px-1' : ''}`}
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
            <div className={`${isHighlighted('skills') ? 'px-2 py-1' : ''} ${isBlurred('skills') ? 'filter blur-sm opacity-60' : ''}`}>
              <p className="text-[10px] leading-tight">{data.skills.join(', ')}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


