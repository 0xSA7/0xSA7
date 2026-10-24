---
title: "From a bug fix to package co-maintainer in nixpkgs: Coulomb case study"
description: "How fixing a phase-ordering bug in Coulomb's Nix derivation led to becoming co-maintainer of the package, and how wrapGAppsHook4 builds its wrappers."
pubDate: 2026-06-13
tags: ["open-source", "nixos", "nixpkgs", "gtk", "maintainer"]
draft: false
readTime: "5 min read"
pr: "https://github.com/NixOS/nixpkgs/pull/526664"
---

I use [Coulomb](https://github.com/hamza-algohary/Coulomb) for quick
circuit sketches. It's a Java application built on GTK4 and libadwaita,
so it relies on the same icon themes, font configs, and shared
libraries as any other GTK app. On NixOS, finding those at runtime
isn't automatic. Every GUI binary has to be wrapped in a shell script
that sets environment variables like `GDK_PIXBUF_MODULE_FILE`,
`GTK_PATH`, and `XDG_DATA_DIRS` to the right store paths.

When I launched Coulomb on my NixOS machine, the window opened but the
icons were missing, and the terminal behind it printed:

```
Gdk-CRITICAL **: 14:22:08.521: Cannot load icon 'system-restart-symbolic'
Gdk-CRITICAL **: 14:22:08.522: Cannot load icon 'open-menu-symbolic'
```

The app didn't crash, but the UI was broken. This post walks through
the upstream fix I submitted to NixOS/nixpkgs as
[PR #526664](https://github.com/NixOS/nixpkgs/pull/526664), merged on
2026-06-13.

## Background: what wrapGAppsHook4 does

On a normal Linux distro, GTK apps find their icons because the icons
live in well-known paths like `/usr/share/icons`. NixOS has no global
`/usr/share`. Every package lives under `/nix/store/<hash>-<name>/`,
and an app has to be told at launch which store paths hold its icon
theme, GIO modules, `gdk-pixbuf` loaders, fonts, and translations.

`wrapGAppsHook4` (and its GTK3 sibling, `wrapGAppsHook`) does that
telling. It's a Nixpkgs setup hook that runs during the `fixupPhase` of
the build. It scans the package's `buildInputs`, collects the
environment variables each one needs, and writes a wrapper script next
to the binary. The wrapper looks roughly like this:

```bash
#!/nix/store/...-bash-.../bin/bash
export XDG_DATA_DIRS=/nix/store/...-adwaita-icon-theme/share:/nix/store/...-hicolor-icon-theme/share:$XDG_DATA_DIRS
export GDK_PIXBUF_MODULE_FILE=/nix/store/...-gdk-pixbuf/lib/gdk-pixbuf-2.0/loaders.cache
export GTK_PATH=/nix/store/...-gtk4/lib/gtk-4.0
exec /nix/store/...-coulomb/bin/coulomb "$@"
```

What matters here is timing. The hook writes the wrapper during
`fixupPhase`, because the arguments it needs, such as the icon theme
paths, are only known after `buildInputs` have been resolved and the
hook has scanned them.

## The bug: a wrapper generated too early

The Coulomb derivation had a custom `installPhase` that built its own
wrapper with `makeWrapper`, a Nixpkgs utility for writing shell wrapper
scripts. The code looked like this:

```nix
# pkgs/by-name/co/coulomb/package.nix (simplified, before fix)
{ stdenv, makeWrapper, jre, gtk4, wrapGAppsHook4, libadwaita, ... }:

stdenv.mkDerivation {
  # ...
  nativeBuildInputs = [ makeWrapper wrapGAppsHook4 ];
  buildInputs = [ gtk4 libadwaita ];

  installPhase = ''
    runHook preInstall
    install -Dm755 coulomb.jar $out/share/coulomb/coulomb.jar
    makeWrapper ${jre}/bin/java $out/bin/coulomb \
      --add-flags "-jar $out/share/coulomb/coulomb.jar"
    runHook postInstall
  '';
}
```

The problem is the order. `makeWrapper` runs inside `installPhase`, but
`wrapGAppsHook4` produces its arguments during `fixupPhase`, the phase
right after install. So when `makeWrapper` runs, the GTK environment
variables don't exist yet. The wrapper starts Java fine, but Java can't
find the icons because `XDG_DATA_DIRS` was never set.

There was also a second, related problem. Even with `XDG_DATA_DIRS`
set correctly, Coulomb would still fail to render SVG icons.
`gdk-pixbuf` needs a loader plugin for SVG, that plugin comes from
`librsvg`, and `librsvg` wasn't in `buildInputs`.

## The fix

Two changes, both in `package.nix`:

```nix
# pkgs/by-name/co/coulomb/package.nix (after fix)
{ stdenv, makeWrapper, jre, gtk4, wrapGAppsHook4, libadwaita,
  adwaita-icon-theme, librsvg, ... }:

stdenv.mkDerivation {
  # ...
  nativeBuildInputs = [ makeWrapper wrapGAppsHook4 ];
  buildInputs = [ gtk4 libadwaita adwaita-icon-theme librsvg ];

  postFixup = ''
    makeWrapper ${jre}/bin/java $out/bin/coulomb \
      --add-flags "-jar $out/share/coulomb/coulomb.jar" \
      --prefix XDG_DATA_DIRS : "$XDG_DATA_DIRS" \
      --prefix GDK_PIXBUF_MODULE_FILE : "$GDK_PIXBUF_MODULE_FILE"
  '';
}
```

1. **Move `makeWrapper` from `installPhase` to `postFixup`.**
   `postFixup` runs after `fixupPhase`. By then `wrapGAppsHook4` has
   already populated `$XDG_DATA_DIRS`, `$GDK_PIXBUF_MODULE_FILE`, and
   the rest of the GTK environment, so the wrapper can pass them on to
   Java.

2. **Add `adwaita-icon-theme` and `librsvg` to `buildInputs`.**
   `adwaita-icon-theme` provides the named icons, like
   `system-restart-symbolic`, that Coulomb's UI refers to. `librsvg`
   provides the SVG loader that `gdk-pixbuf` uses to render them. Both
   are needed at runtime, so they go in `buildInputs`, which Nixpkgs
   uses to build the wrapper's environment.

With both changes, Coulomb launches, finds its icons, and renders the
SVGs correctly.

## A note on the name

The PR title uses the word "injection", which sounds like a security
issue. In Nixpkgs it isn't: every wrapper script "injects" environment
variables into the binary it wraps. This bug was not an injection
vulnerability. It was a phase-ordering bug, where the wrapper was
generated before the arguments it was supposed to inject existed.

If I retitled the PR today, I'd call it "coulomb: move wrapper
generation to postFixup and add icon dependencies". It's less catchy
but more accurate.

## Becoming co-maintainer

The PR has a second commit that I almost didn't push. While preparing
the fix, I noticed that Coulomb listed only one maintainer,
[thtrf](https://github.com/thtrf), who had done the original packaging
months earlier. With no backup maintainer, nobody else was responsible
for noticing problems, which is part of why the wrapper bug survived
for weeks.

In Nixpkgs, the maintainer field is more than credit. It's an ongoing
commitment: maintainers get pinged on issues, asked to review
dependent PRs, and notified when their package breaks Hydra, the
Nixpkgs CI. A package without one tends to rot until someone trips
over it.

I was in a good position to help. I had just landed
[PR #531416](https://github.com/NixOS/nixpkgs/pull/531416), which
registered my `githubId` in `maintainers/maintainer-list.nix`, and I
was about to ship a non-trivial fix to a package with a single
maintainer. So I added a second commit:

```nix
# pkgs/by-name/co/coulomb/package.nix
meta = with lib; {
  # ...
  maintainers = with maintainers; [
    thtrf
    _0xSA7  # added
  ];
};
```

By convention in nixpkgs, the underscore-prefixed name (`_0xSA7`)
matches the identifier you registered in `maintainer-list.nix`. Once
the PR merged, I became a co-maintainer of Coulomb. If someone files an
issue against the package, GitHub pings me. If a dependency update
breaks the build, Hydra notifies me. If I want to push a follow-up fix,
I don't have to wait for someone else to review it cold.

This is the part of the contribution I'm proudest of, more than the fix
itself. Someone fixes a bug when they trip over it. A maintainer entry
means someone is responsible for the next one too.

## What I took from it

1. **The Nix phase model has a reason behind it.** `installPhase`,
   `fixupPhase`, and `postFixup` run in that order because setup hooks
   depend on it. `wrapGAppsHook4` writes during `fixupPhase` so it can
   read the resolved `buildInputs`. Calling `makeWrapper` in
   `installPhase` works fine for non-GUI binaries, but for anything
   that needs GTK setup it quietly skips it.

2. **"The app launches" doesn't mean "the app works."** Coulomb had
   been packaged in nixpkgs for weeks. It launched, it drew its window,
   and the build succeeded. The only sign of trouble was a
   `Gdk-CRITICAL` line in a terminal most users never open. The fix was
   small, but the bug had been degrading the experience for everyone
   running Coulomb on NixOS.

3. **Ownership outlasts the fix.** The patch was useful on its own, but
   adding my name to the maintainer field made it durable, because the
   next bug in Coulomb now has someone to land on. A one-off
   contribution helps once. A maintainer entry is a commitment.

The PR took 12 days from open to merge.
[thtrf](https://github.com/thtrf) approved it on 2026-06-13, and
[Aleksanaa](https://github.com/Aleksanaa) merged it the same day. The
final diff is on
[GitHub](https://github.com/NixOS/nixpkgs/pull/526664).