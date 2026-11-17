#!/usr/bin/env python3
"""Sinh bảng index cho `.agents/notes/` từ chính các file note (không ghi tay).

    python scripts/notes_index.py            # Bảng proposal (markdown) ra stdout
    python scripts/notes_index.py --bugs     # Bảng danh sách bug ra stdout
    python scripts/notes_index.py --check    # Kiểm tra tính nhất quán, exit 1 nếu có lỗi
    python scripts/notes_index.py --gate <id> # Exit 1 nếu proposed/<id>.md có mà §9 chưa Approved

Chỉ dùng thư viện chuẩn Python (Standard Library), không gọi mạng, tương thích Windows/Linux/macOS.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
import sys

DEFAULT_NOTES_DIR = Path(__file__).resolve().parents[1] / ".agents" / "notes"

DECISIONS = ("Pending", "Changes Requested", "Approved", "Rejected")
DECISION_TO_STATUS = {
    "Pending": "proposed",
    "Changes Requested": "changes_requested",
    "Approved": "approved",
    "Rejected": "rejected",
}
IMPL_STATUSES = ("planned", "in_progress", "blocked", "validation", "completed")

ID_RE = r"\d{4}-\d{2}-\d{2}-[A-Za-z0-9][A-Za-z0-9-]*"
_ID_LINE = re.compile(r"^- ID:\s*(\S+)\s*$", re.M)
_TITLE = re.compile(r"^# Proposal:\s*(.+?)\s*$", re.M)
_AREA = re.compile(r"^- Area:\s*(.+?)\s*$", re.M)
_META_STATUS = re.compile(r"^- Status:\s*(\S+)", re.M)
_DECISION = re.compile(r"^Decision:\s*(Pending|Changes Requested|Approved|Rejected)\b", re.M)
_DECISION_ANY = re.compile(r"^Decision:\s*(.*)$", re.M)
_OVERRIDES = re.compile(r"Overrides:\s*(" + ID_RE + ")")
_IMPL_STATUS = re.compile(r"^- Status:\s*(\S+)", re.M)

_BUG_TITLE = re.compile(r"^#\s*(BUG-[A-Za-z0-9-]+?):\s*(.+?)\s*$", re.M)


@dataclass
class Proposal:
    file_id: str
    id: str | None
    title: str | None
    area: str | None
    meta_status: str | None
    decision: str | None
    decision_raw: str | None
    overrides: list[str]
    impl_status: str | None
    has_impl_dir: bool
    has_impl_status: bool


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _metadata_block(text: str) -> str:
    """Trích xuất phần từ `## Metadata` tới dấu `---` đầu tiên sau đó."""
    start = text.find("## Metadata")
    if start < 0:
        return ""
    end = text.find("\n---", start)
    return text[start : end if end >= 0 else len(text)]


def _clean_area(raw: str) -> str:
    return re.sub(r"\s+", " ", raw).strip()


def load_proposals(notes_dir: Path) -> list[Proposal]:
    out: list[Proposal] = []
    proposed_dir = notes_dir / "proposed"
    if not proposed_dir.is_dir():
        return out

    for path in sorted(proposed_dir.glob("*.md")):
        if path.name.startswith("_"):
            continue
        text = _read(path)
        meta = _metadata_block(text)
        m_id = _ID_LINE.search(meta)
        m_title = _TITLE.search(text)
        m_area = _AREA.search(meta)
        m_status = _META_STATUS.search(meta)
        m_dec = _DECISION.search(text)
        m_dec_any = _DECISION_ANY.search(text)
        impl_dir = notes_dir / "implemented" / path.stem
        status_file = impl_dir / "status.md"
        impl_status = None
        if status_file.is_file():
            m = _IMPL_STATUS.search(_metadata_block(_read(status_file)))
            impl_status = m.group(1) if m else None
        out.append(
            Proposal(
                file_id=path.stem,
                id=m_id.group(1) if m_id else None,
                title=m_title.group(1) if m_title else None,
                area=_clean_area(m_area.group(1)) if m_area else None,
                meta_status=m_status.group(1) if m_status else None,
                decision=m_dec.group(1) if m_dec else None,
                decision_raw=m_dec_any.group(1).strip() if m_dec_any else None,
                overrides=_OVERRIDES.findall(meta),
                impl_status=impl_status,
                has_impl_dir=impl_dir.is_dir(),
                has_impl_status=status_file.is_file(),
            )
        )
    return out


def id_matches(note_id: str, file_id: str) -> bool:
    return note_id == file_id or file_id.startswith(note_id + "-")


def resolve(target: str, proposals: list[Proposal]) -> Proposal | None:
    for p in proposals:
        if id_matches(target, p.file_id):
            return p
    return None


def superseded_map(proposals: list[Proposal]) -> dict[str, list[str]]:
    """file_id bị thay -> danh sách ID proposal thay thế nó."""
    result: dict[str, list[str]] = {}
    for p in proposals:
        for target in p.overrides:
            hit = resolve(target, proposals)
            if hit is not None:
                result.setdefault(hit.file_id, []).append(p.id or p.file_id)
    return result


def _cell(value: str | None) -> str:
    return (value or "—").replace("|", "\\|")


def render_proposals(notes_dir: Path) -> str:
    proposals = load_proposals(notes_dir)
    if not proposals:
        return "*(Chưa có proposal nào trong .agents/notes/proposed/)*\n"

    sup = superseded_map(proposals)
    lines = [
        "| ID | Tiêu đề | Area | Decision | Implementation |",
        "|---|---|---|---|---|",
    ]
    for p in sorted(proposals, key=lambda x: x.file_id):
        decision = p.decision or "?"
        if p.file_id in sup:
            decision += " (superseded by " + ", ".join(sup[p.file_id]) + ")"
        if p.has_impl_status and p.impl_status:
            impl = f"[{p.impl_status}](implemented/{p.file_id}/status.md)"
        else:
            impl = "—"
        lines.append(
            f"| [{p.id or p.file_id}](proposed/{p.file_id}.md) | {_cell(p.title)} | {_cell(p.area)} "
            f"| {decision} | {impl} |"
        )
    return "\n".join(lines) + "\n"


def _bug_field(text: str, name: str) -> str | None:
    m = re.search(r"^- \*\*" + re.escape(name) + r":\*\*\s*(.*)$", text, re.M)
    if not m:
        return None
    value = re.sub(r"<!--.*?-->", "", m.group(1)).strip()
    return value or None


def render_bugs(notes_dir: Path) -> str:
    bugs_dir = notes_dir / "bugs"
    if not bugs_dir.is_dir():
        return "*(Chưa có thư mục bugs)*\n"

    bug_files = sorted(bugs_dir.glob("BUG-*.md"))
    if not bug_files:
        return "*(Chưa có bug nào được ghi nhận)*\n"

    lines = [
        "| ID | Tiêu đề | Status | Severity | Area | Reported | Fixed | File |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for path in bug_files:
        text = _read(path)
        m = _BUG_TITLE.search(text)
        bug_id, title = (m.group(1), m.group(2)) if m else (path.stem, None)
        reported = _bug_field(text, "Reported")
        fixed = _bug_field(text, "Fixed")
        reported = reported.split(" ", 1)[0] if reported else None
        fixed = fixed.split(" ", 1)[0] if fixed else None
        lines.append(
            f"| {bug_id} | {_cell(title)} | {_cell(_bug_field(text, 'Status'))} "
            f"| {_cell(_bug_field(text, 'Severity'))} | {_cell(_bug_field(text, 'Area'))} "
            f"| {_cell(reported)} | {_cell(fixed)} | [{bug_id}](bugs/{path.name}) |"
        )
    return "\n".join(lines) + "\n"


def check(notes_dir: Path) -> list[str]:
    errors: list[str] = []
    proposals = load_proposals(notes_dir)

    for p in proposals:
        where = f"proposed/{p.file_id}.md"
        if p.id is None:
            errors.append(f"{where}: thiếu `- ID:` trong Metadata")
        elif not id_matches(p.id, p.file_id):
            errors.append(f"{where}: ID trong Metadata ({p.id}) không khớp tên file")
        if p.title is None:
            errors.append(f"{where}: thiếu dòng `# Proposal:`")
        if p.decision is None:
            got = f" (đang là `{p.decision_raw}`)" if p.decision_raw else ""
            errors.append(
                f"{where}: thiếu hoặc sai `Decision:` ở §9{got}; hợp lệ: {', '.join(DECISIONS)}"
            )
        elif p.meta_status is not None and p.meta_status != DECISION_TO_STATUS[p.decision]:
            errors.append(
                f"{where}: Metadata Status `{p.meta_status}` lệch Decision `{p.decision}` "
                f"(mong đợi `{DECISION_TO_STATUS[p.decision]}`)"
            )
        if p.decision == "Approved" and not p.has_impl_status:
            errors.append(f"{where}: Approved nhưng chưa có implemented/{p.file_id}/status.md")
        if p.impl_status is not None and p.impl_status not in IMPL_STATUSES:
            errors.append(
                f"implemented/{p.file_id}/status.md: Status `{p.impl_status}` không hợp lệ "
                f"({', '.join(IMPL_STATUSES)})"
            )
        for target in p.overrides:
            if resolve(target, proposals) is None:
                errors.append(f"{where}: `Overrides: {target}` trỏ tới proposal không tồn tại")

    impl_root = notes_dir / "implemented"
    if impl_root.is_dir():
        for d in sorted(impl_root.iterdir()):
            if (
                d.is_dir()
                and not d.name.startswith("_")
                and not any(p.file_id == d.name for p in proposals)
            ):
                errors.append(f"implemented/{d.name}/: không có proposed/{d.name}.md tương ứng")
    return errors


def gate(notes_dir: Path, note_id: str) -> tuple[int, str]:
    path = notes_dir / "proposed" / f"{note_id}.md"
    if not path.is_file():
        return 0, f"⚠ Không có proposed/{note_id}.md: coi là việc tầm thường, không kiểm Decision"
    m = _DECISION.search(_read(path))
    decision = m.group(1) if m else None
    if decision == "Approved":
        return 0, f"✓ proposed/{note_id}.md: Approved"
    shown = decision or "thiếu/sai"
    return 1, (
        f"✗ proposed/{note_id}.md có Decision `{shown}`: chưa được phép push code. "
        "Chờ Reviewer ghi `Decision: Approved` ở mục §9."
    )


def _force_utf8_output() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8")
            except (ValueError, OSError):
                pass


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--bugs", action="store_true", help="In bảng danh sách bug thay vì bảng proposal")
    group.add_argument("--check", action="store_true", help="Kiểm tra tính nhất quán, exit 1 nếu có lỗi")
    group.add_argument(
        "--gate",
        metavar="ID",
        help="Exit 1 nếu proposed/<ID>.md tồn tại mà §9 chưa Approved",
    )
    parser.add_argument(
        "--notes-dir",
        type=Path,
        default=DEFAULT_NOTES_DIR,
        help="Thư mục notes (mặc định .agents/notes)",
    )
    args = parser.parse_args(argv)
    _force_utf8_output()

    notes_dir: Path = args.notes_dir
    if not notes_dir.is_dir():
        print(f"✗ Không thấy thư mục notes: {notes_dir}", file=sys.stderr)
        return 2

    if args.gate is not None:
        code, message = gate(notes_dir, args.gate)
        print(message, file=sys.stderr)
        return code

    if args.check:
        errors = check(notes_dir)
        if errors:
            print(f"✗ {len(errors)} lỗi trong .agents/notes/:", file=sys.stderr)
            for e in errors:
                print(f"  - {e}", file=sys.stderr)
            return 1
        print("✓ .agents/notes/ hoàn toàn nhất quán")
        return 0

    sys.stdout.write(render_bugs(notes_dir) if args.bugs else render_proposals(notes_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
