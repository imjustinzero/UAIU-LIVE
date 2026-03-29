# Minimal MicroPython-friendly UAIU client
class UAIUClient:
    def __init__(self, endpoint, api_key):
        self.endpoint = endpoint
        self.api_key = api_key
        self.buffer = []

    def submit_reading(self, reading):
        self.buffer.append(reading)
        # network post intentionally simple; integrate urequests in firmware
        return {'buffered': len(self.buffer)}
