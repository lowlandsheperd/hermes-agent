# CEDAR Desktop: provider reasoning and Windows tray

Deploy the Python changes to the machine running `hermes serve`, restart that service,
and rebuild Desktop from the same branch. Desktop does not install or update the server.
An older server cannot enforce or publish these provider restrictions.

## Server configuration

Keep your existing URL, model IDs, and credentials. Example additions to `config.yaml`:

```yaml
agent:
  reasoning_effort: medium
providers:
  cedar-ai-auto:
    api: https://your-existing-endpoint/v1
    reasoning_efforts: [low, high]
    # Optional explicit provider default, which must be allowed:
    # default_reasoning_effort: high
```

Legacy `custom_providers` entries accept the same two reasoning fields.
No provider name or endpoint is hardcoded in the client.

The server resolves defaults in this order: explicit provider default; the existing
model/global reasoning default if allowed; nearest allowed level at or below that
default; lowest allowed level when none is lower. Configuration list order is irrelevant.
For global `medium`, `[low, high]` resolves to `low`, `[low, medium, high]` to `medium`,
and `[high, max]` to `high`. Existing per-model reasoning overrides remain supported.

Absent `reasoning_efforts` retains the existing unrestricted behavior. An empty or
malformed list is a configuration error. Include `none` only if turning reasoning off
is supported. The client hides the thinking-off toggle when `none` is not allowed.

`config.get` for `reasoning` publishes `reasoning_efforts` (when restricted) and
`default_effort`. Model option capabilities carry `reasoning_efforts` and
`default_reasoning_effort`. Clients consume these resolved defaults. The server rejects
explicit disallowed `config.set` and `session.create` requests with error 4002.

A new Desktop draft uses the server default; old persisted composer effort does not
pin new sessions. An explicit allowed choice in the draft is honored. On provider
switch, a valid live choice is kept; an incompatible choice uses the new route default.
Saved sessions with obsolete efforts are normalized when the agent is rebuilt. Running
responses are not interrupted by these changes.

## Windows tray

- Closing the primary window hides it to the tray by default, keeping its renderer
  and remote connection alive. The first hide shows a one-time balloon.
- The minimize button continues to minimize to the taskbar.
- Double-click the tray icon or choose **打开 CEDAR AGENT** to show/focus the window.
- Choose **退出** for the normal full client shutdown. Remote `hermes serve` keeps running.
- Appearance settings contains **关闭窗口时最小化到托盘**, persisted in the local
  Electron user-data directory. Turning it off restores normal window closing.
- Secondary chat windows close normally. They do not each create a tray icon.
- A missing/failed tray icon never causes an invisible app: window closing proceeds.
- Repeated launches focus the existing primary window. Windows session end is not
  intercepted as close-to-tray. Non-Windows behavior is unchanged.

## Manual Windows checks

Verify close/restore/minimize, opt-out across a restart, one-time notice, secondary
windows, repeated launch, explicit quit during a response, and Windows logout/shutdown.
While hidden, generate a remote response and confirm the transcript on restore. Native
tray display and OS shutdown require Windows testing; unit tests simulate Electron events.
