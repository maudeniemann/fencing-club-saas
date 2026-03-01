import { stripe } from './client';

export async function createConnectedAccount(clubName: string, clubId: string) {
  return stripe.accounts.create({
    type: 'custom',
    country: 'US',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'company',
    business_profile: {
      name: clubName,
      mcc: '7941', // Sports clubs/fields
    },
    metadata: { club_id: clubId },
  });
}

export async function createAccountLink(
  stripeAccountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  return stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

export async function getAccountStatus(stripeAccountId: string) {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  };
}

export async function createStripeCustomer(
  email: string,
  name: string,
  memberId: string
) {
  return stripe.customers.create({
    email,
    name,
    metadata: { member_id: memberId },
  });
}

export async function createSetupIntent(customerId: string) {
  return stripe.setupIntents.create({
    customer: customerId,
    automatic_payment_methods: { enabled: true },
  });
}
