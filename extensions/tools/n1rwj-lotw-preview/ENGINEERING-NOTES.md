# LoTW Upload Preview engineering notes

Audited against public HaLo main [`1cd2b437`](https://github.com/ham2k/halo/commit/1cd2b4379737b7aaa43fd64768678bac8dab62dc)
and the draft's published SDK and tools 1.30.0.
SDK 1.29.0 includes secure entropy, binary fetch, redirect refusal, and
Chasing and Logs scopes. SDK 1.30.0 also includes the account file field and
Base64 decoder. The SDK documents the LoTW features at host API 29, which
the draft declares in its manifest.

The entrypoint registers the account, settings, and transfer hooks. With
**EXP PUSH** enabled, HaLo adds the **Logbook of the World** row under
**Settings → Exports & Imports → Services**. The extension's settings panel
offers the About dialog.
[Native transfer settings](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/app/lib/settings/export_settings_group.dart#L93-L166)

The macOS Next feed still lists build 195, which Sebastian reports supports API 27.
See [HALO-950](https://cabo.ham2k.com/halo/c/950) and the
[Next appcast](https://updates.ham2k.net/halo-next/macos/appcast.xml).
The temporary personal extension is intended to give way to an official
Ham2K LoTW extension.

## Transfer and scope responsibilities

[HALO-948](https://cabo.ham2k.com/halo/c/948) gives HaLo ownership of contact
selection, per-contact ADIF, progress, and write-back.

The LoTW adapter accepts operations and API 29 Chasing and Logs scopes
through the SDK's `PushScope` contract.

Operation scopes accept HaLo's comma-separated station calls. The certificate
callsign must occur in the `stationCalls` supplied with the resolved contacts,
which includes the historical calls used in the operation.
Chasing and filtered Logs constrain the destination to their station call.
All Logs offers the certificate's call only when it occurs in the supplied
`stationCalls`. Unknown, malformed, and test scopes offer nothing.

The selector remains `notSentTo: 'lotw'`; no update or delete push is offered.
A scope may span the whole log, but the destination and selector narrow the
contacts actually sent. The host prepares ADIF per QSO and reserializes field
lengths as UTF-8 byte counts. The adapter uses those counts, including for
non-ASCII fields it discards before signing.
[Host transfer ADIF encoder](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/packages/halo_core/lib/src/adif/adif_records.dart#L17-L33)

The adapter uses the grid resolved by HaLo. The contact's own location takes
precedence, then the effective operation segment and base location. Private
data stays off, which caps the station grid at six characters. A missing or
invalid grid stops the chunk before sending.
[Operation export payload](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/app/lib/services/export_service.dart#L393-L487)

For a contact outside an operation, Chasing and Logs can supply
`STATION_CALLSIGN=UNKNOWN` because the ADIF exporter reads the synthetic
operation's missing callsign. For that exact placeholder, the adapter uses the
destination verified against the request and certificate. If the entity is
missing as well, it uses the same callsign-to-DXCC lookup the exporter would
use with the correct call. It preserves an explicit entity and still rejects
conflicts with the certificate or a different station callsign. The host can
remove this workaround by stamping the selected call when preparing the ADIF.
[Transfer ADIF call](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/app/lib/services/transfer_service.dart#L564-L577)
· [Exporter callsign default](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/extensions/core/adif/src/index.ts#L755-L763)

Receipts live under `qso.transfer["lotw:<destination>"]`, separate from QSL
confirmation in `qso.qsl`. The extension returns `{ uuid }` on queue
acceptance, without an external ID. Core records the time, hash, and
revision. Earlier completed chunks keep their receipts; a throwing chunk
keeps none, even if one location's file was already accepted. An operator
retry may replay it, so this is not an exactly-once guarantee. Replaying an
older location can overwrite a later correction; there is no automatic
retry.

## Certificate setup and signing

The account file field is on public main as
[`506fe076`](https://github.com/ham2k/halo/commit/506fe0766e507b37b0f877e21abf41b7b0823309).
The general settings-action picker remains open on [HALO-943](https://cabo.ham2k.com/halo/c/943).
The draft uses the SDK's `AccountField` schema.

```ts
{
  key: 'certificate',
  label: 'LoTW certificate file (.p12)',
  type: 'file',
  accept: { extensions: ['p12'] },
  maxBytes: 64 * 1024,
}
```

The `.p12` file exported from TQSL contains the callsign certificate and its
matching private key. A second `secret` field, `certificatePassword`, holds
the password if one was set during export. The signed-file upload does not
require a LoTW username or account password.
The host shows Choose file, the selected name, and Remove. Save writes the
file and password to the existing account store. HaLo calls `testCredentials`
on Test and when reopening a saved account. Save can proceed after a failed
Test. The editor trims typed credentials before both actions, so a TQSL
password with leading or trailing spaces needs a new export password.
On desktop and mobile, the platform credential store protects the
Base64-encoded value. The account uses `synchronizable: false` to keep
credentials on this device.
[Account editor](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/app/lib/views/settings/accounts_panel.dart#L416-L501)

The host supplies Base64 at `credentials.certificate` and the display name
at `credentials['certificate:name']`. The draft ignores that name for
identity and uses the validated certificate callsign. The SDK's
`base64ToBytes` helper handles decoding in the native sandbox. Canonical
Base64, its predicted size, and actual decoded
length are checked before parsing, with a 64 KiB raw-file ceiling.
Decoder, parser, password, and key errors are replaced with a fixed message
so private material and filenames do not escape through an error.

The runtime opens the P12 backup with Forge 1.4.3, checks container integrity
and password-derivation limits, and matches the RSA key to the certificate.
It reads LoTW callsign, DXCC, and QSO-date authorization. Destination discovery
reads the callsign locally. Account Test checks validity locally and sends
only the public serial to LoTW’s certificate status endpoint. It reports a
revoked or replaced certificate and tells the operator if the status lookup
is unavailable. The lookup has a five-second budget within HaLo's ten-second
Test deadline.

Push unlocks the saved file, checks the certificate dates and whether the
contacts fit the certificate, and signs in memory. The status request only
runs on Test. LoTW verifies the issuer when it processes the upload and can
report a certificate error after queue acceptance. The operator can see
that result in **Your Account → Your Activity → Result**.
[ARRL’s processing results guide](https://lotw.arrl.org/lotw-help/view-accepted-qsos/)

Forge uses host entropy for RSA blinding. The signer checks its result with
the matching public key and fflate compresses the TQ8 before transfer.
The TQ8 contains the public certificate and signed contacts. The bundle
carries both dependency licenses. The build applies Forge's browser crypto
exclusion within the neutral HaLo sandbox build and resolves its global
reference without introducing a DOM.

HaLo owns the picker, Save and Cancel, keychain storage, and platform
cleanup. The native picker removes its temporary copy after reading on
Android and iOS. The transfer settings row shows Connected for a nonempty
credential map, so removing a file and saving can leave that label if a
password field remains. The upload still requires the certificate file.
[Picker cleanup](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/app/lib/services/file_pick.dart#L64-L84)

## Host APIs

| Source | Published SDK contract | Draft behavior |
| --- | --- | --- |
| [HALO-941](https://cabo.ham2k.com/halo/c/941) | `host.randomBytes(length)` returns secure bytes, 1–4,096 per call; reject without a secure source | Validate bounds and exact byte-array length; expose only this source to the certificate provider |
| [HALO-942](https://cabo.ham2k.com/halo/c/942) | Fetch body accepts `Uint8Array`, preserving its slice; string/binary request cap 16 MiB | Forward the original byte view and bound the multipart body; no text/Base64 upload fallback |
| [HALO-944](https://cabo.ham2k.com/halo/c/944) | `redirect: 'error'`; strict SDK dispatch refuses older hosts | Require error mode and original upload URL; leave dispatch and proxy routing to the SDK/host |

The host dispatches both secure randomness and strict binary fetch in public
main. HaLo's web proxy preserves redirect refusal for the upload route. The
certificate status endpoint remains direct and sends no browser CORS header.
That can make online status unavailable on Account Test in the browser.
The first preview targets desktop and mobile because browser storage of
private signing keys still needs verification. The public HaLo baseline
uses the default web credential store, which keeps the encrypted data and
its decryption key in browser local storage.
[Host dispatch](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/packages/halo_extension_host/lib/src/host_core.dart#L565-L577)
· [LoTW proxy route](https://github.com/ham2k/halo/blob/1cd2b4379737b7aaa43fd64768678bac8dab62dc/packages/halo_extension_host/lib/src/fetch_policy.dart#L40-L51)
[Web storage documentation](https://pub.dev/documentation/flutter_secure_storage/latest/index.html#web)

The adapter names `https://lotw.arrl.org/lotw/upload`. LoTW may have received
the upload before a network, redirect, or proxy failure. These outcomes
remain uncertain and trigger no automatic retries.
The Worker 502 wording and a final-URL/redirected response field remain open.

API 31 adds `host.keychainSet` and `ctx.keychain` for extension-owned JSON
secrets. The preview uses the API 29 account file field and keeps the
`exports` section key for its About panel.
[Extension keychain commit](https://github.com/ham2k/halo/commit/2d21e473824396d7de33db897127ffcb48de01e7)

## First verification in a compatible HaLo build

Operations use Exports → Sync & Push to Services. The new Chasing and Logs
Exports panes offer Push to Services under EXP PUSH; Chasing also uses
EXP CHASE. File exports follow the visible period; service push covers the
whole station/callsign-filter log. Chasing's Exports action can remain
disabled when the visible period is empty, even though older contacts may
be due. The flow is present on public main.
[Chasing and Logs pushes](https://github.com/ham2k/halo/commit/3fce1b6d8688be00324e948f75c8f3a8f805cd07)

1. Install the packaged extension on a build that includes the API 29
   certificate-file support. Turn off developer time travel for real
   certificate and upload tests.
2. Open the LoTW account dialog. Test, save, reopen, and replace a `.p12` file.
   Confirm the filename, password, and connection status behave correctly.
3. Verify the push appears for the certificate's callsign in Operations,
   Chasing, and Logs. Confirm the count and historical station locations.
4. With operator approval, send a small known batch. Check that HaLo marks
   contacts as sent after queue acceptance, and check the processing result
   in **Your Account → Your Activity → Result** on LoTW.
5. Time a full 25-contact chunk on a slower phone. The extension reserves
   15 seconds of the host's one-minute deadline for dispatch and write-back.

[HALO-945](https://cabo.ham2k.com/halo/c/945) remains archived because the
prepared transfer payload covers the uploader's historical-metadata need.
[HALO-946](https://cabo.ham2k.com/halo/c/946) still has no concrete committed
Finish/local-logging event API. Automatic Finish and thirty-minute cooldown
uploads remain separate work. No export command is added.

## Verification limits

In a temporary checkout of public HaLo main, all 36 upstream account-file
and transfer tests passed. The packed extension passed native QuickJS tests
through HaLo's real host. These exercised both synthetic certificate formats,
exact binary fetch, refusal of a 307 after one request, and transfer ADIF
containing non-ASCII values.

Tests also loaded the package through the installer's inspection path and
ran HaLo's actual TransferService and ADIF exporter. They exercised Chasing,
station-filtered Logs, and all Logs for contacts saved outside operations.
An operation test selected the certificate's callsign from a two-call
operation and signed three distinct grids from the first segment, a QSO's
own grid, and the second segment. It left the other callsign's QSO alone.
The host wrote ID-less receipts after simulated queue acknowledgements.
The HTTP client was intercepted before transmission.

Deterministic tests cover account-file bounds and error redaction, current
credential replacement, exact binary transport, entropy refusal, all
transfer scopes, and chunk receipt behavior. The production bundle opens
both synthetic encrypted P12 formats, signs the reference contact, and
sends the gzipped TQ8 through the SDK transport to a simulated LoTW reply.
The signature matches an independent OpenSSL vector. A separate native
QuickJS-NG test with simulated host replies also passed both backups,
including a batch of 25 RSA-2048 signatures in about 25 seconds on this
Mac. These tests use synthetic credentials and leave platform picker and
keychain behavior and live LoTW delivery for the installed app check.

Run `mise run check` for lint, types, all tests, ES2020 bundles, and official
packages.
The signer maps US and Canadian station subdivisions; other subdivisions
and additional modes still require validation.

The SDK and tooling pins apply across the monorepo. The source changes
are confined to LoTW and leave CWT's behavior and shared libraries alone.
