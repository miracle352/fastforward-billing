import { useRef, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CreditCard, FileText, Link2, Link2Off, UserCheck, UserX, UserRound, Users } from 'lucide-react';
import { RECORDED_ON, SITUATIONS, type Situation, type Version } from '../lib/recorded';
import { Reveal } from './Reveal';

const EASE = [0.22, 1, 0.36, 1] as const;
const ICONS: Record<Situation, typeof UserX> = { 'leo-fails': UserX, 'maya-renews': UserCheck, stranger: UserRound, cross: Users };
const SUBS: Record<Situation, string> = {
  'leo-fails': 'The card is declined when the trial ends',
  'maya-renews': 'The monthly payment goes through',
  stranger: 'Nobody is signed in',
  cross: 'One customer tries to read another’s report',
};

/**
 * The page's one interactive explanation: choose a recorded moment, then compare the
 * app before and after the fix. Stripe's record and the app's answer sit one above the other.
 */
export function Explorer() {
  const reduce = useReducedMotion();
  const [situation, setSituation] = useState<Situation>('leo-fails');
  const [version, setVersion] = useState<Version>('original');
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const current = SITUATIONS.find(item => item.id === situation)!;
  const side = current.versions[version];
  const mismatch = side.verdict === 'mismatch';
  const t = reduce ? { duration: 0 } : { duration: 0.35, ease: EASE };

  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + SITUATIONS.length) % SITUATIONS.length;
    setSituation(SITUATIONS[next].id);
    radios.current[next]?.focus();
  };

  return (
    <section className="section" aria-labelledby="explorer-title">
      <div className="wrap">
        <div className="section__head">
          <Reveal><p className="kicker">See it for yourself</p></Reveal>
          <Reveal delay={0.05}><h2 id="explorer-title" className="h2">Two systems, one customer. Do they agree?</h2></Reveal>
          <Reveal delay={0.1}><p className="lead">Pick a moment from a recorded test. You’ll see what Stripe knew about the customer, and what the app actually did.</p></Reveal>
        </div>

        <div className="explorer">
          <Reveal delay={0.12}>
            <div className="moments" role="radiogroup" aria-label="Recorded moments">
              {SITUATIONS.map((item, index) => {
                const checked = item.id === situation;
                const verdict = item.versions[version].verdict;
                const Icon = ICONS[item.id];
                return (
                  <button
                    key={item.id}
                    ref={element => { radios.current[index] = element; }}
                    type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1}
                    className="moment"
                    onClick={() => setSituation(item.id)}
                    onKeyDown={event => onKey(event, index)}
                  >
                    <span className="moment__icon" aria-hidden="true"><Icon size={22} /></span>
                    <span>
                      <span className="moment__title">{item.line.replace(/\.$/, '')}</span>
                      <span className="moment__sub">{SUBS[item.id]}</span>
                    </span>
                    <span className={`chip ${verdict === 'agree' ? 'chip--go' : 'chip--bad'}`}>{verdict === 'agree' ? 'Agree' : 'Disagree'}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="window">
              <div className="window__bar">
                <span className="window__title">{current.who}</span>
                <div className="toggle" role="group" aria-label="Which version of the app" style={{ marginLeft: 'auto' }}>
                  <button type="button" aria-pressed={version === 'original'} onClick={() => setVersion('original')}>Before the fix</button>
                  <button type="button" aria-pressed={version === 'repaired'} onClick={() => setVersion('repaired')}>After the fix</button>
                </div>
              </div>
              <motion.div key={`${situation}-${version}`} className="answer__body" aria-live="polite"
                initial={reduce ? false : { opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={t}>
                <div className="side">
                  <span className="side__icon" aria-hidden="true"><CreditCard size={24} /></span>
                  <span className="side__who">Stripe says</span>
                  <span className="side__value">{current.stripe ? current.stripe.status : 'No subscription involved'}</span>
                  {current.stripe && <span className="side__detail">{current.stripe.detail}</span>}
                </div>

                <div className={`bridge ${mismatch ? 'bridge--bad' : 'bridge--go'}`}>
                  <span className="bridge__line" aria-hidden="true" />
                  <span className="bridge__text">
                    {mismatch ? <Link2Off size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
                    {mismatch ? 'They disagree' : 'They agree'}
                  </span>
                </div>

                <div className={`side ${mismatch ? 'side--bad' : 'side--go'}`}>
                  <span className="side__icon" aria-hidden="true"><FileText size={24} /></span>
                  <span className="side__who">The app</span>
                  <span className="side__value">{side.access === 'opened' ? 'Opened the report' : 'Refused the report'}</span>
                  <span className={`chip mono ${mismatch ? 'chip--bad' : 'chip--go'}`}>{side.http}</span>
                  <span className="side__detail">{current.request}</span>
                </div>

                <p className="answer__rule"><strong>The rule:</strong> {current.policy}</p>
                <p className="muted" style={{ fontSize: '0.875rem' }}>Checker’s verdict: “{side.message}” Recorded {RECORDED_ON} with Stripe test customers.</p>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
