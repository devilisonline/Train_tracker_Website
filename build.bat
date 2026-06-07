@echo off
color 0B
title J2ME Build - Train Tracker

echo =========================================================
echo         TRAIN TRACKER - J2ME BUILD SCRIPT
echo =========================================================
echo.

:: ---- PATHS ----
set SRC_DIR=j2me_build\src
set CLASSES_DIR=j2me_build\classes
set PREVERIFIED_DIR=j2me_build\preverified
set BIN_DIR=j2me_build\bin
set MANIFEST=j2me_build\MANIFEST.MF

set TOOLS=A:\j2me_tools
set CLDC_JAR=%TOOLS%\microemulator-2.0.4\lib\cldcapi11.jar
set MIDP_JAR=%TOOLS%\microemulator-2.0.4\lib\midpapi20.jar
set PROGUARD_JAR=%TOOLS%\proguard-7.3.2\lib\proguard.jar

:: ---- STEP 0: CLEAN ----
echo [1/5] Cleaning old build artifacts...
if exist "%CLASSES_DIR%" rd /s /q "%CLASSES_DIR%"
if exist "%PREVERIFIED_DIR%" rd /s /q "%PREVERIFIED_DIR%"
mkdir "%CLASSES_DIR%"
mkdir "%PREVERIFIED_DIR%"
echo       Done.
echo.

:: ---- STEP 1: COMPILE ----
echo [2/5] Compiling TrainTracker.java...
javac -source 1.3 -target 1.3 -bootclasspath "%CLDC_JAR%;%MIDP_JAR%" -d "%CLASSES_DIR%" "%SRC_DIR%\TrainTracker.java"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ***** COMPILATION FAILED! *****
    pause
    exit /b 1
)
echo       Compiled successfully!
echo.

:: ---- STEP 2: COPY RESOURCES ----
echo [3/5] Copying resources (logo.png)...
if exist "%SRC_DIR%\logo.png" copy /Y "%SRC_DIR%\logo.png" "%PREVERIFIED_DIR%\logo.png" >nul
echo       Done.
echo.

:: ---- STEP 3: PREVERIFY USING PROGUARD ----
echo [4/5] Preverifying classes with ProGuard...

:: First, create a temp JAR from compiled classes for ProGuard input
jar cf "%CLASSES_DIR%\temp_input.jar" -C "%CLASSES_DIR%" .

:: Run ProGuard with -microedition for CLDC preverification
java -jar "%PROGUARD_JAR%" ^
    -injars "%CLASSES_DIR%\temp_input.jar" ^
    -outjars "%PREVERIFIED_DIR%\temp_preverified.jar" ^
    -libraryjars "%CLDC_JAR%" ^
    -libraryjars "%MIDP_JAR%" ^
    -microedition ^
    -dontshrink ^
    -dontobfuscate ^
    -dontoptimize ^
    -keep "public class TrainTracker extends javax.microedition.midlet.MIDlet { *; }" ^
    -keep "class * { *; }" ^
    -dontwarn ^
    -ignorewarnings

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ***** PREVERIFICATION FAILED! *****
    pause
    exit /b 1
)

:: Extract preverified classes from the output JAR
pushd "%PREVERIFIED_DIR%"
jar xf temp_preverified.jar
del temp_preverified.jar 2>nul
del /s /q META-INF 2>nul
rd /s /q META-INF 2>nul
popd

:: Clean temp
del "%CLASSES_DIR%\temp_input.jar" 2>nul

echo       Preverified successfully!
echo.

:: ---- STEP 4: PACKAGE JAR ----
echo [5/5] Packaging TrainTracker.jar...
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
jar cfm "%BIN_DIR%\TrainTracker.jar" "%MANIFEST%" -C "%PREVERIFIED_DIR%" .

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ***** PACKAGING FAILED! *****
    pause
    exit /b 1
)

:: Get JAR file size for JAD
for %%A in ("%BIN_DIR%\TrainTracker.jar") do set JAR_SIZE=%%~zA

:: ---- GENERATE JAD ----
echo MIDlet-1: Train Tracker,,TrainTracker> "%BIN_DIR%\TrainTracker.jad"
echo MIDlet-Name: Train Tracker>> "%BIN_DIR%\TrainTracker.jad"
echo MIDlet-Vendor: Antigravity>> "%BIN_DIR%\TrainTracker.jad"
echo MIDlet-Version: 1.0>> "%BIN_DIR%\TrainTracker.jad"
echo MIDlet-Jar-URL: TrainTracker.jar>> "%BIN_DIR%\TrainTracker.jad"
echo MIDlet-Jar-Size: %JAR_SIZE%>> "%BIN_DIR%\TrainTracker.jad"
echo MicroEdition-Configuration: CLDC-1.1>> "%BIN_DIR%\TrainTracker.jad"
echo MicroEdition-Profile: MIDP-2.0>> "%BIN_DIR%\TrainTracker.jad"

echo.
echo =========================================================
echo   BUILD SUCCESSFUL!
echo =========================================================
echo   Output files:
echo     %BIN_DIR%\TrainTracker.jar  (%JAR_SIZE% bytes)
echo     %BIN_DIR%\TrainTracker.jad
echo =========================================================
echo.
echo To test in MicroEmulator:
echo   java -jar A:\j2me_tools\microemulator-2.0.4\microemulator.jar "%BIN_DIR%\TrainTracker.jad"
echo.
pause
