# Publisher Daily Commit

This repository keeps a daily operational report for the local publisher service.

The report is not an empty contribution marker. It records useful runtime facts:

- Gumroad autopilot quota usage
- Gumroad draft activity
- Postly queue ticks
- ngrok tunnel visibility
- recent errors found in the service log tail

Local automation entrypoint:

```bash
scripts/daily-publisher-commit.sh
```

