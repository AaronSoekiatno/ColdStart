/**
 * Test data factories for consistent mock data across unit tests
 *
 * These factories provide default test data that can be overridden with specific values
 * to create realistic test scenarios without boilerplate.
 */

/**
 * Create a mock candidate object
 * @param {object} overrides - Fields to override defaults
 * @returns {object} Mock candidate data
 */
export const mockCandidate = (overrides = {}) => ({
  id: 'candidate-123',
  email: 'test@example.com',
  name: 'Test User',
  skills: 'React, Node.js, TypeScript',
  location: 'San Francisco, CA',
  education_level: "Bachelor's",
  university: 'Stanford University',
  experience: 'Software Engineer at Tech Co',
  technical_projects: 'Open source contributions',
  objectives: ['find-job', 'learn-skills'],
  job_type: 'full-time',
  role_type: ['SWE', 'ML'],
  years_of_experience: '2-5',
  onboarding_completed: true,
  subscription_tier: 'free',
  subscription_status: 'inactive',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_current_period_end: null,
  major: ['Computer Science'],
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides
});

/**
 * Create a mock startup object
 * @param {object} overrides - Fields to override defaults
 * @returns {object} Mock startup data
 */
export const mockStartup = (overrides = {}) => ({
  id: 'startup-123',
  name: 'Test Startup',
  website: 'https://example.com',
  founder_first_name: 'John',
  founder_last_name: 'Doe',
  founder_emails: null,
  description: 'We build amazing products',
  industry: 'Technology',
  location: 'San Francisco, CA',
  yc_batch: 'W24',
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides
});

/**
 * Create a mock Stripe event
 * @param {string} type - Event type (e.g., 'checkout.session.completed')
 * @param {object} data - Event data object
 * @returns {object} Mock Stripe event
 */
export const mockStripeEvent = (type, data) => ({
  id: 'evt_test_123',
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  type,
  data: {
    object: data
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: 'req_test_123',
    idempotency_key: null
  }
});

/**
 * Create a mock Stripe Checkout Session
 * @param {object} overrides - Fields to override defaults
 * @returns {object} Mock Stripe checkout session
 */
export const mockCheckoutSession = (overrides = {}) => ({
  id: 'cs_test_123',
  object: 'checkout.session',
  customer: 'cus_test_123',
  subscription: 'sub_test_123',
  mode: 'subscription',
  payment_status: 'paid',
  status: 'complete',
  ...overrides
});

/**
 * Create a mock Stripe Subscription
 * @param {object} overrides - Fields to override defaults
 * @returns {object} Mock Stripe subscription
 */
export const mockSubscription = (overrides = {}) => ({
  id: 'sub_test_123',
  object: 'subscription',
  customer: 'cus_test_123',
  status: 'active',
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
  current_period_start: Math.floor(Date.now() / 1000),
  ...overrides
});

/**
 * Create a mock Stripe Invoice
 * @param {object} overrides - Fields to override defaults
 * @returns {object} Mock Stripe invoice
 */
export const mockInvoice = (overrides = {}) => ({
  id: 'in_test_123',
  object: 'invoice',
  customer: 'cus_test_123',
  subscription: 'sub_test_123',
  status: 'paid',
  amount_paid: 2000,
  amount_due: 2000,
  currency: 'usd',
  ...overrides
});

/**
 * Create a mock structured resume data object
 * @param {object} overrides - Fields to override defaults
 * @returns {object} Mock structured resume data
 */
export const mockStructuredResumeData = (overrides = {}) => ({
  personal: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '555-1234',
    location: 'San Francisco, CA'
  },
  education: [
    {
      school: 'Stanford University',
      degree: "Bachelor's",
      major: 'Computer Science',
      gpa: '3.8',
      graduation_date: '2020-05',
      start_date: '2016-09'
    }
  ],
  experience: [
    {
      company: 'Tech Co',
      title: 'Software Engineer',
      location: 'San Francisco, CA',
      start_date: '2020-06',
      end_date: '2023-01',
      description: 'Built full-stack web applications'
    }
  ],
  skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
  projects: [
    {
      name: 'Open Source Project',
      description: 'Contributed to open source',
      technologies: ['React', 'Node.js']
    }
  ],
  ...overrides
});

/**
 * Create a mock resume row
 * @param {object} overrides - Fields to override defaults
 * @returns {object} Mock resume row
 */
export const mockResume = (overrides = {}) => ({
  id: 'resume-123',
  candidate_id: 'candidate-123',
  name: 'My Resume',
  file_name: 'resume.pdf',
  resume_path: 'resumes/candidate-123/resume.pdf',
  resume_full_text: 'Full resume text content...',
  structured_data: mockStructuredResumeData(),
  is_active: true,
  is_primary: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
});
