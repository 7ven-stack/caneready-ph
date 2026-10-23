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

export const STATUS_PRIORITY = Object.freeze({
  'Over-mature Risk': 1,
  'OK to Harvest': 2,
  Approaching: 3,
  Immature: 4,
});

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
  const top = Number(lot.topBrix);
  const bot = Number(lot.bottomBrix);
  return top === 20.0 && bot === 20.5 && lot.sampleVerified !== true;
}

// Compute Brix trend (sparkline points, weekly delta, and daily slope) from sample history
export function computeBrixTrend(lot) {
  const history = Array.isArray(lot?.brixHistory) ? lot.brixHistory : [];
  if (history.length < 2) {
    const singleAvg = hasValidBrixSample(lot)
      ? Number(((Number(lot.topBrix) + Number(lot.bottomBrix)) / 2).toFixed(1))
      : null;
    return {
      sampleCount: hasValidBrixSample(lot) ? 1 : 0,
      points: singleAvg !== null ? [singleAvg] : [],
      weeklyDelta: null,
      slopePerDay: null,
    };
  }

  const sorted = [...history]
    .filter((s) => s && Number.isFinite(Number(s.topBrix)) && Number.isFinite(Number(s.bottomBrix)))
    .sort((a, b) => String(a.sampledAt || '').localeCompare(String(b.sampledAt || '')));

  if (sorted.length < 2) {
    return {
      sampleCount: sorted.length,
      points: sorted.map((s) => Number(((Number(s.topBrix) + Number(s.bottomBrix)) / 2).toFixed(1))),
      weeklyDelta: null,
      slopePerDay: null,
    };
  }

  const points = sorted.map((s) =>
    Number(((Number(s.topBrix) + Number(s.bottomBrix)) / 2).toFixed(1))
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstAvg = points[0];
  const lastAvg = points[points.length - 1];

  const d1 = new Date((first.sampledAt || '2026-10-01') + 'T00:00:00');
  const d2 = new Date((last.sampledAt || '2026-10-15') + 'T00:00:00');
  const daysSpan = Math.max(1, (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

  const slopePerDay = (lastAvg - firstAvg) / daysSpan;
  const weeklyDelta = Number((slopePerDay * 7).toFixed(2));

  return {
    sampleCount: sorted.length,
    points,
    weeklyDelta,
    slopePerDay,
  };
}

// 2c. Build "Why this status?" gate checklist
export function buildGateChecklist({
  hasSample,
  avgBrix,
  maturityRatio,
  cropAgeMonths,
}) {
  const okGates = STATUS_GATES.OK_TO_HARVEST;
  const overGates = STATUS_GATES.OVER_MATURE;

  // 1. Avg Brix Gate
  let brixGate;
  if (!hasSample) {
    brixGate = {
      key: 'brix',
      label: 'Avg Brix',
      passed: false,
      summary: `Avg Brix: No sample yet vs ${okGates.minAvgBrix}° — needs first sample`,
    };
  } else if (avgBrix >= okGates.minAvgBrix) {
    brixGate = {
      key: 'brix',
      label: 'Avg Brix',
      passed: true,
      summary: `Avg Brix ${avgBrix}° vs ${okGates.minAvgBrix}° — pass`,
    };
  } else {
    const deficit = Number((okGates.minAvgBrix - avgBrix).toFixed(1));
    brixGate = {
      key: 'brix',
      label: 'Avg Brix',
      passed: false,
      summary: `Avg Brix ${avgBrix}° vs ${okGates.minAvgBrix}° — needs +${deficit}° Bx`,
    };
  }

  // 2. Maturity Ratio Gate
  let ratioGate;
  if (!hasSample) {
    ratioGate = {
      key: 'ratio',
      label: 'T/B Ratio',
      passed: false,
      summary: `Ratio: No sample yet vs ${okGates.minRatio}–${okGates.maxRatio} — needs first sample`,
    };
  } else if (maturityRatio > overGates.maxRatio) {
    ratioGate = {
      key: 'ratio',
      label: 'T/B Ratio',
      passed: false,
      isOverMature: true,
      summary: `Ratio ${maturityRatio} vs ${overGates.maxRatio} max — over-mature inversion risk`,
    };
  } else if (maturityRatio >= okGates.minRatio && maturityRatio <= okGates.maxRatio) {
    ratioGate = {
      key: 'ratio',
      label: 'T/B Ratio',
      passed: true,
      summary: `Ratio ${maturityRatio} in ${okGates.minRatio}–${okGates.maxRatio} — pass`,
    };
  } else if (maturityRatio > okGates.maxRatio) {
    ratioGate = {
      key: 'ratio',
      label: 'T/B Ratio',
      passed: false,
      summary: `Ratio ${maturityRatio} in ${okGates.minRatio}–${okGates.maxRatio} — ratio high (watch for inversion)`,
    };
  } else {
    const gap = Number((okGates.minRatio - maturityRatio).toFixed(2));
    ratioGate = {
      key: 'ratio',
      label: 'T/B Ratio',
      passed: false,
      summary: `Ratio ${maturityRatio} in ${okGates.minRatio}–${okGates.maxRatio} — needs +${gap} T/B`,
    };
  }

  // 3. Crop Age Gate
  let ageGate;
  if (cropAgeMonths > overGates.maxAgeMonths) {
    const overBy = Number((cropAgeMonths - overGates.maxAgeMonths).toFixed(1));
    ageGate = {
      key: 'age',
      label: 'Crop Age',
      passed: false,
      isOverMature: true,
      summary: `Age ${cropAgeMonths} vs ${overGates.maxAgeMonths} mos max — over age by ${overBy} mos`,
    };
  } else if (cropAgeMonths >= okGates.minAgeMonths) {
    ageGate = {
      key: 'age',
      label: 'Crop Age',
      passed: true,
      summary: `Age ${cropAgeMonths} vs ${okGates.minAgeMonths} mos — pass`,
    };
  } else {
    const remMos = Number((okGates.minAgeMonths - cropAgeMonths).toFixed(1));
    ageGate = {
      key: 'age',
      label: 'Crop Age',
      passed: false,
      summary: `Age ${cropAgeMonths} vs ${okGates.minAgeMonths} mos — needs ${remMos} more months`,
    };
  }

  return [brixGate, ratioGate, ageGate];
}

// 2d. Estimated ready date = latest of unmet gates (capped at 12 weeks = 84 days)
export function computeEstimatedReady({
  status,
  hasSample,
  avgBrix,
  maturityRatio,
  cropAgeMonths,
  brixTrend,
  now = new Date(),
}) {
  const okGates = STATUS_GATES.OK_TO_HARVEST;
  const addDaysIso = (days) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };

  if (status === 'Over-mature Risk') {
    return {
      dateIso: addDaysIso(0),
      daysRemaining: 0,
      label: 'Cut immediately',
      reason: 'Lot has crossed the Over-mature threshold',
    };
  }

  if (status === 'OK to Harvest') {
    return {
      dateIso: addDaysIso(0),
      daysRemaining: 0,
      label: 'Ready now',
      reason: 'All harvest readiness gates met',
    };
  }

  const ageUnmet = cropAgeMonths < okGates.minAgeMonths;
  const ageDays = ageUnmet
    ? Math.ceil((okGates.minAgeMonths - cropAgeMonths) * 30.4)
    : 0;

  if (!hasSample) {
    if (ageDays > 84) {
      return {
        dateIso: null,
        daysRemaining: ageDays,
        label: 'Not within 12 weeks',
        reason: `Age gate needs ${ageDays}d (~${(ageDays / 7).toFixed(0)} wks) + first Brix sample`,
      };
    }
    return {
      dateIso: null,
      daysRemaining: null,
      label: 'Needs first sample',
      reason: ageUnmet
        ? `Age gate in ${ageDays}d (${addDaysIso(ageDays)}); log 1st Brix sample to project sucrose`
        : 'Age gate met; log first Brix sample to evaluate readiness',
    };
  }

  const brixUnmet = avgBrix < okGates.minAvgBrix;
  const ratioUnmet =
    maturityRatio < okGates.minRatio || maturityRatio > okGates.maxRatio;

  let brixDays = 0;
  let brixBlocker = null;
  if (brixUnmet) {
    if (!brixTrend || brixTrend.sampleCount < 2) {
      brixBlocker = 'Need 2+ samples';
    } else if (!brixTrend.slopePerDay || brixTrend.slopePerDay <= 0.01) {
      brixBlocker = 'Depends on next sample (flat Brix slope)';
    } else {
      brixDays = Math.ceil((okGates.minAvgBrix - avgBrix) / brixTrend.slopePerDay);
    }
  }

  const maxKnownDays = Math.max(ageDays, brixDays);

  if (maxKnownDays > 84) {
    return {
      dateIso: null,
      daysRemaining: maxKnownDays,
      label: 'Not within 12 weeks',
      reason: `Projected readiness exceeds 12 weeks (${maxKnownDays} days)`,
    };
  }

  if (brixBlocker) {
    return {
      dateIso: ageDays > 0 ? addDaysIso(ageDays) : null,
      daysRemaining: ageDays > 0 ? ageDays : null,
      label: brixBlocker,
      reason:
        ageDays > 0
          ? `Age gate ready ${addDaysIso(ageDays)} (${ageDays}d); Brix projection requires 2+ samples`
          : 'Log a second Brix sample to project sucrose readiness slope',
    };
  }

  if (ratioUnmet && maxKnownDays === 0) {
    return {
      dateIso: null,
      daysRemaining: null,
      label: 'Depends on next sample',
      reason: `T/B ratio (${maturityRatio}) outside ${okGates.minRatio}–${okGates.maxRatio}; depends on next sample`,
    };
  }

  const targetDate = addDaysIso(maxKnownDays);
  return {
    dateIso: targetDate,
    daysRemaining: maxKnownDays,
    label: `${targetDate} (${maxKnownDays}d)`,
    reason: ratioUnmet
      ? `Latest gate in ${maxKnownDays}d; ratio (${maturityRatio}) also depends on next sample`
      : `Projected from latest unmet gate (${maxKnownDays} days)`,
  };
}

export function evaluateLotMetrics(lot, now = new Date()) {
  const { weights, age, brix, ratio, yield: yieldCfg } = READINESS_CONFIG;

  const cropAgeMonths = computeCropAgeMonths(lot.plantingDate, lot.cropAgeMonths, now);
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
  const brixTrend = computeBrixTrend(lot);

  if (!hasSample) {
    const isOverAge = cropAgeMonths > STATUS_GATES.OVER_MATURE.maxAgeMonths;
    const status = isOverAge ? 'Over-mature Risk' : 'Immature';
    const statusDisplay = isOverAge ? 'Over-mature Risk' : 'No sample yet';
    const recommendation = isOverAge
      ? `URGENT: Crop age (${cropAgeMonths} mos) exceeds the 13.5-month maximum threshold and has no refractometer sample on record. Sample and schedule priority harvest immediately.`
      : 'Needs first sample: No refractometer Brix reading has been logged for this lot yet. Collect top and bottom stalk juice samples to evaluate maturity.';

    const gateChecklist = buildGateChecklist({
      hasSample: false,
      avgBrix: null,
      maturityRatio: null,
      cropAgeMonths,
    });

    const estimatedReady = computeEstimatedReady({
      status,
      hasSample: false,
      avgBrix: null,
      maturityRatio: null,
      cropAgeMonths,
      brixTrend,
      now,
    });

    const breakdown = {
      brix: {
        score: null,
        weight: 45,
        weighted: null,
        label: 'No sample yet',
      },
      ratio: {
        score: null,
        weight: 35,
        weighted: null,
        label: 'No sample yet',
      },
      age: {
        score: ageScore,
        weight: 20,
        weighted: Math.round(ageScore * weights.age),
        label: `${cropAgeMonths} mos`,
      },
      total: null,
    };

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
      breakdown,
      gateChecklist,
      brixTrend,
      estimatedReady,
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
      statusPriority: STATUS_PRIORITY[status] ?? 4,
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

  const breakdown = {
    brix: {
      score: brixScore,
      weight: 45,
      weighted: Math.round(brixScore * weights.brix),
      label: `Avg ${avgBrix}°`,
    },
    ratio: {
      score: ratioScore,
      weight: 35,
      weighted: Math.round(ratioScore * weights.ratio),
      label: `${maturityRatio} T/B`,
    },
    age: {
      score: ageScore,
      weight: 20,
      weighted: Math.round(ageScore * weights.age),
      label: `${cropAgeMonths} mos`,
    },
    total: readinessScore,
  };

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

  const gateChecklist = buildGateChecklist({
    hasSample: true,
    avgBrix,
    maturityRatio,
    cropAgeMonths,
  });

  const estimatedReady = computeEstimatedReady({
    status,
    hasSample: true,
    avgBrix,
    maturityRatio,
    cropAgeMonths,
    brixTrend,
    now,
  });

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
    breakdown,
    gateChecklist,
    brixTrend,
    estimatedReady,
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
    statusPriority: STATUS_PRIORITY[status] ?? 4,
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
