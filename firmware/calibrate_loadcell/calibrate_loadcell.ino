#include "HX711.h"

// Pin disesuaikan dengan ESP32 Anda di impact_monitor.ino
#define DT_PIN 32
#define SCK_PIN 33

HX711 scale;

// Silakan sesuaikan nilai ini untuk load cell 50kg saat melakukan kalibrasi
float calibration_factor = 103.8; 
float threshold = 2.0;

unsigned long emptyStartTime = 0;
bool isEmpty = false;

void setup() {
  Serial.begin(115200);
  delay(1000);

  scale.begin(DT_PIN, SCK_PIN);

  Serial.println("Jangan ada beban...");
  delay(3000);

  scale.set_scale(calibration_factor);
  scale.tare();

  Serial.println("Timbangan siap!");
}

void loop() {
  float berat = scale.get_units(20);

  // === DETEKSI KONDISI KOSONG ===
  if (abs(berat) < threshold) {

    if (!isEmpty) {
      // baru masuk kondisi kosong
      emptyStartTime = millis();
      isEmpty = true;
    }

    // kalau sudah kosong selama 2 detik → tare
    if (millis() - emptyStartTime > 2000) {
      scale.tare();
      berat = 0;
    }

  } else {
    // ada beban → reset status kosong
    isEmpty = false;
  }

  float berat_kg = berat / 1000.0;

  Serial.print("Berat: ");
  Serial.print(berat_kg, 1);
  Serial.println(" kg");

  delay(300);
}
