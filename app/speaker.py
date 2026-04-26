
import time

class SpeakerManager:
    def __init__(self):
        self.last = {}
        self.active = None

    def update(self, uid):
        self.last[uid] = time.time()
        self.active = max(self.last, key=self.last.get)

    def is_active(self, uid):
        return uid == self.active
