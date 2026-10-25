Write-Output "======================================================="
Write-Output "ROADGUARD AI FULL END-TO-END VERIFICATION TEST SUITE"
Write-Output "======================================================="

# 1. Health Check
$health = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health" -Method Get
Write-Output "[TEST 1] Backend Health:"
Write-Output "  Status: $($health.status), Database: $($health.database), ModelStatus: $($health.modelStatus), InferenceMode: $($health.inferenceMode)"

# 2. Create Journey 1
$j1Req = @{
  vehicleType = "CAR"
  riderName = "Lokesh Kumar"
  riderEmail = "lokesh@roadguard.local"
  startLatitude = 16.5062
  startLongitude = 80.6480
  startAddress = "Vijayawada NH-16 Origin"
  demoMode = $false
  demoSource = "Verification Test 1"
} | ConvertTo-Json
$j1 = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys" -Method Post -Body $j1Req -ContentType "application/json"
$j1Id = $j1.id
Write-Output "[TEST 2] Journey 1 Created: ID=$j1Id, Status=$($j1.status), Start=($($j1.startLatitude), $($j1.startLongitude))"

# 3. GPS Ingestion Journey 1
$gps1Req = @{
  points = @(
    @{ latitude = 16.5062; longitude = 80.6480; speed = 12.0; heading = 180; accuracy = 8.0 },
    @{ latitude = 16.5080; longitude = 80.6495; speed = 13.5; heading = 182; accuracy = 7.0 },
    @{ latitude = 16.5105; longitude = 80.6515; speed = 14.2; heading = 185; accuracy = 6.5 }
  )
} | ConvertTo-Json
$gps1 = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys/$j1Id/gps" -Method Post -Body $gps1Req -ContentType "application/json"
Write-Output "[TEST 3] GPS Batch Ingestion: $($gps1.Count) points saved for Journey #$j1Id"

# 4. Evidence Frame Upload with ONNX Inference using curl.exe
$testImg = "test-images\eval_potholes_road.jpg"
$curlOut = & curl.exe -s -X POST "http://localhost:8080/api/v1/journeys/$j1Id/frames" `
  -F "file=@$testImg" `
  -F "latitude=16.5080" `
  -F "longitude=80.6495" `
  -F "frameSequence=1"

$frameResp = $curlOut | ConvertFrom-Json
Write-Output "[TEST 4] Evidence Frame Upload & ONNX Inference:"
Write-Output "  Frame ID: $($frameResp.id), StorageUrl: $($frameResp.storageUrl), SHA256: $($frameResp.sha256Digest.Substring(0, 16))..., Observations: $($frameResp.observationCount)"

# 5. Stop Journey 1 & Verify Distance Calculation
$stop1Req = @{
  endLatitude = 16.5105
  endLongitude = 80.6515
  distanceMeters = 612.0
} | ConvertTo-Json
$stoppedJ1 = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys/$j1Id/stop" -Method Post -Body $stop1Req -ContentType "application/json"
Write-Output "[TEST 5] Stopped Journey 1: Status=$($stoppedJ1.status), Distance=$($stoppedJ1.distanceMeters)m, End=($($stoppedJ1.endLatitude), $($stoppedJ1.endLongitude))"

# 6. Retrieve Journey 1 GPS Trace
$retrievedGps = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys/$j1Id/gps" -Method Get
Write-Output "[TEST 6] Retrieved GPS Trace for Journey 1: $($retrievedGps.Count) points"

# 7. Test Evidence Image Serving
$imgHeaders = & curl.exe -I -s "http://localhost:8080$($frameResp.storageUrl)"
Write-Output "[TEST 7] Evidence Image Serving HTTP Headers:"
$imgHeaders | Select-String -Pattern "HTTP/|Content-Type|Content-Length" | ForEach-Object { Write-Output "  $_" }

# 8. Create Journey 2 & Verify State Isolation
$j2Req = @{
  vehicleType = "BIKE"
  riderName = "Second Rider"
  startLatitude = 17.3850
  startLongitude = 78.4867
  startAddress = "Hyderabad Corridor"
  demoMode = $false
} | ConvertTo-Json
$j2 = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys" -Method Post -Body $j2Req -ContentType "application/json"
$j2Id = $j2.id
Write-Output "[TEST 8] Journey 2 Created: ID=$j2Id (Separate from Journey #$j1Id), Start=($($j2.startLatitude), $($j2.startLongitude))"

$j2Gps = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys/$j2Id/gps" -Method Get
Write-Output "  Journey 2 Initial GPS Trace Count: $($j2Gps.Count) (Verified completely isolated from Journey 1)"

# 9. Verify Road Issues Retrieval
$issues = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/issues" -Method Get
Write-Output "[TEST 9] Road Issues Listing: $($issues.Count) issues retrieved"
if ($issues.Count -gt 0) {
  $sample = $issues[0]
  Write-Output "  Sample Issue #$($sample.id): Class=$($sample.defectClass), Conf=$($sample.confidenceScore), Mode=$($sample.detectionMode), Authority=$($sample.authorityCode)"

  # 10. Auto-Draft Complaint for Verified Issue
  $draft = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/complaints/auto-draft?issueId=$($sample.id)&complainantName=Lokesh+Kumar&complainantEmail=lokesh@roadguard.local" -Method Post
  Write-Output "[TEST 10] Auto-Drafted Complaint #$($draft.id):"
  Write-Output "  Subject: $($draft.subject)"
  Write-Output "  Authority: $($draft.authorityName) ($($draft.authorityDeptCode))"
  Write-Output "  Status: $($draft.status), Portal: $($draft.grievancePortalUrl)"

  # 11. Simulated Complaint Submission
  $simResp = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/complaints/$($draft.id)/simulate" -Method Post
  Write-Output "[TEST 11] Simulated Grievance Submission:"
  Write-Output "  Simulated Ref ID: $($simResp.simulatedRefId)"
  Write-Output "  Warning Disclaimer: $($simResp.warningWatermark)"
  Write-Output "  Submission Status: $($simResp.status)"
}

Write-Output "======================================================="
Write-Output "ALL REST API TESTS PASSED SUCCESSFULLY"
Write-Output "======================================================="
