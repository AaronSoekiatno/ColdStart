# Cursor hook: Runs before submitting a prompt to AI
# Logs the prompt to Supabase prompt_logs table
# Cursor passes JSON via stdin with prompt data

# #region agent log - script start
# Use current directory to make path portable across projects
$logPath = Join-Path (Get-Location) ".cursor" "debug.log"
# Ensure .cursor directory exists
$cursorDir = Join-Path (Get-Location) ".cursor"
if (-not (Test-Path $cursorDir)) {
    New-Item -ItemType Directory -Path $cursorDir -Force | Out-Null
}
$logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:5`",`"message`":`"PowerShell hook script started`",`"data`":{`"timestamp`":$(Get-Date -UFormat %s),`"logPath`":`"$logPath`"},`"timestamp`":$(Get-Date -UFormat %s)}"
Add-Content -Path $logPath -Value $logEntry
# #endregion

# Create logs directory first
$logsDir = ".cursor\logs"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
$logFile = ".cursor\logs\prompts-$(Get-Date -Format 'yyyyMMdd').log"

# Read JSON from stdin - use the most reliable method for Cursor
# Cursor pipes JSON data to the script via stdin
$rawInput = $null
$inputJson = $null

# Read from stdin using the standard input stream
# This is the most reliable method when called from Cursor
# #region agent log - stdin reading attempt 1
$logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:18`",`"message`":`"Attempting stdin read method 1`",`"data`":{`"method`":`"OpenStandardInput`"},`"timestamp`":$(Get-Date -UFormat %s)}"
Add-Content -Path $logPath -Value $logEntry
# #endregion
try {
    # Use the standard input stream with proper stream handling
    $stdin = [Console]::OpenStandardInput()
    $reader = New-Object System.IO.StreamReader($stdin)
    $rawInput = $reader.ReadToEnd()
    $reader.Close()
    $stdin.Close()
    # #region agent log - stdin method 1 success
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:22`",`"message`":`"Stdin method 1 succeeded`",`"data`":{`"inputLength`":$($rawInput.Length)},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
} catch {
    # #region agent log - stdin method 1 failed
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:26`",`"message`":`"Stdin method 1 failed`",`"data`":{`"error`":$($_.Exception.Message)},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    # Fallback: try ReadToEnd from Console::In
    # #region agent log - stdin method 2 attempt
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:30`",`"message`":`"Attempting stdin method 2`",`"data`":{`"method`":`"Console.In.ReadToEnd`"},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    try {
        $rawInput = [Console]::In.ReadToEnd()
        # #region agent log - stdin method 2 success
        $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:33`",`"message`":`"Stdin method 2 succeeded`",`"data`":{`"inputLength`":$($rawInput.Length)},`"timestamp`":$(Get-Date -UFormat %s)}"
        Add-Content -Path $logPath -Value $logEntry
        # #endregion
    } catch {
        # #region agent log - stdin method 2 failed
        $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:37`",`"message`":`"Stdin method 2 failed`",`"data`":{`"error`":$($_.Exception.Message)},`"timestamp`":$(Get-Date -UFormat %s)}"
        Add-Content -Path $logPath -Value $logEntry
        # #endregion
        # Last resort: try reading line by line
        # #region agent log - stdin method 3 attempt
        $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:41`",`"message`":`"Attempting stdin method 3`",`"data`":{`"method`":`"line by line`"},`"timestamp`":$(Get-Date -UFormat %s)}"
        Add-Content -Path $logPath -Value $logEntry
        # #endregion
        try {
            $lines = @()
            while ($true) {
                $line = [Console]::In.ReadLine()
                if ($null -eq $line) { break }
                $lines += $line
            }
            $rawInput = $lines -join "`n"
            # #region agent log - stdin method 3 success
            $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:48`",`"message`":`"Stdin method 3 succeeded`",`"data`":{`"inputLength`":$($rawInput.Length),`"linesCount`":$($lines.Count)},`"timestamp`":$(Get-Date -UFormat %s)}"
            Add-Content -Path $logPath -Value $logEntry
            # #endregion
        } catch {
            # #region agent log - stdin method 3 failed
            $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"A`",`"location`":`"beforeSubmitPrompt.ps1:52`",`"message`":`"Stdin method 3 failed`",`"data`":{`"error`":$($_.Exception.Message)},`"timestamp`":$(Get-Date -UFormat %s)}"
            Add-Content -Path $logPath -Value $logEntry
            # #endregion
            $rawInput = $null
        }
    }
}

# Log raw input for debugging
if ($rawInput -and $rawInput.Trim()) {
    $debugLog = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: Raw input received (length: $($rawInput.Length))"
    Add-Content -Path $logFile -Value $debugLog
    $previewLength = [Math]::Min(500, $rawInput.Length)
    Add-Content -Path $logFile -Value "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: First $previewLength chars: $($rawInput.Substring(0, $previewLength))"
} else {
    $debugLog = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: No input received from stdin"
    Add-Content -Path $logFile -Value $debugLog
}

# Parse JSON if we got input
if ($rawInput -and $rawInput.Trim()) {
    # #region agent log - JSON parsing attempt
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"B`",`"location`":`"beforeSubmitPrompt.ps1:58`",`"message`":`"Attempting JSON parse`",`"data`":{`"rawInputLength`":$($rawInput.Length)},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    try {
        $inputJson = $rawInput.Trim() | ConvertFrom-Json
        # #region agent log - JSON parsing success
        $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"B`",`"location`":`"beforeSubmitPrompt.ps1:61`",`"message`":`"JSON parsing succeeded`",`"data`":{`"properties`":$($inputJson.PSObject.Properties.Name -join ', ')},`"timestamp`":$(Get-Date -UFormat %s)}"
        Add-Content -Path $logPath -Value $logEntry
        # #endregion
        $debugLog = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: Parsed JSON successfully. Properties: $($inputJson.PSObject.Properties.Name -join ', ')"
        Add-Content -Path $logFile -Value $debugLog
        
        # Log all properties and their values for debugging
        $allProps = $inputJson.PSObject.Properties | ForEach-Object { 
            $val = $_.Value
            if ($val -is [string] -and $val.Length -gt 100) {
                $val = $val.Substring(0, 100) + "..."
            }
            "$($_.Name)=$val"
        }
        $debugLog = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: All JSON properties: $($allProps -join '; ')"
        Add-Content -Path $logFile -Value $debugLog
    } catch {
        # #region agent log - JSON parsing failed
        $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"B`",`"location`":`"beforeSubmitPrompt.ps1:73`",`"message`":`"JSON parsing failed`",`"data`":{`"error`":$($_.Exception.Message)},`"timestamp`":$(Get-Date -UFormat %s)}"
        Add-Content -Path $logPath -Value $logEntry
        # #endregion
        $debugLog = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: Failed to parse JSON: $($_.Exception.Message)"
        Add-Content -Path $logFile -Value $debugLog
        $inputJson = $null
    }
} else {
    $debugLog = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: No input received from stdin"
    Add-Content -Path $logFile -Value $debugLog
}

# Extract prompt text from Cursor's JSON format
# Based on the stop hook format, beforeSubmitPrompt likely has: userMessage, prompt, message, content, or messages array
$promptText = $null
if ($inputJson) {
    # Try common field names (in order of likelihood based on Cursor's hook format)
    if ($inputJson.userMessage) { $promptText = $inputJson.userMessage }
    elseif ($inputJson.prompt) { $promptText = $inputJson.prompt }
    elseif ($inputJson.message) { $promptText = $inputJson.message }
    elseif ($inputJson.content) { $promptText = $inputJson.content }
    elseif ($inputJson.user_message) { $promptText = $inputJson.user_message }
    elseif ($inputJson.text) { $promptText = $inputJson.text }
    elseif ($inputJson.input) { $promptText = $inputJson.input }
    elseif ($inputJson.query) { $promptText = $inputJson.query }
    elseif ($inputJson.messages -and $inputJson.messages.Count -gt 0) {
        # Extract from messages array (OpenAI format)
        $lastMessage = $inputJson.messages[-1]
        if ($lastMessage.content) { $promptText = $lastMessage.content }
        elseif ($lastMessage.message) { $promptText = $lastMessage.message }
        elseif ($lastMessage.text) { $promptText = $lastMessage.text }
        elseif ($lastMessage.role -eq "user" -and $lastMessage.PSObject.Properties) {
            # Get first string property from user message
            $stringProps = $lastMessage.PSObject.Properties | Where-Object { $_.Value -is [string] -and $_.Value.Trim() }
            if ($stringProps) {
                $promptText = ($stringProps | Select-Object -First 1).Value
            }
        }
    }
    
    # Fallback: Get first non-empty string property (excluding metadata fields)
    if (-not $promptText -and $inputJson.PSObject.Properties) {
        $excludeFields = @('conversation_id', 'generation_id', 'model', 'status', 'loop_count', 'hook_event_name', 'cursor_version', 'workspace_roots', 'user_email', 'timestamp')
        $stringProps = $inputJson.PSObject.Properties | Where-Object { 
            $_.Value -is [string] -and $_.Value.Trim() -and $excludeFields -notcontains $_.Name
        }
        if ($stringProps) {
            $promptText = ($stringProps | Select-Object -First 1).Value
        }
    }
}

# If no prompt found, try environment variables (Cursor might pass data this way)
if (-not $promptText) {
    if ($env:CURSOR_PROMPT) { $promptText = $env:CURSOR_PROMPT }
    elseif ($env:USER_MESSAGE) { $promptText = $env:USER_MESSAGE }
    elseif ($env:PROMPT_TEXT) { $promptText = $env:PROMPT_TEXT }
}

# If no prompt found, try command line argument
if (-not $promptText -and $args.Count -gt 0) {
    $promptText = $args[0]
}

# Log environment variables and all input sources for debugging
$allEnvVars = Get-ChildItem Env: | Where-Object { $_.Name -like "*CURSOR*" -or $_.Name -like "*PROMPT*" -or $_.Name -like "*MESSAGE*" } | ForEach-Object { "$($_.Name)=$($_.Value)" }
$envDebug = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: Environment vars - $($allEnvVars -join '; '), Args: $($args -join ' '), Args count: $($args.Count)"
Add-Content -Path $logFile -Value $envDebug

# If still no prompt, log the full JSON for debugging
if (-not $promptText) {
    if ($rawInput) {
        $debugEntry = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: No prompt text found. Full raw input: $rawInput"
    } else {
        $debugEntry = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: No prompt text found. Raw input is empty."
    }
    Add-Content -Path $logFile -Value $debugEntry
    
    if ($inputJson) {
        $fullJson = $inputJson | ConvertTo-Json -Depth 10
        $debugEntry = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] DEBUG: Full parsed JSON: $fullJson"
        Add-Content -Path $logFile -Value $debugEntry
    }
    
    # Return continue to Cursor (don't block the prompt)
    Write-Output '{"continue":true}'
    exit 0
}

# Read configuration from hooks.json
$hooksJsonPath = ".cursor/hooks.json"
# #region agent log - config file check
$configExists = Test-Path $hooksJsonPath
$logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"E`",`"location`":`"beforeSubmitPrompt.ps1:161`",`"message`":`"Checking hooks.json existence`",`"data`":{`"exists`":$configExists},`"timestamp`":$(Get-Date -UFormat %s)}"
Add-Content -Path $logPath -Value $logEntry
# #endregion
if (-not (Test-Path $hooksJsonPath)) {
    # #region agent log - config file missing
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"E`",`"location`":`"beforeSubmitPrompt.ps1:164`",`"message`":`"hooks.json not found, exiting`",`"data`":{},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    Write-Output '{"continue":true}'
    exit 0
}

$hooksJson = Get-Content $hooksJsonPath | ConvertFrom-Json
$candidateId = $hooksJson.candidateId
$supabaseUrl = $hooksJson.supabaseUrl
$supabaseKey = $hooksJson.supabaseServiceKey

# #region agent log - config values read
$logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"E`",`"location`":`"beforeSubmitPrompt.ps1:172`",`"message`":`"Configuration values read`",`"data`":{`"candidateIdPresent`":$(-not [string]::IsNullOrEmpty($candidateId)),`"supabaseUrlPresent`":$(-not [string]::IsNullOrEmpty($supabaseUrl)),`"supabaseKeyPresent`":$(-not [string]::IsNullOrEmpty($supabaseKey))},`"timestamp`":$(Get-Date -UFormat %s)}"
Add-Content -Path $logPath -Value $logEntry
# #endregion

if (-not $candidateId -or -not $supabaseUrl -or -not $supabaseKey) {
    # #region agent log - config incomplete
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"E`",`"location`":`"beforeSubmitPrompt.ps1:177`",`"message`":`"Configuration incomplete, exiting`",`"data`":{},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    Write-Output '{"continue":true}'
    exit 0
}

# Create logs directory
$logsDir = ".cursor\logs"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

# Prepare the prompt data
$promptJson = @{
    messages = @(
        @{
            role = "user"
            content = $promptText
        }
    )
} | ConvertTo-Json -Compress

$requestBody = @{
    p_candidate_id = $candidateId
    p_prompt_text = $promptText
    p_prompt_json = $promptJson | ConvertFrom-Json | ConvertTo-Json -Compress
    p_provider = "cursor-hooks"
    p_tool_name = "Cursor"
    p_user_agent = "Cursor/$(Get-Date -Format 'yyyyMMddHHmmss')"
    p_model_requested = if ($inputJson.model) { $inputJson.model } else { "unknown" }
    p_request_metadata = @{} | ConvertTo-Json -Compress
} | ConvertTo-Json -Compress

# #region agent log - Supabase call attempt
$logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"C`",`"location`":`"beforeSubmitPrompt.ps1:203`",`"message`":`"Attempting Supabase call`",`"data`":{`"url`":`"${supabaseUrl}/rest/v1/rpc/log_prompt`",`"candidateId`":`"$candidateId`",`"promptLength`":$($promptText.Length)},`"timestamp`":$(Get-Date -UFormat %s)}"
Add-Content -Path $logPath -Value $logEntry
# #endregion

# Call Supabase RPC function to log the prompt (non-blocking)
try {
    $response = Invoke-RestMethod -Uri "${supabaseUrl}/rest/v1/rpc/log_prompt" `
        -Method Post `
        -Headers @{
            "Content-Type" = "application/json"
            "apikey" = $supabaseKey
            "Authorization" = "Bearer $supabaseKey"
        } `
        -Body $requestBody `
        -ErrorAction SilentlyContinue `
        -TimeoutSec 2

    # #region agent log - Supabase call success
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"C`",`"location`":`"beforeSubmitPrompt.ps1:214`",`"message`":`"Supabase call succeeded`",`"data`":{`"response`":$($response | ConvertTo-Json -Compress)},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion

    $logEntry = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] Candidate: $candidateId | Prompt: $($promptText.Substring(0, [Math]::Min(100, $promptText.Length)))... | Success"
} catch {
    # #region agent log - Supabase call failed
    $logEntry = "{`"sessionId`":`"debug-session`",`"runId`":`"initial`",`"hypothesisId`":`"C`",`"location`":`"beforeSubmitPrompt.ps1:220`",`"message`":`"Supabase call failed`",`"data`":{`"error`":$($_.Exception.Message)},`"timestamp`":$(Get-Date -UFormat %s)}"
    Add-Content -Path $logPath -Value $logEntry
    # #endregion

    $logEntry = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] Candidate: $candidateId | Prompt: $($promptText.Substring(0, [Math]::Min(100, $promptText.Length)))... | Error: $($_.Exception.Message)"
}

# Log to local file for debugging
$logFile = ".cursor\logs\prompts-$(Get-Date -Format 'yyyyMMdd').log"
Add-Content -Path $logFile -Value $logEntry

# Return continue to Cursor (required format)
Write-Output '{"continue":true}'
exit 0

