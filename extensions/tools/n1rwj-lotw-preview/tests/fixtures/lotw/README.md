# Synthetic LoTW signing fixtures

The two password-protected backups contain the public synthetic key for
`certificate.pem`. The certificate has no ARRL authority. Use these backups
only in offline tests with a simulated host. Their public password is
`ferry-fixture`.

The backups are byte-for-byte copies of `fixtures/signing/current.p12` and
`fixtures/signing/legacy.p12` at source revision
`4fcfcab00775e540a04b79b6a3111c545579c4dc`. The current backup uses PBES2/AES
and a SHA-256 MAC. The legacy backup uses RC2/3DES and a SHA-1 MAC. The
signature in `vector.json` was generated independently with OpenSSL.
