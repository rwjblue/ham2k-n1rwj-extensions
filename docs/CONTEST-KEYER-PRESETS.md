# Contest CW keyer presets

SST, CWT, and MST offer a CW message set under **CW Keyer → Sets → Extensions**.
Select the set for the contest you are operating. You can duplicate it in the
set manager to edit your copy. The embedded sets require Extension API 21.

| Key | Message |
| --- | --- |
| F1 | CQ, contest name, own call |
| F2 | Sent exchange |
| F3 | TU, own call, contest name |
| F4 | Own call |
| F5 | Other station's call |
| F6 | Repeat the sent exchange |
| F7 | `QRS PSE` |
| F8 | `AGN?` |

HaLo's Enter Sends Messages uses the N1MM positions for F1–F5 and F8.
N1MM's default assignment lists F6 as QSO B4. Its example CW message
file and K1USN's SST setup use F6 to repeat the exchange. F7 asks the
other operator to slow down. Set your own speed in HaLo. SST caps it at
20 WPM and ICWC asks operators to stay at 20–25 WPM for MST.
[HaLo key mapping](https://github.com/ham2k/halo/blob/b4676c1/app/lib/services/cw_message_set.dart#L70-L88) ·
[N1MM assignments](https://n1mmwp.hamdocs.com/setup/keyboard-shortcuts/#message-key-assignments) ·
[N1MM sample messages](https://n1mmwp.hamdocs.com/setup/function-keys/#cw) ·
[K1USN SST setup and rules](https://www.k1usn.com/sst) ·
[ICWC MST rules](https://internationalcwcouncil.org/mst-contest/)

DXLog and Win-Test also put CQ, exchange, and the two calls on F1, F2, F4,
and F5. Their F3 and QSO-complete key differ from HaLo's.
[DXLog keys](https://dxlog.net/docs/index.php/Getting_started) ·
[Win-Test keys](https://www.win-test.com/ref_manual/en/keys.html)

Configure your sent exchange in the contest operation before keying. SST
sends first name and location, CWT sends first name and the configured
member number, QTH, or `CWA`, and MST sends the draft's MST serial followed
by first name. The presets send full digits. F2 and F6 use the current
draft and stay silent if a required exchange field is missing.

The same set works for both styles. For manual Run, use F1 and answer with
F5 then F2. When the exchange is complete, log and send F3. For manual
S&P, use F4 to call and F2 to send your exchange when called back. If you
use Enter Sends Messages, enable it before picking the preset, then choose
Run or S&P in the keyer. Listen and verify a prefilled exchange before you
press Enter to log.

## Import or edit a standalone copy

The source files are HaLo CW set documents written as JSON. After
`mise run pack`, each contest's `build/assets/` contains the same document
as a `.h2kset` file. Use **Manage CW Message Sets → Import** and select
the file. You can also save a source file with the `.h2kset` extension.

- [SST.h2kset.json](../extensions/contests/n1rwj-sst/assets/SST.h2kset.json)
- [CWT.h2kset.json](../extensions/contests/n1rwj-cwt/assets/CWT.h2kset.json)
- [MST.h2kset.json](../extensions/contests/n1rwj-mst/assets/MST.h2kset.json)
