import { useEffect } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const pillars = [
  {
    title: "Trend AI / price prediction",
    description: "A next-session price estimate in INR, with expected change and uncertainty. Built from market history, independently of your holdings or chat, with a stated horizon such as the next NSE session close for Indian stocks.",
    limit: "An estimate, never a guaranteed price or a signal telling you when to sell.",
  },
  {
    title: "Market risk calculator",
    description: "A 0–100 score for each supported asset, based on market measures such as volatility and drawdowns. Independent of your holdings and chat: the same asset gets the same score for every user.",
    limit: "A measure of market risk, not a percentage chance of loss or a news sentiment score.",
  },
  {
    title: "Portfolio recommendations",
    description: "Within one stock or crypto portfolio, your holdings, risk preference and time horizon meet the forecast and risk estimates to suggest an allocation to consider, within defined constraints.",
    limit: "Educational suggestions for review. No automatic rebalancing or orders.",
  },
  {
    title: "Grounded chatbot",
    description: "Ask what a forecast, risk score or suggested allocation means. Plain-language explanations grounded in those three engines’ outputs.",
    limit: "It explains the analysis; it does not browse the web, fetch markets or invent new advice.",
  },
];

export default function LandingPage() {
  useEffect(() => {
    document.title = "PlutusAI · AI investment analyst";
  }, []);

  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main">Skip to content</a>
      <header className="landing-header">
        <Link className="brand" to="/" aria-label="PlutusAI home">Plutus<span>AI</span><i /></Link>
        <nav aria-label="Account and appearance" className="landing-actions">
          <ThemeToggle />
          <Link to="/auth" className="landing-signin">Sign in</Link>
        </nav>
      </header>
      <main id="landing-main">
        <section className="landing-hero landing-wrap" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="eyebrow">YOUR AI INVESTMENT ANALYST</p>
            <h1 id="landing-title">Understand what you own.<br /><span>Consider what’s next.</span></h1>
            <p className="landing-lead">Analyze the stocks or crypto you enter in separate portfolios, with forecasts, risk and suggestions explained in plain language.</p>
            <div className="landing-actions">
              <Link to="/auth?mode=signup" className="portfolio-button primary">Analyze <span aria-hidden="true">↗</span></Link>
            </div>
            <p className="landing-availability">Portfolios are available now. Analysis and predictions in the product are coming soon.</p>
          </div>
          <aside className="landing-perspective" aria-label="The question behind PlutusAI">
            <div className="landing-asset-labels"><span>Selected stocks</span><span>Cryptocurrencies</span></div>
            <p className="landing-question">“Given what I own and my preferences, what should I consider reviewing — and why?”</p>
            <div className="landing-perspective-note"><span className="tabular">INR</span><p>A clearer view of the holdings you enter.<br />Not a view of your entire net worth.</p></div>
          </aside>
        </section>

        <section className="landing-section landing-wrap" aria-labelledby="how-title">
          <div className="landing-section-heading"><p className="eyebrow">HOW IT WORKS</p><h2 id="how-title">Your holdings. A clearer perspective.</h2></div>
          <ol className="landing-steps">
            <li><span className="tabular">01</span><h3>Create an account</h3><p>Start your portfolio on the web.</p></li>
            <li><span className="tabular">02</span><h3>Enter supported holdings</h3><p>Choose Stocks or Crypto, then enter supported holdings by hand in a portfolio for that market. No broker sync, bank connection or KYC.</p></li>
            <li><span className="tabular">03</span><h3>Review the analysis <small>Coming soon</small></h3><p>Explore forecasts, risk and suggestions, then ask the chatbot to explain them.</p></li>
          </ol>
        </section>

        <section className="landing-section landing-wrap" aria-labelledby="pillars-title">
          <div className="landing-section-heading"><p className="eyebrow">FOUR WAYS TO UNDERSTAND</p><h2 id="pillars-title">From market history to an informed review.</h2><p>These analysis tools are being built. No live forecasts or scores are shown here.</p></div>
          <div className="landing-pillars">
            {pillars.map((pillar, index) => <article key={pillar.title} className="landing-pillar"><div className="landing-pillar-top"><span className="tabular">0{index + 1}</span><span>Coming soon</span></div><h3>{pillar.title}</h3><p>{pillar.description}</p><p className="landing-limit">{pillar.limit}</p></article>)}
          </div>
        </section>

        <section className="landing-section landing-wrap landing-boundaries" aria-labelledby="boundaries-title">
          <div><p className="eyebrow">WHAT WE NEVER DO</p><h2 id="boundaries-title">Analysis informs.<br />You decide.</h2></div>
          <ul><li><strong>No real-money execution.</strong> Suggestions never place trades, move money or turn into orders.</li><li><strong>No guaranteed returns.</strong> Estimates cannot promise profits, the best time to sell or unique market insight.</li><li><strong>No data-selling sales pitch.</strong> The purpose is to help you understand your holdings.</li></ul>
        </section>

        <section className="landing-closing landing-wrap" aria-labelledby="for-title">
          <p className="eyebrow">WHO IT’S FOR</p><h2 id="for-title">For people who want to understand their stocks or crypto portfolios.</h2><p>Start with the holdings you type in. PlutusAI is an educational analysis tool, not a replacement for a SEBI-registered investment adviser or a broker.</p>
        </section>
      </main>
      <footer className="landing-footer landing-wrap">PlutusAI · Educational analysis · Not investment advice · Not a broker</footer>
    </div>
  );
}
