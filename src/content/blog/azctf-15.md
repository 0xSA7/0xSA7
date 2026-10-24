---
title: "AzCTF-15: my first attempt at running a CTF, and what the team learned"
description: "How a season-15 Az-SENCS initiative turned into 21 challenges across 6 categories, an honest look at what worked and what didn't, and what we would do differently next time."
pubDate: 2025-05-22
tags: ["ctf", "security", "education", "community"]
draft: false
readTime: "6 min read"
repo: "https://github.com/0xSA7/AzCTF-15"
---

Az-SENCS is the student community for Systems and Computer Engineering
at Al-Azhar University. The name stands for "Systems and Computer
Engineering Society", but for the CTF we leaned into a double meaning:
A to Z CTF. The idea was that the event would cover the full range of
security topics, from A to Z, and that anyone from first-year students
to seniors could find a challenge at their level.

I was Vice President of Az-SENCS for season 15, and one of my
responsibilities was the annual expo. Throughout the year we run
cybersecurity workshops for students who want to get into the field,
and the CTF was meant to be the capstone: a place where workshop
graduates could test what they had learned on realistic but
approachable challenges. We opened it to the public so outside players
could mix with our students. The repo is at
[github.com/0xSA7/AzCTF-15](https://github.com/0xSA7/AzCTF-15).

This post is an honest retrospective. It was my first time running a
CTF. The challenges aren't elite-level, and some of them are crude. The
deployment had rough edges. I'm writing this to document what we
learned, so the next person who runs an Az-SENCS CTF doesn't repeat our
mistakes.

## The categories

We ended up with 21 challenges across 6 categories:

| Category        | Count | Examples                                   |
|-----------------|-------|--------------------------------------------|
| Cryptography    | 7     | Bsmillah, Encoded Whisper, What is my type |
| Forensics       | 4     | APT Intrusion Event, Memory Vanilla        |
| Network         | 2     | Client Secrets, Leaked Evidence            |
| Web             | 8     | 50_Slash_Slash, vault, well-known           |
| OSINT           | N/A   | authored by GERR4Y                         |
| Steganography   | N/A   |                                            |

The distribution is uneven on purpose. Web and Crypto are the
categories students meet first in workshops, so we weighted the CTF
toward them. Network and OSINT had fewer challenges because we had
fewer authors in those areas, not because they matter less.

Each challenge followed the same structure:

```
Cryptography/What is my type/
├── challenge.c            # source
├── challenge              # compiled binary
├── README.md              # description + hints
├── solution.py            # optional solution script
└── temp.txt               # optional notes
```

The README in each challenge folder is the contract with the player. It
has the description, progressive hints (usually three levels), the flag
format, and the intended solution. The `solution.py` file is what we
used to check that a challenge was solvable before publishing it.

## An example: "What is my type"

This is one of the simpler Crypto challenges, and it's a good
representative of the design pattern.

The challenge is a small C program that asks for a username and
password. At compile time, the flag is XORed with a magic number
(`0x6d`, which is 109 in decimal). The user input goes through a
verification algorithm that also uses XOR transformations, and if the
verification value ends up equal to 109, the flag is decrypted and
printed.

The hints escalate:

- Level 1: "The verification algorithm uses bitwise operations."
- Level 2: "Focus on the transformation between user input and the
  final verification value."
- Level 3: "The magic number is 0x6d."

The intended solution is to reverse-engineer the verification logic,
work out that the magic number is 109, and craft inputs (mostly null
bytes, plus one calculated first byte) that cancel out everything
except the critical comparison. The included `solution.py` does exactly
that and pipes the result into the binary.

It isn't hard by CTF standards. An experienced player will probably
solve it in a few minutes. For a second-year student who has just
learned what XOR is, it's a real puzzle, and that's the audience we
were writing for.

## What didn't work

**The challenges were uneven in difficulty.** We had no formal
difficulty rating. Some Web challenges could be solved by inspection,
while others needed knowledge of specific CVEs. A first-time player who
hit a hard one first could easily assume the whole CTF was above their
level and quit. Next time we'd tag every challenge as easy, medium, or
hard and order the listing accordingly.

**The hints were inconsistent.** Some challenges had three levels and
others had one. Some hints gave away the entire solution, and others
were so vague that players came to ask us in person. We should have
standardized the hint format before launch.

**The platform setup was rushed.** We used CTFd, the standard choice,
but we had a few hours of downtime during the event because of a
configuration issue that a dry run would have caught. Next time we'd
run a full internal playtest 48 hours before the event, with team
members playing as participants.

**Team coordination was informal.** I authored most of the challenges,
and the team also included Hizat (deployment and support), GERR4Y
(OSINT challenges), and Basmala Osama (Web challenges). The handoff
between authors and the deployment person was informal, and challenges
reached the repo at the last minute, which is part of why the
deployment was rough.

## What I took from it

1. **Authoring a challenge is harder than solving one.** When you
   solve, you have the binary in front of you and work backwards. When
   you author, you have to design the path the player will take, make
   sure it's the only sensible one, and write hints that nudge without
   revealing. The first few challenges I wrote had unintended
   solutions, and players found them before the intended ones.

2. **An educational CTF is judged by its weakest challenge.** A player
   who solves five easy challenges and then gets stuck on a broken one
   remembers the broken one. The answer isn't to remove the hard
   challenges. It's to have someone who didn't write each challenge
   playtest it before the event.

3. **The loop mattered more than the challenges.** Students who
   attended the workshops during the year got to apply what they
   learned in a setting that felt real, with a scoreboard and other
   players in the room. The challenges were just the material for that
   loop.

The repo is on [GitHub](https://github.com/0xSA7/AzCTF-15). The README
has the full category list and the team credits. If you're thinking
about running a similar event at your own university, the structure is
reusable, and the mistakes above are there so you don't have to repeat
them.