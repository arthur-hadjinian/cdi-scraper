param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$supervisorPath = Join-Path $PSScriptRoot 'run-supervised.ps1'
$stopPath = Join-Path $PSScriptRoot 'STOP-SUPERVISOR'
$supervisors = @(Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and
    $_.Name -eq 'powershell.exe' -and
    $_.CommandLine -and $_.CommandLine.Contains($supervisorPath)
})
if ($CheckOnly) {
    Write-Output "Matching round-two supervisors: $($supervisors.Count). No processes stopped."
    exit 0
}
# Prevent automatic restart before stopping only the verified supervisor tree.
Set-Content -LiteralPath $stopPath -Value 'Paused manually. Saved database and CSV retained.'
foreach ($supervisor in $supervisors) {
    & taskkill.exe /PID $supervisor.ProcessId /T /F
    if ($LASTEXITCODE -ne 0) { throw "Could not stop supervisor $($supervisor.ProcessId)." }
}
Write-Output 'Scraper paused. Saved records are retained. The live viewer is unchanged.'
