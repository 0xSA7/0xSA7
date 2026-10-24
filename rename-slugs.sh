#!/bin/bash
# Rename blog posts to short slugs.
# Run from ~/projects/0xSA7/

set -e

BLOG_DIR="src/content/blog"

# Slug mapping: old_name -> new_name
declare -A MAPPING=(
  ["unifying-vm-resource-minima-multipass"]="multipass-vm-minima"
  ["fixing-wrapper-generation-nixpkgs-coulomb"]="nixpkgs-coulomb-wrapper"
  ["nixos-dotfiles-raad-modular-secure-portable"]="dotfiles-raad"
  ["dram-controller-verilog-page-hit-optimization"]="dram-controller"
  ["queuepy-simulating-mmc-k-queuing-models"]="queuepy"
  ["auto-git-shell-script-commit-laziness"]="auto-git"
  ["azctf-15-first-ctf-retrospective"]="azctf-15"
  ["on-contributing-to-nixpkgs-meta"]="nixpkgs-meta"
)

echo "=== Renaming blog posts ==="

for old in "${!MAPPING[@]}"; do
  new="${MAPPING[$old]}"
  old_path="$BLOG_DIR/$old.md"
  new_path="$BLOG_DIR/$new.md"

  if [ -f "$old_path" ]; then
    if [ "$old_path" != "$new_path" ]; then
      mv "$old_path" "$new_path"
      echo "✓ $old.md → $new.md"
    else
      echo "— $old.md (already correct)"
    fi
  else
    echo "⚠ $old.md not found (skipping)"
  fi
done

echo ""
echo "=== Updating internal cross-references ==="

# Map of old slug -> new slug for cross-references
declare -A REFS=(
  ["unifying-vm-resource-minima-multipass"]="multipass-vm-minima"
  ["fixing-wrapper-generation-nixpkgs-coulomb"]="nixpkgs-coulomb-wrapper"
  ["nixos-dotfiles-raad-modular-secure-portable"]="dotfiles-raad"
  ["dram-controller-verilog-page-hit-optimization"]="dram-controller"
  ["queuepy-simulating-mmc-k-queuing-models"]="queuepy"
  ["auto-git-shell-script-commit-laziness"]="auto-git"
  ["azctf-15-first-ctf-retrospective"]="azctf-15"
  ["on-contributing-to-nixpkgs-meta"]="nixpkgs-meta"
)

for f in "$BLOG_DIR"/*.md; do
  if [ -f "$f" ]; then
    changed=0
    content=$(cat "$f")
    for old in "${!REFS[@]}"; do
      new="${REFS[$old]}"
      if echo "$content" | grep -q "/0xSA7/blog/$old/"; then
        content=$(echo "$content" | sed "s|/0xSA7/blog/$old/|/0xSA7/blog/$new/|g")
        changed=1
      fi
    done
    if [ $changed -eq 1 ]; then
      echo "$content" > "$f"
      echo "✓ Updated refs in: $(basename "$f")"
    fi
  fi
done

echo ""
echo "=== Done ==="
echo ""
echo "Verify with: ls $BLOG_DIR"
echo "Then: npm run build"
