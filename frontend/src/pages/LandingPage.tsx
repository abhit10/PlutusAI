import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import {
  CandleChart,
  CryptoChart,
  PortfolioPreview,
  ExplanationPreview,
} from "../components/landing/MarketCharts";
import { useLandingMotion } from "../components/landing/useLandingMotion";
import { useLandingInteractions } from "../components/landing/useLandingInteractions";
import MarketCursor from "../components/landing/MarketCursor";
import "../components/landing/landing.css";

function Scene({
  id,
  number,
  title,
  description,
  children,
  className = "",
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`motion-scene ${className}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="scene-sticky">
        <div className="scene-heading">
          <p className="cinema-kicker">{number} / THE NEXT PERSPECTIVE</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="scene-visual">{children}</div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useLandingMotion(root, paused);
  useLandingInteractions(root, paused);
  useEffect(() => {
    document.title = "PlutusAI · Market intelligence, reimagined";
  }, []);
  return (
    <div
      ref={root}
      className={`cinema-landing ${paused ? "motion-paused" : ""}`}
    >
      <MarketCursor root={root} paused={paused} />
      <a className="cinema-skip" href="#cinema-main">
        Skip to content
      </a>
      <header className="cinema-header">
        <Link to="/" className="cinema-brand" aria-label="PlutusAI home">
          <span aria-hidden="true">P</span>Plutus<span>AI</span>
        </Link>
        <nav aria-label="Explore PlutusAI">
          <a href="#markets">Markets</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="cinema-account">
          <ThemeToggle />
          <Link to="/auth">Sign in</Link>
        </div>
      </header>
      <main id="cinema-main">
        <section className="cinema-hero" aria-labelledby="cinema-title">
          <div className="perspective-grid" aria-hidden="true" />
          <div className="hero-stars" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${5 + ((i * 37) % 90)}%`,
                  top: `${12 + ((i * 23) % 75)}%`,
                  width: i % 3 === 0 ? 14 : 4,
                  height: i % 3 === 0 ? 14 : 4,
                }}
              />
            ))}
          </div>
          <div className="hero-copy">
            <p className="cinema-kicker">A CLEARER VIEW OF YOUR MARKETS</p>
            <h1 id="cinema-title">
              Market intelligence,
              <br />
              <span>reimagined.</span>
            </h1>
            <p>
              Understand the stocks or crypto you own.
              <br />A new perspective on forecasts, risk and what to review
              next.
            </p>
            <Link className="cinema-cta" to="/auth?mode=signup">
              Analyze <span aria-hidden="true">↗</span>
            </Link>
            <small>Portfolios available now. AI analysis coming soon.</small>
          </div>
          <div className="hero-preview">
            <div className="hero-terminal">
              <CandleChart compact />
            </div>
            <div className="hero-mini">
              <span className="orb-symbol">◇</span>
              <div>
                Two markets.<strong>One clear perspective.</strong>
                <small>Separate stock or crypto portfolios</small>
              </div>
            </div>
          </div>
          <div className="hero-bottom">
            <a href="#markets">
              Scroll to explore <span aria-hidden="true">↓</span>
            </a>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              aria-pressed={paused}
            >
              {paused ? "Enable animations" : "Pause animations"}
            </button>
          </div>
        </section>
        <div className="cinema-scenes">
          <div className="scene-decoration deco-one" aria-hidden="true" />
          <div className="scene-decoration deco-two" aria-hidden="true" />
          <Scene
            id="markets"
            number="01"
            title="See the market. Not just the price."
            description="Explore the shape of market history. Stock forecasts will add a next-session estimate, expected change and uncertainty — never a guaranteed price."
          >
            <CandleChart />
          </Scene>
          <Scene
            id="crypto"
            number="02"
            title="A different market. Its own perspective."
            description="A dedicated universe for cryptocurrencies, priced in INR. Crypto holdings stay in crypto portfolios, with their own analysis to come."
            className="crypto-scene"
          >
            <CryptoChart />
          </Scene>
          <Scene
            id="portfolio"
            number="03"
            title="Your portfolio, brought into focus."
            description="Enter your holdings today. Future allocation suggestions will consider your risk preference and time horizon, one market at a time."
            className="portfolio-scene"
          >
            <PortfolioPreview />
          </Scene>
          <Scene
            id="explanations"
            number="04"
            title="Intelligence you can understand."
            description="A grounded chatbot will explain the analysis in plain language. No independent market lookups. No invented advice."
            className="explanation-scene"
          >
            <ExplanationPreview />
          </Scene>
        </div>
        <section id="how-it-works" className="cinema-how">
          <p className="cinema-kicker">FROM HOLDINGS TO UNDERSTANDING</p>
          <h2>Start with what you own.</h2>
          <ol>
            <li>
              <span>01</span>
              <h3>Create an account</h3>
              <p>Your own workspace, on the web.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Choose your market</h3>
              <p>
                Stocks or crypto. Enter supported holdings by hand, in separate
                portfolios.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Review with context</h3>
              <p>
                Forecasts, market risk and explained suggestions are coming
                soon.
              </p>
            </li>
          </ol>
        </section>
        <section className="cinema-closing">
          <div className="perspective-grid" aria-hidden="true" />
          <p className="cinema-kicker">YOUR DECISIONS. MORE PERSPECTIVE.</p>
          <h2>
            Make room for
            <br />
            <span>clearer thinking.</span>
          </h2>
          <p>
            Educational analysis for the holdings you enter.
            <br />
            No real-money execution. No guaranteed returns.
          </p>
          <div className="closing-facts">
            <span>Stock portfolios</span>
            <span>Crypto portfolios</span>
            <span>Always your decision</span>
          </div>
        </section>
      </main>
      <footer className="cinema-footer">
        <div>
          <Link to="/" className="cinema-brand">
            Plutus<span>AI</span>
          </Link>
          <p>
            Understand what you own.
            <br />
            Consider what’s next.
          </p>
        </div>
        <div>
          <strong>Explore</strong>
          <a href="#markets">Stock analysis</a>
          <a href="#crypto">Crypto analysis</a>
          <a href="#explanations">Explained insights</a>
        </div>
        <div>
          <strong>The product</strong>
          <a href="#how-it-works">How it works</a>
          <Link to="/auth">Sign in</Link>
          <span>Web only · INR</span>
        </div>
        <p className="cinema-legal">
          Illustrations use synthetic sample data, not live prices or working
          model outputs. PlutusAI provides educational analysis, not investment
          advice. Not a broker or a replacement for a SEBI-registered investment
          adviser.
        </p>
      </footer>
    </div>
  );
}
