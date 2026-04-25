#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// ====================================================================
// CONFIGURE CLASSROOM HERE BEFORE FLASHING
// Replace the UUID prefix with the actual room number to keep it organized
// ====================================================================
#define ROOM_NAME "Room-C2-Beacon"

// Example: Using "00C2" in the first block to represent Room C2
#define ROOM_UUID "000000C2-0000-1000-8000-00805f9b34fb" 
// ====================================================================

void setup() {
  Serial.begin(115200);
  Serial.printf("Starting ESP32 Attendance Anchor for %s...\n", ROOM_NAME);

  // Initialize hardware with the specific room name
  BLEDevice::init(ROOM_NAME);

  // Set up the broadcasting channel
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(ROOM_UUID);
  pService->start();

  // Configure the advertising packet
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(ROOM_UUID);
  pAdvertising->setScanResponse(true);
  
  // OS-compatibility parameters for stability
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  
  // Start shouting into the void
  pAdvertising->start();
  
  Serial.println("-------------------------------------------");
  Serial.printf("BEACON LIVE: Broadcasting UUID %s\n", ROOM_UUID);
  Serial.println("-------------------------------------------");
}

void loop() {
  // The Bluetooth stack handles the broadcasting automatically.
  // The main loop just sleeps to save power.
  delay(10000); 
}