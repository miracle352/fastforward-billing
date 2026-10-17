/** Plain-language scope: the policy, simulated time, who does what, and the limits. */
export function Explainer() {
  return (
    <section id="scope" className="section explainer" aria-labelledby="scope-title">
      <div className="section__intro">
        <h2 id="scope-title" className="section__title">What this test assumes</h2>
        <p className="section__lede">A straight answer needs a clear rule. These are the rules this build tests against.</p>
      </div>

      <div className="explainer__policy">
        <p className="explainer__rule">
          Customers whose subscription is <strong>active</strong> or <strong>trialing</strong> may open their report.
          Everyone else may not. <strong>No grace period.</strong>
        </p>
        <p className="explainer__aside">
          This is the sample app’s declared policy, not a rule every business should follow. Many real companies give a few days’
          grace after a failed payment. Results are judged against this policy only.
        </p>
      </div>

      <dl className="explainer__list">
        <div>
          <dt>Sample app</dt>
          <dd>A small Python app that sells access to private reports. It is supplied with Fastforward. Your own code and accounts are not connected.</dd>
        </div>
        <div>
          <dt>Stripe test mode</dt>
          <dd>Every customer, card and invoice is a Stripe test object. No real money moves and no real customer is touched.</dd>
        </div>
        <div>
          <dt>Simulated time</dt>
          <dd>Stripe test clocks move each test subscription forward past its renewal date. The calendar dates shown are simulated; the test itself takes minutes of real time.</dd>
        </div>
        <div>
          <dt>Who does what</dt>
          <dd>A language model writes the repair. CreateOS runs it in an isolated sandbox. Fastforward’s own fixed checker decides pass or fail. The model never grades its own work.</dd>
        </div>
        <div>
          <dt>Limits</dt>
          <dd>Two scenarios, a small number of repair attempts, one test at a time and a daily allowance. Blocking every customer never counts as a fix: a healthy paying customer must keep access.</dd>
        </div>
      </dl>
    </section>
  );
}
