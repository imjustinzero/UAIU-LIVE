export type GatewayConfig = {
  UAIU_API_KEY: string;
  UAIU_DEVICE_IDS: string[];
  UAIU_ENDPOINT: string;
  LOCAL_DEVICES: any[];
  UPLOAD_INTERVAL_SECONDS: number;
  OFFLINE_BUFFER_MAX_READINGS: number;
  UPDATE_MODE: 'auto' | 'notify' | 'manual';
};

export function loadConfig(): GatewayConfig {
  return {
    UAIU_API_KEY: process.env.UAIU_API_KEY || '',
    UAIU_DEVICE_IDS: String(process.env.UAIU_DEVICE_IDS || '').split(',').map((v) => v.trim()).filter(Boolean),
    UAIU_ENDPOINT: process.env.UAIU_ENDPOINT || 'https://uaiu.live/x/api',
    LOCAL_DEVICES: [],
    UPLOAD_INTERVAL_SECONDS: Number(process.env.UPLOAD_INTERVAL_SECONDS || 60),
    OFFLINE_BUFFER_MAX_READINGS: Number(process.env.OFFLINE_BUFFER_MAX_READINGS || 10000),
    UPDATE_MODE: (process.env.GATEWAY_UPDATE_MODE as any) || 'notify',
  };
}
