from __future__ import annotations

import re


class WakeWord:
    def __init__(self, words: tuple[str, ...] = ("hermes", "헤르메스", "허미스"), required: bool = False):
        self.words = tuple(w.lower() for w in words)
        self.required = required

    def accepts(self, text: str) -> bool:
        if not self.required:
            return True
        lowered = text.lower()
        return any(word in lowered for word in self.words)

    def strip(self, text: str) -> str:
        result = text
        for word in self.words:
            result = re.sub(re.escape(word), "", result, flags=re.IGNORECASE)
        return " ".join(result.split()) or text.strip()
