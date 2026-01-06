
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugInstantMatches() {
  console.log('--- Debugging Instant Matches ---');

  // 1. Check if jobs table has data
  const { count: jobCount, error: countError } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting jobs:', countError);
    return;
  }
  console.log(`Total jobs in DB: ${jobCount}`);

  if (jobCount === 0) {
    console.log('WARNING: No jobs found. Instant matching will fail.');
    return;
  }

  // 2. Get most recent candidate (likely the test user)
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, email, job_type, role_type, years_of_experience, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (candidateError) {
    console.error('Error fetching recent candidate:', candidateError);
    return;
  }

  console.log('Most recent candidate:', {
    email: candidate.email,
    job_type: candidate.job_type,
    role_type: candidate.role_type,
    years_of_experience: candidate.years_of_experience
  });

  // 3. Simulate Logic
  const jobType = candidate.job_type;
  const roleTypes = candidate.role_type || [];
  const yearsOfExperience = candidate.years_of_experience;

  let query = supabase
    .from('jobs')
    .select('startup_id, job_title, job_type') // Removed job_role
    .not('startup_id', 'is', null);

  // Job Type Filter
  if (jobType) {
    const normalizedJobType = jobType.replace('-', '');
    query = query.ilike('job_type', `%${normalizedJobType}%`);
    console.log(`Filtering job_type ilike %${normalizedJobType}%`);
  }

  // Roles Filter
  if (roleTypes.length > 0) {
    const roleConditions = roleTypes.map((role: string) => {
        const term = role === 'SWE' ? 'Software Engineer' :
                     role === 'SDE' ? 'Software Developer' :
                     role === 'PM' ? 'Product Manager' :
                     role;
        return `job_title.ilike.%${term}%`; // Removed job_role check
    }).join(',');
    console.log(`Filtering role conditions: ${roleConditions}`);
    query = query.or(roleConditions);
  } else {
    console.log('No roles selected, skipping role filter (might return 0 if logic requires roles)');
  }

  // YOE Filter Simulation
  if (yearsOfExperience) {
      if (yearsOfExperience === '5-10' || yearsOfExperience === '10-plus') {
        console.log('Applying Senior filter (exclude Intern/Junior)');
        query = query.not('job_title', 'ilike', '%Intern%');
        query = query.not('job_title', 'ilike', '%Junior%');
      } else if (yearsOfExperience === 'no-experience' || yearsOfExperience === 'less-than-1' || yearsOfExperience === '1-2') {
        console.log('Applying Junior filter (exclude Senior/Lead/Staff/Principal)');
        query = query.not('job_title', 'ilike', '%Senior%');
        query = query.not('job_title', 'ilike', '%Sr.%');
        query = query.not('job_title', 'ilike', '%Lead%');
        query = query.not('job_title', 'ilike', '%Staff%');
        query = query.not('job_title', 'ilike', '%Principal%');
      }
  }

  const { data: jobs, error: matchError } = await query.limit(50);
  
  if (matchError) {
    console.error('Error running match query:', matchError);
  } else {
    console.log(`Found ${jobs?.length} matches.`);
    if (jobs && jobs.length > 0) {
      console.log('Sample matches:', jobs.slice(0, 3));
    }
  }
}

debugInstantMatches();
