# Audit report for Ana Silva

## @we-the-rebel-alliance/harbour-plugin 0.0.0

Manifest: sha256:0fb0464554c708047daccc9195ce2268e4ea6aa211dae8db22373696c7e581d9
Access: read-only

### Methods

| Method | Class | Declared effect | Access |
| --- | --- | --- | --- |
| status | read | none | runs |
| probe | read | none | runs |
| events_list | read | none | runs |
| read_note | read | none | runs |
| list_spaces | read | none | runs |

### What it may read

| Source | Method | Operations | Accounts | Private | Cost | Grant |
| --- | --- | --- | --- | --- | --- | --- |
| harbour.notes | events_list | harbour.users.get, harbour.notes.list, harbour.notes.get | optional | yes | free | notes on work, scope {"spaces":["space-research"]}, granted 2026-11-20T10:00:00.000Z by Ana Silva (disabled) |

### What it may do

No actions.

## @we-the-rebel-alliance/trellis-plugin 0.0.0

Manifest: sha256:0f6f8c30e98ed1486e92c08b4f41a1da7a561961b0975bf497a316da1b3778f8
Access: ask-changes

### Methods

| Method | Class | Declared effect | Access |
| --- | --- | --- | --- |
| status | read | none | runs |
| probe | read | none | runs |
| events_list | read | none | runs |
| read_thread | read | none | runs |
| list_channels | read | none | runs |
| mcp:* | read | none | runs |

### What it may read

| Source | Method | Operations | Accounts | Private | Cost | Grant |
| --- | --- | --- | --- | --- | --- | --- |
| trellis.messages | events_list | trellis.users.get, messages_search, messages_read | optional | yes | free | digest on personal, scope {"channels":["C-RESEARCH"]}, granted 2026-11-20T10:05:00.000Z by Ana Silva (stale) |

### What it may do

No actions.

## @we-the-rebel-alliance/glyph-plugin 0.0.0

Manifest: sha256:112a93a1195b2befa6a8ab00076f58ad1b75ffae2ad843069f950c4d400e8e0e
Access: all

### Methods

| Method | Class | Declared effect | Access |
| --- | --- | --- | --- |
| status | read | none | runs |
| word_count | read | none | runs |
| read_note | read | none | runs |
| plan_write_note | read | none | runs |
| write_note | write | none | runs |

### What it may read

No sources.

### What it may do

No actions.

## Problems

- **problem:** the plugin "ghost" is not installed. notes on work, scope {}, granted 2026-11-20T10:10:00.000Z by Ana Silva
