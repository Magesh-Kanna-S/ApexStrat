@echo off
setlocal EnableDelayedExpansion

title GitHub App Push Tool

echo.
echo ==========================================
echo        GitHub App Push Tool
echo ==========================================
echo.

REM ------------------------------------------
REM Check Git
REM ------------------------------------------
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed.
    echo Install Git from https://git-scm.com/
    pause
    exit /b 1
)

REM ------------------------------------------
REM Check GitHub CLI
REM ------------------------------------------
where gh >nul 2>&1
if errorlevel 1 (
    echo ERROR: GitHub CLI ^(gh^) is not installed.
    echo Install it from https://cli.github.com/
    pause
    exit /b 1
)

REM ------------------------------------------
REM Check GitHub login
REM ------------------------------------------
echo Checking GitHub login...
gh auth status >nul 2>&1

if errorlevel 1 (
    echo.
    echo You are not logged in to GitHub.
    echo Opening GitHub login...
    echo.
    
    gh auth login

    if errorlevel 1 (
        echo.
        echo GitHub login failed.
        pause
        exit /b 1
    )
)

echo.
echo GitHub login OK.
echo.

REM ------------------------------------------
REM Get current folder
REM ------------------------------------------
set "APP_FOLDER=%CD%"

echo Current project folder:
echo %APP_FOLDER%
echo.

REM ------------------------------------------
REM Main Menu
REM ------------------------------------------
:MAIN_MENU

echo.
echo ==========================================
echo What do you want to do?
echo ==========================================
echo.
echo 1. Update an existing repository
echo 2. Create a new repository
echo 3. Exit
echo.

set "CHOICE="
set /p "CHOICE=Enter your choice (1-3): "

if "%CHOICE%"=="1" goto UPDATE_REPO
if "%CHOICE%"=="2" goto NEW_REPO
if "%CHOICE%"=="3" goto EXIT

echo.
echo Invalid choice.
echo Please enter 1, 2, or 3.
goto MAIN_MENU


REM ==========================================================
REM UPDATE EXISTING REPOSITORY
REM ==========================================================
:UPDATE_REPO

echo.
echo ==========================================
echo Update Existing Repository
echo ==========================================
echo.

echo Loading your GitHub repositories...
echo.

set "COUNT=0"

REM ------------------------------------------
REM Get repositories and create numbered list
REM ------------------------------------------
for /f "delims=" %%R in ('gh repo list --limit 100 --json nameWithOwner --jq ".[].nameWithOwner"') do (
    set /a COUNT+=1
    set "REPO_!COUNT!=%%R"
    echo !COUNT!. %%R
)

if "%COUNT%"=="0" (
    echo.
    echo No GitHub repositories found.
    echo.
    pause
    goto MAIN_MENU
)

echo.
echo ==========================================
echo.

set "REPO_CHOICE="
set /p "REPO_CHOICE=Enter repository number (1-%COUNT%): "

REM ------------------------------------------
REM Validate selection
REM ------------------------------------------
if not defined REPO_CHOICE (
    echo.
    echo Invalid selection.
    pause
    goto UPDATE_REPO
)

set "REPO=!REPO_%REPO_CHOICE%!"

if not defined REPO (
    echo.
    echo Invalid repository selection.
    pause
    goto UPDATE_REPO
)

echo.
echo ==========================================
echo Selected Repository
echo ==========================================
echo.
echo %REPO%
echo.

REM ------------------------------------------
REM Confirm replacement
REM ------------------------------------------
set "CONFIRM="
set /p "CONFIRM=CLEAR the existing repository and replace it with this folder? (Y/N): "

if /I not "%CONFIRM%"=="Y" (
    echo.
    echo Cancelled.
    pause
    goto MAIN_MENU
)

goto PUSH_TO_REPO


REM ==========================================================
REM CREATE NEW REPOSITORY
REM ==========================================================
:NEW_REPO

echo.
echo ==========================================
echo Create New Repository
echo ==========================================
echo.

set "NEW_NAME="
set /p "NEW_NAME=Enter the new repository name: "

if not defined NEW_NAME (
    echo.
    echo Repository name cannot be empty.
    pause
    goto NEW_REPO
)

echo.
echo Repository name:
echo %NEW_NAME%
echo.

REM ------------------------------------------
REM Choose visibility
REM ------------------------------------------
echo Choose visibility:
echo.
echo 1. Public
echo 2. Private
echo.

set "VISIBILITY="
set "VIS="

set /p "VISIBILITY=Enter choice (1-2): "

if "%VISIBILITY%"=="1" set "VIS=--public"
if "%VISIBILITY%"=="2" set "VIS=--private"

if not defined VIS (
    echo.
    echo Invalid choice.
    pause
    goto NEW_REPO
)

echo.
echo Creating GitHub repository...
echo.

gh repo create "%NEW_NAME%" %VIS%

if errorlevel 1 (
    echo.
    echo ERROR: Could not create repository.
    pause
    goto MAIN_MENU
)

REM ------------------------------------------
REM Get authenticated GitHub username
REM ------------------------------------------
for /f "delims=" %%U in ('gh api user --jq ".login"') do (
    set "USERNAME=%%U"
)

set "REPO=%USERNAME%/%NEW_NAME%"

echo.
echo ==========================================
echo Repository Created
echo ==========================================
echo.
echo %REPO%
echo.

goto PUSH_TO_REPO


REM ==========================================================
REM PUSH PROJECT
REM ==========================================================
:PUSH_TO_REPO

echo.
echo ==========================================
echo Preparing Project
echo ==========================================
echo.

cd /d "%APP_FOLDER%"

REM ------------------------------------------
REM Initialize Git if necessary
REM ------------------------------------------
if not exist ".git" (
    echo Initializing Git repository...
    git init

    if errorlevel 1 (
        echo.
        echo ERROR: Git initialization failed.
        pause
        exit /b 1
    )
)

REM ------------------------------------------
REM Configure branch
REM ------------------------------------------
echo.
echo Setting branch to main...
git branch -M main

if errorlevel 1 (
    echo.
    echo ERROR: Could not set main branch.
    pause
    exit /b 1
)

REM ------------------------------------------
REM Remove old remote
REM ------------------------------------------
echo.
echo Removing existing origin remote...
git remote remove origin >nul 2>&1

REM ------------------------------------------
REM Add GitHub remote
REM ------------------------------------------
echo.
echo Adding GitHub remote...
echo Repository: %REPO%
echo.

git remote add origin "https://github.com/%REPO%.git"

if errorlevel 1 (
    echo.
    echo ERROR: Could not add GitHub remote.
    pause
    exit /b 1
)

REM ------------------------------------------
REM Show remote
REM ------------------------------------------
echo.
echo GitHub remote:
git remote -v

REM ------------------------------------------
REM Add all files
REM ------------------------------------------
echo.
echo ==========================================
echo Adding project files...
echo ==========================================
echo.

git add -A

if errorlevel 1 (
    echo.
    echo ERROR: Could not add project files.
    pause
    exit /b 1
)

REM ------------------------------------------
REM Check if there are changes to commit
REM ------------------------------------------
git diff --cached --quiet

if errorlevel 1 (
    echo.
    echo Creating commit...
    git commit -m "Update application"

    if errorlevel 1 (
        echo.
        echo ERROR: Commit failed.
        pause
        exit /b 1
    )
) else (
    echo.
    echo No file changes detected.
    echo Nothing new to commit.
)

REM ------------------------------------------
REM Push
REM ------------------------------------------
echo.
echo ==========================================
echo Pushing application to GitHub...
echo ==========================================
echo.

git push -u origin main --force

if errorlevel 1 (
    echo.
    echo ==========================================
    echo ERROR: Push failed.
    echo ==========================================
    echo.
    echo Check:
    echo - GitHub login
    echo - Repository selection
    echo - Internet connection
    echo - GitHub repository permissions
    echo.
    pause
    exit /b 1
)

REM ------------------------------------------
REM Success
REM ------------------------------------------
echo.
echo ==========================================
echo              SUCCESS!
echo ==========================================
echo.
echo Application pushed to:
echo https://github.com/%REPO%
echo.
echo Local project:
echo %APP_FOLDER%
echo.

pause
exit /b 0


REM ==========================================================
REM EXIT
REM ==========================================================
:EXIT

echo.
echo Exiting...
echo.

pause
exit /b 0
