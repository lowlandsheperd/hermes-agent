"""Explicit provider reasoning policy shared by model inventory and Desktop RPCs."""
from hermes_constants import VALID_REASONING_EFFORTS, parse_reasoning_effort, resolve_reasoning_config


def provider_entry(entries, provider):
    from hermes_cli.providers import custom_provider_aliases
    provider = str(provider or "").strip().lower()
    return next((e for e in entries if provider in custom_provider_aliases(
        e.get("name", ""), e.get("provider_key", ""))), None)


def allowed_efforts(entries, provider):
    entry = provider_entry(entries, provider)
    if entry is None or "reasoning_efforts" not in entry:
        return None
    raw = entry["reasoning_efforts"]
    valid = set(VALID_REASONING_EFFORTS) | {"none"}
    if not isinstance(raw, list) or not raw or any(not isinstance(v, str) or v not in valid for v in raw):
        raise ValueError(f"{provider}.reasoning_efforts must be a non-empty list of valid efforts")
    return [v for v in ("none", *VALID_REASONING_EFFORTS) if v in raw]


def resolve_default(effort, allowed, preferred=None):
    if preferred is not None:
        if not isinstance(preferred, str) or preferred not in (allowed or ("none", *VALID_REASONING_EFFORTS)):
            raise ValueError("default_reasoning_effort must be an allowed effort")
        return preferred
    if allowed is None or effort in allowed:
        return effort
    order = ("none", *VALID_REASONING_EFFORTS)
    rank = order.index(effort) if effort in order else order.index("medium")
    lower = [v for v in allowed if order.index(v) <= rank]
    return lower[-1] if lower else allowed[0]


def reasoning_policy(cfg, session=None, provider="", model="", base_url=""):
    from hermes_cli.config_providers import get_compatible_custom_providers
    session = session or {}
    override = session.get("model_override") or {}
    if not isinstance(override, dict):
        override = {}
    configured = cfg.get("model") or {}
    if not isinstance(configured, dict):
        configured = {"default": configured}
    agent = session.get("agent")
    provider = provider or override.get("provider") or getattr(agent, "provider", "") or configured.get("provider", "")
    model = model or override.get("model") or getattr(agent, "model", "") or configured.get("default", "")
    entries = get_compatible_custom_providers(cfg)
    if str(provider).lower() in {"", "auto", "custom"}:
        url = base_url or override.get("base_url") or getattr(agent, "base_url", "") or configured.get("base_url", "")
        matches = [e for e in entries if url and e.get("base_url", "").rstrip("/") == url.rstrip("/")]
        if len(matches) == 1:
            provider = matches[0].get("provider_key") or matches[0]["name"]
        elif matches:
            # Several model routes may share one proxy URL. Retain the configured
            # identity instead of arbitrarily choosing the first matching endpoint.
            identity = override.get("provider") or configured.get("provider", "")
            matched = provider_entry(matches, identity)
            if matched:
                provider = identity
        elif not url:
            provider = configured.get("provider", provider)
    allowed = allowed_efforts(entries, provider)
    default = resolve_reasoning_config(cfg, model)
    effort = config_effort(default)
    entry = provider_entry(entries, provider) or {}
    effort = resolve_default(effort, allowed, entry.get("default_reasoning_effort"))
    return allowed, effort


def config_effort(config):
    if isinstance(config, dict):
        return str(config.get("effort") or "medium") if config.get("enabled") is not False else "none"
    return "medium"


def constrained_reasoning(cfg, config, provider="", model="", base_url=""):
    allowed, default = reasoning_policy(cfg, provider=provider, model=model, base_url=base_url)
    if allowed is not None and config_effort(config) not in allowed:
        return parse_reasoning_effort(default)
    return config
