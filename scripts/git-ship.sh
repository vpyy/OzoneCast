#!/usr/bin/env bash
# git-ship.sh: Bộ công cụ Git an toàn cho nhóm 5 thành viên & AI Agent dự án OzoneCast.
# Ngăn chặn commit trực tiếp vào main/develop, hỗ trợ tạo nhánh chuẩn theo mã proposal/bug.
#   me [<handle>]       Xem hoặc thiết lập handle của bạn (lưu ở .agents/me)
#   start <type>/<id>   Tạo/chuyển nhánh mới từ base (develop), ví dụ: feat/2026-11-20-fastapi-api-vanphuc
#   status              Kiểm tra trạng thái nhánh, commit so với develop
#   scope               Liệt kê các file đã thay đổi so với base
#   update              Cập nhật nhánh hiện tại với develop mới nhất (dùng git merge)
#   push                Đẩy nhánh lên remote repository
#   sync                Đồng bộ develop mới nhất sau khi PR được merge

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

BASE="${GIT_BASE:-develop}"
cur() { git symbolic-ref --short -q HEAD || echo DETACHED; }
die() { echo "✗ $*" >&2; exit 1; }
protected() { [[ "$(cur)" =~ ^(main|master|develop|DETACHED)$ ]]; }
not_protected() { ! protected || die "Đang ở '$(cur)' (nhánh được bảo vệ). Hãy chạy: ./scripts/git-ship.sh start <type>/<id>"; }

fetch_base() {
  git fetch origin --quiet || true
}

case "${1:-}" in
  me)
    if [[ -n "${2:-}" ]]; then
      [[ "$2" =~ ^[a-z][a-z0-9]{1,15}$ ]] || die "Handle không hợp lệ: chữ thường không dấu, 2-16 ký tự, bắt đầu bằng chữ cái."
      grep -qE "^\| \`$2\` \|" .agents/team.md || die "Handle '$2' không có trong .agents/team.md. Vui lòng chọn đúng handle của bạn (huusang, vanphuc, vantrung, vietan, phucan)."
      echo "$2" > .agents/me
    fi
    if [[ -s .agents/me ]]; then
      echo "Handle hiện tại: $(cat .agents/me)"
    else
      die "Chưa cài đặt handle. Chạy: ./scripts/git-ship.sh me <handle>"
    fi
    ;;

  start)
    b="${2:-}"
    [[ "$b" =~ ^(feat|fix|docs|refactor|test|chore)/[a-z0-9][a-z0-9._-]*$ ]] \
      || die "Tên nhánh phải có định dạng <type>/<id> (chữ thường không dấu, vd: feat/2026-11-20-clustering-huusang). Nhận được: '$b'"
    fetch_base
    if [[ "$(cur)" == "$b" ]]; then
      echo "✓ Đã ở nhánh $b"; exit 0
    fi
    if git show-ref --verify --quiet "refs/heads/$b"; then
      git switch "$b"
    else
      # Nếu có nhánh develop trên origin thì lấy từ origin/develop, ngược lại lấy từ HEAD
      if git rev-parse --verify -q "origin/$BASE" >/dev/null; then
        git switch -c "$b" --no-track "origin/$BASE"
      else
        git switch -c "$b"
      fi
    fi
    echo "✓ Đã chuyển sang nhánh $b"
    ;;

  status)
    fetch_base
    echo "Nhánh hiện tại: $(cur)"
    if git rev-parse --verify -q "origin/$BASE" >/dev/null; then
      echo "So với $BASE: $(git rev-list --count "origin/$BASE"..HEAD) commit mới, thiếu $(git rev-list --count HEAD.."origin/$BASE") commit."
    fi
    echo "Thay đổi chưa commit:"
    git status --short | sed 's/^/  /'
    ;;

  scope)
    fetch_base
    if git rev-parse --verify -q "origin/$BASE" >/dev/null; then
      { git diff --name-only "origin/$BASE"...HEAD; git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u
    else
      { git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u
    fi
    ;;

  update)
    not_protected
    [[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "Còn thay đổi chưa commit. Hãy commit trước khi update."
    fetch_base
    if git rev-parse --verify -q "origin/$BASE" >/dev/null; then
      git merge --no-edit "origin/$BASE" || die "Xung đột khi gộp $BASE. Vui lòng giải quyết conflict thủ công."
      echo "✓ Đã cập nhật theo $BASE"
    else
      echo "ℹ Chưa có nhánh remote origin/$BASE."
    fi
    ;;

  push)
    not_protected
    [[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "Còn thay đổi chưa commit."
    fetch_base
    git push -u origin HEAD
    echo "✓ Đã đẩy nhánh $(cur) lên remote thành công."
    ;;

  sync)
    [[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "Còn thay đổi chưa commit."
    fetch_base
    git switch "$BASE"
    git pull --ff-only origin "$BASE" || true
    echo "✓ $BASE đã được cập nhật mới nhất."
    ;;

  *)
    echo "Cách sử dụng: ./scripts/git-ship.sh {me|start|status|scope|update|push|sync}"
    exit 1
    ;;
esac
