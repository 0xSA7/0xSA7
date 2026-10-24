---
title: "auto-git: a small shell script that solved my commit laziness"
description: "How a 150-line bash script that pipes git diffs into an AI CLI ended up changing how I commit to every repo I own, and what I learned about writing tools for myself rather than for an audience."
pubDate: 2026-06-09
tags: ["shell", "tools", "git", "automation"]
draft: false
readTime: "4 min read"
repo: "https://github.com/0xSA7/auto-git"
---

I forget to commit, or more accurately, I commit too late. I would make
twenty changes to my dotfiles across an evening, tell myself I'd write
proper messages in the morning, and two weeks later have to reconstruct
what each uncommitted file was for. Git wasn't the issue. Writing
commit messages felt like homework, so I kept putting it off.

[auto-git](https://github.com/0xSA7/auto-git) is the small shell script
I wrote to fix that. It's 150 lines of bash. It pipes `git diff
--cached` into an AI CLI, asks for a conventional-commit message, and
commits.

This is a narrative post, not a deep technical one. The script is short
enough to read in five minutes. What interests me is why something so
small changed how I work.

## The three-tier fallback

The first version of `do_commit` was naive: pipe the diff to the AI,
take whatever it says, commit. That broke the first time the API
returned a 429. I had staged twenty files, ran the script, got garbage
back, and had to sort out a half-staged repo at midnight.

The current version has three tiers.

```bash
# Attempt 1: flash-lite (cheapest, fastest)
MESSAGE=$(git diff --cached | gemini -y -m flash-lite -o text "..." 2>/dev/null)

# Attempt 2: standard flash (if flash-lite 429s)
if [ $? -ne 0 ] || [ -z "$MESSAGE" ]; then
    MESSAGE=$(git diff --cached | gemini -y -m flash -o text "..." 2>/dev/null)
fi

# Attempt 3: timestamp fallback (if API is completely down)
if [ -z "$MESSAGE" ]; then
    MESSAGE="auto commit: $(date '+%Y-%m-%d %H:%M:%S')
Automated synchronization of repository changes."
fi
```

The third tier matters most. When the network is down, the API quota is
exhausted, or the CLI is broken, the script still commits. The message
is ugly, but the work is saved, and you can fix the message later with
`auto-git amend`.

That's the real lesson. A tool that stops on failure forces you to deal
with the failure right then. A tool that falls back lets you keep
working and clean up later. I'd rather have a hundred
`auto commit: 2026-06-04 14:22:31` entries in my git log than lose an
evening of work because the API was down.

## HTTPS to SSH, automatically

I clone repos over HTTPS by default, since it works on any machine
without SSH keys. But pushing over HTTPS usually means typing
credentials every time, which is friction I don't want.

`do_push` fixes this the first time it runs:

```bash
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
if echo "$REMOTE_URL" | grep -q "^https://github.com"; then
    SSH_URL=$(echo "$REMOTE_URL" | sed 's#https://github.com/#git@github.com:#')
    git remote set-url origin "$SSH_URL"
fi
```

The script doesn't ask and doesn't warn. It rewrites the remote URL and
continues. The assumption is that if you run `auto-git push`, you trust
the script to handle this.

That's deliberate. Tools that ask for confirmation at every step end up
unused, and the point of auto-git is to remove friction, not to add
prompts back.

## Smart push

`do_push` handles three cases explicitly:

```bash
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null)

if [ -z "$REMOTE" ]; then
    # Case 1: No remote branch yet. Initial push with -u.
    git push -u origin "$BRANCH"
elif [ "$LOCAL" != "$REMOTE" ]; then
    # Case 2: Local and remote diverged. Just push.
    git push origin "$BRANCH"
else
    # Case 3: Already up to date. Do nothing.
    echo "[INFO] Already up to date. Nothing to push."
fi
```

The first case matters more than it looks. Setting the upstream on the
first push means later `git pull` and `git push` work without
arguments. New git users often get stuck on this, and the script
handles it silently.

The third case is a small courtesy. Seeing "Already up to date.
Nothing to push." after `auto-git sync` is reassuring, because it means
the script checked and the repo is in the state you expected.

## Conventional commits, by prompt

The prompt to the AI CLI is specific:

> Write a professional multi-line git commit message based on this
> diff following conventional commit guidelines. Include a concise
> summary line (max 50 chars), followed by a blank line, and then
> a detailed description explaining what was changed and why. Output
> ONLY the raw commit message text. Do NOT wrap it in markdown code
> blocks, quotes, or add any extra metadata or explanations.

The last sentence does the most work. AI CLIs like to wrap their output
in markdown fences, add explanations, or open with a preamble, and none
of that is usable as a commit message. Asking for raw text only cut
down the cleanup I had to do.

The script is also fairly CLI-agnostic. I wrote it against Google's
official gemini-cli, but it only assumes the CLI takes input on stdin
and returns text on stdout. Swapping in a different AI CLI later is a
small change to the three `gemini` calls.

## What I took from it

1. **Tools you write for yourself can be opinionated.** auto-git makes
   decisions for me: it switches HTTPS to SSH, it tries the cheapest
   model first, and it falls back to a timestamp when the API is down.
   None of that is configurable. In a product, each of those would be a
   flag. Since I'm the only user, hardcoding them is fine.

2. **The commit matters more than the message.** A bad message on a
   saved change is easy to fix. A great message on a change that never
   got committed doesn't exist. The fallback tier is there because
   saving the work matters more than describing it well.

3. **Ship the smallest useful version.** The first version of auto-git
   was 40 lines, with no fallback, no SSH conversion, and no smart
   push. I used it for a week before adding the rest. If I had tried to
   ship the "complete" version on day one, I'd still be writing the
   README.

The repo is on [GitHub](https://github.com/0xSA7/auto-git). The README
has the usage details, and the script is short enough to read in one
sitting.