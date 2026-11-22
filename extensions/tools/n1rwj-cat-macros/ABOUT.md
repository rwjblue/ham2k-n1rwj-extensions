Make buttons for your own CAT commands and place **CAT Macros** beside the
radio in your layout. Open **Settings → CAT Control → CAT Macros** to give
each button a label, an alias, a CAT command, and a radio or receiver to
send it to.

Use plain text or Liquid in the label and command. For example,
`{{ radio.name }} · {{ radio.mode }}` shows the selected receiver and mode
on a button. Choose **Text** for text commands or **Hex bytes** for binary
commands such as Icom CI-V. [HaLo template guide](https://catalog.ham2k.net/docs/templates)

With `EXP KEYS` enabled, add `CATMACRO <alias>` under **Keyboard Shortcuts →
Commands → Add Command** to use the same macro from a key combo.

The extension starts with an empty list. It sends commands in the radio’s
own CAT format through HaLo’s connection. Raw commands can change radio
settings or key the transmitter.
