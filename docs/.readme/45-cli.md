## CLI

The `vcdb` CLI supports an interactive TUI and a server mode.

- Default: run the interactive UI.
- `serve`: start the HTTP server from an executable config.

Usage:

```
vcdb [command] [options]

Commands:
  serve                 Start HTTP server using config (required)

Options:
  --config, -c <path>   Path to executable config (vectordb.config.*)
  --port, -p <number>   Override server.port from config
  --host, -H <host>     Override server.host from config
  --help, -h            Show CLI help
```

Examples:

```
# Launch interactive UI
vcdb

# Start server using the executable config (looks for vectordb.config.*)
vcdb serve

# Explicit config path
vcdb serve -c ./vectordb.config.mjs

# Override host/port (falls back to config when not provided)
vcdb serve -p 8787 -H 0.0.0.0
```

Notes:

- `serve` requires a valid executable config. If no config is found, the CLI exits with an error.
- When both CLI flags and config provide `server.port`/`server.host`, CLI flags take precedence.
