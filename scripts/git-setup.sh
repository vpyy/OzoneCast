#!/usr/bin/env bash
# git-setup.sh: Khởi tạo hook Git (.githooks/) cho dự án OzoneCast.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -d ".githooks" ]]; then
  git config --local core.hooksPath .githooks 2>/dev/null || true
  chmod +x .githooks/* scripts/*.sh 2>/dev/null || true
fi

if [[ -z "$(git config user.name || true)" || -z "$(git config user.email || true)" ]]; then
  echo "⚠ Chưa thiết lập danh tính Git. Vui lòng chạy:" >&2
  echo "  git config --global user.name \"Họ và Tên\"" >&2
  echo "  git config --global user.email \"email@sinhvien.edu.vn\"" >&2
fi
echo "✓ Git setup hoàn tất cho dự án OzoneCast."
