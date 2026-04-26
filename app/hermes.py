from __future__ import annotations

import asyncio
import os
import shlex


class HermesClient:
    """Call the local Hermes CLI so this voice bridge uses the user's existing Hermes auth/config."""

    def __init__(self, command: str = "hermes chat -Q -q", timeout: float = 180.0):
        self.command = command
        self.timeout = timeout
        self._current: asyncio.subprocess.Process | None = None

    async def ask(self, text: str) -> str:
        argv = shlex.split(self.command) + [text]
        env = os.environ.copy()
        env.setdefault("PYTHONUNBUFFERED", "1")
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        self._current = proc
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return "Hermes 응답 시간이 초과됐어. 명령을 조금 짧게 다시 말해줘."
        finally:
            if self._current is proc:
                self._current = None

        if proc.returncode != 0:
            err = stderr.decode(errors="ignore").strip()[-500:]
            return f"Hermes CLI 실행에 실패했어: {err or proc.returncode}"
        return stdout.decode(errors="ignore").strip()

    async def cancel(self) -> None:
        if self._current and self._current.returncode is None:
            self._current.terminate()
            try:
                await asyncio.wait_for(self._current.wait(), timeout=2)
            except asyncio.TimeoutError:
                self._current.kill()
