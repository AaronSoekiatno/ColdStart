import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { normalizeUniversityName } from '@/lib/normalize-candidate-data';
import {
  TOP_20_CS_SCHOOLS,
  ELITE_INTERNATIONAL_SCHOOLS,
  isUniversityInList,
  isUSLocation
} from '@/lib/segmentation-constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface DataQualityMetrics {
  missingLocation: number;
  missingUniversity: number;
  missingGraduationDate: number;
  totalCandidates: number;
}

/**
 * Calculate if candidate graduated or is graduating within 6 months
 */
function isAvailableNow(structuredResumeData: any): boolean {
  if (!structuredResumeData?.education || !Array.isArray(structuredResumeData.education)) {
    return false;
  }

  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(now.getMonth() + 6);

  return structuredResumeData.education.some((edu: any) => {
    if (!edu.graduationDate) return false;

    try {
      // Handle various date formats: "May 2024", "2024", "Dec 2025", etc.
      const dateStr = edu.graduationDate.toString().trim();

      // Try parsing as-is first
      let gradDate = new Date(dateStr);

      // If invalid, try adding day (for "May 2024" format)
      if (isNaN(gradDate.getTime())) {
        gradDate = new Date(`1 ${dateStr}`);
      }

      // Still invalid? Skip this entry
      if (isNaN(gradDate.getTime())) return false;

      return gradDate >= sixMonthsAgo && gradDate <= sixMonthsFromNow;
    } catch (e) {
      return false;
    }
  });
}

/**
 * Segment candidates based on criteria
 * Uses normalized university names for accurate matching
 */
function segmentCandidate(candidate: any): 'A' | 'B' | 'C' | 'D' | 'E' {
  const isUS = isUSLocation(candidate.location);

  // CRITICAL: Normalize university name before checking tier
  const normalizedUniversity = normalizeUniversityName(candidate.university);
  const isTopSchool = isUniversityInList(normalizedUniversity, TOP_20_CS_SCHOOLS);
  const isEliteIntl = isUniversityInList(normalizedUniversity, ELITE_INTERNATIONAL_SCHOOLS);

  const availableNow = isAvailableNow(candidate.structured_resume_data);

  // NOTE: work_authorization field doesn't exist in DB
  // Simplified assumption: only US-based candidates have work auth
  const hasWorkAuth = isUS;

  // Segment A: US-based + Top 20 CS school + Available now
  if (isUS && isTopSchool && availableNow) {
    return 'A';
  }

  // Segment B: US-based + Any school + Available now
  if (isUS && availableNow) {
    return 'B';
  }

  // Segment C: International + Elite school + US work auth
  // (Note: hasWorkAuth=isUS, so this segment will be rare with current logic)
  if (!isUS && isEliteIntl && hasWorkAuth) {
    return 'C';
  }

  // Segment D: International + Any school + No work auth
  if (!isUS && !hasWorkAuth) {
    return 'D';
  }

  // Segment E: Everything else
  return 'E';
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    // Fetch all candidates with pagination
    let allCandidates: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('candidates')
        .select('id, name, email, location, university, structured_resume_data, created_at')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allCandidates = [...allCandidates, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Track data quality metrics
    const dataQuality: DataQualityMetrics = {
      missingLocation: 0,
      missingUniversity: 0,
      missingGraduationDate: 0,
      totalCandidates: allCandidates.length,
    };

    // Segment candidates
    const segments = {
      segmentA: [] as any[],
      segmentB: [] as any[],
      segmentC: [] as any[],
      segmentD: [] as any[],
      segmentE: [] as any[],
    };

    allCandidates.forEach(candidate => {
      // Track data quality
      if (!candidate.location) dataQuality.missingLocation++;
      if (!candidate.university) dataQuality.missingUniversity++;
      if (!candidate.structured_resume_data?.education?.[0]?.graduationDate) {
        dataQuality.missingGraduationDate++;
      }

      const segment = segmentCandidate(candidate);

      const candidateInfo = {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        location: candidate.location,
        university: candidate.university,
        normalizedUniversity: normalizeUniversityName(candidate.university),
      };

      segments[`segment${segment}`].push(candidateInfo);
    });

    return NextResponse.json(
      {
        counts: {
          segmentA: segments.segmentA.length,
          segmentB: segments.segmentB.length,
          segmentC: segments.segmentC.length,
          segmentD: segments.segmentD.length,
          segmentE: segments.segmentE.length,
        },
        segments,
        dataQuality,
        total: allCandidates.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Segmentation API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
