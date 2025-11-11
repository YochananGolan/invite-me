# Script to free port 3000 and start development server
# Usage: .\free-port-3000.ps1

# Function to free port 3000
function Free-Port {
    Write-Host "`nCleaning port 3000..." -ForegroundColor Yellow
    
    foreach ($port in @(3000, 3001)) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($connections) {
            foreach ($processId in $connections) {
                Write-Host "Killing process $processId on port $port" -ForegroundColor Red
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
            Write-Host "Port $port has been freed!" -ForegroundColor Green
        } else {
            Write-Host "Port $port is already free" -ForegroundColor Green
        }
    }
}

# Register cleanup handler
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Free-Port
    Write-Host "Cleanup completed. Goodbye!" -ForegroundColor Cyan
}

Write-Host "Cleaning port 3000..." -ForegroundColor Yellow

# Kill any process using port 3000 or 3001 (to prevent fallback)
foreach ($port in @(3000,3001)) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
  if ($connections) {
    foreach ($processId in $connections) {
      Write-Host "Killing process $processId on port $port" -ForegroundColor Red
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Port $port has been freed!" -ForegroundColor Green
  } else {
    Write-Host "Port $port is already free" -ForegroundColor Green
  }
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

