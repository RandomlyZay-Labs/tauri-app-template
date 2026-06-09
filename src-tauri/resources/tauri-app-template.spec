Name:           tauri-app-template
Version: 0.12.3
Release:        1%{?dist}
Summary:        Tauri App Template
License:        MIT
URL:            https://github.com/RandomlyZay-Labs/tauri-app-template

Source0:        https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v%{version}/tauri-app-template-%{version}-x86_64.rpm
Source1:        https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v%{version}/tauri-app-template-%{version}-aarch64.rpm

ExclusiveArch:  x86_64 aarch64

%description
Tauri App Template repackaged from prebuilt binary releases.

%prep
%setup -c -T
%ifarch x86_64
rpm2cpio %{SOURCE0} | cpio -idmv
%endif
%ifarch aarch64
rpm2cpio %{SOURCE1} | cpio -idmv
%endif

%build
# No build required for prebuilt binary.

%install
mkdir -p %{buildroot}
cp -a usr %{buildroot}/
cp -a etc %{buildroot}/

%files
%{_bindir}/tauri-app-template
%{_datadir}/applications/tauri-app-template.desktop
%{_datadir}/icons/hicolor/*/apps/*
%{_sysconfdir}/yum.repos.d/_copr:copr.fedorainfracloud.org:randomlyzay:tauri-app-template.repo

%changelog
* Mon Jun 08 2026 RandomlyZay Labs - %{version}-1
- Automatic build from prebuilt RPM releases.
