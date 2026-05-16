; Tell the NSIS compiler exactly where the locally downloaded plugins are sitting.
; We include both 4-level and 5-level deep paths to cover both untargeted local builds and targeted CI builds.

; For standard untargeted builds (e.g., running locally without a --target flag)
!addplugindir "..\..\..\..\nsis\amd64-unicode"
!addplugindir "..\..\..\..\nsis\x86-unicode"

; For targeted builds (e.g., GitHub Actions matrix using --target aarch64-pc-windows-msvc)
!addplugindir "..\..\..\..\..\nsis\amd64-unicode"
!addplugindir "..\..\..\..\..\nsis\x86-unicode"

# NSIS Hook for Tauri v2
# Safely adds the app installation directory to the User PATH and updates the system immediately.
!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing CLI wrapper to isolated bin directory..."
  CreateDirectory "$INSTDIR\bin"
  SetOutPath "$INSTDIR\bin"
  
  !if /FileExists "..\..\..\..\nsis\tauri-app-template-cli.exe"
    File "..\..\..\..\nsis\tauri-app-template-cli.exe"
  !else if /FileExists "..\..\..\..\..\nsis\tauri-app-template-cli.exe"
    File "..\..\..\..\..\nsis\tauri-app-template-cli.exe"
  !else
    !error "Could not find tauri-app-template-cli.exe to bundle!"
  !endif

  DetailPrint "Adding $INSTDIR\bin to the user PATH environment variable..."
  
  ; Target the Current User registry (HKCU) to avoid needing admin rights
  EnVar::SetHKCU
  
  ; Safely append the isolated bin directory to the Path
  EnVar::AddValue "Path" "$INSTDIR\bin"
  
  ; Broadcast the environment change so the CLI is immediately available
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\bin\tauri-app-template-cli.exe"
  RMDir "$INSTDIR\bin"
  
  DetailPrint "Removing $INSTDIR\bin from the user PATH environment variable..."
  
  ; Target the Current User registry (HKCU)
  EnVar::SetHKCU
  
  ; Safely remove the isolated bin from the Path
  EnVar::DeleteValue "Path" "$INSTDIR\bin"
  
  ; Broadcast the environment change so the system knows it's gone
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend