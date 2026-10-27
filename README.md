# 1

1. What “MediSync” actually is (simple mental model)

Think of it like:

A hospital = grid of rooms

Each room has a status:

🟢 Available

🟡 Reserved

🔴 Occupied / Critical

Ambulance or staff updates a room → instantly visible to everyone

So you are building:

A real-time shared state system + UI dashboard

2. System Design (simple version)

Frontend (React)

Hospital grid UI (2D matrix)

Each cell = room/bay

Color changes dynamically

Buttons:

“Mark Available”

“Assign Patient”

“Emergency Reserve”

Backend (Node.js + Express)

Stores hospital state (2D array / DB)

Handles room updates

Sends updates to all clients

Real-time Layer

Socket.io WebSockets

When one user changes something → all screens update instantly

Data Model (core idea)

JavaScript

hospital = [

  [ { id: "A1", status: "green" }, { id: "A2", status: "red" } ],

  [ { id: "B1", status: "yellow" }, { id: "B2", status: "green" } ]

]

3. Core Features (MVP)

Must-have

Live hospital grid

Click room → change status

Real-time sync (Socket.io)

Auto update across all users

Optional (advanced)

Auto doctor assignment

Ambulance request system

Priority queue (triage system)

Audit logs

4. Architecture Flow



User A clicks room → Frontend

        ↓

Socket event sent to backend

        ↓

Backend updates state matrix

        ↓

Broadcast to all connected clients

        ↓

All dashboards update instantly

5. 🔥 COPY-PASTE AI BUILD PROMPT

Use this in Cursor / Replit AI / ChatGPT coding mode:

🚀 PROMPT START

Build a full-stack real-time web application called “MediSync – Hospital Resource Coordinator”.

TECH STACK

Frontend: React (Vite preferred)

Backend: Node.js + Express

Real-time: Socket.io

Styling: TailwindCSS (clean dashboard UI)

CORE IDEA

The app represents a hospital as a 2D grid of rooms (matrix). Each room has a status:

green = available

red = occupied

yellow = reserved

Multiple users (doctors, admins, ambulance staff) can open the dashboard simultaneously. Any change made by one user must reflect in real-time on all other users instantly using WebSockets.

BACKEND REQUIREMENTS

Create Express server

Setup Socket.io

Maintain hospital state in memory:

JavaScript

let hospital = [

  [{ id: "A1", status: "green" }, { id: "A2", status: "red" }],

  [{ id: "B1", status: "yellow" }, { id: "B2", status: "green" }]

];

Socket events:

"get_state" → send full hospital grid

"update_room" → update room status and broadcast to all clients

When a room is updated:

Update backend matrix

Emit "state_updated" to all clients

FRONTEND REQUIREMENTS

React dashboard showing grid of rooms

Each cell displays:

Room ID

Color based on status

On click: Cycle status: green → yellow → red → green

Connect to backend using Socket.io-client

Listen for:

"state_updated" → re-render grid immediately

UI should look like a hospital control panel:

Clean grid

Color-coded cards

Minimal professional dashboard design

REAL-TIME BEHAVIOR

When any user changes a room status: → all connected users see update instantly without refresh

BONUS FEATURES (if possible)

Show “Live Connected Users”

Add room labels like ICU, ER, General Ward

Add simple “Emergency Mode” button that sets all rooms to red temporarily

GOAL

A fully working real-time hospital coordination dashboard that demonstrates:

WebSockets

State synchronization

Real-time UI updates

Backend state management

OUTPUT EXPECTED

Generate full working code with:

backend folder

frontend folder

installation steps

run commands

PROMPT END

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c2c77f2b-c2c2-44ae-8d61-74a3b4e4dcac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
