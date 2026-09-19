/**
 * Acoustic Echo Cancellation & Reflection Filter
 * 
 * Prevents microphone audio feedback (where the assistant's voice from laptop speakers
 * is picked up by the microphone and transcribed back as caller speech).
 */

export interface EchoFilterResult {
  isFullEcho: boolean;
  isPartialEcho: boolean;
  cleanedText: string;
  matchedAssistantText?: string;
}

/**
 * Normalizes text for acoustic comparison by converting to lowercase,
 * replacing punctuation with spaces, and collapsing whitespace.
 */
export function normalizeAcoustic(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips echoed assistant speech from caller utterance.
 * Handles:
 * 1. Full echo: microphone captured assistant speech verbatim or with minor STT variations.
 * 2. Prefix echo: microphone captured assistant speech followed by caller's actual query.
 * 3. Substring echo: assistant utterance was caught partially by the microphone.
 */
export function filterAcousticEcho(
  callerText: string,
  recentAssistantTexts: string[]
): EchoFilterResult {
  const cleanCaller = (callerText || '').trim();
  if (!cleanCaller) {
    return { isFullEcho: true, isPartialEcho: false, cleanedText: '' };
  }

  const normCaller = normalizeAcoustic(cleanCaller);
  const callerWords = normCaller.split(' ').filter(Boolean);

  // Filter out inverted role phrases / assistant speech hallucinations
  // A caller contacting a customer care helpline never says "how can I help you" or "how may I assist you"
  const assistantPromptPhrases = [
    'how can i help you today',
    'how may i assist you today',
    'how can i assist you today',
    'how can i help you',
    'how may i assist you',
    'how can i assist',
    'thank you for calling our helpline',
    'thank you for calling',
  ];

  for (const phrase of assistantPromptPhrases) {
    if (normCaller === phrase || normCaller.endsWith(phrase)) {
      const stripped = normCaller.replace(phrase, '').trim();
      // If nothing remains or just conversational filler like "it is nice to meet you"
      if (!stripped || stripped === 'it is nice to meet you' || stripped === 'nice to meet you' || stripped.length < 5) {
        return {
          isFullEcho: true,
          isPartialEcho: false,
          cleanedText: '',
          matchedAssistantText: phrase,
        };
      }
    }
  }

  for (const assistantText of recentAssistantTexts) {
    if (!assistantText) continue;
    const normAssistant = normalizeAcoustic(assistantText);
    if (!normAssistant) continue;

    const assistantWords = normAssistant.split(' ').filter(Boolean);

    // 1. Exact or near-exact full echo
    if (normCaller === normAssistant) {
      return {
        isFullEcho: true,
        isPartialEcho: false,
        cleanedText: '',
        matchedAssistantText: assistantText,
      };
    }

    // Assistant text includes caller speech entirely (caller speech was an echo snippet of assistant speech)
    if (callerWords.length >= 3 && normAssistant.includes(normCaller)) {
      return {
        isFullEcho: true,
        isPartialEcho: false,
        cleanedText: '',
        matchedAssistantText: assistantText,
      };
    }

    // 2. Prefix echo check:
    // Check if the beginning of callerWords matches assistantWords
    let matchCount = 0;
    while (
      matchCount < callerWords.length &&
      matchCount < assistantWords.length &&
      callerWords[matchCount] === assistantWords[matchCount]
    ) {
      matchCount++;
    }

    // Also check with 1-word skip for dropped or inserted filler words (e.g. "our", "the", "a", punctuation pauses)
    if (matchCount < 4 && callerWords.length >= 4 && assistantWords.length >= 4) {
      let bestMatch = 0;
      let aIdx = 0;
      let cIdx = 0;
      while (cIdx < callerWords.length && aIdx < assistantWords.length) {
        if (callerWords[cIdx] === assistantWords[aIdx]) {
          bestMatch++;
          cIdx++;
          aIdx++;
        } else if (
          cIdx + 1 < callerWords.length &&
          callerWords[cIdx + 1] === assistantWords[aIdx]
        ) {
          cIdx++; // skip 1 caller word
        } else if (
          aIdx + 1 < assistantWords.length &&
          callerWords[cIdx] === assistantWords[aIdx + 1]
        ) {
          aIdx++; // skip 1 assistant word
        } else {
          break;
        }
      }
      if (bestMatch >= 4 && bestMatch > matchCount) {
        matchCount = cIdx;
      }
    }

    // If matching prefix covers >= 4 words AND (>= 50% of assistant words OR >= 5 words)
    const isSignificantEcho =
      matchCount >= 4 &&
      (matchCount >= Math.floor(assistantWords.length * 0.5) || matchCount >= 5);

    if (isSignificantEcho) {
      if (matchCount >= callerWords.length) {
        // Entire caller utterance was echo
        return {
          isFullEcho: true,
          isPartialEcho: false,
          cleanedText: '',
          matchedAssistantText: assistantText,
        };
      } else {
        // Strip the echoed words from original text
        const wordsInOriginal = cleanCaller.split(/\s+/);
        const remainderWords = wordsInOriginal.slice(matchCount);
        const remainderText = remainderWords.join(' ').replace(/^[.,?!:;\s]+/, '').trim();

        if (remainderText.length > 0) {
          return {
            isFullEcho: false,
            isPartialEcho: true,
            cleanedText: remainderText,
            matchedAssistantText: assistantText,
          };
        } else {
          return {
            isFullEcho: true,
            isPartialEcho: false,
            cleanedText: '',
            matchedAssistantText: assistantText,
          };
        }
      }
    }
  }

  return {
    isFullEcho: false,
    isPartialEcho: false,
    cleanedText: cleanCaller,
  };
}
