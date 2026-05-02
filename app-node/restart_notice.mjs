export function restartNoticeLanguage(ttsVoice = '') {
  const voice = String(ttsVoice || '').toLowerCase();
  if (voice.startsWith('en-')) return 'en';
  return 'ko';
}

export function formatRestartCompleteNotice(detail = '', ttsVoice = '') {
  const cleanDetail = String(detail || '').replace(/\s+/g, ' ').trim();
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
  const cleanDetail = String(detail || '').replace(/\s+/g, ' ').trim();
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
