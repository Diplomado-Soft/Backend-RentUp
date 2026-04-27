# RentUP - Script de Inicio Rápido (PowerShell)
# Uso: .\start.ps1

param(
    [Parameter(Position = 0)]
    [string]$Option = ""
)

$colors = @{
    Green  = "`e[32m"
    Red    = "`e[31m"
    Yellow = "`e[33m"
    Blue   = "`e[34m"
    Cyan   = "`e[36m"
    Reset  = "`e[0m"
}

function Write-Success([string]$message) {
    Write-Host "$($colors.Green)✅ $message$($colors.Reset)"
}

function Write-Error([string]$message) {
    Write-Host "$($colors.Red)❌ $message$($colors.Reset)"
}

function Write-Warning([string]$message) {
    Write-Host "$($colors.Yellow)⚠️  $message$($colors.Reset)"
}

function Write-Info([string]$message) {
    Write-Host "$($colors.Blue)ℹ️  $message$($colors.Reset)"
}

function Write-Header([string]$title) {
    Write-Host "`n$($colors.Cyan)╔════════════════════════════════════════════════════════════╗$($colors.Reset)"
    Write-Host "$($colors.Cyan)║  $([string]::new(' ', [Math]::Max(0, 57 - $title.Length)))"
    Write-Host "$($colors.Cyan)║  $title"
    Write-Host "$($colors.Cyan)╚════════════════════════════════════════════════════════════╝$($colors.Reset)`n"
}

function Get-ScriptDirectory {
    if ($PSScriptRoot) {
        return $PSScriptRoot
    }
    return (Get-Location).Path
}

function Test-ProjectStructure {
    param([string]$rootDir)
    
    $serverExists = Test-Path (Join-Path $rootDir "server")
    $clientExists = Test-Path (Join-Path $rootDir "client")
    
    if (-not $serverExists -or -not $clientExists) {
        Write-Error "Estructura del proyecto incompleta"
        Write-Info "Se requieren carpetas: server/ y client/"
        return $false
    }
    
    Write-Success "Estructura del proyecto detectada"
    return $true
}

function Start-Backend {
    param([string]$rootDir)
    
    Write-Header "🚀 Iniciando Backend"
    Write-Info "Navegando a servidor..."
    Set-Location (Join-Path $rootDir "server")
    
    Write-Info "Iniciando en puerto 3001..."
    npm start
}

function Start-Frontend {
    param([string]$rootDir)
    
    Write-Header "🚀 Iniciando Frontend"
    Write-Info "Navegando a cliente..."
    Set-Location (Join-Path $rootDir "client")
    
    Write-Info "Iniciando en puerto 3000..."
    npm start
}

function Start-Both {
    param([string]$rootDir)
    
    Write-Header "🚀 Iniciando Backend y Frontend"
    
    Write-Info "Abriendo Backend..."
    $backendPath = Join-Path $rootDir "server"
    Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$backendPath'; npm start`" -WindowTitle 'RentUP Backend'"
    
    Write-Info "Esperando que el backend inicie..."
    Start-Sleep -Seconds 3
    
    Write-Info "Abriendo Frontend..."
    $clientPath = Join-Path $rootDir "client"
    Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$clientPath'; npm start`" -WindowTitle 'RentUP Frontend'"
    
    Write-Success "Servidores iniciados:"
    Write-Host "   - Backend:  http://localhost:3001"
    Write-Host "   - Frontend: http://localhost:3000"
}

function Install-Dependencies {
    param([string]$rootDir)
    
    Write-Header "📦 Instalando Dependencias"
    
    # Backend
    Write-Info "Instalando Backend..."
    Set-Location (Join-Path $rootDir "server")
    if (-not (npm install 2>&1 | Select-String "up to date|added")) {
        Write-Error "Error instalando Backend"
        return $false
    }
    Write-Success "Backend instalado"
    
    # Frontend
    Write-Info "Instalando Frontend..."
    Set-Location (Join-Path $rootDir "client")
    if (-not (npm install 2>&1 | Select-String "up to date|added")) {
        Write-Error "Error instalando Frontend"
        return $false
    }
    Write-Success "Frontend instalado"
    
    return $true
}

function Run-Diagnostics {
    param([string]$rootDir)
    
    Write-Header "🔍 Ejecutando Diagnósticos"
    
    $diagnosticFile = Join-Path $rootDir "diagnose.js"
    if (-not (Test-Path $diagnosticFile)) {
        Write-Error "No se encuentra diagnose.js"
        return
    }
    
    Set-Location $rootDir
    node diagnose.js
}

function Clean-Install {
    param([string]$rootDir)
    
    Write-Header "🧹 Limpiando e Reinstalando"
    
    Write-Warning "Eliminando node_modules anteriores..."
    $serverNodeModules = Join-Path $rootDir "server" "node_modules"
    $clientNodeModules = Join-Path $rootDir "client" "node_modules"
    
    if (Test-Path $serverNodeModules) {
        Remove-Item -Path $serverNodeModules -Recurse -Force
    }
    if (Test-Path $clientNodeModules) {
        Remove-Item -Path $clientNodeModules -Recurse -Force
    }
    
    Write-Info "Reinstalando dependencias..."
    if (Install-Dependencies -rootDir $rootDir) {
        Write-Success "Reinstalación completada"
    }
}

function Show-Menu {
    Write-Header "RentUP - Script de Inicio Rápido"
    Write-Host "
📋 Selecciona una opción:

[1] Iniciar solo Backend (npm start en server/)
[2] Iniciar solo Frontend (npm start en client/)
[3] Iniciar Backend y Frontend en terminales separadas
[4] Instalar dependencias (npm install)
[5] Ejecutar diagnósticos
[6] Limpiar y reinstalar todo
[7] Salir

"
    $choice = Read-Host "Opción (1-7)"
    return $choice
}

# ============ Programa Principal ============

$scriptDir = Get-ScriptDirectory
$projectValid = Test-ProjectStructure -rootDir $scriptDir

if (-not $projectValid) {
    Write-Error "No se puede continuar sin la estructura correcta"
    exit 1
}

# Si se proporcionó opción como argumento
$selectedOption = if ($Option) { $Option } else { Show-Menu }

switch ($selectedOption) {
    "1" { Start-Backend -rootDir $scriptDir }
    "2" { Start-Frontend -rootDir $scriptDir }
    "3" { Start-Both -rootDir $scriptDir }
    "4" { Install-Dependencies -rootDir $scriptDir | Out-Null }
    "5" { Run-Diagnostics -rootDir $scriptDir }
    "6" { Clean-Install -rootDir $scriptDir }
    "7" { Write-Info "Saliendo..."; exit 0 }
    default { Write-Error "Opción no válida"; exit 1 }
}

Write-Host "`n"
