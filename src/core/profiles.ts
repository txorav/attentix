import { DomainProfile, DomainProfileId } from './types';

export const DOMAIN_PROFILES: Record<DomainProfileId, DomainProfile> = {
  ui_ux_web: {
    id: 'ui_ux_web',
    name: 'UI / UX & Web Design',
    tagline: 'F-Pattern & Navigational Affordances',
    description:
      'Calibrated for landing pages, web applications, and mobile interfaces. Prioritizes primary CTAs, text hierarchy, and navigation bars with top-left reading bias.',
    centerBiasPrior: 0.20,
    topLeftFBias: 0.75,
    wText: 0.45,
    wFace: 0.25,
    wUI: 0.85,
    wVis: 0.50,
    specialFeature: 'Detects navbars, input fields, primary buttons, and hero CTAs.',
  },
  performance_ads: {
    id: 'performance_ads',
    name: 'Performance Ads & Posters',
    tagline: 'Brand Recall & Gaze Cueing',
    description:
      'Optimized for social feed banners, print ads, and display marketing. Emphasizes headline-to-CTA gaze bridge and brand logo fixations.',
    centerBiasPrior: 0.50,
    topLeftFBias: 0.35,
    wText: 0.75,
    wFace: 0.90,
    wUI: 0.65,
    wVis: 0.60,
    specialFeature: 'Evaluates Brand Logo recall & Headline-to-CTA gaze bridge.',
  },
  book_covers: {
    id: 'book_covers',
    name: 'Book Covers & Thumbnails',
    tagline: '160px Legibility & Focal Pop-out',
    description:
      'Engineered for book covers, YouTube thumbnails, and app store icons. Employs multi-scale spatial frequency filtering to test high-contrast thumbnail pop-out.',
    centerBiasPrior: 0.65,
    topLeftFBias: 0.15,
    wText: 0.85,
    wFace: 0.85,
    wUI: 0.10,
    wVis: 0.70,
    specialFeature: 'Amazon/YouTube 160px Thumbnail Simulator to test small-scale legibility.',
  },
  fine_art: {
    id: 'fine_art',
    name: 'Fine Art & Illustration',
    tagline: 'Rule of Thirds & Golden Ratio Harmony',
    description:
      'Fine-tuned for visual art, photography, and conceptual illustrations. Analyzes composition balance, rule-of-thirds focal points, and chiaroscuro luminance.',
    centerBiasPrior: 0.75,
    topLeftFBias: 0.00,
    wText: 0.10,
    wFace: 0.75,
    wUI: 0.00,
    wVis: 0.85,
    specialFeature: 'Evaluates Golden Ratio, Rule-of-Thirds alignment, and luminance focal balance.',
  },
  retail_packaging: {
    id: 'retail_packaging',
    name: 'Retail Packaging & CPG',
    tagline: 'Shelf-Clutter Pop-Out & Claim Legibility',
    description:
      'Simulates supermarket shelf competition. Measures how fast product claims, logos, and silhouette contrast break through dense background noise.',
    centerBiasPrior: 0.55,
    topLeftFBias: 0.20,
    wText: 0.70,
    wFace: 0.60,
    wUI: 0.50,
    wVis: 0.75,
    specialFeature: 'Simulates shelf-clutter surround context to measure pop-out effect.',
  },
};
