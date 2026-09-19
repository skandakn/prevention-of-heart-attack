/**
 * Advanced Acoustic Echo Cancellation & Assistant Reflection Filter
 * 
 * Prevents microphone audio feedback loops (where ElevenLabs assistant voice
 * played through laptop speakers is captured by the microphone and transcribed
 * back as patient speech).
 */

export interface EchoFilterResult {
  isFullEcho: boolean;
  isPartialEcho: boolean;
  cleanedText: string;
  matchedAssistantText?: string;
}

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because',
  'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'can', 'will', 'just', 'should', 'now'
]);

/**
 * Normalizes text for acoustic and phonetic comparison:
 * - Lowercases and strips non-alphanumeric chars
 * - Normalizes common STT phonetic mis-transcriptions (e.g. "beta head" -> "beatahead")
 * - Expands contractions
 */
export function normalizeAcoustic(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    // Phonetic corrections for common browser STT interpretations of ElevenLabs audio
    .replace(/\bbeta\s+head\b/g, 'beatahead')
    .replace(/\bbeat\s+ahead\b/g, 'beatahead')
    .replace(/\bi\s+m\b/g, 'i am')
    .replace(/\bit\s+s\b/g, 'it is')
    .replace(/\bdon\s+t\b/g, 'do not')
    .replace(/\bcan\s+t\b/g, 'can not')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Known assistant signature phrases that a distressed cardiac caller would NEVER utter.
 */
const KNOWN_ASSISTANT_SIGNATURES = [
  'beatahead cardiac care helpline',
  'cardiac care helpline',
  'are you or someone near you experiencing',
  'experiencing chest discomfort breathlessness or unusual heart symptoms',
  'chest discomfort breathlessness or unusual heart symptoms',
  'sit upright with your knees bent',
  'stay as calm as possible and do not attempt to drive',
  'do not attempt to drive yourself',
  'known allergies to aspirin',
  'could you please tell me if you are feeling any chest pain',
  'how can i help you today',
  'how may i assist you',
  'thank you for calling our helpline',
];

/**
 * Strips echoed assistant speech from caller utterance.
 */
export function filterAcousticEcho(
  callerText: string,
  recentAssistantTexts: string[] = []
): EchoFilterResult {
  const cleanCaller = (callerText || '').trim();
  if (!cleanCaller) {
    return { isFullEcho: true, isPartialEcho: false, cleanedText: '' };
  }

  const normCaller = normalizeAcoustic(cleanCaller);
  if (!normCaller || normCaller.length < 2) {
    return { isFullEcho: true, isPartialEcho: false, cleanedText: '' };
  }

  const callerWords = normCaller.split(' ').filter(Boolean);
  const substantiveCallerWords = callerWords.filter((w) => !STOP_WORDS.has(w));

  // 1. Check against recent assistant utterances FIRST (exact, near-exact, or high-overlap)
  for (const assistantText of recentAssistantTexts) {
    if (!assistantText) continue;
    const normAssistant = normalizeAcoustic(assistantText);
    if (!normAssistant) continue;

    // Exact match after normalization
    if (normCaller === normAssistant) {
      return {
        isFullEcho: true,
        isPartialEcho: false,
        cleanedText: '',
        matchedAssistantText: assistantText,
      };
    }

    const assistantWords = normAssistant.split(' ').filter(Boolean);

    // If caller text is long (> 6 words) and assistant text completely contains it
    if (callerWords.length >= 7 && normAssistant.includes(normCaller)) {
      return {
        isFullEcho: true,
        isPartialEcho: false,
        cleanedText: '',
        matchedAssistantText: assistantText,
      };
    }

    // Substantive word overlap: only compare non-stop words
    const assistantSubstantiveSet = new Set(
      assistantWords.filter((w) => !STOP_WORDS.has(w))
    );

    let substantiveOverlap = 0;
    for (const sw of substantiveCallerWords) {
      if (assistantSubstantiveSet.has(sw)) {
        substantiveOverlap++;
      }
    }

    // If caller has >= 5 substantive words and >= 80% are in assistant speech
    if (
      substantiveCallerWords.length >= 5 &&
      substantiveOverlap / substantiveCallerWords.length >= 0.8 &&
      callerWords.length >= 8
    ) {
      return {
        isFullEcho: true,
        isPartialEcho: false,
        cleanedText: '',
        matchedAssistantText: assistantText,
      };
    }

    // Consecutive phrase / n-gram match (at least 5 consecutive words from assistant)
    for (let i = 0; i <= callerWords.length - 5; i++) {
      const fiveGram = callerWords.slice(i, i + 5).join(' ');
      if (normAssistant.includes(fiveGram)) {
        // Expand match
        let len = 5;
        while (
          i + len <= callerWords.length &&
          normAssistant.includes(callerWords.slice(i, i + len).join(' '))
        ) {
          len++;
        }
        len--;

        // If matched phrase covers almost the entire utterance
        if (len >= callerWords.length - 1) {
          return {
            isFullEcho: true,
            isPartialEcho: false,
            cleanedText: '',
            matchedAssistantText: assistantText,
          };
        } else if (i === 0) {
          // Matched at beginning of utterance (echo prefix)
          const originalWords = cleanCaller.split(/\s+/);
          const remainderWords = originalWords.slice(len);
          const remainder = remainderWords.join(' ').replace(/^[.,?!:;\s]+/, '').trim();

          const remSubstantive = remainder
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => Boolean(w) && !STOP_WORDS.has(w));

          if (remSubstantive.length >= 2) {
            return {
              isFullEcho: false,
              isPartialEcho: true,
              cleanedText: remainder,
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
  }

  // 2. Check known assistant signature phrases
  for (const sig of KNOWN_ASSISTANT_SIGNATURES) {
    if (normCaller.includes(sig)) {
      const stripped = normCaller.replace(sig, '').trim();
      const substantiveWords = stripped
        .split(' ')
        .filter((w) => Boolean(w) && !STOP_WORDS.has(w));

      if (substantiveWords.length < 2) {
        return {
          isFullEcho: true,
          isPartialEcho: false,
          cleanedText: '',
          matchedAssistantText: sig,
        };
      } else {
        // Find phonetic match in original string
        const cleaned = cleanCaller
          .replace(/hello,?\s*this\s*is\s*the\s*(?:beatahead|beta\s*head)?\s*cardiac\s*care\s*helpline\.?/i, '')
          .replace(/are\s*you\s*or\s*someone\s*near\s*you\s*experiencing[.,?!]*/i, '')
          .replace(/how\s*can\s*i\s*help\s*you\s*(?:today)?[.,?!]*/i, '')
          .trim();

        if (cleaned.length >= 3) {
          return {
            isFullEcho: false,
            isPartialEcho: true,
            cleanedText: cleaned.replace(/^[.,?!:;\s]+/, '').trim(),
            matchedAssistantText: sig,
          };
        } else {
          return {
            isFullEcho: true,
            isPartialEcho: false,
            cleanedText: '',
            matchedAssistantText: sig,
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
