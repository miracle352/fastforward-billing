import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { LaneColumn } from '../lib/lanes';
import { accessLabel, stripeLabel } from '../lib/status';

/**
 * The signature instrument: Stripe's billing record (upper lane) beside the app's
 * observed report access (lower lane). Where they disagree under the declared policy,
 * the access lane drops away and an amber break opens. Agreement reconnects them.
 *
 * Horizontal on wide screens; on phones the same idea runs vertically, time flowing down.
 */

export type Orientation = 'horizontal' | 'vertical';

type Props = {
  columns: LaneColumn[];
  orientation: Orientation;
  title: string;
  /** Number of columns drawn in full; the rest appear as faint "not yet" ghosts. */
  revealed?: number;
  /** Optional marker drawn between two columns (index of the column it precedes). */
  repairBefore?: number | null;
  repairLabel?: string;
  drawIn?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;

function geometry(orientation: Orientation, count: number) {
  if (orientation === 'horizontal') {
    const left = 132, col = 168;
    return {
      width: left + count * col + 8, height: 322,
      at: (i: number) => left + col * i + col / 2,
      stripe: 104, access: 188, drop: 236,
      point: (t: number, lane: number) => ({ x: t, y: lane }),
    };
  }
  const top = 70, row = 150;
  return {
    width: 340, height: top + count * row - 26,
    at: (i: number) => top + row * i + 56,
    stripe: 84, access: 178, drop: 230,
    point: (t: number, lane: number) => ({ x: lane, y: t }),
  };
}

export function LaneInstrument({ columns, orientation, title, revealed = columns.length, repairBefore = null, repairLabel = 'Repair', drawIn = false }: Props) {
  const reduce = useReducedMotion();
  const id = useId();
  const g = geometry(orientation, columns.length);
  const horizontal = orientation === 'horizontal';
  const transition = reduce ? { duration: 0 } : { duration: 0.32, ease: EASE };

  const accessLane = (column: LaneColumn) => (column.agreement === 'mismatch' ? g.drop : g.access);
  const nodes = columns.map((column, i) => ({
    column, i, t: g.at(i), shown: i < revealed,
    s: g.point(g.at(i), g.stripe), a: g.point(g.at(i), accessLane(column)),
  }));

  // Lane paths share one command structure so motion can interpolate them.
  const start = horizontal ? g.at(0) - 84 : g.at(0) - 52;
  const end = horizontal ? g.at(columns.length - 1) + 84 : g.at(columns.length - 1) + 48;
  const lanePath = (laneFor: (column: LaneColumn) => number) => {
    let previous = laneFor(columns[0]);
    const first = g.point(start, previous);
    let d = `M ${first.x} ${first.y}`;
    nodes.forEach(({ column, t }, i) => {
      const lane = laneFor(column);
      const from = i === 0 ? start : g.at(i - 1);
      const mid = (from + t) / 2;
      const c1 = g.point(mid, previous), c2 = g.point(mid, lane), p = g.point(t, lane);
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p.x} ${p.y}`;
      previous = lane;
    });
    const tail = g.point(end, previous);
    d += ` L ${tail.x} ${tail.y}`;
    return d;
  };

  const summary = columns.slice(0, revealed).map(column =>
    `${column.group}, ${column.moment}: Stripe ${stripeLabel(column.stripeStatus)}; ${accessLabel(column.observed)}; ${
      column.agreement === 'agree' ? 'matches the policy' : column.agreement === 'mismatch' ? 'does not match the policy' : column.agreement === 'error' ? 'check error' : 'not observed yet'}.`).join(' ');

  const laneHead = horizontal
    ? [{ x: 16, y: g.stripe, a: 'Stripe says', b: 'Billing' }, { x: 16, y: g.access, a: 'The app did', b: 'Report access' }]
    : [{ x: g.stripe, y: 22, a: 'Stripe says', b: 'Billing' }, { x: g.access, y: 22, a: 'The app did', b: 'Report access' }];

  return (
    <svg
      className={`lanes lanes--${orientation}`}
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
      preserveAspectRatio="xMidYMin meet"
      style={horizontal ? { maxWidth: g.width * 1.05 } : undefined}
    >
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{summary || 'Nothing has been observed yet.'}</desc>

      {laneHead.map(head => (
        <g key={head.a} className="lanes__head" aria-hidden="true">
          <text x={head.x} y={head.y - (horizontal ? 4 : 0)} textAnchor={horizontal ? 'start' : 'middle'} className="lanes__head-a">{head.a}</text>
          <text x={head.x} y={head.y + (horizontal ? 16 : 18)} textAnchor={horizontal ? 'start' : 'middle'} className="lanes__head-b">{head.b}</text>
        </g>
      ))}

      {/* Lanes */}
      <motion.path
        className="lanes__rail lanes__rail--stripe"
        d={lanePath(() => g.stripe)}
        initial={drawIn && !reduce ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.8, ease: EASE }}
      />
      <motion.path
        className="lanes__rail lanes__rail--access"
        initial={drawIn && !reduce ? { pathLength: 0, d: lanePath(accessLane) } : false}
        animate={{ pathLength: 1, d: lanePath(accessLane) }}
        transition={reduce ? { duration: 0 } : { duration: 0.8, ease: EASE, d: { duration: 0.42, ease: EASE } }}
      />

      {/* Column and group labels */}
      {nodes.map(({ column, i, t, shown }) => {
        const newGroup = i === 0 || columns[i - 1].group !== column.group;
        const label = horizontal ? { x: t, y: 34 } : { x: 6, y: t - 54 };
        return (
          <g key={`label-${column.key}`} className={shown ? '' : 'is-ghost'} aria-hidden="true">
            {newGroup && (
              <text x={horizontal ? t - 74 : label.x} y={horizontal ? 18 : label.y - 2} className="lanes__group">{column.group}</text>
            )}
            <text x={horizontal ? t : label.x} y={horizontal ? 44 : label.y + 16} textAnchor={horizontal ? 'middle' : 'start'} className="lanes__moment">{column.moment}</text>
          </g>
        );
      })}

      {repairBefore !== null && repairBefore > 0 && repairBefore < columns.length && (() => {
        const t = (g.at(repairBefore - 1) + g.at(repairBefore)) / 2;
        const p = horizontal ? g.point(t, (g.stripe + g.drop) / 2 + 4) : g.point(t, g.drop);
        const shown = repairBefore < revealed;
        return (
          <motion.g
            className="lanes__repair" aria-hidden="true"
            initial={false}
            animate={{ opacity: shown ? 1 : 0, scale: shown ? 1 : 0.9 }}
            transition={transition}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          >
            <rect x={p.x - 52} y={p.y - 15} width={104} height={30} rx={15} />
            <path d={`M ${p.x - 36} ${p.y - 4} l -5 4 l 5 4 M ${p.x - 26} ${p.y - 4} l 5 4 l -5 4`} className="lanes__repair-glyph" />
            <text x={p.x + 8} y={p.y + 5} textAnchor="middle">{repairLabel}</text>
          </motion.g>
        );
      })()}

      {nodes.map(({ column, s, a, shown }) => {
        const tone = shown ? column.agreement : 'pending';
        const gap = 10;
        const v = horizontal;
        const from = v ? { x: s.x, y: s.y + gap } : { x: s.x + gap, y: s.y };
        const to = v ? { x: a.x, y: a.y - gap } : { x: a.x - gap, y: a.y };
        const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const stripeText = v ? { x: s.x, y: s.y - 18, anchor: 'middle' as const } : { x: s.x, y: s.y + 30, anchor: 'middle' as const };
        const accessText = v ? { x: a.x, y: a.y + 32, anchor: 'middle' as const } : { x: a.x, y: a.y + 30, anchor: 'middle' as const };
        return (
          <g key={column.key} className={`lanes__col is-${tone}${shown ? '' : ' is-ghost'}`} aria-hidden="true">
            {/* Link between the two lanes: solid when they agree, broken when they don't. */}
            {tone === 'mismatch' ? (
              <>
                <motion.line className="lanes__link" initial={false} animate={{ x1: from.x, y1: from.y, x2: v ? middle.x : middle.x - 12, y2: v ? middle.y - 12 : middle.y }} transition={transition} />
                <motion.line className="lanes__link" initial={false} animate={{ x1: v ? middle.x : middle.x + 12, y1: v ? middle.y + 12 : middle.y, x2: to.x, y2: to.y }} transition={transition} />
                <motion.g initial={false} animate={{ x: middle.x, y: middle.y }} transition={transition}>
                  <path d="M 0 -11 L 11 0 L 0 11 L -11 0 Z" className="lanes__alert" />
                  <path d="M 0 -5 V 2 M 0 5.2 V 5.6" className="lanes__alert-glyph" />
                </motion.g>
              </>
            ) : (
              <motion.line className="lanes__link" initial={false} animate={{ x1: from.x, y1: from.y, x2: to.x, y2: to.y }} transition={transition} />
            )}

            <circle cx={s.x} cy={s.y} r={7} className="lanes__node lanes__node--stripe" />
            <motion.circle initial={false} animate={{ cx: a.x, cy: a.y }} transition={transition} r={7} className="lanes__node lanes__node--access" />
            {tone === 'agree' && (
              <motion.path initial={false} animate={{ x: a.x, y: a.y }} transition={transition} d="M -3.2 0.2 L -0.8 2.6 L 3.4 -2.2" className="lanes__tick" />
            )}

            <text x={stripeText.x} y={stripeText.y} textAnchor={stripeText.anchor} className="lanes__value">
              {shown ? stripeLabel(column.stripeStatus) : '—'}
            </text>
            <motion.text initial={false} animate={{ x: accessText.x, y: accessText.y }} transition={transition} textAnchor={accessText.anchor} className="lanes__value lanes__value--access">
              {shown ? accessLabel(column.observed) : '—'}
            </motion.text>
            {shown && column.agreement === 'mismatch' && (
              <motion.text initial={false} animate={{ x: accessText.x, y: accessText.y + 18 }} transition={transition} textAnchor={accessText.anchor} className="lanes__note">
                {column.expected ? 'Should have opened' : 'Should have stayed closed'}
              </motion.text>
            )}
            {shown && column.clock && (
              <text x={v ? s.x : 6} y={v ? g.height - 10 : s.y - 20} textAnchor={v ? 'middle' : 'start'} className="lanes__clock">
                Simulated {column.clock}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
