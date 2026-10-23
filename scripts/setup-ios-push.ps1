Set-Location -LiteralPath 'C:\Users\DELL\PastQMobile'
Write-Host 'PastQ iPhone push setup: choose preview, sign into Apple privately, then Push Notifications: Manage your Apple Push Notifications Key. Reuse an existing valid key when available. Keep this window open.' -ForegroundColor Cyan
& "$env:APPDATA\npm\eas.cmd" credentials --platform ios
Read-Host 'Press Enter when finished'
