#pragma once
#include <Arduino.h>

class UAIUClient {
public:
  UAIUClient(const String& endpoint, const String& apiKey): endpoint(endpoint), apiKey(apiKey) {}
  bool submitReading(const String& readingJson);
private:
  String endpoint;
  String apiKey;
};
