"""Helpers for getting validated JSON out of text providers."""
import json
import re

from pydantic import BaseModel, ValidationError

from .providers.base import ProviderError, TextProvider


def parse_json(text: str):
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.I)
    try:
        return json.loads(t)
    except ValueError:
        m = re.search(r"[\[{].*[\]}]", t, re.S)
        if not m:
            raise
        return json.loads(m.group(0))


def ask_json(provider: TextProvider, prompt: str, model: type[BaseModel], *, system: str = "",
             task: str = "", retries: int = 1) -> BaseModel:
    """Call the model in JSON mode and validate; on bad output retry once with the error."""
    last = None
    for _ in range(retries + 1):
        p = prompt if last is None else f"{prompt}\n\nYour previous reply was invalid ({last}). Return valid JSON only."
        res = provider.generate(p, system=system, json_mode=True, task=task)
        try:
            return model.model_validate(parse_json(res.text))
        except (ValueError, ValidationError) as e:
            last = str(e)[:300]
    raise ProviderError(f"Model returned invalid JSON for '{task}': {last}")
