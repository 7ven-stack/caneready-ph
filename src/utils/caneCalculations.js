export const STATUS_GATES = Object.freeze({
  OK_TO_HARVEST: Object.freeze({
    minAvgBrix: 19.5,
    minRatio: 0.94,
    maxRatio: 1.05,
    minAgeMonths: 10.5,
  }),
  APPROACHING: Object.freeze({
    minAvgBrix: 17.5,
    minRatio: 0.85,
    minAgeMonths: 9.5,
  }),
  OVER_MATURE: Object.freeze({
    maxAgeMonths: 13.5,
    maxRatio: 1.08,
  }),
});

export const READINESS_CONFIG = Object.freeze({
  weights: Object.freeze({
    brix: 0.45,
    ratio: 0.35,
    age: 0.2,
  }),
  age: Object.freeze({
    minMonths: 6,
    spanMonths: 6,
  }),
  brix: Object.freeze({
    minBrix: 13,
    spanBrix: 8,
  }),
  ratio: Object.freeze({
    target: 1.0,
    penaltyMultiplier: 260,
  }),
  yield: Object.freeze({
    minLkgTc: 0.8,
    brixFactor: 0.115,
    maxRatioCap: 1.05,
    defaultTcHa: 75,
    planterShare: 0.7,
    truckCapacityTons: 18,
  }),
});

// 1c. Compute cropAgeMonths dynamically from plantingDate (or last cut date for ratoons) at read time;
// keep stored cropAgeMonths only as a fallback for legacy rows lacking a valid plantingDate.
export function computeCropAgeMonths(plantingDate, fallbackMonths = null, now = new Date()) {
  if (typeof plantingDate === 'string' && plantingDate.trim()) {
    const parsed = new Date(plantingDate + 'T00:00:00');
    if (!Number.isNaN(parsed.getTime())) {
      const diffMs = now.getTime() - parsed.getTime();
      const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
      return Number(Math.max(0, months).toFixed(1));
    }
  }
  const fallback = Number(fallbackMonths);
  return Number.isFinite(fallback) && fallback >= 0 ? Number(fallback.toFixed(1)) : 0;
}

export function hasValidBrixSample(lot) {
  if (!lot) return false;
  const topRaw = lot.topBrix;
  const botRaw = lot.bottomBrix;
  if (
    topRaw === null ||
    topRaw === undefined ||
    topRaw === '' ||
    botRaw === null ||
    botRaw === undefined ||
    botRaw === ''
  ) {
    return false;
  }
  const top = Number(topRaw);
  const bot = Number(botRaw);
  return Number.isFinite(top) && Number.isFinite(bot) && top > 0 && bot > 0;
}

export function isUnverifiedDefaultSample(lot) {
  if (!hasValidBrixSample(lot)) return false;
  if (lot.sampleStatus === 'unverified (form default)') return true;
  if (lot.sampledBy === 'unverified (form default)') return true;
  if (lot.isUnverifiedDefault === true) return true;
  // Flag existing backfilled rows that match the legacy 20.0 / 20.5 form defaults
  const top = Number(lot.topBrix);
  const bot = Number(lot.bottomBrix);
  return top === 20.0 && bot === 20.5 && lot.sampleVerified !== true;
}

export function evaluateLotMetrics(lot) {
  const { weights, age, brix, ratio, yield: yieldCfg } = READINESS_CONFIG;

  const cropAgeMonths = computeCropAgeMonths(lot.plantingDate, lot.cropAgeMonths);
  const ageScore = Math.round(
    Math.min(100, Math.max(0, ((cropAgeMonths - age.minMonths) / age.spanMonths) * 100))
  );

  const areaHa = Number(lot.areaHa) || 0;
  const expectedTcHa = Number(lot.expectedTcHa) || yieldCfg.defaultTcHa;
  const estimatedTons = Math.round(areaHa * expectedTcHa);
  const estimatedTruckLoads = Math.max(
    1,
    Math.ceil(estimatedTons / yieldCfg.truckCapacityTons)
  );

  const hasSample = hasValidBrixSample(lot);
  const isUnverifiedDefault = isUnverifiedDefaultSample(lot);

  // 1b. Missing sample: remove `|| 0`, return null score and Needs Attention = "Needs first sample"
  if (!hasSample) {
    const isOverAge = cropAgeMonths > STATUS_GATES.OVER_MATURE.maxAgeMonths;
    const status = isOverAge ? 'Over-mature Risk' : 'Immature';
    const statusDisplay = isOverAge ? 'Over-mature Risk' : 'No sample yet';
    const recommendation = isOverAge
      ? `URGENT: Crop age (${cropAgeMonths} mos) exceeds the 13.5-month maximum threshold and has no refractometer sample on record. Sample and schedule priority harvest immediately.`
      : 'Needs first sample: No refractometer Brix reading has been logged for this lot yet. Collect top and bottom stalk juice samples to evaluate maturity.';

    return {
      ...lot,
      cropAgeMonths,
      expectedTcHa,
      hasBrixSample: false,
      isUnverifiedDefault: false,
      needsAttention: 'Needs first sample',
      topBrix: null,
      bottomBrix: null,
      lastSampled: null,
      avgBrix: null,
      brixDelta: null,
      maturityRatio: null,
      brixScore: null,
      ratioScore: null,
      ageScore,
      readinessScore: null,
      estimatedLkgTc: null,
      estimatedTons,
      totalSugarBagsLkg: null,
      planterShareBags: null,
      millShareBags: null,
      estimatedTruckLoads,
      apparentPurity: null,
      recommendation,
      harvestWindow: isOverAge ? 'Immediate (Over Age — Sample Now)' : 'Needs first sample',
      status,
      statusDisplay,
    };
  }

  const topBrix = Number(lot.topBrix);
  const bottomBrix = Number(lot.bottomBrix);
  const avgBrix = Number(((topBrix + bottomBrix) / 2).toFixed(1));
  const brixDelta = Number((topBrix - bottomBrix).toFixed(1));
  const maturityRatio = Number((topBrix / bottomBrix).toFixed(2));

  const brixScore = Math.round(
    Math.min(100, Math.max(0, ((avgBrix - brix.minBrix) / brix.spanBrix) * 100))
  );
  const ratioDiff = Math.abs(ratio.target - maturityRatio);
  const ratioScore = Math.round(
    Math.max(0, 100 - ratioDiff * ratio.penaltyMultiplier)
  );

  const readinessScore = Math.round(
    brixScore * weights.brix + ratioScore * weights.ratio + ageScore * weights.age
  );

  const estimatedLkgTc = Number(
    Math.max(
      yieldCfg.minLkgTc,
      avgBrix * yieldCfg.brixFactor * Math.min(yieldCfg.maxRatioCap, maturityRatio)
    ).toFixed(2)
  );
  const totalSugarBagsLkg = Math.round(estimatedTons * estimatedLkgTc);
  const planterShareBags = Math.round(totalSugarBagsLkg * yieldCfg.planterShare);
  const millShareBags = totalSugarBagsLkg - planterShareBags;
  const apparentPurity = Number(
    Math.min(92.5, Math.max(72.0, 74 + (avgBrix - 15) * 2.1 - ratioDiff * 12)).toFixed(1)
  );

  let status = 'Immature';
  let recommendation =
    'Continue vegetative growth and monitor foliar nutrition. Schedule refractometer check as crop approaches 9.5 months.';
  let harvestWindow = 'In 60–90 Days';
  let needsAttention = null;

  const isOverAge = cropAgeMonths > STATUS_GATES.OVER_MATURE.maxAgeMonths;
  const isOverRatio = maturityRatio > STATUS_GATES.OVER_MATURE.maxRatio;
  const isHighRatioWatch =
    maturityRatio > STATUS_GATES.OK_TO_HARVEST.maxRatio &&
    maturityRatio <= STATUS_GATES.OVER_MATURE.maxRatio;

  // 1g. Accurate status and message logic for Over-mature (age vs ratio) and ratio 1.05-1.08
  if (isOverAge || isOverRatio) {
    status = 'Over-mature Risk';
    harvestWindow = 'Immediate (Within 3–5 Days)';
    needsAttention = isOverAge && !isOverRatio ? 'Over-mature (Over age)' : 'Over-mature / Inversion risk';

    if (isOverAge && isOverRatio) {
      recommendation = `URGENT: Crop age (${cropAgeMonths} mos) exceeds 13.5 months and T/B ratio (${maturityRatio}) exceeds 1.08. High stalk fiberization and sucrose inversion risk — issue priority cutting permit immediately.`;
    } else if (isOverAge) {
      recommendation = `URGENT: Crop is over age at ${cropAgeMonths} months (exceeds the 13.5-month limit). Prolonged field standing increases stalk pithiness and lodging — issue priority cutting permit immediately.`;
    } else {
      recommendation = `URGENT: Top Brix exceeds Bottom Brix (Ratio ${maturityRatio} > 1.08), indicating sucrose inversion risk. Issue priority cutting permit immediately.`;
    }
  } else if (
    avgBrix >= STATUS_GATES.OK_TO_HARVEST.minAvgBrix &&
    maturityRatio >= STATUS_GATES.OK_TO_HARVEST.minRatio &&
    maturityRatio <= STATUS_GATES.OK_TO_HARVEST.maxRatio &&
    cropAgeMonths >= STATUS_GATES.OK_TO_HARVEST.minAgeMonths
  ) {
    status = 'OK to Harvest';
    recommendation =
      'Stalk sucrose concentration is uniform from bottom to top internodes. Optimal maturity reached for peak LKg/TC recovery.';
    harvestWindow = 'Optimal Now (Next 7–14 Days)';
  } else if (
    avgBrix >= STATUS_GATES.APPROACHING.minAvgBrix &&
    maturityRatio >= STATUS_GATES.APPROACHING.minRatio &&
    cropAgeMonths >= STATUS_GATES.APPROACHING.minAgeMonths
  ) {
    status = 'Approaching';
    harvestWindow = 'In 10–21 Days';
    if (isHighRatioWatch) {
      recommendation = `Ratio high - watch for inversion (T/B ratio ${maturityRatio} is between 1.05 and 1.08). Re-sample stalk juice closely and prepare harvest dispatch.`;
      needsAttention = 'Ratio high - watch for inversion';
    } else {
      recommendation =
        'Bottom stalk has accumulated high sucrose while top internodes are still ripening. Withhold irrigation and re-sample in 7–10 days.';
    }
  } else if (isHighRatioWatch) {
    recommendation = `Ratio high - watch for inversion (T/B ratio ${maturityRatio} is between 1.05 and 1.08). Verify stalk juice reading before scheduling harvest.`;
    harvestWindow = 'Re-sample in 5–7 Days';
    needsAttention = 'Ratio high - watch for inversion';
  }

  return {
    ...lot,
    topBrix,
    bottomBrix,
    cropAgeMonths,
    expectedTcHa,
    hasBrixSample: true,
    isUnverifiedDefault,
    needsAttention,
    avgBrix,
    brixDelta,
    maturityRatio,
    brixScore,
    ratioScore,
    ageScore,
    readinessScore,
    estimatedLkgTc,
    estimatedTons,
    totalSugarBagsLkg,
    planterShareBags,
    millShareBags,
    estimatedTruckLoads,
    apparentPurity,
    recommendation,
    harvestWindow,
    status,
    statusDisplay: status,
  };
}

export function calculatePolygonAreaHa(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return 0;
  const earthRadius = 6378137;
  let areaSqMeters = 0;

  for (let i = 0; i < coords.length; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[(i + 1) % coords.length];
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dLambda = ((lng2 - lng1) * Math.PI) / 180;
    areaSqMeters += dLambda * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  areaSqMeters = Math.abs((areaSqMeters * earthRadius * earthRadius) / 2.0);
  const hectares = areaSqMeters / 10000;
  return Number(Math.max(0.1, hectares).toFixed(2));
}

export function getStatusStyles(status) {
  switch (status) {
    case 'OK to Harvest':
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        bar: 'bg-emerald-600',
        polygonFill: '#10b981',
        polygonStroke: '#047857',
      };
    case 'Approaching':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        polygonFill: '#f59e0b',
        polygonStroke: '#b45309',
      };
    case 'Over-mature Risk':
      return {
        badge: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
        bar: 'bg-rose-600',
        polygonFill: '#f43f5e',
        polygonStroke: '#be123c',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-400',
        bar: 'bg-slate-500',
        polygonFill: '#94a3b8',
        polygonStroke: '#475569',
      };
  }
}
