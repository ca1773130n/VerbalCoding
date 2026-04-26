const DEFAULT_MAX_CHARS = 450;

export function splitForTTS(text, maxChars = DEFAULT_MAX_CHARS) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const limit = Math.max(1, Number(maxChars) || DEFAULT_MAX_CHARS);

  const sentences = normalized.match(/[^.!?。！？…]+[.!?。！？…]*|.+$/gu) || [normalized];
  const chunks = [];

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (sentence.length <= limit) {
      chunks.push(sentence);
    } else {
      chunks.push(...splitLongSentence(sentence, limit));
    }
  }
  return chunks;
}

function splitLongSentence(sentence, limit) {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return splitByLength(sentence, limit);

  const chunks = [];
  let current = '';
  for (const word of words) {
    if (word.length > limit) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitByLength(word, limit));
    } else if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= limit) {
      current += ' ' + word;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitByLength(text, limit) {
  const chunks = [];
  for (let i = 0; i < text.length; i += limit) chunks.push(text.slice(i, i + limit));
  return chunks;
}
