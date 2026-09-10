"""Real config -> catalog and RPC policy, isolated from any production profile."""
import pytest
import yaml
from hermes_cli import inventory
from hermes_cli.provider_reasoning import reasoning_policy, constrained_reasoning
from tui_gateway import server


@pytest.fixture
def configured(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path))
    monkeypatch.setattr(server, '_hermes_home', tmp_path)
    server._cfg_cache = server._cfg_mtime = server._cfg_path = None
    cfg = {'model': {'provider': 'cedar', 'default': 'test-model'},
           'agent': {'reasoning_effort': 'medium'},
           'providers': {'cedar': {'api': 'https://example.invalid/v1', 'name': 'Cedar AI',
                                   'reasoning_efforts': ['low', 'medium']}}}
    file = tmp_path / 'config.yaml'
    file.write_text(yaml.safe_dump(cfg))
    yield cfg, file
    server._cfg_cache = server._cfg_mtime = server._cfg_path = None


@pytest.mark.parametrize('global_effort,allowed,expected', [
    ('medium', ['low', 'medium', 'high'], 'medium'),
    ('medium', ['high', 'low'], 'low'),
    ('medium', ['max', 'high'], 'high'),
    ('high', ['medium', 'low'], 'medium'),
    ('low', ['none', 'low'], 'low'),
])
def test_default_order(configured, global_effort, allowed, expected):
    cfg, _ = configured
    cfg['agent']['reasoning_effort'] = global_effort
    cfg['providers']['cedar']['reasoning_efforts'] = allowed
    assert reasoning_policy(cfg)[1] == expected


def test_explicit_provider_default(configured):
    cfg, _ = configured
    cfg['providers']['cedar']['default_reasoning_effort'] = 'low'
    assert reasoning_policy(cfg)[1] == 'low'
    cfg['providers']['cedar']['default_reasoning_effort'] = 'max'
    with pytest.raises(ValueError):
        reasoning_policy(cfg)


@pytest.mark.parametrize('raw', [[], ['typo'], 'low', [None]])
def test_invalid_policy_is_not_unrestricted(configured, raw):
    cfg, _ = configured
    cfg['providers']['cedar']['reasoning_efforts'] = raw
    with pytest.raises(ValueError):
        reasoning_policy(cfg)


def test_real_catalog_and_rpc_agree(configured, monkeypatch):
    import agent.models_dev as models_dev
    monkeypatch.setattr(models_dev, "get_model_capabilities", lambda *args: None)
    ctx = inventory.load_picker_context()
    rows = [{'slug': 'custom:cedar', 'models': ['test-model']}]
    inventory._apply_capabilities(rows, ctx.custom_providers, ctx.reasoning_config)
    caps = rows[0]['capabilities']['test-model']
    reply = server._methods['config.get'](1, {'key': 'reasoning'})['result']
    assert caps['reasoning_efforts'] == reply['reasoning_efforts'] == ['low', 'medium']
    assert caps['default_reasoning_effort'] == reply['default_effort'] == 'medium'
    assert caps['can_disable_reasoning'] is False


def test_rejected_set_does_not_write(configured):
    _, file = configured
    original = file.read_text()
    rejected = server._methods['config.set'](1, {'key': 'reasoning', 'value': 'max'})
    assert rejected['error']['code'] == 4002
    assert file.read_text() == original
    assert server._methods['config.set'](2, {'key': 'reasoning', 'value': 'low'})['result']['value'] == 'low'
    assert yaml.safe_load(file.read_text())['agent']['reasoning_effort'] == 'low'


def test_create_rejects_override_and_pins_default(configured, monkeypatch):
    monkeypatch.setattr(server, '_schedule_agent_build', lambda sid: None)
    monkeypatch.setattr(server, '_schedule_session_cap_enforcement', lambda: None)
    before = set(server._sessions)
    rejected = server._methods['session.create'](1, {'reasoning_effort': 'max'})
    assert rejected['error']['code'] == 4002
    assert set(server._sessions) == before
    created = server._methods['session.create'](2, {})['result']
    try:
        assert server._sessions[created['session_id']]['create_reasoning_override']['effort'] == 'medium'
    finally:
        server._sessions.pop(created['session_id'], None)


def test_legacy_config_and_resolved_runtime_identity(configured):
    cfg, _ = configured
    entry = cfg.pop('providers')['cedar']
    cfg['custom_providers'] = [{'name': 'cedar', 'base_url': entry['api'], 'reasoning_efforts': ['low', 'high']}]
    assert reasoning_policy(cfg, provider='custom', base_url=entry['api'])[1] == 'low'
    assert constrained_reasoning(cfg, {'enabled': True, 'effort': 'max'}, 'custom', 'test-model', entry['api'])['effort'] == 'low'
    assert reasoning_policy(cfg, provider='unrestricted')[0] is None


def test_live_switch_preserves_allowed_and_replaces_disallowed(configured, monkeypatch):
    from types import SimpleNamespace
    for name in ('_restart_slash_worker', '_persist_live_session_runtime',
                 '_persist_live_session_system_prompt', '_append_model_switch_marker', '_emit_session_info'):
        monkeypatch.setattr(server, name, lambda *args, **kwargs: None)
    agent = SimpleNamespace(reasoning_config={'enabled': True, 'effort': 'max'}, switch_model=lambda **kw: None)
    result = SimpleNamespace(new_model='test-model', target_provider='custom:cedar',
                             api_key='', base_url='https://example.invalid/v1', api_mode='chat')
    session = {'agent': agent}
    server._commit_agent_switch('test', session, agent, result, 'old-model', None)
    assert agent.reasoning_config['effort'] == 'medium'
    assert session['create_reasoning_override'] == agent.reasoning_config
    agent.reasoning_config = {'enabled': True, 'effort': 'low'}
    server._commit_agent_switch('test', session, agent, result, 'old-model', None)
    assert agent.reasoning_config['effort'] == 'low'


def test_session_profile_policy_does_not_leak(configured, tmp_path):
    _, file = configured
    other_home = tmp_path / 'other'
    other_home.mkdir()
    other_cfg = yaml.safe_load(file.read_text())
    other_cfg['providers']['cedar']['reasoning_efforts'] = ['high']
    (other_home / 'config.yaml').write_text(yaml.safe_dump(other_cfg))
    sid = 'test-profile-policy'
    server._sessions[sid] = {'agent': None, 'profile_home': str(other_home)}
    try:
        assert server._methods['config.set'](1, {'session_id': sid, 'key': 'reasoning', 'value': 'low'})['error']['code'] == 4002
        assert server._methods['config.set'](2, {'session_id': sid, 'key': 'reasoning', 'value': 'high'})['result']['value'] == 'high'
        assert yaml.safe_load(file.read_text())['agent']['reasoning_effort'] == 'medium'
    finally:
        server._sessions.pop(sid)
