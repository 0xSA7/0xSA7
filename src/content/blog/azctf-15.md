---
title: "AzCTF-15: my first attempt at running a CTF, and what the team learned"
description: "How a semester-15 Az-SENCS initiative turned into 21 challenges across 6 categories, the honest story of what worked and what did not, and what we would do differently next time."
pubDate: 2025-05-22
tags: ["ctf", "security", "education", "community"]
draft: false
readTime: "5 min read"
repo: "https://github.com/0xSA7/AzCTF-15"
---

Az-SENCS is the student community for Systems and Computer Engineering
at Al-Azhar University. The name stands for "Systems and Computer
Engineering Society" in Arabic, but for the CTF we leaned into a
double meaning: A to Z CTF. The idea was that the event would cover
the full range of security topics, from A to Z, and that anyone from
first-year students to seniors could find a challenge at their level.

I was Vice President of Az-SENCS for season 15, and one of my
responsibilities was the annual expo. We run cybersecurity workshops
throughout the year for students who want to break into the field.
The CTF was supposed to be the capstone: a place where workshop
graduates could test what they had learned against realistic but
approachable challenges. We made it open to the public so that
external players could mix with our students. The repo lives at
[github.com/0xSA7/AzCTF-15](https://github.com/0xSA7/AzCTF-15).

This post is an honest retrospective. This was my first time running
a CTF. The challenges are not elite-level. Some of them are crude.
The deployment had rough edges. I am writing this not to sell the
event but to document what we learned, so that the next person who
runs an Az-SENCS CTF does not repeat our mistakes.

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
categories students encounter first in workshops, so we weighted
the CTF toward them. Network and OSINT had fewer challenges because
we had fewer authors in those areas, not because they matter less.

Each challenge followed the same structure:

```
Cryptography/What is my type/
├── challenge.c            # source
├── challenge              # compiled binary
├── README.md              # description + hints
├── solution.py            # optional solution script
└── temp.txt               # optional notes
```

The README inside each challenge folder is the contract with the
player. It contains the challenge description, progressive hints
(usually three levels), the flag format, and the intended solution
approach. The `solution.py` file is what we used to verify the
challenge was solvable before publishing it.

## An example: "What is my type"

This is one of the simpler Crypto challenges, and it is a good
representative of the design pattern.

The challenge is a small C program that asks for a username and
password. Behind the scenes, it XORs the flag with a magic number
(`0x6d`, which is 109 in decimal) during compilation. The user
input is run through a verification algorithm that also uses XOR
transformations. If the verification value ends up equal to 109,
the flag is decrypted and printed.

The hints escalate:

- Level 1: "The verification algorithm uses bitwise operations."
- Level 2: "Focus on the transformation between user input and the
  final verification value."
- Level 3: "The magic number is 0x6d."

The intended solution is to reverse-engineer the verification logic,
realize that the magic number is 109, and craft inputs (mostly null
bytes, plus one calculated first byte) that cancel out everything
except the critical comparison. The included `solution.py` does
exactly this and pipes the result into the binary.

The challenge is not hard by CTF standards. A seasoned player
solves it in under five minutes. For a second-year student who has
just learned what XOR is, it is a genuine puzzle. That is the
audience we were writing for.

## What did not work

I want to be direct about what did not work.

First, the challenges were uneven in difficulty. We had no formal
difficulty rating. Some Web challenges were solvable by inspection;
others required knowledge of specific CVEs. A first-time player
who hit the hard one first would assume the whole CTF was above
their level and quit. Next time, we would add a difficulty tier
(easy, medium, hard) to each challenge and order the listing
accordingly.

Second, the hints were inconsistent. Some challenges had three
levels. Others had one. Some hints gave away the entire solution;
others were so vague that players asked us for clarification in
person. The hint format should have been standardized across all
challenges before launch.

Third, the platform setup. We used CTFd, which is the standard
choice, but the deployment was rushed. We had a few hours of
downtime during the event because of a configuration issue that
should have been caught in a dry run. Next time, we would run a
full internal playtest 48 hours before the event, with team members
acting as players.

Fourth, the team coordination was informal. Challenges arrived in
the repo at the last minute, which is part of why the deployment
was rough.

## What I took from it

Three things stayed with me.

First, authoring challenges is harder than solving them. When you
solve a challenge, you have the binary in front of you and you
work backwards. When you author one, you have to design the path
the player will take, make sure that path is the only sensible
path, and write hints that nudge without revealing. It is a
different kind of thinking, and the first few challenges I wrote
had unintended solutions that players found before the intended
ones.

Second, an educational CTF is judged by its weakest challenge, not
its strongest. A player who solves five easy challenges and gets
stuck on a broken one remembers the broken one. The fix is not to
remove the hard challenges. The fix is to playtest every challenge
with someone who did not write it, before the event.

Third, the value of the CTF was not the challenges. It was the
loop. Students who attended the workshops during the year could
now apply what they learned in a setting that felt real, with a
scoreboard, with other players in the room. The challenges were
the artifact. The loop was the point.

## The team

The CTF would not have happened without:

- **[Hizat](https://www.linkedin.com/in/ibrahim-ezzat-4b21a8234)** - Deployment & Support. Held the CTFd instance together during the event.
- **[GERR4Y](https://www.linkedin.com/in/%D8%A2%D9%8A%D8%A9-%D8%A3%D9%8A%D9%85%D9%86-gerr4y-38a76b28a/)** - OSINT Challenge Author.
- **[Basmala Osama](https://www.linkedin.com/in/basmala-osama)** - Web Challenge Author.

Thanks to all of them. The repo is on [GitHub](https://github.com/0xSA7/AzCTF-15).
If you are thinking about running a similar event at your own university,
the structure is reusable. The mistakes are documented above so that
you do not have to repeat them.
