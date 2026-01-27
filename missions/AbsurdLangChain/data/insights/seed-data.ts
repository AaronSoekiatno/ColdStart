export type PerformanceData = {
  script_id: string;
  title: string;
  script_content: string;
  views: number;
  likes: number;
  shares: number;
  engagement_rate: number;
  viral_score: number;
  logged_at: string;
};

export const mockPerformanceData: PerformanceData[] = [
  // High performers (viral_score > 85)
  {
    script_id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'This One Mistake Costs You $10K',
    script_content: '[HOOK] Stop losing money on ads that don\'t convert. [PROBLEM] Most brands waste $10K+ monthly on campaigns that miss the mark. [SOLUTION] Here\'s the framework that 10x\'d our ROAS. [PROOF] We tested this on 500+ campaigns. [CTA] Get the free playbook in bio.',
    views: 450000,
    likes: 22500,
    shares: 4500,
    engagement_rate: 6.0,
    viral_score: 92.5,
    logged_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    script_id: '550e8400-e29b-41d4-a716-446655440002',
    title: 'The 3-Second Rule That Changed Everything',
    script_content: '[HOOK] Your first 3 seconds decide everything. [STORY] We tested 1,000 videos. The winners all had one thing in common. [REVEAL] It\'s not what you think. [FRAMEWORK] Here\'s the exact formula. [CTA] Try it on your next video.',
    views: 380000,
    likes: 19000,
    shares: 3800,
    engagement_rate: 6.0,
    viral_score: 88.2,
    logged_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Medium performers (viral_score 50-80)
  {
    script_id: '550e8400-e29b-41d4-a716-446655440003',
    title: 'How We Built a $1M Brand in 90 Days',
    script_content: '[STORY] Six months ago, we had zero customers. Today, we\'re doing $100K/month. [JOURNEY] Here\'s exactly how we did it. [LESSONS] The three mistakes that almost killed us. [WINS] What actually moved the needle. [CTA] Start your journey today.',
    views: 125000,
    likes: 5000,
    shares: 1000,
    engagement_rate: 4.8,
    viral_score: 72.3,
    logged_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    script_id: '550e8400-e29b-41d4-a716-446655440004',
    title: 'The Hidden Pattern in Viral Content',
    script_content: '[EDUCATION] After analyzing 10,000 viral videos, we found something surprising. [DATA] It\'s not about going viral—it\'s about this one metric. [BREAKDOWN] Here\'s what the data shows. [ACTIONABLE] How to apply this to your content. [CTA] Get the full analysis.',
    views: 95000,
    likes: 3800,
    shares: 760,
    engagement_rate: 4.8,
    viral_score: 68.5,
    logged_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    script_id: '550e8400-e29b-41d4-a716-446655440005',
    title: 'Why Your Ads Are Failing (And How to Fix Them)',
    script_content: '[PROBLEM] 90% of ads fail. Here\'s why. [ANALYSIS] We tested 500+ ad variations. [INSIGHT] The pattern is clear. [SOLUTION] Three changes that fix 80% of failed ads. [PROOF] Real results from our campaigns. [CTA] Audit your ads with our tool.',
    views: 180000,
    likes: 7200,
    shares: 1440,
    engagement_rate: 4.8,
    viral_score: 75.1,
    logged_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Low performers (viral_score < 50)
  {
    script_id: '550e8400-e29b-41d4-a716-446655440006',
    title: 'Introduction to Performance Marketing',
    script_content: '[EDUCATION] Today we\'re going to cover the basics of performance marketing. [DEFINITION] Performance marketing is... [EXAMPLES] Here are some examples. [BEST PRACTICES] Follow these guidelines. [CONCLUSION] That\'s performance marketing in a nutshell.',
    views: 15000,
    likes: 300,
    shares: 60,
    engagement_rate: 2.4,
    viral_score: 35.2,
    logged_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    script_id: '550e8400-e29b-41d4-a716-446655440007',
    title: 'Our Company Values and Mission',
    script_content: '[BRAND] At our company, we believe in excellence. [VALUES] Our core values are integrity, innovation, and impact. [MISSION] We\'re here to transform the industry. [TEAM] Meet our amazing team. [JOIN] We\'re hiring!',
    views: 8000,
    likes: 160,
    shares: 32,
    engagement_rate: 2.4,
    viral_score: 28.7,
    logged_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Outliers (high views, low engagement)
  {
    script_id: '550e8400-e29b-41d4-a716-446655440008',
    title: 'The Ultimate Guide to Social Media',
    script_content: '[HOOK] Everything you need to know about social media. [CONTENT] This comprehensive guide covers platforms, strategies, and best practices. [DETAILS] We\'ll go deep into each platform. [TIPS] Pro tips from industry experts. [RESOURCES] Free templates and tools.',
    views: 520000,
    likes: 10400,
    shares: 2080,
    engagement_rate: 2.4,
    viral_score: 45.3,
    logged_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    script_id: '550e8400-e29b-41d4-a716-446655440009',
    title: '5 Trends Shaping Digital Marketing in 2024',
    script_content: '[TREND 1] AI-powered personalization is changing everything. [TREND 2] Video-first content dominates. [TREND 3] Community-driven growth. [TREND 4] Sustainability in marketing. [TREND 5] The rise of micro-influencers. [CONCLUSION] These trends will shape the future.',
    views: 280000,
    likes: 5600,
    shares: 1120,
    engagement_rate: 2.4,
    viral_score: 42.8,
    logged_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Recent high performer
  {
    script_id: '550e8400-e29b-41d4-a716-446655440010',
    title: 'Case Study: How We 10x\'d Conversion Rates',
    script_content: '[BACKGROUND] Client came to us with 2% conversion rates. [CHALLENGE] Industry average was 5%. [APPROACH] We rebuilt their funnel from scratch. [PROCESS] Here\'s what we changed. [RESULTS] 6 months later: 20% conversion rates. [LEARNINGS] Key takeaways.',
    views: 220000,
    likes: 13200,
    shares: 2640,
    engagement_rate: 7.2,
    viral_score: 85.6,
    logged_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

