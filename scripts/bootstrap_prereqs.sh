#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ASSUME_YES=0
SKIP_SYSTEM=0
SKIP_MODEL=0
SKIP_EDGE_TTS=0

for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    --skip-system) SKIP_SYSTEM=1 ;;
    --skip-model) SKIP_MODEL=1 ;;
    --skip-edge-tts) SKIP_EDGE_TTS=1 ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/bootstrap_prereqs.sh [--yes] [--skip-system] [--skip-model] [--skip-edge-tts]

Installs public-release prerequisites where possible:
  - Node/npm package dependencies
  - ffmpeg
  - whisper.cpp / whisper-cli
  - default whisper.cpp model
  - local Edge TTS CLI in .venv-tts when edge-tts is not already available

System package installation supports macOS Homebrew and common Linux package managers
(apt, dnf, pacman). Linux whisper.cpp is built locally under vendor/whisper.cpp if no
package-manager whisper-cli is available.
USAGE
      exit 0
      ;;
  esac
done

log() { printf '==> %s\n' "$*"; }
warn() { printf 'Warning: %s\n' "$*" >&2; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }
confirm() {
  if [ "$ASSUME_YES" = "1" ]; then return 0; fi
  printf '%s [y/N]: ' "$1" >&2
  read -r answer
  case "$answer" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}
run_sudo() {
  if [ "$(id -u)" = "0" ]; then "$@"; else sudo "$@"; fi
}

install_node_modules() {
  if [ ! -d node_modules ]; then
    log 'Installing npm dependencies'
    npm install
  else
    log 'npm dependencies already installed'
  fi
}

install_system_macos() {
  if ! has_cmd brew; then
    warn 'Homebrew is not installed. Install it from https://brew.sh, then rerun this script.'
    return 1
  fi
  local packages=()
  has_cmd node || packages+=(node)
  has_cmd npm || packages+=(node)
  has_cmd ffmpeg || packages+=(ffmpeg)
  has_cmd whisper-cli || packages+=(whisper-cpp)
  if [ "${#packages[@]}" -gt 0 ]; then
    log "Installing Homebrew packages: ${packages[*]}"
    brew install "${packages[@]}"
  else
    log 'System packages already available'
  fi
}

install_system_linux_packages() {
  if has_cmd apt-get; then
    log 'Installing Linux packages with apt-get'
    run_sudo apt-get update
    local packages=(curl ca-certificates git python3 python3-venv python3-pip build-essential cmake pkg-config ffmpeg)
    # npm installs often run under NodeSource Node.js, whose `nodejs` package conflicts
    # with Ubuntu's separate `npm` package. Do not request nodejs/npm again when the
    # current npm-based installer is already running with working node and npm.
    has_cmd node || packages+=(nodejs)
    has_cmd npm || packages+=(npm)
    run_sudo apt-get install -y "${packages[@]}"
  elif has_cmd dnf; then
    log 'Installing Linux packages with dnf'
    local packages=(curl ca-certificates git python3 python3-pip gcc gcc-c++ make cmake pkgconf-pkg-config ffmpeg)
    has_cmd node || packages+=(nodejs)
    has_cmd npm || packages+=(npm)
    run_sudo dnf install -y "${packages[@]}"
  elif has_cmd pacman; then
    log 'Installing Linux packages with pacman'
    local packages=(curl ca-certificates git python python-pip base-devel cmake pkgconf ffmpeg)
    has_cmd node || packages+=(nodejs)
    has_cmd npm || packages+=(npm)
    run_sudo pacman -Sy --needed --noconfirm "${packages[@]}"
  else
    warn 'No supported Linux package manager found. Install node/npm, ffmpeg, python3, git, cmake, and a C++ toolchain manually.'
    return 1
  fi
}

install_whisper_cpp_linux() {
  if has_cmd whisper-cli; then
    log 'whisper-cli already available'
    return 0
  fi
  local bin_dir="$ROOT/.local/bin"
  local src_dir="$ROOT/vendor/whisper.cpp"
  mkdir -p "$bin_dir" "$ROOT/vendor"
  if [ ! -d "$src_dir/.git" ]; then
    log 'Cloning whisper.cpp under vendor/whisper.cpp'
    git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$src_dir"
  fi
  log 'Building whisper.cpp locally'
  cmake -S "$src_dir" -B "$src_dir/build" -DCMAKE_BUILD_TYPE=Release
  cmake --build "$src_dir/build" --config Release -j "$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
  local candidate=""
  for path in "$src_dir/build/bin/whisper-cli" "$src_dir/build/examples/main/whisper-cli" "$src_dir/build/main"; do
    if [ -x "$path" ]; then candidate="$path"; break; fi
  done
  if [ -z "$candidate" ]; then
    warn 'Built whisper.cpp but could not find whisper-cli binary. Check vendor/whisper.cpp/build.'
    return 1
  fi
  ln -sf "$candidate" "$bin_dir/whisper-cli"
  log "Installed local whisper-cli shim: $bin_dir/whisper-cli"
  export PATH="$bin_dir:$PATH"
}

install_system_deps() {
  if [ "$SKIP_SYSTEM" = "1" ]; then
    log 'Skipping system package installation'
    return 0
  fi
  case "$(uname -s)" in
    Darwin) install_system_macos ;;
    Linux)
      install_system_linux_packages || true
      install_whisper_cpp_linux || true
      ;;
    *) warn "Unsupported OS $(uname -s). Install node/npm, ffmpeg, and whisper-cli manually." ;;
  esac
}

install_edge_tts() {
  if [ "$SKIP_EDGE_TTS" = "1" ]; then
    log 'Skipping Edge TTS helper installation'
    return 0
  fi
  if has_cmd edge-tts; then
    log 'edge-tts already available'
    return 0
  fi
  if [ -x "$ROOT/.venv-tts/bin/edge-tts" ]; then
    log 'Local edge-tts venv already available'
    return 0
  fi
  if ! has_cmd python3; then
    warn 'python3 not found; skipping local edge-tts install'
    return 1
  fi
  log 'Installing local edge-tts helper in .venv-tts'
  python3 -m venv "$ROOT/.venv-tts"
  "$ROOT/.venv-tts/bin/python" -m pip install --upgrade pip >/dev/null
  "$ROOT/.venv-tts/bin/python" -m pip install edge-tts
}

download_model() {
  if [ "$SKIP_MODEL" = "1" ]; then
    log 'Skipping whisper.cpp model download'
    return 0
  fi
  local model="$ROOT/models/ggml-small-q5_1.bin"
  if [ -s "$model" ]; then
    log 'Default whisper.cpp model already exists'
    return 0
  fi
  if ! has_cmd curl; then
    warn 'curl not found; cannot download whisper.cpp model automatically'
    return 1
  fi
  mkdir -p "$ROOT/models"
  log 'Downloading default whisper.cpp Korean-capable model'
  curl -L --fail --retry 3 -o "$model.tmp" \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
  mv "$model.tmp" "$model"
}

if [ "$SKIP_SYSTEM" != "1" ] && [ "$ASSUME_YES" != "1" ]; then
  if ! confirm 'Install missing system prerequisites when supported?'; then
    SKIP_SYSTEM=1
  fi
fi

install_system_deps
install_edge_tts || true
install_node_modules
download_model || true

log 'Prerequisite bootstrap complete. Run `vc doctor` after setup to verify.'
