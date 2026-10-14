#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
base=https://github.com/XTLS/Xray-core/releases/download/v26.9.30
mkdir -p "$root/app/libs" "$root/app/src/main/assets" \
  "$root/app/src/main/jniLibs/arm64-v8a" \
  "$root/app/src/main/jniLibs/x86_64"
curl -fL -o "$root/app/libs/hev-socks5-tunnel.aar" \
  https://github.com/heiher/hev-socks5-tunnel/releases/download/2.18.0/hev-socks5-tunnel.aar
fetch() {
  abi=$1
  name=$2
  curl -fL -o "$tmp/core.zip" "$base/Xray-android-$name.zip"
  rm -rf "$tmp/ex"
  mkdir "$tmp/ex"
  unzip -q "$tmp/core.zip" -d "$tmp/ex"
  find "$tmp/ex" -type f -name xray -exec cp {} "$root/app/src/main/jniLibs/$abi/libxray.so" \;
  chmod 755 "$root/app/src/main/jniLibs/$abi/libxray.so"
}
fetch arm64-v8a arm64-v8a
fetch x86_64 amd64
if [ -f "$root/../desktop/bin/geoip.dat" ]; then
  cp "$root/../desktop/bin/geoip.dat" "$root/../desktop/bin/geosite.dat" "$root/app/src/main/assets/"
fi
rm -rf "$tmp"
echo "cores ready"
