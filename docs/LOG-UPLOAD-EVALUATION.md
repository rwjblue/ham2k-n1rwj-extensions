# Direct LoTW uploads through HaLo transfers

Updated November 19, 2026 against HaLo main
[`b4676c11`](https://github.com/ham2k/halo/commit/b4676c11820945fdbaeda25b08770f9be730da28)
and published extension SDK/tools 1.28.0. This is unreleased development
work. It does not import real certificates or send a log to LoTW.

## What changed

HaLo now owns the transfer workflow in
[HALO-948](https://cabo.ham2k.com/halo/c/948). The official `ham2k-qrz` 0.3.0
extension supplies QRZ upload. Our QRZ command, account, client, privacy
adapter, device-local journal, and QRZ tests have been removed.

Our remaining extension uses the API 28 `transfer` hook. Core selects
contacts, prepares their ADIF through the normal segmented export path,
provides progress, and writes accepted results onto each QSO. We no longer
need to read raw QSON, reconstruct segment history, invoke an exporter,
or keep our own sent-record journal for this path.

Transport receipts live under `qso.transfer["lotw:<destination>"]`, separate
from QSL confirmations in `qso.qsl`. A queue acknowledgement can be returned
as `{ uuid }` without an external ID; core supplies the transfer timestamp,
content hash and sync revision. It does not prove that LoTW processed the
file or that the other station confirmed the contact.

The host's [transfer contract](https://github.com/ham2k/halo/blob/b4676c11820945fdbaeda25b08770f9be730da28/docs/extensions/import-export.md#transfer)
and [design](https://github.com/ham2k/halo/blob/b4676c11820945fdbaeda25b08770f9be730da28/docs/design/transfer.md)
are the source of truth. HALO-228 has been set aside in favor of HALO-948;
we have not edited it.

## Extension responsibilities

The LoTW adapter receives prepared ADIF, validates the contact and station
identity against its certificate, builds signed TQ8 files, and submits them
to LoTW. Certificate and exported DXCC matching does not independently
prove that a grid belongs to that DXCC entity; production station setup
still needs to establish the correct operating location. It advertises only contacts not previously sent to that destination.
Updates, remote deletion, downloading confirmations, and duplicate queries
are outside this initial uploader.

Core chunks by station callsign, up to 25 contacts. A chunk may cross several
station locations, so the adapter groups its records by signing location.
It validates and prepares the whole chunk before beginning the first
request. It returns accepted UUIDs only after every file in the chunk has
received an explicit LoTW queue acknowledgement.

An upload refusal or uncertain response stops the push by throwing. Core
then records no receipts from that chunk, even if an earlier location's
file was accepted. A later operator retry may replay those contacts. This
follows the transfer contract's chunk semantics; it is not an exactly-once
guarantee. LoTW's documented retry path allows resubmitting a signed file,
but repeating an older location can overwrite a later correction. There
is no automatic retry. Earlier completed chunks keep their receipts.

The ADIF reader and signing code remain plain sandbox TypeScript. The real
certificate parser, secure entropy source, gzip implementation, and exact
binary transport will be supplied through a small connection adapter.
Certificate parsing and RSA signing can stay inside the extension: both
Ferry certificate fixture formats were previously tested with Forge in
native QuickJS, with OS randomness injected by a synthetic harness. No
native certificate-signing API or host gzip API is required. The existing
signer maps US and Canadian station subdivisions; other subdivision
mappings and additional modes still need validation.

## Host features still needed

| Issue | Why it remains useful |
| --- | --- |
| [HALO-941](https://cabo.ham2k.com/halo/c/941) | OS randomness for RSA blinding in the extension signer. |
| [HALO-942](https://cabo.ham2k.com/halo/c/942) | Exact binary HTTP bodies for the compressed TQ8 multipart request. |
| [HALO-943](https://cabo.ham2k.com/halo/c/943) | User-selected certificate import through the system file picker. |
| [HALO-944](https://cabo.ham2k.com/halo/c/944) | An upload can refuse redirects; this remains independent request hardening. |
| [HALO-946](https://cabo.ham2k.com/halo/c/946) | Durable opt-in Finish/cooldown scheduling after local logging. |

[HALO-945](https://cabo.ham2k.com/halo/c/945) was archived at the user's
request because the prepared transfer payload covers the upload use case.
The proposed general resolved-QSON read has not landed. Cabo's current
account role permits archiving our card but not moving it to Done.

Native account credentials already use the host's secure store. Certificate
material and its password belong there, not in ordinary extension settings
or a file of our own. Do not add Base64 paste fields as a substitute for
certificate-import setup. The current runtime connection deliberately
refuses setup and upload until a supported path exists; it requests no
network access and stores no credentials.

## Manual workflow and automation

The target manual UI is an operation's **Exports → Sync & Push to Services**
section, behind `EXP PUSH` on current main. SDK 1.28.0 is published; the
installed Mac Next build 195 predates the core transfer implementation.
The development build has no `EXPORT QRZ` or `EXPORT LOTW` command.

Automatic Finish and 30-minute cooldown uploads remain a separate phase.
Assistant callbacks follow mounted operation views and do not identify a
committed local logging event reliably enough for that schedule. Core's
transfer design explicitly leaves automatic triggers and LoTW undecided.
We should reuse its selection, receipt and progress machinery when durable
triggers become available rather than build a second outbox.

## Verification limits

`mise run check` passed on this workspace: 2,073 tests in 158 files, lint,
all typechecks, 14 ES2020 builds, and official packaging. The focused LoTW
suite has 52 tests, including 47 new ADIF/transfer tests. No runtime
acceptance in an API 28 app or live LoTW upload has been performed.

Deterministic fixtures cover signature construction, multipart framing,
queue replies, and location grouping. Tests inject synthetic signing and
transport; they do not establish that native account setup, platform secure
storage, real binary transport, or a live vendor upload works. Keep actual
runtime and operator-controlled LoTW checks separate from bundle tests.

No CWT behavior is changed by this work. SDK/tools changes support the new
transfer contract and are checked against every existing extension; there
is no CWT implementation change to synchronize to its upstream branch.
