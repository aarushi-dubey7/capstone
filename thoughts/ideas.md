ESP32 BLE Attendance Beacon Explained

what does this code do?

#include <BLEDevice.h>

#include <BLEUtils.h>

#include <BLEServer.h>



// This UUID must match what your website is looking for!

#define SERVICE_UUID "0000181c-0000-1000-8000-00805f9b34fb"



void setup() {

Serial.begin(115200);

Serial.println("Starting ESP32 Attendance Anchor...");



// 1. Initialize the Bluetooth hardware

BLEDevice::init("Attendance-Anchor-101");



// 2. Create the Server (The "Brain" of the BLE)

BLEServer *pServer = BLEDevice::createServer();



// 3. Create the Service (The "Channel" students listen to)

BLEService *pService = pServer->createService(SERVICE_UUID);



// 4. Start the Service

pService->start();



// 5. Setup Advertising (This makes the device visible to Chromebooks)

BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();

pAdvertising->addServiceUUID(SERVICE_UUID);

pAdvertising->setScanResponse(true);


// Helps with connection stability on Macs/Chromebooks

pAdvertising->setMinPreferred(0x06);

pAdvertising->setMinPreferred(0x12);


// 6. Start the broadcast

pAdvertising->start();


Serial.println("-------------------------------------------");

Serial.println("BEACON IS LIVE!");

Serial.println("The UUID is being broadcasted now.");

Serial.println("-------------------------------------------");

}



void loop() {

// We keep the loop simple. The BLE stack runs on its own core.

delay(5000);

}

This code transforms an ESP32 microcontroller into a Bluetooth Low Energy (BLE) Beacon—specifically, an automated "Attendance Anchor" for a classroom or event.

Think of it as a digital lighthouse. Instead of shining light, it constantly broadcasts a specific, invisible Bluetooth signal to the room so that nearby devices (like student Chromebooks or phones) can detect it and mark the user as "present" on a connected website.

Here is a step-by-step breakdown of exactly what the code is doing:

1. The Identifier (UUID)
C++
#define SERVICE_UUID "0000181c-0000-1000-8000-00805f9b34fb"
This is the "secret handshake." A UUID (Universally Unique Identifier) ensures that the scanning devices are looking for this specific device and not someone's wireless headphones or a random smartwatch.

2. Initialization and Naming
C++
BLEDevice::init("Attendance-Anchor-101");
This powers on the ESP32's Bluetooth radio and gives it a public name. If you were to open the Bluetooth settings on your phone right now, you would see a device named "Attendance-Anchor-101" pop up.

3. Setting Up the Broadcast (Server & Service)
C++
BLEServer *pServer = BLEDevice::createServer();
BLEService *pService = pServer->createService(SERVICE_UUID);
pService->start();
In BLE terms, the ESP32 is acting as a Server (a device that holds data). It creates a Service tied to the UUID mentioned above. Starting the service essentially "opens the channel" for broadcasting.

4. Advertising to the World
C++
BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
pAdvertising->addServiceUUID(SERVICE_UUID);
pAdvertising->setScanResponse(true);
"Advertising" is the core function of a beacon. This tells the ESP32 to stand on a digital hilltop and shout its UUID over and over. Setting setScanResponse(true) means that if a Chromebook hears the shout and asks for more details (like the device name), the ESP32 will reply.

5. The "Apple/Chromebook Hack"
C++
pAdvertising->setMinPreferred(0x06);  
pAdvertising->setMinPreferred(0x12);
Different operating systems handle Bluetooth scans differently. Macs, iPads, and Chromebooks can be notoriously strict about how quickly or slowly a device should broadcast. These specific memory addresses (0x06 and 0x12) adjust the connection parameters to play nicely with Apple and Google hardware, preventing connection drops or invisible beacons.

6. Background Operation
C++
void loop() {
  delay(5000); 
}
The main loop is basically empty, which might seem weird. However, the ESP32 has two processing cores. The Bluetooth stack (the advertising we just set up) runs entirely in the background on the first core. The second core (where this loop runs) has nothing else to do, so it just sleeps in 5-second intervals to save power while the Bluetooth radio continues to broadcast endlessly.

i have some esp 32s with bluetooth. i want to create an attendance system where users register their chromebooks bluetooth addresses on a website and whenever the esp32 sees a chromebook it recognizes it updates a database. then there will be a frontend to see where all the students are and track a student over a day



Convex backend

Github pages website

Images read by Groq

Bluetooth range scanning with ESP32

Dashboard for teachers

See where students are

Track student in day

This is an incredibly cool and ambitious full-stack IoT project. You have selected a modern, highly capable tech stack: Convex will handle real-time database syncing effortlessly, GitHub Pages is perfect for hosting a static React/Vue dashboard, and using Groq's vision capabilities for registration (likely reading Chromebook serial numbers or student IDs from images) is brilliant.

However, before you finalize the system design, we need to address a critical technical reality about modern Bluetooth, and then align your architecture to work around it.

The Plot Twist: Bluetooth MAC Randomization
Modern devices (Chromebooks, Apple, Android) use Bluetooth LE Privacy. They do not broadcast their actual hardware MAC address (the one printed on the sticker). Instead, they broadcast a "Random Resolvable Private Address" that changes every 10 to 15 minutes.

If your ESP32 simply sits in a room scanning for physical MAC addresses, it won't recognize the students because the Chromebooks are wearing "digital disguises" that constantly change to prevent unauthorized tracking.

The Solution: How to Make it Work
To fix this, you have two reliable options for your architecture:

Option A: The Chrome Extension (Recommended)
Instead of the ESP32s scanning the Chromebooks, flip the script. Use the code you showed me earlier! Make the ESP32s broadcast a beacon (e.g., "I am Room 101"). Deploy a background Chrome Extension to the students' Chromebooks. When the Chromebook hears the "Room 101" beacon, the Chromebook sends a message to your Convex backend saying, "I am Student X, and I am in Room 101."

Option B: The Web App Beacon
If you don't want to use an extension, students log into a website on their Chromebooks when they enter the room. The website uses the Web Bluetooth API to broadcast a specific, unique UUID tied to that student. Your ESP32 scans the room, hears the unique UUID, and the ESP32 sends the update to your Convex backend via Wi-Fi.

Your System Architecture
Assuming you move forward with a secure broadcasting method, here is how your stack fits together into a seamless pipeline:

1. Registration & Groq (The Onboarding)
The Flow: A student logs into the GitHub Pages site. They are prompted to register their device. They hold up their student ID or the back of their Chromebook to the webcam.

Groq's Role: The image is sent to a Groq Vision model. Groq instantly reads the text (ID number, serial number, etc.) and returns it as structured JSON data, eliminating manual data entry typos.

Convex: A new record is created in your students table, linking their name, ID, and a generated custom Bluetooth UUID.

2. The ESP32s (The Sentinels)
Hardware: Placed in every classroom or zone.

Task: Depending on whether you choose Option A or Option B above, they are either endlessly shouting their location (Advertising) or quietly listening for student UUIDs (Scanning).

Networking: They maintain a steady Wi-Fi connection to the internet to push real-time presence payloads directly to your Convex HTTP endpoints.

3. Convex (The Brain & Database)
Convex serves as the real-time hub. You will likely need three main tables:

Students: (Name, ID, Assigned UUID)

Locations: (Room 101, Gym, Library)

Logs: A massive ledger of every "ping" (Student ID, Location ID, Timestamp).

Functions: You will write a Convex Mutation that takes a ping from an ESP32 (or Chromebook) and says, "Update Student A's current location to Room 101, and write a record to the daily log."

4. The Teacher Dashboard (GitHub Pages)
The Interface: A React or Vue app hosted for free on GitHub Pages.

Real-time Magic: Because you are using Convex, you can use the useQuery hook. The dashboard doesn't need to be refreshed. As soon as a student walks into a room and the ESP32 registers it, the Convex database updates, and the student's icon instantly shifts to that room on the teacher's screen.

Historical Tracking: A teacher can click on a student's profile, and the frontend pulls all their logs for the day from Convex, rendering a timeline of exactly where they were and when.

Which approach do you think fits your school environment better: having the ESP32s act as beacons (and writing a Chrome Extension), or having the ESP32s act as scanners (and having students broadcast a signal)?

i also have students schedules in the form of images, i want the website to read those when first signing up



i want to go with this option. describe the stack ill need for this

Option B: The Web App Beacon

If you don't want to use an extension, students log into a website on their Chromebooks when they enter the room. The website uses the Web Bluetooth API to broadcast a specific, unique UUID tied to that student. Your ESP32 scans the room, hears the unique UUID, and the ESP32 sends the update to your Convex backend via Wi-Fi.

This is a fantastic architecture. Adding schedule parsing via Groq during onboarding elevates this from a simple tracker to a fully context-aware attendance system.

Before we dive into the exact stack, I need to issue a small but crucial technical correction on my end regarding Option B: Standard web browsers (like Chrome on a Chromebook) actually restrict websites from broadcasting a custom Bluetooth signal for security reasons. Browsers can only scan for signals.

However, we can achieve the exact same user experience with a massive hidden benefit: if the student's Chromebook scans for the ESP32, your ESP32s don't need to connect to the school's Wi-Fi. (School enterprise Wi-Fi is notoriously difficult to connect cheap microcontrollers to). The ESP32s just plug into the wall and act as "dumb" beacons, while the Chromebook's internet connection does all the talking to your database!

Here is the complete, modernized stack and data flow for your system:

1. The Hardware: ESP32 Beacons (The "Room Tags")
Role: Instead of scanning, each ESP32 simply broadcasts a unique UUID representing its location.

The Code: You will use the exact C++ code from your first message.

Deployment: You flash one ESP32 for "Room 101" (with UUID A), one for "Room 102" (with UUID B), plug them into standard USB wall chargers, and you are done. No Wi-Fi configuration needed.

2. The AI Vision Layer: Groq
Role: Instantly turns messy real-world images (IDs and Schedules) into clean database records.

How it works: When a student holds up their printed schedule to their webcam, your frontend sends the image to a Vision-capable model via Groq's API.

The Prompt: You will instruct Groq: "Read this schedule. Output ONLY a JSON array containing the period, subject, and room number. Example: [{"period": 1, "class": "Biology", "room": "101"}]".

3. The Backend: Convex
Convex is perfect for this because it handles the database, the backend functions, and the real-time WebSocket updates all in one platform. You will need three main tables:

students: _id, name, studentId, chromebookMac (optional for fingerprinting).

schedules: _id, studentId, period, room_uuid. (This tells the system where the student should be).

logs: _id, studentId, room_uuid, timestamp. (This is the ledger of where they actually are).

4. The Frontend: GitHub Pages (React or Vue)
Since Convex handles the backend, your frontend can be a purely static Single Page Application (SPA) hosted for free on GitHub Pages. It will have two distinct sides:

Side A: The Student Portal
Onboarding (One-time): The student logs in. The app asks for camera access. They take a picture of their ID and their schedule. The app sends this to Groq, verifies the JSON data with the student ("Does this look right?"), and saves it to Convex.

Daily Check-In: When a student sits down in class, they open the web app and click "Check In."

Web Bluetooth API: The browser prompts the student: "Allow this site to access Bluetooth devices?" The Chromebook scans the room, sees the ESP32 broadcasting "Room 101", and quietly sends an HTTP request to Convex: "Student 12345 is in Room 101 at 8:05 AM."

Side B: The Teacher/Admin Dashboard
The Live Map: Because you are using Convex, you can use the useQuery hook in React. The dashboard constantly listens to the logs table.

Real-Time Magic: When a student clicks "Check In" on their device, their name instantly pops up in the "Room 101" column on the Teacher's screen without the teacher needing to refresh the page.

Truancy Detection: Because Convex knows the student's schedule (thanks to Groq) and their current location (thanks to the logs), you can write a Convex query that flags students: "Student A is in the Library, but their schedule says they should be in Math right now."

Summary of the Flow:
ESP32 broadcasts "Room 101".

Student opens your GitHub Pages app.

App reads schedule via Groq (first time only) -> saves to Convex.

App scans Bluetooth, finds "Room 101".

App tells Convex -> "I am in Room 101."

Teacher dashboard instantly updates via WebSockets.

no i want this to work without students having to open a webapp after their initial setup, i think their chromebooks are always discoverable on bluetooth

I completely understand the appeal of that vision. An "invisible" system where students just walk in, sit down, and are automatically logged without having to click anything is the absolute holy grail of attendance tracking.

However, we need to have a candid technical conversation about modern browser security and operating system privacy. The completely passive, background web-app flow you are describing is currently impossible using standard web technologies.

Here is the reality of how Chromebooks and the Web Bluetooth API actually behave, and why they block this specific approach:

1. Web Apps Cannot Scan in the Background
A website (even one installed as a Progressive Web App) cannot silently scan for Bluetooth devices while closed or minimized.

User Gestures: The Web Bluetooth API strictly requires a "user gesture" (like a physical mouse click on a button) to initiate a scan.

The Browser UI: When a scan is initiated, Chrome enforces its own pop-up window requiring the user to explicitly select the device they want to pair with. You cannot bypass this UI to do silent pairing.

No Background Execution: Once the student closes the tab or the Chromebook goes to sleep, the website completely loses access to the Bluetooth radio.

2. Chromebooks Are Not "Always Discoverable"
You mentioned thinking the Chromebooks are always discoverable. While their Bluetooth radio might be on, it is not actively shouting a persistent, identifiable beacon.

ChromeOS, like iOS and Android, employs Bluetooth LE Privacy. If it constantly broadcasted a static identifier, retail stores and malicious actors could track students' physical movements across the city.

To prevent this, the OS constantly rotates its MAC address and completely hides its identity unless it is actively pairing with a known device (like a student's wireless mouse).

The Pivot: How to actually get "Zero-Friction"
If you absolutely cannot compromise on the "zero user action" requirement, you have to move away from standard web apps and look at infrastructure-level solutions. Here are the realistic paths forward:

Path A: The Chrome Enterprise Extension
If these Chromebooks are owned by the school and managed via Google Workspace, you can force-install a native Chrome Extension (not a website). Extensions have slightly deeper hardware privileges than standard websites. However, even with Manifest V3, keeping an extension running a continuous BLE background scan will heavily drain the Chromebook's battery and is difficult to maintain reliably.

Path B: Wi-Fi Access Point Triangulation (The Enterprise Way)
Drop the ESP32s entirely. When a student's Chromebook connects to the school Wi-Fi, it connects to a specific Access Point (router) in or near a specific classroom. If you have access to the school's IT infrastructure (like a Cisco or Ubiquiti controller), you can pull the logs directly from the network. Example: "Chromebook MAC [Student X] just roamed to Access Point [Room 101]."

Path C: The "One-Tap" Web Compromise
Return to the Web App approach we discussed, but make it as frictionless as possible. The student walks in, opens their Chromebook (which they likely do anyway), clicks a giant "Check In" bookmark on their browser, clicks "Allow" on the Bluetooth pop-up, and closes the tab. It takes 3 seconds.

To help figure out the best workaround, I need to know a bit more about your environment: Are these Chromebooks heavily managed by the school's IT department via Google Workspace, or are they personal devices brought from home?

ok how do we do path c?

Path C is the most pragmatic approach. It respects the strict security sandboxes of modern browsers while keeping the friction low enough that it won't disrupt the start of a class.

Here is exactly how to build the "One-Tap" Web Compromise using your chosen stack.

1. The Hardware: The "Dumb" ESP32 Beacon
Good news: you don't need to change anything from your original plan here. You will use the exact C++ code you shared in your first message.

Flash an ESP32 for each classroom.

Assign a unique SERVICE_UUID for each room (e.g., Room 101 gets ...34fb, Room 102 gets ...34fc).

Plug them into wall outlets. They don't need Wi-Fi; they just broadcast their UUID endlessly.

2. The Convex Backend: The Ledger
In your Convex project, you will create a simple mutation that the web app calls the moment it detects the classroom's Bluetooth signal.

convex/attendance.ts

TypeScript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const markPresent = mutation({
  // The app sends the student's ID and the Room UUID it just heard
  args: { studentId: v.string(), roomUuid: v.string() },
  handler: async (ctx, args) => {
    // 1. Get the current time
    const now = Date.now();

    // 2. Insert the attendance record into the database
    await ctx.db.insert("logs", {
      studentId: args.studentId,
      roomUuid: args.roomUuid,
      timestamp: now,
    });

    return { success: true, message: "Attendance logged!" };
  },
});
3. The Frontend: The "One-Tap" React App
This is the app the students will pin to their Chromebook shelf. It uses the Web Bluetooth API to listen for your specific ESP32s.

src/CheckIn.jsx

JavaScript
import { useState } from 'react';
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function CheckIn({ currentStudentId }) {
  const [status, setStatus] = useState("Ready to check in");
  const logAttendance = useMutation(api.attendance.markPresent);

  const handleBluetoothScan = async () => {
    try {
      setStatus("Scanning room...");
      
      // 1. Prompt the browser to look ONLY for your ESP32 beacons
      const device = await navigator.bluetooth.requestDevice({
        // Optional: If all your room UUIDs start with the same prefix, 
        // you can filter for them here. For this example, we accept any.
        acceptAllDevices: true, 
        optionalServices: ['0000181c-0000-1000-8000-00805f9b34fb'] // Your Room 101 UUID
      });

      // 2. If the promise resolves, the user successfully paired with the room beacon!
      setStatus("Room detected! Logging attendance...");

      // 3. Send the data to Convex
      await logAttendance({
        studentId: currentStudentId,
        roomUuid: "0000181c-0000-1000-8000-00805f9b34fb" // In production, grab this dynamically from the device object
      });

      setStatus("✅ You are checked in! You can close this tab.");

    } catch (error) {
      console.error(error);
      // This catches if they click "Cancel" on the Chrome popup or if no beacon is found
      setStatus("Check-in failed or cancelled. Try again.");
    }
  };

  return (
    <div className="check-in-container">
      <h2>Daily Attendance</h2>
      <p>{status}</p>
      
      {/* This MUST be a user click to bypass Chrome's security block */}
      <button onClick={handleBluetoothScan} className="huge-button">
        Tap to Check In
      </button>
    </div>
  );
}
UX Optimizations for "Zero-Friction"
To make this feel as magical as possible for the students:

Make it a PWA: Configure your GitHub Pages site as a Progressive Web App. Students can "install" it to their Chromebook taskbar. It will open in its own clean window without the browser address bar.

Auto-Close (Optional): Once the logAttendance mutation returns success, you can use window.close() to automatically shut the app, meaning their total interaction is literally just opening the app and clicking "Tap to Check In".

Persistent Login: Ensure the student's ID is saved in their browser's localStorage after their initial Groq/Schedule onboarding, so they never have to type their name again.

Would you like to look at the prompt structure for the Groq Vision model to ensure it accurately parses the uploaded student schedules?

lets update the esp 32 code. also this is what a schedule looks like there are day a, b, c, and d

This is a classic PowerSchool schedule interface! Seeing the exact layout makes planning the data extraction much easier.

Because we are going with Path C (the web app compromise), the most beautiful part of this architecture is that the ESP32 code does not need to know anything about A/B/C/D days, periods, or schedules. The ESP32 is simply a "dumb" beacon glued to the wall. Its only job in life is to endlessly broadcast, "I am Room C2." All the intelligent routing—figuring out if the student should be in Room C2 based on the day—happens in your Convex database and the web app.

Here is the updated, production-ready ESP32 code. It is streamlined so you can easily flash a batch of 50 of them just by changing two lines of code per room.

1. The Production ESP32 Beacon Code
C++
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
  pAdvertising->setMinPreferred(0x12);
  
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
2. Translating the Schedule with Groq
Since the ESP32 is just a beacon, your system needs to know that on "Monday at 09:00 AM", a specific student belongs in "Room C2" for "Health & Physical Education 8".

When the student uploads this PowerSchool screenshot during their initial onboarding, you will pass the image to the Groq Vision API (using a model like LLaVA or similar supported vision models).

Here is the exact System Prompt you should use to force Groq to return clean, database-ready JSON that maps perfectly to your Convex backend, ignoring the clutter (like teacher names or specific dates) and focusing on the underlying schedule pattern:

The Groq Prompt:

"You are an automated schedule parser. The user has uploaded an image of a weekly school schedule.

Your task is to extract the class schedule and output it STRICTLY as a raw JSON array of objects. Do not include markdown formatting, conversational text, or explanations.

For every class block visible in the grid, create an object with the following keys:

day_of_week: The day the class occurs (e.g., "Monday", "Tuesday").

start_time: The start time as a string (e.g., "08:17 AM").

end_time: The end time as a string (e.g., "09:13 AM").

subject: The name of the class (e.g., "Health & Physical Education 8").

room: The exact room number/identifier (e.g., "C2", "B15", "104", "Cafe").

Ignore the specific dates (like 04/20/2026), teacher names, and district codes. Focus only on the weekly recurring schedule."

What Groq Will Return (Example based on your image):

JSON
[
  {
    "day_of_week": "Monday",
    "start_time": "08:17 AM",
    "end_time": "09:13 AM",
    "subject": "Band 8",
    "room": "104"
  },
  {
    "day_of_week": "Monday",
    "start_time": "09:15 AM",
    "end_time": "10:08 AM",
    "subject": "Health & Physical Education 8",
    "room": "C2"
  },
  {
    "day_of_week": "Monday",
    "start_time": "11:40 AM",
    "end_time": "12:10 PM",
    "subject": "Lunch",
    "room": "Cafe"
  }
]
How the Final Logic Connects
Onboarding: The web app saves that JSON array into your Convex database under the student's profile.

Check-In: On Monday at 9:20 AM, the student taps "Check In" on their Chromebook.

The Scan: The web app detects a beacon broadcasting ...00C2....

The Validation: The app sends a request to Convex: "I am in C2." Convex checks the database, sees that it is currently Monday at 9:20 AM, confirms the student is scheduled to be in Health & PE in Room C2, and officially marks them as Present and On Time.


