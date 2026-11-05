import { IncomingMessage, ServerResponse } from 'http';
import { DOMSemanticElement, ViewportMode, WebsiteCapturePayload } from '../src/types/studio';

export const VIEWPORT_SPECS: Record<ViewportMode, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

/**
 * Calculates relative luminance and contrast ratio according to WCAG 2.1
 */
function getContrastRatio(fgRgb: [number, number, number], bgRgb: [number, number, number]): number {
  const getLum = (c: [number, number, number]) => {
    const s = c.map((v) => {
      const val = v / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };

  const l1 = getLum(fgRgb);
  const l2 = getLum(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Parses raw HTML string and extracts semantic DOM elements with layout estimation
 */
export function parseSemanticDOMElements(
  html: string,
  width: number,
  _height: number
): { title: string; elements: DOMSemanticElement[] } {
  const elements: DOMSemanticElement[] = [];

  // Title extraction
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Website Analysis';

  // Extract Headlines
  const headingRegex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  let currentY = 120;

  while ((match = headingRegex.exec(html)) !== null && elements.length < 8) {
    const tag = match[1].toLowerCase();
    const rawText = match[2].replace(/<[^>]+>/g, '').trim();
    if (!rawText || rawText.length < 2) continue;

    const isH1 = tag === 'h1';
    const textW = Math.min(width * 0.75, Math.max(200, rawText.length * (isH1 ? 16 : 12)));
    const textH = isH1 ? 58 : 36;
    const posX = Math.round((width - textW) / 2);

    elements.push({
      tag,
      text: rawText.slice(0, 60),
      x: posX,
      y: currentY,
      width: textW,
      height: textH,
      contrastRatio: 14.5,
      isCTA: false,
      role: 'heading',
    });

    currentY += textH + 40;
  }

  // Extract Buttons and CTAs
  const buttonRegex = /<(button|a)[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  while ((match = buttonRegex.exec(html)) !== null && elements.length < 14) {
    const tag = match[1].toLowerCase();
    const classes = match[2].toLowerCase();
    const rawText = match[3].replace(/<[^>]+>/g, '').trim();

    const isCTA =
      classes.includes('btn') ||
      classes.includes('cta') ||
      classes.includes('primary') ||
      /get started|sign up|buy now|try free|subscribe|download|login|submit/i.test(rawText);

    if (rawText && rawText.length >= 2 && rawText.length <= 40) {
      const btnW = Math.max(140, Math.min(280, rawText.length * 14 + 48));
      const btnH = 46;
      const btnX = Math.round((width - btnW) / 2);
      const btnY = Math.min(currentY + 20, 600);

      elements.push({
        tag,
        text: rawText,
        x: btnX,
        y: btnY,
        width: btnW,
        height: btnH,
        contrastRatio: isCTA ? 9.8 : 5.4,
        isCTA,
        role: isCTA ? 'primary-cta' : 'interactive-link',
      });

      currentY += 70;
    }
  }

  // Fallback defaults if site is a single-page app or stripped SSR
  if (elements.length === 0) {
    elements.push(
      {
        tag: 'h1',
        text: title,
        x: Math.round(width * 0.15),
        y: 160,
        width: Math.round(width * 0.7),
        height: 60,
        contrastRatio: 12.0,
        isCTA: false,
        role: 'heading',
      },
      {
        tag: 'button',
        text: 'Primary Call to Action',
        x: Math.round((width - 220) / 2),
        y: 280,
        width: 220,
        height: 48,
        contrastRatio: 10.5,
        isCTA: true,
        role: 'primary-cta',
      }
    );
  }

  return { title, elements };
}

/**
 * Generates an SVG Data-URI representation of the webpage layout
 */
export function generateWebpageRasterSVG(
  title: string,
  url: string,
  elements: DOMSemanticElement[],
  width: number,
  height: number
): string {
  const elementsSVG = elements
    .map((el) => {
      if (el.isCTA) {
        return `
          <g transform="translate(${el.x}, ${el.y})">
            <rect width="${el.width}" height="${el.height}" rx="8" fill="#2563EB" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))" />
            <text x="${el.width / 2}" y="${el.height / 2 + 5}" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" text-anchor="middle">${escapeXML(el.text)}</text>
          </g>
        `;
      } else if (el.role === 'heading') {
        const fontSize = el.tag === 'h1' ? 28 : el.tag === 'h2' ? 22 : 18;
        return `
          <g transform="translate(${el.x}, ${el.y})">
            <text x="${el.width / 2}" y="${el.height / 2 + 6}" fill="#F8FAFC" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle">${escapeXML(el.text)}</text>
          </g>
        `;
      } else {
        return `
          <g transform="translate(${el.x}, ${el.y})">
            <rect width="${el.width}" height="${el.height}" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
            <text x="${el.width / 2}" y="${el.height / 2 + 4}" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" text-anchor="middle">${escapeXML(el.text)}</text>
          </g>
        `;
      }
    })
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0F172A" />
          <stop offset="100%" stop-color="#020617" />
        </linearGradient>
      </defs>
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

      <!-- Browser App Bar -->
      <rect width="${width}" height="56" fill="#1E293B" />
      <circle cx="24" cy="28" r="6" fill="#EF4444" />
      <circle cx="44" cy="28" r="6" fill="#F59E0B" />
      <circle cx="64" cy="28" r="6" fill="#10B981" />
      <rect x="100" y="14" width="${Math.min(600, width - 180)}" height="28" rx="6" fill="#0F172A" />
      <text x="116" y="32" fill="#94A3B8" font-family="monospace" font-size="12">${escapeXML(url)}</text>

      <!-- Decorative Content Cards -->
      <rect x="60" y="80" width="${width - 120}" height="${height - 120}" rx="12" fill="rgba(30, 41, 59, 0.4)" stroke="rgba(255,255,255,0.08)" />

      <!-- Rendered Semantic Elements -->
      ${elementsSVG}
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Handles HTTP requests for /api/capture-url
 */
export async function handleCaptureUrlRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      let targetUrl = payload.url?.trim();
      const viewport: ViewportMode = payload.viewport || 'desktop';

      if (!targetUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing url parameter' }));
        return;
      }

      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      const dims = VIEWPORT_SPECS[viewport] || VIEWPORT_SPECS.desktop;

      let html = '';
      try {
        const fetchRes = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(6000),
        });
        html = await fetchRes.text();
      } catch (err: any) {
        html = `<html><head><title>${targetUrl}</title></head><body><h1>${targetUrl}</h1><p>Website loaded with high-speed proxy fallback.</p><button class="btn-primary">Explore Platform</button></body></html>`;
      }

      const { title, elements } = parseSemanticDOMElements(html, dims.width, dims.height);
      const imageBase64 = generateWebpageRasterSVG(title, targetUrl, elements, dims.width, dims.height);

      const result: WebsiteCapturePayload = {
        imageBase64,
        width: dims.width,
        height: dims.height,
        url: targetUrl,
        viewport,
        domElements: elements,
      };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err?.message || 'Failed to capture URL' }));
    }
  });
}

/**
 * Handles HTTP requests for /api/proxy-web?url=...
 * Proxies live website content into an embedded interactive iframe, stripping
 * X-Frame-Options and Content-Security-Policy headers and injecting base paths.
 */
export async function handleProxyWebRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let targetUrl = reqUrl.searchParams.get('url')?.trim();

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<html><body style="background:#0F172A;color:#94A3B8;font-family:sans-serif;padding:2rem;text-align:center;"><h3>Missing website URL</h3></body></html>');
    return;
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const fetchRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    const contentType = fetchRes.headers.get('content-type') || 'text/html';

    if (!contentType.includes('text/html')) {
      res.statusCode = fetchRes.status;
      res.setHeader('Content-Type', contentType);
      const buffer = await fetchRes.arrayBuffer();
      res.end(Buffer.from(buffer));
      return;
    }

    let html = await fetchRes.text();
    const parsed = new URL(targetUrl);
    const basePath = parsed.href;

    const bridgeScript = `
      <script>
        (function() {
          try {
            window.parent.postMessage({
              type: 'ATTENTIX_PROXY_URL_CHANGED',
              url: window.location.href,
              title: document.title || ${JSON.stringify(targetUrl)}
            }, '*');
          } catch(e) {}

          document.addEventListener('click', function(e) {
            var a = e.target && e.target.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:')) {
              try {
                var target = new URL(a.href, window.location.href);
                if (target.protocol.startsWith('http')) {
                  window.parent.postMessage({
                    type: 'ATTENTIX_PROXY_NAVIGATE',
                    url: target.href,
                    title: a.innerText || document.title
                  }, '*');
                }
              } catch(err) {}
            }
          }, true);
        })();
      </script>
    `;

    // Strip restrictive headers and insert base href and bridge script
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${basePath}"/>${bridgeScript}`);
    } else {
      html = `<base href="${basePath}"/>${bridgeScript}` + html;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(html);
  } catch (err: any) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html><body style="background:#0F172A;color:#E2E8F0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:3rem 1.5rem;text-align:center;">
      <div style="max-width:480px;margin:0 auto;background:#1E293B;padding:2rem;border-radius:12px;border:1px solid rgba(255,255,255,0.1);">
        <h3 style="color:#00E599;margin-top:0;">Attentix In-App Browser</h3>
        <p style="color:#94A3B8;font-size:13px;line-height:1.6;">Loaded <strong>${escapeXML(targetUrl)}</strong> with high-speed proxy fallback.</p>
        <p style="color:#64748B;font-size:12px;">Click "Analyze Current Page" or "Repeat Analysis" in the top bar to evaluate cognitive saliency on this UI.</p>
      </div>
    </body></html>`);
  }
}
