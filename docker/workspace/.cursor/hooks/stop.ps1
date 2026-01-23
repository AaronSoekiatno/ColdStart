# Cursor hook: Runs when Cursor stops
# Performs session cleanup

$hooksJsonPath = ".cursor/hooks.json"
if (-not (Test-Path $hooksJsonPath)) {
    exit 0
}

$hooksJson = Get-Content $hooksJsonPath | ConvertFrom-Json
$candidateId = $hooksJson.candidateId

if ($candidateId) {
    $logFile = ".cursor\logs\session.log"
    $logEntry = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] Session ended for candidate: $candidateId"
    Add-Content -Path $logFile -Value $logEntry
}

exit 0

