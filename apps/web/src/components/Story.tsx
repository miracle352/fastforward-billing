import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Bug, CalendarClock, Code2, Plus, ShieldCheck, Wrench, Server } from 'lucide-react';
import { DEFECT_LINES, ORIGINAL_SOURCE, RECORDED_ON, REPAIR_EXPLANATION, STAGES_RECORDED, TOTAL_RECORDED } from '../lib/recorded';
import { useInView } from '../lib/hooks';
import { Reveal } from './Reveal';

const EASE = [0.22, 1, 0.36, 1] as const;

/** The cause: the sample app's real handler with the faulty lines lit, then the fix in plain words. */
export function TheBug() {
  return (
    <section className="section" aria-labelledby="bug-title">
      <div className="wrap">
        <div className="section__head">
          <Reveal><p className="kicker">Why it happens</p></Reveal>
          <Reveal delay={0.05}><h2 id="bug-title" className="h2">Usually it’s one forgotten line of code.</h2></Reveal>
          <Reveal delay={0.1}><p className="lead">Billing code listens for messages from Stripe. If it ignores the message that says a payment failed, nobody ever tells the app to close the door.</p></Reveal>
        </div>
        <div className="bug">
          <Reveal delay={0.12}>
            <figure className="window">
              <div className="window__bar"><span className="window__dots" aria-hidden="true"><i /><i /><i /></span><span className="window__title mono">billing.py</span><span className="chip chip--bad">Bug found</span></div>
              <pre className="source" tabIndex={0} aria-label="Excerpt of the sample app’s billing code"><code>
                {ORIGINAL_SOURCE.map((line, index) => (
                  <span key={index} className={`line${DEFECT_LINES.includes(index) ? ' is-bad' : ''}`}>
                    <span className="ln">{index + 1}</span>{line}
                  </span>
                ))}
              </code></pre>
              <figcaption className="code-note">From the sample app used in the live demo (shortened). Highlighted: the lines that skip every update after sign-up.</figcaption>
            </figure>
          </Reveal>
          <div className="steps-list">
            <Reveal delay={0.16}>
              <div className="fix-card fix-card--bad">
                <h3><Bug size={22} aria-hidden="true" />What went wrong</h3>
                <p>The code only reacts when a subscription is first created. When Leo’s payment failed, Stripe sent an update, and the code ignored it.</p>
              </div>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="fix-card fix-card--go">
                <h3><Wrench size={22} aria-hidden="true" />How Fastforward fixed it</h3>
                <blockquote>“{REPAIR_EXPLANATION}”</blockquote>
                <cite>The repair’s own description, recorded {RECORDED_ON}.</cite>
              </div>
            </Reveal>
            <Reveal delay={0.28}>
              <div className="fix-card">
                <h3><ShieldCheck size={22} aria-hidden="true" />Who says it works</h3>
                <p>Not the AI that wrote it. Fastforward’s fixed checks sign in as brand-new test customers and try to open the report.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

const HOW = [
  { icon: Server, title: 'Set up a safe copy', text: 'Our sample app starts in a private sandbox and Stripe creates test customers.', tone: '' },
  { icon: CalendarClock, title: 'Fast-forward the calendar', text: 'Stripe’s test clock jumps past the renewal date. Then we ask the app for each customer’s report.', tone: 'bad' },
  { icon: Code2, title: 'Write and run a fix', text: 'If the app answered wrongly, an AI writes new billing code and the sandbox checks it.', tone: '' },
  { icon: ShieldCheck, title: 'Prove it with new customers', text: 'Fresh test customers go through the same steps. Only a clean result counts as passed.', tone: 'go' },
] as const;

/** How it works: four plain steps, with a bar drawn to the scale of a recorded test. */
export function HowItWorks() {
  const reduce = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [played, setPlayed] = useState(false);
  useEffect(() => { if (inView) setPlayed(true); }, [inView]);
  useEffect(() => { const t = window.setTimeout(() => setPlayed(true), 8000); return () => window.clearTimeout(t); }, []);
  const total = STAGES_RECORDED.reduce((sum, stage) => sum + stage.seconds, 0);
  const classes = ['t-setup', 't-check', 't-repair', 't-verify'];

  return (
    <section id="how" className="section" aria-labelledby="how-title">
      <div className="wrap">
        <div className="section__head">
          <Reveal><p className="kicker">How it works</p></Reveal>
          <Reveal delay={0.05}><h2 id="how-title" className="h2">Four steps, about two minutes.</h2></Reveal>
          <Reveal delay={0.1}><p className="lead">You press one button. Fastforward does the rest and shows every step as it happens.</p></Reveal>
        </div>
        <ol className="how">
          {HOW.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} as="li" delay={0.08 * index} className={`how__step${step.tone ? ` how__step--${step.tone}` : ''}`}>
                <div className="how__top">
                  <span className="how__num">{index + 1}</span>
                  <span className="how__time">about {Math.round(STAGES_RECORDED[index].seconds)} sec</span>
                </div>
                <span className="how__icon" aria-hidden="true"><Icon size={24} /></span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </Reveal>
            );
          })}
        </ol>
        <div className="timeline" ref={ref}>
          <div className="timeline__bar" aria-hidden="true">
            {STAGES_RECORDED.map((stage, index) => (
              <motion.span
                key={stage.id}
                className={classes[index]}
                style={{ flexGrow: stage.seconds / total }}
                initial={false}
                animate={{ scaleX: reduce || played ? 1 : 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE, delay: 0.1 + index * 0.35 }}
              />
            ))}
          </div>
          <p>Drawn to scale from a test recorded on {RECORDED_ON}: {TOTAL_RECORDED} from start to finish. Times vary a little each run.</p>
        </div>
      </div>
    </section>
  );
}

/** Results from the recorded browser-started test. */
export function Proof() {
  return (
    <section className="section" aria-labelledby="proof-title">
      <div className="wrap">
        <div className="section__head">
          <Reveal><p className="kicker">Proven on a real run</p></Reveal>
          <Reveal delay={0.05}><h2 id="proof-title" className="h2">Found the leak. Fixed it. Checked it twice.</h2></Reveal>
          <Reveal delay={0.1}><p className="lead">On {RECORDED_ON}, a test started from this page found a report still open after a failed payment, repaired the code, and re-checked everything with new customers.</p></Reveal>
        </div>
        <div className="stats">
          <Reveal className="stat" delay={0.05}><span className="stat__value">7 / 7</span><span className="stat__label">checks passed with brand-new test customers, including three that try to sneak in</span></Reveal>
          <Reveal className="stat" delay={0.1}><span className="stat__value">2 min</span><span className="stat__label">from pressing the button to the final answer</span></Reveal>
          <Reveal className="stat" delay={0.15}><span className="stat__value">8</span><span className="stat__label">files kept for review: the new code, the change, the sandbox records and the report</span></Reveal>
        </div>
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  ['What does Fastforward actually check?', 'Whether the people your billing says should have access really do, and the people who stopped paying really don’t. It asks the app for a private report as each test customer and compares the answer with Stripe.'],
  ['Does the demo touch real money or real customers?', 'No. The live demo uses our own sample subscription app and Stripe’s test mode. Every customer, card and invoice is a test object, so nothing reaches a bank.'],
  ['What rule does it judge against?', 'Customers with an active or trial subscription may open their report. Everyone else may not, with no grace period. That is the demo app’s rule; your business might allow a few days’ grace.'],
  ['Why do the dates jump ahead?', 'Waiting a month for a renewal would be slow. Stripe’s test clocks move a test subscription forward in time, so a whole billing cycle takes seconds.'],
  ['Who writes the fix?', 'An AI model writes new billing code from the problems it was shown. That code runs only inside an isolated CreateOS sandbox, never on your servers.'],
  ['How do I know the fix really works?', 'Fastforward’s own checks decide, not the AI. They use customers that didn’t exist a minute earlier and try every door again, including people who shouldn’t get in.'],
  ['Could a “fix” just lock everyone out?', 'No. A paying customer must keep access. If the fix blocks them, the test fails.'],
  ['What do I get at the end?', 'A clear pass or fail, every check exactly as it happened, and the files to download: the new code, the change, the sandbox records and a report.'],
  ['What if something isn’t working?', 'The page tells you in plain words which service isn’t ready and won’t start a pretend test. You never need to enter a password or key.'],
  ['Can I test my own app?', 'The live demo runs on our sample app. Connecting your own billing code is the next step for Fastforward.'],
];

export function Faq() {
  return (
    <section id="questions" className="section" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="section__head section__head--center">
          <Reveal><p className="kicker">Questions</p></Reveal>
          <Reveal delay={0.05}><h2 id="faq-title" className="h2">Plain answers</h2></Reveal>
        </div>
        <div className="faq">
          {FAQ.map(([question, answer], index) => (
            <Reveal key={question} delay={Math.min(index, 5) * 0.04}>
              <details className="faq__item" open={index === 0}>
                <summary>{question}<span className="faq__plus" aria-hidden="true"><Plus size={18} /></span></summary>
                <p className="faq__answer">{answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Closing call to action, with two tracks drawn in code that meet in a check. */
export function Closing({ onPrimary, primaryLabel, disabled }: { onPrimary: () => void; primaryLabel: string; disabled: boolean }) {
  return (
    <section className="section" aria-labelledby="closing-title">
      <div className="wrap">
        <Reveal>
          <div className="cta">
            <svg className="cta__art" viewBox="0 0 500 300" aria-hidden="true">
              <path d="M10 90 H300 C350 90 360 150 410 150 H490" fill="none" stroke="rgba(245,246,247,0.35)" strokeWidth="6" strokeLinecap="round" />
              <path d="M10 210 H180 C210 210 215 250 245 250 C275 250 280 210 300 210 C350 210 360 150 410 150" fill="none" stroke="#ff6b5f" strokeWidth="6" strokeLinecap="round" strokeDasharray="14 12" />
              <path d="M300 210 C350 210 360 150 410 150" fill="none" stroke="#3ddc97" strokeWidth="6" strokeLinecap="round" />
              <circle cx="410" cy="150" r="30" fill="#3ddc97" />
              <path d="M396 151 L406 161 L425 140" fill="none" stroke="#04140c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <text x="12" y="70" fill="#868d97" fontSize="18" fontFamily="Geist, sans-serif">Billing</text>
              <text x="12" y="250" fill="#868d97" fontSize="18" fontFamily="Geist, sans-serif">Access</text>
            </svg>
            <h2 id="closing-title" className="h2">Find out if your billing and access agree.</h2>
            <p className="lead">Run the full test on our demo app. It takes about two minutes and you can watch every step.</p>
            <button type="button" className="btn btn--lg" onClick={onPrimary} disabled={disabled}>{primaryLabel}<ArrowRight size={20} aria-hidden="true" className="arrow" /></button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
