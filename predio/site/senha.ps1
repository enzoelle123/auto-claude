# Cadastra a senha do site na Vercel (variável SENHA_SITE, produção) sem mostrá-la na tela nem no histórico.
Set-Location $PSScriptRoot
$s1 = Read-Host -AsSecureString 'Digite a senha do site'
$s2 = Read-Host -AsSecureString 'Repita a senha'
$a = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
$b = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
if ($a -ne $b) { Write-Host 'As senhas nao conferem. Rode de novo.' -ForegroundColor Red; exit 1 }
if ($a.Length -lt 12) { Write-Host 'Use pelo menos 12 caracteres. Rode de novo.' -ForegroundColor Red; exit 1 }
# Sem isto o Windows PowerShell manda o texto em codificação antiga e acentos chegam trocados na Vercel.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $OutputEncoding
$a | npx --yes vercel@latest env add SENHA_SITE production --sensitive --force
if ($LASTEXITCODE -eq 0) { Write-Host 'Publicando o site com a senha nova (1 a 2 minutos)...'; npx --yes vercel@latest deploy --prod --yes | Out-Null }
$a = $null; $b = $null
if ($LASTEXITCODE -eq 0) { Write-Host 'Senha salva na Vercel. Pode avisar o Claude.' -ForegroundColor Green }
