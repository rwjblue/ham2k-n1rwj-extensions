# N1RWJ LoTW Uploads

Unreleased LoTW upload work using HaLo’s API 28 transfer workflow. This
build does not import certificates or send anything to LoTW. The transfer
row explains that setup is unavailable.

QRZ upload is provided by the official `ham2k-qrz` extension. Our QRZ
command, account, network client, and device-local upload journal have
been removed. Use the official extension’s Push action in an operation’s
Exports panel on a host that supports it.

The LoTW transfer adapter takes core-prepared ADIF and uploads unsent
contacts only. Core owns selection, station/segment preparation, progress,
and the synced per-QSO transfer receipts. The adapter validates the entire
chunk, groups by signing location, prepares signed files before sending,
and returns each UUID only after every file has been queued successfully.
It stops at the first refused or uncertain upload. A later operator retry
may replay an earlier accepted file from that chunk, because core saves
none of a throwing chunk’s receipts.

Certificate parsing, signing and gzip remain extension responsibilities.
A production connection needs native certificate setup, secure randomness,
and exact binary HTTP transport. There is no credential-paste workaround,
private-key settings storage, automatic retry, remote deletion, receipt
polling, or duplicate query. Native account credentials will use the host’s
secure store when certificate setup is available.

The existing signer supports US and Canadian station subdivisions. Other
station subdivision mappings and additional modes require separate
validation. This work does not add Finish/cooldown uploads or an export
command. See the [engineering evaluation](../../../docs/LOG-UPLOAD-EVALUATION.md)
for the remaining host proposals and verification limits.
