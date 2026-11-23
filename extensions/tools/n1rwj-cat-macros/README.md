# N1RWJ CAT Macros

Add a dockable **CAT Macros** pane to Ham2K Logger. Each button sends the
macro’s CAT command to a radio or receiver you pick in Station Configuration.
Requires extension API 23. It supports text CAT commands and binary frames
such as Icom CI-V.

## Install and configure

```sh
mise run install
mise run pack n1rwj-cat-macros
```

1. Install the `.h2kext` through **Settings → Extensions & Features → Install
   from file**. HaLo shows the raw radio command permission at installation.
2. Open **Settings → CAT Control → CAT Macros** and add a macro. Enter a
   button label, an alias using letters, numbers or hyphens, and a CAT
   command. Pick the configured radio or receiver and the command format.
3. Choose **Edit Layout → Add a Panel → CAT Macros** and place it beside your
   Radio pane. Press a button to run its macro.

The pane starts empty. Choose **Text** for text-based protocols and include
any terminators your radio expects. Choose **Hex bytes** for binary protocols
and separate two-digit hex values with whitespace. For CI-V, enter each
whole frame from `FE FE` through `FD`. HaLo substitutes the address of the
selected radio and its own controller address.

## IC-7300 noise blanker example

In a mode that supports the noise blanker, such as SSB or CW, set up a macro
with these values.

| Field | Value |
| --- | --- |
| Button label | `NB on · {{ radio.name }}` |
| Shortcut alias | `NB-ON` |
| Radio | Your configured IC-7300 |
| Format | **Hex bytes** |

Enter this template as the CAT command.

```liquid
{% if radio.connected %}FE FE 94 E0 16 22 01 FD{% endif %}
```

The `01` data byte turns the noise blanker on. To make an **NB off** button,
use a second macro with a different alias and `00` instead. Icom documents
the frame format and commands in section 19. [IC-7300 Advanced Manual](https://www.icomeurope.com/wp-content/uploads/2023/04/IC-7300_ENG_IM_Advanced_11a_web.pdf#page=161)

## Use Liquid in a macro

**Button label** and **CAT command** both accept plain text or Liquid
templates. The label renders in the pane. The CAT command renders when you
press the button or run its shortcut. **Text** sends that output as written.
**Hex bytes** decodes it into bytes after rendering.

| Template data | Available values |
| --- | --- |
| App and clock | `app.name`, `now` (UTC) |
| Operation | Standard `op` fields such as `op.call`, `op.operator`, and `op.refs`. The pane also supplies the live `op.qsoCount` and operation dates. |
| Draft contact | The standard `qso` fields, such as `qso.call`, when the pane has a draft. Keyboard shortcuts have no draft context. |
| Selected radio | `radio.name`, `radio.status`, `radio.connected`, `radio.stale`, `radio.transmitting`, `radio.channel.key`, `radio.channel.label` |
| Radio settings | `radio.mode`, `radio.frequencyHz`, `radio.reportedFrequencyHz`, `radio.powerWatts`, `radio.opStyle`, `radio.tuner`, `radio.passband.lowHz`, `radio.passband.highHz` |
| Antennas | `radio.antennas.rx`, `radio.antennas.tx`, `radio.antennas.rxPorts`, `radio.antennas.txPorts`, `radio.antennas.separate` |

The radio driver determines which values are available. `radio.frequencyHz`
is HaLo’s current dial value and `radio.reportedFrequencyHz` is the radio’s
last report, both in hertz. `radio.connected` is true when the receiver is
connected and its state is current.

HaLo documents the standard variables and its own filters, such as `pad`.
See the LiquidJS reference for standard filters such as `plus`. [HaLo template guide](https://catalog.ham2k.net/docs/templates) · [HaLo template variables](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/docs/extensions/templates.md#what-a-template-can-name) · [HaLo filters](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/docs/extensions/templates.md#filters) · [LiquidJS filters](https://liquidjs.com/filters/overview.html)

HaLo’s template editor shows syntax errors. Its sample preview has no radio
data, so check a radio-dependent label in the pane. If a label fails to render
or comes out blank, its alias remains visible. If a CAT command fails to
render, comes out blank, or has invalid hex bytes, the macro reports the
problem and sends nothing. Liquid renders missing values as empty text. Use a
conditional when a command needs a value the receiver or view may omit.

## Bind a key combo

Enable Keyboard Shortcuts with `EXP KEYS` if the setting is hidden. In
**Settings → Keyboard Shortcuts**, switch to an editable shortcut set. To
start from **App Defaults**, duplicate it in **Manage Shortcut Sets…**. Under
**Commands → Add Command**, enter `CATMACRO <alias>`, such as `CATMACRO NB-ON`,
then record the key combo. Use the same alias when editing a macro to keep
its shortcut.
