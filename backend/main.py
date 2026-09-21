from fastapi import FastAPI
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from fastapi import FastAPI, Request

cred = credentials.Certificate("firebase-credentials.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI()

@app.post("/api/telemetry")
async def log_telemetry(request: Request):
    # 2. Receive the data from the React Native app
    event_data = await request.json()
    
    # 3. Write the telemetry data securely to Firestore
    doc_ref = db.collection("alerts").document()
    doc_ref.set({
        "eventType": event_data.get("event_type"),
        "confidence": event_data.get("confidence"),
        "timestamp": event_data.get("timestamp")
    })
    
    return {"status": "success", "message": "Alert logged to Firestore"}

app = FastAPI(title="ActiveWatch DMS Backend")

class TelemetryEvent(BaseModel):
    event_type: str  # e.g., "DROWSINESS_ALERT" or "COLLISION_WARNING"
    timestamp: str
    confidence: float

@app.get("/")
def health_check():
    return {"status": "ActiveWatch Backend is running"}

@app.post("/api/telemetry")
def receive_telemetry(data: TelemetryEvent):
    print(f"Received Alert: {data.event_type} with confidence {data.confidence}")
    return {"status": "logged", "received": data.event_type}