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

-- Seed video scripts
-- INSERT INTO sandbox_aidan.video_scripts (id, title, script_content, created_at, creator_id) VALUES
-- ('550e8400-e29b-41d4-a716-446655440001', 'This One Mistake Costs You $10K', 
-- '[HOOK] Stop losing money on ads that don''t convert...', NOW() - INTERVAL '5 days', 'creative_team_alpha');

-- Seed notifications (3 unread, 2 read)
-- INSERT INTO sandbox_aidan.notifications (id, user_id, type, content, read, created_at) VALUES
-- ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'like', 'sarah_dev liked your post "Building Real-Time Features"', false, NOW() - INTERVAL '2 hours'),
-- ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'comment', 'john_code commented: "Great work! How did you handle the WebSocket connections?"', false, NOW() - INTERVAL '5 hours'),
-- ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'follow', 'emma_ui started following you', false, NOW() - INTERVAL '1 day'),
-- ('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'like', 'alex_full liked your post', true, NOW() - INTERVAL '3 days'),
-- ('650e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'comment', 'lisa_pm commented on your post', true, NOW() - INTERVAL '5 days');
