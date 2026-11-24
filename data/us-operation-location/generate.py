# Copyright ©️ 2026 Ham2K
# SPDX-License-Identifier: MPL-2.0
# /// script
# requires-python = ">=3.12"
# dependencies = ["pyshp==3.0.3"]
# ///

"""Rebuild the U.S. operation location provider's downloadable NDJSON snapshot.

From the repo root, run `mise run operation-location:regenerate`. The generator
downloads and verifies the pinned inputs. Use `--check` to compare with the
published snapshot and `--cache` to reuse previously downloaded sources.

Geometry: US Census Bureau TIGER/Line 2025 state and county shapefiles. Keep
all source vertices at 1e-5 degrees, rounded to the nearest integer. Drop
only duplicate vertices and rings that collapse at that precision.

Names: ARRL TrustedQSL 2.8.7's US_COUNTY configuration (11.35) supplies the
county name accepted by TQSL. Missing matches still keep their polygons.
Connecticut's current planning regions cannot stand for its historic counties.
"""

import argparse
from base64 import b64encode
from collections import defaultdict
import hashlib
from io import BytesIO
import json
from pathlib import Path
import shutil
import tarfile
from urllib.request import urlopen
import xml.etree.ElementTree as ET
import zipfile

import shapefile


STATE_INPUT = (
    'https://www2.census.gov/geo/tiger/TIGER2025/STATE/tl_2025_us_state.zip',
    '59a220888a8d9be8117c4fcd38f542bd02d81abf0d198c78113595ad540dd957',
)
COUNTY_INPUT = (
    'https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip',
    '9c6e9d9076abce2670d1de255de3710c35ecca00a7005d88e012dec52d95f763',
)
NAMES_INPUT = (
    'https://www.arrl.org/tqsl/tqsl-2.8.7.tar.gz',
    '666fa402794237c06d473ebb0fa4ec0642057682204a3a73386c40bec2ef82c7',
)
OUTPUT = Path(__file__).resolve().parent
CACHE = OUTPUT.parents[1] / 'build/us-operation-location-sources'
VERSION = 'tiger2025-tqsl11.35'
COORDINATE_SCALE = 100_000


def source_file(cache, input_spec):
    url, checksum = input_spec
    path = cache / url.rsplit('/', 1)[1]
    if path.exists():
        with path.open('rb') as source:
            if hashlib.file_digest(source, 'sha256').hexdigest() == checksum:
                return path
        raise ValueError(f'{path} does not match its pinned SHA-256')

    download = path.with_suffix(path.suffix + '.part')
    try:
        with urlopen(url, timeout=60) as response, download.open('wb') as output:
            shutil.copyfileobj(response, output)
        with download.open('rb') as source:
            if hashlib.file_digest(source, 'sha256').hexdigest() != checksum:
                raise ValueError(f'{url} does not match its pinned SHA-256')
        download.replace(path)
    finally:
        download.unlink(missing_ok=True)
    return path


def shapes(path):
    with zipfile.ZipFile(path) as archive:
        components = {ext: BytesIO(archive.read(f'{path.stem}.{ext}')) for ext in ('shp', 'shx', 'dbf')}
    with shapefile.Reader(**components) as reader:
        yield from reader.iterShapeRecords()


def trusted_counties(path):
    with tarfile.open(path) as archive:
        with archive.extractfile('tqsl-2.8.7/src/config.xml') as config:
            fields = ET.parse(config)
        with archive.extractfile('tqsl-2.8.7/LICENSE.txt') as license_file:
            notice = b''.join(line.rstrip() + b'\n' for line in license_file)
    counties = {}
    for state in fields.findall('.//field[@Id="US_COUNTY"]/enums'):
        aliases = defaultdict(set)
        for entry in state.findall('enum'):
            name = entry.attrib['value']
            for label in (name, entry.text or ''):
                aliases[label.casefold()].add(name)
        counties[state.attrib['dependency']] = aliases
    return counties, notice


def county_name(record, aliases):
    labels = [record['NAMELSAD']]
    # An independent city's base name may belong to a different county.
    if record['LSAD'] != '25':
        labels.append(record['NAME'])
    # TIGER calls Illinois FIPS 17039 "De Witt"; TQSL displays it as "DeWitt".
    if record['GEOID'] == '17039':
        labels.append('DeWitt')
    for label in labels:
        matches = aliases.get(label.casefold(), ())
        if matches:
            return next(iter(matches)) if len(matches) == 1 else ''
    return ''


def put_unsigned(output, value):
    while value >= 128:
        output.append(128 | (value & 127))
        value >>= 7
    output.append(value)


def put_signed(output, value):
    put_unsigned(output, 2 * value if value >= 0 else -2 * value - 1)


def quantized_ring(ring):
    points = []
    for longitude, latitude in ring:
        point = (round(longitude * COORDINATE_SCALE), round(latitude * COORDINATE_SCALE))
        if not points or point != points[-1]:
            points.append(point)
    if points and points[0] == points[-1]:
        points.pop()
    if len(points) >= 3 and any(
        abs(a[0] - b[0]) > 180 * COORDINATE_SCALE for a, b in zip(points, points[1:] + points[:1])
    ):
        raise ValueError('expected TIGER/Line polygons split at the antimeridian')
    return points


def encode_feature(name, geometry):
    # pyshp assigns interior rings to their exteriors in the GeoJSON view.
    polygons = geometry['coordinates']
    if geometry['type'] == 'Polygon':
        polygons = [polygons]
    elif geometry['type'] != 'MultiPolygon':
        raise ValueError(f"unexpected geometry type: {geometry['type']}")

    encoded_polygons = []
    for polygon in polygons:
        outer = quantized_ring(polygon[0])
        if len(outer) < 3:
            continue
        holes = [points for ring in polygon[1:] if len(points := quantized_ring(ring)) >= 3]
        encoded_polygons.append([outer, *holes])
    if not encoded_polygons:
        raise ValueError(f'no polygon remains for {name!r}')

    output = bytearray()
    encoded_name = name.encode('utf-8')
    put_unsigned(output, len(encoded_name))
    output.extend(encoded_name)
    put_unsigned(output, len(encoded_polygons))
    for polygon in encoded_polygons:
        put_unsigned(output, len(polygon))
        for points in polygon:
            put_unsigned(output, len(points))
            previous_x = previous_y = 0
            for x, y in points:
                put_signed(output, x - previous_x)
                put_signed(output, y - previous_y)
                previous_x, previous_y = x, y
    return output


def encode_features(features):
    output = bytearray(b'HSB1')
    put_unsigned(output, len(features))
    for _, feature in features:
        output.extend(feature)
    return b64encode(output).decode('ascii')


def build_snapshot(states, counties, bounds):
    rows = [{'key': 'index', 'version': VERSION, 'bounds': dict(sorted(bounds.items()))}]
    for state, feature in sorted(states.items()):
        rows.extend([
            {'key': f'state:{state}', 'version': VERSION, 'geometry': encode_features([(state, feature)])},
            {'key': f'county:{state}', 'version': VERSION, 'geometry': encode_features(sorted(counties[state]))},
        ])
    return ''.join(json.dumps(row, separators=(',', ':')) + '\n' for row in rows).encode()


def publish(snapshot, notice, check):
    for filename, content in [('operation-location-us.ndjson', snapshot), ('SOURCE-NOTICE.txt', notice)]:
        path = OUTPUT / filename
        if check:
            if not path.is_file() or path.read_bytes() != content:
                raise ValueError(f'{path} differs from the regenerated output')
        else:
            pending = path.with_suffix('.part')
            pending.write_bytes(content)
            pending.replace(path)
        print(f'{"Verified" if check else "Wrote"} {path}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=CACHE, help='directory for pinned source downloads')
    parser.add_argument('--check', action='store_true', help='verify output instead of writing it')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    states_path = source_file(args.cache, STATE_INPUT)
    counties_path = source_file(args.cache, COUNTY_INPUT)
    trusted_names, trusted_notice = trusted_counties(source_file(args.cache, NAMES_INPUT))

    state_codes = {}
    states = {}
    bounds = {}
    for item in shapes(states_path):
        fips, state = item.record['STATEFP'], item.record['STUSPS']
        # Territory FIPS codes start at 60. DC has a state field in ADIF.
        if int(fips) < 60:
            state_codes[fips] = state
            states[state] = encode_feature(state, item.shape.__geo_interface__)
            bounds[state] = [round(coordinate * COORDINATE_SCALE) for coordinate in item.shape.bbox]

    counties = defaultdict(list)
    seen_names = set()
    for item in shapes(counties_path):
        record = item.record
        state = state_codes.get(record['STATEFP'])
        if state is None:
            continue
        name = county_name(record, trusted_names.get(state, {}))
        if not name:
            print(f"No matching TQSL county for {state} {record['GEOID']} {record['NAMELSAD']}")
        else:
            if (state, name) in seen_names:
                raise ValueError(f'{state} {name} matched more than one county')
            seen_names.add((state, name))
        counties[state].append((record['GEOID'], encode_feature(name, item.shape.__geo_interface__)))

    if len(states) != 51 or set(counties) != set(state_codes.values()):
        raise ValueError('incomplete coverage of the 50 states and DC')

    sources = (
        'Geometry: U.S. Census Bureau TIGER/Line 2025 state and county shapefiles.\n'
        f'{STATE_INPUT[0]}\n{COUNTY_INPUT[0]}\n\n'
        f'County names: ARRL TrustedQSL 2.8.7 configuration 11.35.\n{NAMES_INPUT[0]}\n\n'
    )
    print(f'Encoded {len(states)} states and {sum(map(len, counties.values()))} county equivalents')
    snapshot = build_snapshot(states, counties, bounds)
    publish(snapshot, sources.encode() + trusted_notice, args.check)


if __name__ == '__main__':
    main()
