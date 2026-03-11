'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function SetupForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        toast.error(error.message || 'Failed to set up payment method');
        return;
      }

      if (setupIntent?.status === 'succeeded') {
        // Confirm on our backend
        const res = await fetch('/api/payments/confirm-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setup_intent_id: setupIntent.id }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Failed to save payment method');
          return;
        }

        toast.success('Payment method saved');
        onSuccess();
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || submitting}>
          {submitting ? 'Saving...' : 'Save Payment Method'}
        </Button>
      </div>
    </form>
  );
}

export function PaymentMethodForm() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // Fetch current payment method
  const { data: pmData, isLoading: pmLoading } = useQuery({
    queryKey: ['payment-method'],
    queryFn: async () => {
      const res = await fetch('/api/payments/payment-method');
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Create setup intent
  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/payments/setup-intent', {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create setup intent');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowForm(true);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to initialize');
    },
  });

  const pm = pmData?.payment_method;

  const handleSuccess = () => {
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['payment-method'] });
    queryClient.invalidateQueries({ queryKey: ['club-context'] });
  };

  if (pmLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  // Show Stripe form
  if (showForm && setupMutation.data?.client_secret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: setupMutation.data.client_secret,
          appearance: { theme: 'stripe' },
        }}
      >
        <SetupForm onSuccess={handleSuccess} />
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setShowForm(false)}
        >
          Cancel
        </Button>
      </Elements>
    );
  }

  return (
    <div className="space-y-3">
      {pm ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-4 py-3 flex-1">
            <span className="font-medium capitalize">{pm.brand}</span>
            <span className="text-muted-foreground">
              ending in {pm.last4}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              Expires {pm.exp_month}/{pm.exp_year}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No payment method on file.
        </p>
      )}
      <Button
        variant="outline"
        onClick={() => setupMutation.mutate()}
        disabled={setupMutation.isPending}
      >
        {setupMutation.isPending
          ? 'Setting up...'
          : pm
            ? 'Update Payment Method'
            : 'Add Payment Method'}
      </Button>
    </div>
  );
}
