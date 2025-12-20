'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UpgradeButtonProps {
  email: string;
  className?: string;
  showTrialCTA?: boolean; // Whether to show "Try for $0.00" instead of "Upgrade to Premium"
}

export function UpgradeButton({ email, className = '', showTrialCTA = false }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async () => {
    if (!email) {
      toast({
        title: "Sign in required",
        description: "Please sign in to subscribe to Premium.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Create checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show user-friendly error message
        const errorMessage = data.error || 'Failed to create checkout session';
        toast({
          title: "Cannot subscribe",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error upgrading:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to start checkout process. Please try again.',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className={`px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-800 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${className}`}
    >
      {loading ? 'Loading...' : showTrialCTA ? 'Try for $0.00' : 'Upgrade to Premium'}
    </button>
  );
}
