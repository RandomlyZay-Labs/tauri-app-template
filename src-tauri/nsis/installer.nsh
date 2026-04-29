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
  DetailPrint "Adding $INSTDIR to the user PATH environment variable..."
  
  ; Target the Current User registry (HKCU) to avoid needing admin rights
  EnVar::SetHKCU
  
  ; Safely append the installation directory to the Path
  EnVar::AddValue "Path" "$INSTDIR"
  
  ; Broadcast the environment change so the CLI is immediately available
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Removing $INSTDIR from the user PATH environment variable..."
  
  ; Target the Current User registry (HKCU)
  EnVar::SetHKCU
  
  ; Safely remove the installation directory from the Path
  EnVar::DeleteValue "Path" "$INSTDIR"
  
  ; Broadcast the environment change so the system knows it's gone
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend