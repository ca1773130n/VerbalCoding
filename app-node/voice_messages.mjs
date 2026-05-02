function isEnglish(language = 'ko') {
  return /^en/i.test(String(language || ''));
}

export function formatSttStartMessage(language = 'ko') {
  return isEnglish(language)
    ? '🎧 Transcribing your speech now.'
    : '🎧 음성을 텍스트로 변환하는 중이야.';
}

export function formatSttResultMessage(language = 'ko', userId, text) {
  return isEnglish(language)
    ? `📝 STT result <@${userId}>: ${text}`
    : `📝 STT 결과 <@${userId}>: ${text}`;
}

export function formatWakeRejectedMessage(language = 'ko') {
  return isEnglish(language)
    ? 'Wake word missing: I will not respond.'
    : 'wake word 없음: 응답은 안 함';
}

export function formatVoiceErrorMessage(language = 'ko', detail) {
  return isEnglish(language)
    ? `⚠️ Voice processing failed: ${detail}`
    : `⚠️ 음성 처리 실패: ${detail}`;
}

export function sensitivityStatusTextForLanguage(thresholds, ttl = 0, language = 'ko') {
  const minSeconds = (thresholds.minBytes / (48000 * 2 * 2)).toFixed(1);
  if (isEnglish(language)) {
    return `Sensitivity mode: ${thresholds.mode}, minimum ${minSeconds}s, mean>=${thresholds.minMeanDb}dB or max>=${thresholds.minMaxDb}dB${ttl ? `, restoring default in ${ttl}s` : ''}`;
  }
  return `감도 모드: ${thresholds.mode}, 최소 ${minSeconds}초, mean>=${thresholds.minMeanDb}dB 또는 max>=${thresholds.minMaxDb}dB${ttl ? `, ${ttl}초 뒤 기본으로 복귀` : ''}`;
}

export function verboseStatusTextForLanguage(enabled, language = 'ko') {
  if (isEnglish(language)) {
    return enabled
      ? 'Verbose progress mode: on — I will send and speak intermediate file-read, skill, tool, web-search, terminal, and test progress in English.'
      : 'Verbose progress mode: off — I will keep quiet and focus on final results.';
  }
  return `verbose 진행 모드: ${enabled ? '켜짐' : '꺼짐'}${enabled ? ' — 에이전트의 파일 읽기/스킬 사용/툴 사용/웹 검색/터미널 실행 같은 중간 항목을 텍스트와 음성으로 알려줄게.' : ' — 기본은 조용하게 최종 결과 중심으로만 알려줄게.'}`;
}

export function sensitivityChangedSpeech(mode, language = 'ko') {
  if (isEnglish(language)) return mode === 'conservative' ? 'Switched to conservative outdoor sensitivity.' : 'Switched back to normal sensitivity.';
  return mode === 'conservative' ? '외부 보수 모드로 바꿨어.' : '기본 감도로 바꿨어.';
}

export function verboseChangedSpeech(enabled, language = 'ko') {
  if (isEnglish(language)) return enabled ? 'Verbose progress mode is on.' : 'Verbose progress mode is off.';
  return enabled ? '상세 진행 모드 켰어.' : '상세 진행 모드 껐어.';
}

export function agentAnswerHeader(language = 'ko', label = 'Agent') {
  return isEnglish(language) ? `✅ ${label} response:` : `✅ ${label} 응답:`;
}

export function emptyAgentAnswer(language = 'ko') {
  return isEnglish(language) ? 'The response was empty.' : '응답이 비어 있어.';
}
