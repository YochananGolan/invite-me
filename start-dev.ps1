# Function to free port 3000
function Free-Port {
    Write-Host "`nCleaning port 3000..." -ForegroundColor Yellow
    
    $processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    if ($processes) {
        foreach ($pid in $processes) {
            Write-Host "Killing process $pid on port 3000" -ForegroundColor Red
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "Port 3000 is already free" -ForegroundColor Green
    }
}

# Register cleanup handler
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Free-Port
    Write-Host "Cleanup completed. Goodbye!" -ForegroundColor Cyan
}

Write-Host "Cleaning port 3000..." -ForegroundColor Yellow

# Kill any process using port 3000
$processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($processes) {
    foreach ($pid in $processes) {
        Write-Host "Killing process $pid on port 3000" -ForegroundColor Red
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Port 3000 is already free" -ForegroundColor Green
}

# Wait a moment for the port to be released
Start-Sleep -Seconds 2

Write-Host "Starting development server..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server and cleanup port 3000" -ForegroundColor Cyan

try {
    npm run dev
} finally {
    # Cleanup on exit
    Free-Port
}
