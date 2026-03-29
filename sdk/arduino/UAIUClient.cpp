#include "UAIUClient.h"

bool UAIUClient::submitReading(const String& readingJson) {
  // Stub transport for WiFi/cellular stack integration.
  return readingJson.length() > 0;
}
