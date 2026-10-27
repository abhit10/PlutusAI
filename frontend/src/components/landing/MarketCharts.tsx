import { useId, useState, type CSSProperties } from "react";

// Deliberately synthetic OHLC observations; never connected to market APIs.
const closes = [
  2484, 2498, 2470, 2452, 2466, 2491, 2514, 2522, 2500, 2486, 2472, 2480, 2503,
  2520, 2512, 2504, 2488, 2478, 2501, 2526, 2542, 2531, 2522, 2517, 2508, 2528,
  2540, 2550,
];
const candles = closes.map((close, i) => {
  const open = i ? closes[i - 1] : 2472;
  return {
    open,
    close,
    high: Math.max(open, close) + 8 + (i % 7),
    low: Math.min(open, close) - 7 - (i % 5),
  };
});
const chartY = (price: number) => 224 - (price - 2430) * 1.55;

export function CandleChart({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const row = selected === null ? null : candles[selected];
  return (
    <div className={`demo-terminal ${compact ? "is-compact" : ""}`}>
      <div className="terminal-toolbar">
        <span>
          <b className="terminal-mark">P</b> PlutusAI{" "}
          <span className="terminal-divider">/</span> STOCKS
        </span>
        <span className="demo-tag">ILLUSTRATIVE DATA</span>
      </div>
      <div className="terminal-heading">
        <div>
          <strong>Indian equity · Demo</strong>
          <span>Daily candles · INR · Synthetic observations</span>
        </div>
        <div className="terminal-price">
          ₹2,550.00<small>Sample close</small>
        </div>
      </div>
      <div className="candle-plot">
        <svg
          viewBox="0 0 720 300"
          role="img"
          aria-label="Illustrative stock candlestick chart with synthetic daily prices, not a forecast"
        >
          {[36, 83, 130, 177, 224].map((y, i) => (
            <g key={y}>
              <line x1="15" x2="650" y1={y} y2={y} className="chart-grid" />
              <text x="662" y={y + 4} className="chart-label">
                {2550 - i * 30}
              </text>
            </g>
          ))}
          {[40, 140, 240, 340, 440, 540, 640].map((x) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1="18"
              y2="260"
              className="chart-grid"
            />
          ))}
          <path
            d="M22 201 C90 165 105 196 160 147 S230 141 285 151 S350 105 390 125 S465 101 500 77 S570 106 635 46"
            className="stock-average"
            fill="none"
          />
          {candles.map((c, i) => {
            const x = 24 + i * 22,
              rising = c.close >= c.open;
            return (
              <g
                key={i}
                className={`demo-candle ${rising ? "rising" : "falling"} ${selected === i ? "is-selected" : ""}`}
                style={{ "--candle-delay": `${i * 24}ms` } as CSSProperties}
              >
                <line x1={x} x2={x} y1={chartY(c.high)} y2={chartY(c.low)} />
                <rect
                  x={x - 5.5}
                  y={chartY(Math.max(c.open, c.close))}
                  width="11"
                  height={Math.max(2, Math.abs(c.close - c.open) * 1.55)}
                  rx="1"
                />
                <rect
                  className="volume-bar"
                  x={x - 6}
                  y={275 - (10 + ((i * 17) % 30))}
                  width="12"
                  height={10 + ((i * 17) % 30)}
                />
              </g>
            );
          })}
          <line x1="15" x2="650" y1="275" y2="275" className="chart-grid" />
          {["SESSION 01", "SESSION 10", "SESSION 20", "SESSION 28"].map(
            (v, i) => (
              <text key={v} x={20 + i * 190} y="296" className="chart-label">
                {v}
              </text>
            ),
          )}
          {!compact &&
            candles.map((_, i) => (
              <rect
                key={i}
                x={13 + i * 22}
                y="15"
                width="22"
                height="260"
                fill="transparent"
                onPointerEnter={() => setSelected(i)}
                onPointerLeave={() => setSelected(null)}
              />
            ))}
          {selected !== null && (
            <line
              x1={24 + selected * 22}
              x2={24 + selected * 22}
              y1="15"
              y2="275"
              className="chart-crosshair"
            />
          )}
        </svg>
      </div>
      {!compact && (
        <div className="chart-inspector">
          <label>
            Inspect sample session{" "}
            <input
              type="range"
              min="1"
              max="28"
              value={(selected ?? 27) + 1}
              onChange={(e) => setSelected(Number(e.target.value) - 1)}
            />
          </label>
          <output aria-live="polite">
            {row
              ? `Session ${selected! + 1} · Open ₹${row.open} · Close ₹${row.close}`
              : "Hover the chart or use the session slider"}
          </output>
        </div>
      )}
      <div className="terminal-foot">
        <span>
          <i /> Market history illustration
        </span>
        <span>No live prices · No buy/sell signals</span>
      </div>
    </div>
  );
}

export function CryptoChart() {
  const id = useId().replace(/:/g, "");
  const line =
    "M20 225 C48 215 56 160 92 175 S143 223 172 166 S215 100 248 130 S292 189 322 134 S369 53 404 78 S459 141 490 85 S548 30 580 53 S618 69 654 24";
  return (
    <div className="demo-terminal crypto-terminal">
      <div className="terminal-toolbar">
        <span>
          <b className="terminal-mark">P</b> PlutusAI{" "}
          <span className="terminal-divider">/</span> CRYPTO
        </span>
        <span className="demo-tag">ILLUSTRATIVE DATA</span>
      </div>
      <div className="terminal-heading">
        <div>
          <strong>Crypto market · Demo</strong>
          <span>INR price movement · Synthetic observations</span>
        </div>
        <div className="crypto-emblem" aria-hidden="true">
          ◇
        </div>
      </div>
      <svg
        viewBox="0 0 720 300"
        role="group"
        aria-label="Glowing illustrative crypto price line; synthetic data, not a live forecast"
      >
        <defs>
          <linearGradient id={`${id}-line`}>
            <stop stopColor="var(--line-start)" />
            <stop offset="1" stopColor="var(--line-end)" />
          </linearGradient>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--cinema-accent)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--cinema-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 90, 145, 200, 255].map((y) => (
          <line key={y} x1="18" x2="660" y1={y} y2={y} className="chart-grid" />
        ))}
        {[60, 160, 260, 360, 460, 560, 660].map((x) => (
          <line key={x} x1={x} x2={x} y1="15" y2="255" className="chart-grid" />
        ))}
        <path
          d={`${line} L654 255 L20 255 Z`}
          fill={`url(#${id}-fill)`}
          className="crypto-area"
        />
        <path
          d={line}
          fill="none"
          stroke={`url(#${id}-line)`}
          strokeWidth="10"
          opacity=".13"
          className="crypto-glow"
        />
        <path
          d={line}
          fill="none"
          stroke={`url(#${id}-line)`}
          strokeWidth="2.5"
          pathLength="1"
          className="crypto-trace"
        />
        {[
          [92, 175],
          [248, 130],
          [404, 78],
          [580, 53],
        ].map(([x, y], index) => (
          <g className="crypto-node" key={x} role="img" tabIndex={0} aria-label={`Synthetic crypto sample point ${index + 1} of 4; not live data`}>
            <circle cx={x} cy={y} r="10" fill="var(--cinema-accent)" opacity=".09" />
            <circle cx={x} cy={y} r="3" fill="var(--line-start)" />
            <g className="crypto-tooltip" aria-hidden="true">
              <rect x={x - 65} y={y + 20} width="130" height="26" rx="5" />
              <text x={x} y={y + 37} textAnchor="middle">Synthetic sample</text>
            </g>
          </g>
        ))}
        {["OBSERVATION 01", "08", "16", "24", "30"].map((v, i) => (
          <text key={v} x={20 + i * 153} y="286" className="chart-label">
            {v}
          </text>
        ))}
      </svg>
      <div className="terminal-foot">
        <span>One crypto portfolio. Its own analysis.</span>
        <span>Forecasts coming soon</span>
      </div>
    </div>
  );
}

export function PortfolioPreview() {
  return (
    <div className="portfolio-stage">
      <div className="demo-terminal portfolio-demo">
        <div className="terminal-toolbar">
          <span>
            <b className="terminal-mark">P</b> Portfolio intelligence
          </span>
          <span className="demo-tag">CONCEPT PREVIEW</span>
        </div>
        <div className="preview-grid">
          <div className="preview-tile">
            <small>STOCK PORTFOLIO · EXAMPLE</small>
            <h3>Your holdings, in context.</h3>
            <div className="allocation-ring">
              <span>
                3<small>positions</small>
              </span>
            </div>
            <div className="ring-legend">■ RELIANCE　■ TCS　■ INFY</div>
          </div>
          <div className="preview-tile">
            <small>ENTERED HOLDINGS</small>
            {[
              ["RELIANCE", "12 shares", 78],
              ["TCS", "8 shares", 54],
              ["INFY", "20 shares", 91],
            ].map(([s, q, w]) => (
              <div className="preview-position" key={s}>
                <span>
                  {s}
                  <em>{q}</em>
                </span>
                <div>
                  <i style={{ width: `${w}%` }} />
                </div>
              </div>
            ))}
            <p>Illustrative quantities, not allocation advice.</p>
          </div>
          <div className="preview-tile">
            <small>YOUR PREFERENCES</small>
            <h3>Built around your horizon.</h3>
            <div className="preview-bars">
              {[35, 56, 43, 72, 61, 90, 76, 100].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="preview-tile">
            <small>ANALYSIS ROADMAP</small>
            <div className="roadmap-row">
              Market risk <span>Coming soon</span>
            </div>
            <div className="roadmap-row">
              Allocation review <span>Coming soon</span>
            </div>
            <p>Suggestions for one market at a time. You stay in control.</p>
          </div>
        </div>
      </div>
      <aside className="floating-panel float-left">
        <span className="orb-symbol">₹</span>
        <small>ENTERED COST · EXAMPLE</small>
        <strong>₹32,400</strong>
        <span>12 shares × ₹2,700</span>
      </aside>
      <aside className="floating-panel float-right">
        <small>SEPARATE MARKETS</small>
        <strong>
          Stocks <span>/</span> Crypto
        </strong>
        <span>Never combined in one book.</span>
        <svg viewBox="0 0 160 45" aria-hidden="true">
          <path
            d="M2 40 L20 29 34 34 51 17 67 23 83 9 98 20 119 7 138 14 158 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </aside>
      <div className="floating-panel float-bottom">
        <span>✓</span> Your holdings. Your decisions.
      </div>
    </div>
  );
}

export function ExplanationPreview() {
  return (
    <div className="explanation-stage">
      <div className="demo-terminal explanation-demo">
        <div className="terminal-toolbar">
          <span>
            <b className="terminal-mark">P</b> Understand the analysis
          </span>
          <span className="demo-tag">SCRIPTED EXAMPLE</span>
        </div>
        <div className="demo-conversation">
          <p className="chat-bubble question">
            What would a risk score tell me?
          </p>
          <div className="chat-bubble answer">
            <b>PlutusAI</b>
            <p>
              It would summarize market measures such as volatility and
              drawdowns for an asset.
            </p>
            <p>
              It is not the probability of losing money. The same asset would
              receive the same score for every user.
            </p>
            <span>Grounded in the market-risk engine · Coming soon</span>
          </div>
          <p className="chat-bubble question">Would you make a trade for me?</p>
          <div className="chat-bubble answer">
            <p>
              No. Suggestions are for you to review. PlutusAI never places
              orders.
            </p>
          </div>
          <div className="demo-message">
            Explanation tools are in development <span>↗</span>
          </div>
        </div>
      </div>
      <aside className="floating-panel explanation-note">
        <small>LANGUAGE, NOT ANOTHER TRADING ENGINE</small>
        <strong>
          A little less noise.
          <br />A lot more clarity.
        </strong>
        <p>
          Explains forecasts, risk and portfolio suggestions. No independent web
          browsing or invented advice.
        </p>
      </aside>
    </div>
  );
}
