#include <RCSwitch.h>
#include <WiFiS3.h>
#include "ThingSpeak.h"

// CONFIGURATION
const char* ssid = "RoseHouse";
const char* pass = "1512Rose";
unsigned long channelNumber = 3225633; 
const char * WriteAPIKey = "Y1BFKOJ2KKE64AQI";

// HARDWARE PINS
const int RF_PIN = 2;
const int BUZZER_PIN = 8;

// GLOBALS
RCSwitch mySwitch = RCSwitch();
WiFiClient  client;

// Logic Timers
unsigned long lastSignalTime = 0;
bool isSystemActive = false; 
int consecutiveCount = 0;

// CONSTANTS
const long WATCHDOG_TIMEOUT = 15000; // 15s Silence = All Clear
const long SEQUENCE_WINDOW = 6000;   // 6s Window = Same Visitor

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000);

  mySwitch.enableReceive(digitalPinToInterrupt(RF_PIN));
  pinMode(BUZZER_PIN, OUTPUT);
  
  // WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nConnected!");
  ThingSpeak.begin(client);
  
  // Reset Cloud on Boot
  ThingSpeak.setField(1, 0);
  ThingSpeak.writeFields(channelNumber, WriteAPIKey);
  Serial.println("=== GATEWAY READY: Watchdog & Doorbell Active ===");
}

void loop() {
  unsigned long currentTime = millis();

  // --- 1. RECEIVE SIGNAL ---
  if (mySwitch.available()) {
    int code = mySwitch.getReceivedValue();
    
    if (code > 0) {
      Serial.print("[ALERT] Received Code: ");
      Serial.println(code);

      // DOORBELL LOGIC
      // check if this signal is part of a sequence
      if (currentTime - lastSignalTime < SEQUENCE_WINDOW) {
         consecutiveCount++; // still here
      } else {
         consecutiveCount = 1; // new
      }

      // buzzer
      // only play chime if it's a Person (Code < 10) and they are lingering
      if (code < 10 && consecutiveCount >= 2) {
          Serial.println("Visitor Waiting -> Playing Chime");
          playChime();
      } else {
          // First time seeing them, or it's a dog/car
          soundAlarm(code);
      }

      // CLOUD UPLOAD
      ThingSpeak.setField(1, code);
      int x = ThingSpeak.writeFields(channelNumber, WriteAPIKey);
      if(x == 200) Serial.println("cloud updated");
      
      // reset times
      lastSignalTime = currentTime;
      isSystemActive = true;
    }
    
    mySwitch.resetAvailable();
    //  delay to prevent reading the exact same packet again
    delay(1000); 
  }

  // reset dashabord if nothing is being seen
  if (isSystemActive && (currentTime - lastSignalTime > WATCHDOG_TIMEOUT)) {
    Serial.println("[INFO] sending all clear.");
    
    ThingSpeak.setField(1, 0); // Send 0 (Safe)
    int x = ThingSpeak.writeFields(channelNumber, WriteAPIKey);
    
    if(x == 200) {
      Serial.println(">> cloud reset complete");
      isSystemActive = false; 
      consecutiveCount = 0; // Reset door count
    } else {
      Serial.println(">> cloud reset failed");
    }
  }
}

// --- SOUND EFFECTS ---

void soundAlarm(int code) {
  if (code < 10) { 
     // person rapid beeps for amount of people
     for(int i=0; i<code; i++) {
       digitalWrite(BUZZER_PIN, HIGH); delay(100);
       digitalWrite(BUZZER_PIN, LOW); delay(100);
     }
  } else { 
     // animals or cars just a short blip
     tone(BUZZER_PIN, 1200, 150); 
  }
}

void playChime() {
  // ding dong!!
  tone(BUZZER_PIN, 660, 500); // high
  delay(550);
  tone(BUZZER_PIN, 550, 800); // low
  delay(850);
  noTone(BUZZER_PIN);
}