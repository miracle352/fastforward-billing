import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Scenario } from '@fastforward/contracts';
import { useFastforward, type Fastforward } from './api/useFastforward';
import { Console } from './components/Console';
import { Stage } from './components/Stage';
import { Evidence } from './components/Evidence';
import { Explainer } from './components/Explainer';
import { Wordmark, Mark } from './components/Wordmark';
import { useMediaQuery } from './lib/hooks';

const EASE = [0.22, 1, 0.36, 1] as const;

export function ConnectedApp() {
  return <App ff={useFastforward()} />;
}

/** `preview` is set only by the development-only design preview (never in production builds). */
export function App({ ff, preview = null }: { ff: Fastforward; preview?: string | null }) {
  const [scenarios, setScenarios] = useState<Scenario[]>(['healthy_renewal', 'trial_payment_failure']);
  const evidenceHeading = useRef<HTMLHeadingElement>(null);
  const narrow = useMediaQuery('(max-width: 619px)');
  const reduce = useReducedMotion();

  const start = async () => {
    const run = await ff.start(scenarios);
    if (run) {
      // Move focus once, on the visitor's own action, to where the result will appear.
      evidenceHeading.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      evidenceHeading.current?.focus({ preventScroll: true });
    }
  };

  const enter = (delay: number) => reduce ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay },
  };

  return (
    <>
      <a className="skip" href="#main">Skip to the test</a>
      {preview && (
        <div className="preview-banner" role="note">
          Design preview · Not connected · {preview}. Nothing on this page is a real test.
        </div>
      )}
      <header className="topbar">
        <div className="topbar__inner">
          <a href="#top" className="topbar__brand" aria-label="Fastforward, back to top"><Wordmark /></a>
          <nav aria-label="Sections" className="topbar__nav">
            <a href="#evidence">The test</a>
            <a href="#scope">Assumptions</a>
          </nav>
          <span className="topbar__label">Sample app · Stripe test mode</span>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <div id="top" className={ff.run ? 'hero has-run' : 'hero'}>
          <div className="hero__copy">
            <motion.h1 className="hero__title" {...enter(0)}>
              <span className="hero__line">Find billing bugs</span>{' '}
              <span className="hero__line">before customers do.</span>
            </motion.h1>
            <motion.p className="hero__lede" {...enter(0.08)}>
              Run a sample subscription through renewal and failed payment. Fastforward checks who can still get in,
              writes a repair, and tests it again.
            </motion.p>
            <motion.div className="hero__console" {...enter(0.16)}>
              <Console ff={ff} scenarios={scenarios} onScenarios={setScenarios} onStart={() => void start()} />
            </motion.div>
          </div>
          <motion.div className="hero__stage" {...(reduce ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, ease: EASE, delay: 0.12 } })}>
            <Stage run={ff.run} events={ff.events} orientation={narrow ? 'vertical' : 'horizontal'} />
          </motion.div>
        </div>

        <Evidence ff={ff} ref={evidenceHeading} />
        <Explainer />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <p className="footer__name"><Mark size={22} /> Fastforward</p>
          <p className="footer__note">
            A hackathon build. Tests a supplied sample app in Stripe test mode with simulated billing time.
            It does not connect to live accounts, move real money or review your own code.
          </p>
        </div>
      </footer>
    </>
  );
}
