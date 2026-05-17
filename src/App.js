import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

function App() {
  
  const [userName, setUserName] = useState("");
  const [medications, setMedications] = useState([]);
  const [name, setName] = useState("");
  const [dosesPerDay, setDosesPerDay] = useState(1);
  const [startDate, setStartDate] = useState("");

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [editingMedId, setEditingMedId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDose, setEditDose] = useState(1);
  const [instruction, setInstruction] = useState("");
  const [totalPills, setTotalPills] = useState(10);
  const [savedName, setSavedName] = useState("");
  const generateSchedule = (dosesPerDay) => {
    const baseHour = 8;
    const interval = Math.floor(16 / dosesPerDay);
    let result = [];
    for (let i = 0; i < dosesPerDay; i++) {
      let hour = baseHour + i * interval;
      if (hour > 22) hour = 22;
      result.push(`${hour.toString().padStart(2, "0")}:00`);
    }
    return result;
  };

  // 👤 Profile
  const saveProfile = async () => {
  await setDoc(doc(db, "users", "main"), {
    name: userName,
  });

  setSavedName(userName);
};


  // 📥 Load meds
  const loadMedications = async () => {
    const snap = await getDocs(collection(db, "medications"));
    const data = snap.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    }));
    setMedications(data);
  };

  // 📥 Load history
  const loadHistory = async () => {
    const snap = await getDocs(collection(db, "medication_history"));
    const data = snap.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    }));
    setHistory(data);
  };

  useEffect(() => {
    loadMedications();
    loadHistory();
  }, []);

 
  // 💊 Add
  const addMedication = async () => {
    if (!name) return;
    const newMed = {
       name,
       instructions: instruction,
       startDate: startDate || new Date().toISOString().split("T")[0],
       lastTakenDate: new Date().toISOString().split("T")[0],
       totalPills,
       dosesPerDay,
       schedule: generateSchedule(dosesPerDay),
       takenToday: 0,
       takenTimes: [],
     };
  

    const docRef = await addDoc(collection(db, "medications"), newMed);

    setMedications((prev) => [...prev, { ...newMed, id: docRef.id }]);
    setName("");
    setInstruction("");
    setTotalPills(10);
  };

  // 💊 Take
 const toggleTaken = async (id) => {
  const med = medications.find((m) => m.id === id);
  if (!med) return;
  if (med.instructions) {
  alert(`📝 Instruction: ${med.instructions}`);
}

  const now = new Date();
  const currentTime =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");

  // 🔴 چک: آیا الان وقت مصرف هست؟
  const isTimeValid = med.schedule.some((t) => {
  const [h, m] = t.split(":").map(Number);

  const target = new Date();
  target.setHours(h, m, 0, 0);

  const diff = Math.abs(now - target);

  return diff <= 10 * 60 * 1000; // 10 دقیقه تلورانس
});

if (!isTimeValid) {
  alert("⛔ Not scheduled time!");
  return;
}

  // 🔴 چک: آیا این ساعت قبلاً مصرف شده؟
  if (med.takenTimes?.includes(currentTime)) {
    alert("⚠️ Already taken for this time!");
    return;
  }

  // 🔴 چک: حد روزانه
  if (med.takenToday >= med.dosesPerDay) {
    alert("⚠️ Daily limit reached!");
    return;
  }
  const updated = {
    takenToday: med.takenToday + 1,
    totalPills: med.totalPills - 1,
    takenTimes: [...(med.takenTimes || []), currentTime],
  };

  try {
    await updateDoc(doc(db, "medications", id), updated);

    setMedications((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...updated } : m
      )
    );

    await addDoc(collection(db, "medication_history"), {
      medId: id,
      medName: med.name,
      takenAt: new Date().toISOString(),
    });

    loadHistory();
  } catch (e) {
    console.error(e);
  }
};
  // ❌ Delete
  const deleteMedication = async (id) => {
    if (!id || typeof id !== "string") return;
    if (!window.confirm("Delete this medication?")) return;

    try {
      await deleteDoc(doc(db, "medications", id));

      setMedications((prev) =>
        prev.filter((m) => m.id !== id)
      );
    } catch (e) {
      console.error("Delete Error:", e);
    }
  };

  // ✏️ Start edit
  const startEdit = (med) => {
    setEditingMedId(med.id);
    setEditName(med.name);
    setEditDose(med.dosesPerDay);
  };

  // 💾 Save edit
 const saveEdit = async (id) => {
  if (!id || !editName) return;

  const updated = {
    name: editName,
    dosesPerDay: Number(editDose),
    schedule: generateSchedule(Number(editDose)),
  };

  try {
    await updateDoc(doc(db, "medications", id), updated);

    setMedications((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...updated } : m
      )
    );

    setEditingMedId(null);
  } catch (e) {
    console.error("Save Edit Error:", e);
  }
};

  // 🔔 Alarm
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const time =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

      medications.forEach((med) => {
        if (
          med.schedule?.includes(time) &&
          med.takenToday < med.dosesPerDay
        ) {
          alert(`Take ${med.name}`);
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [medications]);

  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.takenAt) - new Date(a.takenAt)
  );
  const styles = {
  phone: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#eaf2ff",
    height: "100vh",
  },

  screen: {
    width: "380px",
    height: "700px",
    background: "#fff",
    borderRadius: "30px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    padding: "15px",
    overflowY: "auto",
    fontFamily: "sans-serif",
  },

  header: {
    textAlign: "center",
    color: "#1976d2",
    marginBottom: "10px",
    fontWeight: "bold",
  },

  card: {
    background: "#f4f9ff",
    padding: "12px",
    borderRadius: "15px",
    marginBottom: "10px",
    borderLeft: "5px solid #1976d2",
  },

  button: {
    background: "#1976d2",
    color: "white",
    border: "none",
    padding: "6px 10px",
    margin: "3px",
    borderRadius: "10px",
    cursor: "pointer",
  },

  input: {
    width: "100%",
    padding: "8px",
    margin: "5px 0",
    borderRadius: "10px",
    border: "1px solid #ccc",
  }
};
const greeting = savedName
  ? `Hello ${savedName} 👋`
  : "Save your name👇";

  return (
    <div style={styles.phone}>
      <div style={styles.screen}>
        <div style={{ padding: 20 }}>
          <h3 style={styles.header}>👤 Profile</h3>

          <input
            style={styles.input}
            placeholder="Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button style={styles.button} onClick={saveProfile}>Save</button>

          <hr />

          <h2 style={styles.header}>💊 Medications</h2>
           <h3 style={{ color: "#1976d2", textAlign: "center" }}>
           {greeting}
         </h3> 
          <input
            style={styles.input}
            placeholder="Medicine name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            style={styles.input}
            type="number"
            value={dosesPerDay}
            onChange={(e) => setDosesPerDay(Number(e.target.value))}
          />

          <input
            style={styles.input}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Instructions (e.g. after food)"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />

          <input
            style={styles.input}
            type="number"
            placeholder="Total pills"
            value={totalPills}
            onChange={(e) => setTotalPills(Number(e.target.value))}
          />

          <button style={{ ...styles.button, width: "100%" }} onClick={addMedication}>Add</button>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {medications.map((med) => (
              <li key={med.id} style={styles.card}>
                {editingMedId === med.id ? (
                  <>
                    <input
                      style={styles.input}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      value={editDose}
                      onChange={(e) => setEditDose(Number(e.target.value))}
                    />
                    <button style={styles.button} onClick={() => saveEdit(med.id)}>Save</button>
                    <button style={styles.button} onClick={() => setEditingMedId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <b style={{ color: "#1976d2" }}>{med.name}</b>
                    <p>⏰ {med.schedule?.join(" | ") || "No schedule"}</p>
                    <p>💊 Remaining: {med.totalPills}</p>
                    <p>📝 {med.instructions || "No instructions"}</p>

                    <div>
                      <button style={styles.button} onClick={() => toggleTaken(med.id)}>Take</button>
                      <button style={styles.button} onClick={() => deleteMedication(med.id)}>Delete</button>
                      <button style={styles.button} onClick={() => startEdit(med)}>Edit</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          <hr />

          <button style={styles.button} onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Hide History" : "Show History"}
          </button>

          {showHistory && (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {sortedHistory.map((h) => {
                const d = new Date(h.takenAt);
                return (
                  <li key={h.id} style={{ ...styles.card, borderLeft: "5px solid #4caf50" }}>
                    {d.toLocaleDateString()} | {d.toLocaleTimeString()} → {h.medName}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;