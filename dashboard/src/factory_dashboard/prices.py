"""API list prices, dollars per million tokens, used to estimate what factory work would cost.

The factory runs on subscriptions, so nothing here is a bill: it is what the same tokens
would cost at Anthropic's API rates. Sources, read 2026-10-09: the claude-api skill's model
table (cached 2026-09-25) and https://www.anthropic.com/claude-haiku-5-5 for Haiku 5.5.
Cache writes are the one-hour rate (2 x input), which is what Claude Code writes: on a
real Sonnet 5 step the engine's own cost_usd ($0.6447826) matches this table only at 2 x.
"""
from __future__ import annotations

# model id -> (input, output, cache write (1 hour), cache read)
PRICES: dict[str, tuple[float, float, float, float]] = {
    "claude-fable-5-1": (10.00, 50.00, 20.00, 0.25),
    "claude-opus-5-5": (4.00, 20.00, 8.00, 0.20),
    "claude-opus-5": (5.00, 25.00, 10.00, 0.50),
    "claude-sonnet-5-5": (2.00, 10.00, 4.00, 0.20),
    "claude-sonnet-5": (2.00, 10.00, 4.00, 0.20),
    "claude-haiku-4-5": (1.00, 5.00, 2.00, 0.10),
    "claude-haiku-5-5": (0.10, 0.50, 0.20, 0.01),
}
# Haiku 5.5 costs more when one request carries over 100K tokens of prompt
HAIKU_55_LONG = (0.50, 2.50, 1.00, 0.05)
LONG_PROMPT = 100_000


def cost(model: str, tokens: dict, turns: int) -> float | None:
    """Estimated dollars for one step, or None when the model has no known price.

    Tokens arrive as totals for the whole step, not per request, so Haiku 5.5's long-prompt
    rate is chosen from the average prompt per turn. That makes the figure an estimate.
    The engine reports `input` including cached tokens; fresh input is what is left.
    """
    rates = PRICES.get(model)
    if rates is None:
        return None
    total_in = int(tokens.get("input") or 0)
    read = int(tokens.get("cacheRead") or 0)
    write = int(tokens.get("cacheWrite") or 0)
    out = int(tokens.get("output") or 0)
    fresh = total_in - read - write
    if fresh < 0:  # an engine that reports input without the cached part
        fresh = total_in
    if model == "claude-haiku-5-5" and total_in / max(turns or 1, 1) > LONG_PROMPT:
        rates = HAIKU_55_LONG
    return (fresh * rates[0] + out * rates[1] + write * rates[2] + read * rates[3]) / 1_000_000
