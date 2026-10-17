import Stripe from 'stripe';
import { ProviderError, pollUntil, safeProviderError } from './common.js';

export type BillingScenario = 'healthy_renewal' | 'trial_payment_failure';
export interface StripeFixture {
  scenario: BillingScenario; clockId: string; customerId: string; subscriptionId: string;
  initialStatus: string; initialInvoiceId: string | null; initialTime: number; periodEnd: number;
}
export interface StripeFixtureBundle {
  runId: string; phase: 'baseline' | 'verification'; productId: string; priceId: string; fixtures: StripeFixture[];
}
export interface StripeObservation {
  scenario: BillingScenario; clockId: string; customerId: string; subscriptionId: string;
  status: string; invoiceId: string | null; invoiceStatus: string | null; invoicePaid: boolean;
  amountDue: number | null; amountPaid: number | null; clockTime: number;
}
export interface FixtureResource { kind: 'clock' | 'product' | 'price' | 'customer' | 'subscription' | 'webhook'; id: string; }

/** A prior successful initial charge cannot serve as evidence that a renewal succeeded. */
export function isAdvancedObservation(fixture: StripeFixture, value: StripeObservation): boolean {
  if (value.subscriptionId !== fixture.subscriptionId || value.customerId !== fixture.customerId
    || value.clockId !== fixture.clockId || value.clockTime <= fixture.periodEnd
    || !value.invoiceId || value.invoiceId === fixture.initialInvoiceId) return false;
  return fixture.scenario === 'healthy_renewal'
    ? Boolean(fixture.initialInvoiceId) && value.status === 'active' && value.invoicePaid && value.amountPaid === 1900
    : !['active','trialing'].includes(value.status) && !value.invoicePaid && value.amountDue === 1900;
}

export function assertStripeTestKey(key: string, role: 'controller' | 'readonly'): void {
  if (role === 'controller' && !/^sk_test_[A-Za-z0-9]+$/.test(key))
    throw new ProviderError('stripe', 'TEST_KEY_REQUIRED', 'The controller requires a Stripe secret test key. Live keys are refused.');
  if (role === 'readonly' && !/^rk_test_[A-Za-z0-9]+$/.test(key))
    throw new ProviderError('stripe', 'RESTRICTED_TEST_KEY_REQUIRED', 'The generated app requires a restricted Stripe test key. Full-access and live keys are refused.');
}

export class StripeBillingProvider {
  readonly controller: Stripe;
  private readonly reader: Stripe;
  private readonly pollTimeoutMs: number;
  constructor(config: { controllerKey: string; readonlyKey: string; pollTimeoutMs?: number }) {
    assertStripeTestKey(config.controllerKey, 'controller');
    assertStripeTestKey(config.readonlyKey, 'readonly');
    this.controller = new Stripe(config.controllerKey, { maxNetworkRetries: 1, timeout: 20_000 });
    this.reader = new Stripe(config.readonlyKey, { maxNetworkRetries: 1, timeout: 20_000 });
    this.pollTimeoutMs = config.pollTimeoutMs ?? 120_000;
  }

  async probe(): Promise<{ controller: true; readonly: true; readonlyPermissionsVerified: false }> {
    try {
      const [a, b] = await Promise.all([
        this.controller.subscriptions.list({ limit: 1 }), this.reader.subscriptions.list({ limit: 1 }),
      ]);
      if ([...a.data, ...b.data].some(x => x.livemode)) throw new ProviderError('stripe', 'LIVE_OBJECT_REJECTED', 'A live Stripe object was returned.');
      // Reading succeeds, but the rk_ prefix alone does not prove all write permissions were removed.
      return { controller: true, readonly: true, readonlyPermissionsVerified: false };
    } catch (error) { throw safeProviderError('stripe', error); }
  }

  async createWebhook(url: string, operationId: string): Promise<{ id: string; secret: string; url: string }> {
    if (new URL(url).protocol !== 'https:') throw new ProviderError('stripe', 'HTTPS_REQUIRED', 'Stripe webhook ingress requires an HTTPS URL.');
    try {
      const endpoint = await this.controller.webhookEndpoints.create({
        url, enabled_events: ['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted',
          'invoice.paid','invoice.payment_failed'], description: `Fastforward test ${operationId}`,
        metadata: { fastforward: 'true', operation_id: operationId },
      }, { idempotencyKey: `ff-webhook-${operationId}` });
      if (endpoint.livemode || !endpoint.secret) throw new ProviderError('stripe', 'WEBHOOK_NOT_TEST', 'A test webhook signing secret was not returned.');
      return { id: endpoint.id, secret: endpoint.secret, url: endpoint.url };
    } catch (error) { throw safeProviderError('stripe', error); }
  }
  async deleteWebhook(id: string): Promise<void> {
    try { await this.controller.webhookEndpoints.del(id); } catch (error) { throw safeProviderError('stripe', error); }
  }

  async createFixtures(input: { runId: string; phase: 'baseline' | 'verification'; scenarios: BillingScenario[];
    onResource?: (resource: FixtureResource) => void | Promise<void> }): Promise<StripeFixtureBundle> {
    if (!input.scenarios.length || input.scenarios.length > 2 || new Set(input.scenarios).size !== input.scenarios.length)
      throw new ProviderError('stripe', 'INVALID_SCENARIOS', 'Choose one or both distinct supported scenarios.');
    const prefix = `ff-${input.runId}-${input.phase}`;
    const metadata = { fastforward: 'true', run_id: input.runId, phase: input.phase };
    const bundle: StripeFixtureBundle = { runId: input.runId, phase: input.phase, productId: '', priceId: '', fixtures: [] };
    const createdClocks: string[] = [];
    const resources: FixtureResource[] = [];
    const track = async (kind: FixtureResource['kind'], id: string) => {
      resources.push({ kind, id }); await input.onResource?.({ kind, id });
    };
    try {
      const product = await this.controller.products.create({ name: `Fastforward sample report ${input.runId}`, metadata },
        { idempotencyKey: `${prefix}-product` });
      bundle.productId = product.id; await track('product', product.id);
      const price = await this.controller.prices.create({ product: product.id, currency: 'usd', unit_amount: 1900,
        recurring: { interval: 'month' }, metadata }, { idempotencyKey: `${prefix}-price` });
      bundle.priceId = price.id; await track('price', price.id);
      for (const scenario of input.scenarios) {
        const initialTime = Math.floor(Date.now() / 1000);
        const clock = await this.controller.testHelpers.testClocks.create({ frozen_time: initialTime, name: `${prefix}-${scenario}` },
          { idempotencyKey: `${prefix}-${scenario}-clock` });
        createdClocks.push(clock.id); await track('clock', clock.id);
        const paymentMethod = scenario === 'healthy_renewal' ? 'pm_card_visa' : 'pm_card_chargeCustomerFail';
        const customer = await this.controller.customers.create({ test_clock: clock.id,
          name: scenario === 'healthy_renewal' ? 'Maya — healthy renewal' : 'Leo — trial payment failure',
          payment_method: paymentMethod, invoice_settings: { default_payment_method: paymentMethod }, metadata,
        }, { idempotencyKey: `${prefix}-${scenario}-customer` });
        await track('customer', customer.id);
        const trialEnd = initialTime + 7 * 86400;
        const subscription = await this.controller.subscriptions.create({ customer: customer.id,
          items: [{ price: price.id }], collection_method: 'charge_automatically', metadata,
          ...(scenario === 'trial_payment_failure' ? { trial_end: trialEnd } : {}),
        }, { idempotencyKey: `${prefix}-${scenario}-subscription` });
        await track('subscription', subscription.id);
        if (subscription.livemode) throw new ProviderError('stripe', 'LIVE_OBJECT_REJECTED', 'A live Stripe subscription was returned.');
        const itemPeriodEnd = (subscription.items.data[0] as unknown as { current_period_end?: number })?.current_period_end;
        const oldPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
        const periodEnd = scenario === 'trial_payment_failure' ? trialEnd : itemPeriodEnd ?? oldPeriodEnd;
        if (!periodEnd) throw new ProviderError('stripe', 'MISSING_PERIOD_END', 'Stripe did not return the subscription renewal time.');
        const initialInvoiceId = typeof subscription.latest_invoice === 'string'
          ? subscription.latest_invoice : subscription.latest_invoice?.id ?? null;
        bundle.fixtures.push({ scenario, clockId: clock.id, customerId: customer.id, subscriptionId: subscription.id,
          initialStatus: subscription.status, initialInvoiceId, initialTime, periodEnd });
      }
      return bundle;
    } catch (error) {
      const cleanupFailures: string[] = [];
      for (const id of createdClocks) {
        try { await this.controller.testHelpers.testClocks.del(id); } catch { cleanupFailures.push(`clock:${id}`); }
      }
      try { if (bundle.priceId) await this.controller.prices.update(bundle.priceId, { active: false }); }
      catch { cleanupFailures.push(`price:${bundle.priceId}`); }
      try { if (bundle.productId) await this.controller.products.update(bundle.productId, { active: false }); }
      catch { cleanupFailures.push(`product:${bundle.productId}`); }
      const safe = safeProviderError('stripe', error);
      throw new ProviderError('stripe', safe.code, safe.message, { resources, cleanupFailures });
    }
  }

  private async advanceAndWait(clockId: string, frozenTime: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    const current = await this.controller.testHelpers.testClocks.retrieve(clockId);
    if (current.frozen_time < frozenTime) await this.controller.testHelpers.testClocks.advance(clockId, { frozen_time: frozenTime },
      { idempotencyKey: `ff-advance-${clockId}-${frozenTime}` });
    await pollUntil(() => this.controller.testHelpers.testClocks.retrieve(clockId), clock => clock.status === 'ready',
      { timeoutMs: this.pollTimeoutMs, signal, description: 'Stripe test-clock readiness' });
  }

  async advanceFixture(fixture: StripeFixture, signal?: AbortSignal): Promise<StripeObservation> {
    try {
      // First cross the boundary. Then advance the invoice finalisation delay instead of guessing from a timer.
      await this.advanceAndWait(fixture.clockId, fixture.periodEnd + 1, signal);
      await this.advanceAndWait(fixture.clockId, fixture.periodEnd + 3700, signal);
      return await pollUntil(() => this.observeFixture(fixture), value => isAdvancedObservation(fixture, value),
      { timeoutMs: this.pollTimeoutMs, signal, description: 'settled test subscription and invoice state' });
    } catch (error) { throw safeProviderError('stripe', error); }
  }

  async observeFixture(fixture: StripeFixture): Promise<StripeObservation> {
    try {
      const [subscription, clock] = await Promise.all([
        this.controller.subscriptions.retrieve(fixture.subscriptionId),
        this.controller.testHelpers.testClocks.retrieve(fixture.clockId),
      ]);
      if (subscription.livemode) throw new ProviderError('stripe', 'LIVE_OBJECT_REJECTED', 'A live Stripe object was returned.');
      const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice?.id ?? null;
      const invoice = invoiceId ? await this.controller.invoices.retrieve(invoiceId) : null;
      return { scenario: fixture.scenario, clockId: clock.id, customerId: fixture.customerId,
        subscriptionId: subscription.id, status: subscription.status, invoiceId,
        invoiceStatus: invoice?.status ?? null, invoicePaid: invoice?.status === 'paid',
        amountDue: invoice?.amount_due ?? null, amountPaid: invoice?.amount_paid ?? null, clockTime: clock.frozen_time };
    } catch (error) { throw safeProviderError('stripe', error); }
  }

  async verifyReadonlyFixture(fixture: StripeFixture): Promise<{ sameAccountReadConfirmed: true }> {
    try {
      const subscription = await this.reader.subscriptions.retrieve(fixture.subscriptionId);
      const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      if (subscription.livemode || customer !== fixture.customerId)
        throw new ProviderError('stripe', 'READONLY_ACCOUNT_MISMATCH', 'The restricted key did not retrieve the expected test customer subscription.');
      return { sameAccountReadConfirmed: true };
    } catch (error) { throw safeProviderError('stripe', error); }
  }

  async cleanupFixtures(bundle: StripeFixtureBundle): Promise<{ deletedClockIds: string[]; failures: string[] }> {
    const deletedClockIds: string[] = [], failures: string[] = [];
    for (const fixture of bundle.fixtures) {
      try { await this.controller.testHelpers.testClocks.del(fixture.clockId); deletedClockIds.push(fixture.clockId); }
      catch { failures.push(`Clock cleanup not confirmed: ${fixture.clockId}`); }
    }
    try { if (bundle.priceId) await this.controller.prices.update(bundle.priceId, { active: false }); }
    catch { failures.push(`Price archival not confirmed: ${bundle.priceId}`); }
    try { if (bundle.productId) await this.controller.products.update(bundle.productId, { active: false }); }
    catch { failures.push(`Product archival not confirmed: ${bundle.productId}`); }
    return { deletedClockIds, failures };
  }
}
