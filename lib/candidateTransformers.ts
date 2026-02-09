// Transformation functions to generate condensed candidate views

import {
  CandidateBrief,
  Verdict,
  FitSnapshot,
  AssessmentDetails,
  RealWorldExperience,
  UnprovenClaim,
  AIUsagePattern,
  MatchAnalysis,
} from './mockCompanyData';

export const generateVerdict = (whyHireSummary?: string, matchScore?: number): Verdict => {
  if (!whyHireSummary) {
    return {
      level: 'Candidate under review',
      confidence: 'Pending (limited data)',
      reasoning: 'Additional information needed to make a hiring recommendation.',
    };
  }

  // Extract hire level from context
  let level = 'Mid-level hire';
  if (whyHireSummary.toLowerCase().includes('junior') || whyHireSummary.toLowerCase().includes('entry')) {
    level = 'Junior hire';
  } else if (whyHireSummary.toLowerCase().includes('senior') || whyHireSummary.toLowerCase().includes('staff')) {
    level = 'Senior hire';
  } else if (whyHireSummary.toLowerCase().includes('strong')) {
    level = 'Strong ' + level.toLowerCase();
  }

  // Adjust based on role keywords
  if (whyHireSummary.toLowerCase().includes('backend')) {
    level = level.replace('hire', 'backend hire');
  } else if (whyHireSummary.toLowerCase().includes('frontend')) {
    level = level.replace('hire', 'frontend hire');
  } else if (whyHireSummary.toLowerCase().includes('full-stack') || whyHireSummary.toLowerCase().includes('fullstack')) {
    level = level.replace('hire', 'full-stack hire');
  }

  // Determine confidence
  let confidence = 'Medium';
  if (matchScore && matchScore >= 90) {
    confidence = 'High (verified production impact)';
  } else if (matchScore && matchScore >= 85) {
    confidence = 'High (strong technical signal)';
  } else if (matchScore && matchScore >= 75) {
    confidence = 'Medium (good foundation)';
  } else {
    confidence = 'Medium (needs validation)';
  }

  // Extract reasoning - condense to 1-2 sentences, remove flex
  let reasoning = whyHireSummary
    .replace(/—/g, '.') // Replace em dashes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Extract key phrases and condense
  const sentences = reasoning.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Take the most substantive sentence(s), removing FAANG/salary flex
  const cleanedSentences = sentences
    .filter(s => {
      const lower = s.toLowerCase();
      // Keep sentences that talk about skills, experience, potential
      return (
        lower.includes('experience') ||
        lower.includes('contribute') ||
        lower.includes('likely to') ||
        lower.includes('proven') ||
        lower.includes('strong') ||
        lower.includes('demonstrate')
      ) && !lower.includes('interview them if');
    })
    .map(s => {
      // Remove specific flex markers
      return s
        .replace(/\$\d+M?\+?/gi, 'significant scale')
        .replace(/\d{1,3}M?\+? users?/gi, 'large user bases')
        .replace(/FAANG/gi, 'major tech company')
        .trim();
    });

  reasoning = cleanedSentences.slice(0, 2).join('. ').trim();
  if (reasoning && !reasoning.endsWith('.')) {
    reasoning += '.';
  }

  // Fallback if filtering removed everything
  if (!reasoning || reasoning.length < 20) {
    reasoning = 'Demonstrates relevant technical experience and problem-solving capabilities.';
  }

  return {
    level,
    confidence,
    reasoning,
  };
};

export const generateFitSnapshot = (matchAnalysis: MatchAnalysis): FitSnapshot => {
  // Take top 3 from each, condense to short phrases
  const strong_fits = matchAnalysis.fit_areas
    .slice(0, 3)
    .map(fit => {
      // Condense long descriptions to short phrases
      return fit
        .replace(/\s*\(.*?\)/g, '') // Remove parenthetical
        .replace(/\s+experience$/i, '')
        .replace(/^has\s+/i, '')
        .replace(/^demonstrates?\s+/i, '')
        .replace(/^shows?\s+/i, '')
        .trim();
    });

  const needs_validation = matchAnalysis.gaps
    .slice(0, 3)
    .map(gap => {
      // Condense, remove question words
      return gap
        .replace(/^no\s+/i, '')
        .replace(/\s+verified$/i, '')
        .replace(/\s+needs?\s+exploration.*$/i, '')
        .replace(/^limited\s+/i, '')
        .replace(/\s+exposure$/i, '')
        .replace(/\s+claims?$/i, '')
        .trim();
    });

  return {
    strong_fits,
    needs_validation,
  };
};

export const generateExperienceSummary = (
  experiences?: RealWorldExperience[]
): string[] => {
  if (!experiences || experiences.length === 0) {
    return ['Limited verified work experience'];
  }

  const summaryPoints: string[] = [];

  // Extract outcome patterns
  const allAchievements = experiences.flatMap(exp => exp.key_achievements);

  // Look for system building
  const systemBuilding = allAchievements.find(a =>
    a.toLowerCase().includes('built') ||
    a.toLowerCase().includes('developed') ||
    a.toLowerCase().includes('implemented') ||
    a.toLowerCase().includes('designed')
  );

  if (systemBuilding) {
    const cleaned = systemBuilding
      .replace(/\$\d+M?\+?/gi, 'real money')
      .replace(/\d{1,3}M?\+? users?/gi, 'large user bases')
      .replace(/processing.*monthly/i, 'flows')
      .replace(/Built\s+.*?system/i, 'Built and operated backend systems')
      .replace(/Implemented\s+.*?pipeline/i, 'Built and operated systems');

    summaryPoints.push(cleaned);
  } else {
    summaryPoints.push('Built and operated production systems');
  }

  // Look for performance improvements
  const performance = allAchievements.find(a =>
    a.toLowerCase().includes('reduced') ||
    a.toLowerCase().includes('improved') ||
    a.toLowerCase().includes('optimized') ||
    a.toLowerCase().includes('increased')
  );

  if (performance) {
    const cleaned = performance
      .replace(/by\s+\d+%/i, (match) => `materially (${match.trim()})`)
      .replace(/Reduced\s+/i, 'Improved system performance materially - reduced ')
      .replace(/Improved\s+/i, 'Improved system performance materially - ');

    summaryPoints.push(cleaned);
  }

  // Look for scale/reach
  const scale = allAchievements.find(a =>
    a.toLowerCase().includes('shipped') ||
    a.toLowerCase().includes('users') ||
    a.toLowerCase().includes('production')
  );

  if (scale && summaryPoints.length < 3) {
    const cleaned = scale
      .replace(/\d{1,3}M?\+? users?/gi, 'large user bases');
    summaryPoints.push(cleaned);
  }

  // Ensure we have at least 2 points
  if (summaryPoints.length < 2) {
    summaryPoints.push('Delivered production features with measurable impact');
  }

  return summaryPoints.slice(0, 3);
};

export const generateWorkSimulationSummary = (
  details?: AssessmentDetails
): string[] => {
  if (!details) {
    return ['Assessment not completed'];
  }

  const summary: string[] = [];

  // Time + difficulty
  summary.push(`Completed in ${details.time_to_complete} (${details.problem_difficulty} difficulty)`);

  // Code quality (qualitative)
  let qualityLabel = 'Good';
  if (details.code_quality_score >= 95) {
    qualityLabel = 'Excellent';
  } else if (details.code_quality_score >= 90) {
    qualityLabel = 'Very good';
  } else if (details.code_quality_score >= 80) {
    qualityLabel = 'Good';
  } else if (details.code_quality_score >= 70) {
    qualityLabel = 'Satisfactory';
  }
  summary.push(`Code quality: ${qualityLabel}`);

  // Testing approach
  let testingLabel = 'Basic testing';
  if (details.test_coverage >= 85 && details.edge_cases_handled >= 4) {
    testingLabel = 'Strong coverage with edge cases handled';
  } else if (details.test_coverage >= 75 && details.edge_cases_handled >= 3) {
    testingLabel = 'Good coverage with some edge cases';
  } else if (details.test_coverage >= 60) {
    testingLabel = 'Moderate test coverage';
  }
  summary.push(`Testing: ${testingLabel}`);

  // Style observations from approach notes
  const notes = details.approach_notes.toLowerCase();
  let styleLabel = 'Clear code structure';

  if (notes.includes('clean') && notes.includes('separation of concerns')) {
    styleLabel = 'Clean abstractions, documentation-first mindset';
  } else if (notes.includes('systematic') || notes.includes('methodical')) {
    styleLabel = 'Systematic problem-solving approach';
  } else if (notes.includes('comprehensive') || notes.includes('thorough')) {
    styleLabel = 'Thorough and well-organized';
  } else if (notes.includes('well')) {
    styleLabel = 'Well-structured code';
  }

  summary.push(`Style: ${styleLabel}`);

  return summary;
};

export const generateAIToolingSummary = (aiUsage?: AIUsagePattern): string => {
  if (!aiUsage || aiUsage.tools_used.length === 0) {
    return 'No AI tooling information available.';
  }

  const { tools_used, usage_frequency, use_cases, prompt_engineering_skill } = aiUsage;

  // Frequency adjective
  const frequencyAdj = usage_frequency === 'heavy' ? 'Heavy' : usage_frequency === 'moderate' ? 'Moderate' : 'Light';

  // Tools list
  const toolsList = tools_used.join(', ');

  // Use cases (first 3-4 key ones)
  const useCasesList = use_cases
    .slice(0, 3)
    .map(uc => uc.toLowerCase().replace(/^(code\s+generation|debugging|architecture).*/i, (match, p1) => {
      if (p1.toLowerCase().includes('code')) return 'boilerplate';
      if (p1.toLowerCase().includes('debug')) return 'debugging';
      if (p1.toLowerCase().includes('arch')) return 'architecture';
      return match;
    }))
    .join(', ');

  // Skill level
  const skillLevel = prompt_engineering_skill === 'advanced' ? 'strong prompt literacy' :
                     prompt_engineering_skill === 'intermediate' ? 'good prompt skills' :
                     'basic prompt skills';

  return `${frequencyAdj} AI-assisted development using ${toolsList} for ${useCasesList}. Demonstrates ${skillLevel} and tool judgment.`;
};

export const generateInterviewFocus = (unprovenClaims: UnprovenClaim[]): string[] => {
  // Take top 3 unproven claims, format as "{topic} ({source})"
  return unprovenClaims
    .slice(0, 3)
    .map(claim => {
      // Extract topic from claim
      const topic = claim.claim
        .replace(/\s+experience$/i, '')
        .replace(/^has\s+/i, '')
        .replace(/^led\s+/i, 'Leadership -')
        .trim();

      // Format source
      const source = claim.source === 'self_reported' ? 'self-reported' : 'resume';

      return `${topic} (${source})`;
    });
};

export const transformCandidateToVerdictCard = (
  candidate: CandidateBrief
): CandidateBrief => {
  return {
    ...candidate,
    pipeline_stage: candidate.pipeline_stage || 'new',
    pipeline_updated_at: candidate.pipeline_updated_at || new Date().toISOString(),
    verdict: generateVerdict(candidate.why_hire_summary, candidate.match_score),
    fit_snapshot: generateFitSnapshot(candidate.match_analysis),
    verified_experience_summary: generateExperienceSummary(candidate.real_world_experience),
    work_simulation_summary: generateWorkSimulationSummary(candidate.assessment_details),
    ai_tooling_summary: generateAIToolingSummary(candidate.ai_usage),
    interview_focus: generateInterviewFocus(candidate.unproven_claims),
  };
};

// Batch transform all candidates
export const transformAllCandidates = (candidates: CandidateBrief[]): CandidateBrief[] => {
  return candidates.map(transformCandidateToVerdictCard);
};
