#include <SPI.h>
#include <MFRC522.h>
#include "HX711.h"
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "time.h"

// ================= WIFI =================
#define WIFI_SSID "MalaikatIzrail"
#define WIFI_PASSWORD "12345678910"

// ================= FIREBASE =================
#define API_KEY "AIzaSyDhFtqvaTMgYH9vyAHFclDUXiOxkl-2GqM"
#define DATABASE_URL "https://silat-b3100-default-rtdb.firebaseio.com/"

#define USER_EMAIL "faniferdiyanto1980@gmail.com"
#define USER_PASSWORD "faniferdiyanto80"

// ================= PIN =================
#define SS_PIN 21
#define RST_PIN 22
#define DT_PIN 32
#define SCK_PIN 33

MFRC522 rfid(SS_PIN, RST_PIN);
HX711 scale;

// ================= FIREBASE =================
FirebaseData fbdo;
FirebaseData fbdoStream; // Dedicated stream object for test_command
FirebaseAuth auth;
FirebaseConfig config;
bool firebaseReady = false;

// ================= VARIABEL =================
float calibration_factor = 17740.0;
float offset_manual = 0.10;
float alpha = 0.95;     // Ditingkatkan agar merespon lebih cepat / instan
float threshold = 2.5;  // PERBAIKAN: Dinaikkan ke 2.5 KG agar lebih aman dari noise dan pergeseran mekanis
float smoothedWeight = 0; 
float peakValue = 0;

// Test variables
String currentTestUID = "";
int currentAttempt = 1;
String currentStrikeType = "pukulan"; // Default
bool isTesting = false;
unsigned long testStartTime = 0;
unsigned long firstHitTime = 0; // Waktu saat pukulan pertama dideteksi
String handledCommand = "";     // Menghindari pengulangan perintah yang sama
const unsigned long TEST_DURATION = 5000;

float graphData[100];
int graphIndex = 0;

// Timer Optimasi
unsigned long lastFirebaseUpdate = 0;
const unsigned long FIREBASE_UPDATE_INTERVAL = 300; // Lebih cepat: 100ms
unsigned long lastSampleTime = 0;
const unsigned long SAMPLING_INTERVAL = 30;          // Lebih cepat: 30ms

// PERBAIKAN: Throttle checkTestCommand agar tidak blocking setiap loop
unsigned long lastCommandCheck = 0;
const unsigned long COMMAND_CHECK_INTERVAL = 500; // Cek perintah setiap 500ms saja

// ================= DATA LOGGING =================
String getUID() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov", "time.google.com");
  Serial.print("Sync time");
  time_t now = time(nullptr);
  int attempts = 0;
  while (now < 100000 && attempts < 40) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }
  if (now >= 100000) Serial.println("\n✅ Time synchronized");
  else Serial.println("\n⚠️ Time sync failed");
}

void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  config.timeout.serverResponse = 10000;

  // PERBAIKAN: Memperbesar buffer TX menjadi 4096 byte agar mampu menampung paket JSON grafik sekaligus!
  fbdo.setBSSLBufferSize(4096, 4096);
  fbdo.setResponseSize(2048);
  fbdoStream.setBSSLBufferSize(2048, 512);

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("🔥 Firebase Initialized");
}

void updateSensorStatus() {
  if (firebaseReady) {
   // Tulis Unix timestamp agar dashboard bisa deteksi kapan terakhir aktif
    time_t now = time(nullptr);
    Firebase.RTDB.setString(&fbdo, "/system/sensor_status", "Online");
    Firebase.RTDB.setInt(&fbdo, "/system/last_seen", (int)now);
  }
}

void handleRFIDScan() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  String uid = getUID();
  Serial.println("RFID detected: " + uid);
  Firebase.RTDB.setString(&fbdo, "/system/last_scanned", uid);
  delay(1000);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

float kgToNewton(float kg) { return kg * 9.81; }

void checkTestCommand() {
  if (isTesting) return;

  if (millis() - lastCommandCheck < COMMAND_CHECK_INTERVAL) return;
  lastCommandCheck = millis();

  if (Firebase.RTDB.get(&fbdoStream, "/test_command")) {
    String command = fbdoStream.stringData();

    // PERBAIKAN: Hanya jalan jika perintah baru (cegah loop otomatis)
    if (command != "" && command != "null" && command != handledCommand && command.indexOf('|') > 0) {
      handledCommand = command; // Tandai perintah sudah ditangani
      
      int firstSep = command.indexOf('|');
      int secondSep = command.indexOf('|', firstSep + 1);
      
      currentTestUID = command.substring(0, firstSep);
      
      if (secondSep > 0) {
        currentAttempt = command.substring(firstSep + 1, secondSep).toInt();
        currentStrikeType = command.substring(secondSep + 1);
      } else {
        currentAttempt = command.substring(firstSep + 1).toInt();
        currentStrikeType = "pukulan"; // Fallback
      }

      Serial.println("--- TEST STARTED ---");
      Serial.print("UID: "); Serial.println(currentTestUID);
      Serial.print("Attempt: "); Serial.println(currentAttempt);
      Serial.print("Type: "); Serial.println(currentStrikeType);

      isTesting = true;
      testStartTime = millis();
      firstHitTime = 0; 
      peakValue = 0;
      smoothedWeight = 0;
      graphIndex = 0;
      memset(graphData, 0, sizeof(graphData));

      Firebase.RTDB.setFloat(&fbdo, "/realtime/current_force", 0);
      Firebase.RTDB.setFloat(&fbdo, "/realtime/peak_force", 0);
      Firebase.RTDB.setString(&fbdo, "/system/test_status", "measuring");
      Firebase.RTDB.setString(&fbdo, "/test_command", ""); // Bersihkan perintah

      // PERBAIKAN: Reset angka di layar dan nol-kan sensor tepat sebelum mulai
      FirebaseJson rtReset;
      rtReset.set("current_force", 0);
      rtReset.set("peak_force", 0);
      Firebase.RTDB.updateNode(&fbdo, "/realtime", &rtReset);
      
      scale.tare(); // Nol-kan sensor untuk menghilangkan drift dari pukulan sebelumnya
    }
  }
}

void sendRealtimeData() {
  if (!isTesting || !firebaseReady) return;

  if (millis() - lastFirebaseUpdate > FIREBASE_UPDATE_INTERVAL) {
    lastFirebaseUpdate = millis();

    float newton = kgToNewton(smoothedWeight);
    float peakNewton = kgToNewton(peakValue);

    // MENGGUNAKAN Async DENGAN UPDATE NODE UNTUK MENGURANGI SPAM (Mencegah SSL Crash)
    FirebaseJson rtJson;
    rtJson.set("current_force", newton);
    rtJson.set("peak_force", peakNewton);
    Firebase.RTDB.updateNodeAsync(&fbdo, "/realtime", &rtJson);

    // PENGIRIMAN GRAFIK REALTIME DIHAPUS: 
    // Mengirim titik grafik satu-per-satu setiap 300ms ke Firebase membebani memori SSL (menyebabkan Error mRunUntil).
    // Grafik akan langsung dikirim sekaligus dalam format JSON pada saat SaveResult (jauh lebih cepat & aman).
  }
}

void saveTestResult() {
  if (!firebaseReady) return;
  float peakNewton = kgToNewton(peakValue);

  // Jika diberhentikan manual / tidak ada benturan
  if (peakValue <= threshold) {
    Serial.println("⚠️ No impact detected, skipping save.");
    // Gunakan JSON agar reset dikirim dalam 1x request cepat (mencegah error SSL)
    FirebaseJson resetJson;
    resetJson.set("realtime/current_force", 0);
    resetJson.set("realtime/peak_force", 0);
    resetJson.set("system/test_status", "idle");
    resetJson.set("test_command", "");
    
    // PERBAIKAN: Hanya bersihkan memori Anti-Spam JIKA perintah reset berhasil dikirim ke Firebase!
    // Ini mencegah "tombol mulai ngeklik sendiri" jika internet sempat putus.
    if (Firebase.RTDB.updateNode(&fbdo, "/", &resetJson)) {
      handledCommand = ""; 
    } else {
      Serial.println("❌ Gagal mereset status, mencegah infinite loop.");
    }
    return;
  }

  Serial.println("--- SAVING RESULT ---");
  String historyPath = "/test_history/" + currentTestUID + "/attempt_" + String(currentAttempt);

  // 1. Gabungkan semua data histori dalam 1 Paket JSON!
  FirebaseJson historyJson;
  historyJson.set("peak_kg", peakValue);
  historyJson.set("peak_newton", peakNewton);
  historyJson.set("type", currentStrikeType);
  historyJson.set("timestamp", millis());
  
  FirebaseJson graphJson;
  for (int i = 0; i < graphIndex && i < 100; i++) {
    graphJson.set(String(i), graphData[i]);
  }
  historyJson.set("graph", graphJson);
  Firebase.RTDB.setJSON(&fbdo, historyPath, &historyJson);

  // 2. Tampilkan hasil akhir di layar besar (Persistence) ditangani oleh Website
  // menggunakan data dari histori di atas, sehingga kita tidak perlu kirim ulang ke realtime/current_force
  // hal ini mencegah munculnya "puncak ganda" di grafik.

  // 3. Reset Status Sistem
  FirebaseJson statusReset;
  statusReset.set("system/test_status", "idle");
  statusReset.set("test_command", "");
  
  if (Firebase.RTDB.updateNode(&fbdo, "/", &statusReset)) {
    handledCommand = ""; 
  }
  Serial.println("✅ Result Saved!");
}

void readLoadcell() {
  if (!scale.is_ready()) return;

  float raw = scale.get_units(1);
  raw = raw + offset_manual; // Tambahkan hasil offset kalibrasi Anda
  
  if (raw < 0) raw = 0; // Abaikan minus

  // PERBAIKAN: Potong semua getaran ringan (di bawah 1.5 KG) menjadi 0.
  // Ini mencegah munculnya angka "1" atau "2" Newton di layar akibat noise sensor!
  if (raw < threshold) {
    raw = 0;
  }

  // KUNCI RESPONSIVITAS: Gunakan data mentah (raw) untuk mendeteksi puncak, bukan data yang sudah dihaluskan!
  if (raw > peakValue) peakValue = raw;

  smoothedWeight = (alpha * raw) + ((1 - alpha) * smoothedWeight);
  if (smoothedWeight < threshold) smoothedWeight = 0;
  
  if (isTesting && millis() - lastSampleTime > SAMPLING_INTERVAL) {
    lastSampleTime = millis();
    if (graphIndex < 100) {
      graphData[graphIndex] = kgToNewton(raw); // Gunakan raw juga agar grafik tidak terpotong (halus akan menahan data sejenak)
      graphIndex++;
    }
  }

  if (isTesting) {
    sendRealtimeData();

    // 1. Deteksi Pukulan Pertama (Auto-Stop Trigger)
    if (raw > threshold && firstHitTime == 0) {
      firstHitTime = millis();
      Serial.println("🎯 Impact detected! Auto-stop in 3 seconds...");
    }

    // 2. Cek Auto-Stop (3 detik setelah pukulan)
    if (firstHitTime > 0 && (millis() - firstHitTime > 3000)) {
      Serial.println("⏹️ Auto-stop triggered");
      isTesting = false;
      saveTestResult();
      firstHitTime = 0;
    } 
    // 3. PERBAIKAN: Ganti pengecekan tombol Stop manual dengan Timeout otomatis (30 detik)
    // Ini menghilangkan proses "blocking" saat mengambil data dari Firebase yang bikin Pukulan Delay!
    else if (firstHitTime == 0 && (millis() - testStartTime > 30000)) {
      Serial.println("⏳ Timeout, no impact detected.");
      isTesting = false;
      saveTestResult();
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  
  syncTime();
  initFirebase();
  while (!Firebase.ready()) delay(100);
  firebaseReady = true;

  Firebase.RTDB.setString(&fbdo, "/system/test_status", "idle");
  Firebase.RTDB.setString(&fbdo, "/test_command", "");

  SPI.begin();
  rfid.PCD_Init();
  
  // PERBAIKAN: Kekuatan antena RFID
  // Disetel ke 38dB sesuai hasil pengetesan. Level ini paling stabil dan responsif 
  // untuk menembus kotak plastik 2mm tanpa membuat modul RC522 crash/blank.
  rfid.PCD_SetAntennaGain(rfid.RxGain_38dB);
  
  scale.begin(DT_PIN, SCK_PIN);
  delay(2000);
  
  // Set kalibrasi dengan angka yang sudah fix
  scale.set_scale(calibration_factor);
  scale.tare();

  Serial.println("🚀 SYSTEM READY");
}

void loop() {
  if (Firebase.ready()) {
    readLoadcell();
    checkTestCommand();
    
    static unsigned long lastStatusUpdate = 0;
    if (millis() - lastStatusUpdate > 10000) {
      lastStatusUpdate = millis();
      updateSensorStatus();
    }

    if (!isTesting) {
      handleRFIDScan();
    }
  }
}
