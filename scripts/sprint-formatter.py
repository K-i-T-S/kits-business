#!/usr/bin/env python3
"""
KiTS Sprint Formatter — converts claude --output-format stream-json to rich terminal output.
Streams tool call badges + text in real time. Pass through to stdout (piped to tee for logging).
"""
import sys
import json
import os

# ANSI colours
CYAN   = '\033[36m'
GREEN  = '\033[32m'
YELLOW = '\033[33m'
RED    = '\033[31m'
BLUE   = '\033[34m'
GRAY   = '\033[90m'
BOLD   = '\033[1m'
DIM    = '\033[2m'
RESET  = '\033[0m'

TOOL_COLOR = {
    'Read':      CYAN,
    'Write':     GREEN,
    'Edit':      YELLOW,
    'Bash':      BLUE,
    'Glob':      CYAN,
    'Grep':      CYAN,
    'WebFetch':  BLUE,
    'WebSearch': BLUE,
}

TOOL_ICON = {
    'Read':      '●',
    'Write':     '✎',
    'Edit':      '✎',
    'Bash':      '⚡',
    'Glob':      '⌕',
    'Grep':      '⌕',
    'WebFetch':  '⇩',
    'WebSearch': '⇩',
}

def tool_detail(name: str, inp: dict) -> str:
    """Return a short one-line summary of what the tool is doing."""
    if name in ('Read', 'Write'):
        return inp.get('file_path', inp.get('path', ''))
    if name == 'Edit':
        return inp.get('file_path', inp.get('path', ''))
    if name == 'Bash':
        cmd = inp.get('command', '')
        cmd = cmd.replace('\n', ' ').strip()
        return cmd[:110] + ('…' if len(cmd) > 110 else '')
    if name in ('Glob', 'Grep'):
        return inp.get('pattern', inp.get('query', inp.get('glob', '')))
    vals = list(inp.values())
    return str(vals[0])[:100] if vals else ''

def emit(*args, **kwargs):
    """Print with immediate flush."""
    print(*args, **kwargs, flush=True)

def strip_ansi(text: str) -> str:
    import re
    return re.sub(r'\x1B\[[0-9;]*[mK]', '', text)

# Force line-buffered stdin so events arrive as they're written
for line in iter(sys.stdin.readline, ''):
    line = line.rstrip('\n')
    if not line:
        continue

    try:
        ev = json.loads(line)
    except json.JSONDecodeError:
        # Non-JSON (e.g. session limit message) — print directly
        emit(line)
        continue

    t = ev.get('type', '')

    if t == 'system' and ev.get('subtype') == 'init':
        model = ev.get('model', '')
        emit(f'{DIM}╌╌ session start · {model} ╌╌{RESET}')

    elif t == 'assistant':
        msg = ev.get('message', {})
        for block in msg.get('content', []):
            bt = block.get('type', '')
            if bt == 'text':
                text = block.get('text', '')
                if text:
                    emit(text, end='')
            elif bt == 'tool_use':
                name  = block.get('name', '?')
                inp   = block.get('input', {})
                color = TOOL_COLOR.get(name, CYAN)
                icon  = TOOL_ICON.get(name, '●')
                detail = tool_detail(name, inp)
                emit(f'\n{color}{icon} {name}{RESET}  {GRAY}{detail}{RESET}')

    elif t == 'tool_result':
        is_err  = ev.get('is_error', False)
        content = ev.get('content', '')
        if is_err:
            text = ''
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get('type') == 'text':
                        text += c.get('text', '')
            elif isinstance(content, str):
                text = content
            if text:
                emit(f'{RED}  ✗ {text[:300]}{RESET}')

    elif t == 'result':
        sub    = ev.get('subtype', '')
        result = ev.get('result', '')
        if sub == 'success' and result:
            emit(f'\n{result}')
        elif sub == 'error':
            err = ev.get('error', result)
            emit(f'\n{RED}✗ {err}{RESET}')

    # All other event types (tool_result success, system messages) are silent
