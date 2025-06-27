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
  setDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

const subjects = [
  "math", "ag", "values", "science", "r2", "fil", "er", "eng",
  "mapeh/music", "mapeh/arts", "mapeh/pe", "mapeh/health", "ap"
];

const ACCESS_PASSWORD = "valedictorian";
const SIGNEDUP_KEY = "zshub_signedup";
const PASSWORD_KEY = "zshub_pw";

// Subject color mapping
const subjectColors = {
  math: 'bg-green-200 text-green-900',
  ag: 'bg-lime-200 text-lime-900',
  values: 'bg-yellow-200 text-yellow-900',
  science: 'bg-blue-200 text-blue-900',
  r2: 'bg-pink-200 text-pink-900',
  fil: 'bg-orange-200 text-orange-900',
  er: 'bg-amber-200 text-amber-900',
  eng: 'bg-indigo-200 text-indigo-900',
  'mapeh/music': 'bg-purple-200 text-purple-900',
  'mapeh/arts': 'bg-fuchsia-200 text-fuchsia-900',
  'mapeh/pe': 'bg-cyan-200 text-cyan-900',
  'mapeh/health': 'bg-teal-200 text-teal-900',
  ap: 'bg-red-200 text-red-900',
};

// Date formatting and days left
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function daysLeft(dateStr) {
  if (!dateStr) return '';
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(dateStr);
  due.setHours(0,0,0,0);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff > 1) return `${diff} days left`;
  if (diff === 1) return '1 day left';
  if (diff === 0) return 'Due today';
  return 'Overdue';
}

export default function ZaraStudyHub() {
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({
    title: "",
    deadline: "",
    description: "",
    subject: subjects[0],
    starred: false,
  });
  const [editId, setEditId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signedUp, setSignedUp] = useState(() => localStorage.getItem(SIGNEDUP_KEY) === "true");
  const [passwordOk, setPasswordOk] = useState(() => localStorage.getItem(PASSWORD_KEY) === "true");
  const [debug, setDebug] = useState("");
  const [showDebug, setShowDebug] = useState(true);
  const modalRef = useRef();
  const [menuOpenIdx, setMenuOpenIdx] = useState(null);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
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
      } catch (err) {
        setDebug("Auth state error: " + (err?.message || err));
        setShowDebug(true);
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
        snapshot.docs.map(doc => {
          const data = doc.data();
          // Check if current user has completed this assignment
          const completedByUser = data.completedBy && data.completedBy.includes(user.uid);
          return { 
            id: doc.id, 
            ...data, 
            completed: completedByUser 
          };
        })
          // Sort starred items first, then by deadline
          .sort((a, b) => {
            if (a.starred && !b.starred) return -1;
            if (!a.starred && b.starred) return 1;
            return 0;
          })
      );
    });
    return unsub;
  }, [user, passwordOk]);

  const openModal = () => setModalOpen(true);
  const closeModal = () => {
    setModalOpen(false);
    setForm({ title: "", deadline: "", description: "", subject: subjects[0], starred: false });
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

  // Close menu on outside click
  useEffect(() => {
    if (menuOpenIdx === null) return;
    function handleMenuClick(e) {
      if (!e.target.closest('.zshub-menu')) {
        setMenuOpenIdx(null);
      }
    }
    document.addEventListener('mousedown', handleMenuClick);
    return () => document.removeEventListener('mousedown', handleMenuClick);
  }, [menuOpenIdx]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    
    // Prepare the assignment data (without completedBy field for new assignments)
    const assignmentData = {
      title: form.title,
      deadline: form.deadline,
      description: form.description,
      subject: form.subject,
      starred: form.starred || false,
    };
    
    if (editId === null) {
      // Add a new assignment with empty completedBy array
      assignmentData.completedBy = [];
      await addDoc(collection(db, "assignments"), assignmentData);
    } else {
      // When editing, don't modify the completedBy field
      await updateDoc(doc(db, "assignments", editId), assignmentData);
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
      starred: a.starred || false,
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

  const handleToggleStar = async (idx) => {
    const a = assignments[idx];
    await updateDoc(doc(db, "assignments", a.id), {
      starred: !a.starred
    });
  };

  // Handle toggle completion
  const handleToggleCompleted = async (idx) => {
    const a = assignments[idx];
    if (!user) return;
    
    if (a.completed) {
      // Remove user from completedBy array
      await updateDoc(doc(db, "assignments", a.id), {
        completedBy: arrayRemove(user.uid)
      });
    } else {
      // Add user to completedBy array
      await updateDoc(doc(db, "assignments", a.id), {
        completedBy: arrayUnion(user.uid)
      });
    }
  };

  // Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
      setLoginError("");
      setDebug("");
    } catch (err) {
      setLoginError("Google sign-in failed.");
      setDebug("Google sign-in error: " + (err?.message || err));
      setShowDebug(true);
    }
  };

  // Password check
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      setPasswordOk(true);
      localStorage.setItem(PASSWORD_KEY, "true");
      setLoginError("");
      setDebug("");
    } else {
      setLoginError("Incorrect password.");
      setDebug("Password error: Incorrect password entered");
      setShowDebug(true);
    }
  };

  // Logout (clears localStorage flags)
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setSignedUp(false);
      setPasswordOk(false);
      localStorage.removeItem(SIGNEDUP_KEY);
      localStorage.removeItem(PASSWORD_KEY);
      setDebug("");
    } catch (err) {
      setDebug("Logout error: " + (err?.message || err));
      setShowDebug(true);
    }
  };

  // Debug panel
  const DebugPanel = () =>
    showDebug && debug ? (
      <div className="fixed bottom-4 right-4 bg-white border border-red-300 shadow-lg rounded-lg p-4 z-50 max-w-xs text-xs text-red-700 flex flex-col gap-2">
        <div className="font-bold text-red-600">Debug Info</div>
        <div className="break-words whitespace-pre-wrap">{debug}</div>
        <button
          className="self-end text-xs text-blue-600 hover:underline mt-1"
          onClick={() => setShowDebug(false)}
        >
          Dismiss
        </button>
      </div>
    ) : null;

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
        <DebugPanel />
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
        <DebugPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 font-sans flex flex-col">
      {/* Header Bar */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-400 shadow-md py-5 px-2 sm:py-7 sm:px-4 flex justify-center items-center relative">
        <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-lg text-center w-full">Zara Study Hub</h1>
        <button onClick={handleLogout} className="absolute right-2 top-2 sm:right-6 sm:top-6 bg-white text-blue-600 border border-blue-300 rounded-lg px-3 py-1 font-semibold shadow hover:bg-blue-50 transition text-xs sm:text-sm">Logout</button>
      </header>
      {/* Add Assignment Button */}
      <button
        onClick={openModal}
        className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg px-5 py-3 sm:px-6 sm:py-3 text-base sm:text-lg font-bold z-20 focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        + Add Assignment
      </button>
      {/* Main Card: Assignment List Only */}
      <main className="flex-1 flex flex-col items-center justify-start mt-4 sm:mt-8 md:mt-12 px-2 sm:px-0">
        <div className="w-full max-w-md sm:max-w-xl bg-white rounded-2xl shadow-2xl p-3 sm:p-6 md:p-10 z-10">
          <ul className="list-none p-0">
            {assignments.length === 0 && <li className="text-gray-400 text-center">No assignments yet.</li>}
            {assignments.map((a, i) => (
              <li key={a.id} className={`${a.starred ? 'bg-yellow-50 border-l-4 border-yellow-400' : a.completed ? 'bg-green-50 border-l-4 border-green-400' : 'bg-blue-100'} mb-3 sm:mb-4 p-3 sm:p-4 rounded-xl shadow flex flex-col gap-1 relative`}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-base sm:text-lg text-blue-700 truncate flex items-center gap-1">
                      {/* Star button */}
                      <button
                        onClick={() => handleToggleStar(i)}
                        className="text-yellow-500 hover:text-yellow-600 focus:outline-none"
                        aria-label={a.starred ? "Unstar assignment" : "Star assignment"}
                      >
                        {a.starred ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                      </button>
                      
                      {/* Completed checkbox */}
                      <button
                        onClick={() => handleToggleCompleted(i)}
                        className="mr-1 focus:outline-none"
                        aria-label={a.completed ? "Mark as not completed" : "Mark as completed"}
                      >
                        {a.completed ? (
                          <svg className="w-5 h-5 text-green-600" viewBox="0 0 20 20">
                            <rect width="16" height="16" x="2" y="2" rx="2" fill="currentColor" />
                            <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                            <rect width="16" height="16" x="2" y="2" rx="2" strokeWidth="1.5" />
                          </svg>
                        )}
                      </button>
                      
                      <span className={a.completed ? "line-through text-gray-500" : ""}>
                        {a.title}
                      </span>
                    </div>
                    <div className={`text-gray-700 text-xs sm:text-sm my-1 whitespace-pre-line break-words ${a.completed ? "line-through text-gray-500" : ""}`}>{a.description}</div>
                  </div>
                  {/* Three dot menu button */}
                  <div className="relative zshub-menu flex-shrink-0">
                    <button
                      className="text-blue-700 hover:bg-blue-200 rounded-full p-1 focus:outline-none"
                      onClick={e => {
                        e.stopPropagation();
                        setMenuOpenIdx(menuOpenIdx === i ? null : i);
                      }}
                      aria-label="Open menu"
                    >
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
                    </button>
                    {menuOpenIdx === i && (
                      <div className="absolute right-0 mt-2 w-28 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 flex flex-col text-sm animate-fadeIn">
                        <button
                          className="text-left px-4 py-2 hover:bg-yellow-50 text-yellow-600"
                          onClick={() => {
                            setMenuOpenIdx(null);
                            handleToggleStar(i);
                          }}
                        >
                          {a.starred ? "Unstar" : "Star"}
                        </button>
                        <button
                          className="text-left px-4 py-2 hover:bg-green-50 text-green-600"
                          onClick={() => {
                            setMenuOpenIdx(null);
                            handleToggleCompleted(i);
                          }}
                        >
                          {a.completed ? "Uncomplete" : "Complete"}
                        </button>
                        <button
                          className="text-left px-4 py-2 hover:bg-blue-50 text-blue-700"
                          onClick={() => {
                            setMenuOpenIdx(null);
                            handleEdit(i);
                          }}
                        >Edit</button>
                        <button
                          className="text-left px-4 py-2 hover:bg-red-50 text-red-600"
                          onClick={() => {
                            setMenuOpenIdx(null);
                            handleDelete(i);
                          }}
                        >Delete</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-between text-xs mt-1 items-center gap-2">
                  <span className={`px-2 py-1 rounded font-semibold text-xs ${subjectColors[a.subject] || 'bg-gray-200 text-gray-800'} max-w-[60vw] truncate`}>{a.subject}</span>
                  {a.deadline && (
                    <span className="flex flex-col items-end">
                      <span className="font-medium">{formatDate(a.deadline)}</span>
                      <span className="text-[11px] font-normal italic">{daysLeft(a.deadline)}</span>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
      {/* Modal for Add/Edit Assignment */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-30 px-2 sm:px-0">
          <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 md:p-10 w-full max-w-sm sm:max-w-md relative animate-fadeIn">
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 text-2xl font-bold focus:outline-none"
              aria-label="Close"
            >
              &times;
            </button>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
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
              <div className="flex items-center mb-2">
                <input
                  id="starred-checkbox"
                  type="checkbox"
                  checked={form.starred}
                  onChange={e => setForm(f => ({ ...f, starred: e.target.checked }))}
                  className="w-4 h-4 text-yellow-500 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500"
                />
                <label htmlFor="starred-checkbox" className="ml-2 text-sm font-medium text-gray-700 flex items-center">
                  <svg className="w-4 h-4 text-yellow-500 mr-1" fill={form.starred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Mark as priority
                </label>
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
      <DebugPanel />
    </div>
  );
} 