---
title: "Queuepy: simulating M/M/c/K queuing systems in Python"
description: "A semester-6 Queuing Theory course project that implements both closed-form solutions and event-driven simulation for M/M/1, M/M/1/K, M/M/c, and M/M/c/K models, with a Tkinter GUI and a validation check that compares the two approaches against each other."
pubDate: 2025-02-08
tags: ["python", "queuing-theory", "simulation", "academic"]
draft: false
readTime: "7 min read"
repo: "https://github.com/0xSA7/Queuepy"
---

In semester 6 of my Systems and Computer Engineering program, the
Queuing Theory course required us to build a queuing models simulator
in Python. The repo is at
[github.com/0xSA7/Queuepy](https://github.com/0xSA7/Queuepy). This post
covers the design: what the four models do, why there are two ways to
compute the same answer, and how we used one to check the other.

This was team work. Mohamed Gomaa and Omar Mohamed implemented the core
model classes and the simulation engine. I handled the architecture,
the split between analytical and simulated results, the CLI, the
documentation, and the merge into v0.1. Abdelrahman Hany wrote the
Tkinter GUI. I brought him in for that piece, and the GUI is his work,
not mine.

## Background: Kendall notation

Queuing models use Kendall's notation, `A/S/c/K`, where each letter
describes one aspect of the system.

- **A** is the arrival process. `M` means Markovian: Poisson arrivals
  with exponentially distributed interarrival times.
- **S** is the service time distribution. `M` again means exponential.
- **c** is the number of parallel servers.
- **K** is the system capacity. Leaving it out means infinity.

Queuepy implements four combinations:

| Model    | Servers | Capacity | Real-world analogue                    |
|----------|---------|----------|-----------------------------------------|
| M/M/1    | 1       | ∞        | Single teller at a small bank           |
| M/M/1/K  | 1       | K        | Router with bounded buffer              |
| M/M/c    | c       | ∞        | Multi-teller bank                       |
| M/M/c/K  | c       | K        | Data center with finite request buffer  |

Each model computes the same performance measures: `L` (average
customers in the system), `Lq` (average customers in the queue), `W`
(average time in the system), `Wq` (average time in the queue), `Ru`
(server utilization), and `Pk` (probability of k customers in the
system). The formulas differ from model to model, but the outputs have
the same shape.

## The analytical layer

`models.py` holds the closed-form solutions. Each model is a class that
inherits from a small abstract base:

```python
# parameter.py
from math import inf

class Params:
    """Abstract base class for queuing model parameters."""
    def __init__(self, lumbda, mu, numberOfServers=1, systemCapacity=inf):
        self.lumbda = lumbda
        self.mu = mu
        self.numberOfServers = numberOfServers
        self.systemCapacity = systemCapacity

    def findL(self):    raise NotImplementedError
    def findLq(self):   raise NotImplementedError
    def findW(self):    raise NotImplementedError
    def findWq(self):   raise NotImplementedError
    def findPk(self, k): raise NotImplementedError
    def findRu(self):    raise NotImplementedError
```

The base class holds the four parameters and computes nothing. Each
subclass fills in the formulas. For M/M/1 they are short and standard:

```python
class MM1(Params):
    def __init__(self, lumbda, mu):
        if lumbda >= mu:
            raise ValueError("Arrival rate must be less than service rate for stability.")
        super().__init__(lumbda, mu)

    def findL(self):    return self.lumbda / (self.mu - self.lumbda)
    def findLq(self):   return (self.findL() * self.lumbda) / self.mu
    def findW(self):    return 1 / (self.mu - self.lumbda)
    def findWq(self):   return (self.findW() * self.lumbda) / self.mu
    def findRu(self):   return self.lumbda / self.mu
    def findPk(self, k): return pow(self.findRu(), k) * (1 - self.findRu())
```

The stability check in `__init__` matters. If `lumbda >= mu`, the queue
grows without bound and `L` diverges, so we refuse to construct the
object instead of returning NaNs later. The other models validate their
inputs the same way. M/M/c, for example, needs `lumbda < c * mu`. We
check at construction time and fail loudly instead of computing on bad
input.

M/M/c and M/M/c/K are where the math gets ugly. M/M/c needs `P0`, the
probability of an empty system, which is a sum over the first `c`
states plus a closed-form term for the rest. M/M/c/K needs `P0` and an
effective arrival rate, `lambda_dash = lumbda * (1 - P_K)`, because
customers who arrive when the system is full are dropped. One wrong
sign in the summation gives a number that looks plausible but is wrong.

## The simulation layer

`simulation.py` is a discrete-event simulator. Given `lumbda` and `mu`,
it samples interarrival and service times from the exponential
distribution, walks each customer through the queue, and records the
metrics:

```python
interarrival_times = 0.1 * random.exponential(scale=lumbda, size=num_customers)
service_times      = 0.1 * random.exponential(scale=mu,     size=num_customers)

arrival_times = [0]
for i in range(1, num_customers):
    arrival_times.append(arrival_times[i-1] + interarrival_times[i])

start_service_times = [0]
for i in range(1, num_customers):
    start_service_times.append(
        max(arrival_times[i], start_service_times[i-1] + service_times[i-1])
    )
```

The line to read is the `max(...)` for `start_service_times`. A customer
starts service either when they arrive (if the server is idle) or when
the previous customer finishes (if the server is busy), whichever is
later. For a single server, that `max` is the whole queue dynamic in
one expression.

The simulator computes the same metrics as the analytical layer, but
empirically, by averaging the realized `time_in_queue`,
`time_in_system`, and so on. The numbers won't match the closed form
exactly, because the simulator samples a finite number of customers.
With enough customers, they should converge.

## The validation check

This is the part I care about most. We have two implementations of the
same model: a closed form that is exact, and a simulator that is
statistically approximate. If both are correct, the simulator's
empirical `L`, `Lq`, `W`, and `Wq` should converge to the closed-form
values as `num_customers` grows.

```python
# Analytical
m = MM1(lumbda=2.0, mu=3.0)
print(m.findL(), m.findWq())

# Simulated (100k customers)
simulate(lumbda=2.0, mu=3.0, num_customers=100_000)
```

Say the closed form gives `L = 2.0` and the simulator gives `L = 1.98`
after 100k customers. That's good agreement. If they differ by 20
percent, something is wrong in one of them. We used this check
throughout development, and it caught two sign errors in the M/M/c `P0`
series that would otherwise have shipped.

Textbooks don't dwell on this. If you only test your closed form
against the end-of-chapter answers, a typo in a summation index can
survive for weeks, because you can't tell which step in your code
diverged. The simulator is a second, independent path to the same
number. When the two agree, both are very likely right. When they
don't, you at least know there's a bug.

## The chart

The simulator also produces a step chart of customers in the system
over time:

```python
events = []
for i in range(len(arrival_times)):
    events.append((arrival_times[i], 1))         # arrival adds 1
    events.append((completion_times[i], -1))      # departure subtracts 1
events.sort()

time_points, customer_count = [], []
current_customers = 0
for time, event_type in events:
    time_points.append(time)
    current_customers += event_type
    customer_count.append(current_customers)

plt.step(time_points, customer_count, where='post')
```

The chart isn't the point of the project, but it makes the math
visible. In steady state the count should look like noise around a
mean, not a staircase climbing forever. If it climbs, the system is
unstable, usually because `lumbda >= mu`.

## What I took from it

1. **A second implementation is the cheapest check you can write.** The
   textbook gives you formulas but no way to know whether you
   transcribed them correctly. Even a noisy simulator tells you when
   something is off. Ours caught two bugs in M/M/c.

2. **Exponential samples converge slowly.** The variance equals the
   mean squared, so a 100k-customer simulation of an M/M/1 with
   `lumbda=2` and `mu=3` will still wobble around `L=2` by a few
   percent. Before you decide the closed form is wrong, remember that
   the simulator is usually the noisier of the two.

3. **Team projects make you write code someone else will read.** Mohamed
   and Omar wrote the model and simulation core. I had to understand
   their code well enough to wrap a CLI around it, write tests against
   it, and document it. Abdelrahman's GUI had to plug into our existing
   API without us rewriting it for him. That's a different skill from
   writing code for yourself, and the project wouldn't have shipped on
   time without it.

The repo is on [GitHub](https://github.com/0xSA7/Queuepy). The README
has install instructions for both the CLI and the GUI.