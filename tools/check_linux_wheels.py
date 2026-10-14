"""Check published pinned CPython 3.14 Linux x86_64 wheel URLs; do not install."""
import json
from pathlib import Path
from urllib.request import urlopen
from html.parser import HTMLParser
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(value for key, value in attrs if key == 'href')


def main():
    records = {}
    for name, version in [('torch', '2.11.0'), ('torchvision', '0.26.0'), ('torchaudio', '2.11.0')]:
        url = f'https://download.pytorch.org/whl/cpu/{name}/'
        with urlopen(url, timeout=45) as response:
            parser = Links(); parser.feed(response.read().decode())
        matches = [link for link in parser.links if f'{name}-{version}+cpu-cp314-cp314-' in unquote(link) and 'linux' in link and 'x86_64' in link]
        if not matches:
            raise ValueError(f'No pinned Linux cp314 CPU wheel: {name}')
        records[name] = {'version': version+'+cpu', 'source': url, 'wheel_urls': matches}
    for name, version in [('numpy', '2.5.3'), ('soundfile', '0.14.0'), ('fastapi', '0.143.0'), ('uvicorn', '0.54.0'), ('python-multipart', '0.0.32')]:
        url = f'https://pypi.org/pypi/{name}/{version}/json'
        with urlopen(url, timeout=45) as response:
            data = json.load(response)
        matches = [x['url'] for x in data['urls'] if x['filename'].endswith('.whl') and
                   (x['filename'].endswith('none-any.whl') or ('x86_64' in x['filename'] and 'manylinux' in x['filename'] and ('cp314-cp314' in x['filename'] or 'py2.py3-none' in x['filename'])))]
        if not matches:
            raise ValueError(f'No compatible Linux wheel: {name}')
        records[name] = {'version': version, 'source': url, 'requires_python': data['info']['requires_python'], 'wheel_urls': matches}
    output = ROOT/'docs/render/linux-wheel-check.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'scope': 'Published direct dependency wheels only; not a full resolver, installation or Linux runtime test.', 'packages': records}, indent=2)+'\n')
    print('PASS: direct pinned dependencies publish Linux-compatible CPython 3.14 wheels')


if __name__ == '__main__':
    main()
