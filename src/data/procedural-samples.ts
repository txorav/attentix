import { AOIRegion, DomainPreset } from '../types/studio';

export interface ProceduralSample {
  id: string;
  name: string;
  category: string;
  domainPreset: DomainPreset;
  width: number;
  height: number;
  generateDataUrl: () => string;
  initialAOIs: Array<Omit<AOIRegion, 'shareOfAttention' | 'noticeability' | 'ttffMs'>>;
}

/**
 * 1. SaaS Landing Page UI (1440 x 900)
 */
function generateSaaSLandingPage(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 1440, 900);
  grad.addColorStop(0, '#0B0F19');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1440, 900);

  // Navigation Bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(0, 0, 1440, 72);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 1440, 72);

  // Logo
  ctx.fillStyle = '#00E599';
  ctx.beginPath();
  ctx.arc(80, 36, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('NEXUS AI', 104, 43);

  // Nav Links
  ctx.fillStyle = '#94A3B8';
  ctx.font = '15px sans-serif';
  ctx.fillText('Platform', 600, 42);
  ctx.fillText('Solutions', 700, 42);
  ctx.fillText('Enterprise', 810, 42);
  ctx.fillText('Pricing', 930, 42);

  // Hero Headline
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Architectural Intelligence for Global Scale', 720, 220);

  // Subheadline
  ctx.fillStyle = '#94A3B8';
  ctx.font = '20px sans-serif';
  ctx.fillText('Predict human visual fixation and optimize conversion flow with microsecond latency.', 720, 275);

  // High-Contrast Primary CTA Button
  const btnX = 570;
  const btnY = 320;
  const btnW = 300;
  const btnH = 56;
  ctx.fillStyle = '#00E599';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.fill();

  ctx.fillStyle = '#08090E';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Start Free Studio Trial', 720, 355);

  // Secondary CTA
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.roundRect(720 + 170, btnY, 180, btnH, 8);
  ctx.stroke();
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '16px sans-serif';
  ctx.fillText('Book Demo', 720 + 260, 355);

  // Central Hero Dashboard Graphic
  const cardX = 220;
  const cardY = 420;
  const cardW = 1000;
  const cardH = 440;
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 153, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Dashboard Telemetry Bars inside card
  ctx.fillStyle = '#1F2937';
  ctx.fillRect(cardX + 40, cardY + 50, 420, 180);
  ctx.fillStyle = '#00E599';
  ctx.fillRect(cardX + 60, cardY + 160, 40, 50);
  ctx.fillRect(cardX + 120, cardY + 130, 40, 80);
  ctx.fillRect(cardX + 180, cardY + 90, 40, 120);
  ctx.fillRect(cardX + 240, cardY + 70, 40, 140);

  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(cardX + 500, cardY + 50, 440, 320);

  return canvas.toDataURL('image/png');
}

/**
 * 2. Mobile App Checkout UX (390 x 844)
 */
function generateMobileCheckout(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 390;
  canvas.height = 844;
  const ctx = canvas.getContext('2d')!;

  // Device background
  ctx.fillStyle = '#090D16';
  ctx.fillRect(0, 0, 390, 844);

  // Status Bar
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('9:41', 32, 34);

  // Header
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Express Checkout', 195, 80);

  // Product Card
  ctx.fillStyle = '#141A28';
  ctx.beginPath();
  ctx.roundRect(24, 110, 342, 180, 16);
  ctx.fill();

  // Product Image Placeholder
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(40, 126, 120, 148, 12);
  ctx.fill();
  ctx.fillStyle = '#00E599';
  ctx.beginPath();
  ctx.arc(100, 200, 28, 0, Math.PI * 2);
  ctx.fill();

  // Product Description
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Aura Pro Headset', 176, 155);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px sans-serif';
  ctx.fillText('Space Gray • ANC', 176, 180);
  ctx.fillStyle = '#00E599';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$349.00', 176, 230);

  // Address Section
  ctx.fillStyle = '#141A28';
  ctx.beginPath();
  ctx.roundRect(24, 310, 342, 120, 16);
  ctx.fill();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Shipping Address', 40, 342);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px sans-serif';
  ctx.fillText('742 Evergreen Terrace, Springfield', 40, 372);

  // High-Contrast Primary Swipe/Tap CTA Button
  const ctaY = 730;
  ctx.fillStyle = '#00E599';
  ctx.beginPath();
  ctx.roundRect(24, ctaY, 342, 58, 29);
  ctx.fill();

  ctx.fillStyle = '#08090E';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Slide to Pay $349.00', 195, ctaY + 35);

  return canvas.toDataURL('image/png');
}

/**
 * 3. Consumer Beverage Poster Ad (800 x 1200)
 */
function generateBeveragePoster(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;

  // Warm radial gradient background
  const grad = ctx.createRadialGradient(400, 600, 80, 400, 600, 600);
  grad.addColorStop(0, '#FF4B3E');
  grad.addColorStop(0.6, '#B91C1C');
  grad.addColorStop(1, '#450A0A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 1200);

  // Headline
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 68px sans-serif';
  ctx.fillText('PURE VOLCANIC', 400, 180);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('ORGANIC CITRUS ELIXIR', 400, 240);

  // Central Can / Bottle Hero Shape
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(280, 380, 240, 520, 40);
  ctx.fill();

  // Bottle artwork & Fruit slices
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(400, 640, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('ZERO SUGAR', 400, 750);

  // Bottom Tagline & CTA
  ctx.fillStyle = '#FEF08A';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('TASTE THE ERUPTION', 400, 1020);

  return canvas.toDataURL('image/png');
}

/**
 * 4. Book Cover Typography Layout (600 x 900)
 */
function generateBookCover(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FDFBF7'; // Vintage Ivory
  ctx.fillRect(0, 0, 600, 900);

  // Classic Border
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, 540, 840);
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, 528, 828);

  // Author
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '16px serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('MARCUS AURELIUS', 300, 140);

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 48px serif';
  ctx.fillText('MEDITATIONS', 300, 240);

  // Center Emblem
  ctx.beginPath();
  ctx.arc(300, 450, 80, 0, Math.PI * 2);
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#D97706';
  ctx.font = 'italic 20px serif';
  ctx.fillText('Book IV', 300, 455);

  // Footer Translator note
  ctx.fillStyle = '#475569';
  ctx.font = '14px serif';
  ctx.fillText('A New Definitive Translation with Commentaries', 300, 760);

  return canvas.toDataURL('image/png');
}

/**
 * 5. Calibration Acid-Test Grid (400 x 400)
 * Mathematical verification baseline: Solid Black #000000 with a 40x40 Red Square #FF0000 at (320, 320)
 */
export function generateCalibrationAcidGrid(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  // 100% Solid Black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 400, 400);

  // Single high-contrast chromatic spot at (320, 320)
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(320, 320, 40, 40);

  return canvas.toDataURL('image/png');
}

export const PROCEDURAL_STUDIO_SAMPLES: ProceduralSample[] = [
  {
    id: 'sample_saas_hero',
    name: 'SaaS Platform Landing Page',
    category: 'Digital Product / Web',
    domainPreset: 'ui_ux',
    width: 1440,
    height: 900,
    generateDataUrl: generateSaaSLandingPage,
    initialAOIs: [
      {
        id: 'aoi_cta_hero',
        label: 'Primary Trial CTA',
        x: 570,
        y: 320,
        width: 300,
        height: 56,
        color: '#00E599',
        semanticTag: 'CTA',
      },
      {
        id: 'aoi_headline',
        label: 'Hero Value Proposition',
        x: 200,
        y: 170,
        width: 1040,
        height: 70,
        color: '#3B82F6',
        semanticTag: 'H1',
      },
    ],
  },
  {
    id: 'sample_mobile_checkout',
    name: 'Mobile App Checkout UX',
    category: 'Mobile UX / E-Commerce',
    domainPreset: 'ui_ux',
    width: 390,
    height: 844,
    generateDataUrl: generateMobileCheckout,
    initialAOIs: [
      {
        id: 'aoi_checkout_btn',
        label: 'Swipe to Pay Button',
        x: 24,
        y: 730,
        width: 342,
        height: 58,
        color: '#00E599',
        semanticTag: 'CTA',
      },
      {
        id: 'aoi_product_card',
        label: 'Product Info Card',
        x: 24,
        y: 110,
        width: 342,
        height: 180,
        color: '#F59E0B',
        semanticTag: 'ProductCard',
      },
    ],
  },
  {
    id: 'sample_beverage_ad',
    name: 'Beverage Advertising Poster',
    category: 'Brand / Advertising',
    domainPreset: 'advertising',
    width: 800,
    height: 1200,
    generateDataUrl: generateBeveragePoster,
    initialAOIs: [
      {
        id: 'aoi_ad_bottle',
        label: 'Product Silhouette',
        x: 260,
        y: 360,
        width: 280,
        height: 550,
        color: '#FF4B3E',
        semanticTag: 'HeroAsset',
      },
      {
        id: 'aoi_ad_headline',
        label: 'Volcanic Citrus Headline',
        x: 100,
        y: 130,
        width: 600,
        height: 120,
        color: '#FEF08A',
        semanticTag: 'Header',
      },
    ],
  },
  {
    id: 'sample_book_cover',
    name: 'Book Cover Typography',
    category: 'Editorial / Publishing',
    domainPreset: 'editorial_book',
    width: 600,
    height: 900,
    generateDataUrl: generateBookCover,
    initialAOIs: [
      {
        id: 'aoi_book_title',
        label: 'Title Typography',
        x: 60,
        y: 190,
        width: 480,
        height: 70,
        color: '#3B82F6',
        semanticTag: 'Title',
      },
      {
        id: 'aoi_book_emblem',
        label: 'Center Medallion',
        x: 210,
        y: 360,
        width: 180,
        height: 180,
        color: '#D97706',
        semanticTag: 'Artwork',
      },
    ],
  },
  {
    id: 'sample_acid_test',
    name: 'Calibration Acid-Test Grid',
    category: 'Mathematical Verification',
    domainPreset: 'fine_art',
    width: 400,
    height: 400,
    generateDataUrl: generateCalibrationAcidGrid,
    initialAOIs: [
      {
        id: 'aoi_acid_target',
        label: 'Red Target Box [310..370]',
        x: 310,
        y: 310,
        width: 60,
        height: 60,
        color: '#EF4444',
        semanticTag: 'Target',
      },
      {
        id: 'aoi_acid_baseline',
        label: 'Baseline Top-Left [20..80]',
        x: 20,
        y: 20,
        width: 60,
        height: 60,
        color: '#6B7280',
        semanticTag: 'Control',
      },
    ],
  },
];
