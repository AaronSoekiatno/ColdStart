/**
 * Unit tests for Stripe webhook handlers
 *
 * Tests payment processing webhooks which have direct financial impact.
 * These are the highest priority tests as they handle subscription upgrades,
 * downgrades, and payment failures.
 *
 * Tested webhook events:
 * - checkout.session.completed: Upgrades to premium tier
 * - customer.subscription.updated: Syncs subscription status
 * - customer.subscription.deleted: Handles cancellations
 * - invoice.payment_failed: Downgrades on failed payment
 * - invoice.payment_succeeded: Confirms payment success
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockCandidate, mockCheckoutSession, mockSubscription, mockInvoice, mockStripeEvent } from '../../helpers/factories.js';

// Mock Stripe SDK
const mockStripeWebhooksConstructEvent = vi.fn();
const mockStripeSubscriptionsRetrieve = vi.fn();

vi.mock('../../../lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: mockStripeWebhooksConstructEvent
    },
    subscriptions: {
      retrieve: mockStripeSubscriptionsRetrieve
    }
  }))
}));

// Mock Supabase admin client
const mockSupabaseFrom = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockSupabaseUpdate = vi.fn();
const mockSupabaseUpdateEq = vi.fn(); // New mock for update().eq() chain
const mockSupabaseUpdateEqPromise = vi.fn(); // Mock for the promise returned by eq()

vi.mock('../../../lib/supabase', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom
  }
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((header) => {
      if (header === 'stripe-signature') {
        return 'test-signature';
      }
      return null;
    })
  }))
}));

// Setup mock chain for Supabase
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Setup default Supabase mock chain
  mockSupabaseFrom.mockReturnValue({
    select: mockSupabaseSelect,
    update: mockSupabaseUpdate
  });

  // Select chain
  mockSupabaseSelect.mockReturnValue({
    eq: mockSupabaseEq
  });
  mockSupabaseEq.mockReturnValue({
    single: mockSupabaseSingle,
    eq: mockSupabaseEq
  });

  // Update chain
  mockSupabaseUpdate.mockReturnValue({
    eq: mockSupabaseUpdateEq
  });

  // Update.eq() should return a Promise-like object that resolves to the result
  // We mock the .then method to make it awaitable
  mockSupabaseUpdateEq.mockImplementation(() => {
    return Promise.resolve({ error: null, data: [] });
  });

  // Setup environment variables
  process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';
});


afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

// Import the route handler after mocks are set up
const importRouteHandler = async () => {
  const module = await import('../../../app/api/stripe/webhook/route.ts');
  return module.POST;
};

describe('Stripe Webhook Handlers', () => {
  describe('Webhook signature verification', () => {
    it('should return 400 if stripe-signature header is missing', async () => {
      const { headers } = await import('next/headers');
      headers.mockReturnValueOnce({
        get: vi.fn(() => null)
      });

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing stripe-signature header');
    });

    it('should return 500 if STRIPE_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Webhook secret not configured');
    });

    it('should return 400 if signature verification fails', async () => {
      mockStripeWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Webhook Error');
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('should upgrade candidate to premium on successful checkout', async () => {
      const candidate = mockCandidate({
        email: 'test@example.com',
        stripe_customer_id: 'cus_test_123',
        subscription_tier: 'free',
        subscription_status: 'inactive'
      });

      const session = mockCheckoutSession({
        customer: 'cus_test_123',
        subscription: 'sub_test_123',
        mode: 'subscription'
      });

      const subscription = mockSubscription({
        id: 'sub_test_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      });

      const event = mockStripeEvent('checkout.session.completed', session);

      // Mock Stripe event construction
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      // Mock subscription retrieval
      mockStripeSubscriptionsRetrieve.mockResolvedValue(subscription);

      // Mock Supabase queries
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: candidate.email },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify Supabase update was called with correct data
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'active',
          stripe_subscription_id: 'sub_test_123'
        })
      );
    });

    it('should set trialing status correctly', async () => {
      const session = mockCheckoutSession({
        customer: 'cus_test_123',
        subscription: 'sub_test_123'
      });

      const subscription = mockSubscription({
        status: 'trialing'
      });

      const event = mockStripeEvent('checkout.session.completed', session);

      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(subscription);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'trialing'
        })
      );
    });

    it('should handle missing customer ID gracefully', async () => {
      const session = mockCheckoutSession({
        customer: null,
        mode: 'subscription'
      });

      const event = mockStripeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should not attempt Supabase queries
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('should ignore non-subscription checkout sessions', async () => {
      const session = mockCheckoutSession({
        mode: 'payment' // One-time payment, not subscription
      });

      const event = mockStripeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should not attempt Supabase queries
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('should handle candidate not found error', async () => {
      const session = mockCheckoutSession();
      const event = mockStripeEvent('checkout.session.completed', session);

      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Candidate not found' }
      });

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);

      // Should still return 200 (webhook received) but log error
      expect(response.status).toBe(200);
      expect(mockSupabaseUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdate', () => {
    it('should map active status to active', async () => {
      const subscription = mockSubscription({
        customer: 'cus_test_123',
        status: 'active'
      });

      const event = mockStripeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'active'
        })
      );
    });

    it('should map unknown status to inactive', async () => {
      const subscription = mockSubscription({
        status: 'incomplete'
      });

      const event = mockStripeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'free',
          subscription_status: 'inactive'
        })
      );
    });

    it('should downgrade tier on canceled status', async () => {
      const subscription = mockSubscription({
        status: 'canceled'
      });

      const event = mockStripeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'free',
          subscription_status: 'canceled'
        })
      );
    });

    it('should map past_due status correctly', async () => {
      const subscription = mockSubscription({
        status: 'past_due'
      });

      const event = mockStripeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'free',
          subscription_status: 'past_due'
        })
      );
    });

    it('should keep premium tier for trialing status', async () => {
      const subscription = mockSubscription({
        status: 'trialing'
      });

      const event = mockStripeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'trialing'
        })
      );
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should downgrade to free tier and set status to canceled', async () => {
      const subscription = mockSubscription({
        customer: 'cus_test_123',
        status: 'canceled'
      });

      const event = mockStripeEvent('customer.subscription.deleted', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith({
        subscription_tier: 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null
      });
    });

    it('should handle missing candidate gracefully', async () => {
      const subscription = mockSubscription();
      const event = mockStripeEvent('customer.subscription.deleted', subscription);

      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockSupabaseUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentFailed', () => {
    it('should set subscription_status to past_due', async () => {
      const invoice = mockInvoice({
        customer: 'cus_test_123'
      });

      const event = mockStripeEvent('invoice.payment_failed', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith({
        subscription_status: 'past_due'
      });
    });

    it('should handle missing customer', async () => {
      const invoice = mockInvoice({
        customer: 'cus_nonexistent'
      });

      const event = mockStripeEvent('invoice.payment_failed', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockSupabaseUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentSucceeded', () => {
    it('should update subscription status on successful payment', async () => {
      const invoice = mockInvoice({
        customer: 'cus_test_123',
        subscription: 'sub_test_123'
      });

      const subscription = mockSubscription({
        id: 'sub_test_123',
        status: 'active'
      });

      const event = mockStripeEvent('invoice.payment_succeeded', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(subscription);

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { email: 'test@example.com', subscription_tier: 'premium' },
        error: null
      });
      

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_tier: 'premium',
          subscription_status: 'active'
        })
      );
    });

    it('should ignore invoices without subscription', async () => {
      const invoice = mockInvoice({
        customer: 'cus_test_123',
        subscription: null
      });

      const event = mockStripeEvent('invoice.payment_succeeded', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should not query Supabase for non-subscription invoices
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });
  });

  describe('Unhandled events', () => {
    it('should return 200 for unhandled event types', async () => {
      const event = mockStripeEvent('customer.created', { id: 'cus_123' });
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should return 500 if handler throws an error', async () => {
      const subscription = mockSubscription();
      const event = mockStripeEvent('customer.subscription.updated', subscription);

      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockSupabaseSingle.mockRejectedValueOnce(new Error('Database error'));

      const POST = await importRouteHandler();
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(event)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Webhook handler failed');
    });
  });
});
