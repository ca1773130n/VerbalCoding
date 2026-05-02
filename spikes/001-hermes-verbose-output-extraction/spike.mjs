import { spawn } from 'node:child_process';
import { sanitizeAgentOutput } from '../../app-node/agent_adapters.mjs';

function runHermes(args, input, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn('hermes', args.concat([input]), {
      cwd: '../..',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('timeout'));
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, answer: sanitizeAgentOutput(stdout) || sanitizeAgentOutput(stderr) });
    });
  });
}

const prompt = [
  'Discord 음성 대화로 들어온 사용자 발화다.',
  '단순 대화/상태 질문이면 도구를 쓰지 말고 1~3문장으로 바로 한국어 답변해라.',
  '파일 수정, 실행, 로그 확인, 검색 같은 실제 작업 지시일 때만 필요한 도구를 사용해라.',
  'CLI 메타정보나 session_id는 답변에 포함하지 마라.',
  'VERBOSE 진행 공유 모드가 켜져 있다.',
  '긴 작업에서 중요한 중간 동작을 할 때마다 한 줄로 `VERBALCODING_PROGRESS: <짧은 한국어 단계>` 형식을 출력해라.',
  '',
  '현재 작업실을 확인해서 한 문장으로 알려줘.',
].join('\n');

const cases = [
  ['quiet', ['chat', '-Q', '-q']],
  ['verbose-no-quiet', ['chat', '-q']],
];

for (const [name, args] of cases) {
  const r = await runHermes(args, prompt);
  const finalBox = /╭─\s*⚕\s*Hermes\s*─/.test(r.stdout);
  const progressPreview = /┊/.test(r.stdout);
  console.log(JSON.stringify({
    name,
    code: r.code,
    signal: r.signal,
    stdoutChars: r.stdout.length,
    stderrChars: r.stderr.length,
    finalBox,
    progressPreview,
    answer: r.answer,
  }, null, 2));
}
