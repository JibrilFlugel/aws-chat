@echo off

REM Load environment variables from .env file
if exist .env (
    for /f "eol=# tokens=*" %%i in (.env) do set %%i
)

REM Check if ALLOWED_IP is set
if "%ALLOWED_IP%"=="" (
    echo Error: ALLOWED_IP not set in .env file
    exit /b 1
)

echo Deploying with allowed IP: %ALLOWED_IP%
cdk deploy --context allowedip="%ALLOWED_IP%"