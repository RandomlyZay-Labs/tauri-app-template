%global debug_package %{nil}

Name: tauri-app-template
Version: 0.12.9
Release: 1%{?dist}
Summary: Tauri App Template
License: MIT
URL: https://github.com/RandomlyZay-Labs/tauri-app-template

# No Source0/Source1 — avoids rpmbuild -bs trying to fetch/validate URLs.
# Binary RPMs are downloaded in %%prep via curl instead.
BuildRequires: curl

ExclusiveArch: x86_64 aarch64

%description
Tauri App Template repackaged from prebuilt binary releases.

%prep
%setup -c -T
%ifarch x86_64
curl -fLO "https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v%{version}/tauri-app-template-%{version}-x86_64.rpm"
rpm2cpio tauri-app-template-%{version}-x86_64.rpm | cpio -idmv
%endif
%ifarch aarch64
curl -fLO "https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v%{version}/tauri-app-template-%{version}-aarch64.rpm"
rpm2cpio tauri-app-template-%{version}-aarch64.rpm | cpio -idmv
%endif

%build
# No build required for prebuilt binary.

%install
# Copy FHS directories extracted from the upstream RPM into buildroot.
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
