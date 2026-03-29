# uaiu-sdk

```python
from uaiu_sdk import UAIUClient
client = UAIUClient('https://uaiu.live/x/api', 'device:secret')
client.submitReading({'deviceId':'dev-1','timestamp':'2026-03-29T00:00:00Z','readingType':'co2_ppm','value':420.0,'unit':'ppm'})
```
