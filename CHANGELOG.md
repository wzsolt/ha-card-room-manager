# Changelog

## [0.4.3]

- Smoothed the temperature and humidity chart lines and added a subtle fill below them. Current readings now appear on the right in the same row as the chart labels.
- Added chart hover indicators that show the nearest recorded value and its timestamp.

## [0.4.0]

- Added separate temperature and humidity chart switches to the visual editor and YAML. The borderless charts show the last 24 hours of Recorder history at the top of the card and open Home Assistant's native history when tapped.
- Made open doors and windows red while keeping detected motion and presence yellow and inactive sensors green. Active security tiles now use a tinted background without an outline.
- Hid the header's cover, light, and switch summaries when their groups have no active entities. The security summary still reports when all contacts are closed.
- Rewrote the README in English with installation instructions and a complete YAML reference.
