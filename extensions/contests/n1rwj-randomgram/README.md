# N1RWJ RandomGram

RandomGram event logging for Ham2K Logger, using extension API 5 and SDK 0.12.0.
It imports organizer-issued five-character TX groups, shows the exact group
in a large exchange pane, records RX groups, and prepares organizer submissions.
It works offline after setup. It does not generate groups or send submissions.

## Setup and operation

1. Download `n1rwj-randomgram-0.10.0.h2kext` from the
   [GitHub release](https://github.com/rwjblue/ham2k-n1rwj-extensions/releases/tag/v0.10.0)
   and install it using **Settings →
   Extensions & Features → Install from file**. Enable N1RWJ RandomGram.
2. Create an operation for the event, search for **RandomGram** in Activities,
   and select it. Enter its number, your callsign/SWL ID, and its alphabet.
3. Paste the complete organizer message or attachment text into **Organizer-issued
   TX list**, or paste the groups separated by whitespace. Leading zeros are
   preserved. A complete organizer list supplies its event number automatically.
   The importer checks owner, event, count, duplicates and alphabet. Listening-only
   operation may leave the TX list blank.
4. Add **RandomGram Exchange** using **Edit Layout → Add a Panel**. On narrow
   screens layout editing is under Tools. Choose a placement visible while logging;
   mobile and desktop layouts are configured separately.

Use a new operation for a different event, alphabet or issued-list owner.
Existing groups cannot be removed or reordered. Append more organizer-issued
groups below the existing groups in setup, without a second message's headers.

Select CW and a non-WARC HF band. Enter one callsign at a time. **TX item**
selects a position in the supplied list; the number is not the exchange.
You may select groups in any order. Automatic allocation follows the highest
logged position; manually choose an earlier unused item when needed.
The pane shows the literal TX group, separate RST, RX group and list position.
Enter **RX group**, then log the contact. Saving snapshots the literal sent and
received exchanges. Repeating a keyer message repeats the selected group;
rendering the pane never advances the list.

**TX override** supplies an explicit five-character correction. Clear it to
return to list selection on a new contact. Invalid corrections remain in the
contact's reference but are not keyable. Editing a saved contact retains its
recorded sent group unless an explicit TX override replaces it.

Repeat same-band contacts are allowed after calling or answering CQ RG.
The summary shows logged group counts; the organizer cross-checks received
groups to determine the final score.

## Groups sent without a contact

Run **`RGSKIP`** while that item is selected. In the tested Mac build 179,
type the command in the callsign field and click the on-screen Save arrow.
It records a used-group log note and a device-local retirement hint. The command
also accepts **`RGSKIP 12`** to identify an item explicitly.
**Manually change TX item to the next unused position before transmitting.**
For example, after retiring item 12, use item 13 and check the pane before sending.
If item 13 is unavailable or already used, select a different unused item.
Skipping item 12 leaves earlier unused items available.

Current host sequences do not reliably advance when their `start` changes,
and event notes do not allocate serials. The hint does not replace that manual
correction. On restart or another device, verify the next unused item against
your log. After saving the corrected position on a contact, normal allocation
continues from it. Deleting a saved contact does not free its committed position.

## Listening and submission

**`RGSWL ABCDE`** records a group copied while listening, tagged with the event,
without consuming a TX group. The example is synthetic. Listening notes are
separate from contacts and excluded from ADIF contact export.

In the tested Mac build 179, enter **`RGSWL`** in the callsign field first,
press Space, enter the group, then click the on-screen Save arrow. Allow the
host to recognize the command prefix before entering its parameter.

Choose **RandomGram submission** in Exports for your participant ID and unique
valid received groups, one per line. The option reports invalid or repeated
entries omitted. ADIF contact export uses literal `STX_STRING`/`SRX_STRING`
and an organizer-readable RX comment; no numeric `STX`/`SRX` is emitted.

**`RGREPORT`** opens copyable submission text including listening-only groups,
even without two-way contacts. Select/copy the multiline field, then close the
dialog with Cancel. In the tested Mac build, enter `RGREPORT` in the callsign
field and click the on-screen Save arrow. The report can remain open while
you copy it. It does not send email.

The inspected host export/scoring services exclude event rows before calling
extensions. Text exports recover listening notes with one log read when invoked.
A listening-only operation may receive no normal export options; use `RGREPORT`.
Native score summaries may omit listening notes even though submissions include
them. Invalid groups stay in the log so the operator can correct them.

## CW keyer

Copy the complete [KEYER_EXCHANGE.liquid](assets/KEYER_EXCHANGE.liquid) into an
Exchange memory in **CW Keyer Messages**. It sends RST and the same literal group
displayed by the pane. Only RST uses `cut`; code groups are never converted to
numbers, padded, or sent using cut-number substitutions.

If the editor submits when you enter a newline, replace the template's line
breaks with spaces before entering it. This equivalent single-line form was
verified in Mac build 179; multiline clipboard paste has not been checked.
Use a separate message set for RandomGram.

The template guards the whole message. Missing/invalid positions, malformed
overrides and exhausted lists render nothing. The verbose selection is necessary
because the SDK has no live activity exchange getter. It is tested against the
pure resolver and the shipped asset. Installation does not overwrite personal
keyer memories or enable ESM. Automated checks render locally without RF.

## Verification and boundaries

Deterministic tests cover imports, metadata validation, leading zeros, corrections
and clearing, snapshots, keyer equivalence, exhaustion, repeat contacts, listening,
retirement persistence, exports and activation of the official ES2020 bundle.
All fixtures are synthetic; issued user groups are not stored in the repository.

Native Mac acceptance in Ham2K Power Logger (Next) 26.9.0 build 179 verified
organizer-message import, the panel, three synthetic saved contacts, same-band
repeats, RX clearing/restoration, listening entries, retirement, submission and
ADIF exports, and visible keyer expansion. Literal zeros and O stayed distinct;
cut numbers applied only to RST. No CW was transmitted. A report held open for
136 seconds closed cleanly after the command-lifetime fix.

This host build can retain a stale **No Exchange** or **Bad Exchange** warning
after exchange edits until callsign/focus changes refresh scoring. Check the
pane and fields; this warning did not change the saved exchange in native tests.

Initial support is single-contact logging on one device. Comma-list batch saves
allocate later positions after pre-save, so those contacts may lack a literal
TX snapshot; exports can derive their final index against the immutable list.
Avoid batch logging for RandomGram. A pinned mobile TX readout and shared live
exchange getter still need host support. Phone keyboard/layout, actual radio
sending and multi-device retirement recovery require runtime checks.
See the [verification record](../../../../docs/VERIFICATION.md).

## Develop

```sh
mise run install
mise run format
mise run check
mise run pack n1rwj-randomgram
```

Independent MPL-2.0 implementation using the published MIT-licensed Ham2K SDK
and build tools. [Organizer rules](https://groups.io/g/RandomGram/topic/randomgram_overview/97601889)
remain authoritative. This extension changes no CWT or CQ WW behavior and is
exempt from synchronizing their temporary upstream PRs.
