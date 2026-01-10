# PowerShell test script for code-server setup
Write-Host "🧪 Testing code-server setup..." -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

# Test 1: Check if Docker is installed
Write-Host "Test 1: Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($dockerVersion -match "Docker version") {
        Write-Host "  ✅ Docker is installed: $dockerVersion" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "  ❌ Docker is not installed" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  ❌ Docker is not installed" -ForegroundColor Red
    $testsFailed++
}

# Test 2: Check if Docker is running
Write-Host "Test 2: Checking if Docker is running..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info 2>&1
    if ($dockerInfo -match "Server Version") {
        Write-Host "  ✅ Docker is running" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "  ❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  ❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    $testsFailed++
}

# Test 3: Check if Dockerfile exists
Write-Host "Test 3: Checking if Dockerfile exists..." -ForegroundColor Yellow
if (Test-Path ".\Dockerfile") {
    Write-Host "  ✅ Dockerfile found" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "  ❌ Dockerfile not found" -ForegroundColor Red
    $testsFailed++
}

# Test 4: Check if docker-compose.yml exists
Write-Host "Test 4: Checking if docker-compose.yml exists..." -ForegroundColor Yellow
if (Test-Path ".\docker-compose.yml") {
    Write-Host "  ✅ docker-compose.yml found" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "  ❌ docker-compose.yml not found" -ForegroundColor Red
    $testsFailed++
}

# Test 5: Check if starter-workspace exists
Write-Host "Test 5: Checking if starter-workspace exists..." -ForegroundColor Yellow
if (Test-Path ".\starter-workspace") {
    Write-Host "  ✅ starter-workspace directory found" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "  ❌ starter-workspace directory not found" -ForegroundColor Red
    $testsFailed++
}

# Test 6: Check if package.json exists in starter-workspace
Write-Host "Test 6: Checking starter-workspace files..." -ForegroundColor Yellow
if (Test-Path ".\starter-workspace\package.json") {
    Write-Host "  ✅ package.json found in starter-workspace" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "  ❌ package.json not found in starter-workspace" -ForegroundColor Red
    $testsFailed++
}

# Test 7: Check if port 8080 is available
Write-Host "Test 7: Checking if port 8080 is available..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "  ⚠️  Port 8080 is already in use" -ForegroundColor Yellow
    Write-Host "     You may need to stop the existing service or change the port" -ForegroundColor Yellow
    $testsFailed++
} else {
    Write-Host "  ✅ Port 8080 is available" -ForegroundColor Green
    $testsPassed++
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $testsFailed" -ForegroundColor Red
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "✅ All tests passed! You're ready to start code-server." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run: .\start.ps1" -ForegroundColor White
    Write-Host "  2. Wait for code-server to be ready" -ForegroundColor White
    Write-Host "  3. Navigate to http://localhost:3000/ide in your browser" -ForegroundColor White
} else {
    Write-Host "❌ Some tests failed. Please fix the issues above before starting." -ForegroundColor Red
    
    if ($testsFailed -eq 1 -and $portInUse) {
        Write-Host ""
        Write-Host "Note: Port 8080 is in use, but you can still proceed." -ForegroundColor Yellow
        Write-Host "The existing service might be code-server already running." -ForegroundColor Yellow
        Write-Host "Try: docker-compose ps" -ForegroundColor Yellow
    }
}

Write-Host ""
