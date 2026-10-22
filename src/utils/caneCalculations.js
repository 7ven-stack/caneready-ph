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

export function evaluateLotMetrics(lot) {
  const topBrix = Number(lot.topBrix) || 0;
  const bottomBrix = Number(lot.bottomBrix) || 0;
  const avgBrix = Number(((topBrix + bottomBrix) / 2).toFixed(1));
  const brixDelta = Number((topBrix - bottomBrix).toFixed(1));
  const maturityRatio =
    bottomBrix > 0 ? Number((topBrix / bottomBrix).toFixed(2)) : 0;

  const { weights, age, brix, ratio, yield: yieldCfg } = READINESS_CONFIG;

  const ageScore = Math.round(
    Math.min(100, Math.max(0, ((lot.cropAgeMonths - age.minMonths) / age.spanMonths) * 100))
  );
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
  const estimatedTons = Math.round(
    Number(lot.areaHa) * Number(lot.expectedTcHa || yieldCfg.defaultTcHa)
  );
  const totalSugarBagsLkg = Math.round(estimatedTons * estimatedLkgTc);
  const planterShareBags = Math.round(totalSugarBagsLkg * yieldCfg.planterShare);
  const millShareBags = totalSugarBagsLkg - planterShareBags;
  const estimatedTruckLoads = Math.max(
    1,
    Math.ceil(estimatedTons / yieldCfg.truckCapacityTons)
  );
  const apparentPurity = Number(
    Math.min(92.5, Math.max(72.0, 74 + (avgBrix - 15) * 2.1 - ratioDiff * 12)).toFixed(1)
  );

  let status = 'Immature';
  let recommendation =
    'Continue vegetative growth and monitor foliar nutrition. Schedule first refractometer check at 9.5 months.';
  let harvestWindow = 'In 60–90 Days';

  if (
    lot.cropAgeMonths > STATUS_GATES.OVER_MATURE.maxAgeMonths ||
    maturityRatio > STATUS_GATES.OVER_MATURE.maxRatio
  ) {
    status = 'Over-mature Risk';
    recommendation =
      'URGENT: Top Brix exceeds Bottom Brix (Ratio > 1.08), indicating sucrose inversion risk. Issue priority cutting permit immediately.';
    harvestWindow = 'Immediate (Within 3–5 Days)';
  } else if (
    avgBrix >= STATUS_GATES.OK_TO_HARVEST.minAvgBrix &&
    maturityRatio >= STATUS_GATES.OK_TO_HARVEST.minRatio &&
    maturityRatio <= STATUS_GATES.OK_TO_HARVEST.maxRatio &&
    lot.cropAgeMonths >= STATUS_GATES.OK_TO_HARVEST.minAgeMonths
  ) {
    status = 'OK to Harvest';
    recommendation =
      'Stalk sucrose concentration is uniform from bottom to top internodes. Optimal maturity reached for peak LKg/TC recovery.';
    harvestWindow = 'Optimal Now (Next 7–14 Days)';
  } else if (
    avgBrix >= STATUS_GATES.APPROACHING.minAvgBrix &&
    maturityRatio >= STATUS_GATES.APPROACHING.minRatio &&
    lot.cropAgeMonths >= STATUS_GATES.APPROACHING.minAgeMonths
  ) {
    status = 'Approaching';
    recommendation =
      'Bottom stalk has accumulated high sucrose while top internodes are still ripening. Withhold irrigation and re-sample in 7–10 days.';
    harvestWindow = 'In 10–21 Days';
  }

  return {
    ...lot,
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
