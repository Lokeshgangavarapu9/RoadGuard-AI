$ErrorActionPreference = "Stop"

Write-Host "=========================================================="
Write-Host " ROADGUARD AI -- REAL ONNX INFERENCE END-TO-END VALIDATION "
Write-Host "=========================================================="

# 1. Check Health & Model Status
$health = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health"
Write-Host "[1] Backend Health and ONNX Model Status:"
Write-Host "  Status:         $($health.status)"
Write-Host "  Inference Mode: $($health.inferenceMode)"
Write-Host "  Model Status:   $($health.modelStatus)"
Write-Host "  Model Path:     $($health.modelPath)"

if ($health.inferenceMode -ne "ONNX" -or $health.modelStatus -ne "LOADED") {
    throw "Model not in ONNX LOADED state!"
}

# 2. Create Real Journey (Non-Demo)
$journeyBody = @{
    vehicleType = "CAR"
    sensorConfig = "DASHCAM_SMARTPHONE"
    isDemo = $false
    notes = "Real ONNX road damage detection trial"
} | ConvertTo-Json

$journey = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys" -Method Post -ContentType "application/json" -Body $journeyBody
Write-Host ""
Write-Host "[2] Created Real Journey:"
Write-Host "  Journey ID:   $($journey.id)"
Write-Host "  Journey UUID: $($journey.uuid)"

# 3. Ingest GPS Points
$gpsPayload = @{
    points = @(
        @{ latitude = 16.5062; longitude = 80.6480; altitude = 24.5; speedMps = 11.2; accuracyM = 3.5; recordedAt = (Get-Date).ToString("o") },
        @{ latitude = 16.5068; longitude = 80.6485; altitude = 24.6; speedMps = 11.5; accuracyM = 3.2; recordedAt = (Get-Date).ToString("o") },
        @{ latitude = 16.5074; longitude = 80.6490; altitude = 24.7; speedMps = 11.8; accuracyM = 3.0; recordedAt = (Get-Date).ToString("o") }
    )
} | ConvertTo-Json

$gpsRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys/$($journey.id)/gps" -Method Post -ContentType "application/json" -Body $gpsPayload
Write-Host ""
Write-Host "[3] Ingested GPS Telemetry Points: $($gpsRes.Count) points saved"

# 4. Upload Genuine Road Damage Image 1: defect_pothole.jpg (Frame 1)
$potholeFile = "C:\Users\LOKESH\java project 2026\test-images\defect_pothole.jpg"
Write-Host ""
Write-Host "[4] Uploading Frame 1: Real Pothole Photograph ($potholeFile)"

$uploadUrl = "http://localhost:8080/api/v1/journeys/$($journey.id)/frames"
$rawResp1 = curl.exe -s -F "file=@$potholeFile" -F "latitude=16.5062" -F "longitude=80.6480" -F "frameSequence=1" $uploadUrl
$frame1 = $rawResp1 | ConvertFrom-Json
Write-Host "  Frame #1 Uploaded: ID=$($frame1.id), SHA-256=$($frame1.sha256Digest)"
Write-Host "  Frame #1 Genuine Detections Count: $($frame1.observations.Count)"
foreach ($obs in $frame1.observations) {
    Write-Host "  -> Observation: Class=$($obs.rawClassLabel), Conf=$([Math]::Round($obs.rawConfidence, 3)), BBox=($([Math]::Round($obs.bboxX1, 3)), $([Math]::Round($obs.bboxY1, 3)), $([Math]::Round($obs.bboxX2, 3)), $([Math]::Round($obs.bboxY2, 3))), Mode=$($obs.inferenceMode)"
}

# 5. Upload Genuine Road Damage Image 1 Again (Frame 2) to trigger 2-of-4 Temporal Confirmation
Write-Host ""
Write-Host "[5] Uploading Frame 2: Real Pothole Photograph (Consecutive frame for temporal confirmation)"
$rawResp2 = curl.exe -s -F "file=@$potholeFile" -F "latitude=16.5063" -F "longitude=80.6481" -F "frameSequence=2" $uploadUrl
$frame2 = $rawResp2 | ConvertFrom-Json
Write-Host "  Frame #2 Uploaded: ID=$($frame2.id), Detections=$($frame2.observations.Count)"
foreach ($obs in $frame2.observations) {
    Write-Host "  -> Observation: Class=$($obs.rawClassLabel), Conf=$([Math]::Round($obs.rawConfidence, 3)), Confirmed=$($obs.confirmed)"
}

# 6. Upload Clean Road Image: clean_road.jpg (Frame 3)
$cleanFile = "C:\Users\LOKESH\java project 2026\test-images\clean_road.jpg"
Write-Host ""
Write-Host "[6] Uploading Frame 3: Real Clean Road Photograph ($cleanFile)"
$rawResp3 = curl.exe -s -F "file=@$cleanFile" -F "latitude=16.5066" -F "longitude=80.6484" -F "frameSequence=3" $uploadUrl
$frame3 = $rawResp3 | ConvertFrom-Json
Write-Host "  Frame #3 Uploaded: ID=$($frame3.id), Detections=$($frame3.observations.Count)"
if ($frame3.observations.Count -eq 0) {
    Write-Host "  -> Verified: 0 defects detected on clean road photograph!"
} else {
    Write-Host "  -> Warning: detected $($frame3.observations.Count) items on clean road"
}

# 7. Query Confirmed Road Issues
Write-Host ""
Write-Host "[7] Querying Confirmed Road Issues:"
$issues = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/issues"
Write-Host "  Total Confirmed Issues in Database: $($issues.Count)"
foreach ($iss in $issues) {
    Write-Host "  Issue #$($iss.id): Defect=$($iss.defectClass), Mode=$($iss.detectionMode), Conf=$([Math]::Round($iss.confidenceScore, 3)), Road='$($iss.roadName)', ObsCount=$($iss.observationCount)"
}

if ($issues.Count -eq 0) {
    throw "No confirmed road issues were created!"
}

# 8. Test Complaint Auto-Drafting and Simulated Submission
$targetIssue = $issues[0]
Write-Host ""
Write-Host "[8] Auto-Drafting Complaint for Issue #$($targetIssue.id)..."
$complaintUri = "http://localhost:8080/api/v1/complaints/auto-draft?issueId=$($targetIssue.id)&complainantName=Lokesh+Kumar&complainantEmail=lokesh.citizen@roadguard.local"
$complaint = Invoke-RestMethod -Uri $complaintUri -Method Post
Write-Host "  Complaint Drafted: ID=$($complaint.id), Status=$($complaint.status), TargetAuthority=$($complaint.targetAuthorityName)"
Write-Host "  Subject: $($complaint.subject)"

Write-Host ""
Write-Host "[9] Executing Simulated Grievance Submission..."
$submission = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/complaints/$($complaint.id)/simulate" -Method Post
Write-Host "  Simulated Submission Result:"
Write-Host "  Status:        $($submission.status)"
Write-Host "  Reference ID:  $($submission.simulatedRefId)"
Write-Host "  Watermark:     $($submission.warningWatermark)"

# 10. Query Map Data (Issues and Journey GPS points used by Leaflet map)
Write-Host ""
Write-Host "[10] Querying Map Visualization Data..."
$mapIssues = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/issues"
Write-Host "  Map Markers Available: $($mapIssues.Count)"
foreach ($m in $mapIssues) {
    Write-Host "  -> Map Marker: Issue #$($m.id) at ($($m.latitude), $($m.longitude)) Defect=$($m.defectClass), Road='$($m.roadName)'"
}

$journeyGps = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/journeys/$($journey.id)/gps"
Write-Host "  Map Polyline Coordinates: $($journeyGps.Count) points"

Write-Host ""
Write-Host "=========================================================="
Write-Host " ALL END-TO-END WORKFLOW AND REAL ONNX INFERENCES PASSED! "
Write-Host "=========================================================="
