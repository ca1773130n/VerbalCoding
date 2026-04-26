
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

async def fake_llm(text):
    for w in ("OK " + text).split():
        yield w + " "
        await asyncio.sleep(0.05)

@app.post("/hermes/stream")
async def stream(req: dict):
    async def gen():
        async for t in fake_llm(req["input"]):
            yield t.encode()
    return StreamingResponse(gen(), media_type="text/plain")
