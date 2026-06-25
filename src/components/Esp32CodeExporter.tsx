import { useState } from "react";
import { Cpu, FileCode, Check, Copy } from "lucide-react";

export default function Esp32CodeExporter() {
  const [copied, setCopied] = useState(false);

  const espCode = `/* =========================================================================
   SMART WET WASTE SEGREGATION & LIQUID SEPARATION SYSTEM
   ESP32 Micro-controller Telemetry & Control Firmware
   ========================================================================= */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// 1. Wi-Fi Configuration
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// 2. Server API Route Configuration (AI Studio Cloud Run Instance)
const char* serverApiUrl = "https://your-aistudio-service-url/api/sensors/update";

// 3. Pin Definitions
// Ultrasonic Sensors (Trigger & Echo Pairs, no moisture sensor utilized)
#define TRIG1 12 // Dustbin 1
#define ECHO1 13
#define TRIG2 14 // Dustbin 2
#define ECHO2 27
#define TRIG3 15 // Liquid Tank
#define ECHO3 16

// Slurry Pump Relays
#define PUMP1_PIN 17 // Water Injector Slurry Pump 
#define PUMP2_PIN 18 // Liquid Separation Vacuum Pump

// Accessory Elements
#define BUZZER_PIN 19

// 4. Actuator Objects
Servo servo1; // Agitation arm 1
Servo servo2; // Agitation arm 2
Servo servo3; // Gate 1: Large solids discharge
Servo servo4; // Gate 2: Fine solids discharge

#define SERVO1_PIN 21
#define SERVO2_PIN 22
#define SERVO3_PIN 23
#define SERVO4_PIN 25

// LCD I2C Setup: Address 0x27, 16 Cols, 2 Lines
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Timing Parameters
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryIntervalMs = 5000; // Dispatch cycles every 5 seconds

// Helper function to calculate distance using Ultrasonic Sensor
float getUltrasonicDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout
  if (duration == 0) return 999.0; // Out of bounds indicator
  
  // Calculate raw distance in cm
  return (duration * 0.0343) / 2.0;
}

void setup() {
  Serial.begin(115200);

  // Initialize Pin Modes
  pinMode(TRIG1, OUTPUT); pinMode(ECHO1, INPUT);
  pinMode(TRIG2, OUTPUT); pinMode(ECHO2, INPUT);
  pinMode(TRIG3, OUTPUT); pinMode(ECHO3, INPUT);
  pinMode(PUMP1_PIN, OUTPUT);
  pinMode(PUMP2_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Default turn-off relays (Active Low or High depending on breakout board)
  digitalWrite(PUMP1_PIN, LOW);
  digitalWrite(PUMP2_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Attach Servo Motors
  servo1.attach(SERVO1_PIN);
  servo2.attach(SERVO2_PIN);
  servo3.attach(SERVO3_PIN);
  servo4.attach(SERVO4_PIN);

  // Ground Servos
  servo1.write(0);
  servo2.write(0);
  servo3.write(0);
  servo4.write(0);

  // Initialize LCD Screen
  Wire.begin(26, 25); // custom i2c pin mappings for ESP32 standard breakout if needed
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("WET WASTE SEG.");
  lcd.setCursor(0, 1);
  lcd.print("BOOTING WIFI...");

  // Establish Wi-Fi Connection
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nConnected successfully!");
  lcd.setCursor(0, 1);
  lcd.print("WIFI OK. ONLINE  ");
  delay(1000);
}

void loop() {
  unsigned long currentTime = millis();
  
  // Keep Telemetry schedule
  if (currentTime - lastTelemetryTime >= telemetryIntervalMs) {
    lastTelemetryTime = currentTime;
    
    if (WiFi.status() == WL_CONNECTED) {
      // 1. Gather distance readings in cm
      float d1 = getUltrasonicDistance(TRIG1, ECHO1);
      float d2 = getUltrasonicDistance(TRIG2, ECHO2);
      float d3 = getUltrasonicDistance(TRIG3, ECHO3);

      Serial.printf("Sensors: D1=%.1fcm, D2=%.1fcm, D3=%.1fcm\\n", d1, d2, d3);

      // 2. Prepare JSON Payload
      StaticJsonDocument<300> doc;
      doc["ultrasonic1"] = d1;
      doc["ultrasonic2"] = d2;
      doc["ultrasonic3"] = d3;
      doc["esp32Name"] = "Smart Segregator Core v1";

      String requestData;
      serializeJson(doc, requestData);

      // 3. Issue Post Request
      HTTPClient http;
      http.begin(serverApiUrl);
      http.addHeader("Content-Type", "application/json");

      int responseCode = http.POST(requestData);
      
      if (responseCode > 0) {
        String responsePayload = http.getString();
        Serial.println("Response Payload:");
        Serial.println(responsePayload);

        // 4. Parse incoming server actuator commands
        StaticJsonDocument<500> respDoc;
        DeserializationError err = deserializeJson(respDoc, responsePayload);
        
        if (!err && respDoc.containsKey("actuators")) {
          JsonObject act = respDoc["actuators"];
          
          // Servo controllers
          int s1_angle = act["servo1"];
          int s2_angle = act["servo2"];
          int s3_angle = act["servo3"];
          int s4_angle = act["servo4"];
          
          servo1.write(s1_angle);
          servo2.write(s2_angle);
          servo3.write(s3_angle);
          servo4.write(s4_angle);

          // Slurry pumps
          digitalWrite(PUMP1_PIN, act["pump1"] == 1 ? HIGH : LOW);
          digitalWrite(PUMP2_PIN, act["pump2"] == 1 ? HIGH : LOW);

          // Piezo buzzer alert
          digitalWrite(BUZZER_PIN, act["buzzer"] == 1 ? HIGH : LOW);

          // LCD Display status
          const char* lcdMsg = act["lcd"];
          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("SYSTEM STATUS:");
          lcd.setCursor(0, 1);
          lcd.print(lcdMsg);
        }
      } else {
        Serial.print("API post failed, response status: ");
        Serial.println(responseCode);
        lcd.setCursor(0, 1);
        lcd.print("API CON ERROR   ");
      }
      http.end();
    } else {
      Serial.println("WiFi dropped. Reconnecting...");
      lcd.setCursor(0,1);
      lcd.print("WIFI DISCONNECTED");
      WiFi.disconnect();
      WiFi.reconnect();
    }
  }
}
`;

  const copyCode = () => {
    navigator.clipboard.writeText(espCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="esp32-code-card" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Cpu className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-white">ESP32 Arduino Firmware Core</h3>
            <p className="text-[11px] text-gray-500">Copy this code into your Arduino IDE to program the physical machine</p>
          </div>
        </div>
        
        <button
          id="copy-esp-btn"
          onClick={copyCode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#161b22] text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-700/50 transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied Firmware Code</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy C++ Code</span>
            </>
          )}
        </button>
      </div>

      <div className="relative">
        <pre className="p-5 font-mono text-[11px] bg-black/50 overflow-x-auto text-indigo-300 rounded-xl leading-relaxed border border-gray-800 h-[340px] shadow-inner">
          <code>{espCode}</code>
        </pre>
        {/* Scroll shade box */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#13151a] to-transparent pointer-events-none rounded-b-xl" />
      </div>
      
      <div className="bg-[#161b22] border border-gray-700/40 p-3.5 rounded-lg text-xs text-gray-400 leading-normal">
        <p className="font-semibold text-white mb-1">🛠️ Device Installation Rules:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Ensure the <strong className="text-emerald-400">ArduinoJson</strong> and <strong className="text-emerald-400">ESP32Servo</strong> libraries are installed in Arduino IDE.</li>
          <li>Substitute custom PIN layouts under the <code>Pin Definitions</code> lines as per your hardware configuration.</li>
          <li>No internal high-maintenance Moisture sensor is used. Only clean distance and volumetric calculations run directly on the client telemetry routes.</li>
        </ul>
      </div>
    </div>
  );
}
