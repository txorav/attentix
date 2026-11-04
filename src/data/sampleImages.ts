import { SampleImage } from '../core/types';

// High-fidelity SVG vectors encoded as data URIs for instantaneous zero-latency offline loading
function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

const UI_LANDING_PAGE_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="750" fill="url(#bg)"/>

  <!-- Top Nav Bar -->
  <rect x="0" y="0" width="1200" height="70" fill="#0f172a" opacity="0.8"/>
  <line x1="0" y1="70" x2="1200" y2="70" stroke="#334155" stroke-width="1"/>
  
  <!-- Logo -->
  <circle cx="90" cy="35" r="14" fill="#38bdf8"/>
  <text x="115" y="42" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="800" font-size="20">CLOUDMETRIC</text>
  
  <!-- Nav Links -->
  <text x="450" y="42" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14" font-weight="500">Platform</text>
  <text x="540" y="42" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14" font-weight="500">Solutions</text>
  <text x="640" y="42" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14" font-weight="500">Enterprise</text>
  <text x="750" y="42" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14" font-weight="500">Pricing</text>

  <!-- Nav Sign In -->
  <rect x="1040" y="18" width="110" height="34" rx="6" fill="#334155"/>
  <text x="1072" y="40" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="13" font-weight="600">Sign In</text>

  <!-- Hero Left Column -->
  <!-- Badge -->
  <rect x="80" y="130" width="230" height="28" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
  <text x="96" y="149" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="12" font-weight="600">⚡ AI INFRASTRUCTURE 2.0</text>

  <!-- Large Headline -->
  <text x="80" y="220" fill="#ffffff" font-family="system-ui, sans-serif" font-size="52" font-weight="800">
    Scale Intelligent
  </text>
  <text x="80" y="280" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="52" font-weight="800">
    Pipelines in Minutes.
  </text>

  <!-- Subheadline -->
  <text x="80" y="340" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="400">
    Deploy multi-modal models, optimize inference latencies,
  </text>
  <text x="80" y="370" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="400">
    and monitor telemetry at petabyte enterprise scale.
  </text>

  <!-- Primary CTA Button -->
  <rect x="80" y="420" width="220" height="54" rx="8" fill="url(#btnGrad)"/>
  <text x="115" y="454" fill="#ffffff" font-family="system-ui, sans-serif" font-size="16" font-weight="700">
    Start Free 14-Day Trial →
  </text>

  <!-- Secondary CTA Button -->
  <rect x="320" y="420" width="160" height="54" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1"/>
  <text x="355" y="454" fill="#e2e8f0" font-family="system-ui, sans-serif" font-size="15" font-weight="600">
    Book Demo
  </text>

  <!-- Trust badges -->
  <text x="80" y="530" fill="#64748b" font-family="system-ui, sans-serif" font-size="13" font-weight="600">TRUSTED BY ENGINEERING TEAMS AT</text>
  <text x="80" y="565" fill="#475569" font-family="system-ui, sans-serif" font-size="16" font-weight="700">ACME CORP  •  NEXUS LABS  •  STRATA  •  VERTEX</text>

  <!-- Hero Right Column: UI Dashboard Preview Window -->
  <rect x="580" y="140" width="540" height="420" rx="14" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5"/>
  
  <!-- Dashboard Top Bar -->
  <rect x="580" y="140" width="540" height="40" rx="14" fill="#0f172a"/>
  <circle cx="610" cy="160" r="5" fill="#ef4444"/>
  <circle cx="626" cy="160" r="5" fill="#f59e0b"/>
  <circle cx="642" cy="160" r="5" fill="#10b981"/>
  <text x="680" y="165" fill="#64748b" font-family="system-ui, sans-serif" font-size="12">analytics.cloudmetric.internal</text>

  <!-- Dashboard Metrics Row -->
  <rect x="610" y="205" width="150" height="85" rx="8" fill="#1e293b" stroke="#334155"/>
  <text x="625" y="230" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">Throughput</text>
  <text x="625" y="265" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="24" font-weight="800">4.2M req/s</text>

  <rect x="775" y="205" width="150" height="85" rx="8" fill="#1e293b" stroke="#334155"/>
  <text x="790" y="230" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">P99 Latency</text>
  <text x="790" y="265" fill="#10b981" font-family="system-ui, sans-serif" font-size="24" font-weight="800">12.4 ms</text>

  <rect x="940" y="205" width="150" height="85" rx="8" fill="#1e293b" stroke="#334155"/>
  <text x="955" y="230" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">Availability</text>
  <text x="955" y="265" fill="#f59e0b" font-family="system-ui, sans-serif" font-size="24" font-weight="800">99.995%</text>

  <!-- Telemetry Chart Simulation -->
  <rect x="610" y="310" width="480" height="220" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <path d="M 630 480 Q 720 450, 780 400 T 920 370 T 1070 340 L 1070 510 L 630 510 Z" fill="#38bdf8" opacity="0.15"/>
  <path d="M 630 480 Q 720 450, 780 400 T 920 370 T 1070 340" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <circle cx="1070" cy="340" r="6" fill="#38bdf8"/>
</svg>
`);

const PERFORMANCE_AD_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <radialGradient id="adGlow" cx="70%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="60%" stop-color="#881337" />
      <stop offset="100%" stop-color="#4c0519" />
    </radialGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="100%" stop-color="#eab308" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#adGlow)"/>

  <!-- Logo top left -->
  <rect x="80" y="80" width="60" height="60" rx="14" fill="#ffffff"/>
  <path d="M 95 125 L 110 95 L 125 125 Z" fill="#e11d48"/>
  <text x="160" y="122" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="34">LUMINA</text>

  <!-- Big Offer Badge -->
  <rect x="80" y="210" width="360" height="50" rx="25" fill="#ffffff" opacity="0.95"/>
  <text x="110" y="244" fill="#be123c" font-family="system-ui, sans-serif" font-weight="800" font-size="20">LIMITED TIME: 50% OFF TODAY</text>

  <!-- Main Headline -->
  <text x="80" y="340" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="72">
    Next-Gen
  </text>
  <text x="80" y="420" fill="url(#goldGrad)" font-family="system-ui, sans-serif" font-weight="900" font-size="72">
    Sound Isolation.
  </text>
  <text x="80" y="500" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="72">
    Pure Silence.
  </text>

  <!-- Bullet points -->
  <text x="80" y="580" fill="#fecdd3" font-family="system-ui, sans-serif" font-size="24" font-weight="600">✓ 48-Hour Active Noise Cancellation</text>
  <text x="80" y="630" fill="#fecdd3" font-family="system-ui, sans-serif" font-size="24" font-weight="600">✓ Spatial Audio with Dynamic Head Tracking</text>
  <text x="80" y="680" fill="#fecdd3" font-family="system-ui, sans-serif" font-size="24" font-weight="600">✓ Zero-Pressure Ergonomic Memory Foam</text>

  <!-- Big High-Converting CTA Button -->
  <rect x="80" y="760" width="440" height="96" rx="20" fill="url(#goldGrad)" filter="drop-shadow(0 15px 25px rgba(0,0,0,0.4))"/>
  <text x="140" y="822" fill="#854d0e" font-family="system-ui, sans-serif" font-size="30" font-weight="900">
    CLAIM OFFER NOW →
  </text>

  <text x="80" y="890" fill="#fda4af" font-family="system-ui, sans-serif" font-size="18">★★★★★ Over 12,000 Verified 5-Star Reviews</text>

  <!-- Model / Subject Illustration looking toward the CTA (Gaze Bridge) -->
  <g transform="translate(620, 220)">
    <!-- Face Silhouette -->
    <ellipse cx="220" cy="240" rx="140" ry="170" fill="#fecdd3"/>
    <!-- Headphone Band -->
    <path d="M 90 220 A 130 140 0 0 1 350 220" fill="none" stroke="#0f172a" stroke-width="28"/>
    <!-- Earcups -->
    <rect x="70" y="210" width="45" height="110" rx="20" fill="#e2e8f0" stroke="#0f172a" stroke-width="6"/>
    <rect x="325" y="210" width="45" height="110" rx="20" fill="#e2e8f0" stroke="#0f172a" stroke-width="6"/>
    <!-- Eyes looking down-left toward the Headline and CTA -->
    <ellipse cx="170" cy="225" rx="14" ry="10" fill="#ffffff"/>
    <ellipse cx="163" cy="227" rx="7" ry="7" fill="#0f172a"/>
    <ellipse cx="250" cy="225" rx="14" ry="10" fill="#ffffff"/>
    <ellipse cx="243" cy="227" rx="7" ry="7" fill="#0f172a"/>
    <!-- Friendly Gaze vector indicator -->
    <path d="M 190 270 Q 220 300 240 270" fill="none" stroke="#9f1239" stroke-width="5"/>
  </g>
</svg>
`);

const BOOK_COVER_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="800" height="1200">
  <defs>
    <linearGradient id="coverBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#09090b" />
      <stop offset="50%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <radialGradient id="portal" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="40%" stop-color="#d97706" />
      <stop offset="70%" stop-color="#78350f" />
      <stop offset="100%" stop-color="#09090b" />
    </radialGradient>
  </defs>

  <rect width="800" height="1200" fill="url(#coverBg)"/>

  <!-- Top accolade -->
  <text x="400" y="80" text-anchor="middle" fill="#a1a1aa" font-family="Georgia, serif" font-size="18" letter-spacing="4">
    #1 NEW YORK TIMES BESTSELLER
  </text>

  <!-- Massive Headline Typography -->
  <text x="400" y="210" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="88" letter-spacing="2">
    THE LAST
  </text>
  <text x="400" y="310" text-anchor="middle" fill="#f59e0b" font-family="system-ui, sans-serif" font-weight="900" font-size="94" letter-spacing="4">
    SYNAPSE
  </text>

  <text x="400" y="370" text-anchor="middle" fill="#71717a" font-family="system-ui, sans-serif" font-size="18" font-weight="600" letter-spacing="6">
    A COGNITIVE SCI-FI THRILLER
  </text>

  <!-- Central Focal Illustration (Luminescent Brain / Singularity Portal) -->
  <circle cx="400" cy="620" r="190" fill="url(#portal)"/>
  <circle cx="400" cy="620" r="140" fill="none" stroke="#fef3c7" stroke-width="3" stroke-dasharray="10 15"/>
  <circle cx="400" cy="620" r="70" fill="#ffffff" filter="drop-shadow(0 0 30px #f59e0b)"/>

  <!-- Author Name -->
  <text x="400" y="1030" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-weight="700" font-size="36" letter-spacing="6">
    DR. EVELYN VANCE
  </text>
  <text x="400" y="1070" text-anchor="middle" fill="#a1a1aa" font-family="system-ui, sans-serif" font-size="16" letter-spacing="3">
    FOREWORD BY NEIL DEGRASSE TYSON
  </text>
</svg>
`);

const FINE_ART_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <radialGradient id="moonlight" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fffbeb" />
      <stop offset="25%" stop-color="#fde68a" />
      <stop offset="55%" stop-color="#1e3a8a" />
      <stop offset="90%" stop-color="#020617" />
    </radialGradient>
  </defs>

  <rect width="1200" height="800" fill="url(#moonlight)"/>

  <!-- Golden Ratio Subject Placement -->
  <!-- Classical Chiaroscuro Figure / Luna -->
  <circle cx="420" cy="300" r="110" fill="#fffbeb" filter="drop-shadow(0 0 50px rgba(254, 240, 138, 0.6))"/>

  <!-- Mountain Silhouettes following rule of thirds -->
  <polygon points="0,800 280,480 520,800" fill="#0f172a" opacity="0.95"/>
  <polygon points="360,800 720,380 1100,800" fill="#1e293b" opacity="0.9"/>
  <polygon points="850,800 1050,510 1200,800" fill="#020617"/>

  <!-- Starry Sky elements -->
  <circle cx="180" cy="140" r="3" fill="#ffffff" opacity="0.8"/>
  <circle cx="280" cy="80" r="4" fill="#ffffff" opacity="0.9"/>
  <circle cx="780" cy="160" r="3" fill="#ffffff" opacity="0.7"/>
  <circle cx="920" cy="110" r="4" fill="#ffffff" opacity="0.85"/>
  <circle cx="1060" cy="220" r="3" fill="#ffffff" opacity="0.6"/>
</svg>
`);

const RETAIL_PACKAGING_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100" width="800" height="1100">
  <defs>
    <linearGradient id="packBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="50%" stop-color="#047857" />
      <stop offset="100%" stop-color="#022c22" />
    </linearGradient>
  </defs>

  <rect width="800" height="1100" rx="30" fill="url(#packBg)" stroke="#34d399" stroke-width="4"/>

  <!-- Brand Emblem -->
  <ellipse cx="400" cy="180" rx="180" ry="75" fill="#fef3c7" stroke="#b45309" stroke-width="4"/>
  <text x="400" y="175" text-anchor="middle" fill="#78350f" font-family="Georgia, serif" font-weight="900" font-size="38" letter-spacing="3">
    VERDANT
  </text>
  <text x="400" y="210" text-anchor="middle" fill="#92400e" font-family="system-ui, sans-serif" font-weight="700" font-size="14" letter-spacing="4">
    ORGANIC BOTANICALS
  </text>

  <!-- Product Name -->
  <text x="400" y="340" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="64">
    MATCHA
  </text>
  <text x="400" y="410" text-anchor="middle" fill="#a7f3d0" font-family="system-ui, sans-serif" font-weight="800" font-size="44" letter-spacing="6">
    CEREMONIAL GRADE
  </text>

  <!-- Key Claims -->
  <rect x="220" y="460" width="360" height="46" rx="23" fill="#022c22" stroke="#34d399" stroke-width="2"/>
  <text x="400" y="490" text-anchor="middle" fill="#34d399" font-family="system-ui, sans-serif" font-size="16" font-weight="700">
    100% SHADE-GROWN UJI HARVEST
  </text>

  <!-- Product Imagery Window -->
  <circle cx="400" cy="690" r="160" fill="#065f46" stroke="#fef3c7" stroke-width="6"/>
  <circle cx="400" cy="690" r="120" fill="#10b981"/>
  <path d="M 330 690 Q 400 630 470 690 Q 400 750 330 690 Z" fill="#064e3b"/>

  <!-- Net Weight & Badges -->
  <text x="400" y="940" text-anchor="middle" fill="#ecfdf5" font-family="system-ui, sans-serif" font-size="22" font-weight="700">
    NET WT. 100g (3.5 OZ)
  </text>
  <text x="400" y="990" text-anchor="middle" fill="#6ee7b7" font-family="system-ui, sans-serif" font-size="14" letter-spacing="3">
    USDA ORGANIC  •  NON-GMO  •  VEGAN
  </text>
</svg>
`);

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample_ui_web',
    title: 'SaaS Platform Landing Page',
    category: 'ui_ux_web',
    description: 'High-converting enterprise landing page with F-pattern top bar, hero headline, and prominent primary CTA.',
    url: UI_LANDING_PAGE_SVG,
    aspectRatio: '16/10',
  },
  {
    id: 'sample_perf_ad',
    title: 'High-Converting Instagram Ad',
    category: 'performance_ads',
    description: 'Direct-to-consumer headphone poster with human gaze vector directing attention to headline and offer button.',
    url: PERFORMANCE_AD_SVG,
    aspectRatio: '1/1',
  },
  {
    id: 'sample_book_cover',
    title: 'Bestseller Sci-Fi Book Cover',
    category: 'book_covers',
    description: 'High-impact typography and central artwork optimized for Amazon 160px thumbnail browse mode.',
    url: BOOK_COVER_SVG,
    aspectRatio: '2/3',
  },
  {
    id: 'sample_fine_art',
    title: 'Nocturne Lunar Landscape',
    category: 'fine_art',
    description: 'Fine art composition evaluating Golden Ratio focal placement, chiaroscuro contrast, and Rule of Thirds.',
    url: FINE_ART_SVG,
    aspectRatio: '3/2',
  },
  {
    id: 'sample_packaging',
    title: 'Organic Matcha Packaging',
    category: 'retail_packaging',
    description: 'CPG package measuring shelf pop-out, brand emblem recall, and organic benefit claim readability.',
    url: RETAIL_PACKAGING_SVG,
    aspectRatio: '8/11',
  },
];
