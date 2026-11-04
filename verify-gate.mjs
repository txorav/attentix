// verify-gate.mjs
import {
  analyzeImageBuffer,
  renderAttentionHeatmapRGBA
} from './src/engine/saliency-core.mjs';

function fail(msg) {
  console.error(`\n❌ GATE FAILED: ${msg}\n`); process.exit(1); } function pass(msg) { console.log(`✅ ${msg}`);
}

const W = 240, H = 240;
const cleanRgba = new Uint8ClampedArray(W * H * 4);

// 1. Clean Minimalist Canvas: Dark slate background + 1 coherent saturated orange CTA cluster (170..198, 170..198)
for (let i = 0; i < W * H; i++) {
  cleanRgba[i * 4] = 28;
  cleanRgba[i * 4 + 1] = 30;
  cleanRgba[i * 4 + 2] = 36;
  cleanRgba[i * 4 + 3] = 255;
}
for (let y = 170; y <= 198; y++) {
  for (let x = 170; x <= 198; x++) {
    const idx = (y * W + x) * 4;
    cleanRgba[idx] = 255;
    cleanRgba[idx + 1] = 85;
    cleanRgba[idx + 2] = 0;
  }
}
// Desaturated gray square at Bottom-Left (30..58, 170..198)
for (let y = 170; y <= 198; y++) {
  for (let x = 30; x <= 58; x++) {
    const idx = (y * W + x) * 4;
    cleanRgba[idx] = 75;
    cleanRgba[idx + 1] = 77;
    cleanRgba[idx + 2] = 82;
  }
}
// 1px isolated orange noise at (185, 40)
const noiseIdx = (40 * W + 185) * 4;
cleanRgba[noiseIdx] = 255; cleanRgba[noiseIdx + 1] = 85; cleanRgba[noiseIdx + 2] = 0;

const cleanRes = analyzeImageBuffer(cleanRgba, W, H, 'fine_art', 5);
const clusterCenter = 184 * W + 184;
const grayCenter = 184 * W + 44;
const noiseCenter = 40 * W + 185;

if (cleanRes.saliencyMap[clusterCenter] <= cleanRes.saliencyMap[grayCenter] * 1.8) {
  fail('Saturation/Rarity Test Failed.');
}
pass(`Gate 1: Saturated Coherent Cluster (${(cleanRes.saliencyMap[clusterCenter]*100).toFixed(1)}\%) beat Desaturated Gray (${(cleanRes.saliencyMap[grayCenter]*100).toFixed(1)}%).`);

if (cleanRes.clusterMap[clusterCenter] <= cleanRes.clusterMap[noiseCenter] * 3.0) {
  fail('Local Same-Color Cluster Mass Test Failed.');
}
pass(`Gate 2: Local Cluster Mass (${(cleanRes.clusterMap[clusterCenter]*100).toFixed(1)}\%) suppressed 1px noise (${(cleanRes.clusterMap[noiseCenter]*100).toFixed(1)}%).`);

// 2. High-Cognitive-Load Canvas: Multi-Hue Colors + Multi-Angle Shapes + Dense Typography Lines
const busyRgba = new Uint8ClampedArray(cleanRgba);
const palette = [
  [255, 40, 90], [0, 230, 140], [40, 140, 255], [255, 210, 0],
  [190, 50, 255], [0, 240, 240], [255, 120, 30], [140, 255, 40]
];

// Inject multi-colored patches & diagonal/diamond shapes in top half
for (let y = 10; y < 110; y++) {
  for (let x = 10; x < 230; x++) {
    const idx = (y * W + x) * 4;
    const patchId = ((Math.floor(x / 18) + Math.floor(y / 18)) % palette.length);
    // Diagonal & circular shape boundaries
    if ((x + y) % 11 < 5 || Math.hypot(x - 120, y - 60) % 14 < 6) {
      const c = palette[patchId];
      busyRgba[idx] = c[0];
      busyRgba[idx + 1] = c[1];
      busyRgba[idx + 2] = c[2];
    }
  }
}

// Inject dense simulated typography lines (2px vertical glyph stems alternating every 3px across rows)
for (let lineY = 118; lineY < 162; lineY += 8) {
  for (let y = lineY; y < lineY + 5; y++) {
    for (let x = 15; x < 225; x++) {
      if (x % 3 !== 0 && (x % 19 !== 0)) {
        const idx = (y * W + x) * 4;
        busyRgba[idx] = 245;
        busyRgba[idx + 1] = 248;
        busyRgba[idx + 2] = 255;
      }
    }
  }
}

const busyRes = analyzeImageBuffer(busyRgba, W, H, 'ui_ux', 5);

if (busyRes.colorLoadScore <= cleanRes.colorLoadScore + 15) {
  fail(`Color Load failed to respond to multi-hue palette: Clean=${cleanRes.colorLoadScore}, Busy=${busyRes.colorLoadScore}`);
}
pass(`Gate 3 (Color Cognitive Load): Clean=${cleanRes.colorLoadScore}\% -> Multi-Color=${busyRes.colorLoadScore}%`);

if (busyRes.shapeLoadScore <= cleanRes.shapeLoadScore + 15) {
  fail(`Shape Load failed to respond to multi-angle geometry: Clean=${cleanRes.shapeLoadScore}, Busy=${busyRes.shapeLoadScore}`);
}
pass(`Gate 4 (Shape & Orientation Cognitive Load): Clean=${cleanRes.shapeLoadScore}\% -> Complex Shapes=${busyRes.shapeLoadScore}%`);

if (busyRes.textLoadScore <= cleanRes.textLoadScore + 15) {
  fail(`Text Load failed to respond to typographic glyph rows: Clean=${cleanRes.textLoadScore}, Busy=${busyRes.textLoadScore}`);
}
pass(`Gate 5 (Text & Typography Cognitive Load): Clean=${cleanRes.textLoadScore}\% -> Dense Text=${busyRes.textLoadScore}%`);

if (busyRes.cognitiveLoadScore <= cleanRes.cognitiveLoadScore + 20) {
  fail(`Total Cognitive Load failed: Clean=${cleanRes.cognitiveLoadScore}, Busy=${busyRes.cognitiveLoadScore}`);
}
pass(`Gate 6 (Total Cognitive Load & Clarity): Clean Load=${cleanRes.cognitiveLoadScore}\% (Clarity${cleanRes.clarityScore}%) -> Busy Load=${busyRes.cognitiveLoadScore}\% (Clarity${busyRes.clarityScore}%)`);

const heat = renderAttentionHeatmapRGBA(cleanRgba, cleanRes.saliencyMap, W, H, { mode: 'heatmap', colormap: 'thermal' });
if (heat[clusterCenter * 4] < 200) {
  fail('Thermal Attention Heatmap RGBA failed to render hot red/orange at cluster center.');
}
pass('Gate 7: Thermal Attention Heatmap RGBA verified.');

// --------------------------------------------------------------------
// SYNTHETIC GATES 8 - 11 (Principled Ground-Truth Invariants)
// --------------------------------------------------------------------

// GATE 8: Lone saturated button on a flat background must be the top peak (#1 fixation)
const btnW = 200, btnH = 200;
const btnRgba = new Uint8ClampedArray(btnW * btnH * 4);
for (let i = 0; i < btnW * btnH; i++) {
  btnRgba[i * 4] = 32;
  btnRgba[i * 4 + 1] = 34;
  btnRgba[i * 4 + 2] = 40;
  btnRgba[i * 4 + 3] = 255;
}
// Saturated Emerald CTA button at (140..175, 140..175)
for (let y = 140; y <= 175; y++) {
  for (let x = 140; x <= 175; x++) {
    const idx = (y * btnW + x) * 4;
    btnRgba[idx] = 0;
    btnRgba[idx + 1] = 229;
    btnRgba[idx + 2] = 153;
  }
}
const btnRes = analyzeImageBuffer(btnRgba, btnW, btnH, 'fine_art', 5);
const f1 = btnRes.fixations[0];
if (!f1 || f1.x < 135 || f1.x > 180 || f1.y < 135 || f1.y > 180) {
  fail(`Gate 8 Failed: Fixation #1 at (${f1?.x}, ${f1?.y}) did not land on saturated button [140..175, 140..175].`);
}
const btnCenter = 157 * btnW + 157;
if (btnRes.saliencyMap[btnCenter] < 0.90) {
  fail(`Gate 8 Failed: Button center saliency too low: ${btnRes.saliencyMap[btnCenter]}`);
}
pass(`Gate 8: Lone Saturated Button is top peak (Fixation #1 at (${f1.x}, ${f1.y}) with ${(btnRes.saliencyMap[btnCenter]*100).toFixed(1)}% saliency).`);

// GATE 9: Text block must outrank equal-sized plain region
const txtW = 220, txtH = 220;
const txtRgba = new Uint8ClampedArray(txtW * txtH * 4);
for (let i = 0; i < txtW * txtH; i++) {
  txtRgba[i * 4] = 235;
  txtRgba[i * 4 + 1] = 238;
  txtRgba[i * 4 + 2] = 242;
  txtRgba[i * 4 + 3] = 255;
}
// Region A: Typography text block at x: 25..95, y: 50..130 (alternating glyph stems)
for (let y = 50; y <= 130; y++) {
  for (let x = 25; x <= 95; x++) {
    const idx = (y * txtW + x) * 4;
    // Glyph stroke pattern alternating horizontally
    if (y % 7 < 4 && x % 4 !== 0) {
      txtRgba[idx] = 20;
      txtRgba[idx + 1] = 22;
      txtRgba[idx + 2] = 28;
    }
  }
}
// Region B: Equal-sized plain region at x: 125..195, y: 50..130 (solid uniform gray block)
for (let y = 50; y <= 130; y++) {
  for (let x = 125; x <= 195; x++) {
    const idx = (y * txtW + x) * 4;
    txtRgba[idx] = 160;
    txtRgba[idx + 1] = 165;
    txtRgba[idx + 2] = 172;
  }
}
const txtRes = analyzeImageBuffer(txtRgba, txtW, txtH, 'ui_ux', 5);
let textMass = 0, textPixels = 0;
let plainMass = 0, plainPixels = 0;
for (let y = 55; y <= 125; y++) {
  for (let x = 30; x <= 90; x++) {
    textMass += txtRes.saliencyMap[y * txtW + x];
    textPixels++;
  }
  for (let x = 130; x <= 190; x++) {
    plainMass += txtRes.saliencyMap[y * txtW + x];
    plainPixels++;
  }
}
const textMeanSal = textMass / textPixels;
const plainMeanSal = plainMass / plainPixels;
if (textMeanSal <= plainMeanSal * 1.25) {
  fail(`Gate 9 Failed: Text block (${textMeanSal.toFixed(3)}) did not outrank plain block (${plainMeanSal.toFixed(3)}).`);
}
pass(`Gate 9: Text block outranked plain region (${(textMeanSal * 100).toFixed(1)}% vs ${(plainMeanSal * 100).toFixed(1)}%).`);

// GATE 10: A large uniform background does NOT outrank a small contrasting element (tests §2.8)
const g10W = 200, g10H = 200;
const g10Rgba = new Uint8ClampedArray(g10W * g10H * 4);
for (let i = 0; i < g10W * g10H; i++) {
  g10Rgba[i * 4] = 230; g10Rgba[i * 4 + 1] = 230; g10Rgba[i * 4 + 2] = 235; g10Rgba[i * 4 + 3] = 255;
}
// Large uniform background panel: 150x150 (56% of image)
for (let y = 20; y < 170; y++) {
  for (let x = 20; x < 170; x++) {
    const idx = (y * g10W + x) * 4;
    g10Rgba[idx] = 200; g10Rgba[idx + 1] = 205; g10Rgba[idx + 2] = 215;
  }
}
// Small contrasting CTA: 20x20 (1% of image) inside the panel
for (let y = 80; y < 100; y++) {
  for (let x = 80; x < 100; x++) {
    const idx = (y * g10W + x) * 4;
    g10Rgba[idx] = 255; g10Rgba[idx + 1] = 70; g10Rgba[idx + 2] = 0;
  }
}
const g10Res = analyzeImageBuffer(g10Rgba, g10W, g10H, 'ui_ux', 5);
const ctaCenter = 90 * g10W + 90;
const bgCenter = 40 * g10W + 40;
if (g10Res.saliencyMap[ctaCenter] <= g10Res.saliencyMap[bgCenter] * 2.0) {
  fail(`Gate 10 Failed: Large background (${g10Res.saliencyMap[bgCenter]}) rivaled small contrasting CTA (${g10Res.saliencyMap[ctaCenter]}).`);
}
pass(`Gate 10: Small contrasting CTA (${(g10Res.saliencyMap[ctaCenter]*100).toFixed(1)}%) strongly beat large background (${(g10Res.saliencyMap[bgCenter]*100).toFixed(1)}%).`);

// GATE 11: A striped or checkered texture is NOT classified as text (tests §2.9)
const g11W = 200, g11H = 200;
const g11Rgba = new Uint8ClampedArray(g11W * g11H * 4);
for (let y = 0; y < g11H; y++) {
  for (let x = 0; x < g11W; x++) {
    const idx = (y * g11W + x) * 4;
    const v = (x % 4 < 2) ? 20 : 230;
    g11Rgba[idx] = v; g11Rgba[idx + 1] = v; g11Rgba[idx + 2] = v; g11Rgba[idx + 3] = 255;
  }
}
const g11Res = analyzeImageBuffer(g11Rgba, g11W, g11H, 'ui_ux', 5);
const maxStripeText = Math.max(...g11Res.textMap);
if (maxStripeText > 0.15) {
  fail(`Gate 11 Failed: Striped texture misclassified as text (max textMap: ${maxStripeText.toFixed(3)}).`);
}
pass(`Gate 11: Striped texture correctly rejected as non-text (max textMap: ${(maxStripeText*100).toFixed(1)}%).`);

// GATE 12: A skin-colored non-face rectangle gets NO face boost (tests §2.10)
const g12W = 200, g12H = 200;
const g12Rgba = new Uint8ClampedArray(g12W * g12H * 4);
for (let i = 0; i < g12W * g12H; i++) {
  g12Rgba[i * 4] = 60; g12Rgba[i * 4 + 1] = 65; g12Rgba[i * 4 + 2] = 75; g12Rgba[i * 4 + 3] = 255;
}
for (let y = 60; y < 140; y++) {
  for (let x = 60; x < 140; x++) {
    const idx = (y * g12W + x) * 4;
    g12Rgba[idx] = 225; g12Rgba[idx + 1] = 160; g12Rgba[idx + 2] = 130;
  }
}
const g12Res = analyzeImageBuffer(g12Rgba, g12W, g12H, 'fine_art', 5);
const maxFlatSkinFace = Math.max(...g12Res.facesMap);
if (maxFlatSkinFace > 0.01) {
  fail(`Gate 12 Failed: Flat skin-colored rectangle received face boost (${maxFlatSkinFace.toFixed(3)}).`);
}
pass(`Gate 12: Skin-colored non-face rectangle correctly received 0 face boost (max facesMap: ${maxFlatSkinFace.toFixed(3)}).`);

// GATE 13: A 3×3 grid of identical cards: no single card exceeds others by more than set margin, and total is lower than 9× one card (tests §2.11)
const g13W = 240, g13H = 240;
const gridRgba = new Uint8ClampedArray(g13W * g13H * 4);
for (let i = 0; i < g13W * g13H; i++) {
  gridRgba[i * 4] = 30; gridRgba[i * 4 + 1] = 32; gridRgba[i * 4 + 2] = 38; gridRgba[i * 4 + 3] = 255;
}
const xs = [30, 102, 174];
const ys = [30, 102, 174];
for (const gy of ys) {
  for (const gx of xs) {
    for (let y = gy; y < gy + 36; y++) {
      for (let x = gx; x < gx + 36; x++) {
        const idx = (y * g13W + x) * 4;
        gridRgba[idx] = 0; gridRgba[idx + 1] = 210; gridRgba[idx + 2] = 160;
      }
    }
  }
}
const singleRgba = new Uint8ClampedArray(g13W * g13H * 4);
for (let i = 0; i < g13W * g13H; i++) {
  singleRgba[i * 4] = 30; singleRgba[i * 4 + 1] = 32; singleRgba[i * 4 + 2] = 38; singleRgba[i * 4 + 3] = 255;
}
for (let y = 30; y < 66; y++) {
  for (let x = 30; x < 66; x++) {
    const idx = (y * g13W + x) * 4;
    singleRgba[idx] = 0; singleRgba[idx + 1] = 210; singleRgba[idx + 2] = 160;
  }
}
const gridRes = analyzeImageBuffer(gridRgba, g13W, g13H, 'ui_ux', 5);
const singleRes = analyzeImageBuffer(singleRgba, g13W, g13H, 'ui_ux', 5);

let singleCardSum = 0;
for (let y = 30; y < 66; y++) {
  for (let x = 30; x < 66; x++) {
    singleCardSum += singleRes.saliencyMap[y * g13W + x];
  }
}
let cardSums = [];
let totalGridCardSum = 0;
for (const gy of ys) {
  for (const gx of xs) {
    let sum = 0;
    for (let y = gy; y < gy + 36; y++) {
      for (let x = gx; x < gx + 36; x++) {
        sum += gridRes.saliencyMap[y * g13W + x];
      }
    }
    cardSums.push(sum);
    totalGridCardSum += sum;
  }
}
const maxCard = Math.max(...cardSums);
const minCard = Math.min(...cardSums);
const cardSpread = maxCard / minCard;
const suppressionRatio = totalGridCardSum / (9 * singleCardSum);
if (suppressionRatio >= 1.0) {
  fail(`Gate 13 Failed: Repetition suppression failed (grid/single ratio: ${suppressionRatio.toFixed(3)} >= 1.0).`);
}
if (cardSpread > 1.35) {
  fail(`Gate 13 Failed: Identical cards had excessive attention variance (max/min: ${cardSpread.toFixed(3)}).`);
}
pass(`Gate 13: 3×3 Grid repetition suppressed (${(suppressionRatio*100).toFixed(1)}% of 9× single, card spread max/min: ${cardSpread.toFixed(2)}x).`);

// GATE 14: Uniform image yields flat map (max/mean <= 1.05) and lowInformation=true (tests §3.3)
const g14W = 180, g14H = 180;
const g14Rgba = new Uint8ClampedArray(g14W * g14H * 4).fill(140);
const g14Res = analyzeImageBuffer(g14Rgba, g14W, g14H, 'ui_ux', 5);
let g14Max = -Infinity, g14Sum = 0;
for (let i = 0; i < g14Res.saliencyMap.length; i++) {
  const v = g14Res.saliencyMap[i];
  if (v > g14Max) g14Max = v;
  g14Sum += v;
}
const g14Mean = g14Sum / g14Res.saliencyMap.length;
const ratioMaxMean = g14Mean > 1e-6 ? g14Max / g14Mean : 1.0;
const isLowInfo = g14Res.warnings.includes('low_information') || Object.values(g14Res.channelValid).filter(Boolean).length <= 1;

if (ratioMaxMean > 1.05 || !isLowInfo) {
  fail(`Gate 14 Failed: Uniform image did not produce flat map or lowInformation. Max/Mean: ${ratioMaxMean.toFixed(3)}, lowInformation: ${isLowInfo}`);
}
pass(`Gate 14: Uniform image yielded flat map (max/mean = ${ratioMaxMean.toFixed(2)} <= 1.05) with lowInformation=true.`);

console.log('\n====================================================================');
console.log('GATE_STATUS: 100%_VERIFIED_ALL_14_SPEC_V2_GATES_PASSING');
console.log('====================================================================\n');
console.log('====================================================================\n');
