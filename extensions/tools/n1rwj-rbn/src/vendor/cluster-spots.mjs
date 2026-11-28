/*!
Generated from Ham2K Cluster Spots. DO NOT EDIT.
Regenerate with: mise run rbn:vendor-cluster-spots 2b7c67231ddf3f222566feeb3671dcd8a3b42448
Upstream commit: 2b7c67231ddf3f222566feeb3671dcd8a3b42448
Parser: https://github.com/ham2k/extensions/blob/2b7c67231ddf3f222566feeb3671dcd8a3b42448/extensions/spots/ham2k-cluster-spots/src/parse.ts
Parser SHA-256: bad7702abfd8a5370b8503b1d6fc9d44c67e084bf8fa1300771a8d3a3e929593
Command table: https://github.com/ham2k/extensions/blob/2b7c67231ddf3f222566feeb3671dcd8a3b42448/extensions/spots/ham2k-cluster-spots/src/index.ts
Command table SHA-256: c759e5bbb8fb51dbf925a93915a3177a8eb206fdca0d64ec2582006367a36652

Copyright © 2026 Sebastian Delmont <sd@ham2k.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice (including the next paragraph) shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// parse.ts
var DX_DE = /^DX de\s+([^\s:]+):?\s*(\d+(?:\.\d+)?)\s+(\S+)\s+(.*?)\s*(\d{4})Z((?:\s+(?!\S*\d{4}Z)\S+){0,2})\s*$/i;
function spotTime(hhmm, arrivedAt) {
  const hours = Number(hhmm.slice(0, 2)), minutes = Number(hhmm.slice(2, 4));
  if (hours > 23 || minutes > 59) return arrivedAt;
  const day = new Date(arrivedAt);
  const time = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes);
  return time - arrivedAt > 30 * 60 * 1e3 ? time - 24 * 60 * 60 * 1e3 : time;
}
function isPromptFor(text, call) {
  const line = text.replace(/[\x00-\x1f\x7f]/g, " ").trim();
  return line.toUpperCase().startsWith(`${call.toUpperCase()} DE `) && line.endsWith(">");
}
function nodeProgramFromPrompt(prompt) {
  const line = prompt.replace(/[\x00-\x1f\x7f]/g, " ").trim();
  if (/\barc\d*\s*>$/i.test(line)) return "AR-Cluster";
  if (/\bdxspider\s*>$/i.test(line)) return "DXSpider";
  if (/\bCCC\s*>$/.test(line)) return "CC Cluster";
  return void 0;
}

// cluster-spots-entry.ts
var SEND_EVERYTHING = {
  "AR-Cluster": ["SET DX FILTER"],
  DXSpider: ["CLEAR/SPOTS ALL", "SET/SKIMMER CW RTTY PSK BEACON"],
  "CC Cluster": ["SET/NOFILTER", "SET/FILTER DXBM/OFF", "SET/SKIMMER"]
};
export {
  DX_DE as clusterAnnouncementPattern,
  SEND_EVERYTHING as clusterFeedCommands,
  isPromptFor,
  nodeProgramFromPrompt,
  spotTime
};
