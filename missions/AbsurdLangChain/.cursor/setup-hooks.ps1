# Setup Cursor hooks with candidate ID
param(
    [Parameter(Mandatory=$true)]
    [string]$CandidateId
)

# Read Supabase credentials from .env.local if it exists
$supabaseUrl = $env:SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
$supabasePrivateKey = $env:SUPABASE_PRIVATE_KEY

if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local"
    foreach ($line in $envContent) {
        if ($line -match '^SUPABASE_URL=(.+)$') {
            $supabaseUrl = $matches[1]
        }
        if ($line -match '^SUPABASE_SERVICE_ROLE_KEY=(.+)$') {
            $supabaseServiceKey = $matches[1]
        }
        if ($line -match '^SUPABASE_PRIVATE_KEY=(.+)$') {
            $supabasePrivateKey = $matches[1]
        }
    }
}

# Use SUPABASE_PRIVATE_KEY if SUPABASE_SERVICE_ROLE_KEY is not set
$supabaseKey = if ($supabaseServiceKey) { $supabaseServiceKey } else { $supabasePrivateKey }

# Determine the command based on platform
$isWindows = $true  # This script is for Windows
$beforeSubmitCommand = if ($isWindows) {
    "powershell -ExecutionPolicy Bypass -File .cursor/hooks/beforeSubmitPrompt.ps1"
} else {
    ".cursor/hooks/beforeSubmitPrompt.sh"
}

$stopCommand = if ($isWindows) {
    "powershell -ExecutionPolicy Bypass -File .cursor/hooks/stop.ps1"
} else {
    ".cursor/hooks/stop.sh"
}

$hooksJson = @{
    version = 1
    hooks = @{
        beforeSubmitPrompt = @(
            @{
                command = $beforeSubmitCommand
            }
        )
        stop = @(
            @{
                command = $stopCommand
            }
        )
    }
    candidateId = $CandidateId
    supabaseUrl = $supabaseUrl
    supabaseServiceKey = $supabaseKey
} | ConvertTo-Json -Depth 10

$hooksJsonPath = ".cursor/hooks.json"
# Write UTF-8 without BOM to avoid JSON parsing issues
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$fullPath = Join-Path $PWD $hooksJsonPath
[System.IO.File]::WriteAllText($fullPath, $hooksJson, $utf8NoBom)

Write-Host "✅ Cursor hooks configured for candidate: $CandidateId" -ForegroundColor Green
Write-Host "   hooks.json created at $hooksJsonPath" -ForegroundColor Gray

