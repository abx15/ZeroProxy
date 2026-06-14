const { io } = require('socket.io-client');

const baseUrl = 'http://127.0.0.1:3001/api';
const socketUrl = 'http://127.0.0.1:3001/events';

// Helper for HTTP requests
async function makeRequest(url, method, body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response.json();
}

async function runTests() {
  console.log('🚀 Starting Phase 7 WebSocket Gateway tests...');

  let adminToken, adminUserId, empToken, empUserId, empSessionId;

  // 1. Get tokens
  try {
    const adminLogin = await makeRequest(`${baseUrl}/auth/login`, 'POST', {
      email: 'admin@test.com',
      password: 'Admin@123',
    });
    adminToken = adminLogin.data.accessToken;
    adminUserId = adminLogin.data.user.id;
    console.log('🔑 Logged in as Admin');

    const empLogin = await makeRequest(`${baseUrl}/auth/login`, 'POST', {
      email: 'emp@test.com',
      password: 'Employee@123',
    });
    empToken = empLogin.data.accessToken;
    empUserId = empLogin.data.user.id;
    console.log('🔑 Logged in as Employee');
  } catch (err) {
    console.error('❌ Failed during initial logins:', err.message);
    process.exit(1);
  }

  // Helper to wait for event
  const waitForEvent = (socket, eventName, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(eventName);
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeoutMs);

      socket.once(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  };

  // --- TEST 1: Connect Admin Socket ---
  console.log('\nRunning TEST 1...');
  const adminSocket = io(socketUrl, {
    auth: { token: adminToken },
    transports: ['websocket'],
  });

  try {
    const connData = await waitForEvent(adminSocket, 'connected');
    console.log('✅ TEST 1 Passed: Connected to WS gateway', connData);
  } catch (err) {
    console.error('❌ TEST 1 Failed:', err.message);
    adminSocket.disconnect();
    process.exit(1);
  }

  // --- TEST 2: Ping/Pong ---
  console.log('\nRunning TEST 2...');
  adminSocket.emit('ping');
  try {
    const pongData = await waitForEvent(adminSocket, 'pong');
    console.log('✅ TEST 2 Passed: Received pong', pongData);
  } catch (err) {
    console.error('❌ TEST 2 Failed:', err.message);
    adminSocket.disconnect();
    process.exit(1);
  }

  // --- TEST 3: Real-time Check-in ---
  console.log('\nRunning TEST 3...');
  // Force checkout employee if already checked in
  try {
    await makeRequest(`${baseUrl}/attendance/checkout`, 'POST', { deviceInfo: 'NodeTest' }, { Authorization: `Bearer ${empToken}` });
  } catch (err) {}

  const checkinPromise = waitForEvent(adminSocket, 'employee:checkin');

  // Trigger checkin via REST API
  await makeRequest(`${baseUrl}/attendance/checkin`, 'POST', {
    deviceInfo: 'NodeTest',
    verificationMethod: 'FACE',
  }, { Authorization: `Bearer ${empToken}` });

  try {
    const checkinEvent = await checkinPromise;
    console.log('✅ TEST 3 Passed: Received employee:checkin event on Admin', checkinEvent);
  } catch (err) {
    console.error('❌ TEST 3 Failed:', err.message);
    adminSocket.disconnect();
    process.exit(1);
  }

  // --- TEST 4: Real-time Check-out ---
  console.log('\nRunning TEST 4...');
  const checkoutPromise = waitForEvent(adminSocket, 'employee:checkout');

  // Trigger checkout via REST API
  await makeRequest(`${baseUrl}/attendance/checkout`, 'POST', {
    deviceInfo: 'NodeTest',
  }, { Authorization: `Bearer ${empToken}` });

  try {
    const checkoutEvent = await checkoutPromise;
    console.log('✅ TEST 4 Passed: Received employee:checkout event on Admin', checkoutEvent);
  } catch (err) {
    console.error('❌ TEST 4 Failed:', err.message);
    adminSocket.disconnect();
    process.exit(1);
  }

  // --- TEST 5: Real-time Login ---
  console.log('\nRunning TEST 5...');
  const loginPromise = waitForEvent(adminSocket, 'user:login');

  // Trigger login via REST API
  const empLogin2 = await makeRequest(`${baseUrl}/auth/login`, 'POST', {
    email: 'emp@test.com',
    password: 'Employee@123',
  });
  empToken = empLogin2.data.accessToken;

  try {
    const loginEvent = await loginPromise;
    console.log('✅ TEST 5 Passed: Received user:login event on Admin', loginEvent);
  } catch (err) {
    console.error('❌ TEST 5 Failed:', err.message);
    adminSocket.disconnect();
    process.exit(1);
  }

  // --- TEST 6: Real-time Logout ---
  console.log('\nRunning TEST 6...');
  const logoutPromise = waitForEvent(adminSocket, 'user:logout');

  // Trigger logout via REST API
  await makeRequest(`${baseUrl}/auth/logout`, 'POST', {}, { Authorization: `Bearer ${empToken}` });

  try {
    const logoutEvent = await logoutPromise;
    console.log('✅ TEST 6 Passed: Received user:logout event on Admin', logoutEvent);
  } catch (err) {
    console.error('❌ TEST 6 Failed:', err.message);
    adminSocket.disconnect();
    process.exit(1);
  }

  // --- TEST 7: Force Logout ---
  console.log('\nRunning TEST 7...');
  // Login employee again to get active session
  const empLogin3 = await makeRequest(`${baseUrl}/auth/login`, 'POST', {
    email: 'emp@test.com',
    password: 'Employee@123',
  });
  empToken = empLogin3.data.accessToken;

  // Connect Employee Socket
  const empSocket = io(socketUrl, {
    auth: { token: empToken },
    transports: ['websocket'],
  });
  await waitForEvent(empSocket, 'connected');

  // Fetch active sessions to find sessionId
  const sessionsRes = await makeRequest(`${baseUrl}/sessions`, 'GET', null, { Authorization: `Bearer ${adminToken}` });
  const empSession = sessionsRes.data.sessions.find(s => s.user.id === empUserId);
  if (!empSession) {
    console.error('❌ Could not find employee session to terminate');
    adminSocket.disconnect();
    empSocket.disconnect();
    process.exit(1);
  }

  const adminForceLogoutPromise = waitForEvent(adminSocket, 'session:force-logout');
  const empKickedPromise = waitForEvent(empSocket, `user:kicked:${empUserId}`);

  // Trigger force logout of session
  await makeRequest(`${baseUrl}/sessions/${empSession.id}`, 'DELETE', null, { Authorization: `Bearer ${adminToken}` });

  try {
    const forceLogoutEvent = await adminForceLogoutPromise;
    const kickedEvent = await empKickedPromise;
    console.log('✅ TEST 7 Passed: Received session:force-logout on Admin', forceLogoutEvent);
    console.log('✅ TEST 7 Passed: Received user:kicked event on Employee', kickedEvent);
  } catch (err) {
    console.error('❌ TEST 7 Failed:', err.message);
    adminSocket.disconnect();
    empSocket.disconnect();
    process.exit(1);
  }
  empSocket.disconnect();

  // --- TEST 8: New User Created ---
  console.log('\nRunning TEST 8...');
  const userCreatedPromise = waitForEvent(adminSocket, 'user:created');

  // Delete test-user if already exists
  try {
    const allUsers = await makeRequest(`${baseUrl}/users`, 'GET', null, { Authorization: `Bearer ${adminToken}` });
    const existingUser = allUsers.data.data.find(u => u.email === 'newuser@test.com');
    if (existingUser) {
      await makeRequest(`${baseUrl}/users/${existingUser.id}`, 'DELETE', null, { Authorization: `Bearer ${adminToken}` });
    }
  } catch (err) {}

  // Trigger user creation via REST API
  const newUser = await makeRequest(`${baseUrl}/users`, 'POST', {
    name: 'New User',
    email: 'newuser@test.com',
    password: 'Password@123',
    role: 'EMPLOYEE',
    companyId: empLogin3.data.user.companyId,
  }, { Authorization: `Bearer ${adminToken}` });

  try {
    const userCreatedEvent = await userCreatedPromise;
    console.log('✅ TEST 8 Passed: Received user:created event on Admin', userCreatedEvent);
  } catch (err) {
    console.error('❌ TEST 8 Failed:', err.message);
    adminSocket.disconnect();
    process.exit(1);
  }

  // Clean up user
  await makeRequest(`${baseUrl}/users/${newUser.data.id}`, 'DELETE', null, { Authorization: `Bearer ${adminToken}` });

  // --- TEST 9: Employee does NOT receive admin events ---
  console.log('\nRunning TEST 9...');
  // Login employee again to get active session
  const empLogin4 = await makeRequest(`${baseUrl}/auth/login`, 'POST', {
    email: 'emp@test.com',
    password: 'Employee@123',
  });
  empToken = empLogin4.data.accessToken;

  // Connect employee socket
  const empSocket2 = io(socketUrl, {
    auth: { token: empToken },
    transports: ['websocket'],
  });
  await waitForEvent(empSocket2, 'connected');

  let empReceivedEvent = false;
  empSocket2.on('employee:checkin', () => {
    empReceivedEvent = true;
  });

  // Trigger checkin event from admin token (or just trigger any checkin)
  // Let's checkout admin first, then checkin admin
  try {
    await makeRequest(`${baseUrl}/attendance/checkout`, 'POST', { deviceInfo: 'AdminTest' }, { Authorization: `Bearer ${adminToken}` });
  } catch (err) {}
  await makeRequest(`${baseUrl}/attendance/checkin`, 'POST', { deviceInfo: 'AdminTest', verificationMethod: 'FACE' }, { Authorization: `Bearer ${adminToken}` });

  // Wait 1 second to see if employee receives it
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (empReceivedEvent) {
    console.error('❌ TEST 9 Failed: Employee socket received admin-only events');
    adminSocket.disconnect();
    empSocket2.disconnect();
    process.exit(1);
  } else {
    console.log('✅ TEST 9 Passed: Employee socket did NOT receive admin events');
  }
  empSocket2.disconnect();

  // --- TEST 10: Invalid Token Rejected ---
  console.log('\nRunning TEST 10...');
  const invalidSocket = io(socketUrl, {
    auth: { token: 'invalid_token' },
    transports: ['websocket'],
  });

  let connectionFailed = false;
  try {
    await waitForEvent(invalidSocket, 'connected', 1500);
  } catch (err) {
    connectionFailed = true;
  }

  if (connectionFailed) {
    console.log('✅ TEST 10 Passed: Connection with invalid token was successfully rejected');
  } else {
    console.error('❌ TEST 10 Failed: Connection with invalid token was accepted');
    adminSocket.disconnect();
    invalidSocket.disconnect();
    process.exit(1);
  }

  invalidSocket.disconnect();
  adminSocket.disconnect();

  console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! Phase 7 complete.');
}

runTests().catch(console.error);
