#!/usr/bin/env bash
# Interactive project and action menus.

menu_pick_project() {
  local parent="$1"
  local tmp count i line slug name choice

  tmp="$(mktemp)"
  discover_projects_tsv "$parent" > "$tmp" || true
  count=$(wc -l < "$tmp" | tr -d ' ')

  if [[ "$count" -eq 0 ]]; then
    rm -f "$tmp"
    echo "No projects found under: $parent" >&2
    echo "  Add sibling folders with a JSON file named .build (see orchestrator/docs/SCHEMA.md)." >&2
    return 1
  fi

  echo ""
  echo "Projects (from .build catalogs)"
  echo "--------------------------------"
  i=0
  while IFS= read -r line; do
    ((++i))
    slug="${line%%$'\t'*}"
    name="${line#*$'\t'}"
    echo "  $i) $name  ($slug)"
  done < "$tmp"
  echo "  u) Update orchestrator (git pull)"
  echo "  q) Quit"
  echo ""
  read -r -p "Choose [1-$count / u / q]: " choice

  case "$choice" in
    q|Q)
      rm -f "$tmp"
      exit 0
      ;;
    u|U)
      rm -f "$tmp"
      MENU_CHOICE="UPDATE_ORCHESTRATOR"
      return 0
      ;;
  esac

  if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= count )); then
    line="$(sed -n "${choice}p" "$tmp")"
    rm -f "$tmp"
    MENU_SLUG="${line%%$'\t'*}"
    MENU_NAME="${line#*$'\t'}"
    MENU_CHOICE="PROJECT"
    return 0
  fi

  rm -f "$tmp"
  echo "Invalid choice." >&2
  return 1
}

menu_run_project_flow() {
  local parent="$1"
  local slug="$2"
  local proj="$parent/$slug"
  local bf="$proj/.build"

  require_build_file "$bf" || return 1
  require_git_project "$proj" || return 1
  validate_catalog_schema "$bf"

  echo ""
  echo "==> $(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" project-name "$bf")"
  local repo
  repo="$(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" repository "$bf")"
  [[ -n "$repo" ]] && echo "    repository: $repo"

  local default_id
  default_id="$(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" default-action "$bf")"
  if [[ -z "$default_id" ]]; then
    echo "error: .build menu.defaultAction is not set" >&2
    return 1
  fi

  run_action "$proj" "$bf" "$default_id" || return 1

  local prompt_line prompt_text action_id ans
  while IFS= read -r prompt_line; do
    [[ -z "$prompt_line" ]] && continue
    prompt_text="${prompt_line%%$'\t'*}"
    action_id="${prompt_line#*$'\t'}"
    echo ""
    read -r -p "$prompt_text (y/n) " ans
    case "$ans" in
      y|Y|yes|YES)
        run_action "$proj" "$bf" "$action_id" || echo "Action failed (see above)."
        ;;
      *)
        echo "Skipped."
        ;;
    esac
  done < <(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" after-prompts "$bf")

  echo "==> Done."
}

menu_run_noninteractive() {
  local parent="$1"
  local slug="$2"
  local proj="$parent/$slug"
  local bf="$proj/.build"

  require_build_file "$bf" || return 1
  require_git_project "$proj" || return 1

  local default_id
  default_id="$(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" default-action "$bf")"
  [[ -n "$default_id" ]] || return 1
  run_action "$proj" "$bf" "$default_id"
}
