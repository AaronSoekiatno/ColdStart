-- Seed Data for Multi-Tenant Schema Architecture
-- This seeds the PUBLIC schema with shared reference data

-- ============================================================================
-- PUBLIC SCHEMA: Viral Benchmarks
-- ============================================================================
-- Industry benchmarks that all candidates can reference

INSERT INTO public.viral_benchmarks (category, benchmark_viral_score, benchmark_engagement_rate, description) VALUES
('High Performer', 85.0, 6.0, 'Top 5% of content - exceptional viral potential'),
('Medium Performer', 65.0, 4.5, 'Above average - good engagement potential'),
('Low Performer', 45.0, 2.5, 'Below average - needs optimization'),
('Outlier', 50.0, 2.0, 'High views but low engagement - needs better hook');

-- ============================================================================
-- PUBLIC SCHEMA: Global Templates
-- ============================================================================
-- Shared templates candidates can reference for inspiration

INSERT INTO public.global_templates (template_name, template_content, category) VALUES
('Problem-Solution', '[HOOK] {problem_statement}. [SOLUTION] {solution}. [PROOF] {evidence}. [CTA] {call_to_action}', 'Framework'),
('Story Arc', '[STORY] {background}. [CHALLENGE] {obstacle}. [JOURNEY] {process}. [RESULT] {outcome}. [LEARNING] {insight}', 'Framework'),
('Educational', '[EDUCATION] {topic_intro}. [DATA] {key_statistics}. [BREAKDOWN] {detailed_explanation}. [ACTIONABLE] {next_steps}', 'Framework');

-- ============================================================================
-- NOTE: Candidate-specific seed data
-- ============================================================================
-- Each candidate's schema (sandbox_{candidate_id}) will be seeded separately
-- when they first connect. Use the create_candidate_schema() function and
-- then insert data into their specific schema.

-- Example for candidate "aidan":
-- SELECT create_candidate_schema('aidan');
-- INSERT INTO sandbox_aidan.video_scripts (id, title, script_content, created_at, creator_id) VALUES
-- ('550e8400-e29b-41d4-a716-446655440001', 'This One Mistake Costs You $10K', 
-- '[HOOK] Stop losing money on ads that don''t convert...', NOW() - INTERVAL '5 days', 'creative_team_alpha');
-- etc.
