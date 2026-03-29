import json
import time
from urllib import request

class UAIUClient:
    def __init__(self, endpoint: str, api_key: str, private_key: str | None = None):
        self.endpoint = endpoint.rstrip('/')
        self.api_key = api_key
        self.private_key = private_key

    def registerDevice(self, payload: dict):
        return self._post('/iot/devices/register', payload)

    def submitReading(self, reading: dict):
        return self._post('/iot/readings', self._sign(reading))

    def batchSubmit(self, readings: list[dict]):
        return self._post('/iot/readings/batch', {'readings': [self._sign(r) for r in readings]})

    def _sign(self, reading: dict):
        if not self.private_key:
            return reading
        reading = dict(reading)
        reading['signature'] = f"signed:{reading.get('deviceId','')}"
        return reading

    def _post(self, path: str, body: dict, attempt: int = 0):
        req = request.Request(
            f"{self.endpoint}{path}",
            data=json.dumps(body).encode(),
            headers={'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with request.urlopen(req) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt < 3:
                time.sleep((2 ** attempt) * 0.5)
                return self._post(path, body, attempt + 1)
            raise RuntimeError(f'UAIU request failed: {e}')
