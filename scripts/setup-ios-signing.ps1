$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
Write-Host 'PastQ iPhone signing setup' -ForegroundColor Cyan
Write-Host 'Expected project: @emmanuelwritecode/focalpoint; bundle: com.pastq.study'
Write-Host 'Choose preview. Sign into Apple here, then choose Build Credentials > All.'
Write-Host 'If asked for devices, register/include the iPhone you will test with.'
Write-Host 'Enter passwords and verification codes only in this terminal, never in chat.'
& eas whoami
& eas credentials --platform ios
Write-Host 'Return to Codex when setup is complete, or share only the non-secret error.' -ForegroundColor Cyan
