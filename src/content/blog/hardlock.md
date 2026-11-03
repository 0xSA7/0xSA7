---
title: "HardLock: a PUF-rooted secure boot platform specification on the PYNQ-Z2"
description: "A graduation project specification for building a hardware root of trust on the PYNQ-Z2 FPGA board, combining an SRAM physical unclonable function, an immutable Boot ROM, Ed25519 firmware signing, AES-GCM encryption, atomic A/B updates with anti-rollback, and a zeroization-based tamper response."
pubDate: 2026-10-26
tags: ["hardware", "security", "fpga", "cryptography"]
draft: false
readTime: "6 min read"
---

HardLock is my graduation project. It is currently a specification,
not an implementation. Three internal documents govern the
architecture: an academic proposal, a secure boot and firmware
spec, and a runtime flow document. The design below is drawn from
all three. No code has been written to the device yet.

The target platform is the PYNQ-Z2, which pairs a Xilinx Zynq-7000
FPGA with a dual-core ARM Cortex-A9. The plan is to build a
hardware root of trust (HRoT) on it. This post documents the
intended architecture.

## Architecture overview

The PYNQ-Z2 has two halves: the Processing System (PS), which is
the ARM Cortex-A9, and the Programmable Logic (PL), which is the
FPGA fabric. HardLock uses both.

```
+-----------------------------+   +-----------------------------+
|         PS (ARM A9)         |   |        PL (FPGA)            |
|-----------------------------|   |-----------------------------|
| Secure FSBL / Boot ROM      |   | PUF Core (SRAM sampling)   |
| Fuzzy Extractor             |<->| Tamper Monitor (GPIO/PMOD)  |
| Key Derivation (HKDF)       |   | Crypto Accelerators (AES)   |
| Secure Update Manager       |   | AXI Interconnect            |
| Attestation Service         |   +-----------------------------+
+-----------------------------+
              |
              v
+-----------------------------+
|       QSPI Flash            |
|-----------------------------|
| 0x0000  Boot metadata       |
| 0x1000  Bank A (firmware)  |
| 0x80000 Bank B (firmware)  |
| ...     Helper data, audit |
+-----------------------------+
```

The PL is planned to hold the hardware security primitives: the
PUF core that samples SRAM at power-up, the tamper monitor that
watches physical sensors, and crypto accelerators. The PS is
planned to hold the secure firmware: the Boot ROM, the fuzzy
extractor, the key derivation logic, the update manager, and the
attestation service. The two halves would talk over AXI.

Firmware is intended to live in QSPI flash, split into two banks
(A and B) for atomic updates. Helper data for the PUF would live
in a separate secure region.

## The intended boot chain

The boot chain is the core of the design. Every step has to be
verified before the next step runs.

```
Power-on
  |
  v
Boot ROM (immutable, in bitstream)
  |  reads raw PUF bits from SRAM via AXI
  v
Fuzzy Extractor
  |  raw PUF bits + helper data -> K_root (volatile)
  v
HKDF-SHA256
  |  K_root -> K_boot, K_attest, K_update
  v
Read firmware manifest from active bank
  |  manifest = {version, hash, signature, iv, flags}
  v
Anti-rollback check
  |  manifest.version >= stored_version ?
  v
Ed25519 signature verification
  |  verify manifest.signature with vendor_pubkey
  v
AES-128-GCM decryption
  |  decrypt firmware image with K_boot
  v
Integrity check (SHA-256 + GCM tag)
  |
  v
Copy to RAM, jump to entry point
  |
  v
Health window (configurable interval)
  |  if stable: commit stored_version, mark bank active
  |  if unstable: roll back to previous bank
```

The Boot ROM is intended to be kept under 2KB to minimize attack
surface. It would contain only the Ed25519 verifier, the AES-GCM
routine, and the fixed-format header parser. No dynamic
allocation, no complex parsing, no string handling.

K_root is the root key derived from the PUF. It would exist only
in registers during boot. The moment power is cut, K_root is
gone. The only way to recover it would be to power up the device
and read the PUF again.

## PUF and fuzzy extractor

The PUF is planned to be SRAM-based. SRAM cells power up in a
random state, but each cell has a slight manufacturing skew that
biases it toward 0 or 1. The pattern of skews across thousands of
cells is a fingerprint: unique per chip, unclonable, and stable
across power cycles modulo noise.

The fuzzy extractor is planned to handle the noise. Raw PUF bits
go in, along with helper data stored in flash, and a stable
256-bit key comes out. The helper data would be generated during
provisioning and would not leak the key.

```
Raw PUF bits R (noisy)  +  Helper data W (from flash)
              |
              v
         BCH / Reed-Muller decoder
              |
              v
         Stable key K (256-bit)
              |
              v
         HKDF-SHA256 -> K_root
```

The evaluation target is a Bit Error Rate (BER) below 10% after
ECC correction, measured across at least 100 reboots. Inter-device
Hamming distance is also planned to be measured to confirm
uniqueness across chips.

## Key hierarchy

K_root is too valuable to use directly. HKDF-SHA256 is planned to
derive three subkeys with distinct info strings:

```
K_root (volatile, from PUF)
  |
  +-- K_boot    (firmware decryption, AES-GCM)
  +-- K_attest  (remote attestation, HMAC)
  +-- K_update  (signed update verification)
```

Compartmentalization matters. If a glitching attack extracts
K_boot, the attacker can decrypt the firmware image, but cannot
sign attestation reports and cannot push updates. The blast
radius is contained to one subkey.

## A/B updates and anti-rollback

Firmware flash is planned to be split into two banks. Updates
would be atomic:

1. The signed update package is written to the inactive bank
   (e.g., Bank B if Bank A is active).
2. The package signature and version are verified.
3. A "boot-from-update" flag is set.
4. The system reboots. The Boot ROM validates Bank B and boots
   from it.
5. After a configurable health window (the system runs stably
   for N seconds), stored_version is atomically updated and
   Bank B is marked active.
6. If the health window fails, the Boot ROM rolls back to Bank A.

Anti-rollback would be enforced by comparing manifest.version
against stored_version. stored_version is monotonic: an attacker
with a signed older firmware image cannot downgrade the device,
because the Boot ROM rejects versions older than stored_version.

## Tamper response

The PL would have a dedicated Tamper Monitor that watches
physical sensors via GPIO/PMOD pins:

- Case open sensor
- Voltage monitor (out-of-range Vcc)
- Clock monitor (frequency/duty cycle)
- Temperature sensor (freezing attacks)

On detecting tamper, the monitor would raise a high-priority IRQ
to the PS. The secure Tamper Handler would run a Zeroize routine
that immediately wipes K_root and all derived keys from volatile
memory. The system would log the event and enter Lockdown,
requiring physical servicing to recover.

The design choice is confidentiality over availability. A
denial-of-service that triggers zeroization is acceptable. A
successful key extraction is not. You can reboot and re-derive
the key from the PUF. You cannot un-extract a key that an
attacker has read.

## Planned attack testing

The specification includes a methodical attack testing plan:

| Category | Test | Metric |
|----------|------|--------|
| Unsigned firmware | Write unsigned image to SPI; Boot ROM must reject | Pass/fail, time to detect |
| Rollback | Write older signed image; Boot ROM must reject | Pass/fail |
| PUF reliability | Reboot 100+ times, measure BER | Mean, max BER, inter-device HD |
| Timing | Measure crypto operation timings | Secret-dependent leakage |
| Interface | Attempt JTAG/UART access in production | Secret exposure, time to access |
| Side-channel | ChipWhisperer traces during AES/Ed25519 | Traces to key recovery, SNR |
| Fault injection | Voltage/clock glitches on signature check | Bypass probability vs glitch params |

Side-channel and fault injection are optional, dependent on lab
equipment availability. The first four are mandatory.

## Status

The project is planned on a 12-week schedule:

- Weeks 1-2: Setup and PoC (hello-UART, PUF sampling)
- Weeks 3-5: Boot ROM and signature verification
- Weeks 6-7: Fuzzy extractor, KEK derivation, PUF characterization
- Weeks 8-9: A/B update mechanism, anti-rollback, signing pipeline
- Weeks 10-11: Attack experiments
- Week 12: Final report, demo video, delivery

Planned deliverables include HDL sources, synthesized bitstreams,
Boot ROM source, firmware images, signing scripts, test scripts,
raw experimental data, and a final thesis.

The flow document notes that the design is not final and is
subject to modification during implementation. This post reflects
the current architecture as of the latest internal review. Nothing
has been implemented yet.

## What I took from it

Three things have stayed with me so far, from the design phase.

First, the PUF reframes what a key is. A stored key is data. A
PUF key is a measurement of the physical world, taken at the
moment you need it and discarded the moment you do not. The
security property comes from physics, not from secrecy.

Second, the A/B update pattern with a health window is the
correct way to do firmware updates on embedded devices. Atomic
switching plus rollback means a bad update bricks nothing. The
health window is the difference between "we shipped a bug" and
"we shipped a brick."

Third, hardware security inverts the availability trade-off. In
software, you usually want graceful degradation. In hardware
root of trust, zeroization is the right answer to tamper. The
asymmetry favors burning everything, because you can reboot and
re-derive the key, but you cannot un-extract a leaked one.

The project is currently specification-only. When implementation
begins and the attack tests are run, I will write a follow-up
post on what actually worked and what did not.