# ─────────────────────────────────────────────────────────────────────────────
# 2026-10-15 · Pedido de Shirley vía Kevin: que nadie modifique "STATUS DE FIANZAS ACTUALIZADO 2026.xlsx" y solo puedan verlo.
# Ejecutado una vez con PnP.PowerShell 3.4.1 (pwsh 7), app "PnP.PowerShell - Canal de Denuncias"
# (ClientId 6b9daaa0-32b0-4856-bbad-e9ad8137d52d), inicio de sesión por código de dispositivo con la cuenta de Kevin.
# Resultado: 3 vínculos "cualquiera de la organización puede editar" eliminados; Integrantes de la Administración → Leer;
# Propietarios Administración conservan Control total; Shirley Bujaico → Editar directo sobre el archivo.
# El ERP no se ve afectado: fianzas-import lee con permiso de aplicación (Files.Read.All) y nunca escribe el archivo.
# Repetir: pwsh -File scripts/sharepoint/fianzas-solo-lectura.ps1 (crea solo-leer.txt al lado para solo volcar permisos).
# ─────────────────────────────────────────────────────────────────────────────
#Requires -Version 7
# Deja el Excel de fianzas de SharePoint en solo lectura para todos salvo los editores indicados.
# 1) quita los vínculos compartidos "cualquiera de la organización puede editar" (había tres),
# 2) baja a Lectura al grupo Integrantes (y a cualquier otro con edición); los Propietarios conservan control total,
# 3) da Edición directa a los editores. Vuelca permisos-antes.json y permisos-despues.json.
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$site = 'https://memphisperu.sharepoint.com/sites/Administracin54'
$clientId = '6b9daaa0-32b0-4856-bbad-e9ad8137d52d'
$archivo = '/sites/Administracin54/Documentos compartidos/Administración/Fianzas/STATUS DE FIANZAS ACTUALIZADO 2026.xlsx'
$editores = @('sbujaico@memphis.pe')
function Log($m) { "[$(Get-Date -Format HH:mm:ss)] $m" | Out-File "$dir\log2.txt" -Append }

Import-Module PnP.PowerShell
Log 'conectando...'
Connect-PnPOnline -Url $site -ClientId $clientId -Tenant 'memphisperu.onmicrosoft.com' -DeviceLogin *>&1 |
  ForEach-Object { "$_" } | Out-File "$dir\log2.txt" -Append
Log "conectado como $((Get-PnPProperty -ClientObject (Get-PnPWeb) -Property CurrentUser).Email)"

function Volcar-Permisos($item, $ruta) {
  $ctx = Get-PnPContext
  $ctx.Load($item.RoleAssignments); $ctx.ExecuteQuery()
  $filas = foreach ($ra in $item.RoleAssignments) {
    $ctx.Load($ra.Member); $ctx.Load($ra.RoleDefinitionBindings); $ctx.ExecuteQuery()
    [pscustomobject]@{
      principal = $ra.Member.Title; login = $ra.Member.LoginName; tipo = "$($ra.Member.PrincipalType)"
      roles = @($ra.RoleDefinitionBindings | ForEach-Object { $_.Name })
    }
  }
  $hu = Get-PnPProperty -ClientObject $item -Property HasUniqueRoleAssignments
  $links = @(try { Get-PnPFileSharingLink -Identity $archivo | ForEach-Object { [pscustomobject]@{ id = $_.Id; tipo = "$($_.Link.Type)"; alcance = "$($_.Link.Scope)" } } } catch { "error: $_" })
  [pscustomobject]@{ archivo = $archivo; permisosUnicos = $hu; vinculos = $links; asignaciones = $filas } |
    ConvertTo-Json -Depth 5 | Out-File $ruta -Encoding utf8
}

$item = Get-PnPFile -Url $archivo -AsListItem
Log "archivo id=$($item.Id)"
Volcar-Permisos $item "$dir\permisos-antes.json"

# Quién es propietario e integrante del equipo (informativo; puede fallar por permisos de Graph)
try {
  $grp = Get-PnPMicrosoft365Group -Identity 'Administracin54@memphisperu.onmicrosoft.com'
  $own = @(Get-PnPMicrosoft365GroupOwner -Identity $grp | ForEach-Object { $_.UserPrincipalName })
  $mem = @(Get-PnPMicrosoft365GroupMember -Identity $grp | ForEach-Object { $_.UserPrincipalName })
  [pscustomobject]@{ propietarios = $own; integrantes = $mem } | ConvertTo-Json | Out-File "$dir\equipo.json" -Encoding utf8
  Log "equipo: $($own.Count) propietarios, $($mem.Count) integrantes"
} catch { Log "equipo no legible: $_" }

if (Test-Path "$dir\solo-leer.txt") { Log 'solo-leer: no se cambia nada'; exit 0 }

$ctx = Get-PnPContext
$web = Get-PnPWeb
$rolLectura = $web.RoleDefinitions.GetByType([Microsoft.SharePoint.Client.RoleType]::Reader)
$rolEdicion = $web.RoleDefinitions.GetByType([Microsoft.SharePoint.Client.RoleType]::Editor)
$ctx.Load($rolLectura); $ctx.Load($rolEdicion); $ctx.ExecuteQuery()

# 1) fuera los vínculos compartidos de edición
foreach ($l in @(Get-PnPFileSharingLink -Identity $archivo)) {
  Remove-PnPFileSharingLink -FileUrl $archivo -Identity $l.Id -Force
  Log "vínculo eliminado: $($l.Id) ($($l.Link.Type)/$($l.Link.Scope))"
}

# 2) permisos propios (ya los tenía) y todo lo que no sea Control total baja a Lectura
$hu = Get-PnPProperty -ClientObject $item -Property HasUniqueRoleAssignments
if (-not $hu) { $item.BreakRoleInheritance($true, $false); $ctx.ExecuteQuery(); Log 'herencia rota' }
$ctx.Load($item.RoleAssignments); $ctx.ExecuteQuery()
$pendientes = @()
foreach ($ra in $item.RoleAssignments) {
  $ctx.Load($ra.Member); $ctx.Load($ra.RoleDefinitionBindings); $ctx.ExecuteQuery()
  $tipos = @($ra.RoleDefinitionBindings | ForEach-Object { "$($_.RoleTypeKind)" })
  if ($ra.Member.LoginName -like 'SharingLinks.*') { $pendientes += $ra; continue }
  if ($tipos -contains 'Administrator') { Log "conserva control total: $($ra.Member.Title)"; continue }
  if ($tipos.Count -eq 1 -and $tipos[0] -eq 'Reader') { continue }
  $ra.RoleDefinitionBindings.RemoveAll(); $ra.RoleDefinitionBindings.Add($rolLectura); $ra.Update(); $ctx.ExecuteQuery()
  Log "a lectura: $($ra.Member.Title) (antes $($tipos -join ','))"
}
foreach ($ra in $pendientes) { $t = $ra.Member.Title; $ra.DeleteObject(); $ctx.ExecuteQuery(); Log "asignación de vínculo eliminada: $t" }

# 3) edición directa para los editores
foreach ($e in $editores) {
  $u = $web.EnsureUser($e); $ctx.Load($u); $ctx.ExecuteQuery()
  $b = New-Object Microsoft.SharePoint.Client.RoleDefinitionBindingCollection($ctx); $b.Add($rolEdicion)
  $null = $item.RoleAssignments.Add($u, $b); $ctx.ExecuteQuery()
  Log "edición: $($u.Title) <$($u.Email)>"
}

$item = Get-PnPFile -Url $archivo -AsListItem
Volcar-Permisos $item "$dir\permisos-despues.json"
Log 'LISTO'
