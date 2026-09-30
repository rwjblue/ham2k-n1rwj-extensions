/** PSK Reporter permits freeform listener IDs, including SWLs without callsigns. */
export function isValidReceiverId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 254 &&
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject controls, line separators and malformed Unicode in provider IDs.
    !/[\u0000-\u001f\u007f-\u009f\u2028\u2029\ud800-\udfff]/u.test(value)
  )
}

/** Exact ASCII MQTT subscriptions; dots are reserved for escaped slashes. */
export const watchStationPattern = '^$|^(?!.*[.+#])[ -~]{1,254}$'
