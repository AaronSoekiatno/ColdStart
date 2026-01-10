# PowerShell script to stop code-server
Write-Host "🛑 Stopping code-server..." -ForegroundColor Yellow

docker-compose down

Write-Host "✅ code-server stopped successfully!" -ForegroundColor Green
