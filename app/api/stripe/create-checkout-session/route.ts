import { NextRequest, NextResponse } from 'next/server';
import { getStripe, STRIPE_PRICE_IDS, PRODUCT_CONFIG } from '@/lib/stripe';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin, getCandidate, getResumeCountForCandidate } from '@/lib/supabase';

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe Checkout session for subscribing to Premium
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Import cookies at runtime (Next.js 15+ requirement)
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Cookie setting might fail in route handlers - this is okay
            }
          },
        },
      }
    );

    // Verify user is authenticated and get their data
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.email !== email) {
      return NextResponse.json(
        { error: 'You must be signed in to subscribe to Premium. Please sign in and try again.' },
        { status: 401 }
      );
    }

    // Get candidate data to check prerequisites
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Check if candidate exists and has uploaded a resume
    const candidate = await getCandidate(email);
    
    if (!candidate) {
      return NextResponse.json(
        { error: 'Please upload your resume before subscribing to Premium. Premium features require a resume to match you with startups.' },
        { status: 400 }
      );
    }

    // Check if candidate has at least one active resume
    const resumeCount = await getResumeCountForCandidate(candidate.id);
    
    if (resumeCount === 0) {
      return NextResponse.json(
        { error: 'Please upload your resume before subscribing to Premium. Premium features require a resume to match you with startups.' },
        { status: 400 }
      );
    }

    // Get candidate's Stripe customer ID
    const { data: candidateData } = await supabaseAdmin
      .from('candidates')
      .select('stripe_customer_id')
      .eq('email', email)
      .single();

    const stripe = getStripe();

    // Create or retrieve Stripe customer
    let customerId = candidateData?.stripe_customer_id;
    let customerExists = false;

    // If we have a customer ID, verify it still exists in Stripe
    if (customerId) {
      try {
        const retrievedCustomer = await stripe.customers.retrieve(customerId);
        // Check if customer was deleted (Stripe returns deleted customers with deleted: true)
        if (retrievedCustomer.deleted) {
          throw new Error('Customer was deleted');
        }
        customerExists = true;
      } catch (error: any) {
        // Customer doesn't exist (deleted or invalid) - check for any error code
        const errorCode = error?.code || error?.type || 'unknown';
        const isResourceMissing = errorCode === 'resource_missing' || 
                                  error?.statusCode === 404 ||
                                  error?.message?.includes('No such customer');
        
        if (isResourceMissing || error?.message?.includes('deleted')) {
          customerId = null;
          customerExists = false;
          
          // Clear the invalid customer ID from database
          await supabaseAdmin
            .from('candidates')
            .update({ stripe_customer_id: null })
            .eq('email', email);
        } else {
          // Unexpected error - rethrow it
          throw error;
        }
      }
    }

    // Create new customer if we don't have a valid one
    if (!customerId || !customerExists) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          candidate_email: email,
        },
      });
      customerId = customer.id;

      // Update candidate with Stripe customer ID
      const { error: updateError } = await supabaseAdmin
        .from('candidates')
        .update({ stripe_customer_id: customerId })
        .eq('email', email);

      if (updateError) {
        throw new Error(`Failed to save customer ID: ${updateError.message}`);
      }
    }

    // Final validation before creating checkout session
    if (!customerId) {
      throw new Error('Failed to obtain valid Stripe customer ID');
    }

    // Create Checkout Session
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: STRIPE_PRICE_IDS.PREMIUM_MONTHLY,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        subscription_data: {
          trial_period_days: PRODUCT_CONFIG.PREMIUM.trialPeriodDays,
        },
        success_url: `${request.headers.get('origin')}/matches?success=true`,
        cancel_url: `${request.headers.get('origin')}/matches?canceled=true`,
        metadata: {
          candidate_email: email,
        },
      });
    } catch (checkoutError: any) {
      // If checkout fails due to invalid customer, create a new customer and retry
      if (checkoutError?.code === 'resource_missing' && 
          checkoutError?.message?.includes('No such customer')) {
        // Clear invalid customer ID from database
        await supabaseAdmin
          .from('candidates')
          .update({ stripe_customer_id: null })
          .eq('email', email);
        
        // Create new customer
        const newCustomer = await stripe.customers.create({
          email,
          metadata: {
            candidate_email: email,
          },
        });
        customerId = newCustomer.id;
        
        // Update database
        await supabaseAdmin
          .from('candidates')
          .update({ stripe_customer_id: customerId })
          .eq('email', email);
        
        // Retry checkout session creation
        session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          line_items: [
            {
              price: STRIPE_PRICE_IDS.PREMIUM_MONTHLY,
              quantity: 1,
            },
          ],
          mode: 'subscription',
          allow_promotion_codes: true,
          subscription_data: {
            trial_period_days: PRODUCT_CONFIG.PREMIUM.trialPeriodDays,
          },
          success_url: `${request.headers.get('origin')}/matches?success=true`,
          cancel_url: `${request.headers.get('origin')}/matches?canceled=true`,
          metadata: {
            candidate_email: email,
          },
        });
      } else {
        // Re-throw if it's a different error
        throw checkoutError;
      }
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
