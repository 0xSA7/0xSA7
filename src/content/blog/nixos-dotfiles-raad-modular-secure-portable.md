---
title: "My NixOS dotfiles: modular config, secure boot, and a portable home-manager"
description: "How I structure my NixOS dotfiles for the laptop raad: dual-channel flakes, lanzaboote secure boot, kernel hardening, and a home-manager setup I reuse on Ubuntu."
pubDate: 2026-07-26
tags: ["nixos", "dotfiles", "security", "linux"]
draft: false
readTime: "10 min read"
repo: "https://github.com/0xSA7/dotfiles"
---

My laptop is called `raad` (رعد in Arabic). It runs NixOS, configured
through a single flake at
[github.com/0xSA7/dotfiles](https://github.com/0xSA7/dotfiles). This
post covers how that flake is structured, why I picked NixOS in the
first place, and a small trick that lets me reuse the same modules on
Ubuntu when I need to test snapcraft builds.

I chose NixOS for three reasons: declarative configuration,
reproducibility, and rollback. Once the system is described in Nix, I
can rebuild it from a fresh install with one command. If an upgrade
breaks something, I reboot into the previous generation from the boot
menu and the system is exactly as it was. I'm a security engineer who
tweaks kernel params, secure boot, and systemd services on a weekly
basis, and I wouldn't work without that safety net.

## The flake architecture

The whole system is defined in `flake.nix`:

```nix
{
  description = "Raad System Flake";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    unstable.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager/release-26.05";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    lanzaboote = {
      url = "github:nix-community/lanzaboote";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
  outputs = { self, nixpkgs, home-manager, unstable, lanzaboote, ... }@inputs:
  let
    system = "x86_64-linux";
    unstablePkgs = import unstable {
      inherit system;
      config.allowUnfree = true;
      config.android_sdk.accept_license = true;
    };
  in {
    nixosConfigurations = {
      raad = nixpkgs.lib.nixosSystem {
        inherit system;
        specialArgs = { inherit unstablePkgs; };
        modules = [
          ./hosts/raad/configuration.nix
          lanzaboote.nixosModules.lanzaboote
          home-manager.nixosModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.extraSpecialArgs = { inherit unstablePkgs; };
            home-manager.users.sa7 = import ./modules/home.nix;
          }
        ];
      };
    };
  };
}
```

**Dual-channel inputs.** The system tracks `nixos-26.05` (stable) by
default, with `nixos-unstable` as a secondary input. `unstablePkgs` is
built in the `let` binding and passed through `specialArgs`, so any
module can take a package from unstable by writing `unstablePkgs.foo`
instead of `pkgs.foo`. That lets me run a bleeding-edge version of one
tool without moving the rest of the system to unstable.

**`inputs.nixpkgs.follows = "nixpkgs"`** on each dependent flake
(home-manager, lanzaboote). Without it, each one pulls its own copy of
nixpkgs and the closure grows by hundreds of megabytes. `follows` pins
them all to the same nixpkgs revision, which keeps the store smaller
and evaluation faster.

## The modules/hosts split

The repo has two top-level directories:

```
dotfiles/
├── flake.nix
├── hosts/
│   └── raad/
│       ├── configuration.nix
│       └── hardware-configuration.nix
└── modules/
    ├── core.nix
    ├── home.nix
    ├── security.nix
    ├── gnome.nix
    ├── hyperland.nix     # experimental
    ├── kitty.nix
    ├── neovim.nix
    ├── tmux.nix
    ├── zsh.nix
    ├── virtualization.nix
    └── nvim/             # Lua config
```

`hosts/raad/` holds the host-specific parts: hostname, NVIDIA bus IDs,
secure boot paths, and the hardware scan. Everything else lives under
`modules/`. The host imports the modules it needs and adds its own
settings on top:

```nix
# hosts/raad/configuration.nix
{ config, pkgs, lib, ... }:
{
  imports = [
    ./hardware-configuration.nix
    ../../modules/core.nix
    ../../modules/virtualization.nix
  ];
  networking.hostName = "raad";
  # host-specific boot, NVIDIA, secure boot config follows
}
```

Nothing in `modules/` refers to `raad` by name, so a second host would
just need a new folder under `hosts/` that imports the modules it wants
and overrides the host-specific values. I haven't added a second host
yet, but the split keeps the cost of doing so low.

## Security: kernel hardening and secure boot

`modules/security.nix` is the part tied most closely to my work. It
sets the kernel parameters I want on any machine I do security work on:

```nix
{ config, pkgs, ... }:
{
  boot.kernelParams = [
    "slab_nomerge"
    "slub_debug=FZ"
    "page_alloc.shuffle=1"
    "vsyscall=none"
  ];
  security.protectKernelImage = true;
  security.forcePageTableIsolation = true;
}
```

What each parameter does:

- `slab_nomerge` keeps slab caches separate, which makes heap spraying
  harder and exploitation less reliable.
- `slub_debug=FZ` turns on slab sanity checks (`F`) and red zoning
  (`Z`), which catch more heap corruption at runtime.
- `page_alloc.shuffle=1` randomizes the page allocator's free lists,
  which makes the physical page layout harder to predict.
- `vsyscall=none` disables the legacy vsyscall page, which has long
  been a source of ROP gadgets.

The host also enables
[lanzaboote](https://github.com/nix-community/lanzaboote) for
[UEFI Secure Boot](https://learn.microsoft.com/windows-hardware/design/device-experiences/oem-secure-boot).
Lanzaboote signs Unified Kernel Images (UKIs) with a key enrolled in
the firmware, so the boot chain can be verified from the firmware
through to the kernel command line:

```nix
boot.loader.grub.enable = lib.mkForce false;
boot.loader.systemd-boot.enable = lib.mkForce false;
boot.lanzaboote = {
  enable = true;
  pkiBundle = "/etc/secureboot";
};
```

The `mkForce false` on the legacy bootloaders is needed because a
default NixOS install pulls in `systemd-boot`, and lanzaboote has to
replace it, not run beside it.

The same file has a template for a sandboxed systemd service, which I
copy whenever I need to run something in a strict sandbox:

```nix
systemd.services.isolated-vault = {
  description = "Example Sandboxed Service";
  wantedBy = [ "multi-user.target" ];
  serviceConfig = {
    ExecStart = "${pkgs.coreutils}/bin/sleep infinity";
    ProtectSystem = "strict";
    ProtectHome = true;
    PrivateTmp = true;
    NoNewPrivileges = true;
    PrivateDevices = true;
    MemoryDenyWriteExecute = true;
    RestrictRealtime = true;
  };
};
```

`MemoryDenyWriteExecute = true` is the setting people forget most
often. It blocks memory mappings that are both writable and executable,
which makes JIT spray and shellcode injection into JIT regions much
harder. Anything that needs runtime code generation, such as V8 or the
JVM, will usually refuse to start under it. That's what I want when
running untrusted code.

## Hardware: NVIDIA Optimus

`raad` has Intel integrated graphics and an NVIDIA dGPU, and I run them
in sync mode:

```nix
hardware.nvidia = {
  prime = {
    sync.enable = true;
    intelBusId = "PCI:0:2:0";
    nvidiaBusId = "PCI:1:0:0";
  };
  modesetting.enable = true;
  powerManagement.enable = true;
  open = false;
  nvidiaSettings = true;
};
```

I picked `sync.enable = true` over PRIME offload for two reasons. Sync
mode is more predictable: every window renders on the dGPU, so I don't
have to remember to mark apps as NVIDIA-rendered. And the open-source
NVIDIA driver (`open = true`) doesn't support my GPU generation yet, so
I'm on the proprietary driver for now, where PRIME offload has
historically been flakier.

The kernel params in `hosts/raad/configuration.nix` are tuned for this
setup:

```nix
boot.kernelParams = [
  "nvidia-drm.modeset=1"
  "nvidia.NVreg_PreserveVideoMemoryAllocations=1"
  "nvidia.NVreg_TemporaryFilePath=/var/temp"
  "nvme_core.default_ps_max_latency_us=0"
  "pcie_aspm=off"
];
```

`NVreg_PreserveVideoMemoryAllocations=1` is needed to get through
suspend and resume without the GPU falling off the bus. The NVMe and
ASPM params turn off power-saving states. I copied them from a Phoronix
article a year ago and haven't revisited them since.

## The portable home-manager trick

I also do security work on Ubuntu VMs, mostly because snapcraft builds
aren't supported on NixOS. I still want the same shell, terminal,
editor, and multiplexer as on `raad`, so I added
`modules/ubuntu-dev-home.nix`:

```nix
{ config, pkgs, unstablePkgs, lib, ... }:
{
  imports = [
    ./kitty.nix
    ./neovim.nix
    ./tmux.nix
    ./zsh.nix
  ];

  home.packages = with pkgs; [
    git
    fzf
    ripgrep
    imagemagick
    ueberzugpp
  ];

  programs.home-manager.enable = true;
}
```

It imports the same `kitty.nix`, `neovim.nix`, `tmux.nix`, and
`zsh.nix` that `raad` uses. On Ubuntu I install home-manager in
standalone mode, point it at this module, and run
`home-manager switch`. My kitty config, neovim keybindings, zsh
aliases, and tmux setup arrive exactly as they are on `raad`.

This works because none of those four modules refers to anything
NixOS-specific. They're plain home-manager modules, so they behave the
same whether a NixOS module pulls them in (on `raad`) or standalone
home-manager does (on Ubuntu).

There's a trade-off. On Ubuntu I don't get the kernel hardening, the
secure boot chain, or the systemd sandboxing, because those need
system-level configuration and Nix doesn't manage the system there. The
portable modules cover the user-level dev environment only. For
anything that touches `/etc`, I'm back on apt and `systemctl edit`.

## Auto-commits

The repo has an auto-commit entry dated 2026-06-27, pushed by a small
shell utility I wrote called
[auto-git](https://github.com/0xSA7/auto-git).It stages and commits dotfiles on a schedule so I do not lose changes
between real commits. I have written about it separately, but the
short version is: every dotfiles repo should have one, because the
alternative is finding out three weeks later that the alias you added
never made it to git.

## What I took from it

1. **The value of NixOS is rollback.** Declarative config is nice, but
   you need it most when an upgrade breaks secure boot at 2 AM. The
   boot menu still lists the previous generation, and that has saved me
   twice.

2. **The modules/hosts split pays off even with one host.** It lets me
   test changes on a VM with a stripped-down config without touching
   the real host.

3. **System config and user config are separate problems.** NixOS is
   the right tool for the first. Standalone home-manager is a good
   answer to the second, even on non-NixOS machines. Splitting them
   lets each tool do what it's good at.

The repo is on [GitHub](https://github.com/0xSA7/dotfiles). The history
is small enough to read in one sitting.