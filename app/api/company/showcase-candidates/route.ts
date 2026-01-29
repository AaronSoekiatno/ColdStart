import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Fetch top 3 vetted candidates
    // For now, we'll get candidates with completed assessments
    const { data: candidates, error } = await supabaseAdmin
      .from("candidates")
      .select(`
        id,
        first_name,
        last_name,
        school,
        years_of_experience,
        skills,
        assessment_results,
        github_analysis
      `)
      .eq("assessment_status", "completed")
      .not("assessment_results", "is", null)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Error fetching candidates:", error);
      return NextResponse.json(
        { error: "Failed to fetch candidates" },
        { status: 500 }
      );
    }

    // Transform data to anonymized format
    const showcaseCandidates = candidates?.map((candidate: any) => {
      // Generate strengths from candidate data
      const strengths = generateStrengths(candidate);
      
      // Generate assessment highlights
      const assessmentHighlights = generateAssessmentHighlights(candidate);

      return {
        id: candidate.id,
        firstName: candidate.first_name || "Anonymous",
        lastInitial: candidate.last_name?.charAt(0) || "A",
        school: candidate.school,
        yearsOfExperience: candidate.years_of_experience,
        strengths,
        assessmentSummary: {
          highlights: assessmentHighlights,
        },
      };
    }) || [];

    return NextResponse.json({ candidates: showcaseCandidates });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to generate strengths from candidate data
function generateStrengths(candidate: any): string[] {
  const strengths: string[] = [];

  // Add skills-based strengths
  if (candidate.skills && Array.isArray(candidate.skills)) {
    const topSkills = candidate.skills.slice(0, 2);
    if (topSkills.length > 0) {
      strengths.push(`Expertise in ${topSkills.join(" & ")}`);
    }
  }

  // Add experience-based strength
  if (candidate.years_of_experience) {
    if (candidate.years_of_experience >= 3) {
      strengths.push("Proven track record in production environments");
    } else {
      strengths.push("Fast learner with strong fundamentals");
    }
  }

  // Add assessment-based strengths
  if (candidate.assessment_results) {
    strengths.push("Passed rigorous technical assessment");
    strengths.push("Strong problem-solving skills");
  }

  // Add GitHub-based strength
  if (candidate.github_analysis) {
    strengths.push("Active open-source contributor");
  }

  // Ensure we have 3-4 strengths
  while (strengths.length < 3) {
    strengths.push("Clear technical communicator");
  }

  return strengths.slice(0, 4);
}

// Helper function to generate assessment highlights
function generateAssessmentHighlights(candidate: any): string[] {
  const highlights: string[] = [];

  // Parse assessment results if available
  if (candidate.assessment_results) {
    try {
      const results = typeof candidate.assessment_results === 'string' 
        ? JSON.parse(candidate.assessment_results)
        : candidate.assessment_results;

      // Add time-based highlight
      if (results.completionTime) {
        highlights.push(`Completed assessment in ${results.completionTime} minutes`);
      }

      // Add quality-based highlight
      if (results.codeQuality || results.score) {
        highlights.push("Wrote clean, production-ready code");
      }

      // Add problem-solving highlight
      if (results.debugging || results.problemSolving) {
        highlights.push("Demonstrated strong debugging skills");
      }
    } catch (e) {
      console.error("Error parsing assessment results:", e);
    }
  }

  // Default highlights if we don't have enough
  if (highlights.length === 0) {
    highlights.push(
      "Built full-stack feature from scratch",
      "Caught edge cases during testing",
      "Explained technical decisions clearly"
    );
  }

  return highlights.slice(0, 3);
}
