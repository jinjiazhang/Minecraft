"""Inspect/download selected members of the city's large ZIP without fetching 2 GB.

Source: City of Helsinki, Helsinki 3D Mesh 2017, CC BY 4.0.
TLS verification is on by default. The explicit exception only applies to
the public city's mesh host (its certificate expired when checked).
"""
import argparse
import io
import json
import re
from pathlib import Path
import ssl
import urllib.request
import zipfile

URL = 'https://3d.hel.ninja/data/mesh/Helsinki3D-MESH_2017_OBJ_2km-250m_ZIP/Helsinki3D_2017_OBJ_674496x2.zip'


class RemoteZip(io.RawIOBase):
    def __init__(self, url, allow_expired=False):
        self.url = url
        self.context = ssl._create_unverified_context() if allow_expired else ssl.create_default_context()
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), context=self.context, timeout=30) as r:
            self.size = int(r.headers['Content-Length'])
        self.pos = 0
        self.cache_start = -1
        self.cache = b''

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else (self.pos if whence == 1 else self.size) + offset
        if self.pos < 0:
            raise ValueError('Negative offset')
        return self.pos

    def read(self, count=-1):
        count = self.size-self.pos if count < 0 else min(count, self.size-self.pos)
        if count <= 0:
            return b''
        if self.cache_start <= self.pos and self.pos + count <= self.cache_start + len(self.cache):
            result = self.cache[self.pos-self.cache_start:self.pos-self.cache_start+count]
            self.pos += count
            return result
        start, end = self.pos, min(self.size-1, self.pos+max(count, 262144)-1)
        req = urllib.request.Request(self.url, headers={'Range': f'bytes={start}-{end}'})
        with urllib.request.urlopen(req, context=self.context, timeout=60) as r:
            if r.status != 206 or not r.headers.get('Content-Range', '').startswith(f'bytes {start}-{end}/'):
                raise RuntimeError('Server did not honor range request')
            result = r.read(end-start+1)
        if len(result) != end-start+1:
            raise IOError('Incomplete range response')
        self.cache_start, self.cache = start, result
        self.pos += count
        return result[:count]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-expired-source-cert', action='store_true')
    parser.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[1] / 'data')
    parser.add_argument('--match', help='Download members containing this exact substring')
    parser.add_argument('--regex', help='Download members matching a regular expression')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(RemoteZip(URL, args.allow_expired_source_cert)) as archive:
        members = [{'name': z.filename, 'bytes': z.file_size, 'compressed_bytes': z.compress_size} for z in archive.infolist()]
        (args.out/'archive-index.json').write_text(json.dumps({'source': URL, 'license': 'CC BY 4.0', 'year': 2017, 'tls_verified': not args.allow_expired_source_cert, 'members': members}, indent=2), encoding='utf-8')
        if not args.match and not args.regex:
            print(json.dumps(members[:25], indent=2))
            print(f'{len(members)} members; complete index saved')
            return
        for info in archive.infolist():
            selected = (args.match and args.match in info.filename) or (args.regex and re.search(args.regex, info.filename))
            if not selected or info.is_dir():
                continue
            target = (args.out / info.filename).resolve()
            if not target.is_relative_to(args.out.resolve()):
                raise ValueError('Unsafe archive path')
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists() and target.stat().st_size == info.file_size:
                print(f'Cached {info.filename}', flush=True)
                continue
            data = archive.read(info)  # zipfile verifies CRC before writing
            target.write_bytes(data)
            print(f'Saved {info.filename}: {len(data)} bytes', flush=True)


if __name__ == '__main__':
    main()
