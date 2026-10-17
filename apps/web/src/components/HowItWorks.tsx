import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { LaneInstrument, type Orientation } from './LaneInstrument';
import type { LaneColumn } from '../lib/lanes';
import { useInView } from '../lib/hooks';

/**
 * Explanatory illustration only. It plays one short, finite sequence when it scrolls
 * into view and resets when it leaves. It is labelled so it cannot be mistaken for
 * live evidence; the live instrument replaces it once a real test exists.
 */

const CAPTIONS = [
  'While the trial is valid, Stripe and the app agree.',
  'The payment fails. Stripe stops the subscription, but the app still opens the report.',
  'Fastforward writes a repair and runs it in an isolated sandbox.',
  'A fresh test customer shows the two lanes agree again.',
];
const STEPS = 4;
const STEP_MS = 900;

function columnsFor(step: number): LaneColumn[] {
  return [
    { key: 'demo-1', group: 'Original app', moment: 'Trial starts', stripeStatus: 'trialing', expected: true, observed: true, agreement: 'agree', clock: null },
    step >= 1
      ? { key: 'demo-2', group: 'Original app', moment: 'Payment fails', stripeStatus: 'past_due', expected: false, observed: true, agreement: 'mismatch', clock: null }
      : { key: 'demo-2', group: 'Original app', moment: 'Payment fails', stripeStatus: null, expected: false, observed: null, agreement: 'pending', clock: null },
    step >= 3
      ? { key: 'demo-3', group: 'Repaired app', moment: 'Fresh customer', stripeStatus: 'past_due', expected: false, observed: false, agreement: 'agree', clock: null }
      : { key: 'demo-3', group: 'Repaired app', moment: 'Fresh customer', stripeStatus: null, expected: false, observed: null, agreement: 'pending', clock: null },
  ];
}

export function HowItWorks({ orientation }: { orientation: Orientation }) {
  const reduce = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [step, setStep] = useState(reduce ? STEPS - 1 : 0);

  useEffect(() => {
    if (reduce) { setStep(STEPS - 1); return; }
    if (!inView) { setStep(0); return; }
    const timers = Array.from({ length: STEPS - 1 }, (_, i) => window.setTimeout(() => setStep(i + 1), STEP_MS * (i + 1) + 300));
    return () => timers.forEach(window.clearTimeout);
  }, [inView, reduce]);

  const revealed = step >= 3 ? 3 : step >= 1 ? 2 : 1;
  return (
    <div ref={ref} className="illustration">
      <LaneInstrument
        key={inView ? 'in' : 'out'}
        columns={columnsFor(step)}
        orientation={orientation}
        title="Illustration of how Fastforward compares Stripe billing with app access"
        revealed={revealed}
        repairBefore={2}
        repairLabel={step >= 2 ? 'Repair' : ''}
        drawIn
      />
      <ol className="illustration__steps">
        {CAPTIONS.map((caption, i) => (
          <li key={caption} className={(reduce || step >= i) ? 'is-on' : ''}>{caption}</li>
        ))}
      </ol>
    </div>
  );
}
