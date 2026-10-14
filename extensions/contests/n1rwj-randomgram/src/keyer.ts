// The built-in CW template hook cannot call extension functions. Keep this
// selection in sync with resolveSent, verified against the public SDK renderer.
// The internal item number selects a string; the string is never cut or padded.
const selection = `
{%- assign rg_op = '' -%}
{%- for rg_ref in op.refs -%}
  {%- if rg_ref.type == 'randomgram' -%}{%- assign rg_op = rg_ref -%}{%- break -%}{%- endif -%}
{%- endfor -%}
{%- assign rg_qso = '' -%}
{%- for rg_ref in qso.refs -%}
  {%- if rg_ref.type == 'randomgram' -%}{%- assign rg_qso = rg_ref -%}{%- break -%}{%- endif -%}
{%- endfor -%}
{%- assign rg_override = '' -%}
{%- assign rg_override_text = rg_qso.ourGroup | append: '' -%}
{%- if rg_qso.ourGroup == rg_override_text -%}{%- assign rg_override = rg_override_text | strip -%}{%- endif -%}
{%- assign rg_snapshot = '' -%}
{%- assign rg_snapshot_text = qso.our.exchange | append: '' -%}
{%- if qso.our.exchange == rg_snapshot_text -%}{%- assign rg_snapshot = rg_snapshot_text | strip -%}{%- endif -%}
{%- assign rg_group = rg_override -%}
{%- assign rg_snapshot_used = false -%}
{%- if rg_group == blank and rg_snapshot != blank -%}
  {%- assign rg_group = rg_snapshot -%}
  {%- assign rg_snapshot_used = true -%}
{%- endif -%}
{%- if rg_group == blank -%}
  {%- assign rg_serial_text = rg_qso.ourSerial | append: '' -%}
  {%- assign rg_item_text = rg_serial_text | strip -%}
  {%- assign rg_item = rg_item_text | plus: 0 -%}
  {%- assign rg_item_valid = false -%}
  {%- if rg_qso.ourSerial == rg_serial_text or rg_qso.ourSerial == rg_item -%}{%- assign rg_item_valid = true -%}{%- endif -%}
  {%- assign rg_digits = rg_item_text | split: '' -%}
  {%- for rg_digit in rg_digits -%}
    {%- unless '0123456789' contains rg_digit -%}{%- assign rg_item_valid = false -%}{%- endunless -%}
  {%- endfor -%}
  {%- if rg_item_valid and rg_item > 0 and rg_item <= 9007199254740991 -%}
    {%- assign rg_list_text = rg_op.txGroups | append: '' -%}
    {%- if rg_op.txGroups != rg_list_text -%}
      {%- for rg_candidate in rg_op.txGroups -%}
        {%- if forloop.index == rg_item -%}
          {%- assign rg_candidate_text = rg_candidate | append: '' -%}
          {%- if rg_candidate == rg_candidate_text -%}{%- assign rg_group = rg_candidate -%}{%- endif -%}
          {%- break -%}
        {%- endif -%}
      {%- endfor -%}
    {%- endif -%}
  {%- endif -%}
{%- endif -%}
{%- assign rg_size = rg_group | size -%}
{%- assign rg_valid = false -%}
{%- if rg_size == 5 -%}
  {%- assign rg_valid = true -%}
  {%- assign rg_alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' -%}
  {%- if rg_op.alphabet == 'letters' and rg_snapshot_used == false -%}{%- assign rg_alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' -%}{%- endif -%}
  {%- assign rg_chars = rg_group | split: '' -%}
  {%- for rg_char in rg_chars -%}
    {%- unless rg_alphabet contains rg_char -%}{%- assign rg_valid = false -%}{%- endunless -%}
  {%- endfor -%}
{%- endif -%}
`

export const KEYER_GROUP_TEMPLATE = `${selection}{%- if rg_valid -%}{{ rg_group }}{%- endif -%}`
export const KEYER_EXCHANGE_TEMPLATE = `${selection}{%- if rg_valid -%}{{ qso.rst | cut }} {{ rg_group }}{%- endif -%}`
