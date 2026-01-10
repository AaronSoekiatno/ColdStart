# PowerShell script to start code-server
Write-Host "🚀 Starting code-server..." -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker info 2>&1 | Select-String "Server Version"
if (-not $dockerRunning) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Build and start the container
Write-Host "📦 Building Docker image..." -ForegroundColor Yellow
docker-compose build

Write-Host "🏃 Starting container..." -ForegroundColor Yellow
docker-compose up -d

# Wait for code-server to be ready
Write-Host "⏳ Waiting for code-server to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        # Continue waiting
    }
    $attempt++
}

if ($ready) {
    Write-Host "✅ code-server is ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Access your IDE at: http://localhost:8080" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 To stop code-server, run: docker-compose down" -ForegroundColor Yellow
    Write-Host ""
    
    # Optional: Open in browser
    $openBrowser = Read-Host "Open in browser? (y/n)"
    if ($openBrowser -eq "y") {
        Start-Process "http://localhost:8080"
    }
}

if (-not $ready) {
    Write-Host "❌ code-server failed to start. Check logs with: docker-compose logs" -ForegroundColor Red
    exit 1
}
