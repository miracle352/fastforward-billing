import { useRef, useState } from 'react';
import type { Scenario } from '@fastforward/contracts';
import { useFastforward, type Fastforward } from './api/useFastforward';
import { Hero, Nav } from './components/Hero';
import { Explorer } from './components/Explorer';
import { TheBug, HowItWorks, Proof, Faq, Closing } from './components/Story';
import { Console } from './components/Console';
import { Stage } from './components/Stage';
import { RunDetails } from './components/Evidence';
import { Reveal } from './components/Reveal';
import { ArrowRight } from 'lucide-react';
import { Mark } from './components/Wordmark';
import { useMediaQuery } from './lib/hooks';
import { isTerminal } from './lib/status';

const STATUS_SERVICES = [['stripe', 'Stripe'], ['stripe_readonly', 'Stripe read-only'], ['createos', 'Sandbox'], ['groq', 'Repair writer']] as const;

export function ConnectedApp() {
  return <App ff={useFastforward()} />;
}

/** `preview` is set only by the development-only design preview (never in production builds). */
export function App({ ff, preview = null }: { ff: Fastforward; preview?: string | null }) {
  const [scenarios, setScenarios] = useState<Scenario[]>(['healthy_renewal', 'trial_payment_failure']);
  const testHeading = useRef<HTMLHeadingElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const narrow = useMediaQuery('(max-width: 619px)');

  const running = ff.run !== null && !isTerminal(ff.run.status);
  const canStart = ff.connection === 'online' && ff.readiness?.ready === true && !running && !ff.starting && scenarios.length > 0;

  /** Synchronously bring the real test console into view and put focus where the answer is. */
  const goToTest = (willStart: boolean) => {
    // Instant, not smooth: the console must be on screen the moment the button is pressed.
    document.getElementById(running ? 'run' : 'test-console')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    const blocker = document.getElementById('test-blocker');
    const target = running ? testHeading.current
      : !willStart && blocker ? blocker
      : startButton.current ?? testHeading.current;
    target?.focus({ preventScroll: true });
  };

  // Every "Test my billing" does the same thing: show the console immediately (before any request),
  // then start only if the server's readiness allows it. The server stays the authority.
  const start = async () => {
    goToTest(canStart);
    if (!canStart) return;
    const run = await ff.start(scenarios);
    if (run) document.getElementById('run')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  };
  const primaryLabel = ff.starting ? 'Starting…' : running ? 'Follow your test' : 'Test my billing';

  return (
    <>
      <a className="skip" href="#test">Skip to the test</a>
      {preview && <div className="preview-banner" role="note">Design preview · Not connected · {preview}. Nothing on this page is a real test.</div>}
      <Nav onPrimary={() => void start()} primaryLabel={primaryLabel} />
      <main>
        <Hero onPrimary={() => void start()} primaryLabel={primaryLabel} />
        <Explorer />
        <HowItWorks />
        <TheBug />

        <section id="test" className="section" aria-labelledby="test-title">
          <div className="wrap">
            <div className="section__head">
              <Reveal><p className="kicker">Try it now</p></Reveal>
              <Reveal delay={0.05}><h2 id="test-title" ref={testHeading} tabIndex={-1} className="h2">Run a real billing test.</h2></Reveal>
              <Reveal delay={0.1}><p className="lead">Three steps. Every result you see comes straight from the test as it happens, nothing is made up.</p></Reveal>
            </div>
            <Reveal delay={0.12}>
              <div className="window" id="test-console">
                <div className="window__bar">
                  <span className="window__dots" aria-hidden="true"><i /><i /><i /></span>
                  <span className="window__title">Fastforward · New billing test</span>
                </div>
                <div className="app">
                  <Console ref={startButton} ff={ff} scenarios={scenarios} onScenarios={setScenarios} onStart={() => void start()} />
                  <Stage run={ff.run} events={ff.events} scenarios={scenarios} orientation={narrow ? 'vertical' : 'horizontal'} />
                </div>
              </div>
            </Reveal>
            <RunDetails ff={ff} />
          </div>
        </section>

        <Proof />
        <Faq />
        <Closing onPrimary={() => void start()} primaryLabel={primaryLabel} disabled={ff.starting} />
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="footer__status" aria-live="polite">
            <span className="footer__status-title">Live service status</span>
            <ul>
              {STATUS_SERVICES.map(([id, name]) => {
                const provider = ff.readiness?.providers.find(item => item.id === id);
                const state = !ff.readiness ? 'checking' : provider?.status === 'ready' ? 'ready' : 'down';
                return (
                  <li key={id} className={`is-${state}`}>
                    <span className="footer__dot" aria-hidden="true" />{name}
                    <span className="visually-hidden">: {state === 'ready' ? 'ready' : state === 'checking' ? 'checking' : 'not ready'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="footer__grid">
            <div className="footer__brand">
              <a className="brand" href="#top"><Mark /><span>Fastforward</span></a>
              <p>Catches the moment your app keeps serving customers who stopped paying, fixes the code, and proves the fix.</p>
              <button type="button" className="btn" onClick={() => void start()} disabled={ff.starting}>{primaryLabel}<ArrowRight size={18} aria-hidden="true" className="arrow" /></button>
            </div>
            <div>
              <h3>Product</h3>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#test">Try it</a></li>
                <li><a href="#questions">Questions</a></li>
              </ul>
            </div>
            <div>
              <h3>Resources</h3>
              <ul>
                <li><a href="https://github.com/miracle352/fastforward-billing">Source code</a></li>
                <li><a href="https://docs.stripe.com/billing/testing/test-clocks">Stripe test clocks</a></li>
              </ul>
            </div>
          </div>
          <div className="footer__mark" aria-hidden="true">
            <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
              <path d="M0 20 H760 C820 20 840 40 900 40 H1200" fill="none" stroke="rgba(245,246,247,0.18)" strokeWidth="2" />
              <path d="M0 52 H520 C560 52 570 40 600 40 C640 40 650 52 700 52 C760 52 840 40 900 40" fill="none" stroke="#ff6b5f" strokeWidth="2" strokeDasharray="8 8" />
              <path d="M700 52 C760 52 840 40 900 40 H1200" fill="none" stroke="#3ddc97" strokeWidth="2" />
            </svg>
            <span>Fastforward</span>
          </div>
          <div className="footer__bottom">
            <span>© 2026 Fastforward</span>
            <span>The live demo uses Stripe test mode and simulated dates. No real payments.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
