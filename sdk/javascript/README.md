# @uaiu/sdk

```ts
import { UAIUClient } from '@uaiu/sdk';
const client = new UAIUClient({ endpoint: 'https://uaiu.live/x/api', apiKey: 'device:secret' });
await client.submitReading({ deviceId:'dev-1', timestamp:new Date().toISOString(), readingType:'temperature_c', value:24.1, unit:'°C' });
```
