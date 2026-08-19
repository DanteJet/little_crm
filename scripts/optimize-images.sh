#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-img}"
MAX_DIMENSION="${MAX_DIMENSION:-1920}"
JPEG_QUALITY="${JPEG_QUALITY:-82}"

if command -v magick >/dev/null 2>&1; then
  IM=(magick)
elif command -v convert >/dev/null 2>&1; then
  IM=(convert)
else
  echo "ImageMagick is required (magick or convert)." >&2
  exit 1
fi

if [[ ! -d "$ROOT" ]]; then
  echo "Directory not found: $ROOT" >&2
  exit 1
fi

bytes() {
  stat -c '%s' "$1"
}

human() {
  awk -v n="$1" 'BEGIN { printf "%.2f MB", n / 1024 / 1024 }'
}

optimize_jpeg() {
  local file="$1" tmp before after
  tmp="${file}.optimized.tmp.jpg"
  before="$(bytes "$file")"

  "${IM[@]}" "$file" \
    -auto-orient \
    -strip \
    -resize "${MAX_DIMENSION}x${MAX_DIMENSION}>" \
    -sampling-factor 4:2:0 \
    -interlace Plane \
    -quality "$JPEG_QUALITY" \
    "$tmp"

  after="$(bytes "$tmp")"
  if (( after < before )); then
    mv "$tmp" "$file"
    printf 'JPEG  %-45s %10s -> %10s\n' "$file" "$(human "$before")" "$(human "$after")"
  else
    rm -f "$tmp"
    printf 'SKIP  %-45s %10s (optimized file was not smaller)\n' "$file" "$(human "$before")"
  fi
}

optimize_png() {
  local file="$1" tmp before after
  tmp="${file}.optimized.tmp.png"
  before="$(bytes "$file")"

  "${IM[@]}" "$file" \
    -strip \
    -resize "${MAX_DIMENSION}x${MAX_DIMENSION}>" \
    -define png:compression-level=9 \
    -define png:compression-strategy=1 \
    "$tmp"

  after="$(bytes "$tmp")"
  if (( after < before )); then
    mv "$tmp" "$file"
    printf 'PNG   %-45s %10s -> %10s\n' "$file" "$(human "$before")" "$(human "$after")"
  else
    rm -f "$tmp"
    printf 'SKIP  %-45s %10s (optimized file was not smaller)\n' "$file" "$(human "$before")"
  fi
}

export -f bytes human optimize_jpeg optimize_png
export MAX_DIMENSION JPEG_QUALITY

while IFS= read -r -d '' file; do
  case "${file,,}" in
    *.jpg|*.jpeg) optimize_jpeg "$file" ;;
    *.png) optimize_png "$file" ;;
  esac
done < <(find "$ROOT" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0)

echo
echo "Largest files after optimization:"
find "$ROOT" -type f -printf '%s %p\n' \
  | sort -nr \
  | head -20 \
  | awk '{printf "%.2f MB  %s\n", $1/1024/1024, $2}'
