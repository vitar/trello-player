# .github/workflows/prepare_config.py
import json
import os
import pathlib
import sys

def main():
    """Generates the trello-player-config.js file based on environment variables."""
    try:
        dest_dir = pathlib.Path(os.environ["DEST"])
        proxy_url = os.environ["PROXY_URL"]
    except KeyError as e:
        print(f"Error: Required environment variable {e} is not set.")
        sys.exit(1)

    if not dest_dir.is_dir():
        print(f"Error: Destination directory '{dest_dir}' does not exist.")
        sys.exit(1)

    config_lines = [
        "window.trelloPlayerConfig = window.trelloPlayerConfig || {};\n",
        "window.trelloPlayerConfig.proxyUrl = " + json.dumps(proxy_url) + ";\n",
    ]
    
    config_file = dest_dir / "trello-player-config.js"
    config_file.write_text("".join(config_lines), encoding="utf-8")
    
    print(f"Config file '{config_file}' created successfully.")

if __name__ == "__main__":
    main()