# GtkUI Header File Generator

A tool to generate header files for [GtkUI](https://github.com/GtkUI/gtk-ui).

## Requirements

- Node.JS
- NPM

## Usage

```bash
./parser.js TARGET_GIR [OUTPUT_FILE]
```

### Example Usage

```bash
# Explicitly state the files
./parser.js /usr/share/gir-1.0/Gtk-3.0.gir gtk-3.0.gui

# Let the parser figure it out (writes to Gst-1.0.gui)
./parser.js Gst-1.0

# Change the file name
./parser.js Gst-1.0 mywackygstlibrary.gir
```
