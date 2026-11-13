# N1RWJ LoTW Upload Preview

A temporary extension for sending contacts from HaLo to Logbook of the
World (LoTW). Use HaLo on desktop or mobile with extension API 29 or later.
The build must include support for certificate files in account settings.

## Set up and upload

1. Enable **EXP PUSH**, then open **Settings → Exports & Imports → Services →
   Logbook of the World**. Under **LoTW certificate file (.p12)**, select the
   file you exported from TQSL. It contains your callsign certificate and
   private signing key. Enter its password if you set one when exporting.
   Use **Test** to check the file and its status with LoTW, then **Save**.
   [ARRL’s certificate export guide](https://lotw.arrl.org/lotw-help/save-certificate/)
2. Check that the contacts have the correct station callsign and location.
   Open **Exports → Push to Services** from an operation, Chasing, or Logs
   and choose **Push to LoTW**. Chasing also requires **EXP CHASE**.
3. HaLo marks contacts as sent when LoTW queues them. To check the processing
   result, open **Your Account → Your Activity → Result** in LoTW.
   [ARRL’s processing results guide](https://lotw.arrl.org/lotw-help/view-accepted-qsos/)

The push offers unsent contacts for the certificate’s callsign. Chasing and
Logs can include contacts outside the displayed date range, so check the
contact count before sending. HaLo keeps your `.p12` file on your device.

If your HaLo build lacks certificate file setup, save an ADIF file from
**Exports** and submit it with TQSL.
[ARRL’s upload guide](https://lotw.arrl.org/lotw-help/submitting-qsos/)

[LoTW engineering notes](ENGINEERING-NOTES.md)
