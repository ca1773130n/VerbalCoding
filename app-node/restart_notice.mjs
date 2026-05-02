export function restartNoticeLanguage(ttsVoice = '') {
  const voice = String(ttsVoice || '').toLowerCase();
  if (voice.startsWith('en-')) return 'en';
  return 'ko';
}

export function cleanRestartDetail(detail = '', ttsVoice = '') {
  const raw = String(detail || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (restartNoticeLanguage(ttsVoice) === 'en') {
    return raw
      .replace(/\b(restarting now|i'?ll restart now)\b[.!?\s]*/ig, '')
      .replace(/\bvoice may cut out briefly\b[.!?\s]*/ig, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return raw
    .replace(/이제\s*재시작할게[.!?。！？\s]*/gu, '')
    .replace(/잠깐\s*음성이\s*끊길\s*수\s*있어[.!?。！？\s]*/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatRestartCompleteNotice(detail = '', ttsVoice = '') {
  const cleanDetail = cleanRestartDetail(detail, ttsVoice);
  if (restartNoticeLanguage(ttsVoice) === 'en') {
    return {
      text: cleanDetail
        ? `✅ Restart complete. I am back online. Applied: ${cleanDetail}`
        : '✅ Restart complete. I am back online.',
      speech: cleanDetail
        ? `Restart complete. I am back online. ${cleanDetail}`
        : 'Restart complete. I am back online.',
    };
  }
  return {
    text: cleanDetail
      ? `✅ 재시작 완료. 다시 온라인이야. 적용 내용: ${cleanDetail}`
      : '✅ 재시작 완료. 다시 온라인이야.',
    speech: cleanDetail
      ? `재시작 완료. 다시 온라인이야. ${cleanDetail}`
      : '재시작 완료. 다시 온라인이야.',
  };
}

export function formatRestartShutdownNotice(detail = '', ttsVoice = '') {
  const cleanDetail = cleanRestartDetail(detail, ttsVoice);
  const detailNoPeriod = cleanDetail.replace(/[.!?。！？]+$/u, '');
  if (restartNoticeLanguage(ttsVoice) === 'en') {
    return detailNoPeriod
      ? `I applied this change: ${detailNoPeriod}. Restarting now. Voice may cut out briefly.`
      : 'Restarting now. Voice may cut out briefly.';
  }
  return detailNoPeriod
    ? `방금 한 작업은 ${detailNoPeriod}. 이제 재시작할게. 잠깐 음성이 끊길 수 있어.`
    : '방금 변경사항을 적용했어. 이제 재시작할게. 잠깐 음성이 끊길 수 있어.';
}
