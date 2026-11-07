# ADR-0032: Identify a retried post by its Request key

**Status:** Accepted
**Date:** 2026-11-04

## Problem

An MCP client posts an Entry with `create_entry` (ADR-0031). A client that times
out, loses its connection or is told to try again may send the same call twice,
and the books would hold the Entry twice. Two Entries alike in every field can
also both be real, such as two coffees bought on one day, so a post cannot be
judged a duplicate by its content.

## Decision

`create_entry` takes an optional Request key, a string the client chooses. A
post without one always posts.

- A Request key is unique per User, whichever Connection sent it.
- A post whose key the User has not used posts the Entry and records the key
  against it, in the same atomic write.
- A post whose key names a shown Entry with the same day, Title, memo and lines
  posts nothing and answers that Entry, as the first post did.
- A post whose key names an Entry with other content, or one since reversed,
  answers `CONFLICT`.
- A key is never freed.

The Connection that posted is recorded with the key. Nothing shows it yet.

## Consequences

A retry is safe only when the client sends a key and reuses it. Whether an MCP
client does depends on the client and the model driving it; a post without a
key is not protected.

One table, written by every keyed post and never pruned.

## Rejected alternatives

**The client supplies the Entry id.** No new table, but a model cannot be relied
on to produce a valid uuid v7, and an id is an effect the composition root
supplies.

**Detecting a duplicate by its content within a window.** It refuses two real
Entries that look alike, and lets a retry through once the window passes.

**No protection in the first milestone.** A double post is the failure a User
would meet first, and the key costs one table.
