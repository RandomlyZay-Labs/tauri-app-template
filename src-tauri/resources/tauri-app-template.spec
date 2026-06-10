%global debug_package %{nil}

Name: tauri-app-template
Version: 0.12.6
Release: 1%{?dist}
Summary: Tauri App Template
License: MIT
URL: https://github.com/RandomlyZay-Labs/tauri-app-template

Source0: https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v%{version}/tauri-app-template-%{version}-x86_64.rpm
Source1: https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v%{version}/tauri-app-template-%{version}-aarch64.rpm

ExclusiveArch: x86_64 aarch64

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
# Only copy known FHS directories extracted from the upstream RPM
for d in usr etc; do
    [ -d "$d" ] && cp -a "$d" %{buildroot}/
done

# -printf "/%P\n" emits path relative to buildroot prefixed with /,
# guaranteeing every entry is absolute without sed stripping.
find %{buildroot} \( -type f -o -type l \) -printf "/%P\n" \
    | sort > %{_builddir}/filelist.txt

%files -f %{_builddir}/filelist.txt

%changelog
* Mon Jun 08 2026 RandomlyZay Labs - %{version}-1
- Automatic build from prebuilt RPM releases.
