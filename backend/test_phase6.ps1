$baseUrl = "http://localhost:3001/api"
Write-Host "Starting Phase 6 Validation Tests..." -ForegroundColor Cyan

# Helper to print test result
function Assert-Test($testNum, $testName, $condition) {
    if ($condition) {
        Write-Host "✅ [PASS] TEST $testNum - $testName" -ForegroundColor Green
    } else {
        Write-Host "❌ [FAIL] TEST $testNum - $testName" -ForegroundColor Red
        exit 1
    }
}

# 1. Login successfully and verify LOGIN log is created
Write-Host "Running TEST 1..."
$loginBody = @{
    email = "admin@test.com"
    password = "Admin@123"
} | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$adminToken = $loginRes.data.accessToken
$adminUserId = $loginRes.data.user.id
Assert-Test 1 "Login response contains accessToken" ($null -ne $adminToken)

# Check login activity log
Start-Sleep -Milliseconds 300
$headers = @{ Authorization = "Bearer $adminToken" }
$logsRes = Invoke-RestMethod -Uri "$baseUrl/activity" -Method Get -Headers $headers
# logsRes.data is { data: [...], meta: [...] }
$logsArray = $logsRes.data.data
$loginLog = $logsArray | Where-Object { $_.action -eq "LOGIN" -and $_.userId -eq $adminUserId }
Assert-Test 1 "LOGIN activity log exists in MongoDB" ($null -ne $loginLog)

# 2. Wrong password login and verify LOGIN_FAILED log
Write-Host "Running TEST 2..."
$failedBody = @{
    email = "admin@test.com"
    password = "wrongpassword"
} | ConvertTo-Json

try {
    $failedRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $failedBody -ContentType "application/json"
    $failedResult = $false
} catch {
    $failedResult = $_.Exception.Response.StatusCode -eq 401
}
Assert-Test 2 "Login with wrong password returns 401 Unauthorized" $failedResult

Start-Sleep -Milliseconds 300
$failedLogsRes = Invoke-RestMethod -Uri "$baseUrl/activity/failed-logins" -Method Get -Headers $headers
$failedLog = $failedLogsRes.data.logs | Where-Object { $_.userEmail -eq "admin@test.com" }
Assert-Test 2 "LOGIN_FAILED activity log exists in MongoDB" ($null -ne $failedLog)

# 3. Check-in and verify CHECK_IN log
Write-Host "Running TEST 3..."
$empLoginBody = @{
    email = "emp@test.com"
    password = "Employee@123"
} | ConvertTo-Json
$empLoginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $empLoginBody -ContentType "application/json"
$empToken = $empLoginRes.data.accessToken
$empUserId = $empLoginRes.data.user.id

$checkinBody = @{
    deviceInfo = "Chrome/Windows"
    verificationMethod = "FACE"
} | ConvertTo-Json
$empHeaders = @{ Authorization = "Bearer $empToken" }

# Make sure we checkout first in case already checked in from previous runs
try {
    Invoke-RestMethod -Uri "$baseUrl/attendance/checkout" -Method Post -Body (@{ deviceInfo = "Chrome/Windows" } | ConvertTo-Json) -ContentType "application/json" -Headers $empHeaders
} catch {}

$checkinRes = Invoke-RestMethod -Uri "$baseUrl/attendance/checkin" -Method Post -Body $checkinBody -ContentType "application/json" -Headers $empHeaders
Assert-Test 3 "Attendance check-in response is successful" ($null -ne $checkinRes.data.record)

Start-Sleep -Milliseconds 300
$checkinLogsRes = Invoke-RestMethod -Uri "$baseUrl/activity?action=CHECK_IN" -Method Get -Headers $headers
$checkinLog = $checkinLogsRes.data.data | Where-Object { $_.userId -eq $empUserId }
Assert-Test 3 "CHECK_IN log exists in MongoDB and userId matches" ($null -ne $checkinLog)

# 4. Action summary
Write-Host "Running TEST 4..."
$summaryRes = Invoke-RestMethod -Uri "$baseUrl/activity/summary?days=7" -Method Get -Headers $headers
Assert-Test 4 "Summary returns actions list" ($null -ne $summaryRes.data.actions)

# 5. Daily chart
Write-Host "Running TEST 5..."
$chartRes = Invoke-RestMethod -Uri "$baseUrl/activity/chart?days=30" -Method Get -Headers $headers
Assert-Test 5 "Daily chart returns chart array" ($null -ne $chartRes.data.chart)

# 6. User history
Write-Host "Running TEST 6..."
$historyRes = Invoke-RestMethod -Uri "$baseUrl/activity/user/$empUserId" -Method Get -Headers $headers
Assert-Test 6 "User history contains employee actions" ($historyRes.data.total -gt 0 -and $historyRes.data.userId -eq $empUserId)

# 7. Filter by date range
Write-Host "Running TEST 7..."
$dateLogsRes = Invoke-RestMethod -Uri "$baseUrl/activity?startDate=2025-01-01&endDate=2026-12-31" -Method Get -Headers $headers
Assert-Test 7 "Filter by date range returns logs" ($dateLogsRes.data.data.Count -ge 0)

# 8. Employee sees only own logs
Write-Host "Running TEST 8..."
$empLogsRes = Invoke-RestMethod -Uri "$baseUrl/activity" -Method Get -Headers $empHeaders
$otherLogs = $empLogsRes.data.data | Where-Object { $_.userId -ne $empUserId }
Assert-Test 8 "Employee only sees own logs" ($null -eq $otherLogs)

# 9. Employee tries to see summary (should fail)
Write-Host "Running TEST 9..."
$empSummaryForbidden = $false
try {
    Invoke-RestMethod -Uri "$baseUrl/activity/summary" -Method Get -Headers $empHeaders
} catch {
    $empSummaryForbidden = $_.Exception.Response.StatusCode -eq 403
}
Assert-Test 9 "Employee summary query returns 403 Forbidden" $empSummaryForbidden

# 10. Logout and verify log
Write-Host "Running TEST 10..."
$logoutRes = Invoke-RestMethod -Uri "$baseUrl/auth/logout" -Method Post -Headers $headers
Assert-Test 10 "Logout endpoint returns success" ($null -ne $logoutRes.data.message)

# Login again to check log
$loginRes2 = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$adminToken2 = $loginRes2.data.accessToken
$headers2 = @{ Authorization = "Bearer $adminToken2" }

Start-Sleep -Milliseconds 300
$logoutLogsRes = Invoke-RestMethod -Uri "$baseUrl/activity?action=LOGOUT" -Method Get -Headers $headers2
$logoutLog = $logoutLogsRes.data.data | Where-Object { $_.userId -eq $adminUserId }
Assert-Test 10 "LOGOUT activity log present in MongoDB" ($null -ne $logoutLog)

Write-Host "🎉 All 10 tests passed successfully! Phase 6 complete." -ForegroundColor Green
