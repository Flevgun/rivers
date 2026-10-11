#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
base=https://github.com/SagerNet/sing-box/releases/download/v1.12.12
mkdir -p "$root/app/libs" "$root/app/src/main/assets/rules" \
  "$root/app/src/main/jniLibs/arm64-v8a" \
  "$root/app/src/main/jniLibs/armeabi-v7a" \
  "$root/app/src/main/jniLibs/x86_64"
curl -fL -o "$root/app/libs/hev-socks5-tunnel.aar" \
  https://github.com/heiher/hev-socks5-tunnel/releases/download/2.18.0/hev-socks5-tunnel.aar
fetch() {
  abi=$1
  name=$2
  curl -fL -o "$tmp/core.tgz" "$base/sing-box-1.12.12-android-$name.tar.gz"
  rm -rf "$tmp/ex"
  mkdir "$tmp/ex"
  tar --no-same-owner -xzf "$tmp/core.tgz" -C "$tmp/ex"
  find "$tmp/ex" -type f -name sing-box -exec cp {} "$root/app/src/main/jniLibs/$abi/libsing-box.so" \;
  chmod 755 "$root/app/src/main/jniLibs/$abi/libsing-box.so"
}
fetch arm64-v8a arm64
fetch armeabi-v7a arm
fetch x86_64 amd64
if [ -d "$root/../desktop/bin/rules" ]; then
  cp "$root/../desktop/bin/rules/"*.srs "$root/app/src/main/assets/rules/"
fi
rm -rf "$tmp"
echo "cores ready"
