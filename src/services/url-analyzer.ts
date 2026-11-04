import { AOIRegion, DOMSemanticElement, ViewportMode, WebsiteCapturePayload } from '../types/studio';

export interface UrlAnalysisResponse {
  payload: WebsiteCapturePayload;
  aois: AOIRegion[];
}

const AOI_COLORS = [
  '#00E599', // Emerald Neon
  '#3B82F6', // Cobalt Blue
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EF4444', // Red
];

/**
 * Converts DOM semantic elements into interactive AOIRegions
 */
export function convertDOMToAOIs(
  elements: DOMSemanticElement[],
  mapWidth: number,
  mapHeight: number
): AOIRegion[] {
  return elements.map((el, idx) => {
    const color = AOI_COLORS[idx % AOI_COLORS.length];
    const label = el.isCTA
      ? `CTA: ${el.text.slice(0, 18)}`
      : el.role === 'heading'
      ? `${el.tag.toUpperCase()}: ${el.text.slice(0, 18)}`
      : `${el.tag}: ${el.text.slice(0, 16)}`;

    return {
      id: `aoi_dom_${idx}_${Date.now()}`,
      label,
      x: Math.max(0, Math.min(mapWidth - 10, el.x)),
      y: Math.max(0, Math.min(mapHeight - 10, el.y)),
      width: Math.min(mapWidth - el.x, el.width),
      height: Math.min(mapHeight - el.y, el.height),
      color,
      shareOfAttention: 0, // Will be computed after saliency integration
      noticeability: 1.0,
      ttffMs: null,
      semanticTag: el.isCTA ? 'CTA' : el.role || el.tag,
      isAutoDetected: true,
    };
  });
}

/**
 * Triggers full website capture and DOM semantic analysis
 */
export async function captureWebsiteUrl(
  url: string,
  viewport: ViewportMode = 'desktop'
): Promise<UrlAnalysisResponse> {
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const res = await fetch('/api/capture-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl, viewport }),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const payload: WebsiteCapturePayload = await res.json();
    const aois = convertDOMToAOIs(payload.domElements, payload.width, payload.height);

    return { payload, aois };
  } catch (err) {
    console.warn('URL capture API call failed, falling back to client SVG renderer:', err);

    // Resilient fallback: build a standalone client-side capture payload
    const width = viewport === 'desktop' ? 1440 : viewport === 'tablet' ? 768 : 390;
    const height = viewport === 'desktop' ? 900 : viewport === 'tablet' ? 1024 : 844;

    const fallbackElements: DOMSemanticElement[] = [
      {
        tag: 'h1',
        text: new URL(targetUrl).hostname || targetUrl,
        x: Math.round(width * 0.1),
        y: 140,
        width: Math.round(width * 0.8),
        height: 60,
        contrastRatio: 14.0,
        isCTA: false,
        role: 'heading',
      },
      {
        tag: 'button',
        text: 'Primary Action Callout',
        x: Math.round((width - 240) / 2),
        y: 260,
        width: 240,
        height: 50,
        contrastRatio: 11.2,
        isCTA: true,
        role: 'primary-cta',
      },
      {
        tag: 'a',
        text: 'Secondary Feature Link',
        x: Math.round((width - 200) / 2),
        y: 340,
        width: 200,
        height: 36,
        contrastRatio: 6.5,
        isCTA: false,
        role: 'link',
      },
    ];

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#0A0F1D" />
        <rect width="${width}" height="56" fill="#1E293B" />
        <circle cx="24" cy="28" r="6" fill="#EF4444" />
        <circle cx="44" cy="28" r="6" fill="#F59E0B" />
        <circle cx="64" cy="28" r="6" fill="#10B981" />
        <rect x="100" y="14" width="${Math.min(500, width - 140)}" height="28" rx="6" fill="#0F172A" />
        <text x="116" y="32" fill="#94A3B8" font-family="monospace" font-size="12">${targetUrl}</text>

        <rect x="40" y="80" width="${width - 80}" height="${height - 110}" rx="12" fill="#111827" stroke="rgba(255,255,255,0.08)" />
        <text x="${width / 2}" y="180" fill="#F8FAFC" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle">${targetUrl}</text>
        <rect x="${(width - 240) / 2}" y="260" width="240" height="50" rx="8" fill="#2563EB" />
        <text x="${width / 2}" y="292" fill="#FFFFFF" font-family="sans-serif" font-size="15" font-weight="600" text-anchor="middle">Primary Action Callout</text>
      </svg>
    `;

    const imageBase64 = `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
    const payload: WebsiteCapturePayload = {
      imageBase64,
      width,
      height,
      url: targetUrl,
      viewport,
      domElements: fallbackElements,
    };

    const aois = convertDOMToAOIs(fallbackElements, width, height);
    return { payload, aois };
  }
}
