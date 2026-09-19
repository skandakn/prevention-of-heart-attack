/**
 * High-Speed Deterministic Clinical Symptom & Cardiac Urgency Extractor
 * 
 * Provides instant (<1ms) synchronous extraction of cardiac symptoms, pain severity,
 * onset duration, and clinical risk levels. Runs locally on the client for immediate
 * UI ticker badge response, and on the server to guarantee structured clinical data
 * even if LLM extraction experiences network latency or rate limiting.
 */

export interface ExtractedFinding {
  value: any;
  status: 'explicit' | 'inferred' | 'unknown';
  confidence: number;
  source: 'caller';
  rawQuote?: string;
  updatedAt: number;
}

export interface DeterministicExtractionResult {
  primary_symptom?: ExtractedFinding;
  pain_severity_scale?: ExtractedFinding;
  symptom_onset_minutes?: ExtractedFinding;
  patient_age?: ExtractedFinding;
  prior_cardiac_history?: ExtractedFinding;
  urgency_level?: ExtractedFinding;
  first_aid_initiated?: ExtractedFinding;
  emergency_dispatch_requested?: ExtractedFinding;
}

export function extractCardiacFindings(
  text: string,
  existingState: Record<string, any> = {}
): DeterministicExtractionResult {
  const clean = (text || '').trim();
  if (!clean) return {};

  const lower = clean.toLowerCase();
  const findings: DeterministicExtractionResult = {};
  const now = Date.now();

  // 1. Primary Symptom Extraction
  let symptom: string | null = null;
  let symptomQuote: string | null = null;

  if (
    /\b(heart pain|chest pain|chest pressure|chest discomfort|chest tightness|crushing pain|heavy chest|angina|anginal|heart ache|pain in (?:my )?heart|hurts in (?:my )?chest|tightness in (?:my )?chest)\b/i.test(
      lower
    )
  ) {
    symptom = 'chest_pressure_or_pain';
    const match = lower.match(
      /\b(heart pain|chest pain|chest pressure|chest discomfort|chest tightness|crushing pain|heavy chest|angina|heart ache|pain in (?:my )?heart|hurts in (?:my )?chest)\b/i
    );
    symptomQuote = match ? match[0] : 'chest pain';
  } else if (
    /\b(radiat(?:ing|es)|left arm|jaw pain|neck pain|shoulder pain|radiating to (?:left )?arm)\b/i.test(
      lower
    )
  ) {
    symptom = 'radiating_left_arm_jaw';
    const match = lower.match(
      /\b(radiat(?:ing|es)|left arm|jaw pain|neck pain|shoulder pain|radiating to (?:left )?arm)\b/i
    );
    symptomQuote = match ? match[0] : 'radiating pain';
  } else if (
    /\b(shortness of breath|short of breath|breathless(?:ness)?|can'?t breathe|hard to breathe|difficult to breathe|gasping|winded)\b/i.test(
      lower
    )
  ) {
    symptom = 'shortness_of_breath';
    const match = lower.match(
      /\b(shortness of breath|short of breath|breathless(?:ness)?|can'?t breathe|hard to breathe)\b/i
    );
    symptomQuote = match ? match[0] : 'shortness of breath';
  } else if (
    /\b(cold sweat|sweating|diaphoresis|clammy|drenched in sweat|profuse sweat)\b/i.test(lower)
  ) {
    symptom = 'cold_sweat_diaphoresis';
    const match = lower.match(
      /\b(cold sweat|sweating|diaphoresis|clammy|drenched in sweat)\b/i
    );
    symptomQuote = match ? match[0] : 'cold sweat';
  } else if (
    /\b(dizzy|dizziness|lightheaded(?:ness)?|faint(?:ing)?|passed out|black(?:ing)? out|presyncope)\b/i.test(
      lower
    )
  ) {
    symptom = 'dizziness_or_presyncope';
    const match = lower.match(
      /\b(dizzy|dizziness|lightheaded(?:ness)?|faint(?:ing)?|passed out)\b/i
    );
    symptomQuote = match ? match[0] : 'dizziness';
  } else if (
    /\b(palpitation(?:s)?|racing heart|fluttering|irregular heart(?:beat)?|rapid pulse)\b/i.test(
      lower
    )
  ) {
    symptom = 'palpitations_or_flutter';
    const match = lower.match(
      /\b(palpitation(?:s)?|racing heart|fluttering|irregular heart(?:beat)?)\b/i
    );
    symptomQuote = match ? match[0] : 'palpitations';
  } else if (
    /\b(nausea|vomit(?:ing)?|indigestion|heartburn|acid reflux|upset stomach)\b/i.test(lower)
  ) {
    symptom = 'nausea_or_indigestion';
    const match = lower.match(/\b(nausea|vomit(?:ing)?|indigestion|heartburn)\b/i);
    symptomQuote = match ? match[0] : 'nausea';
  } else if (/\b(isi|ischemic stress|stress index)\b/i.test(lower)) {
    symptom = 'elevated_isi_warning';
    symptomQuote = 'elevated ischemic stress index';
  }

  if (symptom) {
    findings.primary_symptom = {
      value: symptom,
      status: 'explicit',
      confidence: 1.0,
      source: 'caller',
      rawQuote: symptomQuote || undefined,
      updatedAt: now,
    };
  }

  // 2. Pain Severity Scale (1-10)
  const painScaleMatch =
    lower.match(
      /\b(?:pain|severity|scale|level)?\s*(?:is|at|of)?\s*(\d{1,2})\s*(?:out of 10|\/10|on 10|scale of 10)\b/i
    ) ||
    lower.match(/\b(?:pain is|severity is|level is|pain level|rated?)\s*(\d{1,2})\b/i);

  if (painScaleMatch) {
    const num = parseInt(painScaleMatch[1], 10);
    if (num >= 1 && num <= 10) {
      findings.pain_severity_scale = {
        value: num,
        status: 'explicit',
        confidence: 0.95,
        source: 'caller',
        rawQuote: painScaleMatch[0],
        updatedAt: now,
      };
    }
  }

  // 3. Symptom Onset Duration (Minutes)
  const onsetMinsMatch = lower.match(
    /\b(?:for|started|since|about|onset)\s*(\d+)\s*(?:mins?|minutes?)\b/i
  );
  const onsetHoursMatch = lower.match(
    /\b(?:for|started|since|about)\s*(\d+)\s*(?:hours?|hrs?)\b/i
  );

  if (onsetMinsMatch) {
    findings.symptom_onset_minutes = {
      value: parseInt(onsetMinsMatch[1], 10),
      status: 'explicit',
      confidence: 0.95,
      source: 'caller',
      rawQuote: onsetMinsMatch[0],
      updatedAt: now,
    };
  } else if (onsetHoursMatch) {
    findings.symptom_onset_minutes = {
      value: parseInt(onsetHoursMatch[1], 10) * 60,
      status: 'explicit',
      confidence: 0.95,
      source: 'caller',
      rawQuote: onsetHoursMatch[0],
      updatedAt: now,
    };
  }

  // 4. Patient Age
  const ageMatch = lower.match(
    /\b(?:i am|age|im|aged?)\s*(\d{1,3})\s*(?:years? old|yrs? old|y\/o)?\b/i
  );
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (age >= 10 && age <= 115) {
      findings.patient_age = {
        value: age,
        status: 'explicit',
        confidence: 0.9,
        source: 'caller',
        rawQuote: ageMatch[0],
        updatedAt: now,
      };
    }
  }

  // 5. Prior Medical / Cardiac History
  const historyMatches: string[] = [];
  if (/\b(heart attack|myocardial infarction|previous mi)\b/i.test(lower))
    historyMatches.push('Previous Heart Attack');
  if (/\b(stent|angioplasty|pci)\b/i.test(lower)) historyMatches.push('Stent / PCI');
  if (/\b(bypass|cabg)\b/i.test(lower)) historyMatches.push('Coronary Bypass');
  if (/\b(hypertension|high blood pressure|bp)\b/i.test(lower))
    historyMatches.push('Hypertension');
  if (/\b(diabetes|diabetic)\b/i.test(lower)) historyMatches.push('Diabetes');
  if (/\b(smoker|smoking)\b/i.test(lower)) historyMatches.push('Smoking');

  if (historyMatches.length > 0) {
    findings.prior_cardiac_history = {
      value: historyMatches.join(', '),
      status: 'explicit',
      confidence: 0.9,
      source: 'caller',
      rawQuote: historyMatches.join(', '),
      updatedAt: now,
    };
  }

  // 6. Urgency Assessment
  const activeSymptom =
    findings.primary_symptom?.value || existingState.primary_symptom?.value;
  const activePain =
    findings.pain_severity_scale?.value || existingState.pain_severity_scale?.value;

  if (
    activeSymptom === 'chest_pressure_or_pain' ||
    activeSymptom === 'radiating_left_arm_jaw' ||
    activeSymptom === 'cold_sweat_diaphoresis' ||
    (typeof activePain === 'number' && activePain >= 7)
  ) {
    findings.urgency_level = {
      value: 'CRITICAL_EMERGENCY',
      status: 'explicit',
      confidence: 1.0,
      source: 'caller',
      updatedAt: now,
    };
  } else if (
    activeSymptom === 'shortness_of_breath' ||
    activeSymptom === 'palpitations_or_flutter' ||
    (typeof activePain === 'number' && activePain >= 4)
  ) {
    findings.urgency_level = {
      value: 'HIGH_RISK_URGENT',
      status: 'explicit',
      confidence: 0.9,
      source: 'caller',
      updatedAt: now,
    };
  } else if (activeSymptom) {
    findings.urgency_level = {
      value: 'MODERATE_MONITOR',
      status: 'inferred',
      confidence: 0.8,
      source: 'caller',
      updatedAt: now,
    };
  }

  // 7. First aid / emergency dispatch detection
  if (/\b(aspirin|sit upright|knees bent)\b/i.test(lower)) {
    findings.first_aid_initiated = {
      value: true,
      status: 'explicit',
      confidence: 0.9,
      source: 'caller',
      updatedAt: now,
    };
  }
  if (/\b(ambulance|dispatch|call 911|call 108|paramedic)\b/i.test(lower)) {
    findings.emergency_dispatch_requested = {
      value: true,
      status: 'explicit',
      confidence: 0.9,
      source: 'caller',
      updatedAt: now,
    };
  }

  return findings;
}
