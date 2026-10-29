param([string]$ConfigPath = (Join-Path $env:LOCALAPPDATA 'ObsidianNeuronas\config.json'))
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$repoPath = $config.repo
$nodePath = (Get-Command node -ErrorAction Stop).Source
$launcherPath = Join-Path $config.state 'organize-hidden.vbs'
$command = '"' + $nodePath + '" "' + (Join-Path $repoPath 'bin\organize.js') + '" --quiet --config "' + $ConfigPath + '"'
$launcher = 'Set shell = CreateObject("WScript.Shell")' + "`r`n" + 'shell.Run "' + $command.Replace('"', '""') + '", 0, True' + "`r`n"
[IO.File]::WriteAllText($launcherPath, $launcher, [Text.UTF8Encoding]::new($false))
$taskName = 'ObsidianNeuronas-Sync'
$backupDir = Join-Path (Split-Path -Parent $ConfigPath) 'backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backupPath = Join-Path $backupDir ('task-before-organizer-events-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
$original = Export-ScheduledTask -TaskName $taskName
$original | Set-Content -LiteralPath $backupPath -Encoding Unicode
[xml]$definition = $original
$uri = 'http://schemas.microsoft.com/windows/2004/02/mit/task'
$manager = [Xml.XmlNamespaceManager]::new($definition.NameTable)
$manager.AddNamespace('t', $uri)
function Set-NodeText($parent, $name, $value) {
  $node = $parent.SelectSingleNode('t:' + $name, $manager)
  if ($null -eq $node) { $node = $definition.CreateElement($name, $uri); $parent.AppendChild($node) | Out-Null }
  $node.InnerText = $value
}
$triggers = $definition.SelectSingleNode('/t:Task/t:Triggers', $manager)
while ($triggers.HasChildNodes) { $triggers.RemoveChild($triggers.FirstChild) | Out-Null }
$logon = $definition.CreateElement('LogonTrigger', $uri)
Set-NodeText $logon 'Enabled' 'true'
Set-NodeText $logon 'Delay' 'PT30S'
Set-NodeText $logon 'UserId' (Get-ScheduledTask -TaskName $taskName).Principal.UserId
$triggers.AppendChild($logon) | Out-Null
$power = $definition.CreateElement('EventTrigger', $uri)
Set-NodeText $power 'Enabled' 'true'
Set-NodeText $power 'Subscription' '<QueryList><Query Id="0" Path="System"><Select Path="System">*[System[Provider[@Name=''Microsoft-Windows-Kernel-Power''] and EventID=105]] and *[EventData[Data[@Name=''AcOnline'']=''true'']]</Select></Query></QueryList>'
Set-NodeText $power 'Delay' 'PT30S'
$triggers.AppendChild($power) | Out-Null
$settings = $definition.SelectSingleNode('/t:Task/t:Settings', $manager)
Set-NodeText $settings 'Enabled' 'true'
Set-NodeText $settings 'ExecutionTimeLimit' 'PT15M'
Set-NodeText $settings 'MultipleInstancesPolicy' 'IgnoreNew'
Set-NodeText $settings 'DisallowStartIfOnBatteries' 'false'
Set-NodeText $settings 'StopIfGoingOnBatteries' 'false'
$exec = $definition.SelectSingleNode('/t:Task/t:Actions/t:Exec', $manager)
Set-NodeText $exec 'Command' (Join-Path $env:SystemRoot 'System32\wscript.exe')
Set-NodeText $exec 'Arguments' ('"' + $launcherPath + '"')
Register-ScheduledTask -TaskName $taskName -Xml $definition.OuterXml -Force | Out-Null
$verified = Get-ScheduledTask -TaskName $taskName
$types = @($verified.Triggers | ForEach-Object { $_.CimClass.CimClassName })
if ($types.Count -ne 2 -or -not $types.Contains('MSFT_TaskLogonTrigger') -or -not $types.Contains('MSFT_TaskEventTrigger') -or @($verified.Triggers | Where-Object { $_.Repetition.Interval }).Count) { throw 'Los disparadores de evento no quedaron configurados correctamente' }
[pscustomobject]@{Task=$taskName;State=[string]$verified.State;AtLogon=$true;OnAcPower=$true;Periodic=$false;Launcher=$launcherPath;Backup=$backupPath} | ConvertTo-Json
