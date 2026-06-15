"use client";

import React, { useState, useEffect, useRef } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  faceRegistered?: boolean;
}

interface LogEntry {
  id: string;
  time: string;
  type: "info" | "success" | "error";
  message: string;
  detail?: any;
}

export default function Dashboard() {
  // Navigation & Auth State
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>("auth");
  const [loginEmail, setLoginEmail] = useState<string>("emp@test.com");
  const [loginPassword, setLoginPassword] = useState<string>("Employee@123");

  // Camera State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>("");

  // Action/API Loading States
  const [loading, setLoading] = useState<boolean>(false);
  const [livenessProgress, setLivenessProgress] = useState<number>(-1); // -1 = idle, 0 = main, 1,2,3 = frames
  const [faceStatus, setFaceStatus] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Admin Diagnostics State
  const [searchUserId, setSearchUserId] = useState<string>("");
  const [searchResult, setSearchResult] = useState<any>(null);

  // Console Logs State
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("zp_token");
    const savedUser = localStorage.getItem("zp_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      addLog("info", "Retrieved active session from local storage.");
    } else {
      addLog("info", "No active session. Please authenticate in the 'Authentication' tab.");
    }
  }, []);

  // Sync health check on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Clean up camera on tab change
  useEffect(() => {
    stopCamera();
  }, [activeTab]);

  // Logger Utility
  const addLog = (type: "info" | "success" | "error", message: string, detail?: any) => {
    const time = new Date().toLocaleTimeString();
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      time,
      type,
      message,
      detail,
    };
    setLogs((prev) => [newEntry, ...prev].slice(0, 100)); // Cap logs at 100 entries
  };

  // ─── CAMERA MANAGEMENT ─────────────────────────────────────
  const startCamera = async () => {
    setCameraError("");
    try {
      if (streamRef.current) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      addLog("info", "Webcam access granted. Camera stream started.");
    } catch (err: any) {
      setCameraError(err.message || "Failed to access webcam");
      addLog("error", "Webcam access denied or unavailable.", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Set canvas size to match video stream
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      // Strip prefix "data:image/jpeg;base64,"
      return dataUrl.split(",")[1];
    }
    return null;
  };

  // ─── API HANDLERS ──────────────────────────────────────────

  const checkHealth = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/ai/health");
      const json = await res.json();
      setHealthStatus(json.data);
      addLog("info", "AI service health check refreshed.", json);
    } catch (err: any) {
      setHealthStatus({ aiService: "offline", message: "Cannot connect to server." });
      addLog("error", "Health check failed. Backend server might be offline.", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    addLog("info", `Attempting login for ${loginEmail}...`);
    try {
      const res = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Login failed");
      }

      const { accessToken, user: loggedUser } = json.data;
      setToken(accessToken);
      setUser(loggedUser);
      localStorage.setItem("zp_token", accessToken);
      localStorage.setItem("zp_user", JSON.stringify(loggedUser));

      addLog("success", `Login successful! Welcome ${loggedUser.name}.`, json.data);
      // Automatically check registration status
      fetchOwnFaceStatus(accessToken);
    } catch (err: any) {
      addLog("error", err.message || "Login failed.", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("zp_token");
    localStorage.removeItem("zp_user");
    setToken("");
    setUser(null);
    setFaceStatus(null);
    setVerifyResult(null);
    addLog("info", "Logged out. Session cleared.");
  };

  const fetchOwnFaceStatus = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch("http://localhost:3001/api/ai/face/status", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      setFaceStatus(json.data);
      addLog("info", "Face status updated.", json.data);
    } catch (err: any) {
      addLog("error", "Failed to fetch face status.", err);
    }
  };

  // Face Registration
  const registerFace = async () => {
    if (!token) {
      addLog("error", "Unauthorized. Please log in first.");
      return;
    }
    setLoading(true);
    addLog("info", "Capturing frame for face registration...");

    const imageBase64 = captureFrame();
    if (!imageBase64) {
      addLog("error", "Failed to capture image from camera.");
      setLoading(false);
      return;
    }

    addLog("info", "Sending face registration payload to backend...");
    try {
      const res = await fetch("http://localhost:3001/api/ai/face/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64 }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Face registration failed");
      }

      addLog("success", "Face registered successfully!", json.data);
      fetchOwnFaceStatus();
    } catch (err: any) {
      addLog("error", err.message || "Face registration failed.", err);
    } finally {
      setLoading(false);
    }
  };

  // Face Delete
  const deleteFace = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete your registered face?")) return;

    setLoading(true);
    addLog("info", "Deleting face registration...");
    try {
      const res = await fetch("http://localhost:3001/api/ai/face/register", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      addLog("success", "Face registration deleted successfully.", json.data);
      fetchOwnFaceStatus();
    } catch (err: any) {
      addLog("error", "Failed to delete face registration.", err);
    } finally {
      setLoading(false);
    }
  };

  // Combined Face Login check-in with Liveness sequence
  const performCheckIn = async () => {
    if (!token) {
      addLog("error", "Unauthorized. Please log in first.");
      return;
    }
    setLoading(true);
    setVerifyResult(null);

    try {
      // 1. Capture primary verification image
      addLog("info", "Liveness sequence started. Capturing main verification frame...");
      setLivenessProgress(0);
      const mainImage = captureFrame();
      if (!mainImage) {
        throw new Error("Failed to capture main frame.");
      }

      // Helper function to delay
      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

      // 2. Capture 3 liveness frames with 500ms delay
      const frames: string[] = [];

      for (let i = 1; i <= 3; i++) {
        await delay(500);
        addLog("info", `Capturing liveness frame ${i}/3...`);
        setLivenessProgress(i);
        const frame = captureFrame();
        if (frame) {
          frames.push(frame);
        } else {
          addLog("error", `Failed to capture frame ${i}.`);
        }
      }

      setLivenessProgress(-1); // Sequence complete
      addLog("info", `Captured ${frames.length} liveness frames. Submitting payload...`);

      // 3. Post check-in request with liveness payload
      const res = await fetch("http://localhost:3001/api/attendance/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceInfo: "ZeroProxy Verification Portal",
          imageBase64: mainImage,
          livenessFrames: frames,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Check-in failed");
      }

      setVerifyResult({
        success: true,
        message: json.message,
        verified: true,
        isLive: true,
        record: json.data?.record,
      });

      addLog("success", "Check-in succeeded! Face verified and live.", json.data);
    } catch (err: any) {
      setVerifyResult({
        success: false,
        message: err.message || "Check-in failed",
        verified: false,
        isLive: false,
      });
      addLog("error", err.message || "Check-in failed.", err);
    } finally {
      setLoading(false);
      setLivenessProgress(-1);
    }
  };

  // Perform standard check-out
  const performCheckOut = async () => {
    if (!token) return;
    setLoading(true);
    addLog("info", "Submitting check-out request...");
    try {
      const res = await fetch("http://localhost:3001/api/attendance/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Check-out failed");
      }

      addLog("success", "Check-out marked successfully!", json.data);
    } catch (err: any) {
      addLog("error", err.message || "Check-out failed.", err);
    } finally {
      setLoading(false);
    }
  };

  // Admin check specific user status
  const lookupUserFaceStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!searchUserId.trim()) return;

    setLoading(true);
    addLog("info", `Looking up face status for user ID: ${searchUserId}...`);
    try {
      const res = await fetch(`http://localhost:3001/api/ai/face/status/${searchUserId.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Lookup failed");
      }

      setSearchResult(json.data);
      addLog("success", "Lookup completed.", json.data);
    } catch (err: any) {
      setSearchResult(null);
      addLog("error", err.message || "User lookup failed.", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-custom font-sans antialiased text-text-custom">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-card-custom border-b border-border-custom shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-primary/30">
            ZP
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">ZeroProxy</h1>
            <p className="text-xs text-slate-500 font-medium">Face Auth & Liveness Console</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Health Status Badge */}
          <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-semibold">
            <span>AI Service:</span>
            {healthStatus?.aiService === "online" ? (
              <span className="flex items-center text-success">
                <span className="w-2.5 h-2.5 bg-success rounded-full animate-pulse mr-1.5" />
                Online
              </span>
            ) : (
              <span className="flex items-center text-rose-500">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full mr-1.5" />
                Offline
              </span>
            )}
          </div>

          {user && (
            <div className="flex items-center space-x-2 bg-slate-50 border border-border-custom px-3 py-1 rounded-lg">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold">{user.name}</span>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">{user.role}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                title="Log Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SIDEBAR TABS */}
        <aside className="lg:col-span-1 flex flex-col space-y-2 bg-card-custom p-4 rounded-2xl border border-border-custom shadow-xs h-fit">
          <p className="text-[10px] font-bold text-slate-400 uppercase px-3 mb-1 tracking-wider">Navigation</p>
          <button
            onClick={() => setActiveTab("auth")}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "auth"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>1. Authentication</span>
          </button>

          <button
            onClick={() => setActiveTab("register")}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "register"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>2. Face Registration</span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "attendance"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>3. Attendance Check-In</span>
          </button>

          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "diagnostics"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.485V6.515a2 2 0 011.553-1.954l5.447-1.362a2 2 0 011.002 0l5.447 1.362A2 2 0 0118.001 6.515v8.97a2 2 0 01-1.553 1.954L11 20a2 2 0 01-2 0z" />
            </svg>
            <span>4. Diagnostics & Health</span>
          </button>
        </aside>

        {/* MAIN PANEL CONTENT */}
        <main className="lg:col-span-3 flex flex-col space-y-6">
          {/* TAB 1: AUTHENTICATION */}
          {activeTab === "auth" && (
            <div className="bg-card-custom p-6 rounded-2xl border border-border-custom shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">User Authentication</h2>
                <p className="text-sm text-slate-500">Log in to fetch active JWT access tokens for API authorization.</p>
              </div>

              {!token ? (
                <form onSubmit={handleLogin} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-border-custom text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Password</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-border-custom text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {loading ? "Authenticating..." : "Log In"}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-success/5 border border-success/20 p-4 rounded-xl flex items-center space-x-3 text-success">
                    <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-bold text-sm">Authenticated Successfully</h4>
                      <p className="text-xs text-success/80">Your access token is stored and will authorize subsequent requests.</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-border-custom space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-500 mr-2">User ID:</span>
                      <code className="text-slate-800">{user?.id}</code>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 mr-2">Email:</span>
                      <span className="text-slate-800 font-medium">{user?.email}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 mr-2">Company ID:</span>
                      <code className="text-slate-800">{user?.companyId}</code>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-500 block mb-1">JWT Bearer Token:</span>
                      <code className="block bg-white p-2 border border-border-custom rounded-lg text-[10px] break-all max-h-24 overflow-y-auto text-slate-600">
                        {token}
                      </code>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Clear Token (Log Out)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FACE REGISTRATION */}
          {activeTab === "register" && (
            <div className="bg-card-custom p-6 rounded-2xl border border-border-custom shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Face Registration</h2>
                <p className="text-sm text-slate-500">Capture a snapshot of your face to save its mathematical embedding in the AI database.</p>
              </div>

              {!token ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm font-semibold">
                  Please authenticate in the Login tab before registering your face.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Camera Viewfinder */}
                  <div className="flex flex-col space-y-4">
                    <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                      {!cameraActive ? (
                        <div className="flex flex-col items-center space-y-2 text-center p-4">
                          <svg className="w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <button
                            onClick={startCamera}
                            className="bg-primary hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            Start Camera
                          </button>
                          {cameraError && <p className="text-xs text-rose-500 mt-2 font-medium">{cameraError}</p>}
                        </div>
                      ) : (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-xs text-[10px] text-white px-2 py-0.5 rounded-full font-semibold">
                            Webcam Active
                          </div>
                        </>
                      )}
                    </div>

                    {cameraActive && (
                      <div className="flex space-x-2">
                        <button
                          onClick={registerFace}
                          disabled={loading}
                          className="flex-1 bg-success hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {loading ? "Registering Face..." : "Capture & Register Face"}
                        </button>
                        <button
                          onClick={stopCamera}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Turn Off Camera
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status Panel */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-border-custom flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800 mb-3 border-b border-slate-200 pb-2">Registration Status</h3>
                      {faceStatus?.registered ? (
                        <div className="space-y-3">
                          <span className="inline-flex items-center bg-success/10 text-success border border-success/20 text-xs font-bold px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 bg-success rounded-full mr-1.5" />
                            Registered
                          </span>
                          <p className="text-xs text-slate-600">Your face was successfully scanned and saved in the database.</p>
                          <div className="text-[10px] text-slate-400 space-y-1 bg-white p-3 rounded-lg border border-border-custom">
                            <div><span className="font-semibold">Registered At:</span> {faceStatus.registered_at || "N/A"}</div>
                            <div><span className="font-semibold">Quality Score:</span> {faceStatus.quality_score ? `${(faceStatus.quality_score * 100).toFixed(1)}%` : "N/A"}</div>
                            <div><span className="font-semibold">Embedding Version:</span> {faceStatus.model_version || "N/A"}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <span className="inline-flex items-center bg-rose-50 text-rose-500 border border-rose-100 text-xs font-bold px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 bg-rose-500 rounded-full mr-1.5" />
                            Not Registered
                          </span>
                          <p className="text-xs text-slate-500">Capture your snapshot on the left to set up face verification.</p>
                        </div>
                      )}
                    </div>

                    {faceStatus?.registered && (
                      <button
                        onClick={deleteFace}
                        disabled={loading}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors w-fit"
                      >
                        Delete Face Embedding
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTENDANCE CHECK-IN */}
          {activeTab === "attendance" && (
            <div className="bg-card-custom p-6 rounded-2xl border border-border-custom shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Attendance Check-In (Liveness Check)</h2>
                <p className="text-sm text-slate-500">
                  Secures check-in by running a blink & motion check (liveness detection) across multiple frames, comparing it with your registered face.
                </p>
              </div>

              {!token ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm font-semibold">
                  Please log in in the Authentication tab before checking in.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Camera Sequence */}
                  <div className="flex flex-col space-y-4">
                    <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                      {!cameraActive ? (
                        <div className="flex flex-col items-center space-y-2 text-center p-4">
                          <svg className="w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <button
                            onClick={startCamera}
                            className="bg-primary hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            Open Camera Stream
                          </button>
                        </div>
                      ) : (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          {/* Liveness Capture Feedback Overlay */}
                          {livenessProgress >= 0 && (
                            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3">
                              <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                              <div className="text-center">
                                <h4 className="font-bold text-sm">
                                  {livenessProgress === 0
                                    ? "Capturing Verification Frame..."
                                    : `Analyzing Liveness Frame ${livenessProgress}/3...`}
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-1">Keep eyes open, blink or turn slightly</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {cameraActive && (
                      <div className="flex space-x-2">
                        <button
                          onClick={performCheckIn}
                          disabled={loading}
                          className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-opacity cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {loading ? "Capturing sequence..." : "Perform Face Check-In"}
                        </button>
                        <button
                          onClick={performCheckOut}
                          disabled={loading}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Check-Out
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Verification Results Panel */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-border-custom flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800 mb-3 border-b border-slate-200 pb-2">Verification Feedback</h3>

                      {verifyResult ? (
                        <div className="space-y-4">
                          <div className={`p-4 rounded-xl border ${
                            verifyResult.success
                              ? "bg-success/5 border-success/20 text-success"
                              : "bg-rose-50 border-rose-100 text-rose-500"
                          }`}>
                            <div className="flex items-start space-x-3">
                              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {verifyResult.success ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                )}
                              </svg>
                              <div>
                                <h4 className="font-bold text-sm">
                                  {verifyResult.success ? "Check-In Success" : "Verification Failed"}
                                </h4>
                                <p className="text-xs opacity-90 mt-1">{verifyResult.message}</p>
                              </div>
                            </div>
                          </div>

                          {verifyResult.success && verifyResult.record && (
                            <div className="text-[10px] text-slate-500 space-y-1.5 bg-white p-3 rounded-lg border border-border-custom">
                              <div><span className="font-semibold text-slate-700">Record ID:</span> <code>{verifyResult.record.id}</code></div>
                              <div><span className="font-semibold text-slate-700">Checked In At:</span> {new Date(verifyResult.record.checkIn).toLocaleString()}</div>
                              <div><span className="font-semibold text-slate-700">Method:</span> <span className="font-bold">{verifyResult.record.verificationMethod}</span></div>
                              <div><span className="font-semibold text-slate-700">IP Address:</span> <code>{verifyResult.record.ipAddress}</code></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">Perform a Check-in sequence using the webcam to see verification metrics.</p>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400">
                      * Face login check combines 3D MediaPipe liveness detection (blink/tilt) with 512-dimension face embedding comparison.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS */}
          {activeTab === "diagnostics" && (
            <div className="bg-card-custom p-6 rounded-2xl border border-border-custom shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Diagnostics & Admin Control</h2>
                <p className="text-sm text-slate-500">Manage face registration databases and examine overall API parameters.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Admin Status Lookup */}
                <div className="bg-slate-50 p-5 rounded-xl border border-border-custom space-y-4">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Admin User Status Lookup</h3>
                    <p className="text-xs text-slate-400">Query face status for a specific user ID. (Requires ADMIN/HR privileges)</p>
                  </div>

                  <form onSubmit={lookupUserFaceStatus} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">User UUID</label>
                      <input
                        type="text"
                        value={searchUserId}
                        onChange={(e) => setSearchUserId(e.target.value)}
                        placeholder="e.g. 41a42169-1acb-49e1-8d56-d98dd9f04342"
                        required
                        className="w-full px-3 py-2 border border-border-custom rounded-lg text-xs font-mono focus:outline-hidden"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !token}
                      className="bg-primary hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Check Employee Status
                    </button>
                  </form>

                  {searchResult && (
                    <div className="text-[10px] bg-white p-3 rounded-lg border border-border-custom space-y-1">
                      <div><span className="font-semibold text-slate-500">User:</span> <code>{searchResult.user_id}</code></div>
                      <div><span className="font-semibold text-slate-500">Registered:</span> <span className={`font-bold ${searchResult.registered ? "text-success" : "text-rose-500"}`}>{searchResult.registered ? "YES" : "NO"}</span></div>
                      {searchResult.registered && (
                        <>
                          <div><span className="font-semibold text-slate-500">Quality Score:</span> {searchResult.quality_score ? `${(searchResult.quality_score * 100).toFixed(1)}%` : "N/A"}</div>
                          <div><span className="font-semibold text-slate-500">Model Version:</span> {searchResult.model_version || "N/A"}</div>
                          <div><span className="font-semibold text-slate-500">Registered At:</span> {searchResult.registered_at || "N/A"}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* API Info */}
                <div className="bg-slate-50 p-5 rounded-xl border border-border-custom space-y-4 text-xs">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">API Gateway Parameters</h3>
                    <p className="text-xs text-slate-400">Connection details to services.</p>
                  </div>

                  <div className="space-y-2 font-mono text-[10px] bg-white p-3 rounded-lg border border-border-custom">
                    <div><span className="font-bold text-slate-500 mr-2">Backend Endpoint:</span> <code>http://localhost:3001/api</code></div>
                    <div><span className="font-bold text-slate-500 mr-2">AI Service Target:</span> <code>http://localhost:8005</code></div>
                    <div><span className="font-bold text-slate-500 mr-2">CORS Port Whitelist:</span> <code>http://localhost:3000</code></div>
                    <div><span className="font-bold text-slate-500 mr-2">Liveness Frames Min:</span> <code>3</code></div>
                    <div><span className="font-bold text-slate-500 mr-2">Face Match Thresh:</span> <code>{healthStatus?.database ? "0.5 (Cosine)" : "N/A"}</code></div>
                  </div>

                  <button
                    onClick={checkHealth}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-xs"
                  >
                    Refresh Health Diagnostics
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DEVELOPER LOGS CONSOLE */}
          <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl border border-slate-800 shadow-sm flex flex-col h-80 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
                <h3 className="font-bold text-xs tracking-wider text-slate-100 uppercase">Developer Logs Console</h3>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] hover:text-white text-slate-500 font-semibold uppercase"
              >
                Clear Log List
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-2 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic text-center pt-12">Logs console is empty. Perform actions above.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex flex-col border-b border-slate-800/40 pb-1.5">
                    <div className="flex items-start space-x-2">
                      <span className="text-slate-600 shrink-0">[{log.time}]</span>
                      <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded-md shrink-0 ${
                        log.type === "success"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                          : log.type === "error"
                          ? "bg-rose-950 text-rose-400 border border-rose-900"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {log.type}
                      </span>
                      <span className="text-slate-200 font-medium break-all">{log.message}</span>
                    </div>
                    {log.detail && (
                      <pre className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40 mt-1 max-h-36 overflow-y-auto text-slate-400 overflow-x-auto select-all scrollbar-thin">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Hidden canvas for video captures */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
