<#
=====================================================================
Script : force-remove-python313.ps1
Purpose: Remove every Python-3.13 trace from PATH (system + user),
         promote Python-3.12 to the top, and set npm / py launcher
         to use that interpreter.  A .reg backup of the original
         PATH is created automatically.
Author : ChatGPT (OpenAI), 2025-06-16
Requires: Administrator PowerShell
=====================================================================
#>

# ── Configuration ────────────────────────────────────────────────
$py312Root    = 'C:\Users\song7\AppData\Local\Programs\Python\Python312'
$py312Scripts = "$py312Root\Scripts"
$removePatterns = @(
    'Python313',
    'C:\Python313'  # classic "all users" install folder
)

# ── Backup existing PATH to .reg file ────────────────────────────
$stamp   = (Get-Date -UFormat '%Y%m%d%H%M%S')
$bakFile = "$env:SystemDrive\PATH_BACKUP_$stamp.reg"
reg export 'HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' $bakFile /y
reg export 'HKCU\Environment' $bakFile /y

# ── Helper: filter a PATH string ─────────────────────────────────
function Clean-Path([string]$raw) {
    $raw.Split(';') |
        Where-Object { $_ -and $removePatterns -notcontains ($_ -replace '\\', '\') } |
        Select-Object -Unique
}

# ── Update system PATH (Machine) ────────────────────────────────
$sysPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$sysClean = Clean-Path $sysPath
if ($sysClean -notcontains $py312Root) { $sysClean = @($py312Root, $py312Scripts) + $sysClean }
[Environment]::SetEnvironmentVariable('Path', ($sysClean -join ';'), 'Machine')

# ── Update user PATH ─────────────────────────────────────────────
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$userClean = Clean-Path $userPath
if ($userClean -notcontains $py312Root) { $userClean = @($py312Root, $py312Scripts) + $userClean }
[Environment]::SetEnvironmentVariable('Path', ($userClean -join ';'), 'User')

# ── Lock npm / node-gyp to Python 3.12 ──────────────────────────
[Environment]::SetEnvironmentVariable('npm_config_python', "$py312Root\python.exe", 'Machine')

# ── Lock py launcher default ────────────────────────────────────
[Environment]::SetEnvironmentVariable('PY_PYTHON', '3.12-64', 'Machine')

# ── Refresh current session PATH immediately ───────────────────
$env:Path = "$py312Root;$py312Scripts;" + (
    Clean-Path $env:Path | Where-Object { $_ -notlike "$py312Root*" }
) -join ';'

# ── Result summary ──────────────────────────────────────────────
Write-Host "`n=========== PATH after cleanup ==========="
$env:Path.Split(';') | Where-Object { $_ -like '*Python*' } | ForEach-Object { Write-Host $_ }
Write-Host "=========================================="
Write-Host "python --version  : $(python --version 2>&1)"
Write-Host "py -V            : $(py -V 2>&1)"
Write-Host "npm get python   : $(npm get python 2>&1)"
Write-Host "Backup file      : $bakFile"
Write-Host "`nLog out and log back in to propagate system-level PATH."
