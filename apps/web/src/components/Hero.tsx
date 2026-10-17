import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, CircleAlert, CreditCard, FileText, ShieldCheck, X } from 'lucide-react';
import { Mark } from './Wordmark';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The hero's product monitor. It replays a recorded test (17 October 2026) once, one event at a time,
 * then rests with every row visible. It is an example, not the visitor's own run, and says so.
 */
function Monitor() {
  // Each row carries its place in the replay; CSS plays it once on load and rests on the full state.
  return (
    <div className="window monitor" role="img" aria-label="Example from a recorded test: Stripe recorded Leo's failed payment and a past-due subscription, but the app still opened Leo's report. After Fastforward's repair, the report was blocked.">
      <div className="window__bar" aria-hidden="true">
        <span className="window__dots"><i /><i /><i /></span>
        <span className="window__title">Billing check · Leo, trial customer</span>
        <span className="chip chip--wait">Example</span>
      </div>
      <div aria-hidden="true">
        <div className="monitor__cols">
          <div className="monitor__col">
            <p className="monitor__label"><CreditCard size={16} /> What Stripe recorded</p>
            <div className="ev ev--go m-in" style={{ ['--i' as string]: 1 }}>
              <span className="ev__icon"><Check size={14} /></span>
              <div><b>Free trial started</b><span>Subscription: trialing</span></div>
            </div>
            <div className="ev m-in" style={{ ['--i' as string]: 2 }}>
              <span className="ev__icon"><X size={14} /></span>
              <div><b>Payment failed</b><span>$19.00 due · $0.00 paid</span></div>
            </div>
            <div className="ev m-in" style={{ ['--i' as string]: 3 }}>
              <span className="ev__icon"><CircleAlert size={14} /></span>
              <div><b>Subscription: past due</b><span>Access should stop</span></div>
            </div>
          </div>
          <div className="monitor__col">
            <p className="monitor__label"><FileText size={16} /> What the app did</p>
            <div className="ev ev--go m-in" style={{ ['--i' as string]: 1 }}>
              <span className="ev__icon"><Check size={14} /></span>
              <div><b>Report opened</b><span>Correct during the trial</span></div>
            </div>
            <div className="ev ev--bad m-in" style={{ ['--i' as string]: 3 }}>
              <span className="ev__icon"><X size={14} /></span>
              <div><b>Report still opened</b><span>Answered 200 OK, should refuse</span></div>
            </div>
            <div className="ev ev--go m-in" style={{ ['--i' as string]: 5 }}>
              <span className="ev__icon"><ShieldCheck size={14} /></span>
              <div><b>After the repair: refused</b><span>Answered 403, as it should</span></div>
            </div>
          </div>
        </div>
        <p className="monitor__verdict monitor__verdict--bad m-in" style={{ ['--i' as string]: 4 }}>
          <CircleAlert size={20} /> Mismatch found. <span>Leo stopped paying but kept access.</span>
        </p>
        <p className="monitor__verdict monitor__verdict--go m-in" style={{ ['--i' as string]: 6 }}>
          <ShieldCheck size={20} /> Repair verified. <span>New test customers checked again.</span>
        </p>
      </div>
      <p className="monitor__foot"><span>Example from a recorded test, 17 Oct 2026</span><span>Leo is a test customer</span></p>
    </div>
  );
}

export function Nav({ onPrimary, primaryLabel }: { onPrimary: () => void; primaryLabel: string }) {
  return (
    <header className="nav">
      <div className="wrap nav__inner">
        <a className="brand" href="#top" aria-label="Fastforward, top of page"><Mark /><span className="brand__name">Fastforward</span></a>
        <nav className="nav__links" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#test">Try it</a>
          <a href="#questions">Questions</a>
        </nav>
        <button type="button" className="btn btn--sm" onClick={onPrimary}>{primaryLabel}<ArrowRight size={16} aria-hidden="true" className="arrow" /></button>
      </div>
    </header>
  );
}

export function Hero({ onPrimary, primaryLabel }: { onPrimary: () => void; primaryLabel: string }) {
  const reduce = useReducedMotion();
  const enter = (delay: number) => reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: EASE, delay } };
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="wrap hero__grid">
        <div>
          <motion.h1 id="hero-title" className="hero__title" {...enter(0)}>
            <span>Payment failed.</span>
            <span className="is-bad">Access granted.</span>
          </motion.h1>
          <motion.p className="hero__lead lead" {...enter(0.08)}>
            When a customer stops paying, your app should stop giving them access. Fastforward checks that it does,
            fixes the code when it doesn’t, and proves the fix works.
          </motion.p>
          <motion.div className="hero__actions" {...enter(0.16)}>
            <button type="button" className="btn btn--lg" onClick={onPrimary}>{primaryLabel}<ArrowRight size={20} aria-hidden="true" className="arrow" /></button>
            <a className="btn btn--lg btn--ghost" href="#how">See how it works</a>
          </motion.div>
          <motion.p className="hero__note" {...enter(0.24)}>
            <ShieldCheck size={18} aria-hidden="true" />
            The live demo checks our own sample subscription app with Stripe test customers. Your real billing and customers are never touched.
          </motion.p>
        </div>
        <motion.div {...enter(0.12)}><Monitor /></motion.div>
      </div>
    </section>
  );
}
