#include "HX711.h"

// PIN HX711 ke ESP32
#define DT_PIN 32
#define SCK_PIN 33

HX711 scale;

// ⚠️ Mode Kalibrasi Multi-Titik (Piecewise Linear)
// Rumus tunggal diganti dengan pemetaan khusus agar 1.1, 1.8, dan 3.65 akurat semua.

// Batas nol (anti noise)
float zero_threshold = 0.2;

// Fungsi Kalibrasi Multi-Titik untuk menyelaraskan semua beban
float hitung_berat_akurat(float raw) {
  float r0 = 0.0, w0 = 0.0;
  float r1 = 20185.0, w1 = 1.1;
  float r2 = 30154.0, w2 = 1.8;
  float r3 = 62972.0, w3 = 3.65;
  
  if (raw <= r0) return 0.0;
  if (raw <= r1) return w0 + (raw - r0) * (w1 - w0) / (r1 - r0);
  if (raw <= r2) return w1 + (raw - r1) * (w2 - w1) / (r2 - r1);
  if (raw <= r3) return w2 + (raw - r2) * (w3 - w2) / (r3 - r2);
  
  // Ekstrapolasi untuk beban lebih dari 3.65kg (Pukulan)
  return w3 + (raw - r3) * (w3 - w2) / (r3 - r2); 
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  scale.begin(DT_PIN, SCK_PIN);

  Serial.println("=== LOADCELL START ===");
  Serial.println("Pastikan TIDAK ADA BEBAN di timbangan");
  delay(3000);

  // Set kalibrasi ke 1 karena kita menghitung manual berdasarkan nilai mentah (raw)
  scale.set_scale(1.0);

  // Jadikan posisi sekarang = 0
  scale.tare();

  Serial.println("Timbangan SIAP!");
}

void loop() {
  // Gunakan 1 kali bacaan nilai mentah (raw value) tanpa jeda
  float raw = scale.get_value(1); 

  // Hitung berat menggunakan pemetaan multi-titik
  float berat = hitung_berat_akurat(raw);

  // =========================
  // FILTER AGAR 0 BERSIH
  // =========================
  // Jika sering tidak kembali ke 0 (nyangkut di 0.3 atau 0.4), naikkan zero_threshold di atas!
  if (abs(berat) < zero_threshold) {
    berat = 0;
  } else if (berat < 0) {
    berat = 0; // Abaikan kalau minus
  }

  // =========================
  // TAMPILKAN HASIL
  // =========================
  Serial.print("Berat: ");
  Serial.print(berat, 2);
  Serial.println(" kg");

  delay(100); // Dipercepat agar kembalinya ke 0 terlihat seketika
}
