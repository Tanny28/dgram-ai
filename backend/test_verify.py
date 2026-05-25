from fastapi.testclient import TestClient
from app import app

c = TestClient(app)
tests = [
    'RC low-pass filter with 1kOhm and 100nF',
    'voltage divider 12V across 1kOhm and 2kOhm',
    'flowchart for binary search algorithm',
    'free body diagram of a block on an incline',
    'system architecture block diagram',
]
for p in tests:
    d = c.post('/api/generate', json={'prompt': p}).json()
    has = len(d['image_b64']) > 0 or len(d['mermaid_code']) > 0
    status = 'PASS' if has else 'FAIL'
    print(f"{status} | {d['kind']:10} | {p[:45]}")
