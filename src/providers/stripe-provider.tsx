'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { type ReactNode } from 'react';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export function StripeProvider({ children }: { children: ReactNode }) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#3b68d9',
            borderRadius: '8px',
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}
