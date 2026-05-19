#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 21
#define RST_PIN 22

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  delay(1000);
  SPI.begin();
  rfid.PCD_Init();
  
  Serial.println("\n\n=========================================");
  Serial.println("  TEST RESPONSIVITAS & GAIN ANTENA RFID  ");
  Serial.println("=========================================");
  Serial.println("Cara Pakai: Dekatkan kartu dari jarak jauh ke dekat.");
  Serial.println("Ketik angka (0-5) di Serial Monitor lalu Enter untuk mengubah Gain:");
  Serial.println("0 = 18 dB (Paling Lemah)");
  Serial.println("1 = 23 dB");
  Serial.println("2 = 33 dB (Default)");
  Serial.println("3 = 38 dB");
  Serial.println("4 = 43 dB");
  Serial.println("5 = 48 dB (Maksimal)");
  Serial.println("=========================================\n");
  
  rfid.PCD_SetAntennaGain(rfid.RxGain_33dB);
  Serial.println("-> Mode Awal Aktif: 2 (33 dB - Default)");
}

void loop() {
  // Cek input angka dari Serial Monitor
  if (Serial.available() > 0) {
    char inChar = Serial.read();
    if (inChar == '0') { rfid.PCD_SetAntennaGain(rfid.RxGain_18dB); Serial.println("\n>> Gain diubah ke 0 (18 dB)"); }
    else if (inChar == '1') { rfid.PCD_SetAntennaGain(rfid.RxGain_23dB); Serial.println("\n>> Gain diubah ke 1 (23 dB)"); }
    else if (inChar == '2') { rfid.PCD_SetAntennaGain(rfid.RxGain_33dB); Serial.println("\n>> Gain diubah ke 2 (33 dB - Default)"); }
    else if (inChar == '3') { rfid.PCD_SetAntennaGain(rfid.RxGain_38dB); Serial.println("\n>> Gain diubah ke 3 (38 dB)"); }
    else if (inChar == '4') { rfid.PCD_SetAntennaGain(rfid.RxGain_43dB); Serial.println("\n>> Gain diubah ke 4 (43 dB)"); }
    else if (inChar == '5') { rfid.PCD_SetAntennaGain(rfid.RxGain_max); Serial.println("\n>> Gain diubah ke 5 (48 dB - Maksimal)"); }
  }

  // Cek RFID (Tanpa ada delay atau WiFi yang menghambat)
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("💳 Kartu Terdeteksi! UID: ");
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) Serial.print("0");
      Serial.print(rfid.uid.uidByte[i], HEX);
    }
    Serial.println("  (Responsif & Lancar!)");
    
    // Jeda sedikit agar layar tidak terlalu penuh teks saat kartu ditempel
    delay(200); 
    
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
}
