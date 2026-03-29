#include <UAIUClient.h>
UAIUClient client("https://uaiu.live/x/api", "device:secret");
void setup(){ Serial.begin(115200); }
void loop(){ client.submitReading("{\"readingType\":\"temperature_c\",\"value\":24.1}"); delay(60000); }
