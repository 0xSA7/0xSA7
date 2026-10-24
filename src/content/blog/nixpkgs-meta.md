---
title: "On contributing to NixOS/nixpkgs: six PRs and what I learned from each"
description: "A meta-post on contributing to nixpkgs as a first-time maintainer, walking through six pull requests I submitted in June 2026, the OfBorg CI loop, reviewer culture, and what each PR taught me about the project."
pubDate: 2026-10-25
tags: ["open-source", "nixos", "nixpkgs", "meta"]
draft: false
readTime: "7 min read"
---

This is a meta-post. The previous posts on this blog walked through
individual contributions in detail: the
[Coulomb wrapper fix](/0xSA7/blog/nixpkgs-coulomb-wrapper/),
the [Multipass resource minima](/0xSA7/blog/multipass-vm-minima/),
and the [dotfiles setup](/0xSA7/blog/dotfiles-raad/).
This one steps back and looks at the contribution process itself.

In June 2026 I opened six pull requests against
[NixOS/nixpkgs](https://github.com/NixOS/nixpkgs), and all six merged.
This is what I wish I had read before opening the first one.

## The six PRs at a glance

| PR      | Title                                                       | Date       |
|---------|-------------------------------------------------------------|------------|
| 526664  | coulomb: fix wrapper injection and missing GUI icons        | 2026-06-01 |
| 529044  | mononoki: refactor to use installFonts hook and finalAttrs  | 2026-06-07 |
| 529059  | hermit: refactor to use installFonts hook and finalAttrs    | 2026-06-07 |
| 529112  | wordlists: set pname and version                            | 2026-06-07 |
| 529127  | nixos-firewall-tool: set pname and version                  | 2026-06-07 |
| 531416  | maintainers: update 0xSA7 githubId                          | 2026-06-13 |

The Coulomb PR came first, and it was the only one that needed real
debugging. The four PRs on June 7 were the same kind of cleanup applied
to four different packages. The June 13 PR was a one-line correction to
the maintainer entry I had added in the Coulomb PR.

I'll go through them one by one.

## PR 526664: Coulomb, the actual fix

I wrote a [full technical post](/0xSA7/blog/nixpkgs-coulomb-wrapper/)
about this one. Coulomb, a GTK4 circuit simulator, launched but its
icons were missing. The root cause was a phase-ordering bug:
`makeWrapper` ran in `installPhase`, before `wrapGAppsHook4` had
populated the GTK environment variables in `fixupPhase`. The fix was to
move the wrapper generation to `postFixup` and add
`adwaita-icon-theme` and `librsvg` to `buildInputs`.

This PR also made me a co-maintainer of the package, which the
dedicated post covers. It touched two files: the Coulomb derivation and
`maintainers/maintainer-list.nix`, where I added my own maintainer
entry in the same PR. That becomes relevant in the last PR below. It
took 12 days from open to merge, partly because the reviewers
([thtrf](https://github.com/thtrf) and
[Aleksanaa](https://github.com/Aleksanaa)) had to verify that the phase
reordering was correct. A PR that changes behavior gets reviewed more
carefully than one that mechanically applies a known pattern.

## PR 529044 and 529059: the font package refactors

These two PRs were opened the same day and have the same shape.

[mononoki](https://github.com/NixOS/nixpkgs/pull/529044) and
[hermit](https://github.com/NixOS/nixpkgs/pull/529059) are both font
packages. The nixpkgs tree has been migrating font packages from a
hand-rolled `installFont` invocation to the newer `installFonts` setup
hook, and from the old `rec` pattern to `finalAttrs`. Once you've done
one, the other is mechanical.

I opened both in the same afternoon because the second was the first
with the package name changed. The first PR in a series is where the
understanding happens, and the rest are close to copy-paste. My guess
is that reviewers move faster on the later ones because they can
compare against the first, but I haven't measured that.

## PR 529112 and 529127: setting pname and version

[wordlists](https://github.com/NixOS/nixpkgs/pull/529112) and
[nixos-firewall-tool](https://github.com/NixOS/nixpkgs/pull/529127)
were written before the `pname` and `version` conventions were
standardized. They worked, but each derivation's name was encoded in a
single `name` string instead of being split into `pname` (the package
name) and `version`, which makes the derivation harder to consume
programmatically.

The fix was a small change in each derivation (simplified here):

```nix
# Before
mkDerivation rec {
  name = "wordlists-2024-04-15";
  # ...
}

# After
mkDerivation (finalAttrs: {
  pname = "wordlists";
  version = "2024-04-15";
  # ...
})
```

The diff is small, but it touches how the package is identified, which
can matter to anyone or any tool that reads a package's name, such as
`nix-env -q` or `nix search`. Reviewers tend to look harder at that than
at a font refactor, because more people are affected. A small diff
isn't necessarily a small PR: what counts is the size of the change
multiplied by the number of users it reaches.

## PR 531416: correcting the maintainer entry

The last PR was
[maintainers: update 0xSA7 githubId](https://github.com/NixOS/nixpkgs/pull/531416),
and it was a follow-up fix. In the Coulomb PR I had added my maintainer
entry to `maintainers/maintainer-list.nix` along with the fix. The
entry included a `githubId`, which I had looked up through the GitHub
API, and I got it wrong.

The correction was one line: my actual `githubId` is `109046494`. It
had to be a separate PR because the Coulomb PR was already queued for
merge.

```nix
_0xSA7 = {
  name = "Saleh Diaa Ahmed";
  github = "0xSA7";
  githubId = 109046494;  # corrected
  email = "salehdiaaahmed@gmail.com";
};
```

Look up your `githubId` carefully, ideally before the first PR that
needs it. It takes one command:

```bash
curl -s https://api.github.com/users/0xSA7 | jq .id
```

## The OfBorg loop

Every PR to nixpkgs is checked by
[OfBorg](https://github.com/NixOS/ofborg), a CI bot that builds your
change on the platforms requested by the PR's labels (typically
`x86_64-linux`, plus `aarch64-linux` or `x86_64-darwin` when relevant).
It comments on the PR with the result and pings you if a platform
fails.

OfBorg is often the slowest part of the process. Evaluating a single
package can take tens of minutes, depending on how many dependencies
need rebuilding. For the Coulomb PR it was slow because `gtk4` and its
dependency tree were involved.

It's also what stops platform-specific breakage from reaching the tree.
When a build fails on aarch64-linux for a reason you hadn't thought
about, that's a real bug, and the PR shouldn't merge until it's fixed
or scoped out.

## The reviewer culture

nixpkgs reviewers are volunteers with limited time. A few habits made
my PRs easier for them. Two of the examples below come from my
Multipass PR, but the lessons carry over.

**Link related work.** If your PR supersedes another, say so. If it
follows up on an issue, link the issue. If it came out of a discussion
on the Matrix channel, link the message. Reviewers don't have your
context.

**Scope the PR.** I scoped the Multipass change to unifying the
existing baseline instead of redesigning validation. When reviewers
asked about validation based on the image manifest, I noted it as a
follow-up instead of growing the PR. A scoped PR is easier to review
than one that keeps expanding.

**Take feedback well.** On the same PR, ricab asked me to change test
values that sat exactly on the new minimum. My first instinct was to
defend the original values, but they were right, so I thanked them and
made the change.

## What I'd tell someone starting today

Pick a package you actually use, find a small issue in it, and fix it.
Don't start by refactoring a core module or adding a new package. If
you use the package, you'll notice when it breaks in six months, which
is when maintainers are needed.

Register your maintainer entry before you open a PR that lists you in a
package's `meta.maintainers`, and double-check the `githubId`. In the
Coulomb PR I added myself in the same diff as the fix, so the entry had
to land for the PR to be self-consistent. It worked out, but my id was
wrong, and a separate follow-up PR was the price.

Read the OfBorg output, not just the green checkmark. When a build
fails on aarch64-linux, the log usually says why. Often it's a missing
`stdenv.hostPlatform.isAarch64` check, and the fix is one line.

Keep your PRs small. The Coulomb PR was around 20 added lines, the
four cleanup PRs were similar, and the maintainer correction was a
single line. None of mine were large, which almost certainly helped
them merge. Bundling the four cleanups into one PR would have made
review harder, though I can't say for certain how it would have gone.

## Looking back

In one month: one real fix that also landed my maintainer entry, four
mechanical refactors, and one follow-up for a wrong `githubId`. Twelve
days of review on the real fix, faster turnaround on the rest. The
contributing guide is short, so read it before you start.

The repo is [nixpkgs itself](https://github.com/NixOS/nixpkgs), and
the PRs are linked above.
