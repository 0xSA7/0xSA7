---
title: "Building a DRAM controller in Verilog: from spaghetti to page-hit optimization"
description: "How a semester-7 Computer Architecture course project evolved from a single-file spaghetti module into a modular SDRAM controller with bank addressing and a 57 percent sequential-access speedup in simulation."
pubDate: 2025-12-09 
tags: ["verilog", "hardware", "computer-architecture", "fpga"]
draft: false
readTime: "7 min read"
repo: "https://github.com/0xSA7/dram-controller"
---

In semester 7 of my Systems and Computer Engineering program at
Al-Azhar, the Computer Architecture course required us to implement
a DRAM controller. The repo is at
[github.com/0xSA7/dram-controller](https://github.com/0xSA7/dram-controller).
This post covers how the project went from a single-file spaghetti
module to a modular SDRAM controller with bank addressing and
page-hit optimization in v3.0.0.

This is a simulation-only project. I never ran it on real FPGA
hardware. Everything was tested with Icarus Verilog and inspected with
GTKWave. That's enough to check protocol logic and measure latency in
cycles, but not signal integrity, setup-and-hold violations, or
anything analog. I'd rather say that up front.

## Background: why DRAM is slow

DRAM isn't a flat array. A 32MB SDRAM chip is organized into banks,
rows, and columns. The chip I modeled has 4 banks, 8192 rows per bank,
and 512 columns per row, with a 16-bit data bus. A 24-bit CPU address
decomposes as:

```
[23:22] bank    (2 bits, 4 banks)
[21:9]  row     (13 bits, 8192 rows)
[8:0]   column  (9 bits, 512 columns)
```

Reading a word takes more than one operation. The controller has to
drive the chip through a sequence:

1. **ACTIVATE** the row (opens the row, latches row address).
2. Wait `tRCD` cycles (RAS-to-CAS delay, typically 2 cycles).
3. Issue a **READ** or **WRITE** with the column address.
4. Wait `tCAS` cycles (CAS latency, typically 3 cycles).
5. For reads, capture data on the bus.
6. **PRECHARGE** the row (deactivates the row, prepares for next).
7. Wait `tRP` cycles (precharge time, typically 2 cycles).

In my model that adds up to a 7-cycle floor per access. The exact
timings depend on the chip and the clock, and I used typical values.

## The naive controller (v1)

The first version was a single file called `spaghetti_sdram_controller.v`.
The name wasn't ironic. The file held the state machine, command
generator, timing counter, address decoder, and refresh logic, all in
one `always` block. It worked, it simulated, and it passed the basic
tests. It was also unreadable, and a change to one concern broke three
others.

The state machine itself was the standard one:

```
IDLE → ACTIVATE → RCD_WAIT → READ_CAS → READ_WAIT → READ_DATA → PRECHARGE → IDLE
```

Every CPU request ran the full sequence. Even when the next request
hit the same row as the previous one, the controller closed the row
and reopened it. That's the textbook FSM: correct, and wasteful.

The repo still keeps the spaghetti file at the root for the record.
Refactoring it became v2.

## The page hit optimization (v3)

The v2 refactor split the single file into six focused modules:

```
rtl/
├── dram_controller_top.v          ← integration + CPU interface
├── core/
│   ├── dram_fsm.v                  ← state machine (this is where the work is)
│   ├── dram_command_generator.v    ← SDRAM signal generation
│   └── refresh_controller.v        ← periodic refresh
└── utils/
    ├── address_decoder.v          ← bank/row/column decomposition
    ├── timing_generator.v         ← countdown logic
    └── dram_pkg.vh                 ← shared parameters
```

The v3 enhancement, merged in
[PR #1](https://github.com/0xSA7/dram-controller/pull/1), adds four
new registers inside the FSM:

```verilog
reg row_open;            // 1 = a row is currently open in a bank
reg [1:0] active_bank;   // which bank has the open row
reg [12:0] active_row;   // which row is currently open
reg miss_req;            // 1 = precharging due to page miss
```

The idea is that the controller remembers which row it just opened. If
the next CPU request hits the same bank and row, it skips the ACTIVATE
and the tRCD wait and goes straight to READ_CAS or WRITE_CAS.

This is the open page policy, which real DRAM controllers use. The
trade-off is that rows stay open between accesses, so you pay the
ACTIVATE cost only on the first access to a row, and sequential
accesses to the same row get much cheaper.

## The FSM diff

The interesting part is the `STATE_IDLE` next-state logic. In v2,
every request ran the full sequence:

```
IDLE → ACTIVATE → RCD_WAIT → READ/WRITE → PRECHARGE → IDLE
(7+ cycles for every access)
```

v3 branches into three scenarios. Here is the full `STATE_IDLE` case
from `dram_fsm.v`:

```verilog
STATE_IDLE: begin
  // Priority 1: Refresh (must close open row first)
  if (refresh_pending) begin
    if (row_open) next_state = STATE_PRECHARGE;
    else          next_state = STATE_REFRESH;
  end
  // Priority 2: CPU Read/Write requests
  else if (cpu_read_req || cpu_write_req) begin
    // Scenario A: Page Hit (same bank and row already open)
    if (row_open
        && (req_bank_addr == active_bank)
        && (req_row_addr  == active_row)) begin
      // Skip ACTIVATE, go directly to read/write
      if (cpu_read_req)  next_state = STATE_READ_CAS;
      else               next_state = STATE_WRITE_CAS;
    end
    // Scenario B: Page Miss (different row or bank open)
    else if (row_open) begin
      next_state = STATE_PRECHARGE;  // close old row first
    end
    // Scenario C: Cold Start (no row open)
    else begin
      next_state = STATE_ACTIVATE;
    end
  end
end
```

- **Priority.** A pending refresh beats a CPU request. If a row is
  open, the controller has to precharge before refreshing, because
  SDRAM refresh needs all rows closed.
- **Page hit.** Scenario A skips `STATE_ACTIVATE` and
  `STATE_RCD_WAIT`, which saves 3 cycles per hit. Over a sequential
  access pattern that adds up.
- **Page miss.** Scenario B costs 1 extra cycle compared to v2,
  because the old row has to be precharged before the new one is
  activated. The controller accepts that, since the next access to the
  new row will likely be a hit.

The other transitions stay mostly the same. The key change is in
`STATE_READ_DATA` and `STATE_WRITE_DATA`:

```verilog
STATE_READ_DATA: begin
  // Return to IDLE, keep row open for potential page hit
  next_state = STATE_IDLE;
end
```

In v2 this went to `STATE_PRECHARGE`. In v3 it goes back to
`STATE_IDLE` with `row_open` still high. That's the whole mechanism:
keep rows open, remember which one, skip ACTIVATE next time.

## Testbench and results

The testbench in `tb/dram_controller_tb.v` covers seven scenarios:
reset, single write/read, page hit, page miss, multi-bank, refresh
during open row, and data integrity. The page hit test is the one that
shows the optimization working.

A trimmed excerpt from the actual simulation log:

```
[150] TEST #5: Write - Addr=0x010000, Data=0xAAAA
[220] Write complete
[230] TEST #6: Write - Addr=0x010001, Data=0xBBBB (PAGE HIT!)
[270] Write complete  (40ns instead of 70ns!)
```

The first write takes 70 ns end to end (ACTIVATE through PRECHARGE).
The second write, to the same row, takes 40 ns. The 30 ns difference
is the ACTIVATE plus `tRCD` that the controller skipped.

Across the full benchmark set, the numbers are close to what the
analysis predicted:

| Access pattern    | v2 latency | v3 latency | Speedup |
|-------------------|------------|------------|---------|
| Sequential        | 7 cyc      | 3 to 4 cyc | ~57%    |
| Block 256B        | 896 cyc    | 391 cyc    | ~56%    |
| Random            | 7 cyc      | 4.5 cyc    | ~36%    |
| Mixed workload    | 7 cyc avg  | 4.5 cyc avg| ~36%    |

Random and mixed workloads gain less than sequential ones, because
many of their accesses are page misses and pay the extra precharge
cycle. Real workloads sit somewhere between random and sequential, so
I'd expect typical gains between those two rows, though I haven't
measured a real workload.

## What I took from it

1. **The textbook FSM is a starting point.** It teaches the protocol
   and its timing floor. Real controllers spend their effort on the
   gap between that floor and what workloads actually need, and
   page-hit tracking is one standard way to close it.

2. **The refactor had to come first.** v2 wasn't faster than v1, but
   it made v3 possible. If I had tried to add page-hit tracking to the
   single-file v1, I would have broken the timing counter within an
   hour.

3. **Simulation is honest about timing and silent about everything
   else.** The testbench showed that a page hit saves 3 cycles. It
   showed nothing about setup-and-hold violations, power supply noise,
   or a PCB trace that runs 2 cm longer than it should. The next step,
   which I haven't taken, is putting this on a real FPGA with a real
   SDRAM chip and seeing what breaks.

The repo is on [GitHub](https://github.com/0xSA7/dram-controller). The
ENHANCEMENTS.md file in the root has the full v3 design notes and the
state-by-state transition table I worked from.