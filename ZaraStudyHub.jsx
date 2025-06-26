import React, { useState, useRef, useEffect } from "react";
import { db, auth, provider } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  setDoc
} from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

const subjects = [
  "math", "ag", "values", "science", "r2", "fil", "er", "eng",
  "mapeh/music", "mapeh/arts", "mapeh/pe", "mapeh/health", "ap"
];

const ACCESS_PASSWORD = "valedictorian";
const SIGNEDUP_KEY = "zshub_signedup";
const PASSWORD_KEY = "zshub_pw";

export default function ZaraStudyHub() {
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({
    title: "",
    deadline: "",
    description: "",
    subject: subjects[0],
  });
  const [editId, setEditId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signedUp, setSignedUp] = useState(() => localStorage.getItem(SIGNEDUP_KEY) === "true");
  const [passwordOk, setPasswordOk] = useState(() => localStorage.getItem(PASSWORD_KEY) === "true");
  const modalRef = useRef();

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        localStorage.setItem(SIGNEDUP_KEY, "true");
        setSignedUp(true);
        // Save user to Firestore if not already present
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: u.uid,
            name: u.displayName,
            email: u.email,
            photoURL: u.photoURL,
            firstAccess: new Date().toISOString()
          });
        }
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  // Load assignments in real-time
  useEffect(() => {
    if (!user || !passwordOk) return;
    const q = query(collection(db, "assignments"), orderBy("deadline", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setAssignments(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      );
    });
    return unsub;
  }, [user, passwordOk]);

  const openModal = () => setModalOpen(true);
  const closeModal = () => {
    setModalOpen(false);
    setForm({ title: "", deadline: "", description: "", subject: subjects[0] });
    setEditId(null);
  };

  // Close modal if clicking outside
  useEffect(() => {
    if (!modalOpen) return;
    function handleClick(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        closeModal();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modalOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editId === null) {
      await addDoc(collection(db, "assignments"), form);
    } else {
      await updateDoc(doc(db, "assignments", editId), form);
    }
    closeModal();
  };

  const handleEdit = (idx) => {
    const a = assignments[idx];
    setForm({
      title: a.title,
      deadline: a.deadline,
      description: a.description,
      subject: a.subject,
    });
    setEditId(a.id);
    setModalOpen(true);
  };

  const handleDelete = async (idx) => {
    const a = assignments[idx];
    await deleteDoc(doc(db, "assignments", a.id));
    if (editId === a.id) {
      closeModal();
    }
  };

  // Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
      setLoginError("");
    } catch (err) {
      setLoginError("Google sign-in failed.");
    }
  };

  // Password check
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      setPasswordOk(true);
      localStorage.setItem(PASSWORD_KEY, "true");
      setLoginError("");
    } else {
      setLoginError("Incorrect password.");
    }
  };

  // Logout (clears localStorage flags)
  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setSignedUp(false);
    setPasswordOk(false);
    localStorage.removeItem(SIGNEDUP_KEY);
    localStorage.removeItem(PASSWORD_KEY);
  };

  // Auth flow logic
  if (!signedUp) {
    // Show Google sign up first
    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center font-sans">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col gap-6 items-center">
          <h2 className="text-2xl font-bold text-blue-600 mb-2">Zara Study Hub Sign Up</h2>
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 font-semibold flex items-center gap-2 shadow"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C36.68 2.36 30.77 0 24 0 14.82 0 6.71 5.08 2.69 12.44l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.04l7.18 5.59C43.93 37.13 46.1 31.3 46.1 24.55z"/><path fill="#FBBC05" d="M9.67 28.65c-1.13-3.36-1.13-6.98 0-10.34l-7.98-6.2C-1.13 17.09-1.13 30.91 1.69 35.91l7.98-6.2z"/><path fill="#EA4335" d="M24 46c6.48 0 11.92-2.14 15.9-5.82l-7.18-5.59c-2.01 1.35-4.6 2.16-8.72 2.16-6.38 0-11.87-3.63-14.33-8.94l-7.98 6.2C6.71 42.92 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
            Sign up with Google
          </button>
          {loginError && <div className="text-red-500 text-sm mt-2">{loginError}</div>}
        </div>
      </div>
    );
  }

  if (!passwordOk) {
    // Show password screen
    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center font-sans">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col gap-6 items-center">
          <h2 className="text-2xl font-bold text-blue-600 mb-2">Enter Access Password</h2>
          <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter access password"
              className="p-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-base w-full"
              required
            />
            <button type="submit" className="bg-blue-600 text-white rounded-lg py-2 font-semibold w-full hover:bg-blue-700 transition text-base shadow">
              Enter
            </button>
          </form>
          {loginError && <div className="text-red-500 text-sm mt-2">{loginError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 font-sans flex flex-col">
      {/* Header Bar */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-400 shadow-md py-7 px-4 flex justify-center items-center">
        <h1 className="text-white text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-lg">Zara Study Hub</h1>
        <button onClick={handleLogout} className="absolute right-6 top-6 bg-white text-blue-600 border border-blue-300 rounded-lg px-4 py-1 font-semibold shadow hover:bg-blue-50 transition text-sm">Logout</button>
      </header>
      {/* Add Assignment Button */}
      <button
        onClick={openModal}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg px-6 py-3 text-lg font-bold z-20 focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        + Add Assignment
      </button>
      {/* Main Card: Assignment List Only */}
      <main className="flex-1 flex flex-col items-center justify-start mt-8 sm:mt-12">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 sm:p-10 z-10">
          <ul className="list-none p-0">
            {assignments.length === 0 && <li className="text-gray-400 text-center">No assignments yet.</li>}
            {assignments.map((a, i) => (
              <li key={a.id} className="bg-blue-100 mb-4 p-4 rounded-xl shadow flex flex-col gap-1">
                <div className="font-semibold text-lg text-blue-700">{a.title}</div>
                <div className="text-gray-700 text-sm my-1 whitespace-pre-line">{a.description}</div>
                <div className="flex justify-between text-xs mt-1">
                  <span><b>Subject:</b> {a.subject}</span>
                  {a.deadline && <span><b>Deadline:</b> {a.deadline}</span>}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleEdit(i)} className="bg-blue-500 text-white rounded px-3 py-1 text-xs hover:bg-blue-600 transition">Edit</button>
                  <button onClick={() => handleDelete(i)} className="bg-white text-blue-600 border border-blue-300 rounded px-3 py-1 text-xs hover:bg-blue-50 transition">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
      {/* Modal for Add/Edit Assignment */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-30">
          <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-10 w-full max-w-md relative animate-fadeIn">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-blue-600 text-2xl font-bold focus:outline-none"
              aria-label="Close"
            >
              &times;
            </button>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Assignment title..."
                className="p-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                required
              />
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className="p-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="flex-1 p-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                />
                <select
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="flex-1 p-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-base"
                >
                  {subjects.map(subj => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="bg-blue-600 text-white rounded-lg py-2 font-semibold flex-1 hover:bg-blue-700 transition text-base shadow">
                  {editId === null ? "Add Assignment" : "Update Assignment"}
                </button>
                <button type="button" onClick={closeModal} className="bg-gray-100 text-blue-600 border border-blue-300 rounded-lg py-2 font-semibold flex-1 hover:bg-blue-50 transition text-base shadow">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 