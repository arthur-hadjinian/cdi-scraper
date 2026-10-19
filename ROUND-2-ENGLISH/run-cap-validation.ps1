$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$mutex = [System.Threading.Mutex]::new($false, 'Local\CDI-Cap-Validation')
if (-not $mutex.WaitOne(0)) { throw 'Cap validation is already running.' }
try {
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        $ErrorActionPreference = 'Continue'
        & node --experimental-sqlite --disable-warning=ExperimentalWarning --import tsx ../scripts/run-cap-expansion.ts 2>&1 |
            ForEach-Object { Add-Content -LiteralPath 'logs/cap-validation.log' -Value ([string]$_) }
        $validationExit = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($validationExit -eq 0) { break }
        $recentFailure = Get-Content -LiteralPath 'logs/cap-validation.log' -Tail 20 | Out-String
        if ($recentFailure -match 'OVER_QUERY_LIMIT|REQUEST_DENIED|captcha|403|429|access denied' -or (Test-Path -LiteralPath 'STOP-SUPERVISOR') -or (Test-Path -LiteralPath 'STOP-CAP-VALIDATION')) { break }
        if ($attempt -lt 2) { Start-Sleep -Seconds 120 }
    }
    if ($validationExit -ne 0) { Add-Content -LiteralPath 'logs/cap-validation.log' -Value 'Validation stopped with a saved checkpoint; collection supervisor is unchanged.' }
    if ($validationExit -eq 0 -and -not (Test-Path -LiteralPath 'STOP-SUPERVISOR')) {
        $pending = & node --experimental-sqlite --disable-warning=ExperimentalWarning --input-type=module -e 'import {DatabaseSync} from "node:sqlite";const d=new DatabaseSync("data/agents.db",{readOnly:true});console.log(d.prepare("SELECT count(*) n FROM searches WHERE status IN (?,?,?)").get("pending","in_progress","error").n);'
        $supervisorPath = Join-Path $PSScriptRoot 'run-supervised.ps1'
        $collectors = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -and $_.CommandLine.Contains($supervisorPath) })
        if ([int]$pending -gt 0 -and $collectors.Count -eq 0) {
            $latestRun = Get-ChildItem -LiteralPath 'logs' -Filter 'supervised-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            $lastRunText = if ($latestRun) { Get-Content -LiteralPath $latestRun.FullName -Raw } else { '' }
            if ($lastRunText -match 'OVER_QUERY_LIMIT|REQUEST_DENIED|captcha|\b403\b|\b429\b|access denied') {
                Add-Content -LiteralPath 'logs/cap-validation.log' -Value 'Verified work queued; collector access restriction requires attention before restart.'
            } else {
                Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$supervisorPath -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
                Add-Content -LiteralPath 'logs/cap-validation.log' -Value 'Started collector for remaining verified work after validation finished.'
            }
        }
    }
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
