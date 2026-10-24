---
title: "Unifying VM resource minima in Canonical Multipass"
description: "How a small change to multipass's CLI and daemon stopped silent OOM crashes during cloud-init, and what code review taught me about contributing upstream."
pubDate: 2026-07-28
tags: ["open-source", "multipass", "canonical", "virtualization"]
draft: false
readTime: "5 min read"
pr: "https://github.com/canonical/multipass/pull/5057"
---

I run multipass on my homelab for quick Ubuntu VMs. One afternoon I
launched a small instance for a kernel build, walked away, and came back
twenty minutes later to find the CLI still stuck on `Waiting for SSH to
come up`. The VM had died during `cloud-init` without a word. This post
covers the upstream fix I submitted to Canonical's multipass:
[PR #5057](https://github.com/canonical/multipass/pull/5057), merged on
2026-07-28.

## Background: what multipass checks, and where

Multipass is Canonical's CLI for launching Ubuntu VMs on Linux, macOS,
and Windows. When you run `multipass launch`, three components handle
your request before the VM exists:

1. **CLI:** parses `--mem` and `--disk`, checks them against its own
   minimums, and sends a gRPC payload to the daemon.
2. **Daemon:** receives the payload, runs its own validation, and starts
   the VM through the chosen backend (qemu, lxd, virtualbox, etc.).
3. **GUI:** a separate frontend with its own validation logic, for
   people who prefer the desktop app.

The bug was that these three disagreed on what "minimum" meant:

| Component | Min memory | Min disk |
|-----------|------------|----------|
| CLI       | 128M       | 512M     |
| Daemon    | 128M       | 512M     |
| GUI       | 512M       | 1G       |

The GUI had it right. The CLI and daemon were stuck on old values that
no longer reflect what an Ubuntu Server image needs to finish
`cloud-init` reliably.

## The bug: silent OOM, indefinite hang

Ubuntu cloud images run `cloud-init` on first boot to inject SSH keys,
update packages, and run user-data scripts. It's memory-hungry: it loads
Python, processes YAML, and writes to disk.

With 128M of RAM, the kernel's OOM killer reaps `cloud-init` mid-run.
The instance never publishes its SSH host key. The daemon polls for SSH
in a loop, never gets a connection, and the CLI just sits there:

```bash
$ multipass launch --mem 128M --disk 512M noble
Launched: polite-rodent
<... hangs indefinitely ...>
```

No error, and no log line an end user would see.

The user-facing issue was tracked as
[#3777](https://github.com/canonical/multipass/issues/3777) and
[#3612](https://github.com/canonical/multipass/issues/3612). The root
cause: the GUI minimums had been raised years earlier, but the C++
constants in `include/multipass/constants.h` never followed.

## The fix

Two constants in one file:

```cpp
// include/multipass/constants.h
namespace multipass {
constexpr auto min_memory_size = "512M";  // was "128M"
constexpr auto min_disk_size  = "1G";    // was "512M"
}
```

That alone closes the gap between the CLI, daemon, and GUI, since all
three read from the same header file. The CLI's input validation now
rejects a bad request before it reaches the gRPC layer:

```cpp
// Simplified; the actual check is in cli/launch.cpp
if (mem < min_memory_size) {
    return fmt::format("Memory '{}' is below the minimum of '{}'",
                       mem, min_memory_size);
}
```

The user gets a clear error instead of a hang:

```bash
$ multipass launch --mem 128M --disk 512M noble
launch failed: Memory '128M' is below the minimum of '512M'
```

That's the whole fix. The constants change is four lines, and the tests
are most of the rest.

## The part that took longer: the tests

The tests were the real work. `tests/unit/test_instance_settings_handler.cpp`
and `tests/unit/test_daemon.cpp` were parameterized with values sitting
right on the old boundaries, `128M` and `512M`, to check that the
minimum is respected. Once the minimums went up, those tests had to move
too.

Reviewer feedback shaped the final patch here.
[tobe2098](https://github.com/tobe2098) asked me to split the
parameterized cases so memory and disk boundaries are tested
independently instead of as a pair. With a case like
`(--mem 128M, --disk 512M)`, a failure on memory could hide whether the
disk boundary was correct.

[ricab](https://github.com/ricab) caught something subtler: some of my
replacement values landed exactly on the new minimum. That makes a test
fragile, because it can pass for two different reasons (the validator
accepts the boundary, or it accepts anything above it) and you can't
tell which one broke. The fix was to use values strictly above the
minimum for the "should succeed" cases, values strictly below for the
"should reject" cases, and separate boundary-equality tests.

The review also raised a bigger question: why have a static minimum at
all? Ubuntu Core images need different amounts of memory than Ubuntu
Server images, so a static floor will drift again eventually. I noted in
the PR that validation based on the image manifest should be a
follow-up. This PR was scoped to unify the existing baseline, not to
redesign validation.

## What I took from it

1. **The diff is rarely the work.** The constants patch was 4 lines, the
   test refactor was 60, and the discussion thread was longer than both
   combined. Most of an upstream contribution is agreeing with
   maintainers on the right minimal change, not writing code.

2. **One source of truth.** The bug existed because the same minimum
   lived in three places. Patching one place doesn't fix it; fixing the
   source of truth does.

3. **A test value on a boundary is a latent bug.** ricab's review showed
   me that such a test checks two properties at once, so a future change
   to either one can mask the other.

The PR took 18 days from open to merge, mostly reviewer turnaround and
me reworking the test cases. The final diff is on
[GitHub](https://github.com/canonical/multipass/pull/5057). You can read
it in five minutes, but please don't judge the contribution by the line
count.