Set-Location -LiteralPath 'C:\Users\DELL\PastQMobile'
Write-Host 'PastQ 1.0.6 iPhone image notifications' -ForegroundColor Cyan
Write-Host 'The main app already has signing credentials. The new target is PastQNotificationService (com.pastq.study.notifications).'
Write-Host 'Sign into Apple privately. Reuse your valid distribution certificate and include your registered iPhone in the new ad hoc profile.'
Write-Host 'Keep passwords and verification codes in this terminal only. This command starts the build after signing is ready.'
& 'C:\Users\DELL\AppData\Roaming\npm\eas.cmd' build --platform ios --profile preview --no-wait
Write-Host 'Return to Codex when the build is queued, or share only the non-secret error.' -ForegroundColor Cyan
